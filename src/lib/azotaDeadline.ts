// MD-16 — hạn nộp Azota (Lesson.azotaDeadline, chuỗi). Ô nhập của gia sư là <input type="datetime-local"> nên giá trị thật có dạng
// "2026-10-25T20:00" (KHÔNG có múi giờ = giờ Việt Nam). Hàm cũ toISO() chỉ nhận "YYYY-MM-DD" hoặc "DD/MM/YYYY" nên trả null → hạn biến mất
// khỏi lịch và "Việc của tôi". Đọc ở đây theo giờ Việt Nam, bằng hàm có sẵn của classSessions.
import { addDaysKey, instantOf, isValidDateKey, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

export interface AzotaDeadline {
  /** Ngày theo giờ VN, YYYY-MM-DD. */
  dateKey: string;
  /** Giờ VN, HH:mm. Chỉ có ngày thì là 23:59 (hết ngày). */
  time: string;
  /** Thời điểm tuyệt đối. */
  instant: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const VN_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?$/;

function build(dateKey: string, h: number | null, m: number | null): AzotaDeadline | null {
  if (!isValidDateKey(dateKey)) return null;
  if (h === null || m === null) {
    return { dateKey, time: "23:59", instant: instantOf(dateKey, 23 * 60 + 59) };
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { dateKey, time: hm(h * 60 + m), instant: instantOf(dateKey, h * 60 + m) };
}

export function parseAzotaDeadline(raw: string | null | undefined): AzotaDeadline | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = ISO_RE.exec(s);
  if (iso) {
    const [, y, mo, d, hh, mi, , zone] = iso;
    const dateKey = `${y}-${mo}-${d}`;
    if (hh === undefined) return build(dateKey, null, null);
    if (!zone) return build(dateKey, Number(hh), Number(mi)); // không múi giờ = giờ Việt Nam
    // Có múi giờ rõ ràng (vd Z, +07:00): đổi sang thời điểm tuyệt đối rồi đọc lại theo giờ Việt Nam.
    if (!isValidDateKey(dateKey) || Number(hh) > 23 || Number(mi) > 59) return null;
    const offMin = zone === "Z" ? 0 : (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
    const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mi)) - offMin * 60_000;
    const instant = new Date(utcMs);
    return { dateKey: vnDateKeyOf(instant), time: hm(vnMinutesOfDay(instant)), instant };
  }

  const vn = VN_RE.exec(s);
  if (vn) {
    const [, d, mo, y, hh, mi] = vn;
    const dateKey = `${y}-${pad(Number(mo))}-${pad(Number(d))}`;
    if (hh === undefined) return build(dateKey, null, null);
    return build(dateKey, Number(hh), Number(mi));
  }
  return null;
}

/** "20:00 25/10/2026" — để hiện cho học viên thay vì chuỗi thô "2026-10-25T20:00". Không đọc được thì trả nguyên văn. */
export function formatAzotaDeadline(raw: string | null | undefined): string {
  const d = parseAzotaDeadline(raw);
  if (!d) return typeof raw === "string" ? raw : "";
  return `${d.time} ${d.dateKey.slice(8, 10)}/${d.dateKey.slice(5, 7)}/${d.dateKey.slice(0, 4)}`;
}

/** Còn bao nhiêu NGÀY LỊCH (giờ VN) từ `now` đến hạn: 0 = hôm nay, 1 = ngày mai, âm = đã qua ngày. */
export function calendarDaysLeft(d: AzotaDeadline, now: Date): number {
  const a = vnDateKeyOf(now);
  let n = 0;
  if (d.dateKey >= a) { while (addDaysKey(a, n) < d.dateKey && n < 4000) n++; return n; }
  while (addDaysKey(d.dateKey, n) < a && n < 4000) n++;
  return -n;
}
