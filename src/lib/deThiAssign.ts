// BU-03 — hằng "cổng" cho phần phòng thi phía học sinh, đặt ở MỘT nơi (đặc tả mục 6.2). THUẦN: không DB, không React.
// P3 (giao đề: validateAssignPatch, mặc định theo chế độ) sẽ thêm vào tệp này; vòng P2 chỉ cần hai cờ.

/**
 * `true` khi phòng thi (BU-04, stu-code) đã định tuyến học sinh vào đúng mã đề (`pickVariantFor`), gộp lượt/điểm theo nhóm mã đề
 * và ẩn hàng `variantOfId != null` khỏi danh sách (yêu cầu D2). Cho tới lúc đó: đề N>1 mã bị chặn phát hành (422 VARIANTS_NOT_READY).
 * BU-04 xong thì đổi đúng dòng này thành `true`.
 */
export const VARIANT_STUDENT_SUPPORT = false;

/**
 * `true` khi đối tượng "giao theo link" (đề không gắn lớp) không còn lọt vào danh sách công khai của học sinh (D2). Đổi `true` một dòng khi BU-04 xong.
 * Hiện publish vẫn bắt buộc có lớp nên cờ này chưa chặn thêm gì; P3 (giao theo link) dùng nó.
 */
export const AUDIENCE_LINK_READY = false;

// ── P3 · Giao đề (mục P3.2 / P3.3 của đặc tả). THUẦN: không prisma, không next. Phần ghi DB ở deThiAssignServer.ts. ──────────────
import { isValidDateKey, parseHm } from "@/lib/classSessions";
import { MAX_EXAM_PASSWORD_LEN } from "@/lib/examPassword";

export const EXAM_MODES = ["practice", "test"] as const;
export type ExamMode = (typeof EXAM_MODES)[number];
export const isExamMode = (v: unknown): v is ExamMode => v === "practice" || v === "test";

export const ANSWER_VISIBILITIES = ["never", "after_submit", "after_exam_ends"] as const;
export type AnswerVisibility = (typeof ANSWER_VISIBILITIES)[number];
const isVisibility = (v: unknown): v is AnswerVisibility => typeof v === "string" && (ANSWER_VISIBILITIES as readonly string[]).includes(v);

export const MAX_ATTEMPTS_MIN = 1;
export const MAX_ATTEMPTS_MAX = 20;
export const DURATION_MIN = 1;
export const DURATION_MAX = 300;

/** Mặc định theo chế độ (bảng P3.2). Đề cũ `mode = null` KHÔNG có mặc định — hành vi hiện tại giữ nguyên. */
export interface ModeDefaults { maxAttempts: number | null; answerVisibility: AnswerVisibility; hideAnswerForWrong: boolean; showLeaderboard: boolean; scheduleRequired: boolean }
export function defaultsForMode(mode: ExamMode): ModeDefaults {
  return mode === "practice"
    ? { maxAttempts: null, answerVisibility: "after_submit", hideAnswerForWrong: false, showLeaderboard: false, scheduleRequired: false }
    : { maxAttempts: 1, answerVisibility: "after_exam_ends", hideAnswerForWrong: true, showLeaderboard: false, scheduleRequired: true };
}

/** Khoá cấm tuyệt đối (gia sư không bán / không mở cho khách): từ chối với 400 FORBIDDEN_FIELD, kể cả khi đi kèm khoá hợp lệ. */
export const FORBIDDEN_FIELDS = ["price", "activeGuest", "guestCanTake"] as const;
/** Khoá chỉ đọc (có trong GET): nếu client gửi lại nguyên đối tượng GET thì bỏ qua, không lỗi, không ghi. */
export const READ_ONLY_FIELDS = ["hasPassword", "status", "variants", "attemptCount"] as const;
/** Khoá nhận ở PATCH. */
export const PATCH_FIELDS = ["mode", "courseId", "dateKey", "time", "durationMin", "password", "maxAttempts", "answerVisibility", "hideAnswerForWrong", "showLeaderboard", "holdUntilPublish"] as const;
/** Khoá bị khoá khi đã có lượt làm (đổi giá trị → 409 HAS_ATTEMPTS). */
export const LOCKED_WHEN_ATTEMPTS = ["mode", "courseId", "durationMin"] as const;

