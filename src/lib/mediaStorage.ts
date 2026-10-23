// Kiến trúc lưu trữ video / tệp học liệu: PHẦN THUẦN (cấu hình, giới hạn, kiểm tệp). Không đụng fs, mạng, DB.
// Phần chạy thật (đĩa cục bộ, Cloudinary, ký đường dẫn) nằm ở src/lib/mediaStorageServer.ts.
//
// Vì sao tách: cùng một bộ luật giới hạn phải chạy được ở trình duyệt (báo trước khi bấm Lưu) và ở máy chủ (chặn thật),
// và phải test được bằng ca phá cố ý mà không cần mạng.
//
// Quy tắc sản phẩm (đã chốt với chủ dự án ở phiếu này):
//  - Tải video lên là TÙY CHỌN, bật bằng cờ KIN_VIDEO_UPLOAD. Mặc định BẬT khi chạy máy cục bộ (NODE_ENV khác production),
//    mặc định TẮT ở production: có chi phí lưu và phát theo giờ, chủ dự án chưa duyệt.
//  - Giới hạn dung lượng mặc định 200 MB mỗi video (KIN_VIDEO_MAX_MB để đổi).
//  - Chỉ video giảng của gia sư. KHÔNG nhận video có hình hay giọng học sinh (xem VIDEO_UPLOAD_NOTICE: gia sư phải xác nhận).
//  - Mỗi video chỉ học viên đã ghi danh (hoặc bài miễn phí) xem được, qua /api/media/<mã>/stream; không có địa chỉ công khai.

export type StorageDriverName = "cloudinary" | "local";

export interface VideoUploadConfig {
  enabled: boolean;
  /** "none" khi tắt hoặc chưa có kho nào dùng được. */
  driver: StorageDriverName | "none";
  maxBytes: number;
  /** Chữ tiếng Việt giải thích vì sao tắt; null khi bật. */
  reason: string | null;
}

export const DEFAULT_VIDEO_MAX_MB = 200;
/** Trần cứng: cột bytes là Int 32 bit; 2000 MB còn dưới 2^31. */
export const HARD_VIDEO_MAX_MB = 2000;

export const VIDEO_EXTS = ["mp4", "webm", "mov", "m4v"] as const;
export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"] as const;

/** Chữ cảnh báo bản quyền/riêng tư hiện cho gia sư trước khi tải lên. Giữ NGUYÊN câu: bài test kiểm đúng chữ này. */
export const VIDEO_UPLOAD_NOTICE = {
  title: "Trước khi tải video lên",
  lines: [
    "Chỉ tải video bài giảng do chính bạn quay. Không tải video của người khác khi chưa được phép (bản quyền).",
    "Không tải video có hình hoặc giọng của học sinh, nhất là học sinh dưới 16 tuổi.",
    "Video chỉ những học sinh đã vào lớp mới xem được. Bạn chịu trách nhiệm về nội dung đã tải.",
  ],
  confirmLabel: "Tôi xác nhận video này là bài giảng của tôi, không có hình hay giọng học sinh.",
} as const;

