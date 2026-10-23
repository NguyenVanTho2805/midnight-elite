// HP-14..HP-17 — thao tác DB cho học phí kiểu mới (FeeCharge, CourseFeeRate, CourseStudentRate).
// Mọi đường TÍNH TIỀN MỚI ở đây đều tắt khi VERCEL_ENV=preview (preview dùng chung DB production — xem scripts/db-push-on-production.mjs).
// Lớp cách cũ (Course.feeMode = "monthly_sessions", mọi lớp hiện có) KHÔNG bao giờ chạm bảng nào ở đây: các hàm trả sớm trước khi ghi.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { vnDateKeyOf } from "@/lib/classSessions";
import {
  FEE_RATE_FROM_START, courseFee, isChargeableStatus, isNewFeeMode, normalizeFeeMode, planReprice, sessionFee,
  type ChargeLite, type ClassRate, type FeeMode, type FeeSetup, type RepricePlan, type StudentRate,
} from "@/lib/tuitionFee";

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

/** Chặn đường tính tiền mới ở bản xem trước (dùng chung DB production). */
export function moneyPathsBlocked(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "preview";
}
export const PREVIEW_BLOCKED_MESSAGE = "Bản xem trước không tính học phí. Hãy dùng bản chính thức.";

async function ratesOf(db: Db, courseId: string): Promise<ClassRate[]> {
  const rows = await db.courseFeeRate.findMany({ where: { courseId }, orderBy: { effectiveFrom: "asc" } });
  return rows.map(r => ({ rate: r.rate, sessionMinutes: r.sessionMinutes, effectiveFrom: r.effectiveFrom }));
}
async function studentRatesOf(db: Db, courseId: string, studentIds?: string[]): Promise<Map<string, StudentRate[]>> {
  const rows = await db.courseStudentRate.findMany({ where: { courseId, ...(studentIds ? { studentId: { in: studentIds } } : {}) }, orderBy: { effectiveFrom: "asc" } });
  const m = new Map<string, StudentRate[]>();
  for (const r of rows) { const l = m.get(r.studentId) ?? []; l.push({ rate: r.rate, effectiveFrom: r.effectiveFrom }); m.set(r.studentId, l); }
  return m;
}

// ─── Tạo lớp (HP-15) ─────────────────────────────────────────────────────────
/** Ghi đơn giá đầu tiên của lớp mới, hiệu lực "từ khi tạo lớp" (FEE_RATE_FROM_START) nên mọi mốc đổi sau đều thắng theo ngày. */
export async function createInitialFeeRate(tx: Tx, courseId: string, setup: FeeSetup, by: string) {
  return tx.courseFeeRate.create({
    data: { courseId, mode: setup.mode, rate: setup.rate, sessionMinutes: setup.sessionMinutes, effectiveFrom: FEE_RATE_FROM_START, note: "Đơn giá khi tạo lớp", createdBy: by },
  });
}

// ─── Điểm danh → dòng phí theo buổi (HP-14) ──────────────────────────────────
export interface SyncResult { skipped?: "preview" | "mode"; created: number; updated: number; removed: number; locked: number }

/**
 * Gọi TRONG transaction lưu điểm danh, SAU khi các bản ghi đã upsert. Lớp cách cũ / theo khoá: trả sớm, không ghi gì.
 * Dòng đã vào phiếu thì không đổi (locked). Buổi dùng buổi bù không tính thêm tiền (makeupUsed).
 */
