// PH-223 — kế hoạch buổi 4 hoạt động (theo khung giáo án quen thuộc: Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng;
// mỗi hoạt động có "Sản phẩm"). Một lần soạn ra HAI bản:
//   • bản gia sư: đủ mọi thứ (ghi chú dạy, câu hỏi dẫn đường kèm đáp án, sản phẩm);
//   • phiếu học sinh: chỉ câu hỏi dẫn đường + sản phẩm cần làm — KHÔNG đáp án, KHÔNG ghi chú của gia sư.
// Hàm thuần (không Prisma) để test. Đọc dữ liệu trong DB thì khoan dung, ghi thì nghiêm.
// AI soạn nháp thuộc Đợt 2 (Coin) nên chưa có ở đây.

export const ACTIVITY_KEYS = ["mo-dau", "hinh-thanh", "luyen-tap", "van-dung"] as const;
export type ActivityKey = (typeof ACTIVITY_KEYS)[number];
export const ACTIVITY_LABEL: Record<ActivityKey, string> = {
  "mo-dau": "Mở đầu", "hinh-thanh": "Hình thành kiến thức", "luyen-tap": "Luyện tập", "van-dung": "Vận dụng",
};
export const ACTIVITY_HINT: Record<ActivityKey, string> = {
  "mo-dau": "Gợi vấn đề, nối với điều học sinh đã biết.",
  "hinh-thanh": "Dẫn học sinh tự tìm ra kiến thức mới.",
  "luyen-tap": "Làm bài tập có hướng dẫn để nắm chắc.",
  "van-dung": "Dùng vào tình huống mới hoặc bài khó hơn.",
};

export const TITLE_MAX = 120;
export const GOAL_MAX = 500;
export const NOTES_MAX = 2000;
export const PRODUCT_MAX = 500;
export const MAX_QUESTIONS = 10;
export const QUESTION_MAX = 300;
export const ANSWER_MAX = 500;
export const MINUTES_MAX = 180;

export interface GuidingQuestion { q: string; answer: string }
export interface Activity {
  key: ActivityKey;
  minutes: number | null;
  /** Gia sư làm gì, nói gì — CHỈ gia sư thấy. */
  teacherNotes: string;
  questions: GuidingQuestion[];
  /** Sản phẩm của hoạt động: học sinh làm ra / viết ra được gì. Học sinh thấy. */
  product: string;
}
export interface PlanContent { title: string; goal: string; dateKey: string | null; activities: Activity[] }

export const emptyActivity = (key: ActivityKey): Activity => ({ key, minutes: null, teacherNotes: "", questions: [], product: "" });
export const emptyActivities = (): Activity[] => ACTIVITY_KEYS.map(emptyActivity);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "").slice(0, max);

/** YYYY-MM-DD hợp lệ (ngày thật). */
export function isDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Đọc `activities` trong DB: luôn trả đủ 4 hoạt động đúng thứ tự, phần hỏng bị bỏ. Không bao giờ ném lỗi. */
export function readActivities(raw: unknown): Activity[] {
  const byKey = new Map<string, Record<string, unknown>>();
  if (Array.isArray(raw)) for (const a of raw) if (isObj(a) && typeof a.key === "string") byKey.set(a.key, a);
  return ACTIVITY_KEYS.map(key => {
    const a = byKey.get(key);
    if (!a) return emptyActivity(key);
    const minutes = typeof a.minutes === "number" && Number.isInteger(a.minutes) && a.minutes >= 0 && a.minutes <= MINUTES_MAX ? a.minutes : null;
    const questions: GuidingQuestion[] = Array.isArray(a.questions)
      ? a.questions.filter(isObj).slice(0, MAX_QUESTIONS).map(q => ({ q: clean(q.q, QUESTION_MAX), answer: clean(q.answer, ANSWER_MAX) })).filter(q => q.q)
      : [];
    return { key, minutes, teacherNotes: clean(a.teacherNotes, NOTES_MAX), questions, product: clean(a.product, PRODUCT_MAX) };
  });
}

export type PlanParse = { ok: true; value: PlanContent } | { ok: false; error: string };
/**
 * Kiểm dữ liệu gia sư gửi lên. Nghiêm: sai kiểu / vượt giới hạn → từ chối cả bản (không lưu dở).
 * `activities` phải có đúng 4 phần tử theo đúng khoá; thiếu hoặc lạ thì từ chối.
 */
