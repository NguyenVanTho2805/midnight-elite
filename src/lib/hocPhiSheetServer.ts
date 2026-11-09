// HP-LOP-TRUONG — phần chạm DB / tệp của "học phí theo bảng tháng". ĐƯỜNG GHI TIỀN MỚI: mỗi (em, kỳ) của lớp monthly_sheet là một CourseFeeSheetRow + (khi Phải đóng > 0)
// một FeeCharge kind "sheet" mang số sang phiếu qua đường SẴN CÓ (issueInvoice không sửa). Tệp này KHÔNG sửa invoiceServer / feeChargeServer / sessionBookServer / tuition.
//   • Xem trước KHÔNG ghi gì (kể cả audit / thông báo). Xác nhận ghi trong MỘT giao dịch + pg_advisory_xact_lock + FOR UPDATE dòng phí.
//   • FeeCharge đã có invoiceId, hoặc em đã có phiếu không phải nháp → KHÓA: không bao giờ ghi đè.
//   • Số tiền luôn tính lại ở máy chủ bằng computeSheetFee (hocPhiSheet.ts); số khách gửi lên bị bỏ qua.
//   • Người ghi khác chủ lớp (quản trị): AuditLog có byRole + override + ownerId và thông báo chủ lớp (loại sẵn có course_fee_override, chống dội).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/auditLog";
import { notify } from "@/lib/notify";
import { requireCourseAccess, type CourseAccess } from "@/lib/courseAccessServer";
import { vnDateKeyOf } from "@/lib/classSessions";
import { FEE_MODE_LEGACY, FEE_MODE_SHEET, normalizeFeeMode } from "@/lib/tuitionFee";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/tuitionInvoice";
import { buildFeeOverrideNotification, feeRuleRole, isFeeOverride } from "@/lib/feeRuleAudit";
import { PREVIEW_BLOCKED_MESSAGE } from "@/lib/feeChargeServer";
import { zipUncompressedTotal, FILE_MAX_BYTES } from "@/lib/studentImportServer";
import { IMPORT_TEXT_MAX } from "@/lib/studentImport";
import {
  SHEET_MAX_COLS, SHEET_MAX_ROWS, chargeLabel, compactSessions, computeSheetFee, currentPeriodId, hashSheet, isYearMonth, matchRoster, parseSheetGrid, periodDateKey,
  periodInWindow, periodRange, readTiers, textToGrid,
  type CountSource, type MatchResult, type RosterEntry, type RowInput, type SheetConfig, type SheetFee,
} from "@/lib/hocPhiSheet";

const NO_STORE = { "Cache-Control": "no-store" };
export const PREVIEW_STATUSES = ["ok", "replace", "unchanged", "warn", "error", "unmatched", "ambiguous", "locked"] as const;
export type PreviewStatus = (typeof PREVIEW_STATUSES)[number];
const WRITABLE: readonly PreviewStatus[] = ["ok", "replace", "warn"];

export function sheetFail(status: number, error: string, code?: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...(code ? { code } : {}), ...(extra ?? {}) }, { status, headers: NO_STORE });
}
export function sheetOk(body: unknown): NextResponse { return NextResponse.json(body, { headers: NO_STORE }); }
export const previewBlocked = (): NextResponse => sheetFail(503, PREVIEW_BLOCKED_MESSAGE, "PREVIEW_BLOCKED");

// ─── Cổng ────────────────────────────────────────────────────────────────────
export type SheetGate = { ok: true; acc: Extract<CourseAccess, { ok: true }>; config: SheetConfig | null; isSheet: boolean } | { ok: false; res: NextResponse };

/** 401 → 403 (khoá / không phải gia sư) → 404 lớp không có → 403 người lạ → 403 ROLE_FORBIDDEN (requireCourseAccess). Rồi đọc bảng bậc của lớp. */
export async function sheetGate(courseId: string, action: "money.view" | "money.edit"): Promise<SheetGate> {
  const acc = await requireCourseAccess(courseId, action);
  if (!acc.ok) return { ok: false, res: acc.res };
  const config = await loadConfig(acc.course.id);
  return { ok: true, acc, config, isSheet: normalizeFeeMode(acc.course.feeMode) === FEE_MODE_SHEET };
}

export async function loadConfig(courseId: string, db: Pick<typeof prisma, "courseFeeTable"> = prisma): Promise<SheetConfig | null> {
  const t = await db.courseFeeTable.findUnique({ where: { courseId } });
  if (!t) return null;
  return { subjects: t.subjects, tiers: readTiers(t.tiers), periodStartDay: t.periodStartDay };
}

/** Lớp chưa phát sinh tiền: không có FeeCharge và không có MonthlyCourseFee. */
export async function moneyHistoryOf(courseId: string, db: Pick<typeof prisma, "feeCharge" | "monthlyCourseFee"> = prisma): Promise<{ feeCharges: number; monthlyFees: number }> {
  const [feeCharges, monthlyFees] = await Promise.all([db.feeCharge.count({ where: { courseId } }), db.monthlyCourseFee.count({ where: { courseId } })]);
  return { feeCharges, monthlyFees };
}

