// Nhận diện và kiểm tra liên kết học liệu (video, tài liệu, Zoom, Azota). Phần THUẦN: không đụng DB, không đọc môi trường.
//
// Một nơi duy nhất cho mọi chỗ cần đọc link: màn soạn bài (báo lỗi sớm khi gia sư dán), trang học của học sinh (chọn trình phát),
// máy chủ (từ chối link lạ khi lưu), trang xem tài liệu (chỉ nhúng nguồn tin cậy). Trước đây mỗi nơi tự đọc một kiểu.
//
// Nguyên tắc an toàn:
//  - chỉ https (không http, javascript:, data:, blob:, file:), không có "user:pass@" trong link;
//  - so khớp máy chủ theo PHẦN ĐUÔI có dấu chấm ("youtube.com" hoặc "*.youtube.com"), không so chuỗi con
//    (tránh "youtube.com.evil.example", "evil.example/youtube.com", "youtube.com@evil.example");
//  - chỉ trả `embedUrl` cho nguồn đã biết, dựng lại từ mã video đã kiểm, KHÔNG bao giờ đưa nguyên link người dùng vào iframe;
//  - "kin-media:<mã>" là video gia sư tải lên KiN (xem mediaStorage.ts), không phải địa chỉ web.

export type MediaKind =
  | "youtube" | "vimeo" | "drive" | "drive_folder" | "google_doc"
  | "zoom_live" | "zoom_record" | "azota" | "upload" | "other";

export type MediaSlot = "video" | "live" | "azota" | "document";
export type SuggestedLessonType = "record" | "live" | "quiz" | "document";

export interface MediaLinkInfo {
  /** true = đủ an toàn để LƯU (không có nghĩa là hợp ô đang dán: xem `checkLinkForSlot`). */
  ok: boolean;
  kind: MediaKind | "invalid";
  /** Nhãn tiếng Việt cho người dùng ("YouTube", "Google Drive"...). */
  label: string;
  /** Link đã chuẩn hoá (cắt khoảng trắng, thêm https:// nếu thiếu). Rỗng nếu không hợp lệ. */
  url: string;
  /** Địa chỉ nhúng iframe an toàn do KiN dựng lại; null nếu không nhúng được. */
  embedUrl: string | null;
  /** Mã video/tệp đã kiểm (YouTube 11 ký tự, Vimeo số, Drive...). */
  id: string | null;
  /** Mã khoá riêng của Vimeo "không công khai" (tham số h). */
  vimeoHash: string | null;
  suggestedType: SuggestedLessonType | null;
  /** Chỉ khi ok=false. */
  error: string | null;
  /** Lưu được nhưng cần cho người dùng biết (quyền chia sẻ, không nhúng được...). */
  warning: string | null;
}

const MAX_URL_LENGTH = 2000;
const MAX_LINKS = 20;

const NONE = { embedUrl: null, id: null, vimeoHash: null, suggestedType: null, error: null, warning: null } as const;

function invalid(error: string, url = ""): MediaLinkInfo {
  return { ok: false, kind: "invalid", label: "Link chưa đúng", url, ...NONE, error };
}

