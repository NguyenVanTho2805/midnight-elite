// HP-LOP-TRUONG — dựng tệp Excel MẪU nhập học phí theo bảng tháng. Chỉ chạy phía máy chủ (exceljs nạp động như quizSheetTemplate.ts).
// Mọi ô ghi bằng GIÁ TRỊ chuỗi (không công thức). Cột khớp parseSheetGrid (hocPhiSheet.ts); hàng ví dụ mở đầu bằng SHEET_EXAMPLE_MARK để nhập lên mà quên xoá thì KiN bỏ qua và báo.
import { SHEET_EXAMPLE_MARK, SHEET_MAX_ROWS, type SheetConfig } from "@/lib/hocPhiSheet";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function templateFilename(courseId: string, ym: string): string {
  const safe = courseId.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "lop";
  return `hoc-phi-${safe}-${ym}.xlsx`;
}

/** Tiêu đề cột theo thứ tự: Mã em · Họ tên · Số môn · mỗi môn một cột · Buổi miễn phí · Đơn giá riêng · Học bổng · Giảm trừ · Ghi chú. */
export function templateHeaders(subjects: readonly string[]): string[] {
  return ["Mã em (đừng sửa)", "Họ tên", "Số môn", ...subjects, "Buổi miễn phí", "Đơn giá riêng", "Học bổng", "Giảm trừ", "Ghi chú"];
}

export function templateGuide(config: SheetConfig, periodLabel: string): string[] {
  const tiers = config.tiers.map(t => `${t.subjects} môn: ${t.rate.toLocaleString("vi-VN")}đ một buổi`).join(" · ");
  return [
    `Cách dùng bảng mẫu học phí ${periodLabel}`,
    "1. Mỗi hàng là một em đang học lớp. Cột “Mã em” và “Họ tên” đã điền sẵn, đừng sửa cột “Mã em” (KiN dùng mã này để khớp đúng em, kể cả khi hai em trùng tên).",
    "2. Ghi số buổi của từng môn vào cột môn (ô trống = 0 buổi). Cột “Số môn”: để trống thì KiN đếm số môn có buổi trong kỳ; ghi số thì KiN dùng số đó để chọn bậc (không được nhỏ hơn số môn có buổi, tối đa 10).",
    "3. “Buổi miễn phí” được trừ vào tổng số buổi. “Đơn giá riêng” (nếu có) thay cho đơn giá bậc. “Học bổng” và “Giảm trừ” trừ vào tiền, Phải đóng không xuống dưới 0.",
    "4. Số tiền viết đủ đồng: 70000 hoặc 70.000 (không viết 70k hay 1tr). Ô bắt đầu bằng = + - @ được coi là chữ, KiN không chạy công thức.",
    `5. Một lần nhập tối đa ${SHEET_MAX_ROWS} dòng. Dòng ví dụ (nếu còn) KiN sẽ bỏ qua. Sau khi tải lên, KiN cho cô XEM TRƯỚC rồi cô bấm xác nhận mới ghi.`,
    `Bảng bậc hiện hành của lớp: ${tiers}. Môn: ${config.subjects.join(", ")}.`,
  ];
}

export async function hocPhiSheetTemplate(p: { config: SheetConfig; ym: string; periodLabel: string; roster: { studentId: string; name: string }[] }): Promise<Uint8Array> {
  const mod = await import("exceljs");
  const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new Workbook();
  wb.creator = "KiN";
  const headers = templateHeaders(p.config.subjects);
  const ws = wb.addWorksheet(`Học phí ${p.ym}`, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(headers);
  const example = headers.map(() => "");
  example[0] = `${SHEET_EXAMPLE_MARK} Mai Anh`;
  ws.addRow(example);
  for (const s of p.roster) {
    const row = headers.map(() => "");
    row[0] = s.studentId;
    row[1] = s.name;
    ws.addRow(row);
  }
  headers.forEach((h, i) => { ws.getColumn(i + 1).width = i === 0 ? 28 : i === 1 ? 26 : Math.max(10, Math.min(18, h.length + 3)); });
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle", wrapText: true };
  head.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF9" } }; });

  const guide = wb.addWorksheet("Cách điền");
  templateGuide(p.config, p.periodLabel).forEach(line => guide.addRow([line]));
  guide.getColumn(1).width = 120;
  guide.getRow(1).font = { bold: true, size: 13 };
  guide.eachRow(row => { row.getCell(1).alignment = { wrapText: true, vertical: "top" }; });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
