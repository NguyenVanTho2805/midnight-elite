// BU-06 — ảnh bìa và video giới thiệu trên hồ sơ gia sư công khai. Hàm THUẦN (không DB, không mạng). Test: tools/local-e2e/t-tutor-search-lib.ts.
//
// TỰ KHAI: KiN không xác minh và không kiểm nội dung ảnh/video.
//  • coverUrl: CHỈ data URL ảnh jpeg|png|webp, base64 hợp lệ, ≤ 250 000 ký tự (không svg/gif/html, không https://).
//  • introVideoUrl: CHỈ link xem YouTube dạng chuẩn do máy chủ dựng từ mã 11 ký tự (parseYoutubeId). Chữ người dùng gõ không bao giờ được lưu hay trả ra.
import { parseYoutubeId, thumbUrl, watchUrl } from "@/lib/youtubeLink";

export const COVER_MAX_CHARS = 250_000;
const COVER_RE = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Ảnh bìa hợp lệ: data URL jpeg/png/webp, base64 đúng (độ dài chia hết 4, dấu = chỉ ở cuối), ≤ 250 000 ký tự. */
export function isValidCover(v: unknown): v is string {
  if (typeof v !== "string" || v.length > COVER_MAX_CHARS) return false;
  const m = COVER_RE.exec(v);
  return !!m && m[1].length % 4 === 0;
}
/** Giá trị đọc từ DB → chỉ trả khi hợp lệ, hỏng thì null (dữ liệu hỏng không bao giờ ra ngoài). */
export const coverForPublic = (stored: unknown): string | null => (isValidCover(stored) ? stored : null);

export type MediaParse = { ok: true; value: string | null | undefined } | { ok: false; error: string };

/** undefined = không gửi (giữ nguyên); null hoặc rỗng = xoá; còn lại phải qua `isValidCover`. */
export function parseCoverInput(raw: unknown): MediaParse {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || (typeof raw === "string" && raw.trim() === "")) return { ok: true, value: null };
  if (isValidCover(raw)) return { ok: true, value: raw };
  return { ok: false, error: "Ảnh bìa phải là JPG/PNG/WebP và nhỏ hơn 250 KB" };
}

/** undefined = giữ nguyên; null hoặc rỗng = xoá; chuỗi → mã YouTube → LƯU `watchUrl(mã)` (không lưu chữ gõ). */
export function parseIntroVideoInput(raw: unknown): MediaParse {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || (typeof raw === "string" && raw.trim() === "")) return { ok: true, value: null };
  const id = parseYoutubeId(raw);
  if (!id) return { ok: false, error: "Chỉ nhận link video YouTube (youtube.com hoặc youtu.be)" };
  return { ok: true, value: watchUrl(id) };
}

export interface IntroVideoView { id: string; watchUrl: string; embedUrl: string; thumbUrl: string }
/** Dẫn xuất lại từ giá trị trong DB mỗi lần đọc. Không đọc được mã (hỏng/tên miền giả) → null. Không trả chuỗi thô. */
export function introVideoView(stored: unknown): IntroVideoView | null {
  const id = parseYoutubeId(stored);
  if (!id) return null;
  return { id, watchUrl: watchUrl(id), embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, thumbUrl: thumbUrl(id) };
}