/** host có phải `domain` hoặc tên miền con của `domain` không (so khớp theo dấu chấm, không so chuỗi con). */
export function hostMatches(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === domain || h.endsWith("." + domain);
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
const VIMEO_ID = /^\d{5,12}$/;
const VIMEO_HASH = /^[a-f0-9]{6,20}$/i;
const UPLOAD_RE = /^kin-media:([A-Za-z0-9_-]{8,40})$/;

/** Link "kin-media:<mã>" (video tải lên KiN) → mã; còn lại null. */
export function uploadIdOf(raw: string | null | undefined): string | null {
  const m = UPLOAD_RE.exec((raw ?? "").trim());
  return m ? m[1] : null;
}
export const uploadLink = (assetId: string): string => `kin-media:${assetId}`;

function normalise(raw: string): { url: URL | null; text: string; error?: string } {
  let text = raw.trim();
  if (!text) return { url: null, text, error: "Chưa dán link." };
  if (text.length > MAX_URL_LENGTH) return { url: null, text: "", error: "Link quá dài." };
  if (/\s/.test(text)) return { url: null, text: "", error: "Link có khoảng trắng. Hãy dán lại đúng một link." };
  // "youtube.com/watch?v=..." (thiếu https://) là lỗi gõ rất hay gặp: tự bù thay vì bắt gõ lại.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]|$)/i.test(text)) text = "https://" + text;
  let u: URL;
  try { u = new URL(text); } catch { return { url: null, text: "", error: "Đây chưa phải là một link. Hãy dán đường dẫn bắt đầu bằng https://" }; }
  if (u.protocol === "http:") return { url: null, text: "", error: "Link phải bắt đầu bằng https:// (không dùng http://)." };
  if (u.protocol !== "https:") return { url: null, text: "", error: "Chỉ nhận link bắt đầu bằng https://." };
  if (u.username || u.password) return { url: null, text: "", error: "Link có kèm tên đăng nhập hoặc mật khẩu, KiN không nhận." };
  if (!u.hostname.includes(".")) return { url: null, text: "", error: "Tên miền trong link chưa đúng." };
  return { url: u, text: u.toString() };
}

function youtubeId(u: URL): string | null {
  const host = u.hostname;
  const isShort = hostMatches(host, "youtu.be");
  const isYt = hostMatches(host, "youtube.com") || hostMatches(host, "youtube-nocookie.com");
  if (!isShort && !isYt) return null;
  let id: string | null = null;
  if (isShort) id = u.pathname.split("/").filter(Boolean)[0] ?? null;
  else {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1] ?? null;
  }
  return id && YT_ID.test(id) ? id : null;
}

function startSeconds(u: URL): number | null {
  const raw = u.searchParams.get("t") ?? u.searchParams.get("start");
  if (!raw) return null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const sec = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return sec > 0 && sec < 86400 ? sec : null;
}

function driveFileId(u: URL): string | null {
  if (!hostMatches(u.hostname, "drive.google.com")) return null;
  const m = /^\/file\/d\/([^/]+)/.exec(u.pathname);
  const id = m ? m[1] : (["open", "uc"].includes(u.pathname.split("/")[1] ?? "") && u.pathname.split("/").length === 2) ? u.searchParams.get("id") : null;
  return id && DRIVE_ID.test(id) ? id : null;
}