/**
 * Số em ĐANG HỌC lớp này mà cũng đang học một lớp cách tính CŨ khác của cùng chủ lớp. Cùng định nghĩa "lớp cách cũ" với invoiceServer.legacyEnrollments
 * (enrollment active, course.ownerId = chủ lớp, normalizeFeeMode(feeMode) === monthly_sessions). Lớp này không phải cách cũ (hoặc không có chủ) → 0:
 * lớp kiểu mới không nằm trong legacyEnrollments nên bật bảng tháng cho nó không đổi bậc của ai. Chỉ trả SỐ ĐẾM (không tên em).
 */
export async function sharedLegacyStudentCount(course: { id: string; ownerId: string | null; feeMode: unknown }, db: Pick<typeof prisma, "course" | "enrollment"> = prisma): Promise<number> {
  if (!course.ownerId || normalizeFeeMode(course.feeMode) !== FEE_MODE_LEGACY) return 0;
  const others = await db.course.findMany({ where: { ownerId: course.ownerId, id: { not: course.id } }, select: { id: true, feeMode: true } });
  const legacyIds = others.filter(c => normalizeFeeMode(c.feeMode) === FEE_MODE_LEGACY).map(c => c.id);
  if (legacyIds.length === 0) return 0;
  const mine = await db.enrollment.findMany({ where: { courseId: course.id, status: ENROLLMENT_STATUS.ACTIVE }, select: { userId: true } });
  if (mine.length === 0) return 0;
  const shared = await db.enrollment.findMany({
    where: { courseId: { in: legacyIds }, status: ENROLLMENT_STATUS.ACTIVE, userId: { in: mine.map(m => m.userId) } }, select: { userId: true }, distinct: ["userId"],
  });
  return shared.length;
}

export type EnableBlockedReason = "HAS_MONEY_HISTORY" | "SHARES_LEGACY_STUDENTS";
/** Lớp (chưa bật bảng tháng) có bật được không: HAS_MONEY_HISTORY thắng, rồi SHARES_LEGACY_STUDENTS. `reason` null = bật được. */
export async function enableBlockOf(
  course: { id: string; ownerId: string | null; feeMode: unknown }, db: Pick<typeof prisma, "feeCharge" | "monthlyCourseFee" | "course" | "enrollment"> = prisma,
): Promise<{ canEnable: boolean; reason: EnableBlockedReason | null; sharedStudents: number; feeCharges: number; monthlyFees: number }> {
  const h = await moneyHistoryOf(course.id, db);
  const sharedStudents = await sharedLegacyStudentCount(course, db);
  const reason: EnableBlockedReason | null = h.feeCharges > 0 || h.monthlyFees > 0 ? "HAS_MONEY_HISTORY" : sharedStudents > 0 ? "SHARES_LEGACY_STUDENTS" : null;
  return { canEnable: reason === null, reason, sharedStudents, ...h };
}

export const msgSharesLegacy = (n: number) =>
  `Có ${n} em đang học lớp này cùng một lớp cách tính cũ khác của cô; chuyển cách tính sẽ làm đổi bậc đơn giá của các lớp đó. Hãy tạo lớp mới theo bảng học phí tháng.`;

/** Bản sao CourseFeeTable của lớp monthly_sheet GẦN NHẤT (updatedAt) cùng chủ lớp, khác lớp này. Không có thì null — KHÔNG bịa bảng mặc định. */
export async function suggestedConfigFor(ownerId: string | null, courseId: string): Promise<SheetConfig | null> {
  if (!ownerId) return null;
  const t = await prisma.courseFeeTable.findFirst({
    where: { courseId: { not: courseId }, course: { ownerId, feeMode: FEE_MODE_SHEET } }, orderBy: { updatedAt: "desc" },
  });
  if (!t) return null;
  const tiers = readTiers(t.tiers);
  return tiers.length ? { subjects: t.subjects, tiers, periodStartDay: t.periodStartDay } : null;
}

export function periodInfo(ym: string, startDay: number) {
  const r = periodRange(ym, startDay);
  return { yearMonth: ym, startDay, from: r.from, to: r.to, label: r.label };
}
/** `ym` từ query / thân: không có → kỳ hiện tại của lớp; sai định dạng hoặc quá 12 kỳ trước / sau → lỗi. */
export function resolveYm(raw: unknown, startDay: number, now: Date = new Date()): { ok: true; ym: string } | { ok: false; error: string } {
  const cur = currentPeriodId(vnDateKeyOf(now), startDay);
  if (raw === undefined || raw === null || raw === "") return { ok: true, ym: cur };
  if (!isYearMonth(raw)) return { ok: false, error: "Kỳ thu phải có dạng YYYY-MM, ví dụ 2026-11" };
  if (!periodInWindow(raw, cur)) return { ok: false, error: "Chỉ chọn được kỳ trong vòng 12 kỳ trước hoặc sau kỳ hiện tại" };
  return { ok: true, ym: raw };
}

