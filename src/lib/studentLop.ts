// LOI-03 — lớp của học sinh: thư viện lớp, trang lớp, phiếu "Hôm nay có lớp". PHẦN THUẦN (không Prisma, không Next, không React).
// Dùng chung cho máy chủ (src/lib/studentLopServer.ts, /api/student/lop, /api/student/hom-nay) và giao diện (trang lớp) ⇒ x/y, "Học tiếp", ngày VN không thể tính lệch nhau.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-03.md mục 3.1. Test: tools/local-e2e/t-loi03-lib.ts (chạy với TZ=UTC và TZ=America/Los_Angeles).
//
// Ngày giờ: giờ Việt Nam = UTC+7 cố định (không giờ mùa hè), tính bằng cộng/trừ mili giây như classSessions — KHÔNG dùng getHours()/toDateString()/Intl,
// để kết quả không phụ thuộc TZ của máy chủ hay trình duyệt.
import { vnDateKeyOf, addDaysKey, instantOf, isValidDateKey } from "@/lib/classSessions";
import { isLearnerVisible } from "@/lib/lessonStatus";
import { parseLessonDocuments, viewerHref } from "@/lib/library";
import { parseLinkList, classifyMediaLink } from "@/lib/mediaLink";

const VN_OFFSET_MS = 7 * 3_600_000;

// ── Cây giáo trình ──────────────────────────────────────────────────────────────

export interface TreeLesson { id: string; title: string; status?: unknown }
export interface TreeChapter { id: string; title: string; isImplicit?: boolean; lessons: TreeLesson[] }
export interface TreeSection { id: string; chapters: TreeChapter[] }

/** id bài Đã đăng theo đúng thứ tự giáo trình (phần → chương → bài như mảng đưa vào). Bài status khác "published" bị bỏ (ĐÓNG KHI LẠ). */
export function orderedLessonIds(s: TreeSection[]): string[] {
  const out: string[] = [];
  for (const sec of s ?? []) for (const ch of sec?.chapters ?? []) for (const l of ch?.lessons ?? []) {
    if (l && typeof l.id === "string" && isLearnerVisible(l.status)) out.push(l.id);
  }
  return out;
}

// ── Tiến độ ────────────────────────────────────────────────────────────────────

/** x/y/%: chỉ đếm id có trong `ids` (tiến độ của bài lớp khác / bài nháp không lọt vào). pct = floor(done*100/total), CHỈ = 100 khi done === total; total 0 → pct 0. */
export function lopProgress(ids: readonly string[], completed: ReadonlySet<string>): { done: number; total: number; pct: number } {
  const uniq = new Set(ids);
  const total = uniq.size;
  let done = 0;
  for (const id of uniq) if (completed.has(id)) done++;
  const pct = total === 0 ? 0 : Math.min(100, Math.floor((done * 100) / total));
  return { done, total, pct };
}

export type HocTiepReason = "dang-xem" | "chua-hoc" | "on-lai" | "trong";

/** Bài "Học tiếp": bài đầu tiên (theo ids) đang xem dở và chưa xong → "dang-xem"; không có → bài đầu tiên chưa xong → "chua-hoc";
 *  xong hết → bài đầu → "on-lai"; ids rỗng → { lessonId: null, reason: "trong" }. Bài khoá (`locked`) bị bỏ qua.
 *  KHÔNG có "bài dở gần nhất": LessonProgress không có mốc giờ cập nhật (đặc tả 1.3) — không bịa. */
export function hocTiep(
  ids: readonly string[],
  completed: ReadonlySet<string>,
  watching: ReadonlySet<string>,
  locked?: ReadonlySet<string>,
): { lessonId: string | null; reason: HocTiepReason } {
  const open = ids.filter(id => !locked?.has(id));
  if (open.length === 0) return { lessonId: null, reason: "trong" };
  const dangXem = open.find(id => watching.has(id) && !completed.has(id));
  if (dangXem) return { lessonId: dangXem, reason: "dang-xem" };
  const chuaHoc = open.find(id => !completed.has(id));
  if (chuaHoc) return { lessonId: chuaHoc, reason: "chua-hoc" };
  return { lessonId: open[0], reason: "on-lai" };
}

