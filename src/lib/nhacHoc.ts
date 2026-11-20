// LOI-04 — "Nhắc học" của học sinh (kiểu Reminders): ghi chú riêng, #thẻ, hẹn ngày/giờ, "Xong". PHẦN THUẦN (không Prisma, không Next, không React).
// Dùng chung cho máy chủ (src/lib/nhacHocServer.ts, /api/student/nhac-hoc/**, cron nhac-hoc-sang) và giao diện ⇒ nhóm "Hôm nay"/"Quá hạn" không thể tính lệch nhau.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-04.md mục 4.1. Test: tools/local-e2e/t-nhac-hoc-lib.ts (chạy với TZ=UTC và TZ=America/Los_Angeles).
//
// Ngày giờ: giờ Việt Nam = UTC+7 cố định, cộng/trừ mili giây như classSessions — KHÔNG getHours()/getDate()/toDateString()/Intl.
// Ghi chú là dữ liệu cá nhân của học sinh: không vào thông báo, không vào log, không gửi AI. Hai hàm chữ thông báo cuối tệp chỉ nhận SỐ.
import { vnDateKeyOf, addDaysKey, instantOf, isValidDateKey, parseHm, hmOf } from "@/lib/classSessions";
import { vnTimeHHmm, vnDayTitle, type HomNayResp } from "@/lib/studentLop";

export const NHAC_TITLE_MAX = 200, NHAC_NOTE_MAX = 4000, NHAC_TAGS_MAX = 10, NHAC_TAG_LEN_MAX = 30, NHAC_MAX_PER_USER = 500;
export const NHAC_BODY_MAX_BYTES = 20_000, NHAC_PAST_DAYS = 366, NHAC_FUTURE_DAYS = 731;
export const NHAC_HREF = "/student/nhac-hoc";

// Chữ lỗi dùng chung (route + test so khớp đúng chữ).
export const NHAC_ATTACH_ERROR = "Bài hoặc lớp này không thuộc lớp bạn đang học.";
export const NHAC_NOT_FOUND_ERROR = "Không tìm thấy nhắc việc này.";
export const NHAC_FULL_ERROR = `Đã đủ ${NHAC_MAX_PER_USER} nhắc việc. Hãy xoá bớt mục đã xong rồi thêm.`;
export const NHAC_TOO_BIG_ERROR = "Nội dung quá dài. Hãy rút gọn ghi chú rồi lưu lại.";
export const NHAC_BAD_JSON_ERROR = "Dữ liệu không đúng dạng.";

export interface NhacLop { courseId: string; courseName: string; lessonId: string | null; lessonTitle: string | null; href: string } // href: lessonHref hoặc /student/hoc-tap?course=
export interface NhacItem {
  id: string; title: string; note: string | null; tags: string[]; dueAt: string | null; dueHasTime: boolean;
  dueDate: string | null /* "YYYY-MM-DD" VN */; dueTime: string | null /* "HH:mm" VN, null khi !dueHasTime */; doneAt: string | null; lop: NhacLop | null; createdAt: string;
}
export interface NhacResp { now: string; todayKey: string; items: NhacItem[]; lop: HomNayResp; used: number; max: number }

/** Kết quả làm sạch thân POST. `doneAt`/`notifiedAt`/`userId` không bao giờ có ở đây (máy chủ tự đặt). */
export interface NhacCreate {
  title: string; note: string | null; tags: string[];
  dueAt: Date | null; dueHasTime: boolean;
  courseId: string | null; lessonId: string | null;
}
/** Kết quả làm sạch thân PATCH: chỉ khoá nào có mặt trong thân. Ngày/giờ hợp với giá trị cũ bằng `mergeDue`. */
export interface NhacPatch {
  title?: string; note?: string | null; tags?: string[];
  dueDate?: string | null; dueTime?: string | null;
  done?: boolean;
  courseId?: string | null; lessonId?: string | null;
}

// ── Làm sạch chữ (cùng mẫu oneLine/multiLine của personalEvents.ts:22-23) ────────

