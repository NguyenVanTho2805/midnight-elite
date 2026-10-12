// BE-074/075/076 — helper thuần cho báo cáo doanh thu (không import Prisma
// để test được và dùng được cả ở client).
//
// Mô hình (D01 chốt 05/10/2026, BE-077 chốt 06/10/2026): học viên học miễn
// phí; doanh thu của NỀN TẢNG là Coin gia sư trả để mua VIP
// (CoinTransaction.sourceType = "tutor_subscription", 1 Coin = 1 VND). Cách
// tính cũ Enrollment × Course.price đã cắt hẳn, không giữ song song.

// Việt Nam UTC+7 quanh năm (không có giờ mùa hè).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM" theo giờ Việt Nam. Giao dịch lúc 20:00 UTC ngày 30/09 là 03:00
// ngày 01/10 ở Việt Nam nên thuộc tháng 10.
export function vnMonthKey(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 7);
}

// "YYYY-MM-DD" theo giờ Việt Nam.
export function vnDateKey(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function parseVnDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  // Chặn ngày không tồn tại (31/02 sẽ tràn sang tháng sau).
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(utc - VN_OFFSET_MS); // 00:00 giờ VN của ngày đó, đổi ra UTC
}

export interface DateRange {
  from: Date | null;        // gồm cả
  toExclusive: Date | null; // không gồm — đầu ngày hôm sau của `to`
}

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (cả hai gồm, theo giờ VN). Trả { error }
// nếu sai định dạng hoặc from > to.
export function parseDateRange(sp: URLSearchParams): DateRange | { error: string } {
  const f = sp.get("from"), t = sp.get("to");
  let from: Date | null = null, toExclusive: Date | null = null;
  if (f) {
    from = parseVnDay(f);
    if (!from) return { error: "from phải có dạng YYYY-MM-DD" };
  }
  if (t) {
    const d = parseVnDay(t);
    if (!d) return { error: "to phải có dạng YYYY-MM-DD" };
    toExclusive = new Date(d.getTime() + DAY_MS);
  }
  if (from && toExclusive && from >= toExclusive) return { error: "from phải trước hoặc bằng to" };
  return { from, toExclusive };
}

export function rangeWhere(r: DateRange): { gte?: Date; lt?: Date } | undefined {
  if (!r.from && !r.toExclusive) return undefined;
  return { ...(r.from ? { gte: r.from } : {}), ...(r.toExclusive ? { lt: r.toExclusive } : {}) };
}

// Một ô CSV theo RFC 4180, thêm dấu nháy đơn đứng đầu nếu ô bắt đầu bằng ký
// tự mà Excel/Sheets coi là công thức (= + - @, tab, CR) — tên người dùng là
// dữ liệu tự nhập nên có thể là "=HYPERLINK(...)" (CSV injection). Số giữ
// nguyên để Excel còn tính toán được.
export function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Có BOM UTF-8 để Excel đọc đúng tiếng Việt.
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// Khoảng ngày cho các nút nhanh ở trang doanh thu, theo giờ VN: "month" =
// từ mùng 1 tháng này tới hôm nay, "30d" = 30 ngày gần nhất (gồm hôm nay).
export function presetRange(kind: "month" | "30d" | "all", now: Date): { from: string; to: string } {
  if (kind === "all") return { from: "", to: "" };
  const today = vnDateKey(now);
  if (kind === "month") return { from: `${vnMonthKey(now)}-01`, to: today };
  return { from: vnDateKey(new Date(now.getTime() - 29 * DAY_MS)), to: today };
}

// Chia `total` (đồng, số nguyên) theo tỉ lệ `weights` sao cho TỔNG các phần đúng
// bằng `total` (phương pháp phần dư lớn nhất). Dùng để quy tiền đã thu của 1
// phiếu nhiều môn về từng lớp mà không lệch đồng nào. Trọng số 0 hoặc tổng 0 →
// chia đều cho các phần tử (không bao giờ trả NaN).
export function allocateByWeights(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const t = Math.max(0, Math.floor(total));
  const w = weights.map(x => (Number.isFinite(x) && x > 0 ? x : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  const base = sum > 0 ? w : w.map(() => 1);
  const baseSum = sum > 0 ? sum : n;
  const raw = base.map(x => (t * x) / baseSum);
  const out = raw.map(Math.floor);
  let rest = t - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) out[order[k].i]++;
  return out;
}

export function formatVnd(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}
