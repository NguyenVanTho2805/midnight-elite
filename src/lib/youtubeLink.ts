// Tách mã video YouTube từ link người dùng dán (NC2-046). THUẦN: không mạng, không DB. Test: tools/local-e2e/t-library-video-lib.ts.
//
// KiN KHÔNG gọi YouTube (không Data API, không quét): chỉ nhận một link, lấy mã 11 ký tự, rồi tự dựng link xem và ảnh nhỏ từ mã đó.
// Chỉ nhận đúng các tên miền của YouTube — tên miền giả (youtube.com.xau.vn, xauyoutube.com) và link có tên đăng nhập đều bị từ chối.
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

export const isVideoId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);

/** Mã video từ: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID, /live/ID, /v/ID (kể cả khi thiếu "https://"). Không hiểu thì null. */
export function parseYoutubeId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = seg[0] ?? null;
  else if (HOSTS.has(host)) {
    if (seg[0] === "watch") id = u.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(seg[0] ?? "")) id = seg[1] ?? null;
  }
  return isVideoId(id) ? id : null;
}

/** Link xem trên youtube.com — dựng từ mã đã kiểm, KHÔNG bao giờ từ chữ người dùng gõ. */
export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;
/** Ảnh nhỏ của video (i.ytimg.com). */
export const thumbUrl = (id: string): string => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