/** Bỏ ký tự điều khiển, gộp khoảng trắng, một dòng. */
const oneLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");
/** Giữ đổi dòng, bỏ ký tự điều khiển khác, gộp ≥3 dòng trống. */
const multiLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim() : "");
const len = (s: string) => Array.from(s).length;

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// ── Thẻ ─────────────────────────────────────────────────────────────────────────

const TAG_RE = /^[\p{L}\p{N}_-]+$/u;

/** "#Toán" | "toán" → "toán": NFC, bỏ # đầu, trim, toLocaleLowerCase("vi"); chỉ [\p{L}\p{N}_-]; rỗng/ký tự lạ/>30 → null. */
export function normalizeTag(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.normalize("NFC").trim().replace(/^#+/, "").trim().toLocaleLowerCase("vi").normalize("NFC");
  if (!t || len(t) > NHAC_TAG_LEN_MAX || !TAG_RE.test(t)) return null;
  return t;
}

/** Mảng thẻ từ JSON (không tin): khử trùng sau chuẩn hoá, giữ thứ tự; phần tử hỏng/>10 thẻ → lỗi tiếng Việt nói rõ. undefined/null → []. */
export function cleanTags(raw: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Thẻ không đúng dạng." };
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = typeof raw[i] === "string" ? normalizeTag(raw[i] as string) : null;
    // Không nhắc lại chữ thô trong lỗi (thẻ hỏng có thể là mã HTML).
    if (t === null) return { ok: false, error: `Thẻ thứ ${i + 1} không hợp lệ: chỉ dùng chữ, số, "-" hoặc "_", tối đa ${NHAC_TAG_LEN_MAX} ký tự.` };
    if (!out.includes(t)) out.push(t);
    if (out.length > NHAC_TAGS_MAX) return { ok: false, error: `Tối đa ${NHAC_TAGS_MAX} thẻ cho một nhắc việc.` };
  }
  return { ok: true, value: out };
}

/** Thêm nhanh: "Ôn chương 2 #toan #on-thi" → { title: "Ôn chương 2", tags: ["toan","on-thi"] }. Thẻ = "#" sau đầu chuỗi/khoảng trắng.
 *  Cụm "#…" không thành thẻ hợp lệ (vd "#" trơn, "#<b>") được giữ nguyên trong tiêu đề. Thẻ khử trùng, giữ thứ tự; chưa giới hạn số (cleanTags lo). */
export function splitQuickTitle(text: string): { title: string; tags: string[] } {
  const src = oneLine(text);
  const tags: string[] = [];
  const kept: string[] = [];
  for (const word of src.split(" ")) {
    if (word.startsWith("#")) {
      const t = normalizeTag(word);
      if (t !== null) { if (!tags.includes(t)) tags.push(t); continue; }
    }
    if (word) kept.push(word);
  }
  return { title: kept.join(" ").trim(), tags };
}

// ── Ngày giờ hẹn ────────────────────────────────────────────────────────────────

/** Ngày+giờ VN → mốc. Không giờ ⇒ instantOf(dateKey, 0), dueHasTime=false. */
export function dueOf(dateKey: string, time: string | null): { dueAt: Date; dueHasTime: boolean } {
  const m = time === null ? null : parseHm(time);
  return { dueAt: instantOf(dateKey, m ?? 0), dueHasTime: m !== null };
}

type DueField = { ok: true; value: string | null } | { ok: false; error: string };

function cleanDueDate(v: unknown, todayKey: string): DueField {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: "Ngày hẹn chưa đúng." };
  const k = v.trim();
  if (!isValidDateKey(k)) return { ok: false, error: "Ngày hẹn chưa đúng." };
  if (k < addDaysKey(todayKey, -NHAC_PAST_DAYS)) return { ok: false, error: "Ngày hẹn quá xa trong quá khứ (chỉ nhận trong vòng 1 năm trở lại)." };
  if (k > addDaysKey(todayKey, NHAC_FUTURE_DAYS)) return { ok: false, error: "Ngày hẹn quá xa trong tương lai (chỉ nhận trong vòng 2 năm tới)." };
  return { ok: true, value: k };
}