export async function syncSessionCharges(tx: Tx, a: {
  sessionId: string; courseId: string; sessionDate: Date; by: string; items: ReadonlyArray<{ userId: string; status: string; makeupUsed: boolean }>;
}): Promise<SyncResult> {
  const none: SyncResult = { created: 0, updated: 0, removed: 0, locked: 0 };
  const course = await tx.course.findUnique({ where: { id: a.courseId }, select: { feeMode: true, ownerId: true } });
  const mode = normalizeFeeMode(course?.feeMode);
  if (!course || (mode !== "per_session" && mode !== "per_hour")) return { ...none, skipped: "mode" };
  if (moneyPathsBlocked()) return { ...none, skipped: "preview" };

  const tutorId = course.ownerId ?? a.by;
  const dateKey = vnDateKeyOf(a.sessionDate);
  const yearMonth = dateKey.slice(0, 7);
  const userIds = a.items.map(i => i.userId);
  const [classRates, stuRates, records] = await Promise.all([
    ratesOf(tx, a.courseId),
    studentRatesOf(tx, a.courseId, userIds),
    tx.attendanceRecord.findMany({ where: { sessionId: a.sessionId, userId: { in: userIds } }, select: { id: true, userId: true } }),
  ]);
  const recOf = new Map(records.map(r => [r.userId, r.id]));
  const existing = await tx.feeCharge.findMany({ where: { recordId: { in: records.map(r => r.id) } } });
  const curOf = new Map(existing.map(c => [c.recordId!, c]));

  const out = { ...none };
  for (const it of a.items) {
    const recordId = recOf.get(it.userId);
    if (!recordId) continue;
    const cur = curOf.get(recordId);
    if (cur?.invoiceId) { out.locked++; continue; }
    const fee = isChargeableStatus(it.status) && !it.makeupUsed
      ? sessionFee({ mode, dateKey, classRates, studentRates: stuRates.get(it.userId) ?? [] })
      : null;
    if (!fee) {
      if (cur) { const d = await tx.feeCharge.deleteMany({ where: { id: cur.id, invoiceId: null } }); if (d.count) out.removed++; else out.locked++; }
      continue;
    }
    if (!cur) {
      await tx.feeCharge.create({
        data: { tutorId, courseId: a.courseId, studentId: it.userId, kind: "session", recordId, dateKey, yearMonth, amount: fee.amount, units: fee.units, rate: fee.rate, rateSource: fee.rateSource, mode },
      });
      out.created++;
    } else if (cur.amount !== fee.amount || cur.rate !== fee.rate || cur.units !== fee.units || cur.rateSource !== fee.rateSource) {
      const u = await tx.feeCharge.updateMany({ where: { id: cur.id, invoiceId: null }, data: { amount: fee.amount, units: fee.units, rate: fee.rate, rateSource: fee.rateSource } });
      if (u.count) out.updated++; else out.locked++;
    }
  }
  return out;
}

/** Xoá buổi điểm danh: bỏ các dòng phí CHƯA vào phiếu của buổi đó (dòng đã vào phiếu giữ nguyên, đóng băng). Gọi TRƯỚC khi xoá buổi. */
export async function removeUninvoicedChargesForSession(db: Db, sessionId: string): Promise<number> {
  const recs = await db.attendanceRecord.findMany({ where: { sessionId }, select: { id: true } });
  if (recs.length === 0) return 0;
  const r = await db.feeCharge.deleteMany({ where: { recordId: { in: recs.map(x => x.id) }, invoiceId: null } });
  return r.count;
}

// ─── Đổi đơn giá có hiệu lực từ ngày (HP-16, HP-17) ──────────────────────────
export interface FeeOverview {
  feeMode: FeeMode;
  classRates: Array<ClassRate & { id: string; note: string | null; createdAt: string }>;
  studentRates: Array<{ id: string; studentId: string; rate: number; effectiveFrom: string; note: string | null; createdAt: string }>;
}

export async function feeOverview(courseId: string): Promise<FeeOverview | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { feeMode: true } });
  if (!course) return null;
  const [rates, stu] = await Promise.all([
    prisma.courseFeeRate.findMany({ where: { courseId }, orderBy: { effectiveFrom: "desc" } }),
    prisma.courseStudentRate.findMany({ where: { courseId }, orderBy: [{ studentId: "asc" }, { effectiveFrom: "desc" }] }),
  ]);
  return {
    feeMode: normalizeFeeMode(course.feeMode),
    classRates: rates.map(r => ({ id: r.id, rate: r.rate, sessionMinutes: r.sessionMinutes, effectiveFrom: r.effectiveFrom, note: r.note, createdAt: r.createdAt.toISOString() })),
    studentRates: stu.map(r => ({ id: r.id, studentId: r.studentId, rate: r.rate, effectiveFrom: r.effectiveFrom, note: r.note, createdAt: r.createdAt.toISOString() })),
  };
}