export interface AssignCurrent { mode: ExamMode | null; courseId: string | null; dateKey: string | null; time: string | null; durationMin: number | null }
export interface AssignCtx {
  /** Số lượt làm của cả nhóm mã đề (đề gốc + mã con). */
  attemptCount: number;
  current: AssignCurrent;
  /** "YYYY-MM-DD" hôm nay theo giờ VN (do người gọi truyền vào để lib thuần). */
  todayKey: string;
  isDraft: boolean;
  /** Mặc định đọc hằng AUDIENCE_LINK_READY; tham số này để test. */
  audienceLinkReady?: boolean;
}
export interface AssignPatch {
  mode?: ExamMode; courseId?: string | null; dateKey?: string; time?: string; durationMin?: number;
  /** Mật khẩu THÔ gia sư vừa gõ (null = bỏ). Chỉ để máy chủ băm bằng examPassword.ts — không bao giờ ghi/trả nguyên văn. */
  password?: string | null;
  maxAttempts?: number | null; answerVisibility?: AnswerVisibility; hideAnswerForWrong?: boolean; showLeaderboard?: boolean; holdUntilPublish?: boolean;
}
export interface AssignWarning { code: "PAST_DATE"; message: string }
export type AssignCheck =
  | { ok: true; patch: AssignPatch; warnings: AssignWarning[]; modeDefaultsApplied: boolean }
  | { ok: false; status: number; error: string; code: string };

const bad = (status: number, code: string, error: string): AssignCheck => ({ ok: false, status, error, code });
const isBlank = (v: unknown) => v === null || (typeof v === "string" && v.trim() === "");

/**
 * Kiểm thân PATCH …/giao. Trả `patch` đã chuẩn hoá (giờ "HH:mm" đủ 5 ký tự, mật khẩu cắt khoảng trắng, mặc định theo chế độ ĐÃ điền).
 * Mặc định theo chế độ chỉ điền khi `mode` được gửi VÀ khác chế độ hiện tại; khoá gia sư gửi rõ ràng luôn thắng mặc định.
 * Gửi rỗng cho ngày/giờ/thời lượng: chế độ kiểm tra → 400 NEED_SCHEDULE; luyện tập → bỏ qua (giữ giá trị cũ, vì cột không nhận rỗng).
 */