function cleanDueTime(v: unknown): DueField {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const m = typeof v === "string" ? parseHm(v) : null;
  if (m === null) return { ok: false, error: "Giờ hẹn chưa đúng (dạng 19:30)." };
  return { ok: true, value: hmOf(m) };
}

const TIME_NEEDS_DATE = "Có giờ hẹn thì cần chọn ngày.";

/** Hợp ngày/giờ trong PATCH với giá trị đang lưu. Khoá vắng mặt ⇒ giữ cũ; dueDate: null ⇒ bỏ hẹn (kể cả giờ).
 *  `changed` = mốc hoặc dueHasTime khác trước ⇒ máy chủ đặt notifiedAt = null. */
export function mergeDue(
  cur: { dueAt: Date | null; dueHasTime: boolean },
  p: Pick<NhacPatch, "dueDate" | "dueTime">,
): { ok: true; dueAt: Date | null; dueHasTime: boolean; changed: boolean } | { ok: false; error: string } {
  const touched = hasOwn(p, "dueDate") || hasOwn(p, "dueTime");
  if (!touched) return { ok: true, dueAt: cur.dueAt, dueHasTime: cur.dueHasTime, changed: false };
  const curDate = cur.dueAt ? vnDateKeyOf(cur.dueAt) : null;
  const curTime = cur.dueAt && cur.dueHasTime ? vnTimeHHmm(cur.dueAt) : null;
  const date = hasOwn(p, "dueDate") ? (p.dueDate ?? null) : curDate;
  // Xoá ngày mà không gửi giờ ⇒ giờ cũng bỏ (không có giờ treo không ngày).
  const time = hasOwn(p, "dueTime") ? (p.dueTime ?? null) : date === null ? null : curTime;
  if (date === null && time !== null) return { ok: false, error: TIME_NEEDS_DATE };
  const next = date === null ? { dueAt: null, dueHasTime: false } : dueOf(date, time);
  const changed = (next.dueAt?.getTime() ?? null) !== (cur.dueAt?.getTime() ?? null) || next.dueHasTime !== cur.dueHasTime;
  return { ok: true, dueAt: next.dueAt, dueHasTime: next.dueHasTime, changed };
}

// ── Gắn lớp/bài: chỉ kiểm DẠNG id (quyền kiểm ở máy chủ, checkAttach) ─────────────

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function cleanId(v: unknown): DueField {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  // id sai dạng ⇒ cùng chữ lỗi với "không thuộc lớp" (không lộ gì khác).
  if (typeof v !== "string" || !ID_RE.test(v.trim())) return { ok: false, error: NHAC_ATTACH_ERROR };
  return { ok: true, value: v.trim() };
}

function cleanNote(v: unknown): DueField {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: "Ghi chú không đúng dạng." };
  const n = multiLine(v);
  if (len(n) > NHAC_NOTE_MAX) return { ok: false, error: `Ghi chú tối đa ${NHAC_NOTE_MAX} ký tự.` };
  return { ok: true, value: n || null };
}

function checkTitleLen(title: string): string | null {
  if (!title) return "Chưa có tiêu đề.";
  if (len(title) > NHAC_TITLE_MAX) return `Tiêu đề tối đa ${NHAC_TITLE_MAX} ký tự.`;
  return null;
}

/** Tạo (POST): title (đã tách #thẻ, gộp với body.tags), note?, tags?, dueDate?, dueTime? (cần dueDate), courseId?, lessonId?. */
export function cleanNhacCreate(raw: unknown, todayKey: string): { ok: true; value: NhacCreate } | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: NHAC_BAD_JSON_ERROR };
  if (raw.title !== undefined && raw.title !== null && typeof raw.title !== "string") return { ok: false, error: "Chưa có tiêu đề." };
  const split = splitQuickTitle(typeof raw.title === "string" ? raw.title : "");
  const titleErr = checkTitleLen(split.title);
  if (titleErr) return { ok: false, error: titleErr };

  if (raw.tags !== undefined && raw.tags !== null && !Array.isArray(raw.tags)) return { ok: false, error: "Thẻ không đúng dạng." };
  const tags = cleanTags([...split.tags, ...((raw.tags as unknown[] | null | undefined) ?? [])]);
  if (!tags.ok) return tags;

  const note = cleanNote(raw.note);
  if (!note.ok) return note;

  const date = cleanDueDate(raw.dueDate, todayKey);
  if (!date.ok) return date;
  const time = cleanDueTime(raw.dueTime);
  if (!time.ok) return time;
  if (time.value !== null && date.value === null) return { ok: false, error: TIME_NEEDS_DATE };

  const courseId = cleanId(raw.courseId);
  if (!courseId.ok) return courseId;
  const lessonId = cleanId(raw.lessonId);
  if (!lessonId.ok) return lessonId;

  const due = date.value === null ? { dueAt: null, dueHasTime: false } : dueOf(date.value, time.value);
  return {
    ok: true,
    value: { title: split.title, note: note.value, tags: tags.value, dueAt: due.dueAt, dueHasTime: due.dueHasTime, courseId: courseId.value, lessonId: lessonId.value },
  };
}