// ─── Audit + thông báo chủ lớp khi quản trị ghi ──────────────────────────────
/** Chỉ gọi khi THẬT SỰ ghi (không phải xem trước / dryRun). Metadata KHÔNG có tên người hay số tiền từng em. */
export async function auditSheetWrite(acc: Extract<CourseAccess, { ok: true }>, action: "fee_sheet.config" | "fee_sheet.import" | "fee_sheet.row", meta: Record<string, string | number | boolean | null>) {
  const ownerId = acc.course.ownerId;
  const override = isFeeOverride(acc.session.userId, ownerId);
  await logAction(acc.session.userId, action, "Course", acc.course.id, { courseId: acc.course.id, ...meta, byRole: feeRuleRole(acc.session.adminRole), override, ownerId, preview: false });
  // Quản trị ghi đè → báo chủ lớp (không tên / tiền / tên lớp). Chống dội: đã có thông báo CHƯA ĐỌC cùng loại + liên kết thì không tạo thêm. Chủ lớp tự ghi → không thông báo.
  if (override && ownerId) {
    const n = buildFeeOverrideNotification(acc.course.id);
    const pending = await prisma.notification.findFirst({ where: { userId: ownerId, type: n.type, link: n.link, isRead: false }, select: { id: true } });
    if (!pending) await notify(ownerId, n);
  }
  return override;
}

// ─── Ngữ cảnh đánh giá ───────────────────────────────────────────────────────
type SheetRowDb = Prisma.CourseFeeSheetRowGetPayload<object>;
export interface ExistingRow { row: SheetRowDb; charge: { id: string; invoiceId: string | null; amount: number } | null }
export interface InvoiceLite { code: string; status: string; amountDue: number; paidAmount: number }
export interface EvalContext {
  courseId: string; ownerId: string | null; config: SheetConfig; ym: string;
  roster: RosterEntry[]; existing: Map<string, ExistingRow>; invoices: Map<string, InvoiceLite>; discounts: Map<string, number>;
}

export async function loadEvalContext(course: { id: string; ownerId: string | null }, config: SheetConfig, ym: string, extraStudentIds: string[] = []): Promise<EvalContext> {
  const [enr, rows] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId: course.id, status: "active" }, select: { userId: true, createdAt: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.courseFeeSheetRow.findMany({ where: { courseId: course.id, yearMonth: ym } }),
  ]);
  const roster: RosterEntry[] = enr.map(e => ({ studentId: e.userId, name: e.user.name ?? "Học sinh", joinedAt: vnDateKeyOf(e.createdAt) }));
  const chargeIds = rows.map(r => r.feeChargeId).filter((x): x is string => !!x);
  const charges = chargeIds.length ? await prisma.feeCharge.findMany({ where: { id: { in: chargeIds } }, select: { id: true, invoiceId: true, amount: true } }) : [];
  const chargeById = new Map(charges.map(c => [c.id, c]));
  const existing = new Map(rows.map(r => [r.studentId, { row: r, charge: r.feeChargeId ? chargeById.get(r.feeChargeId) ?? null : null }]));
  const ids = [...new Set([...roster.map(r => r.studentId), ...rows.map(r => r.studentId), ...extraStudentIds])];
  const [invs, discs] = course.ownerId && ids.length
    ? await Promise.all([
      prisma.tuitionInvoice.findMany({ where: { tutorId: course.ownerId, yearMonth: ym, studentId: { in: ids } }, select: { studentId: true, code: true, status: true, amountDue: true, paidAmount: true } }),
      prisma.studentDiscount.findMany({ where: { tutorId: course.ownerId, studentId: { in: ids } }, select: { studentId: true, percent: true } }),
    ])
    : [[], []];
  return {
    courseId: course.id, ownerId: course.ownerId, config, ym, roster, existing,
    invoices: new Map(invs.map(i => [i.studentId, { code: i.code, status: i.status, amountDue: i.amountDue, paidAmount: i.paidAmount }])),
    discounts: new Map(discs.map(d => [d.studentId, d.percent])),
  };
}

export const MSG_ROW_ON_INVOICE = "Dòng này đã vào phiếu nên KiN không ghi đè. Muốn đổi số, dùng “Sửa số tiền phiếu” trên phiếu.";
export const MSG_INVOICE_FINAL = "Em đã có phiếu đã gửi, đã đóng hoặc đã huỷ cho kỳ này nên KiN không ghi thêm.";

export interface Classified {
  status: Exclude<PreviewStatus, "unmatched" | "ambiguous">;
  fee: SheetFee | null;
  messages: string[];
  hasWarning: boolean;
  before: { net: number; subjectCount: number; billable: number; unitRate: number } | null;
}

const sameInputs = (r: SheetRowDb, i: RowInput, f: SheetFee): boolean =>
  JSON.stringify(compactSessions(r.sessions as Record<string, number>)) === JSON.stringify(compactSessions(i.sessions))
  && r.freeSessions === i.freeSessions && r.rateOverride === i.rateOverride && r.scholarship === i.scholarship && r.discount === i.discount
  && (r.note ?? null) === (i.note ?? null) && r.subjectCount === f.subjectCount && r.subjectCountSource === f.subjectCountSource
  && r.tierRate === f.tierRate && r.unitRate === f.unitRate && r.billable === f.billable && r.gross === f.gross && r.net === f.net;