export function validateAssignPatch(body: unknown, ctx: AssignCtx): AssignCheck {
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad(400, "BAD_BODY", "Dữ liệu gửi lên không đọc được.");
  const b = body as Record<string, unknown>;
  const keys = Object.keys(b);

  const forbidden = keys.filter(k => (FORBIDDEN_FIELDS as readonly string[]).includes(k));
  if (forbidden.length > 0) return bad(400, "FORBIDDEN_FIELD", "KiN không bán đề của gia sư và không mở đề cho khách nên không nhận giá hay quyền khách. Bỏ trường này khỏi yêu cầu.");
  const unknown = keys.filter(k => !(PATCH_FIELDS as readonly string[]).includes(k) && !(READ_ONLY_FIELDS as readonly string[]).includes(k));
  if (unknown.length > 0) return bad(400, "UNKNOWN_FIELD", `Không có cài đặt "${unknown[0]}" để lưu.`);

  const patch: AssignPatch = {};
  const cleared = new Set<"dateKey" | "time" | "durationMin">();

  if ("mode" in b) {
    if (!isExamMode(b.mode)) return bad(400, "BAD_MODE", "Chế độ phải là luyện tập (practice) hoặc kiểm tra (test).");
    patch.mode = b.mode;
  }
  if ("courseId" in b) {
    if (isBlank(b.courseId)) patch.courseId = null;
    else if (typeof b.courseId === "string") patch.courseId = b.courseId.trim();
    else return bad(400, "BAD_COURSE", "Mã lớp không đúng dạng.");
  }
  if ("dateKey" in b) {
    if (isBlank(b.dateKey)) cleared.add("dateKey");
    else if (typeof b.dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.dateKey) || !isValidDateKey(b.dateKey)) return bad(400, "BAD_DATE", "Ngày mở bài chưa đúng. Chọn lại ngày.");
    else patch.dateKey = b.dateKey;
  }
  if ("time" in b) {
    if (isBlank(b.time)) cleared.add("time");
    else if (typeof b.time !== "string" || parseHm(b.time) === null) return bad(400, "BAD_TIME", "Giờ mở bài chưa đúng (ví dụ 19:00).");
    else patch.time = b.time.trim().padStart(5, "0");
  }
  if ("durationMin" in b) {
    if (isBlank(b.durationMin)) cleared.add("durationMin");
    else if (typeof b.durationMin !== "number" || !Number.isInteger(b.durationMin) || b.durationMin < DURATION_MIN || b.durationMin > DURATION_MAX) return bad(400, "BAD_DURATION", `Thời lượng làm bài từ ${DURATION_MIN} đến ${DURATION_MAX} phút.`);
    else patch.durationMin = b.durationMin;
  }
  if ("password" in b) {
    if (b.password === null) patch.password = null;
    else if (typeof b.password !== "string") return bad(400, "BAD_PASSWORD", "Mật khẩu phải là chữ (hoặc null để bỏ mật khẩu).");
    else if (b.password.trim().length > MAX_EXAM_PASSWORD_LEN) return bad(400, "BAD_PASSWORD", `Mật khẩu tối đa ${MAX_EXAM_PASSWORD_LEN} ký tự.`);
    else patch.password = b.password.trim() === "" ? null : b.password.trim();
  }
  if ("maxAttempts" in b) {
    if (b.maxAttempts === null) patch.maxAttempts = null;
    else if (typeof b.maxAttempts !== "number" || !Number.isInteger(b.maxAttempts) || b.maxAttempts < MAX_ATTEMPTS_MIN || b.maxAttempts > MAX_ATTEMPTS_MAX) return bad(400, "BAD_ATTEMPTS", `Số lần làm từ ${MAX_ATTEMPTS_MIN} đến ${MAX_ATTEMPTS_MAX}, hoặc để trống nếu không giới hạn.`);
    else patch.maxAttempts = b.maxAttempts;
  }
  if ("answerVisibility" in b) {
    if (!isVisibility(b.answerVisibility)) return bad(400, "BAD_VISIBILITY", "Cách hiện đáp án không hợp lệ.");
    patch.answerVisibility = b.answerVisibility;
  }
  for (const k of ["hideAnswerForWrong", "showLeaderboard", "holdUntilPublish"] as const) {
    if (k in b) {
      if (typeof b[k] !== "boolean") return bad(400, "BAD_FLAG", `"${k}" phải là true hoặc false.`);
      patch[k] = b[k] as boolean;
    }
  }

  // Khoá khi đã có lượt làm: chỉ chặn khi GIÁ TRỊ THỰC SỰ đổi (gửi lại đúng giá trị cũ vô hại).
  if (ctx.attemptCount > 0) {
    const c = ctx.current;
    const changed =
      (patch.mode !== undefined && patch.mode !== c.mode) ||
      (patch.courseId !== undefined && patch.courseId !== c.courseId) ||
      (patch.durationMin !== undefined && patch.durationMin !== c.durationMin) ||
      (cleared.has("durationMin") && c.durationMin !== null);
    if (changed) return bad(409, "HAS_ATTEMPTS", "Đã có học sinh làm bài nên không đổi được chế độ, lớp hay thời lượng. Cô vẫn đổi được mật khẩu, số lần làm và cách hiện đáp án.");
  }

  // Chế độ hiệu lực + mặc định.
  const effMode = patch.mode ?? ctx.current.mode;
  let modeDefaultsApplied = false;
  if (patch.mode !== undefined && patch.mode !== ctx.current.mode) {
    const d = defaultsForMode(patch.mode);
    if (!("maxAttempts" in patch)) patch.maxAttempts = d.maxAttempts;
    if (!("answerVisibility" in patch)) patch.answerVisibility = d.answerVisibility;
    if (!("hideAnswerForWrong" in patch)) patch.hideAnswerForWrong = d.hideAnswerForWrong;
    if (!("showLeaderboard" in patch)) patch.showLeaderboard = d.showLeaderboard;
    modeDefaultsApplied = true;
  }

  // Khung giờ: bài kiểm tra bắt buộc đủ ngày + giờ + thời lượng (giá trị gửi lên, hoặc giá trị hiện có hợp lệ).
  if (effMode === "test") {
    const c = ctx.current;
    const haveDate = !cleared.has("dateKey") && (patch.dateKey ?? c.dateKey) !== null;
    const haveTime = !cleared.has("time") && (patch.time ?? c.time) !== null && parseHm((patch.time ?? c.time) as string) !== null;
    const haveDur = !cleared.has("durationMin") && (patch.durationMin ?? c.durationMin) !== null && ((patch.durationMin ?? c.durationMin) as number) > 0;
    if (!haveDate || !haveTime || !haveDur) return bad(400, "NEED_SCHEDULE", "Bài kiểm tra cần đủ ngày, giờ mở và thời lượng làm bài.");
  }

  // Giao theo link (không gắn lớp) chưa mở cho tới khi phòng thi học sinh xong (D2): chặn với đề đã phát hành, kẻo lọt danh sách công khai.
  if (patch.courseId === null && ctx.current.courseId !== null && !ctx.isDraft && !(ctx.audienceLinkReady ?? AUDIENCE_LINK_READY)) {
    return bad(422, "AUDIENCE_LINK_NOT_READY", "Giao theo đường link chưa mở. Đề đã phát hành cần giữ gắn với một lớp.");
  }

  if (Object.keys(patch).length === 0) return bad(400, "EMPTY", "Không có gì để lưu.");

  const warnings: AssignWarning[] = [];
  if (patch.dateKey !== undefined && patch.dateKey < ctx.todayKey && ctx.attemptCount === 0) {
    warnings.push({ code: "PAST_DATE", message: "Ngày mở bài đã qua. KiN vẫn lưu, cô kiểm tra lại cho chắc." });
  }
  return { ok: true, patch, warnings, modeDefaultsApplied };
}
