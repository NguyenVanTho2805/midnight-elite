// BU-HS-NOP-TEP — học sinh nộp bài bằng tệp Word/PDF (riêng tư, lưu 60 ngày); gia sư xem/tải và trả bài kèm tệp.
// Tệp này THUẦN: không DB, không mạng, không fs, KHÔNG import node:* — nên import được cả từ thành phần chạy ở trình duyệt (báo trước khi tải lên).
// Phần đọc nội dung tệp (docx = zip, pdf) cần node:zlib nên nằm ở nopTepInspect.ts; phần chạy thật nằm ở nopTepServer.ts / nopTepExpiryServer.ts.
//
// Quyết định của chủ (qua COO): lưu 60 ngày (cả tệp gia sư trả); dưới 10 MB mỗi tệp; chỉ học sinh đó + gia sư của lớp xem được; chặn ảnh/video;
// kiểm đuôi + magic bytes; tải qua đường có kiểm quyền (/api/media/nop-bai/…); hết hạn bằng cron có log, chạy khô mặc định; giữ điểm và nhận xét.
// Mốc giờ (createdAt, expiresAt…) do MÁY CHỦ đặt; trình duyệt chỉ hiển thị. Thông điệp lỗi KHÔNG BAO GIỜ lặp lại tên tệp.

// ── Hằng số ─────────────────────────────────────────────────────────────────

export const NOP_TEP_RETENTION_DAYS = 60;
/** Biên "dưới 10 MB": nhận khi size < MAX (đúng 10 MiB bị từ chối). Nếu Cloudinary từ chối ~10.000.000–10.485.759 byte thì hạ hằng số này (xem spec mục 1.3). */
export const NOP_TEP_MAX_BYTES = 10 * 1024 * 1024;
export const NOP_TEP_MAX_FILES = 3;
export const NOP_TEP_PENDING_TTL_HOURS = 24;
export const NOP_TEP_EXTS = ["docx", "pdf"] as const;
export const NOP_TEP_ACCEPT = ".docx,.pdf";
export const NOP_TEP_KINDS = ["student", "tutor_return"] as const;
export const NOP_TEP_STATUSES = ["pending", "ready", "removed", "expired"] as const;
export type NopTepKind = (typeof NOP_TEP_KINDS)[number];
export type NopTepStatus = (typeof NOP_TEP_STATUSES)[number];
export type NopTepExt = (typeof NOP_TEP_EXTS)[number];
/** Kiểu giá trị `AssignmentSubmission.kind` khi nộp bằng tệp trên KiN (hai giá trị cũ "file" và "link" giữ nguyên). */
export const NOP_TEP_SUBMISSION_KIND = "tep";
export const NOP_TEP_STORAGE_PREFIX = "kin-nop-bai";
export const NOP_TEP_EXPIRED_MESSAGE = "Tệp đã được xoá sau 60 ngày. Điểm và nhận xét vẫn giữ.";
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Đuôi → MIME do KiN quyết (không lấy từ tệp hay trình duyệt); cũng là Content-Type khi phát lại. */
export const NOP_TEP_MIME_BY_EXT: Record<NopTepExt, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
/** MIME trình duyệt khai mà ta chấp nhận cho từng đuôi — CHỈ để báo sớm, không dùng để tin. Trống / application/octet-stream được bỏ qua (nội dung thật do inspect* quyết). */
const MIME_FAMILY: Record<NopTepExt, string[]> = {
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pdf: ["application/pdf", "application/x-pdf"],
};

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "bmp", "svg", "tif", "tiff", "avif", "ico"];
const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "avi", "mkv", "wmv", "flv", "3gp"];
const EXEC_EXTS = ["exe", "dll", "bat", "cmd", "com", "msi", "js", "mjs", "vbs", "ps1", "sh", "jar", "apk", "app", "scr", "lnk", "html", "htm", "php", "py"];
const MACRO_EXTS = ["docm", "dotm", "xlsm", "pptm", "xlam", "ppam"];
const ARCHIVE_EXTS = ["zip", "rar", "7z", "gz", "tar", "tgz", "bz2", "xz", "iso"];

// ── Đường API (một chỗ để thành phần và test cùng dùng) ─────────────────────