/** Nhận diện MỘT link. Không quan tâm ô nào đang dán: dùng `checkLinkForSlot` để kiểm theo ô. */
export function classifyMediaLink(raw: string | null | undefined): MediaLinkInfo {
  const input = (raw ?? "").trim();
  if (!input) return invalid("Chưa dán link.");

  const up = uploadIdOf(input);
  if (up) return { ok: true, kind: "upload", label: "Video tải lên KiN", url: input, embedUrl: null, id: up, vimeoHash: null, suggestedType: "record", error: null, warning: null };
  if (/^kin-media:/i.test(input)) return invalid("Mã video tải lên không đúng.");

  const n = normalise(input);
  if (!n.url) return invalid(n.error ?? "Link chưa đúng.");
  const u = n.url;
  const url = n.text;
  const host = u.hostname;

  // ── YouTube ──
  const yt = youtubeId(u);
  if (yt) {
    const start = startSeconds(u);
    const embed = `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1${start ? `&start=${start}` : ""}`;
    return { ok: true, kind: "youtube", label: "YouTube", url, embedUrl: embed, id: yt, vimeoHash: null, suggestedType: "record", error: null,
      warning: "Nếu video để chế độ \"Không công khai\", học sinh có link vẫn xem được; nếu để \"Riêng tư\", học sinh sẽ không xem được." };
  }
  if ((hostMatches(host, "youtube.com") || hostMatches(host, "youtu.be")) && u.searchParams.get("list") && !u.searchParams.get("v"))
    return invalid("Đây là link danh sách phát YouTube. Hãy dán link của MỘT video.", url);
  if (hostMatches(host, "youtube.com") || hostMatches(host, "youtu.be") || hostMatches(host, "youtube-nocookie.com"))
    return invalid("Link YouTube này chưa trỏ tới một video cụ thể (thiếu mã video). Mở video rồi bấm Chia sẻ để lấy link.", url);

  // ── Vimeo ──
  if (hostMatches(host, "vimeo.com")) {
    const parts = u.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    let hash: string | null = null;
    if (hostMatches(host, "player.vimeo.com") && parts[0] === "video") { id = parts[1] ?? null; hash = u.searchParams.get("h"); }
    else {
      const idx = parts.findIndex(p => VIMEO_ID.test(p));
      if (idx >= 0) { id = parts[idx]; const nxt = parts[idx + 1]; if (nxt && VIMEO_HASH.test(nxt)) hash = nxt; }
      if (!hash) hash = u.searchParams.get("h");
    }
    if (id && VIMEO_ID.test(id)) {
      const h = hash && VIMEO_HASH.test(hash) ? hash : null;
      return { ok: true, kind: "vimeo", label: "Vimeo", url, embedUrl: `https://player.vimeo.com/video/${id}${h ? `?h=${h}` : ""}`, id, vimeoHash: h,
        suggestedType: "record", error: null, warning: null };
    }
    return invalid("Link Vimeo này chưa trỏ tới một video cụ thể.", url);
  }

  // ── Google Drive / Docs ──
  if (hostMatches(host, "drive.google.com")) {
    const fid = driveFileId(u);
    if (fid) return { ok: true, kind: "drive", label: "Google Drive", url, embedUrl: `https://drive.google.com/file/d/${fid}/preview`, id: fid, vimeoHash: null,
      suggestedType: "record", error: null,
      warning: "Trên Drive, hãy chia sẻ \"Bất kỳ ai có liên kết\" hoặc thêm email học sinh. Drive có thể giới hạn lượt xem khi nhiều em mở cùng lúc." };
    if (/^\/drive\/(u\/\d+\/)?folders\//.test(u.pathname) || u.pathname.split("/")[1] === "folders")
      return { ok: true, kind: "drive_folder", label: "Thư mục Google Drive", url, embedUrl: null, id: null, vimeoHash: null, suggestedType: "document", error: null,
        warning: "Đây là thư mục, không phải một video hay một tệp. Học sinh sẽ mở thư mục ở tab mới." };
    return invalid("Link Google Drive này chưa trỏ tới một tệp cụ thể. Mở tệp trên Drive, bấm Chia sẻ rồi sao chép link.", url);
  }
  if (hostMatches(host, "docs.google.com")) {
    const m = /^\/(document|spreadsheets|presentation)\/d\/([^/]+)/.exec(u.pathname);
    if (m && DRIVE_ID.test(m[2]))
      return { ok: true, kind: "google_doc", label: "Google Tài liệu", url, embedUrl: `https://docs.google.com/${m[1]}/d/${m[2]}/preview`, id: m[2], vimeoHash: null,
        suggestedType: "document", error: null, warning: "Nhớ chia sẻ \"Bất kỳ ai có liên kết\" ở quyền Xem, nếu không học sinh sẽ không mở được." };
    return invalid("Link Google Docs này chưa trỏ tới một tài liệu cụ thể.", url);
  }

  // ── Zoom ──
  if (hostMatches(host, "zoom.us")) {
    if (/^\/rec\/(share|play|component)\//.test(u.pathname))
      return { ok: true, kind: "zoom_record", label: "Bản ghi Zoom", url, embedUrl: null, id: null, vimeoHash: null, suggestedType: "record", error: null,
        warning: "Bản ghi Zoom không nhúng vào KiN được, học sinh sẽ mở ở tab mới. Nếu bản ghi có mật mã, hãy gửi mật mã cho học sinh." };
    if (/^\/(j|s|wc\/join|my)\//.test(u.pathname) || /^\/wc\/\d+/.test(u.pathname))
      return { ok: true, kind: "zoom_live", label: "Phòng Zoom", url, embedUrl: null, id: null, vimeoHash: null, suggestedType: "live", error: null, warning: null };
    return invalid("Link Zoom này chưa đúng dạng phòng học (…/j/số) hay bản ghi (…/rec/share/…).", url);
  }

  // ── Azota ──
  if (hostMatches(host, "azota.vn")) return { ok: true, kind: "azota", label: "Azota", url, embedUrl: null, id: null, vimeoHash: null, suggestedType: "quiz", error: null, warning: null };

  // ── nguồn khác ──
  return { ok: true, kind: "other", label: host.replace(/^www\./, ""), url, embedUrl: null, id: null, vimeoHash: null, suggestedType: null, error: null,
    warning: "KiN chưa nhúng được link từ trang này; học sinh sẽ mở ở tab mới." };
}

export interface SlotCheck {
  ok: boolean;
  error: string | null;
  warning: string | null;
  info: MediaLinkInfo | null;
  /** Gợi ý chuyển link sang ô đúng (khi dán nhầm ô). */
  moveTo: MediaSlot | null;
}

const SLOT_NAME: Record<MediaSlot, string> = { video: "Video bài giảng", live: "Phòng Zoom (bài trực tiếp)", azota: "Bài tập Azota", document: "Tài liệu" };

/** Kiểm một link theo Ô đang dán. Rỗng = hợp lệ (ô để trống). */
export function checkLinkForSlot(raw: string | null | undefined, slot: MediaSlot): SlotCheck {
  if (!(raw ?? "").trim()) return { ok: true, error: null, warning: null, info: null, moveTo: null };
  const info = classifyMediaLink(raw);
  if (!info.ok) return { ok: false, error: info.error, warning: null, info, moveTo: null };

  const wrong = (to: MediaSlot, what: string): SlotCheck => ({
    ok: false, info, moveTo: to, warning: null,
    error: `Đây là ${what}. Hãy dán vào ô "${SLOT_NAME[to]}", không phải ô "${SLOT_NAME[slot]}".`,
  });

  if (slot === "video") {
    if (info.kind === "azota") return wrong("azota", "link Azota");
    if (info.kind === "zoom_live") return wrong("live", "link phòng Zoom");
    if (info.kind === "google_doc") return wrong("document", "link tài liệu Google");
    if (info.kind === "drive_folder") return { ok: false, info, moveTo: "document", warning: null, error: "Đây là thư mục Drive, không phải một video. Hãy mở video trong thư mục và dán link của riêng video đó." };
    if (info.kind === "other") {
      const host = info.label;
      const social = /(^|\.)(facebook|fb|tiktok|instagram|twitter|x)\.(com|watch)$/i.test(host) || /^fb\.watch$/i.test(host);
      return { ok: false, info, moveTo: null, warning: null,
        error: social
          ? `KiN không nhúng được video từ ${host}. Hãy đưa video lên YouTube (chọn "Không công khai") hoặc Google Drive rồi dán link đó.`
          : `KiN chưa nhúng được link từ ${host}. Dùng link YouTube, Vimeo hoặc Google Drive, hoặc tải video lên.` };
    }
    return { ok: true, error: null, warning: info.warning, info, moveTo: null };
  }
  if (slot === "live") {
    if (info.kind === "zoom_live") return { ok: true, error: null, warning: null, info, moveTo: null };
    if (info.kind === "zoom_record") return wrong("video", "bản ghi Zoom (xem lại sau buổi học)");
    if (info.kind === "youtube" || info.kind === "vimeo" || info.kind === "drive") return wrong("video", "link video");
    if (info.kind === "azota") return wrong("azota", "link Azota");
    if (info.kind === "other") return { ok: true, error: null, warning: "Chưa nhận ra đây là phòng Zoom; học sinh sẽ mở link này ở tab mới.", info, moveTo: null };
    return { ok: false, error: "Ô này dành cho link phòng Zoom.", warning: null, info, moveTo: null };
  }
  if (slot === "azota") {
    if (info.kind === "azota") return { ok: true, error: null, warning: null, info, moveTo: null };
    if (info.kind === "youtube" || info.kind === "vimeo" || info.kind === "drive" || info.kind === "zoom_record") return wrong("video", "link video");
    if (info.kind === "zoom_live") return wrong("live", "link phòng Zoom");
    return { ok: true, error: null, warning: "Link này không phải của Azota (azota.vn); học sinh vẫn mở được ở tab mới.", info, moveTo: null };
  }
  // document
  if (info.kind === "youtube" || info.kind === "vimeo") return wrong("video", "link video");
  if (info.kind === "zoom_live") return wrong("live", "link phòng Zoom");
  if (info.kind === "azota") return wrong("azota", "link Azota");
  return { ok: true, error: null, warning: info.warning, info, moveTo: null };
}

/** Kiểm cả danh sách trong một ô, trả lỗi ĐẦU TIÊN kèm số thứ tự để báo "Link thứ 2: …". */
export function checkLinkListForSlot(urls: string[], slot: MediaSlot): { ok: boolean; error: string | null } {
  const real = urls.map(u => u.trim()).filter(Boolean);
  if (real.length > MAX_LINKS) return { ok: false, error: `Tối đa ${MAX_LINKS} link trong một ô.` };
  for (let i = 0; i < real.length; i++) {
    const r = checkLinkForSlot(real[i], slot);
    if (!r.ok) return { ok: false, error: real.length > 1 ? `Link thứ ${i + 1}: ${r.error}` : r.error };
  }
  return { ok: true, error: null };
}

/** Gợi ý loại bài từ các link đã dán (video > live > azota > tài liệu). Mảng rỗng → "document". */
export function suggestLessonTypes(o: { video?: string[]; live?: string[]; azota?: string[] }): SuggestedLessonType[] {
  const out: SuggestedLessonType[] = [];
  if ((o.video ?? []).some(u => u.trim())) out.push("record");
  if ((o.live ?? []).some(u => u.trim())) out.push("live");
  if ((o.azota ?? []).some(u => u.trim())) out.push("quiz");
  return out.length ? out : ["document"];
}

// ── Danh sách link lưu trong MỘT cột chuỗi ──────────────────────────────────

/** Cột videoUrl/zoomUrl/azotaUrl là chuỗi, hoặc chuỗi JSON mảng khi có từ 2 link. Trả luôn mảng sạch. */
export function parseLinkList(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const arr: unknown = JSON.parse(s);
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean).slice(0, MAX_LINKS);
    } catch { /* không phải JSON: rơi xuống nhánh chuỗi thường */ }
  }
  return [s];
}

