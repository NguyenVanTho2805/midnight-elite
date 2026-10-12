// NV-185/186/189 — báo cáo tháng gửi phụ huynh: Nỗ lực và Năng lực TÁCH RIÊNG, và mục cố định
// "Điều chưa đạt tháng này". THUẦN (không Prisma, không đọc đồng hồ) để test được từng ca biên.
// Đặc tả: docs/kin/nghiep-vu/hoc-tu-khan.md (NV-185, NV-186, NV-189). Số nào ghi "đề xuất" ở đó là số tạm — để hằng số.
//
// Nguyên tắc: không cộng Nỗ lực với Năng lực thành một con số, không xếp hạng trên phiếu phụ huynh,
// không dùng màu đỏ cho năng lực của học sinh (đỏ để dành cho lỗi hệ thống và tiền).
import { computeMastery, type TestScore } from "@/lib/mastery";

export const MASTERY_THRESHOLD = 8.0;       // NGƯỠNG_ĐẠT — đề xuất
export const HOMEWORK_UNMET_BELOW = 0.7;    // NGƯỠNG_BTVN_CHƯA_ĐẠT — đề xuất
export const EFFORT_HIGH = 8;               // "Nỗ lực từ 8 trở lên" (dòng gợi ý số 3)
export const MAX_UNMET_ITEMS = 12;
export const UNMET_TEXT_MAX = 300;
export const EMPTY_UNMET_TEXT = "Tháng này không có mục nào chưa đạt.";

/** 8.5 → "8,5" (dấu phẩy như phiếu tiếng Việt). */
export const fmtScore = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const pct = (r: number) => `${Math.round(r * 100)}%`;
const monthNo = (ym: string) => String(Number(ym.slice(5, 7)));

export function prevYearMonth(ym: string): string {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// ── Năng lực (NV-185) ───────────────────────────────────────────────────────────

export type MasteryCode = "dat" | "tut" | "chua-dat" | "chua-du";
export interface MasteryView {
  code: MasteryCode;
  text: string;
  /** Màu trạng thái cố định (không theo chủ đề). KHÔNG có "loi": năng lực không bao giờ đỏ. */
  tone: "xong" | "cho" | "trung-tinh";
  value: number | null;      // trung bình 3 bài gần nhất; null nếu chưa có bài nào
  n: number;                 // số bài tham gia
  /** Điểm các bài tham gia, từ CŨ đến MỚI — phiếu luôn in đủ để thấy xu hướng. */
  scores: number[];
}

/** 3 bài gần nhất theo ngày làm, tính tới `asOf` (không loại bài tháng trước). */
function lastThree(scores: TestScore[], asOf: Date): TestScore[] {
  return scores
    .filter(s => s.takenAt.getTime() < asOf.getTime())
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())
    .slice(0, 3);
}

/**
 * Nhãn năng lực của một môn trong tháng:
 *   chưa đủ 3 bài          → "Chưa đủ 3 bài" (trung tính, không kết luận)
 *   TB 3 bài ≥ ngưỡng      → "Đạt ngưỡng 8,0"
 *   dưới ngưỡng, tháng trước đã đạt → "Đang tụt · tháng M đã đạt"
 *   dưới ngưỡng, chưa từng đạt      → "Chưa đạt ngưỡng"
 * `monthStart`/`monthEnd`: giới hạn tháng (monthEnd = đầu tháng sau, không gồm).
 */
export function masteryForMonth(scores: TestScore[], monthStart: Date, monthEnd: Date, prevMonthLabel: string): MasteryView {
  const now3 = lastThree(scores, monthEnd);
  const values = now3.map(s => s.score).reverse(); // cũ → mới
  if (now3.length < 3) {
    return { code: "chua-du", text: "Chưa đủ 3 bài", tone: "trung-tinh", value: now3.length ? computeMastery(now3).value : null, n: now3.length, scores: values };
  }
  const value = computeMastery(now3).value!;
  if (value >= MASTERY_THRESHOLD) {
    return { code: "dat", text: `Đạt ngưỡng ${fmtScore(MASTERY_THRESHOLD)}`, tone: "xong", value, n: 3, scores: values };
  }
  const before = lastThree(scores, monthStart);
  const hadReached = before.length >= 3 && computeMastery(before).value! >= MASTERY_THRESHOLD;
  return hadReached
    ? { code: "tut", text: `Đang tụt · tháng ${prevMonthLabel} đã đạt`, tone: "cho", value, n: 3, scores: values }
    : { code: "chua-dat", text: "Chưa đạt ngưỡng", tone: "cho", value, n: 3, scores: values };
}

