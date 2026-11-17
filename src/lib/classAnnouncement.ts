// TB-LOP (17/11/2026) — "Thông báo lớp": tin MỘT CHIỀU gia sư chủ lớp gửi cả lớp. Phần THUẦN (không DB, không React): làm sạch nội dung, mã kết quả của
// form, chữ thông báo trong ứng dụng, thứ tự hiển thị, tách link để hiện thành <a>, giờ đăng theo giờ Việt Nam. Kiểm từng hàm ở tools/local-e2e/t-class-announce-lib.ts.
// Phần ghi (DB + gửi thông báo) ở src/lib/classAnnouncementServer.ts.

export const ANNOUNCE_BODY_MAX = 1500;
/** Số tin tối đa một lớp đăng trong 24 giờ (tính cả tin đã gỡ) — chặn gửi dồn thông báo cho học sinh. */
export const ANNOUNCE_DAILY_LIMIT = 10;
/** Số tin được ghim cùng lúc. */
export const ANNOUNCE_PIN_MAX = 3;
/** Số tin hiện trên trang (mới nhất, tin ghim lên đầu). */
export const ANNOUNCE_LIST_LIMIT = 50;
export const ANNOUNCE_NOTICE_TYPE = "class_announcement";

export type AnnounceCode = "ok" | "trong" | "dai" | "nhieu" | "ghim-day" | "ghim" | "bo-ghim" | "xoa" | "khong-co" | "loi";

/** Chữ cho dải báo sau khi gửi form (?tb=<mã>). Mã lạ → null (không hiện gì). */
export const ANNOUNCE_MESSAGES: Record<AnnounceCode, { tone: "ok" | "err"; text: string }> = {
  ok:         { tone: "ok",  text: "Đã đăng thông báo. Học sinh của lớp sẽ thấy tin ở tab Thông báo của lớp." },
  trong:      { tone: "err", text: "Cô chưa viết nội dung thông báo." },
  dai:        { tone: "err", text: `Thông báo dài quá ${ANNOUNCE_BODY_MAX} ký tự. Cô rút gọn giúp nhé.` },
  nhieu:      { tone: "err", text: `Lớp đã đăng ${ANNOUNCE_DAILY_LIMIT} thông báo trong 24 giờ qua. Cô đợi thêm rồi đăng tiếp.` },
  "ghim-day": { tone: "err", text: `Đã ghim đủ ${ANNOUNCE_PIN_MAX} thông báo. Cô bỏ ghim một tin trước.` },
  ghim:       { tone: "ok",  text: "Đã ghim thông báo lên đầu." },
  "bo-ghim":  { tone: "ok",  text: "Đã bỏ ghim." },
  xoa:        { tone: "ok",  text: "Đã gỡ thông báo. Học sinh không còn thấy tin này." },
  "khong-co": { tone: "err", text: "Không tìm thấy thông báo này (có thể đã gỡ)." },
  loi:        { tone: "err", text: "Chưa lưu được, cô thử lại sau." },
};

export function announceMessage(code: unknown): { tone: "ok" | "err"; text: string } | null {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(ANNOUNCE_MESSAGES, code) ? ANNOUNCE_MESSAGES[code as AnnounceCode] : null;
}

/**
 * Làm sạch nội dung: chuỗi bắt buộc; \r\n → \n; bỏ ký tự điều khiển (trừ xuống dòng và tab) và ký tự đảo hướng chữ (U+200E/F, U+202A–202E, U+2066–2069); bỏ khoảng trắng cuối từng dòng; tối đa 2 dòng trống liền nhau;
 * cắt khoảng trắng đầu/cuối. Rỗng → "trong"; dài hơn ANNOUNCE_BODY_MAX (đếm theo ký tự, không theo byte) → "dai".
 */
export function cleanAnnouncementBody(raw: unknown): { ok: true; body: string } | { ok: false; code: "trong" | "dai" } {
  if (typeof raw !== "string") return { ok: false, code: "trong" };
  let s = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‎‏‪-‮⁦-⁩]/g, ""); // + ký tự đảo hướng chữ (làm chữ link trông khác đích thật)
  s = s.split("\n").map(l => l.replace(/[ \t]+$/g, "")).join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (!s) return { ok: false, code: "trong" };
  if ([...s].length > ANNOUNCE_BODY_MAX) return { ok: false, code: "dai" };
  return { ok: true, body: s };
}