const PATCH_KEYS = ["title", "note", "tags", "dueDate", "dueTime", "done", "courseId", "lessonId"] as const;

/** Sửa (PATCH, từng phần): title (KHÔNG tách #), note|null, tags, dueDate|null, dueTime|null, done: boolean (đúng kiểu, "true" bị từ chối), courseId|null, lessonId|null. Không khoá nào → lỗi.
 *  Khoá lạ (doneAt, notifiedAt, userId…) bị bỏ qua, không bao giờ vào value. */
export function cleanNhacPatch(raw: unknown, todayKey: string): { ok: true; value: NhacPatch } | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: NHAC_BAD_JSON_ERROR };
  if (!PATCH_KEYS.some(k => hasOwn(raw, k))) return { ok: false, error: "Chưa có gì để lưu." };
  const v: NhacPatch = {};

  if (hasOwn(raw, "title")) {
    const t = oneLine(raw.title);
    const err = typeof raw.title !== "string" ? "Chưa có tiêu đề." : checkTitleLen(t);
    if (err) return { ok: false, error: err };
    v.title = t;
  }
  if (hasOwn(raw, "note")) {
    const n = cleanNote(raw.note);
    if (!n.ok) return n;
    v.note = n.value;
  }
  if (hasOwn(raw, "tags")) {
    const t = cleanTags(raw.tags);
    if (!t.ok) return t;
    v.tags = t.value;
  }
  if (hasOwn(raw, "dueDate")) {
    const d = cleanDueDate(raw.dueDate, todayKey);
    if (!d.ok) return d;
    v.dueDate = d.value;
  }
  if (hasOwn(raw, "dueTime")) {
    const t = cleanDueTime(raw.dueTime);
    if (!t.ok) return t;
    v.dueTime = t.value;
  }
  if (hasOwn(v, "dueDate") && v.dueDate === null && typeof v.dueTime === "string") return { ok: false, error: TIME_NEEDS_DATE };
  if (hasOwn(raw, "done")) {
    if (typeof raw.done !== "boolean") return { ok: false, error: "Trạng thái xong không đúng dạng." };
    v.done = raw.done;
  }
  if (hasOwn(raw, "courseId")) {
    const c = cleanId(raw.courseId);
    if (!c.ok) return c;
    v.courseId = c.value;
  }
  if (hasOwn(raw, "lessonId")) {
    const l = cleanId(raw.lessonId);
    if (!l.ok) return l;
    v.lessonId = l.value;
  }
  return { ok: true, value: v };
}

// ── Hàng DB → NhacItem (máy chủ dùng; thuần) ────────────────────────────────────

export interface NhacRow { id: string; title: string; note: string | null; tags: string[]; dueAt: Date | null; dueHasTime: boolean; doneAt: Date | null; createdAt: Date }

