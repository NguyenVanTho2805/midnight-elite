// ĐX-03 (NC1-042) — dựng tệp Excel từ bảng điểm danh tháng. Chỉ chạy phía máy chủ (exceljs nạp động như ở admin/thi-thu).
//
// Mọi ô chữ ghi bằng giá trị chuỗi (không bao giờ là công thức): tên học sinh là dữ liệu tự nhập, "=HYPERLINK(...)" phải ra
// đúng chữ đó, không thành công thức. Khác CSV, ở đây không cần thêm dấu nháy.
import { HEADER_ROW_INDEX, SUMMARY_HEADERS, gridToMatrix, sheetNameOf, type AttendanceGrid } from "@/lib/attendanceExport";

export async function attendanceXlsx(grid: AttendanceGrid): Promise<Uint8Array> {
  // exceljs là gói CommonJS: tuỳ cách nạp (Node thuần, bộ đóng gói) tên `Workbook` nằm ở `default` hoặc ở chính module.
  // Chỉ lấy `{ Workbook }` thẳng từ import() thì có nơi ra undefined ("Workbook is not a constructor") mà tsc không báo.
  const mod = await import("exceljs");
  const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new Workbook();
  wb.creator = "KiN";
  const ws = wb.addWorksheet(sheetNameOf(grid.month), {
    // Đóng băng tiêu đề và hai cột đầu (STT, tên) để cuộn bảng rộng vẫn thấy ai là ai.
    views: [{ state: "frozen", xSplit: 2, ySplit: HEADER_ROW_INDEX + 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const matrix = gridToMatrix(grid);
  matrix.forEach(r => ws.addRow(r));

  const dateCols = grid.dates.length;
  const summaryStart = 3 + dateCols; // cột (1-based) của "Có mặt"
  // Cột A đủ rộng cho "Điểm danh" / "Tháng" ở hai dòng đề (ô B cạnh bên đã có chữ nên A không tràn sang được).
  ws.getColumn(1).width = 13;
  ws.getColumn(2).width = Math.max(18, Math.min(40, ...grid.rows.map(r => r.name.length + 2)));
  for (let c = 3; c < summaryStart; c++) ws.getColumn(c).width = 6;
  for (let c = summaryStart; c < summaryStart + SUMMARY_HEADERS.length; c++) ws.getColumn(c).width = 14;

  ws.getRow(1).font = { bold: true, size: 14 };
  const header = ws.getRow(HEADER_ROW_INDEX + 1);
  header.font = { bold: true };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  header.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF9" } }; });

  // Căn giữa các ô ký hiệu và số; viền mảnh quanh bảng.
  const lastRow = HEADER_ROW_INDEX + 1 + grid.rows.length;
  for (let r = HEADER_ROW_INDEX + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c < summaryStart + SUMMARY_HEADERS.length; c++) {
      const cell = row.getCell(c);
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      if (c !== 2) cell.alignment = { horizontal: "center", vertical: "middle", wrapText: r === HEADER_ROW_INDEX + 1 };
    }
  }
  ws.getRow(lastRow + 2).getCell(1).font = { italic: true }; // dòng chú giải (cuối ma trận, sau một dòng trống)

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
