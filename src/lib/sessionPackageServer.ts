// HP-31 — phần chạm DB của gói buổi trả trước + sổ sử dụng. Quy tắc thuần ở sessionPackage.ts. SỔ BUỔI, không chuyển tiền thật.
//  • Mọi đường GHI ở đây tắt khi VERCEL_ENV=preview (preview dùng chung DB production).
//  • Chỉ lớp kiểu mới theo buổi / theo giờ. Lớp cũ (monthly_sessions) và lớp theo khoá: không tạo gói, không trừ buổi.
//  • KHÔNG đụng FeeCharge / TuitionInvoice (chỉ ĐỌC để báo "khoản học phí cùng buổi").
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { vnDateKeyOf } from "@/lib/classSessions";
import { isClosed } from "@/lib/sessionBook";
import { normalizeFeeMode } from "@/lib/tuitionFee";
import { moneyPathsBlocked, PREVIEW_BLOCKED_MESSAGE, unitSessionPrice } from "@/lib/feeChargeServer";
import {
  PACKAGE_MAX_OPEN_PER_STUDENT, balanceOf, chargeLinkOf, consumesPackage, planUse, snapshotTotal, statusAfter,
  type ChargeLink, type PackageInput, type PackageStatus,
} from "@/lib/sessionPackage";

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