async function sessionChargesFrom(db: Db, courseId: string, fromDateKey: string, studentId?: string): Promise<ChargeLite[]> {
  const rows = await db.feeCharge.findMany({
    where: { courseId, kind: "session", dateKey: { gte: fromDateKey }, ...(studentId ? { studentId } : {}) },
    select: { id: true, studentId: true, dateKey: true, amount: true, kind: true, invoiceId: true },
  });
  return rows;
}

export type RateChange =
  | { type: "class"; rate: number; sessionMinutes: number | null; effectiveFrom: string }
  | { type: "student"; studentId: string; rate: number | null; effectiveFrom: string }; // rate null = xoá mốc đơn giá riêng có đúng ngày hiệu lực này

export type RateChangeResult =
  | { ok: true; plan: RepricePlan; perCourse?: { pendingStudents: number; beforeEach: number | null; afterEach: number | null } }
  | { ok: false; status: number; error: string };

/**
 * Xem trước (apply=false) hoặc ÁP DỤNG (apply=true) một thay đổi đơn giá. Cùng một đường tính (planReprice) nên số xem trước = số ghi.
 * Chỉ dòng buổi CHƯA vào phiếu có ngày >= effectiveFrom bị tính lại; phiếu/dòng đã chốt không đổi.
 */
export async function changeRate(courseId: string, change: RateChange, by: string, opts: { apply: boolean; note?: string | null }): Promise<RateChangeResult> {
  if (moneyPathsBlocked()) return { ok: false, status: 503, error: PREVIEW_BLOCKED_MESSAGE };
  const run = async (db: Db): Promise<RateChangeResult> => {
    const course = await db.course.findUnique({ where: { id: courseId }, select: { feeMode: true } });
    if (!course) return { ok: false, status: 404, error: "Không tìm thấy lớp" };
    const mode = normalizeFeeMode(course.feeMode);
    if (!isNewFeeMode(mode)) return { ok: false, status: 409, error: "Lớp này tính học phí theo số buổi trong tháng (cách cũ) nên không đổi đơn giá ở đây." };

    const classRates = await ratesOf(db, courseId);
    const stuMap = await studentRatesOf(db, courseId);
    let nextClass = classRates;
    const nextStu = new Map(stuMap);

    if (change.type === "class") {
      if (classRates.some(r => r.effectiveFrom === change.effectiveFrom)) return { ok: false, status: 409, error: "Đã có đơn giá hiệu lực từ đúng ngày này. Chọn ngày khác." };
      nextClass = [...classRates, { rate: change.rate, sessionMinutes: mode === "per_hour" ? change.sessionMinutes : null, effectiveFrom: change.effectiveFrom }];
    } else {
      const list = (stuMap.get(change.studentId) ?? []).filter(r => r.effectiveFrom !== change.effectiveFrom);
      if (change.rate != null) list.push({ rate: change.rate, effectiveFrom: change.effectiveFrom });
      // rate = null: xoá đúng mốc đơn giá riêng có ngày hiệu lực này (hoàn lại về mốc trước đó hoặc đơn giá lớp).
      nextStu.set(change.studentId, list);
    }

    const charges = await sessionChargesFrom(db, courseId, change.effectiveFrom, change.type === "student" ? change.studentId : undefined);
    const plan = planReprice({
      mode, fromDateKey: change.effectiveFrom, charges,
      next: { classRates: nextClass, studentRatesOf: id => nextStu.get(id) ?? [] },
    });

    let perCourse: { pendingStudents: number; beforeEach: number | null; afterEach: number | null } | undefined;
    if (mode === "per_course") {
      const enrolled = await db.enrollment.findMany({ where: { courseId, status: "active", ...(change.type === "student" ? { userId: change.studentId } : {}) }, select: { userId: true } });
      const charged = await db.feeCharge.findMany({ where: { courseId, kind: "course", studentId: { in: enrolled.map(e => e.userId) } }, select: { studentId: true } });
      const done = new Set(charged.map(c => c.studentId));
      const pending = enrolled.filter(e => !done.has(e.userId));
      const first = pending[0]?.userId;
      const nowKey = vnDateKeyOf(new Date());
      perCourse = {
        pendingStudents: pending.length,
        beforeEach: first ? courseFee({ mode, dateKey: nowKey, classRates, studentRates: stuMap.get(first) ?? [] })?.amount ?? null : null,
        afterEach: first ? courseFee({ mode, dateKey: nowKey, classRates: nextClass, studentRates: nextStu.get(first) ?? [] })?.amount ?? null : null,
      };
    }

    if (opts.apply) {
      if (change.type === "class") {
        await db.courseFeeRate.create({ data: { courseId, mode, rate: change.rate, sessionMinutes: mode === "per_hour" ? change.sessionMinutes : null, effectiveFrom: change.effectiveFrom, note: opts.note ?? null, createdBy: by } });
      } else if (change.rate != null) {
        await db.courseStudentRate.upsert({
          where: { courseId_studentId_effectiveFrom: { courseId, studentId: change.studentId, effectiveFrom: change.effectiveFrom } },
          create: { courseId, studentId: change.studentId, rate: change.rate, effectiveFrom: change.effectiveFrom, note: opts.note ?? null, createdBy: by },
          update: { rate: change.rate, note: opts.note ?? null, createdBy: by },
        });
      } else {
        await db.courseStudentRate.deleteMany({ where: { courseId, studentId: change.studentId, effectiveFrom: change.effectiveFrom } });
      }
      for (const u of plan.updates) {
        await db.feeCharge.updateMany({ where: { id: u.id, invoiceId: null }, data: { amount: u.to, rate: u.rate, units: u.units, rateSource: u.rateSource } });
      }
    }
    return { ok: true, plan, perCourse };
  };
  return opts.apply ? prisma.$transaction(async tx => run(tx)) : run(prisma);
}