export const HOC_TIEP_LABEL: Record<"dang-xem" | "chua-hoc" | "on-lai", string> = {
  "dang-xem": "Học tiếp →",
  "chua-hoc": "Học tiếp →",
  "on-lai": "Xem lại →",
};

/** Nhãn nút: "chua-hoc" khi done = 0 ⇒ "Bắt đầu học →"; "trong" (lớp chưa có bài) ⇒ "Vào lớp". */
export function hocTiepLabel(reason: HocTiepReason, done: number): string {
  if (reason === "trong") return "Vào lớp";
  if (reason === "chua-hoc" && done === 0) return "Bắt đầu học →";
  return HOC_TIEP_LABEL[reason];
}

export type LopTrangThai = "dang-hoc" | "hoan-thanh";
export const lopTrangThai = (p: { done: number; total: number }): LopTrangThai => (p.total > 0 && p.done >= p.total ? "hoan-thanh" : "dang-hoc");
export const LOP_TRANG_THAI_LABEL = { "dang-hoc": "Đang học", "hoan-thanh": "Hoàn thành" } as const;
export type LopLoc = "tat-ca" | "dang-hoc" | "hoan-thanh";
export const LOP_LOC_KEYS: readonly LopLoc[] = ["tat-ca", "dang-hoc", "hoan-thanh"] as const;
export const LOP_LOC_LABEL: Record<LopLoc, string> = { "tat-ca": "Tất cả", "dang-hoc": "Đang học", "hoan-thanh": "Hoàn thành" };

export function locLop<T extends { trangThai: LopTrangThai }>(rows: T[], loc: LopLoc): T[] {
  if (loc === "tat-ca") return rows.slice();
  return rows.filter(r => r.trangThai === loc);
}

export function demLoc(rows: { trangThai: LopTrangThai }[]): Record<LopLoc, number> {
  const out: Record<LopLoc, number> = { "tat-ca": rows.length, "dang-hoc": 0, "hoan-thanh": 0 };
  for (const r of rows) if (r.trangThai === "dang-hoc" || r.trangThai === "hoan-thanh") out[r.trangThai]++;
  return out;
}

/** "Gia sư: Cô Lan"; rỗng hoặc "KiN" (tên giữ chỗ của lớp tạo bằng wizard) → "" (cùng luật teacherLabel ở DanhMucLop.tsx:11-14). */
export function giaSuLabel(instructor: string | null | undefined): string {
  const t = (instructor ?? "").trim();
  return t && t.toLowerCase() !== "kin" ? `Gia sư: ${t}` : "";
}

// ── Ngày giờ VN ────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAY_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const isValidDate = (d: unknown): d is Date => d instanceof Date && Number.isFinite(d.getTime());