// ── Nỗ lực (NV-186) ─────────────────────────────────────────────────────────────

/**
 * Nỗ lực = 10 × (0,5 × Chuyên cần + 0,5 × Bài về nhà), làm tròn đến số nguyên.
 * Tháng không giao bài về nhà → 10 × Chuyên cần. Chưa có buổi nào được điểm danh → null (không đo được, không ghi 0).
 */
export function monthlyEffort(attendanceRatio: number | null, homework: { assigned: number; onTime: number }): number | null {
  if (attendanceRatio === null) return null;
  const a = Math.max(0, Math.min(1, attendanceRatio));
  if (homework.assigned <= 0) return Math.round(10 * a);
  const h = Math.max(0, Math.min(1, homework.onTime / homework.assigned));
  return Math.round(10 * (0.5 * a + 0.5 * h));
}

// ── Một môn trong tháng ─────────────────────────────────────────────────────────

export interface SubjectMonthInput {
  courseId: string;
  courseName: string;
  /** Kết quả computeAttendanceStats của các buổi điểm danh trong tháng. */
  attendance: { attended: number; total: number; ratio: number | null };
  homework: { assigned: number; onTime: number };
  /** TẤT CẢ bài kiểm tra của môn (mọi thời điểm), điểm thang 10. */
  scores: TestScore[];
}
export interface SubjectMonthMetrics {
  courseId: string;
  courseName: string;
  attendance: { sessions: number; ratio: number | null };
  homework: { assigned: number; onTime: number; ratio: number | null };
  effort: number | null;
  mastery: MasteryView;
}

export function buildSubjectMetrics(i: SubjectMonthInput, yearMonth: string, monthStart: Date, monthEnd: Date): SubjectMonthMetrics {
  const hwRatio = i.homework.assigned > 0 ? i.homework.onTime / i.homework.assigned : null;
  return {
    courseId: i.courseId, courseName: i.courseName,
    attendance: { sessions: i.attendance.total, ratio: i.attendance.ratio },
    homework: { assigned: i.homework.assigned, onTime: i.homework.onTime, ratio: hwRatio },
    effort: monthlyEffort(i.attendance.ratio, i.homework),
    mastery: masteryForMonth(i.scores, monthStart, monthEnd, monthNo(prevYearMonth(yearMonth))),
  };
}

// ── "Điều chưa đạt tháng này" (NV-189) ──────────────────────────────────────────

export type UnmetKind = "tut" | "btvn" | "cach-day" | "doi-buoi" | "tu-viet";
export interface UnmetItem { text: string; kind: UnmetKind }
export interface TutorChangedSession { dateKey: string; courseName: string; action: "doi" | "huy" }

/**
 * Hệ thống GỢI Ý sẵn các dòng; gia sư đọc, sửa, xoá hoặc thêm trước khi gửi. Bốn loại:
 *  1. Môn đang tụt — kèm điểm đầu và cuối trong 3 bài gần nhất.
 *  2. Bài về nhà nộp đúng hạn dưới 70% trong tháng.
 *  3. Môn chưa đạt ngưỡng dù Nỗ lực ≥ 8 — nói về CÁCH DẠY, không nói về học sinh.
 *  4. Buổi gia sư dời/huỷ trong tháng — ghi rõ là lỗi sắp xếp của gia sư.
 */