// ─── Vào phiếu (gọi trong issueInvoice) ──────────────────────────────────────
export interface InvoiceChargeRow {
  id: string; courseId: string; courseName: string; kind: string; label: string | null; amount: number; units: number | null; rate: number | null; mode: string; dateKey: string;
}

/** Tạo dòng "cả khoá" cho em ở các lớp theo khoá nếu CHƯA từng tính (một lần cho mỗi cặp em–lớp). Gọi trong transaction lập phiếu. */
export async function ensureCourseCharges(tx: Tx, a: {
  tutorId: string; studentId: string; yearMonth: string; now: Date; courses: ReadonlyArray<{ id: string; feeMode: string }>;
}): Promise<void> {
  const todayKey = vnDateKeyOf(a.now);
  for (const c of a.courses) {
    if (normalizeFeeMode(c.feeMode) !== "per_course") continue;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fee-course:${c.id}:${a.studentId}`}))`;
    if (await tx.feeCharge.findFirst({ where: { courseId: c.id, studentId: a.studentId, kind: "course" }, select: { id: true } })) continue;
    const [classRates, stu] = await Promise.all([ratesOf(tx, c.id), studentRatesOf(tx, c.id, [a.studentId])]);
    const fee = courseFee({ mode: "per_course", dateKey: todayKey, classRates, studentRates: stu.get(a.studentId) ?? [] });
    if (!fee) continue;
    await tx.feeCharge.create({
      data: { tutorId: a.tutorId, courseId: c.id, studentId: a.studentId, kind: "course", dateKey: todayKey, yearMonth: a.yearMonth, amount: fee.amount, rate: fee.rate, rateSource: fee.rateSource, mode: "per_course" },
    });
  }
}

/**
 * Các dòng phí chưa vào phiếu của em trong tháng `yearMonth`, kèm tên lớp. `lock` = khoá hàng FOR UPDATE (dùng khi lập phiếu) để
 * lưu điểm danh đồng thời không đổi số giữa lúc đọc và lúc đóng băng.
 */