export function serializeLinkList(urls: string[]): string | null {
  const f = urls.map(u => u.trim()).filter(Boolean).slice(0, MAX_LINKS);
  if (!f.length) return null;
  return f.length === 1 ? f[0] : JSON.stringify(f);
}

/** Link ĐẦU TIÊN mở được bằng web (https) của một cột; dùng cho nút "Làm bài", "Vào Zoom". */
export function firstSafeHttpsLink(raw: string | null | undefined): string | null {
  for (const l of parseLinkList(raw)) {
    const info = classifyMediaLink(l);
    if (info.ok && info.kind !== "upload" && info.kind !== "invalid") return info.url;
  }
  return null;
}

/** Video đầu tiên đọc được của một bài (bỏ qua link hỏng), kèm thông tin trình phát. */
export function firstPlayableVideo(raw: string | null | undefined): MediaLinkInfo | null {
  for (const l of parseLinkList(raw)) {
    const info = classifyMediaLink(l);
    if (info.ok && ["youtube", "vimeo", "drive", "upload", "zoom_record", "other"].includes(info.kind)) return info;
  }
  return null;
}

// ── Hạn nộp Azota ───────────────────────────────────────────────────────────

/** `azotaDeadline` lưu chuỗi tự do: "2026-10-23T18:30" (ô datetime-local), "2026-10-23", "23/10/2026". Trả mốc giờ Việt Nam hoặc null. */
export function parseDeadlineVn(raw: string | null | undefined): Date | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  let y: number, mo: number, d: number, h = 23, mi = 59;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; if (m[4]) { h = +m[4]; mi = +m[5]; } }
  else {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s);
    if (!m) return null;
    d = +m[1]; mo = +m[2]; y = +m[3]; if (m[4]) { h = +m[4]; mi = +m[5]; }
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const t = Date.UTC(y, mo - 1, d, h - 7, mi); // giờ Việt Nam = UTC+7
  const back = new Date(t + 7 * 3600_000);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null; // 31/02...
  return new Date(t);
}

