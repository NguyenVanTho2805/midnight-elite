// Kiểm một video YouTube trong kho (NC2-046, danh sách do quản trị chọn). THUẦN: không DB. Test: tools/local-e2e/t-library-video-lib.ts.
import { parseYoutubeId } from "@/lib/youtubeLink";
import { fold } from "@/lib/librarySearch";

export const VIDEO_TITLE_MAX = 120;
export const VIDEO_TOPIC_MAX = 40;
export const VIDEO_TOPICS_MAX = 8;
export const VIDEO_CHANNEL_MAX = 80;
export const VIDEO_NOTE_MAX = 200;

export interface LibraryVideoValue { title: string; videoId: string; topics: string[]; channel: string; note: string; published: boolean }
export type LibraryVideoCheck = { ok: true; value: LibraryVideoValue } | { ok: false; error: string; field: "title" | "url" | "topics" | "channel" | "note" | "published" };

// NFC: chữ có dấu dán từ Mac / Facebook có thể ở dạng tổ hợp. Bỏ ký tự điều khiển và tàng hình để "tên trống" không lọt qua.
const oneLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f\u200b-\u200d\u2060\ufeff]/g, " ").replace(/\s+/g, " ").trim() : "");

/** Chủ đề: mảng chữ HOẶC một chuỗi ngăn bằng dấu phẩy / chấm phẩy / xuống dòng. Bỏ trống, bỏ trùng (không phân biệt hoa thường / dấu). */
export function parseTopics(raw: unknown): { ok: true; topics: string[] } | { ok: false; error: string } {
  const parts = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;\n]/) : raw === undefined || raw === null ? [] : null;
  if (parts === null) return { ok: false, error: "Chủ đề phải là danh sách chữ" };
  const seen = new Set<string>(), topics: string[] = [];
  for (const p of parts) {
    if (typeof p !== "string") return { ok: false, error: "Chủ đề phải là danh sách chữ" };
    const t = oneLine(p);
    if (!t) continue;
    if (t.length > VIDEO_TOPIC_MAX) return { ok: false, error: `Mỗi chủ đề tối đa ${VIDEO_TOPIC_MAX} ký tự` };
    const k = fold(t);
    if (!k || seen.has(k)) continue;
    seen.add(k); topics.push(t);
  }
  if (topics.length > VIDEO_TOPICS_MAX) return { ok: false, error: `Tối đa ${VIDEO_TOPICS_MAX} chủ đề` };
  return { ok: true, topics };
}

/** Kiểm dữ liệu thô (JSON trình duyệt gửi, KHÔNG tin). Cần `title` và `url` (link YouTube); còn lại tuỳ chọn. Mặc định chưa công khai. */
export function parseLibraryVideoInput(raw: unknown): LibraryVideoCheck {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, field: "title", error: "Dữ liệu không đúng dạng" };
  const o = raw as Record<string, unknown>;
  const title = oneLine(o.title);
  if (!title) return { ok: false, field: "title", error: "Chưa đặt tiêu đề cho video" };
  if (title.length > VIDEO_TITLE_MAX) return { ok: false, field: "title", error: `Tiêu đề tối đa ${VIDEO_TITLE_MAX} ký tự` };
  const videoId = parseYoutubeId(o.url);
  if (!videoId) return { ok: false, field: "url", error: "Link YouTube chưa đúng (dạng youtube.com/watch?v=… hoặc youtu.be/…)" };
  const t = parseTopics(o.topics);
  if (!t.ok) return { ok: false, field: "topics", error: t.error };
  const channel = oneLine(o.channel), note = oneLine(o.note);
  if (channel.length > VIDEO_CHANNEL_MAX) return { ok: false, field: "channel", error: `Tên kênh tối đa ${VIDEO_CHANNEL_MAX} ký tự` };
  if (note.length > VIDEO_NOTE_MAX) return { ok: false, field: "note", error: `Ghi chú tối đa ${VIDEO_NOTE_MAX} ký tự` };
  if (o.published !== undefined && typeof o.published !== "boolean") return { ok: false, field: "published", error: "Công khai phải là đúng hoặc sai" };
  return { ok: true, value: { title, videoId, topics: t.topics, channel, note, published: o.published === true } };
}