export const NOP_TEP_API = {
  init: "/api/media/nop-bai/init",
  complete: "/api/media/nop-bai/complete",
  attach: "/api/media/nop-bai/dinh-kem",
  list: "/api/media/nop-bai/danh-sach",
  localPut: (fileId: string) => `/api/media/nop-bai/dai/${encodeURIComponent(fileId)}`,
  file: (fileId: string) => `/api/media/nop-bai/${encodeURIComponent(fileId)}`,
  remove: (fileId: string) => `/api/media/nop-bai/${encodeURIComponent(fileId)}/xoa`,
  /** Form POST thường (303). */
  submit: (assignmentId: string) => `/api/student/nop-bai/${encodeURIComponent(assignmentId)}/nop`,
} as const;

/** Giá trị `?nop=` trên trang bài giảng sau khi bấm "Nộp bài" (mã, không dán chữ người dùng vào URL). */
export const NOP_TEP_RESULT = { ok: "ok", noFile: "loi-chua-co-tep", classDenied: "loi-lop", off: "loi-tat" } as const;
export type NopTepResultCode = (typeof NOP_TEP_RESULT)[keyof typeof NOP_TEP_RESULT];
const RESULT_TEXT: Record<NopTepResultCode, string> = {
  ok: "Đã nộp bài.",
  "loi-chua-co-tep": "Hãy chọn ít nhất 1 tệp rồi bấm Nộp bài.",
  "loi-lop": "Bạn chưa ở trong lớp này nên chưa nộp được bài.",
  "loi-tat": "Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota.",
};
/** Chữ cho `?nop=<mã>`; mã lạ ⇒ null (không in ra). */
export function nopTepResultMessage(code: string | null | undefined): string | null {
  return code && (Object.values(NOP_TEP_RESULT) as string[]).includes(code) ? RESULT_TEXT[code as NopTepResultCode] : null;
}

// ── Cấu hình ────────────────────────────────────────────────────────────────

export interface NopTepConfig {
  enabled: boolean;
  /** "none" khi tắt. */
  driver: "cloudinary" | "local" | "none";
  maxBytes: number;
  maxFiles: number;
  exts: string[];
  retentionDays: number;
  /** Chữ tiếng Việt giải thích vì sao tắt; null khi bật. */
  reason: string | null;
}

/**
 * Bật khi: production + đủ ba biến Cloudinary CÓ KHOÁ BÍ MẬT ⇒ "cloudinary"; máy dev ⇒ "local" (hoặc cloudinary nếu có đủ khoá).
 * Thiếu ⇒ TẮT + lý do. CỐ Ý không đọc NEXT_PUBLIC_CLOUDINARY_* (preset không ký): một cấu hình sai không được đưa ta về đường tải công khai.
 * KIN_NOP_TEP=0 là công tắc tắt khẩn cấp.
 */
export function nopTepConfig(env: Record<string, string | undefined>): NopTepConfig {
  const base = { maxBytes: NOP_TEP_MAX_BYTES, maxFiles: NOP_TEP_MAX_FILES, exts: [...NOP_TEP_EXTS] as string[], retentionDays: NOP_TEP_RETENTION_DAYS };
  const flag = (env.KIN_NOP_TEP ?? "").trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(flag)) {
    return { ...base, enabled: false, driver: "none", reason: "Tính năng nộp tệp đang tắt. Bạn vẫn nộp được bằng link Azota." };
  }
  const production = env.NODE_ENV === "production";
  const cloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  if (cloudinary) return { ...base, enabled: true, driver: "cloudinary", reason: null };
  if (!production) return { ...base, enabled: true, driver: "local", reason: null };
  return { ...base, enabled: false, driver: "none", reason: "Tính năng nộp tệp chưa bật (kho chưa cấu hình). Bạn vẫn nộp được bằng link Azota." };
}

// ── Tên tệp ─────────────────────────────────────────────────────────────────

/**
 * Tên tệp an toàn để HIỂN THỊ và đặt vào Content-Disposition: NFC, bỏ đường dẫn, bỏ ký tự điều khiển và ký tự đổi chiều chữ (U+202A–E, U+2066–9: mẹo làm .exe trông như .docx),
 * chỉ giữ chữ/số/dấu/`._ -`, gộp khoảng trắng, không bắt đầu bằng dấu chấm, ≤120 ký tự và CẮT PHẦN TÊN CHỨ KHÔNG CẮT ĐUÔI (khác safeFileName của BU-02). Không bao giờ rỗng ("tep").
 */
