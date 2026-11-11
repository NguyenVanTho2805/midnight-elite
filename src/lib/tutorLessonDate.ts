// LOI-02 (11/11/2026) — ngày giờ học của một bài (Lesson.scheduledAt). THUẦN: không Prisma, không đọc đồng hồ ngầm (trừ mặc định `now`),
// chạy được ở trình duyệt. Giờ Việt Nam cố định UTC+7 (không giờ mùa hè) — dùng chung hàm của classSessions.ts, không dựa vào múi giờ của máy.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-02.md mục 3. Test: tools/local-e2e/t-lesson-date-lib.ts (chạy dưới cả TZ=UTC và TZ=Asia/Ho_Chi_Minh).
import { hmOf, instantOf, isValidDateKey, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

const YEAR_MIN = 2020, YEAR_MAX = 2099;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** ISO 8601 đầy đủ: ngày + giờ:phút (+ giây, + phần nghìn giây) + múi giờ BẮT BUỘC (Z hoặc ±hh:mm). */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

const yearOk = (y: number) => y >= YEAR_MIN && y <= YEAR_MAX;
const validDate = (d: Date) => !Number.isNaN(d.getTime());
const vnYearOf = (d: Date) => Number(vnDateKeyOf(d).slice(0, 4));

/** "2026-11-13" + "19:00" (giờ VN) → ISO UTC "2026-11-13T12:00:00.000Z". Cả hai rỗng ⇒ { ok:true, iso:null }.
 *  Thiếu một nửa / ngày không có thật (2026-02-30) / giờ ngoài 00:00–23:59 / năm ngoài 2020–2099 ⇒ { ok:false, error } (chữ tiếng Việt). */
export function parseVnDateTime(date: string, time: string): { ok: true; iso: string | null } | { ok: false; error: string } {
  const d = (date ?? "").trim(), t = (time ?? "").trim();
  if (!d && !t) return { ok: true, iso: null };
  if (!t) return { ok: false, error: "Chọn giờ học." };
  if (!d) return { ok: false, error: "Chọn ngày học." };
  const dm = DATE_RE.exec(d);
  if (!dm || !isValidDateKey(d)) return { ok: false, error: "Ngày học không có thật." };
  if (!yearOk(Number(dm[1]))) return { ok: false, error: `Năm học phải từ ${YEAR_MIN} đến ${YEAR_MAX}.` };
  const tm = TIME_RE.exec(t);
  if (!tm) return { ok: false, error: "Giờ học phải từ 00:00 đến 23:59." };
  return { ok: true, iso: instantOf(d, Number(tm[1]) * 60 + Number(tm[2])).toISOString() };
}

/** ISO → { date:"YYYY-MM-DD", time:"HH:mm" } theo giờ VN; null / rác ⇒ { date:"", time:"" }. */
export function isoToVnParts(iso: string | null | undefined): { date: string; time: string } {
  if (typeof iso !== "string" || !iso) return { date: "", time: "" };
  const t = new Date(iso);
  if (!validDate(t)) return { date: "", time: "" };
  return { date: vnDateKeyOf(t), time: hmOf(vnMinutesOfDay(t)) };
}

/** Chip trên cây: "T6 13/11 · 19:00" (thêm "/2027" khi khác năm VN của `now`); CN viết "CN". null / rác ⇒ null. */
export function formatVnLessonWhen(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (typeof iso !== "string" || !iso) return null;
  const t = new Date(iso);
  if (!validDate(t)) return null;
  const key = vnDateKeyOf(t); // "YYYY-MM-DD" giờ VN
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay(); // thứ của NGÀY VN (không phụ thuộc múi giờ máy)
  const thu = dow === 0 ? "CN" : `T${dow + 1}`;
  const year = key.slice(0, 4);
  const sameYear = validDate(now) && vnYearOf(now) === Number(year);
  return `${thu} ${key.slice(8, 10)}/${key.slice(5, 7)}${sameYear ? "" : `/${year}`} · ${hmOf(vnMinutesOfDay(t))}`;
}

/** Máy chủ: đọc body.scheduledAt. Vắng khoá ⇒ { ok:true, value: undefined } (không đổi); null ⇒ null; chuỗi ISO 8601 đầy đủ có múi giờ
 *  (Z hoặc ±hh:mm), Date hợp lệ, năm 2020–2099 ⇒ Date. Mọi thứ khác ("", "abc", số, "2026-11-13" không giờ, mảng) ⇒ { ok:false, error }. */
export function parseScheduledAtInput(v: unknown): { ok: true; value: Date | null | undefined } | { ok: false; error: string } {
  const bad = { ok: false as const, error: "Ngày học không hợp lệ." };
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null) return { ok: true, value: null };
  if (v instanceof Date) return validDate(v) && yearOk(vnYearOf(v)) ? { ok: true, value: new Date(v.getTime()) } : bad;
  if (typeof v !== "string" || v.length > 40) return bad;
  const m = ISO_RE.exec(v);
  // Ngày phải CÓ THẬT theo đúng chữ đã gửi: V8 cuộn "2026-02-30T…" sang 02/03 chứ không báo sai.
  if (!m || !isValidDateKey(`${m[1]}-${m[2]}-${m[3]}`) || !yearOk(Number(m[1]))) return bad;
  const t = new Date(v);
  if (!validDate(t) || !yearOk(vnYearOf(t))) return bad;
  return { ok: true, value: t };
}