/** Chỉ các trường của NhacItem — không userId, notifiedAt, courseId/lessonId thô (lớp chỉ qua `lop` đã kiểm quyền). */
export function nhacItemOf(r: NhacRow, lop: NhacLop | null): NhacItem {
  const dueAt = r.dueAt && Number.isFinite(r.dueAt.getTime()) ? r.dueAt : null;
  return {
    id: r.id,
    title: r.title,
    note: r.note,
    tags: Array.isArray(r.tags) ? r.tags.slice() : [],
    dueAt: dueAt ? dueAt.toISOString() : null,
    dueHasTime: dueAt ? r.dueHasTime === true : false,
    dueDate: dueAt ? vnDateKeyOf(dueAt) : null,
    dueTime: dueAt && r.dueHasTime ? vnTimeHHmm(dueAt) : null,
    doneAt: r.doneAt ? r.doneAt.toISOString() : null,
    lop,
    createdAt: r.createdAt.toISOString(),
  };
}

// ── Nhóm, quá hạn, nhãn ─────────────────────────────────────────────────────────

const dueMs = (it: Pick<NhacItem, "dueAt">): number => (it.dueAt ? Date.parse(it.dueAt) : NaN);
const dueDateOf = (it: Pick<NhacItem, "dueAt" | "dueDate">): string | null =>
  it.dueDate ?? (it.dueAt && Number.isFinite(Date.parse(it.dueAt)) ? vnDateKeyOf(new Date(it.dueAt)) : null);

/** Quá hạn: chưa xong và (có giờ: dueAt < now; chỉ ngày: dueDate < hôm nay VN). Mục chỉ ngày KHÔNG quá hạn trong chính ngày đó. */
export function isOverdue(it: Pick<NhacItem, "dueAt" | "dueHasTime" | "dueDate" | "doneAt">, now: Date): boolean {
  if (it.doneAt) return false;
  if (!it.dueAt) return false;
  if (it.dueHasTime) {
    const t = dueMs(it);
    return Number.isFinite(t) && t < now.getTime();
  }
  const d = dueDateOf(it);
  return d !== null && d < vnDateKeyOf(now);
}

export type NhacNhom = "hom-nay" | "da-hen" | "tat-ca" | "da-xong";
export const NHAC_NHOM_KEYS: readonly NhacNhom[] = ["hom-nay", "da-hen", "tat-ca", "da-xong"] as const;
export const NHAC_NHOM_LABEL: Record<NhacNhom, string> = { "hom-nay": "Hôm nay", "da-hen": "Đã hẹn", "tat-ca": "Tất cả", "da-xong": "Đã xong" };

const byId = (a: NhacItem, b: NhacItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byDueAsc = (a: NhacItem, b: NhacItem) => dueMs(a) - dueMs(b) || byId(a, b);

/** hom-nay = chưa xong & (dueDate = hôm nay hoặc quá hạn), quá hạn lên đầu rồi theo dueAt; da-hen = chưa xong & dueDate > hôm nay, theo dueAt;
 *  tat-ca = mọi mục chưa xong (có ngày theo dueAt, rồi không ngày theo createdAt mới→cũ); da-xong = doneAt mới→cũ. Hoà → id. Không đổi mảng gốc. */
export function chiaNhom(items: NhacItem[], now: Date): Record<NhacNhom, NhacItem[]> {
  const todayKey = vnDateKeyOf(now);
  const list = (items ?? []).filter(Boolean);
  const open = list.filter(it => !it.doneAt);
  const dated = open.filter(it => dueDateOf(it) !== null && Number.isFinite(dueMs(it)));
  const undated = open.filter(it => !dated.includes(it));

  const homNay = dated
    .filter(it => dueDateOf(it) === todayKey || isOverdue(it, now))
    .map(it => ({ it, late: isOverdue(it, now) }))
    .sort((a, b) => Number(b.late) - Number(a.late) || byDueAsc(a.it, b.it))
    .map(x => x.it);
  const daHen = dated.filter(it => (dueDateOf(it) as string) > todayKey && !isOverdue(it, now)).sort(byDueAsc);
  const tatCa = [
    ...dated.slice().sort(byDueAsc),
    ...undated.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || byId(a, b)),
  ];
  const daXong = list.filter(it => !!it.doneAt).sort((a, b) => Date.parse(b.doneAt as string) - Date.parse(a.doneAt as string) || byId(a, b));
  return { "hom-nay": homNay, "da-hen": daHen, "tat-ca": tatCa, "da-xong": daXong };
}