/** Ô "Ghim lên đầu" của form: "on" / "1" / "true" / true → true; còn lại false. */
export const parsePinned = (raw: unknown): boolean => raw === true || raw === "on" || raw === "1" || raw === "true";

/** Đường học sinh mở từ thông báo: trang lớp, tab Thông báo. */
export const announceLink = (courseId: string): string => `/student/hoc-tap?course=${encodeURIComponent(courseId)}&tab=thong-bao`;

/** Thông báo trong ứng dụng cho học sinh: KHÔNG chép nội dung tin (có thể có tên / số điện thoại), không tên gia sư — chỉ tên lớp để em biết lớp nào. */
export function announceNotice(courseId: string, courseName: string): { type: string; title: string; message: string; link: string } {
  const name = courseName.trim().slice(0, 80);
  // Tên lớp hay bắt đầu bằng "Lớp …" ("Lớp Toán 9A") — không viết "Lớp Lớp Toán 9A".
  const who = !name ? "Lớp của bạn" : /^lớp(\s|$)/i.test(name) ? name : `Lớp ${name}`;
  return { type: ANNOUNCE_NOTICE_TYPE, title: "Thông báo mới của lớp", message: `${who} có thông báo mới từ gia sư. Bấm để xem.`, link: announceLink(courseId) };
}

/** Tin ghim lên đầu, rồi mới nhất trước; bằng nhau thì theo id để thứ tự ổn định. */
export function sortAnnouncements<T extends { id: string; pinned: boolean; createdAt: Date | string }>(rows: T[]): T[] {
  const t = (d: Date | string) => (d instanceof Date ? d.getTime() : Date.parse(d));
  return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || t(b.createdAt) - t(a.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export type AnnouncePart = { kind: "text"; text: string } | { kind: "link"; href: string; text: string };

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
const TRAIL_RE = /[.,;:!?)\]}'"»”]+$/;

/**
 * Tách nội dung thành đoạn chữ và link (chỉ http/https, có tên máy chủ, không tài khoản trong địa chỉ). Dấu câu dính cuối link ("…/abc).") trả về phần chữ.
 * Chuỗi khác (javascript:, data:, www. không có giao thức) giữ nguyên là chữ. Trang hiện chữ bằng React (tự thoát HTML) nên không có đường chèn mã.
 */
export function linkParts(text: string): AnnouncePart[] {
  const out: AnnouncePart[] = [];
  let last = 0;
  const push = (s: string) => { if (!s) return; const p = out[out.length - 1]; if (p && p.kind === "text") p.text += s; else out.push({ kind: "text", text: s }); };
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    let trail = TRAIL_RE.exec(url)?.[0] ?? "";
    // Giữ ")" thuộc về link khi ngoặc trong link cân (https://vi.wikipedia.org/wiki/Foo_(bar)); chỉ cắt ")" thừa.
    while (trail.startsWith(")") && (url.slice(0, url.length - trail.length).split("(").length - 1) > (url.slice(0, url.length - trail.length).split(")").length - 1)) trail = trail.slice(1);
    if (trail) url = url.slice(0, url.length - trail.length);
    push(text.slice(last, start));
    let okUrl = false;
    try { const u = new URL(url); okUrl = (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname && !u.username && !u.password && url.length <= 2048; } catch { okUrl = false; }
    if (okUrl) out.push({ kind: "link", href: url, text: url }); else push(url);
    push(trail);
    last = start + m[0].length;
  }
  push(text.slice(last));
  return out;
}

const VN = "Asia/Ho_Chi_Minh";
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: VN, ...o }).format(d);
const dayKey = (d: Date) => fmt(d, { year: "numeric", month: "2-digit", day: "2-digit" }); // dd/mm/yyyy

/** Giờ đăng theo giờ Việt Nam: "Hôm nay · 19:05", "Hôm qua · 08:00", cùng năm "05/11 · 08:00", khác năm "05/11/2025 · 08:00". */
export function announceTime(at: Date | string, now: Date = new Date()): string {
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const hm = fmt(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const k = dayKey(d);
  if (k === dayKey(now)) return `Hôm nay · ${hm}`;
  if (k === dayKey(new Date(now.getTime() - 86_400_000))) return `Hôm qua · ${hm}`;
  return `${k.slice(6) === dayKey(now).slice(6) ? k.slice(0, 5) : k} · ${hm}`;
}