// ── Ghi chú theo mốc thời gian ──────────────────────────────────────────────
// Ghi chú vẫn là MỘT chuỗi văn bản (LessonNote.text). Mỗi dòng bắt đầu bằng "[m:ss]" hoặc "[h:mm:ss]" là một mốc bấm được.

export function formatStamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function parseStamp(text: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = m[1] ? +m[1] : 0, mi = +m[2], sec = +m[3];
  if (sec > 59 || (m[1] && mi > 59)) return null;
  return h * 3600 + mi * 60 + sec;
}

export interface NoteStamp { seconds: number; stamp: string; text: string; line: number }

export function extractNoteStamps(note: string | null | undefined): NoteStamp[] {
  const out: NoteStamp[] = [];
  (note ?? "").split("\n").forEach((ln, line) => {
    const m = /^\s*\[(\d{1,3}(?::\d{2}){1,2})\]\s?(.*)$/.exec(ln);
    if (!m) return;
    const seconds = parseStamp(m[1]);
    if (seconds !== null) out.push({ seconds, stamp: formatStamp(seconds), text: m[2], line });
  });
  return out;
}

/** Thêm một dòng mốc ở cuối ghi chú (xuống dòng nếu ghi chú đang có chữ). */
export function appendStampLine(note: string, seconds: number): string {
  const base = note.replace(/\s+$/, "");
  return `${base}${base ? "\n" : ""}[${formatStamp(seconds)}] `;
}