/** Một em một kỳ: tính, rồi xếp loại (locked > error > unchanged > replace > warn > ok). Không ghi gì. */
export function classifyRow(ctx: EvalContext, studentId: string, input: RowInput, parseErrors: string[] = []): Classified {
  const ex = ctx.existing.get(studentId);
  const inv = ctx.invoices.get(studentId);
  const before = ex ? { net: ex.row.net, subjectCount: ex.row.subjectCount, billable: ex.row.billable, unitRate: ex.row.unitRate } : null;
  if (ex?.charge?.invoiceId) return { status: "locked", fee: null, messages: [MSG_ROW_ON_INVOICE], hasWarning: false, before };
  if (inv && inv.status !== "draft") return { status: "locked", fee: null, messages: [MSG_INVOICE_FINAL], hasWarning: false, before };
  if (parseErrors.length) return { status: "error", fee: null, messages: parseErrors, hasWarning: false, before };
  const c = computeSheetFee(ctx.config.tiers, input);
  if (!c.ok) return { status: "error", fee: null, messages: [c.error], hasWarning: false, before };
  const fee = c.value;
  const messages = fee.warnings.map(w => w.message);
  const pct = ctx.discounts.get(studentId);
  if (pct && pct > 0) messages.push(`Em này đang được giảm ${pct}% ở mục Học phí: khi lập phiếu sẽ giảm thêm lần nữa trên số đã trừ học bổng / giảm trừ trong bảng (giảm hai lần).`);
  if (inv && inv.status === "draft") messages.push("Em đã có phiếu nháp kỳ này: dòng mới sẽ là khoản rời, dùng “Gộp khoản rời” để đưa vào phiếu nháp.");
  const hasWarning = messages.length > 0;
  if (ex && sameInputs(ex.row, input, fee) && (fee.net > 0 ? ex.charge?.amount === fee.net : !ex.charge)) return { status: "unchanged", fee, messages: [], hasWarning: false, before };
  return { status: ex ? "replace" : hasWarning ? "warn" : "ok", fee, messages, hasWarning, before };
}

// ─── Xem trước / xác nhận ────────────────────────────────────────────────────
export interface PreviewRow {
  line: number; status: PreviewStatus; matchedBy: "code" | "name" | null; studentId: string | null; name: string;
  subjectCount: number | null; subjectCountSource: CountSource | null; sessions: Record<string, number>; freeSessions: number | null; rateOverride: number | null;
  scholarship: number | null; discount: number | null; note: string | null;
  tierRate: number | null; unitRate: number | null; billable: number | null; gross: number | null; net: number | null;
  before: Classified["before"]; messages: string[]; hasWarning: boolean;
  candidates: { studentId: string; name: string; joinedAt: string | null; tail: string }[];
}
export interface SheetPreview {
  yearMonth: string; fileHash: string; fatal: string | null;
  columns: { matched: string[]; ignored: string[]; blocking: string[]; missingSubjects: string[] };
  exampleLines: number[];
  counts: Record<PreviewStatus, number>;
  writable: number; totalNet: number;
  rows: PreviewRow[];
  rosterNotInFile: { studentId: string; name: string }[];
}
export type PickError = { error: string };
export interface BuiltPreview { preview: SheetPreview; writes: { studentId: string; line: number; input: RowInput; fee: SheetFee }[] }

const zeroCounts = (): Record<PreviewStatus, number> => Object.fromEntries(PREVIEW_STATUSES.map(s => [s, 0])) as Record<PreviewStatus, number>;