export function suggestUnmetItems(subjects: SubjectMonthMetrics[], yearMonth: string, changed: TutorChangedSession[] = []): UnmetItem[] {
  const out: UnmetItem[] = [];
  const prev = monthNo(prevYearMonth(yearMonth));
  for (const s of subjects) {
    const m = s.mastery;
    if (m.code === "tut" && m.scores.length >= 2) {
      out.push({ kind: "tut", text: `${s.courseName}: năng lực đang tụt — 3 bài kiểm tra gần nhất từ ${fmtScore(m.scores[0])} xuống ${fmtScore(m.scores[m.scores.length - 1])} (trung bình ${fmtScore(m.value!)}, tháng ${prev} đã đạt ngưỡng ${fmtScore(MASTERY_THRESHOLD)}).` });
    }
    if (s.homework.assigned > 0 && s.homework.ratio !== null && s.homework.ratio < HOMEWORK_UNMET_BELOW) {
      out.push({ kind: "btvn", text: `${s.courseName}: nộp bài về nhà đúng hạn ${s.homework.onTime}/${s.homework.assigned} bài (${pct(s.homework.ratio)}), dưới mức ${pct(HOMEWORK_UNMET_BELOW)}.` });
    }
    if ((m.code === "tut" || m.code === "chua-dat") && s.effort !== null && s.effort >= EFFORT_HIGH) {
      out.push({ kind: "cach-day", text: `${s.courseName}: em học chăm (Nỗ lực ${s.effort}/10) nhưng kết quả chưa đạt ngưỡng ${fmtScore(MASTERY_THRESHOLD)} — gia sư sẽ xem lại cách dạy phần này.` });
    }
  }
  for (const c of changed) {
    out.push({ kind: "doi-buoi", text: `${c.courseName}: buổi ngày ${c.dateKey.slice(8, 10)}/${c.dateKey.slice(5, 7)} gia sư ${c.action === "huy" ? "huỷ" : "dời"} — đây là lỗi sắp xếp của gia sư, không phải của em.` });
  }
  return out;
}

/** Làm sạch danh sách do gia sư gửi lên: bỏ dòng trống, cắt khoảng trắng, giới hạn số dòng/độ dài. */
export function sanitizeUnmetItems(raw: unknown): { ok: true; items: UnmetItem[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "items phải là danh sách" };
  if (raw.length > 50) return { ok: false, error: "Quá nhiều dòng" };
  const kinds: UnmetKind[] = ["tut", "btvn", "cach-day", "doi-buoi", "tu-viet"];
  const items: UnmetItem[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) return { ok: false, error: "Dòng không hợp lệ" };
    const text = (r as { text?: unknown }).text;
    const kind = (r as { kind?: unknown }).kind;
    if (typeof text !== "string") return { ok: false, error: "Mỗi dòng cần có chữ" };
    const t = text.trim().replace(/\s+/g, " ");
    if (!t) continue;
    if (t.length > UNMET_TEXT_MAX) return { ok: false, error: `Mỗi dòng tối đa ${UNMET_TEXT_MAX} ký tự` };
    items.push({ text: t, kind: kinds.includes(kind as UnmetKind) ? (kind as UnmetKind) : "tu-viet" });
  }
  if (items.length > MAX_UNMET_ITEMS) return { ok: false, error: `Tối đa ${MAX_UNMET_ITEMS} dòng` };
  return { ok: true, items };
}

// ── Văn bản gửi phụ huynh ───────────────────────────────────────────────────────

export interface ReportTextInput {
  studentName: string;
  parentName?: string | null;
  yearMonth: string;
  subjects: SubjectMonthMetrics[];
  unmet: UnmetItem[];
  tutorName?: string | null;
}

export function renderReportText(i: ReportTextInput): string {
  const head = i.parentName?.trim() ? `Kính gửi anh/chị ${i.parentName.trim()},` : "Kính gửi anh/chị,";
  const lines: string[] = [head, `Báo cáo tháng ${monthNo(i.yearMonth)}/${i.yearMonth.slice(0, 4)} của em ${i.studentName}:`];
  for (const s of i.subjects) {
    lines.push("", `${s.courseName}`);
    lines.push(`- Chuyên cần: ${s.attendance.ratio === null ? "chưa có buổi điểm danh" : `${pct(s.attendance.ratio)} (${s.attendance.sessions} buổi)`}`);
    lines.push(`- Nỗ lực: ${s.effort === null ? "chưa đo được" : `${s.effort}/10`}`);
    const m = s.mastery;
    const scores = m.scores.length ? ` (${m.scores.map(fmtScore).join(" · ")})` : "";
    lines.push(`- Năng lực: ${m.value === null ? "chưa có bài kiểm tra" : `${fmtScore(m.value)}/10${scores}`} — ${m.text}`);
  }
  lines.push("", "Điều chưa đạt tháng này:");
  if (i.unmet.length === 0) lines.push(EMPTY_UNMET_TEXT);
  else for (const u of i.unmet) lines.push(`- ${u.text}`);
  if (i.tutorName?.trim()) lines.push("", i.tutorName.trim());
  return lines.join("\n");
}