function flagOf(v: string | undefined): boolean | null {
  const s = (v ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return null; // để trống hoặc giá trị lạ: dùng mặc định theo môi trường
}

export function resolveVideoUploadConfig(env: Record<string, string | undefined>): VideoUploadConfig {
  const production = env.NODE_ENV === "production";

  let mb = DEFAULT_VIDEO_MAX_MB;
  const rawMb = (env.KIN_VIDEO_MAX_MB ?? "").trim();
  if (rawMb) {
    const n = Number(rawMb);
    if (Number.isFinite(n) && n >= 1) mb = Math.min(Math.floor(n), HARD_VIDEO_MAX_MB);
  }
  const maxBytes = mb * 1024 * 1024;

  const explicit = flagOf(env.KIN_VIDEO_UPLOAD);
  const wanted = explicit ?? !production;
  if (!wanted) {
    return { enabled: false, driver: "none", maxBytes, reason: explicit === false
      ? "Tính năng tải video lên đang tắt (KIN_VIDEO_UPLOAD=0)."
      : "Tải video lên chưa được bật. Hiện bạn dán link YouTube, Vimeo hoặc Google Drive." };
  }

  const cloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  if (cloudinary) return { enabled: true, driver: "cloudinary", maxBytes, reason: null };
  // Đĩa cục bộ chỉ hợp máy cá nhân; ở production (máy chủ không có ổ bền) thì không dùng.
  if (!production) return { enabled: true, driver: "local", maxBytes, reason: null };
  return { enabled: false, driver: "none", maxBytes,
    reason: "Chưa cấu hình kho video (cần CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Hiện bạn dán link YouTube, Vimeo hoặc Google Drive." };
}

export const formatMegabytes = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${(Math.round(mb * 10) / 10).toString().replace(".", ",")} MB`;
};

function extOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
}

export interface FileFacts { name: string; size: number; type?: string }
export type FileCheck = { ok: true } | { ok: false; error: string };

export function validateVideoUpload(f: FileFacts, cfg: VideoUploadConfig): FileCheck {
  if (!cfg.enabled) return { ok: false, error: cfg.reason ?? "Tải video lên đang tắt." };
  if (!f.name || !f.name.trim()) return { ok: false, error: "Thiếu tên tệp." };
  if (!Number.isFinite(f.size) || f.size <= 0) return { ok: false, error: "Tệp rỗng, không tải lên được." };
  const ext = extOf(f.name);
  if (!(VIDEO_EXTS as readonly string[]).includes(ext))
    return { ok: false, error: `Chỉ nhận video ${VIDEO_EXTS.map(e => "." + e).join(", ")}. Tệp này là ${ext ? "." + ext : "không rõ loại"}.` };
  const mime = (f.type ?? "").toLowerCase();
  // Trình duyệt đôi khi để trống MIME với .mov/.m4v: chỉ chặn khi MIME có mà SAI họ video.
  if (mime && !mime.startsWith("video/")) return { ok: false, error: "Tệp này không phải video." };
  if (f.size > cfg.maxBytes) return { ok: false, error: `Video nặng ${formatMegabytes(f.size)}, vượt giới hạn ${formatMegabytes(cfg.maxBytes)}. Hãy nén bớt hoặc đưa lên YouTube (Không công khai) rồi dán link.` };
  return { ok: true };
}

// ── Tài liệu đính kèm ───────────────────────────────────────────────────────

export const DOCUMENT_MAX_MB = 25;
export const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MB * 1024 * 1024;
export const DOCUMENT_EXTS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "png", "jpg", "jpeg", "webp"] as const;
export const DOCUMENT_ACCEPT = DOCUMENT_EXTS.map(e => "." + e).join(",");
export const MAX_DOCUMENTS_PER_LESSON = 30;

export function validateDocumentFile(f: FileFacts): FileCheck {
  if (!f.name || !f.name.trim()) return { ok: false, error: "Thiếu tên tệp." };
  if (!Number.isFinite(f.size) || f.size <= 0) return { ok: false, error: `Tệp "${f.name}" rỗng, không tải lên được.` };
  const ext = extOf(f.name);
  if (!(DOCUMENT_EXTS as readonly string[]).includes(ext))
    return { ok: false, error: `Tệp "${f.name}" không đúng loại. Chỉ nhận ${DOCUMENT_EXTS.map(e => "." + e).join(", ")}.` };
  if (f.size > DOCUMENT_MAX_BYTES) return { ok: false, error: `Tệp "${f.name}" nặng ${formatMegabytes(f.size)}, vượt giới hạn ${DOCUMENT_MAX_MB} MB.` };
  return { ok: true };
}

/** Tên tệp an toàn để đặt vào đường dẫn lưu: bỏ thư mục, ký tự lạ; không bao giờ rỗng hoặc bắt đầu bằng dấu chấm. */
export function safeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFC");
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  const cut = cleaned.slice(0, 120);
  return cut || "tep";
}

// ── Hợp đồng của trình điều khiển lưu trữ ───────────────────────────────────

export type UploadInit =
  | { method: "PUT"; url: string; fields?: undefined }
  | { method: "POST"; url: string; fields: Record<string, string> };

export interface MediaAssetFacts { id: string; storageKey: string; mimeType: string; bytes: number | null }

export interface VideoStorageDriver {
  name: StorageDriverName;
  /** Dựng chỉ dẫn tải lên cho trình duyệt. KHÔNG nhận byte ở bước này. */
  initUpload(a: { assetId: string; fileName: string; mimeType: string }): Promise<UploadInit & { storageKey: string }>;
}

/** Chỉ cho phép giá trị Range dạng "bytes=a-b" hợp lệ; trả null nếu hỏng. Dùng cho trình điều khiển cục bộ. */
export function parseRangeHeader(header: string | null, total: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number, end: number;
  if (m[1] === "") { const suffix = Number(m[2]); if (!suffix) return "invalid"; start = Math.max(0, total - suffix); end = total - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1); }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) return "invalid";
  return { start, end };
}