/** `pick`: { "<dòng>": studentId } cho dòng unmatched / ambiguous. Trả PickError nếu pick sai (em không active của lớp, dòng không cần chọn, em đã được dòng khác dùng). */
export async function buildPreview(
  course: { id: string; ownerId: string | null }, config: SheetConfig, ym: string, grid: string[][], pick: Record<string, string> = {},
): Promise<BuiltPreview | PickError> {
  const hash = hashSheet({ ym, subjects: config.subjects, tiers: config.tiers, periodStartDay: config.periodStartDay, grid: grid.map(r => r.map(c => String(c ?? "").trim())) });
  const parsed = parseSheetGrid(grid, config.subjects);
  const counts = zeroCounts();
  const base = { yearMonth: ym, fileHash: hash, columns: parsed.columns, exampleLines: parsed.exampleLines, counts, writable: 0, totalNet: 0, rosterNotInFile: [] as SheetPreview["rosterNotInFile"] };
  if (parsed.fatal) return { preview: { ...base, fatal: parsed.fatal, rows: [] }, writes: [] };

  const ctx = await loadEvalContext(course, config, ym);
  const rosterIds = new Set(ctx.roster.map(r => r.studentId));
  const nameOf = new Map(ctx.roster.map(r => [r.studentId, r.name]));

  // 1) khớp học sinh (+ pick)
  const matches = new Map<number, MatchResult>();
  for (const r of parsed.rows) matches.set(r.line, matchRoster({ code: r.code, name: r.name }, ctx.roster));
  const usedByPick = new Set<string>();
  for (const [lineKey, sid] of Object.entries(pick)) {
    const line = Number(lineKey);
    const m = matches.get(line);
    if (!Number.isInteger(line) || !m) return { error: `Dòng ${lineKey} không có trong tệp` };
    if (m.status === "matched") return { error: `Dòng ${line} đã khớp học sinh, không cần chọn` };
    if (typeof sid !== "string" || !rosterIds.has(sid)) return { error: `Dòng ${line}: học sinh được chọn không học lớp này` };
    if (usedByPick.has(sid)) return { error: `Học sinh được chọn cho hai dòng khác nhau` };
    usedByPick.add(sid);
    matches.set(line, { status: "matched", studentId: sid, matchedBy: "name" });
  }
  // 2) em xuất hiện hai lần (kể cả sau pick) → cả hai dòng lỗi
  const occurrences = new Map<string, number>();
  for (const m of matches.values()) if (m.status === "matched") occurrences.set(m.studentId, (occurrences.get(m.studentId) ?? 0) + 1);

  const rows: PreviewRow[] = [];
  const writes: BuiltPreview["writes"] = [];
  const seenIds = new Set<string>();
  for (const r of parsed.rows) {
    const m = matches.get(r.line)!;
    const blank: PreviewRow = {
      line: r.line, status: "error", matchedBy: null, studentId: null, name: r.name, subjectCount: null, subjectCountSource: null, sessions: r.sessions, freeSessions: r.freeSessions,
      rateOverride: r.rateOverride, scholarship: r.scholarship, discount: r.discount, note: r.note, tierRate: null, unitRate: null, billable: null, gross: null, net: null,
      before: null, messages: [], hasWarning: false, candidates: [],
    };
    if (m.status === "unmatched") {
      rows.push({ ...blank, status: "unmatched", messages: [r.code ? "Mã em không thuộc em nào đang học lớp này." : "Không có em đang học lớp này tên như vậy. Chọn em trong ô chọn hoặc bỏ dòng này."] });
    } else if (m.status === "ambiguous") {
      rows.push({ ...blank, status: "ambiguous", candidates: m.candidates, messages: ["Có từ hai em cùng tên trong lớp. Chọn đúng em (hoặc dùng cột Mã em trong bảng mẫu)."] });
    } else {
      seenIds.add(m.studentId);
      const input: RowInput = { sessions: r.sessions, subjectCount: r.subjectCount, freeSessions: r.freeSessions, rateOverride: r.rateOverride, scholarship: r.scholarship, discount: r.discount, note: r.note };
      const dup = (occurrences.get(m.studentId) ?? 0) > 1;
      // Em hai lần trong tệp: thêm lỗi dòng → classifyRow trả "error" (trừ khi đã khoá vì phiếu, khi đó vẫn "locked").
      const cl = classifyRow(ctx, m.studentId, input, dup ? [...r.errors, `Dòng ${r.line}: em này xuất hiện hai lần trong tệp`] : r.errors);
      const status = cl.status;
      const f = cl.fee;
      rows.push({
        ...blank, status, matchedBy: m.matchedBy, studentId: m.studentId, name: nameOf.get(m.studentId) ?? r.name,
        subjectCount: f?.subjectCount ?? null, subjectCountSource: f?.subjectCountSource ?? null, tierRate: f?.tierRate ?? null, unitRate: f?.unitRate ?? null,
        billable: f?.billable ?? null, gross: f?.gross ?? null, net: f?.net ?? null, before: cl.before, messages: cl.messages, hasWarning: cl.hasWarning,
      });
      if (WRITABLE.includes(status) && f) writes.push({ studentId: m.studentId, line: r.line, input, fee: f });
    }
  }
  for (const row of rows) counts[row.status]++;
  const rosterNotInFile = ctx.roster.filter(x => !seenIds.has(x.studentId)).map(x => ({ studentId: x.studentId, name: x.name }));
  return {
    preview: { ...base, counts, fatal: null, rows, writable: writes.length, totalNet: writes.reduce((s, w) => s + w.fee.net, 0), rosterNotInFile },
    writes,
  };
}

// ─── Ghi ─────────────────────────────────────────────────────────────────────
export interface WriteStats { written: number; replaced: number; chargesCreated: number; chargesUpdated: number; chargesRemoved: number; totalNet: number }
export type WriteResult = { ok: true; stats: WriteStats } | { ok: false; status: number; code: string; error: string; extra?: Record<string, unknown> };

class SheetConflict extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) { super(message); }
}

type WriteRowIn = { studentId: string; input: RowInput; fee: SheetFee };

