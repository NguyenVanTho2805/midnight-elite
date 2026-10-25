// QZ — dựng tệp Excel MẪU để gia sư nhập câu hỏi hàng loạt. Chỉ chạy phía máy chủ (exceljs nạp động như attendanceXlsx.ts).
// Mọi ô ghi bằng GIÁ TRỊ chuỗi (không công thức). Cột và luật khớp quizSheetImport.ts; hàng ví dụ mở đầu bằng EXAMPLE_MARK để nhập lên mà quên xoá thì KiN bỏ qua và báo.
import { EXAMPLE_MARK, SHEET_HEADERS, SHEET_MAX_ROWS, SHEET_NAME } from "@/lib/quizSheetImport";

export const TEMPLATE_FILENAME = "kin-mau-nhap-cau-hoi.xlsx";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const TEMPLATE_EXAMPLES: string[][] = [
  [`${EXAMPLE_MARK} Thủ đô của Việt Nam là gì?`, "Hà Nội", "Huế", "Đà Nẵng", "Cần Thơ", "A", "1", "Hà Nội là thủ đô của Việt Nam.", ""],
  [`${EXAMPLE_MARK} Chọn các số chẵn.`, "2", "3", "4", "5", "A,C", "2", "Câu nhiều đáp án: chọn đủ cả hai mới được trọn điểm.", ""],
];

export const TEMPLATE_GUIDE: string[] = [
  "Cách dùng bảng mẫu nhập câu hỏi của KiN",
  "1. Mỗi hàng ở trang “Câu hỏi” là một câu trắc nghiệm. Cô xoá hai hàng ví dụ rồi nhập câu của cô (hàng ví dụ còn sót thì KiN bỏ qua và báo).",
  "2. Cột 1: nội dung câu hỏi. Cột 2-5: đáp án A, B, C, D (để trống ô nào không dùng, cần ít nhất 2 đáp án).",
  "3. Cột 6 “Đáp án đúng”: một chữ cái (B) là câu một đáp án; nhiều chữ cái (A,C) là câu nhiều đáp án, học sinh chọn đủ và đúng mới được trọn điểm.",
  "4. Cột 7 “Điểm”: số lớn hơn 0; để trống thì tính 1 điểm. Cột 8 “Giải thích” và cột 9 “Gợi ý” không bắt buộc.",
  `5. Một lần nhập tối đa ${SHEET_MAX_ROWS} câu. Bảng này chỉ nhận câu trắc nghiệm; câu tự luận, Đúng-Sai và trả lời ngắn cô thêm tay ở trình soạn quiz.`,
  "6. Lưu tệp (.xlsx hoặc .csv) rồi vào Bài tập → Nhập đề từ tệp → “Nhập từ bảng Excel”. KiN đọc ngay trên máy cô, không gửi tệp đi đâu và không tốn lượt AI. Cô vẫn rà từng câu trước khi lưu thành bản nháp.",
];

export async function quizSheetTemplate(): Promise<Uint8Array> {
  const mod = await import("exceljs");
  const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new Workbook();
  wb.creator = "KiN";
  const ws = wb.addWorksheet(SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow([...SHEET_HEADERS]);
  for (const r of TEMPLATE_EXAMPLES) ws.addRow(r);
  const widths = [48, 22, 22, 22, 22, 14, 8, 36, 24];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };
  header.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF9" } }; });
  ws.eachRow(row => row.eachCell(cell => { cell.alignment = { ...cell.alignment, vertical: "top", wrapText: true }; }));

  const guide = wb.addWorksheet("Hướng dẫn");
  TEMPLATE_GUIDE.forEach(line => guide.addRow([line]));
  guide.getColumn(1).width = 120;
  guide.getRow(1).font = { bold: true, size: 13 };
  guide.eachRow(row => { row.getCell(1).alignment = { wrapText: true, vertical: "top" }; });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