/** Giờ VN, KHÔNG phụ thuộc TZ máy chủ/trình duyệt (cộng 7 giờ cố định như classSessions). "19:30". */
export function vnTimeHHmm(d: Date): string {
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  return `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
}

function keyParts(dateKey: string): { wd: number; dd: string; mm: string } | null {
  if (!isValidDateKey(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  return { wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), dd: String(d).padStart(2, "0"), mm: String(m).padStart(2, "0") };
}

/** "Hôm nay" | "Ngày mai" | "T5, 14/11". dateKey hỏng ⇒ "". */
export function vnDayTitle(dateKey: string, todayKey: string): string {
  if (isValidDateKey(todayKey)) {
    if (dateKey === todayKey) return "Hôm nay";
    if (dateKey === addDaysKey(todayKey, 1)) return "Ngày mai";
  }
  const p = keyParts(dateKey);
  return p ? `${WEEKDAY_SHORT[p.wd]}, ${p.dd}/${p.mm}` : "";
}

/** Dòng phụ đầu phiếu: "Thứ Tư, 11/11" (từ todayKey của máy chủ). dateKey hỏng ⇒ "". */
export function vnDayLong(dateKey: string): string {
  const p = keyParts(dateKey);
  return p ? `${WEEKDAY_LONG[p.wd]}, ${p.dd}/${p.mm}` : "";
}

export const HOM_NAY_DAYS = 7;

/** Cửa sổ truy vấn: from = 00:00 VN hôm nay; until = 00:00 VN của (hôm nay + days + 1). Dùng cho where.scheduledAt { gte: from, lt: until }. */
export function vnWindow(now: Date, days: number = HOM_NAY_DAYS): { todayKey: string; from: Date; until: Date } {
  const todayKey = vnDateKeyOf(now);
  return { todayKey, from: instantOf(todayKey, 0), until: instantOf(addDaysKey(todayKey, days + 1), 0) };
}

/** Chia bài theo NGÀY VN: today = cùng dateKey VN với now (kể cả giờ đã qua, kèm past=true); upcoming = dateKey trong (hôm nay, hôm nay+days];
 *  ngày đã qua, null, Invalid Date bị bỏ. Sắp theo scheduledAt tăng, hoà thì theo lessonId. Không đổi mảng gốc. */
export function chiaHomNay<T extends { lessonId: string; scheduledAt: Date | null }>(
  items: T[],
  now: Date,
  days: number = HOM_NAY_DAYS,
): {
  todayKey: string;
  today: (T & { dateKey: string; time: string; past: boolean })[];
  upcoming: (T & { dateKey: string; time: string; past: false })[];
} {
  const todayKey = vnDateKeyOf(now);
  const lastKey = addDaysKey(todayKey, days);
  const valid = (items ?? []).filter(it => it && isValidDate(it.scheduledAt));
  const sorted = valid.slice().sort((a, b) => {
    const d = (a.scheduledAt as Date).getTime() - (b.scheduledAt as Date).getTime();
    return d !== 0 ? d : a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0;
  });
  const today: (T & { dateKey: string; time: string; past: boolean })[] = [];
  const upcoming: (T & { dateKey: string; time: string; past: false })[] = [];
  for (const it of sorted) {
    const at = it.scheduledAt as Date;
    const dateKey = vnDateKeyOf(at);
    const time = vnTimeHHmm(at);
    if (dateKey === todayKey) today.push({ ...it, dateKey, time, past: at.getTime() < now.getTime() });
    else if (dateKey > todayKey && dateKey <= lastKey) upcoming.push({ ...it, dateKey, time, past: false });
  }
  return { todayKey, today, upcoming };
}

// ── Trang lớp: dòng phụ của bài, tóm tắt nội dung ───────────────────────────────

/** Dòng phụ của bài ở trang lớp: ["1 tài liệu" | "n tài liệu", "Có bài tập", "Học T5, 14/11 · 19:30"] — mục nào không có dữ liệu thì không có (không bịa, không lượt xem).
 *  "Có bài tập" khi assignmentCount > 0 hoặc azotaUrl có ≥1 link hợp lệ. scheduledAt nhận ISO hoặc Date; hỏng → bỏ. */
export function lessonMetaParts(
  l: { documents?: string | null; azotaUrl?: string | null; assignmentCount?: number; scheduledAt?: string | Date | null },
  todayKey: string,
): string[] {
  const parts: string[] = [];
  const nDocs = parseLessonDocuments(l?.documents ?? null, { allowKinFiles: true }).length;
  if (nDocs > 0) parts.push(`${nDocs} tài liệu`);
  const nAssign = typeof l?.assignmentCount === "number" && Number.isFinite(l.assignmentCount) ? l.assignmentCount : 0;
  if (nAssign > 0 || azotaLinks(l?.azotaUrl).length > 0) parts.push("Có bài tập");
  const raw = l?.scheduledAt;
  const at = raw instanceof Date ? raw : typeof raw === "string" && raw.trim() ? new Date(raw) : null;
  if (isValidDate(at)) {
    const title = vnDayTitle(vnDateKeyOf(at), todayKey);
    if (title) parts.push(`Học ${title} · ${vnTimeHHmm(at)}`);
  }
  return parts;
}

/** "Nội dung lớp: 3 chương · 12 bài"; chỉ đếm chương KHÔNG ngầm (isImplicit) có bài Đã đăng và bài Đã đăng; 0 chương → "Nội dung lớp: 12 bài"; 0 bài → "Lớp chưa có bài học". */
export function contentSummary(s: TreeSection[]): string {
  let chapters = 0;
  let lessons = 0;
  for (const sec of s ?? []) for (const ch of sec?.chapters ?? []) {
    const n = (ch?.lessons ?? []).filter(l => l && isLearnerVisible(l.status)).length;
    lessons += n;
    if (n > 0 && ch.isImplicit !== true) chapters++;
  }
  if (lessons === 0) return "Lớp chưa có bài học";
  if (chapters === 0) return `Nội dung lớp: ${lessons} bài`;
  return `Nội dung lớp: ${chapters} chương · ${lessons} bài`;
}

/** 0 → "01", 9 → "10". */
export const chapterNo = (i: number): string => String(Math.max(0, Math.floor(i)) + 1).padStart(2, "0");

// ── Phiếu: tài liệu + Azota ─────────────────────────────────────────────────────

export const MAX_DOC_LINKS = 5;
export const MAX_AZOTA_LINKS = 3;

/** Tài liệu mở được của bài cho phiếu: tối đa 5, { name, href: viewerHref(name,url) } — parseLessonDocuments(raw, { allowKinFiles: true }). */
export function docLinks(raw: string | null | undefined): { name: string; href: string }[] {
  return parseLessonDocuments(raw, { allowKinFiles: true }).slice(0, MAX_DOC_LINKS).map(d => ({ name: d.name, href: viewerHref(d.name, d.url) }));
}

/** Link Azota hợp lệ của bài (parseLinkList → classifyMediaLink ok), tối đa 3, nhãn "Bài Azota" / "Bài Azota 2". */
export function azotaLinks(raw: string | null | undefined): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const u of parseLinkList(raw)) {
    const info = classifyMediaLink(u);
    if (!info.ok || !info.url) continue;
    out.push({ label: out.length === 0 ? "Bài Azota" : `Bài Azota ${out.length + 1}`, url: info.url });
    if (out.length >= MAX_AZOTA_LINKS) break;
  }
  return out;
}

// ── Hình dạng JSON của hai API (giao diện import kiểu từ đây, không import prisma) ─

/** GET /api/student/lop — một lớp trong thư viện. */
export interface ThuVienRow {
  id: string;
  name: string;
  category: string;
  /** "Gia sư: Cô Lan" hoặc "" (giaSuLabel). */
  giaSu: string;
  /** coverImageOf(Course.bg): https://… hoặc null. Không bao giờ là chuỗi bg/strip/tagColor thô. */
  cover: string | null;
  done: number;
  total: number;
  pct: number;
  trangThai: LopTrangThai;
  /** null khi lớp chưa có bài Đã đăng. */
  hocTiep: { lessonId: string; title: string; reason: "dang-xem" | "chua-hoc" | "on-lai" } | null;
}
export interface ThuVienResp { classes: ThuVienRow[] }

/** GET /api/student/hom-nay — một bài sắp tới (gọn). */
export interface HomNayUpcomingItem {
  lessonId: string;
  courseId: string;
  courseName: string;
  lessonTitle: string;
  /** ISO UTC. */
  scheduledAt: string;
  dateKey: string;
  /** "Hôm nay" | "Ngày mai" | "T5, 14/11". */
  dayTitle: string;
  /** "19:30" giờ VN. */
  time: string;
  past: boolean;
  /** /student/bai-giang/<id> */
  href: string;
  /** /student/bai-giang/<id>?tab=bai-tap khi bài có Assignment, ngược lại null. */
  baiTapHref: string | null;
}
/** Một bài hôm nay: thêm tài liệu + link Azota. */
export interface HomNayItem extends HomNayUpcomingItem {
  docs: { name: string; href: string }[];
  azota: { label: string; url: string }[];
}
export interface HomNayResp {
  /** Mốc giờ máy chủ (ISO). */
  now: string;
  /** Ngày VN hôm nay theo máy chủ — giao diện dùng vnDayLong(todayKey) cho dòng phụ "Thứ Tư, 11/11". */
  todayKey: string;
  today: HomNayItem[];
  upcoming: HomNayUpcomingItem[];
}

export const HOM_NAY_MAX_TODAY = 20;
export const HOM_NAY_MAX_UPCOMING = 10;

export const lessonHref = (lessonId: string): string => `/student/bai-giang/${encodeURIComponent(lessonId)}`;
export const baiTapHrefOf = (lessonId: string): string => `${lessonHref(lessonId)}?tab=bai-tap`;