export function parsePlanInput(body: unknown): PlanParse {
  if (!isObj(body)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  if (typeof body.title !== "string" || !body.title.trim()) return { ok: false, error: "Hãy đặt tên cho kế hoạch buổi" };
  if (body.title.trim().length > TITLE_MAX) return { ok: false, error: `Tên kế hoạch tối đa ${TITLE_MAX} ký tự` };
  if (body.goal !== undefined && body.goal !== null && typeof body.goal !== "string") return { ok: false, error: "Mục tiêu phải là chữ" };
  if (typeof body.goal === "string" && body.goal.trim().length > GOAL_MAX) return { ok: false, error: `Mục tiêu tối đa ${GOAL_MAX} ký tự` };
  const dateKey = body.dateKey === undefined || body.dateKey === null || body.dateKey === "" ? null : body.dateKey;
  if (dateKey !== null && !isDateKey(dateKey)) return { ok: false, error: "Ngày dạy không hợp lệ (YYYY-MM-DD)" };
  if (!Array.isArray(body.activities) || body.activities.length !== ACTIVITY_KEYS.length) return { ok: false, error: "Kế hoạch phải có đủ 4 hoạt động" };
  const activities: Activity[] = [];
  for (let i = 0; i < ACTIVITY_KEYS.length; i++) {
    const a = body.activities[i];
    const key = ACTIVITY_KEYS[i];
    const label = ACTIVITY_LABEL[key];
    if (!isObj(a) || a.key !== key) return { ok: false, error: `Hoạt động thứ ${i + 1} phải là “${label}”` };
    if (a.minutes !== null && a.minutes !== undefined && (typeof a.minutes !== "number" || !Number.isInteger(a.minutes) || a.minutes < 0 || a.minutes > MINUTES_MAX)) return { ok: false, error: `${label}: số phút phải từ 0 đến ${MINUTES_MAX}` };
    for (const [f, max] of [["teacherNotes", NOTES_MAX], ["product", PRODUCT_MAX]] as const) {
      const v = a[f];
      if (v !== undefined && v !== null && typeof v !== "string") return { ok: false, error: `${label}: ${f === "product" ? "Sản phẩm" : "Ghi chú"} phải là chữ` };
      if (typeof v === "string" && v.trim().length > max) return { ok: false, error: `${label}: ${f === "product" ? "Sản phẩm" : "Ghi chú"} tối đa ${max} ký tự` };
    }
    if (a.questions !== undefined && !Array.isArray(a.questions)) return { ok: false, error: `${label}: câu hỏi phải là danh sách` };
    const qs = (a.questions ?? []) as unknown[];
    if (qs.length > MAX_QUESTIONS) return { ok: false, error: `${label}: tối đa ${MAX_QUESTIONS} câu hỏi` };
    const questions: GuidingQuestion[] = [];
    for (const q of qs) {
      if (!isObj(q) || typeof q.q !== "string") return { ok: false, error: `${label}: câu hỏi không hợp lệ` };
      if (q.answer !== undefined && q.answer !== null && typeof q.answer !== "string") return { ok: false, error: `${label}: đáp án phải là chữ` };
      if (q.q.trim().length > QUESTION_MAX) return { ok: false, error: `${label}: mỗi câu hỏi tối đa ${QUESTION_MAX} ký tự` };
      if (typeof q.answer === "string" && q.answer.trim().length > ANSWER_MAX) return { ok: false, error: `${label}: mỗi đáp án tối đa ${ANSWER_MAX} ký tự` };
      if (!q.q.trim()) { if (typeof q.answer === "string" && q.answer.trim()) return { ok: false, error: `${label}: có đáp án mà chưa có câu hỏi` }; continue; } // dòng trống: bỏ
      questions.push({ q: clean(q.q, QUESTION_MAX), answer: clean(q.answer, ANSWER_MAX) });
    }
    activities.push({ key, minutes: typeof a.minutes === "number" ? a.minutes : null, teacherNotes: clean(a.teacherNotes, NOTES_MAX), questions, product: clean(a.product, PRODUCT_MAX) });
  }
  return { ok: true, value: { title: body.title.trim(), goal: clean(body.goal, GOAL_MAX), dateKey: dateKey as string | null, activities } };
}

export const totalMinutes = (acts: Activity[]) => acts.reduce((n, a) => n + (a.minutes ?? 0), 0);
/** Số hoạt động đã có nội dung gì đó (ghi chú, câu hỏi hoặc sản phẩm) — để hiện tiến độ soạn. */
export const filledCount = (acts: Activity[]) => acts.filter(a => a.teacherNotes || a.questions.length || a.product).length;

const dmy = (k: string | null) => (k ? `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : "");

/** Bản gia sư: đủ mọi thứ, kể cả đáp án và ghi chú dạy. */
export function renderTutorPlanText(p: PlanContent, o: { courseName?: string } = {}): string {
  const lines: string[] = [`KẾ HOẠCH BUỔI — ${p.title}`];
  const meta = [o.courseName, p.dateKey ? dmy(p.dateKey) : "", totalMinutes(p.activities) ? `${totalMinutes(p.activities)} phút` : ""].filter(Boolean).join(" · ");
  if (meta) lines.push(meta);
  if (p.goal) lines.push("", `Mục tiêu: ${p.goal}`);
  p.activities.forEach((a, i) => {
    lines.push("", `${i + 1}. ${ACTIVITY_LABEL[a.key]}${a.minutes ? ` (${a.minutes} phút)` : ""}`);
    if (a.teacherNotes) lines.push(`   Gia sư: ${a.teacherNotes.replace(/\n/g, "\n   ")}`);
    a.questions.forEach((q, j) => { lines.push(`   Câu ${j + 1}: ${q.q}`); if (q.answer) lines.push(`   Đáp án: ${q.answer}`); });
    if (a.product) lines.push(`   Sản phẩm: ${a.product}`);
  });
  return lines.join("\n");
}

/** Phiếu học sinh: chỉ tên hoạt động, câu hỏi dẫn đường, sản phẩm. KHÔNG đáp án, KHÔNG ghi chú gia sư, KHÔNG số phút chi tiết của gia sư. */
export function renderStudentSheetText(p: PlanContent, o: { courseName?: string } = {}): string {
  const lines: string[] = [`PHIẾU HỌC SINH — ${p.title}`];
  const meta = [o.courseName, p.dateKey ? dmy(p.dateKey) : ""].filter(Boolean).join(" · ");
  if (meta) lines.push(meta);
  if (p.goal) lines.push("", `Hôm nay mình học để: ${p.goal}`);
  let n = 0;
  p.activities.forEach(a => {
    if (!a.questions.length && !a.product) return; // hoạt động chỉ có ghi chú của gia sư: học sinh không cần thấy
    lines.push("", `${ACTIVITY_LABEL[a.key]}`);
    a.questions.forEach(q => { n += 1; lines.push(`   ${n}. ${q.q}`); });
    if (a.product) lines.push(`   Sản phẩm của em: ${a.product}`);
  });
  return lines.join("\n");
}