/** Ghi tất cả hoặc không gì. Gặp dòng phí vừa vào phiếu (hoặc em vừa có phiếu không phải nháp) → rollback, 409 ROW_LOCKED kèm số dòng (không tên). */
export async function writeSheetRows(p: { courseId: string; ownerId: string | null; config: SheetConfig; ym: string; actorId: string; source: "xlsx" | "paste" | "manual"; rows: WriteRowIn[] }): Promise<WriteResult> {
  if (!p.ownerId) return { ok: false, status: 409, code: "NO_OWNER", error: "Lớp chưa có gia sư phụ trách nên chưa ghi được học phí." };
  const ownerId = p.ownerId;
  const dateKey = periodDateKey(p.ym, p.config.periodStartDay);
  try {
    const stats = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course-fee-sheet:${p.courseId}:${p.ym}`}))`;
      const ids = p.rows.map(r => r.studentId);
      const existing = await tx.courseFeeSheetRow.findMany({ where: { courseId: p.courseId, yearMonth: p.ym, studentId: { in: ids } } });
      const exBy = new Map(existing.map(e => [e.studentId, e]));
      const chargeIds = existing.map(e => e.feeChargeId).filter((x): x is string => !!x);
      const charges = chargeIds.length
        ? await tx.$queryRaw<{ id: string; invoiceId: string | null }[]>`SELECT id, "invoiceId" FROM fee_charges WHERE id IN (${Prisma.join(chargeIds)}) FOR UPDATE`
        : [];
      const chargeBy = new Map(charges.map(c => [c.id, c]));
      let locked = charges.filter(c => c.invoiceId).length;
      if (!locked && ids.length) {
        locked = await tx.tuitionInvoice.count({ where: { tutorId: ownerId, yearMonth: p.ym, studentId: { in: ids }, status: { not: "draft" } } });
      }
      if (locked) throw new SheetConflict(409, "ROW_LOCKED", `${locked} dòng vừa được đưa vào phiếu nên KiN không ghi đè. Xem trước lại.`, { locked });

      const st: WriteStats = { written: 0, replaced: 0, chargesCreated: 0, chargesUpdated: 0, chargesRemoved: 0, totalNet: 0 };
      for (const w of p.rows) {
        const ex = exBy.get(w.studentId);
        const ch = ex?.feeChargeId ? chargeBy.get(ex.feeChargeId) : undefined;
        let feeChargeId: string | null = null;
        if (w.fee.net > 0) {
          const data = {
            kind: "sheet", mode: FEE_MODE_SHEET, amount: w.fee.net, rate: w.fee.unitRate, units: null, rateSource: w.fee.rateSource, dateKey, yearMonth: p.ym,
            label: chargeLabel(p.ym, p.config.periodStartDay, w.fee.subjectCount, w.fee.billable, w.fee.deduction > 0),
          };
          if (ch) { await tx.feeCharge.update({ where: { id: ch.id }, data }); feeChargeId = ch.id; st.chargesUpdated++; }
          else { feeChargeId = (await tx.feeCharge.create({ data: { tutorId: ownerId, courseId: p.courseId, studentId: w.studentId, ...data }, select: { id: true } })).id; st.chargesCreated++; }
        } else if (ch) { await tx.feeCharge.delete({ where: { id: ch.id } }); st.chargesRemoved++; }
        const data = {
          subjectCount: w.fee.subjectCount, subjectCountSource: w.fee.subjectCountSource, sessions: compactSessions(w.input.sessions) as Prisma.InputJsonValue,
          freeSessions: w.input.freeSessions, rateOverride: w.input.rateOverride, scholarship: w.input.scholarship, discount: w.input.discount,
          tierRate: w.fee.tierRate, unitRate: w.fee.unitRate, billable: w.fee.billable, gross: w.fee.gross, net: w.fee.net, note: w.input.note, source: p.source, feeChargeId, updatedBy: p.actorId,
        };
        await tx.courseFeeSheetRow.upsert({
          where: { courseId_studentId_yearMonth: { courseId: p.courseId, studentId: w.studentId, yearMonth: p.ym } },
          create: { courseId: p.courseId, studentId: w.studentId, yearMonth: p.ym, ...data }, update: data,
        });
        st.written++; if (ex) st.replaced++; st.totalNet += w.fee.net;
      }
      return st;
    }, { timeout: 30_000, maxWait: 10_000 });
    return { ok: true, stats };
  } catch (e) {
    if (e instanceof SheetConflict) return { ok: false, status: e.status, code: e.code, error: e.message, extra: e.extra };
    throw e;
  }
}