// ── Xem trước tài liệu ──────────────────────────────────────────────────────

export type PreviewMode = "iframe" | "image" | "external" | "none";
export interface PreviewPlan {
  mode: PreviewMode;
  /** Địa chỉ để nhúng (iframe/img) hoặc để mở tab mới (external). */
  src: string | null;
  /** Địa chỉ để bấm "Tải về"; null nếu nguồn không cho tải trực tiếp (Google Docs...). */
  downloadHref: string | null;
  /** Có dùng `sandbox` cho iframe không (PDF trong khung sandbox bị Chrome chặn nên PDF không dùng). */
  sandbox: boolean;
  /** Chữ giải thích bằng tiếng Việt khi không xem trước được. */
  reason: string | null;
  ext: string | null;
}

const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const TEXT_EXTS = new Set(["txt"]);

export function fileExtOf(url: string): string | null {
  const clean = url.split(/[?#]/)[0];
  const last = clean.split("/").pop() ?? "";
  if (!last.includes(".")) return null;
  const ext = last.split(".").pop()!.toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : null;
}

/**
 * Quyết định cách xem trước một tài liệu. CHỈ nhúng nguồn tin cậy: Cloudinary của KiN, Google Docs/Drive, hoặc đường dẫn nội bộ /api/media.
 * Mọi nguồn khác chỉ cho "mở ở tab mới" (không bao giờ đặt địa chỉ lạ vào iframe).
 */
export function planDocumentPreview(rawUrl: string | null | undefined): PreviewPlan {
  const none = (reason: string): PreviewPlan => ({ mode: "none", src: null, downloadHref: null, sandbox: true, reason, ext: null });
  const raw = (rawUrl ?? "").trim();
  if (!raw) return none("Thiếu đường dẫn tài liệu.");

  // Đường dẫn nội bộ: chỉ /api/media/<mã>/... (video/tệp KiN lưu). Không nhận "//host" hay "/\host".
  if (raw.startsWith("/")) {
    if (/^\/api\/media\/[A-Za-z0-9_-]{8,40}\/(stream|file)$/.test(raw))
      return { mode: "external", src: raw, downloadHref: raw, sandbox: true, reason: "Tệp này lưu trên KiN.", ext: null };
    return none("Đường dẫn tài liệu không hợp lệ.");
  }

  const n = normalise(raw);
  if (!n.url) return none(n.error ?? "Đường dẫn tài liệu không hợp lệ.");
  const u = n.url, url = n.text, host = u.hostname;
  const ext = fileExtOf(url);

  if (hostMatches(host, "docs.google.com") || hostMatches(host, "drive.google.com")) {
    const info = classifyMediaLink(url);
    if (info.ok && info.embedUrl) return { mode: "iframe", src: info.embedUrl, downloadHref: null, sandbox: true, reason: null, ext };
    return { mode: "external", src: url, downloadHref: null, sandbox: true, reason: "Link Google này không xem trước được trong KiN. Bấm để mở ở tab mới.", ext };
  }

  if (host === "res.cloudinary.com") {
    if (ext === "pdf") return { mode: "iframe", src: url, downloadHref: url, sandbox: false, reason: null, ext };
    if (ext && IMAGE_EXTS.has(ext)) return { mode: "image", src: url, downloadHref: url, sandbox: true, reason: null, ext };
    if (ext && TEXT_EXTS.has(ext)) return { mode: "iframe", src: url, downloadHref: url, sandbox: true, reason: null, ext };
    if (ext && OFFICE_EXTS.has(ext))
      return { mode: "iframe", src: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`, downloadHref: url, sandbox: true, reason: null, ext };
    return { mode: "external", src: url, downloadHref: url, sandbox: true, reason: "Loại tệp này không xem trước được. Bạn có thể tải về.", ext };
  }

  return { mode: "external", src: url, downloadHref: null, sandbox: true,
    reason: `Tài liệu nằm trên ${host.replace(/^www\./, "")}, KiN không xem trước ở đây. Bấm để mở ở tab mới.`, ext };
}

// ── Học sinh dán link bài làm Azota ─────────────────────────────────────────
// CHỈ nhận LINK dạng chữ. Không nhận ảnh bài làm của học sinh (em dưới 16: chưa có ý kiến pháp lý, xem HIEN-CO-VA-DINH-VI.md mục 6.2).

export function validateWorkLink(raw: string | null | undefined): { ok: boolean; url: string | null; error: string | null } {
  const text = (raw ?? "").trim();
  if (!text) return { ok: false, url: null, error: "Chưa dán link bài làm." };
  if (text.length > 500) return { ok: false, url: null, error: "Link quá dài." };
  const n = normalise(text);
  if (!n.url) return { ok: false, url: null, error: n.error ?? "Link chưa đúng." };
  if (!hostMatches(n.url.hostname, "azota.vn")) return { ok: false, url: null, error: "Chỉ nhận link bài làm từ Azota (azota.vn). KiN không nhận ảnh bài làm." };
  const ext = fileExtOf(n.text);
  if (ext && (IMAGE_EXTS.has(ext) || ext === "heic" || ext === "bmp" || ext === "svg")) return { ok: false, url: null, error: "KiN không nhận ảnh bài làm. Hãy dán link bài làm trên Azota." };
  return { ok: true, url: n.text, error: null };
}
