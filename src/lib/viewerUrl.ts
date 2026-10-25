// MD-09 — trang /xem-tai-lieu nhận địa chỉ tài liệu qua ?url=. Nếu nhận bất kỳ địa chỉ nào, trang thành "proxy mở": ai cũng có thể làm KiN
// nhúng/liên kết tới trang lạ (kể cả `javascript:` vào nút "Tải xuống") hoặc bắt Microsoft Office Viewer tải một địa chỉ tuỳ ý. Phần THUẦN:
// chỉ nhận (1) đường dẫn nội bộ của KiN, (2) https của Cloudinary CỦA KiN, (3) hai dạng link Google Docs/Drive mà gia sư dán ở mục tài liệu.
export type ViewerUrlKind = "internal" | "cloudinary" | "google";
export type ViewerUrlCheck = { ok: true; url: string; kind: ViewerUrlKind } | { ok: false; error: string };

export const VIEWER_URL_ERRORS = {
  missing: "Thiếu đường dẫn tài liệu.",
  rejected: "Không mở được tài liệu này vì đường dẫn không nằm trong nguồn KiN cho phép. Hãy mở tài liệu từ trang bài học của lớp.",
} as const;

const MAX_LEN = 2048;
const GOOGLE_DOCS_RE = /^\/(document|spreadsheets|presentation)\/d\/[^/]+/;
const GOOGLE_DRIVE_RE = /^\/file\/d\/[^/]+/;

export function checkViewerUrl(raw: string | null | undefined, opts: { cloudName?: string | null } = {}): ViewerUrlCheck {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: false, error: VIEWER_URL_ERRORS.missing };
  const reject = (): ViewerUrlCheck => ({ ok: false, error: VIEWER_URL_ERRORS.rejected });
  // Ký tự điều khiển / khoảng trắng / gạch ngược dùng để lách bộ đọc địa chỉ của trình duyệt.
  if (s.length > MAX_LEN || /[\u0000- \u007f\\]/.test(s)) return reject();

  // Đường dẫn nội bộ: một dấu "/" đứng đầu, KHÔNG phải "//host" (cùng giao thức, host khác).
  if (s.startsWith("/")) {
    if (s.startsWith("//")) return reject();
    try {
      const u = new URL(s, "https://noi-bo.invalid");
      if (u.origin !== "https://noi-bo.invalid") return reject();
    } catch { return reject(); }
    return { ok: true, url: s, kind: "internal" };
  }

  let u: URL;
  try { u = new URL(s); } catch { return reject(); }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return reject();
  const host = u.hostname.toLowerCase();

  if (host === "res.cloudinary.com") {
    const cloud = (opts.cloudName ?? "").trim();
    // Chưa cấu hình tên kho của KiN thì KHÔNG nhận Cloudinary nào cả (đóng thay vì mở).
    if (!cloud || cloud === "your_cloud_name") return reject();
    if (!u.pathname.startsWith(`/${cloud}/`)) return reject();
    return { ok: true, url: s, kind: "cloudinary" };
  }
  if (host === "docs.google.com" && GOOGLE_DOCS_RE.test(u.pathname)) return { ok: true, url: s, kind: "google" };
  if (host === "drive.google.com" && GOOGLE_DRIVE_RE.test(u.pathname)) return { ok: true, url: s, kind: "google" };
  return reject();
}