export function nopTepSafeName(name: unknown): string {
  let s = typeof name === "string" ? name : "";
  s = s.normalize("NFC");
  s = s.split(/[\\/]/).pop() ?? "";
  s = s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, "");
  s = s.replace(/[^\p{L}\p{M}\p{N}._ -]/gu, "_").replace(/\s+/g, " ").trim();
  s = s.replace(/^[.\s]+/, "").replace(/[.\s]+$/, "");
  const chars = Array.from(s);
  if (chars.length > 120) {
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 ? s.slice(dot + 1) : "";
    if (ext && ext.length <= 10) {
      const keep = 120 - ext.length - 1;
      s = Array.from(s.slice(0, dot)).slice(0, keep).join("").replace(/[.\s]+$/, "") + "." + ext;
    } else s = chars.slice(0, 120).join("");
  }
  return s || "tep";
}

/** Đuôi CUỐI CÙNG, viết thường (`a.docx.exe` ⇒ `exe` ⇒ bị chặn). Không có / có ký tự lạ ⇒ "". */
export function nopTepExt(name: unknown): string {
  if (typeof name !== "string") return "";
  const base = (name.split(/[\\/]/).pop() ?? "").trim().replace(/[.\s]+$/, "");
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = base.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

/** Tên đã làm sạch, đảm bảo kết thúc bằng `.ext` (đuôi do bảng quyết, không do trình duyệt). */
export function nopTepStoredName(name: unknown, ext: NopTepExt): string {
  const safe = nopTepSafeName(name);
  return nopTepExt(safe) === ext ? safe : `${safe.replace(/\.[A-Za-z0-9]{1,10}$/, "")}.${ext}`;
}

// ── Kiểm yêu cầu (trước khi tải lên; chạy ở cả trình duyệt và máy chủ) ──────

export type NopTepErrorCode =
  | "bad_ext" | "too_big" | "empty" | "blocked_image" | "blocked_video" | "blocked_exec" | "blocked_macro_ext" | "blocked_archive" | "bad_mime"
  | "bad_content" | "blocked_macro" | "bomb";
export type NopTepCheck = { ok: true; ext: NopTepExt } | { ok: false; error: string; code: NopTepErrorCode };

export const NOP_TEP_ERRORS: Record<NopTepErrorCode, string> = {
  bad_ext: "Tệp này không phải Word hoặc PDF. Hãy lưu thành .docx hoặc .pdf rồi chọn lại.",
  too_big: "Tệp lớn hơn 10 MB. Hãy nén ảnh trong bài hoặc chia nhỏ tệp.",
  empty: "Tệp rỗng, không tải lên được.",
  blocked_image: "KiN không nhận ảnh làm bài. Hãy chụp vào tài liệu Word/PDF hoặc nộp bằng link Azota.",
  blocked_video: "KiN không nhận video làm bài. Hãy nộp bằng tệp Word hoặc PDF.",
  blocked_exec: "KiN không nhận tệp chương trình hoặc mã lệnh. Hãy nộp bằng tệp Word hoặc PDF.",
  blocked_macro_ext: "Tệp có macro nên không nhận. Hãy lưu thành .docx thường rồi chọn lại.",
  blocked_archive: "KiN không nhận tệp nén. Hãy nộp từng tệp Word hoặc PDF (tối đa 3 tệp).",
  bad_mime: "Tệp khai báo loại khác với đuôi tên tệp. Hãy xuất lại tệp từ Word rồi chọn lại.",
  bad_content: "Nội dung tệp không phải Word/PDF. Hãy xuất lại tệp từ Word.",
  blocked_macro: "Tệp có macro hoặc đối tượng nhúng nên không nhận. Hãy lưu thành tệp thường.",
  bomb: "Tệp có cấu trúc bất thường nên không nhận. Hãy xuất lại tệp từ Word.",
};
export const NOP_TEP_MSG_DOC = "Tệp .doc cũ không nhận. Hãy lưu lại thành .docx.";
export const NOP_TEP_MSG_TOO_MANY = "Mỗi bài chỉ nộp tối đa 3 tệp.";
export const NOP_TEP_MSG_OFF = "Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota.";

export interface NopTepFacts { name: unknown; size: unknown; type?: unknown }

export function validateNopTepRequest(f: NopTepFacts, cfg: Pick<NopTepConfig, "maxBytes"> = { maxBytes: NOP_TEP_MAX_BYTES }): NopTepCheck {
  const fail = (code: NopTepErrorCode, error = NOP_TEP_ERRORS[code]): NopTepCheck => ({ ok: false, code, error });
  const ext = nopTepExt(f.name);
  if (IMAGE_EXTS.includes(ext)) return fail("blocked_image");
  if (VIDEO_EXTS.includes(ext)) return fail("blocked_video");
  if (EXEC_EXTS.includes(ext)) return fail("blocked_exec");
  if (MACRO_EXTS.includes(ext)) return fail("blocked_macro_ext");
  if (ARCHIVE_EXTS.includes(ext)) return fail("blocked_archive");
  if (ext === "doc") return fail("bad_ext", NOP_TEP_MSG_DOC);
  if (!(NOP_TEP_EXTS as readonly string[]).includes(ext)) return fail("bad_ext");
  const size = f.size;
  if (typeof size !== "number" || !Number.isFinite(size) || size < 1) return fail("empty");
  if (size >= cfg.maxBytes) return fail("too_big");
  const mime = typeof f.type === "string" ? f.type.split(";")[0].trim().toLowerCase() : "";
  if (mime && mime !== "application/octet-stream" && !MIME_FAMILY[ext as NopTepExt].includes(mime)) return fail("bad_mime");
  return { ok: true, ext: ext as NopTepExt };
}

// ── Hạn 60 ngày ─────────────────────────────────────────────────────────────

/** createdAt + 60 × 24 giờ (Việt Nam không có giờ mùa hè). Chốt lúc tạo và lưu vào cột expiresAt. */
export const nopTepExpiresAt = (createdAt: Date): Date => new Date(createdAt.getTime() + NOP_TEP_RETENTION_DAYS * DAY_MS);
/** Hết hạn khi tệp gốc CÒN trên kho và `expiresAt` đã QUA (so sánh nghiêm ngặt: đúng bằng mốc chưa hết hạn). Đã xoá khỏi kho (`deletedAt`) thì không tính nữa. */
export const isNopTepExpired = (f: { deletedAt: Date | null; expiresAt: Date }, now: Date): boolean => f.deletedAt == null && f.expiresAt.getTime() < now.getTime();
/** Tệp tải dở: pending, quá 24 giờ, chưa gắn vào bài nộp. */
export const isNopTepAbandoned = (f: { status: string; createdAt: Date; submissionId: string | null }, now: Date): boolean =>
  f.status === "pending" && f.submissionId == null && f.createdAt.getTime() < now.getTime() - NOP_TEP_PENDING_TTL_HOURS * HOUR_MS;
/** Bỏ đi nhưng tệp gốc vẫn còn trên kho (lần xoá trước thất bại). */
export const isNopTepRemovedLeftover = (f: { status: string; deletedAt: Date | null }): boolean => f.status === "removed" && f.deletedAt == null;

// Ba tập duy nhất mà cron được xoá. Mỗi tập là MỘT câu where xuất từ đây; khớp ba hàm thuần ngay trên (có test đối chiếu).
export const nopTepExpiredWhere = (now: Date) => ({ deletedAt: null, expiresAt: { lt: now }, status: { not: "expired" } });
export const nopTepAbandonedWhere = (now: Date) => ({ status: "pending", createdAt: { lt: new Date(now.getTime() - NOP_TEP_PENDING_TTL_HOURS * HOUR_MS) }, submissionId: null });
export const nopTepRemovedLeftoverWhere = () => ({ status: "removed", deletedAt: null });

// ── Dạng trả ra API (MỘT nơi quyết trường nào được ra) ──────────────────────

export interface NopTepFileJson {
  id: string; kind: NopTepKind; name: string; ext: string; sizeBytes: number | null; status: NopTepStatus;
  createdAt: string; expiresAt: string; expired: boolean;
  /** true = đã gắn vào bài nộp / bài trả (người khác thấy được); false = bản nháp đang chuẩn bị. */
  submitted: boolean;
  href: string;
}
export interface NopTepLimits { maxBytes: number; maxFiles: number; exts: string[]; retentionDays: number }
export interface NopTepListResponse {
  enabled: boolean; reason: string | null; limits: NopTepLimits; retentionDays: number;
  files: NopTepFileJson[];
  /** Bài nộp hiện tại của học sinh (chỉ mốc nộp do máy chủ đặt + đã chấm hay chưa; không điểm, không nhận xét). */
  submission: { submittedAt: string; graded: boolean } | null;
}
export type NopTepUploadInit = { method: "PUT"; url: string } | { method: "POST"; url: string; fields: Record<string, string> };
export interface NopTepInitResponse { fileId: string; driver: "cloudinary" | "local"; maxBytes: number; upload: NopTepUploadInit }
export interface NopTepCompleteResponse { file: NopTepFileJson }
export interface NopTepAttachResponse { files: NopTepFileJson[] }
export interface NopTepErrorJson { error: string; code?: string; reason?: string }

export interface NopTepFileRow {
  id: string; kind: string; originalName: string; ext: string; sizeBytes: number | null; status: string;
  createdAt: Date; expiresAt: Date; deletedAt: Date | null; submissionId: string | null;
}
/** `namesVisible=false` (giáo viên bộ môn ngoài nhóm) ⇒ tên chung "Bài nộp <n>.<ext>", không lộ tên thật. `index` bắt đầu từ 1. KHÔNG BAO GIỜ trả storageKey, driver, sha256, ownerUserId, studentUserId, courseId. */
export function describeNopTepFile(f: NopTepFileRow, o: { namesVisible: boolean; index?: number; now: Date }): NopTepFileJson {
  const generic = `Bài nộp ${o.index ?? 1}.${f.ext}`;
  return {
    id: f.id,
    kind: f.kind === "tutor_return" ? "tutor_return" : "student",
    name: o.namesVisible ? f.originalName : generic,
    ext: f.ext,
    sizeBytes: f.sizeBytes,
    status: (NOP_TEP_STATUSES as readonly string[]).includes(f.status) ? (f.status as NopTepStatus) : "removed",
    createdAt: f.createdAt.toISOString(),
    expiresAt: f.expiresAt.toISOString(),
    expired: f.status === "expired" || isNopTepExpired(f, o.now),
    submitted: f.submissionId != null,
    href: NOP_TEP_API.file(f.id),
  };
}

// ── Bảng quyền xem/tải (mặc định TỪ CHỐI; route chỉ gọi hàm này) ────────────

export interface NopTepViewCtx {
  now: Date;
  file: { kind: string; status: string; submissionId: string | null; studentUserId: string; ownerUserId: string; deletedAt: Date | null; expiresAt: Date };
  /** null = khách. */
  viewer: { userId: string; role: "student" | "admin" } | null;
  /** Trạng thái ghi danh của người xem (học sinh) trong lớp chứa tệp; null = chưa ghi danh. */
  enrollment: string | null;
  /** Người xem qua được cổng chấm của bài (requireAssignmentAccess(…, "grade")): chủ lớp, đồng giảng hiệu lực, bộ môn trong phạm vi, quản trị cấp 1/nội dung. */
  grader: boolean;
  /** Phụ huynh đã liên kết (ParentLink verified) với học sinh có bài. KHÔNG có quyền xem (mặc định chờ chủ). */
  linkedParent: boolean;
}
export type NopTepViewDecision =
  | { ok: true; as: "student" | "grader" }
  | { ok: false; status: 401 | 403 | 404 | 410; code: "login" | "forbidden" | "enrollment" | "not_found" | "expired" };

export function canViewNopTepFile(c: NopTepViewCtx): NopTepViewDecision {
  const no = (status: 401 | 403 | 404 | 410, code: "login" | "forbidden" | "enrollment" | "not_found" | "expired"): NopTepViewDecision => ({ ok: false, status, code });
  if (!c.viewer) return no(401, "login");
  let as: "student" | "grader";
  if (c.viewer.role === "student") {
    if (c.viewer.userId !== c.file.studentUserId) return c.linkedParent ? no(403, "forbidden") : no(404, "not_found");
    if (c.enrollment !== "active") return no(403, "enrollment");
    if (c.file.kind === "tutor_return" && c.file.submissionId == null) return no(404, "not_found");
    as = "student";
  } else {
    if (!c.grader) return no(403, "forbidden");
    if (c.file.submissionId == null && c.file.ownerUserId !== c.viewer.userId) return no(404, "not_found");
    as = "grader";
  }
  if (c.file.status === "expired") return no(410, "expired");
  if (c.file.status !== "ready") return no(404, "not_found");
  if (isNopTepExpired(c.file, c.now)) return no(410, "expired");
  return { ok: true, as };
}

/** Id từ URL / thân yêu cầu có thể đưa xuống DB (cuid/uuid): chống NUL, quá dài, ký tự lạ. */
export const isNopTepId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{8,60}$/.test(id);