export async function loadUninvoicedCharges(tx: Tx, a: { tutorId: string; studentId: string; yearMonth: string; lock?: boolean }): Promise<InvoiceChargeRow[]> {
  if (a.lock) {
    await tx.$queryRaw`SELECT id FROM fee_charges WHERE "tutorId" = ${a.tutorId} AND "studentId" = ${a.studentId} AND "yearMonth" = ${a.yearMonth} AND "invoiceId" IS NULL FOR UPDATE`;
  }
  const rows = await tx.feeCharge.findMany({
    where: { tutorId: a.tutorId, studentId: a.studentId, yearMonth: a.yearMonth, invoiceId: null },
    include: { course: { select: { name: true } } },
    orderBy: [{ dateKey: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(r => ({ id: r.id, courseId: r.courseId, courseName: r.course.name, kind: r.kind, label: r.label, amount: r.amount, units: r.units, rate: r.rate, mode: r.mode, dateKey: r.dateKey }));
}

// ─── HP-18/HP-19: phí khác áp chung cả lớp ───────────────────────────────────
export type ExtraFeeResult =
  | { ok: true; created: number; skippedDuplicate: number; total: number }
  | { ok: false; status: number; error: string };

/**
 * Thêm một khoản phí (tài liệu, quỹ lớp, phí thi…) cho mọi em đang học lớp (hoặc danh sách `studentIds`). Mỗi em một dòng FeeCharge
 * kind="extra"; vào phiếu của tháng chứa `dateKey` khi lập phiếu, hoặc gộp vào phiếu nháp bằng "gộp khoản rời" (HP-24).
 * Chống bấm đúp: dòng GIỐNG HỆT (lớp, em, tên, ngày, số tiền) chưa vào phiếu thì bỏ qua, không tạo lần hai.
 * Dùng được cho cả lớp cách cũ: chỉ thêm một dòng phí mà gia sư chủ động thêm, không đổi cách tính nào.
 */
export async function addExtraFee(a: { courseId: string; by: string; label: string; amount: number; dateKey: string; studentIds?: string[] | null }): Promise<ExtraFeeResult> {
  if (moneyPathsBlocked()) return { ok: false, status: 503, error: PREVIEW_BLOCKED_MESSAGE };
  return prisma.$transaction(async tx => {
    // Khoá theo (lớp, tên, ngày): hai lần bấm cùng lúc xếp hàng, lần sau thấy dòng của lần trước và bỏ qua (không tạo trùng).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`extra-fee:${a.courseId}:${a.label}:${a.dateKey}`}))`;
    const course = await tx.course.findUnique({ where: { id: a.courseId }, select: { ownerId: true } });
    if (!course) return { ok: false, status: 404, error: "Không tìm thấy lớp" } as ExtraFeeResult;
    const enrolled = await tx.enrollment.findMany({ where: { courseId: a.courseId, status: "active" }, select: { userId: true } });
    const active = new Set(enrolled.map(e => e.userId));
    let targets = [...active];
    if (a.studentIds) {
      const want = [...new Set(a.studentIds)];
      if (want.length === 0 || want.some(id => !active.has(id))) return { ok: false, status: 400, error: "Có học sinh không học lớp này" } as ExtraFeeResult;
      targets = want;
    }
    if (targets.length === 0) return { ok: false, status: 409, error: "Lớp chưa có học sinh nào" } as ExtraFeeResult;
    if (targets.length > 300) return { ok: false, status: 400, error: "Mỗi lần tối đa 300 học sinh" } as ExtraFeeResult;
    const tutorId = course.ownerId ?? a.by;
    const dup = await tx.feeCharge.findMany({
      where: { courseId: a.courseId, kind: "extra", label: a.label, dateKey: a.dateKey, amount: a.amount, studentId: { in: targets } },
      select: { studentId: true },
    });
    const dupSet = new Set(dup.map(d => d.studentId));
    const fresh = targets.filter(id => !dupSet.has(id));
    for (const studentId of fresh) {
      await tx.feeCharge.create({ data: { tutorId, courseId: a.courseId, studentId, kind: "extra", dateKey: a.dateKey, yearMonth: a.dateKey.slice(0, 7), amount: a.amount, rateSource: "class", mode: "extra", label: a.label } });
    }
    return { ok: true, created: fresh.length, skippedDuplicate: dupSet.size, total: fresh.length * a.amount } as ExtraFeeResult;
  });
}

/** Gỡ một khoản phí khác CHƯA vào phiếu (đã vào phiếu thì đóng băng, không gỡ). */
export async function removeExtraFee(courseId: string, chargeId: string): Promise<boolean> {
  if (moneyPathsBlocked()) return false;
  const r = await prisma.feeCharge.deleteMany({ where: { id: chargeId, courseId, kind: "extra", invoiceId: null } });
  return r.count === 1;
}