const lockStudentCourse = (tx: Tx, courseId: string, studentId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pkg:${courseId}:${studentId}`}))`;

const isSessionMode = (m: string | null | undefined) => { const x = normalizeFeeMode(m); return x === "per_session" || x === "per_hour"; };

// ─── Lập / huỷ gói ───────────────────────────────────────────────────────────
export type CreateResult =
  | { ok: true; id: string; unitPrice: number; totalPrice: number }
  | { ok: false; status: number; error: string };

export async function createPackage(a: { courseId: string; by: string; input: PackageInput; now?: Date }): Promise<CreateResult> {
  if (moneyPathsBlocked()) return { ok: false, status: 503, error: PREVIEW_BLOCKED_MESSAGE };
  const today = vnDateKeyOf(a.now ?? new Date());
  return prisma.$transaction(async tx => {
    const course = await tx.course.findUnique({ where: { id: a.courseId }, select: { feeMode: true, ownerId: true } });
    if (!course) return { ok: false, status: 404, error: "Không tìm thấy lớp" } as CreateResult;
    if (!isSessionMode(course.feeMode)) return { ok: false, status: 409, error: "Gói buổi chỉ dùng cho lớp tính học phí theo buổi hoặc theo giờ (lớp tạo theo kiểu mới)." } as CreateResult;
    const enr = await tx.enrollment.findFirst({ where: { courseId: a.courseId, userId: a.input.studentId, status: "active" }, select: { id: true } });
    if (!enr) return { ok: false, status: 400, error: "Em này không học lớp này." } as CreateResult;
    await lockStudentCourse(tx, a.courseId, a.input.studentId);
    const open = await tx.sessionPackage.count({ where: { courseId: a.courseId, studentId: a.input.studentId, status: { in: ["active", "used_up"] } } });
    if (open >= PACKAGE_MAX_OPEN_PER_STUDENT) return { ok: false, status: 409, error: `Mỗi em tối đa ${PACKAGE_MAX_OPEN_PER_STUDENT} gói trong một lớp. Huỷ bớt gói không dùng nữa trước.` } as CreateResult;
    const unit = await unitSessionPrice(tx, a.courseId, a.input.studentId, today);
    if (unit == null) return { ok: false, status: 409, error: "Lớp chưa có đơn giá một buổi nên chưa ghi được giá của gói." } as CreateResult;
    const total = snapshotTotal(unit, a.input.sessions);
    if (total == null) return { ok: false, status: 400, error: "Giá của gói quá lớn hoặc không hợp lệ." } as CreateResult;
    const row = await tx.sessionPackage.create({
      data: { tutorId: course.ownerId ?? a.by, courseId: a.courseId, studentId: a.input.studentId, sessions: a.input.sessions, unitPrice: unit, totalPrice: total, note: a.input.note, createdBy: a.by },
    });
    // Buổi ĐÃ CHỐT trước khi lập gói không bị trừ ngược: gói chỉ trừ từ những buổi chốt (hoặc sửa điểm danh sau chốt) SAU khi lập.
    return { ok: true, id: row.id, unitPrice: unit, totalPrice: total } as CreateResult;
  });
}

export async function cancelPackage(courseId: string, packageId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (moneyPathsBlocked()) return { ok: false, status: 503, error: PREVIEW_BLOCKED_MESSAGE };
  const row = await prisma.sessionPackage.findFirst({ where: { id: packageId, courseId }, select: { id: true, status: true } });
  if (!row) return { ok: false, status: 404, error: "Không tìm thấy gói" };
  if (row.status === "cancelled") return { ok: false, status: 409, error: "Gói này đã huỷ rồi." };
  const u = await prisma.sessionPackage.updateMany({ where: { id: packageId, courseId, status: { not: "cancelled" } }, data: { status: "cancelled", cancelledAt: new Date() } });
  return u.count === 1 ? { ok: true } : { ok: false, status: 409, error: "Gói này đã huỷ rồi." };
}

// ─── Trừ buổi / trả buổi theo buổi học ───────────────────────────────────────
export interface PackageSyncResult { skipped?: "preview" | "mode" | "open"; used: number; returned: number }
const NONE: PackageSyncResult = { used: 0, returned: 0 };

async function activeUsesOf(db: Db, packageIds: string[]): Promise<Map<string, number>> {
  if (!packageIds.length) return new Map();
  const g = await db.sessionPackageUse.groupBy({ by: ["packageId"], where: { packageId: { in: packageIds }, reversedAt: null }, _count: { _all: true } });
  return new Map(g.map(x => [x.packageId, x._count._all]));
}
async function refreshStatus(tx: Tx, packageId: string): Promise<void> {
  const p = await tx.sessionPackage.findUnique({ where: { id: packageId }, select: { status: true, sessions: true } });
  if (!p) return;
  const activeUses = (await activeUsesOf(tx, [packageId])).get(packageId) ?? 0;
  const next = statusAfter({ status: p.status, sessions: p.sessions, activeUses });
  if (next !== p.status) await tx.sessionPackage.update({ where: { id: packageId }, data: { status: next } });
}

/**
 * Gọi TRONG transaction (đã khoá buổi) sau khi buổi ĐÃ CHỐT hoặc sau khi lưu điểm danh của buổi đã chốt: trừ buổi cho em có mặt/muộn, trả buổi cho em không còn tính.
 * Buổi chưa chốt: không làm gì. Lớp cũ / theo khoá / preview: không làm gì.
 * Gói chỉ trừ cho buổi chốt SAU khi gói được lập (createdAt <= closedAt): lập gói không trừ ngược các buổi đã chốt từ trước.
 * `userIds`: chỉ xét các em này (lưu điểm danh một vài em không kéo theo em khác).
 */
export async function syncPackageUsesForSession(tx: Tx, sessionId: string, opts: { now?: Date; userIds?: readonly string[] } = {}): Promise<PackageSyncResult> {
  const now = opts.now ?? new Date();
  const ses = await tx.attendanceSession.findUnique({ where: { id: sessionId }, select: { id: true, courseId: true, date: true, state: true, closedAt: true } });
  if (!ses) return { ...NONE, skipped: "mode" };
  const course = await tx.course.findUnique({ where: { id: ses.courseId }, select: { feeMode: true } });
  if (!isSessionMode(course?.feeMode)) return { ...NONE, skipped: "mode" };
  if (moneyPathsBlocked()) return { ...NONE, skipped: "preview" };
  if (!isClosed(ses.state)) return { ...NONE, skipped: "open" };

  const dateKey = vnDateKeyOf(ses.date);
  const [records, credits] = await Promise.all([
    tx.attendanceRecord.findMany({ where: { sessionId, ...(opts.userIds ? { userId: { in: [...opts.userIds] } } : {}) }, select: { id: true, userId: true, status: true } }),
    tx.makeupCredit.findMany({ where: { usedSessionId: sessionId }, select: { studentId: true } }),
  ]);
  const makeup = new Set(credits.map(c => c.studentId));
  const uses = await tx.sessionPackageUse.findMany({ where: { recordId: { in: records.map(r => r.id) } } });
  const useOf = new Map(uses.map(u => [u.recordId, u]));
  const out: PackageSyncResult = { used: 0, returned: 0 };
  const touched = new Set<string>();

  for (const r of records) {
    const existing = useOf.get(r.id) ?? null;
    const consumes = consumesPackage({ status: r.status, makeupUsed: makeup.has(r.userId) });
    if (!consumes && !(existing && !existing.reversedAt)) continue;       // không tính và cũng chưa trừ gì: bỏ qua, không khoá
    await lockStudentCourse(tx, ses.courseId, r.userId);
    const pkgs = await tx.sessionPackage.findMany({ where: { courseId: ses.courseId, studentId: r.userId }, select: { id: true, status: true, sessions: true, createdAt: true } });
    const counts = await activeUsesOf(tx, pkgs.map(p => p.id));
    const coverFrom = ses.closedAt ?? now;
    const act = planUse({ consumes, existing, packages: pkgs.filter(p => p.createdAt <= coverFrom).map(p => ({ ...p, activeUses: counts.get(p.id) ?? 0 })) });
    if (act.type === "create") {
      await tx.sessionPackageUse.create({ data: { packageId: act.packageId, recordId: r.id, sessionId, dateKey, usedAt: now } });
      touched.add(act.packageId); out.used++;
    } else if (act.type === "revive") {
      await tx.sessionPackageUse.update({ where: { id: existing!.id }, data: { packageId: act.packageId, reversedAt: null, usedAt: now, dateKey } });
      touched.add(act.packageId); out.used++;
    } else if (act.type === "reverse" && existing) {
      await tx.sessionPackageUse.update({ where: { id: existing.id }, data: { reversedAt: now } });
      touched.add(existing.packageId); out.returned++;
    }
  }
  for (const id of touched) await refreshStatus(tx, id);
  return out;
}

/** Mở lại hoặc xoá buổi: trả mọi buổi đã trừ cho buổi này (giữ lịch sử). Gọi TRƯỚC khi xoá buổi. */
export async function reversePackageUsesForSession(tx: Tx, sessionId: string, now: Date = new Date()): Promise<number> {
  if (moneyPathsBlocked()) return 0;
  const uses = await tx.sessionPackageUse.findMany({ where: { sessionId, reversedAt: null }, select: { id: true, packageId: true } });
  if (!uses.length) return 0;
  await tx.sessionPackageUse.updateMany({ where: { id: { in: uses.map(u => u.id) }, reversedAt: null }, data: { reversedAt: now } });
  for (const id of new Set(uses.map(u => u.packageId))) await refreshStatus(tx, id);
  return uses.length;
}

// ─── Đọc: sổ sử dụng cho gia sư và phụ huynh ─────────────────────────────────
export interface PackageUseRow { dateKey: string; reversed: boolean; chargeLink: ChargeLink }
export interface PackageRow {
  id: string; studentId: string; studentName: string; sessions: number; used: number; balance: number;
  unitPrice: number; totalPrice: number; status: PackageStatus; note: string | null; createdAt: string; cancelledAt: string | null; uses: PackageUseRow[];
}

/** Sổ gói của một lớp (gia sư chủ lớp). Có tên em và giá ghi lúc lập: chỉ trả cho người đã qua kiểm quyền lớp. */
export async function listCoursePackages(courseId: string, usesPerPackage = 30): Promise<PackageRow[]> {
  const pkgs = await prisma.sessionPackage.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 200, include: { uses: { orderBy: { dateKey: "desc" }, take: usesPerPackage } } });
  if (!pkgs.length) return [];
  const names = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(pkgs.map(p => p.studentId))] } }, select: { id: true, name: true } })).map(u => [u.id, u.name]));
  const counts = await activeUsesOf(prisma, pkgs.map(p => p.id));
  const recordIds = pkgs.flatMap(p => p.uses.map(u => u.recordId));
  const charges = recordIds.length ? await prisma.feeCharge.findMany({ where: { recordId: { in: recordIds } }, select: { recordId: true, invoiceId: true } }) : [];
  const chargeOf = new Map(charges.map(c => [c.recordId as string, c]));
  return pkgs.map(p => {
    const used = counts.get(p.id) ?? 0;
    return {
      id: p.id, studentId: p.studentId, studentName: names.get(p.studentId) ?? "Học sinh", sessions: p.sessions, used, balance: balanceOf({ sessions: p.sessions, activeUses: used }),
      unitPrice: p.unitPrice, totalPrice: p.totalPrice, status: p.status as PackageStatus, note: p.note, createdAt: p.createdAt.toISOString(), cancelledAt: p.cancelledAt?.toISOString() ?? null,
      uses: p.uses.map(u => ({ dateKey: u.dateKey, reversed: !!u.reversedAt, chargeLink: chargeLinkOf(chargeOf.has(u.recordId) ? { exists: true, invoiceId: chargeOf.get(u.recordId)!.invoiceId } : null) })),
    };
  });
}

export interface PartyPackage { courseName: string; sessions: number; used: number; balance: number; status: PackageStatus; uses: Array<{ dateKey: string }> }

/** Sổ sử dụng của ĐÚNG MỘT em (Sổ của con): khoá theo studentId của liên kết đã xác nhận. Không giá, không ghi chú, không tên gia sư; không gói đã huỷ. */
export async function loadPartyPackages(studentId: string, usesLimit = 12): Promise<PartyPackage[]> {
  const pkgs = await prisma.sessionPackage.findMany({
    where: { studentId, status: { in: ["active", "used_up"] } }, orderBy: { createdAt: "desc" }, take: 20,
    include: { course: { select: { name: true } }, uses: { where: { reversedAt: null }, orderBy: { dateKey: "desc" }, take: usesLimit } },
  });
  const counts = await activeUsesOf(prisma, pkgs.map(p => p.id));
  return pkgs.map(p => {
    const used = counts.get(p.id) ?? 0;
    return { courseName: p.course.name, sessions: p.sessions, used, balance: balanceOf({ sessions: p.sessions, activeUses: used }), status: p.status as PackageStatus, uses: p.uses.map(u => ({ dateKey: u.dateKey })) };
  });
}