/** Lọc theo một thẻ (chuẩn hoá như normalizeTag). tag null/rỗng/hỏng ⇒ bản sao nguyên mảng. */
export function locTheoThe(items: NhacItem[], tag: string | null): NhacItem[] {
  const t = tag === null ? null : normalizeTag(tag);
  if (t === null) return (items ?? []).slice();
  return (items ?? []).filter(it => Array.isArray(it.tags) && it.tags.includes(t));
}

/** Đếm thẻ trên các mục đưa vào: nhiều → ít, hoà theo chữ (localeCompare "vi"). */
export function demThe(items: NhacItem[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items ?? []) for (const t of new Set(it?.tags ?? [])) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "vi"));
}

/** "Hôm nay · 15:00" | "Ngày mai" | "T5, 14/11 · 19:30" | "Quá hạn · T3, 10/11" | "" (không ngày). */
export function dueLabel(it: NhacItem, now: Date): string {
  const d = dueDateOf(it);
  if (!d) return "";
  const todayKey = vnDateKeyOf(now);
  const time = it.dueHasTime ? (it.dueTime ?? (it.dueAt ? vnTimeHHmm(new Date(it.dueAt)) : null)) : null;
  const base = `${vnDayTitle(d, todayKey)}${time ? ` · ${time}` : ""}`;
  return isOverdue(it, now) ? `Quá hạn · ${base}` : base;
}

// ── Ghi chú: chữ / link ─────────────────────────────────────────────────────────

type NoteSeg = { kind: "text"; text: string } | { kind: "link"; href: string; text: string };
const URL_RE = /(?<![\p{L}\p{N}_])https?:\/\/[^\s<>"'`]+/giu;
const TRAIL_PUNCT = /[.,;:!?)\]}'"»…]$/u;

function trimUrl(u: string): string {
  let s = u;
  while (s && TRAIL_PUNCT.test(s)) {
    const last = s[s.length - 1];
    // Giữ ")" khi link tự có "(" chưa đóng (vd wiki "Làng_(truyện_ngắn)").
    if (last === ")" && (s.match(/\(/g)?.length ?? 0) >= (s.match(/\)/g)?.length ?? 0)) break;
    s = s.slice(0, -1);
  }
  return s;
}

function safeHttp(u: string): string | null {
  try {
    const url = new URL(u);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) return null;
    return url.href;
  } catch { return null; }
}

/** Ghi chú → đoạn chữ / link. Chỉ http(s), bỏ dấu câu cuối; javascript:/data:/mailto: là chữ thường. Giao diện vẽ bằng React (không innerHTML). */
export function noteSegments(note: string | null): ({ kind: "text"; text: string } | { kind: "link"; href: string; text: string })[] {
  if (typeof note !== "string" || note === "") return [];
  const out: NoteSeg[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.kind === "text") last.text += t;
    else out.push({ kind: "text", text: t });
  };
  let pos = 0;
  for (const m of note.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const raw = trimUrl(m[0]);
    const href = raw ? safeHttp(raw) : null;
    pushText(note.slice(pos, start));
    if (href) { out.push({ kind: "link", href, text: raw }); pos = start + raw.length; }
    else { pushText(m[0]); pos = start + m[0].length; }
  }
  pushText(note.slice(pos));
  return out;
}

// ── Chữ thông báo của cron (CHỈ số đếm) ─────────────────────────────────────────

const countWord = (n: number): string => (Number.isInteger(n) && n >= 1 && n <= 99 ? String(n) : "nhiều");

/** Cron: chữ thông báo — CHỈ số đếm, không tiêu đề/ghi chú/tên lớp/tên người. n ngoài 1–99 ⇒ "nhiều". */
export function studyTodayText(n: number): { title: "Hôm nay có lớp"; message: string } {
  return { title: "Hôm nay có lớp", message: `Hôm nay bạn có ${countWord(n)} buổi học. Mở Nhắc học để xem phiếu bài.` };
}

export function reminderDueText(n: number): { title: "Nhắc việc hôm nay"; message: string } {
  return { title: "Nhắc việc hôm nay", message: `Bạn có ${countWord(n)} nhắc việc đến hạn hôm nay.` };
}
