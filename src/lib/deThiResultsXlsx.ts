// BU-03 P3 — tệp Excel kết quả đề: sheet "Tổng quan", "Bảng điểm", "Theo câu". Chỉ chạy phía máy chủ (exceljs nạp động như attendanceXlsx.ts).
// MỌI ô là chuỗi hoặc số thuần — không bao giờ là công thức. Chuỗi bắt đầu bằng = + - @ (hoặc tab/CR) được đệm dấu nháy đơn (như csvCell ở revenue.ts),
// vì tên học sinh / tên đề là dữ liệu tự nhập: "=HYPERLINK(...)" phải ra đúng chữ đó. Phần dựng ma trận là THUẦN để test không cần exceljs.
import { vnDateKeyOf } from "@/lib/classSessions";
import { variantCode } from "@/lib/deThiVariants";
import { CHON_LABEL, type Chon, type KetQua, type ScoreRow } from "@/lib/deThiResults";

export type Cell = string | number;

/** Ô an toàn: số hữu hạn giữ nguyên; chuỗi bắt đầu = + - @ \t \r thì đệm '; null/NaN → chuỗi rỗng. */
export function safeCell(v: string | number | boolean | null | undefined): Cell {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** ISO → "dd/MM/yyyy HH:mm" giờ VN (UTC+7, không đổi giờ mùa hè). Không đọc được → "". */
export function vnDateTimeText(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 7 * 3600_000), z = (n: number) => String(n).padStart(2, "0");
  return `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`;
}
const pct = (x: number) => Math.round(x * 1000) / 10; // tỉ lệ 0–1 → phần trăm, 1 chữ số
const dur = (sec: number | null) => (sec === null ? "" : `${Math.floor(sec / 60)} phút ${sec % 60} giây`);

/** `ket-qua-<id8>-<yyyymmdd>.xlsx`, chỉ ASCII. id8 = 8 ký tự chữ-số đầu của mã đề (bỏ tiền tố "quiz-"). Ngày theo giờ VN. */
export function resultsXlsxFilename(examId: string, now: Date): string {
  const id8 = examId.replace(/^quiz-/, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "de";
  return `ket-qua-${id8}-${vnDateKeyOf(now).replace(/-/g, "")}.xlsx`;
}

export interface XlsxData { title: string; chon: Chon; ketQua: KetQua; rows: ScoreRow[] }

export function overviewMatrix(d: XlsxData): Cell[][] {
  const b = d.ketQua.basic, n = (v: number | null) => (v === null ? "" : v);
  const m: Cell[][] = [
    [safeCell("Kết quả đề"), safeCell(d.title)],
    [],
    [safeCell("Số lượt đã nộp"), b.attempts], [safeCell("Số học sinh"), b.students],
    [safeCell("Điểm trung bình (thang 10)"), n(b.avg)], [safeCell("Trung vị"), n(b.median)], [safeCell("Cao nhất"), n(b.max)], [safeCell("Thấp nhất"), n(b.min)],
    [safeCell("Tỉ lệ đạt (từ 5/10, %)"), b.passRate === null ? "" : pct(b.passRate)], [safeCell("Thời gian làm trung bình"), safeCell(dur(b.avgDurationSec))],
    [],
    [safeCell("Phân bố điểm theo %"), safeCell("Số lượt")],
    ...d.ketQua.distribution.map(x => [safeCell(x.label), x.count]),
    [],
    [safeCell("Điểm (thang 10)"), safeCell("Số lượt")],
    ...d.ketQua.frequency.map(x => [x.score, x.count]),
    [],
    [safeCell("Mã đề"), safeCell("Số lượt đã nộp"), safeCell("Điểm trung bình")],
    ...d.ketQua.variants.map(v => [v.code, v.attempts, v.avg === null ? "" : v.avg]),
  ];
  return m;
}

export function scoreMatrix(d: XlsxData): Cell[][] {
  return [
    [safeCell(`Bảng điểm — ${CHON_LABEL[d.chon]}`)],
    [safeCell("STT"), safeCell("Học sinh"), safeCell("Điểm (thang 10)"), safeCell("Nộp lúc"), safeCell("Thời gian làm"), safeCell("Mã đề"), safeCell("Lần rời màn hình")],
    ...d.rows.map((r, i): Cell[] => [i + 1, safeCell(r.studentName), r.score === null ? safeCell("Chờ chấm") : r.score, safeCell(vnDateTimeText(r.submittedAt)), safeCell(dur(r.durationSec)), variantCode(r.variantNo), r.tabSwitchCount]),
  ];
}

export function questionMatrix(d: XlsxData): Cell[][] {
  return [
    [safeCell("Câu"), safeCell("Khoá câu"), safeCell("Tỉ lệ đúng (%)"), safeCell("Số lượt trả lời"), safeCell("Cần xem lại")],
    ...d.ketQua.questions.map((q): Cell[] => [q.order, safeCell(q.variantKey), pct(q.correctRate), q.answered, safeCell(q.flagged ? "Có" : "")]),
  ];
}

export async function resultsXlsx(d: XlsxData): Promise<Uint8Array> {
  // exceljs là gói CommonJS: tên `Workbook` nằm ở `default` hoặc ở chính module tuỳ cách nạp (xem attendanceXlsx.ts).
  const mod = await import("exceljs");
  const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new Workbook();
  wb.creator = "KiN";
  for (const [name, matrix, widths] of [
    ["Tổng quan", overviewMatrix(d), [34, 22, 18]],
    ["Bảng điểm", scoreMatrix(d), [6, 30, 16, 18, 18, 8, 16]],
    ["Theo câu", questionMatrix(d), [8, 20, 16, 16, 14]],
  ] as [string, Cell[][], number[]][]) {
    const ws = wb.addWorksheet(name);
    matrix.forEach(r => ws.addRow(r));
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.getRow(name === "Bảng điểm" ? 2 : 1).font = { bold: true };
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