export type DeleteResult = { ok: true; chargeRemoved: boolean } | { ok: false; status: number; code: string; error: string };
/** Xoá dòng + gỡ FeeCharge chưa vào phiếu. Đã vào phiếu → ROW_LOCKED. Không có dòng → 404. */
export async function deleteSheetRow(p: { courseId: string; ownerId: string | null; ym: string; studentId: string }): Promise<DeleteResult> {
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`course-fee-sheet:${p.courseId}:${p.ym}`}))`;
      const row = await tx.courseFeeSheetRow.findUnique({ where: { courseId_studentId_yearMonth: { courseId: p.courseId, studentId: p.studentId, yearMonth: p.ym } } });
      if (!row) return { ok: false as const, status: 404, code: "ROW_NOT_FOUND", error: "Không có dòng học phí này" };
      let chargeRemoved = false;
      if (row.feeChargeId) {
        const ch = await tx.$queryRaw<{ id: string; invoiceId: string | null }[]>`SELECT id, "invoiceId" FROM fee_charges WHERE id = ${row.feeChargeId} FOR UPDATE`;
        if (ch[0]?.invoiceId) throw new SheetConflict(409, "ROW_LOCKED", MSG_ROW_ON_INVOICE);
        if (ch[0]) { await tx.feeCharge.delete({ where: { id: ch[0].id } }); chargeRemoved = true; }
      }
      if (p.ownerId) {
        const final = await tx.tuitionInvoice.count({ where: { tutorId: p.ownerId, yearMonth: p.ym, studentId: p.studentId, status: { not: "draft" } } });
        if (final) throw new SheetConflict(409, "ROW_LOCKED", MSG_INVOICE_FINAL);
      }
      await tx.courseFeeSheetRow.delete({ where: { id: row.id } });
      return { ok: true as const, chargeRemoved };
    }, { timeout: 15_000, maxWait: 10_000 });
  } catch (e) {
    if (e instanceof SheetConflict) return { ok: false, status: e.status, code: e.code, error: e.message };
    throw e;
  }
}

// ─── GET bảng tháng ──────────────────────────────────────────────────────────
export async function loadSheetView(course: { id: string; ownerId: string | null }, config: SheetConfig, ym: string) {
  const ctx = await loadEvalContext(course, config, ym);
  const activeIds = new Set(ctx.roster.map(r => r.studentId));
  const leftIds = [...ctx.existing.keys()].filter(id => !activeIds.has(id));
  const leftUsers = leftIds.length ? await prisma.user.findMany({ where: { id: { in: leftIds } }, select: { id: true, name: true } }) : [];
  const leftName = new Map(leftUsers.map(u => [u.id, u.name ?? "Học sinh"]));
  const people = [
    ...ctx.roster.map(r => ({ studentId: r.studentId, name: r.name, left: false })),
    ...leftIds.map(id => ({ studentId: id, name: leftName.get(id) ?? "Học sinh", left: true })),
  ];
  // Em đã rời lớp nhưng có phiếu: ctx.invoices chỉ nạp em trong roster + dòng đã có (loadEvalContext gộp cả hai), nên đủ.
  const rows = people.map(p => {
    const ex = ctx.existing.get(p.studentId);
    const inv = ctx.invoices.get(p.studentId) ?? null;
    const locked = !!ex?.charge?.invoiceId;
    const invoice = inv ? {
      code: inv.code, status: inv.status, statusLabel: INVOICE_STATUS_LABEL[inv.status as InvoiceStatus] ?? inv.status,
      amountDue: inv.amountDue, paidAmount: inv.paidAmount, remaining: Math.max(0, inv.amountDue - inv.paidAmount),
    } : null;
    if (!ex) {
      return { studentId: p.studentId, name: p.name, ...(p.left ? { left: true } : {}), filled: false, subjectCount: null, subjectCountSource: null, sessions: {}, freeSessions: null, rateOverride: null,
        scholarship: null, discount: null, tierRate: null, unitRate: null, billable: null, gross: null, net: null, note: null, source: null, locked: false, invoice };
    }
    const r = ex.row;
    return {
      studentId: p.studentId, name: p.name, ...(p.left ? { left: true } : {}), filled: true, subjectCount: r.subjectCount, subjectCountSource: r.subjectCountSource as CountSource,
      sessions: r.sessions as Record<string, number>, freeSessions: r.freeSessions, rateOverride: r.rateOverride, scholarship: r.scholarship, discount: r.discount,
      tierRate: r.tierRate, unitRate: r.unitRate, billable: r.billable, gross: r.gross, net: r.net, note: r.note, source: r.source, locked, invoice,
    };
  });
  const filled = rows.filter(r => r.filled);
  return { rows, totals: { filled: filled.length, unfilled: rows.length - filled.length, net: filled.reduce((s, r) => s + (r.net ?? 0), 0) } };
}

// ─── Đọc yêu cầu nhập ────────────────────────────────────────────────────────
export interface SheetRequest { ymRaw: unknown; grid: string[][]; source: "xlsx" | "paste"; pick: Record<string, string>; skipLines: number[]; skipErrors: boolean; fileHash: string | null }
export type SheetRequestError = { error: string; status: number; code?: string };

const XLSX_UNCOMPRESSED_MAX = 20_000_000;
const XLSX_ENTRIES_MAX = 300;
const GRID_NONBLANK_ROWS_MAX = SHEET_MAX_ROWS + 20;

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellText(o.result); // công thức: chỉ lấy KẾT QUẢ, không bao giờ chạy lại
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text?: string }[]).map(r => r.text ?? "").join("");
    if ("text" in o) return cellText(o.text);
    return "";
  }
  return String(v);
};

/** .xlsx → lưới chữ, trang tính đầu tiên, GIỮ ĐÚNG số dòng thật (dòng trống thành dòng rỗng) để báo lỗi đúng dòng. Ném Error tiếng Việt khi không dùng được. */
export async function xlsxToGrid(buf: Uint8Array): Promise<string[][]> {
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("Tệp Excel không đọc được hoặc có mật khẩu. Hãy lưu lại thành .xlsx không mật khẩu hoặc CSV rồi chọn lại.");
  const z = zipUncompressedTotal(buf);
  if (!z || z.total > XLSX_UNCOMPRESSED_MAX || z.entries > XLSX_ENTRIES_MAX) throw new Error("Tệp Excel không đọc được hoặc quá lớn. Hãy lưu lại thành CSV rồi chọn lại.");
  const mod = await import("exceljs");
  const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { throw new Error("Tệp Excel không đọc được. Hãy lưu lại thành CSV rồi chọn lại."); }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Tệp Excel không có trang tính nào.");
  const grid: string[][] = [];
  let nonBlank = 0, tooMany = false;
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (tooMany) return;
    const cells: string[] = [];
    const lim = Math.min(row.cellCount, SHEET_MAX_COLS + 1); // +1: để parseSheetGrid thấy ô thừa ở cột 41 và từ chối cả tệp
    for (let c = 1; c <= lim; c++) cells.push(cellText(row.getCell(c).value));
    if (!cells.some(c => c.trim())) return;
    if (++nonBlank > GRID_NONBLANK_ROWS_MAX || rn > 100_000) { tooMany = true; return; }
    while (grid.length < rn - 1) grid.push([]);
    grid[rn - 1] = cells;
  });
  if (tooMany) throw new Error(`Tệp có quá nhiều dòng (tối đa ${SHEET_MAX_ROWS} dòng học sinh mỗi lần nhập). Chia thành nhiều lần.`);
  return grid;
}

function asPick(v: unknown): Record<string, string> | null {
  if (v === undefined || v === null || v === "") return {};
  if (typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) { if (typeof x !== "string") return null; out[k] = x; }
  return out;
}
function asLines(v: unknown): number[] | null {
  if (v === undefined || v === null || v === "") return [];
  return Array.isArray(v) && v.length <= 1000 && v.every(x => Number.isInteger(x)) ? v as number[] : null;
}
const parseJsonField = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return undefined; } };

/** Thân JSON { ym, text, ... } hoặc multipart (file .xlsx .csv .tsv .txt ≤ 1 MB). Mọi sai kiểu → 400 (không bao giờ 500). */
export async function readSheetRequest(req: Request): Promise<SheetRequest | SheetRequestError> {
  const ct = req.headers.get("content-type") ?? "";
  let b: Record<string, unknown> = {};
  let grid: string[][] | null = null;
  let source: "xlsx" | "paste" = "paste";
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return { error: "Không đọc được tệp gửi lên", status: 400 };
    for (const [k, v] of fd.entries()) if (typeof v === "string") b[k] = v;
    const f = fd.get("file");
    if (f && typeof f !== "string") {
      if (f.size > FILE_MAX_BYTES) return { error: "Tệp quá lớn (tối đa 1 MB).", status: 413 };
      const name = (f.name ?? "").toLowerCase();
      const buf = new Uint8Array(await f.arrayBuffer());
      if (name.endsWith(".xlsx")) {
        try { grid = await xlsxToGrid(buf); source = "xlsx"; } catch (e) { return { error: (e as Error).message, status: 400 }; }
      } else if (name.endsWith(".xls") || name.endsWith(".xlsm")) return { error: "Tệp .xls / .xlsm chưa đọc được. Hãy lưu thành .xlsx hoặc CSV.", status: 400 };
      else if (/\.(csv|tsv|txt)$/.test(name)) {
        const text = new TextDecoder("utf-8").decode(buf);
        if (text.length > IMPORT_TEXT_MAX) return { error: "Danh sách quá dài.", status: 413 };
        grid = textToGrid(text);
      } else return { error: "Chỉ nhận tệp .xlsx, .csv, .tsv hoặc .txt.", status: 400 };
    }
  } else {
    const j = await req.json().catch(() => null);
    if (!j || typeof j !== "object" || Array.isArray(j)) return { error: "Thân yêu cầu phải là JSON { ym, text }", status: 400 };
    b = j as Record<string, unknown>;
  }
  if (!grid) {
    if (typeof b.text !== "string") return { error: "Thiếu nội dung: gửi tệp (file) hoặc chữ dán từ Google Sheet (text).", status: 400 };
    if (b.text.length > IMPORT_TEXT_MAX) return { error: "Danh sách quá dài.", status: 413 };
    grid = textToGrid(b.text);
  }
  const pick = asPick(parseJsonField(b.pick));
  if (!pick) return { error: "pick phải là { \"<dòng>\": \"<mã em>\" }", status: 400 };
  const skipLines = asLines(parseJsonField(b.skipLines));
  if (!skipLines) return { error: "skipLines phải là danh sách số dòng", status: 400 };
  if (b.fileHash !== undefined && b.fileHash !== null && typeof b.fileHash !== "string") return { error: "fileHash không hợp lệ", status: 400 };
  return { ymRaw: b.ym, grid, source, pick, skipLines, skipErrors: b.skipErrors === true || b.skipErrors === "true", fileHash: (b.fileHash as string | undefined) ?? null };
}

