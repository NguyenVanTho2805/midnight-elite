// ĐX-03 (NC1-045) — xuất bảng điểm danh tháng: lưới thuần (src/lib/attendanceExport.ts), CSV, tệp Excel đọc lại bằng exceljs.
// Không cần DB hay máy chủ. Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-attendance-export-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Workbook } from "exceljs";
import {
  buildAttendanceGrid, cellText, exportFileName, gridToMatrix, monthRangeUtc, parseExportMonth, sheetNameOf,
  GRID_LEGEND, HEADER_ROW_INDEX, SUMMARY_HEADERS, type GridRecord, type GridSession, type GridStudent,
} from "@/lib/attendanceExport";
import { attendanceXlsx } from "@/lib/attendanceXlsx";
import { toCsv } from "@/lib/revenue";
import { check, section, done } from "./h";

const INJ = '=HYPERLINK("http://x.test","bấm")';
const D = (s: string) => new Date(s);
// Phiên cố ý đưa vào KHÔNG theo thứ tự ngày để kiểm sắp xếp
const sessions: GridSession[] = [{ id: "s3", dateKey: "2026-10-13" }, { id: "s1", dateKey: "2026-10-06" }, { id: "s2", dateKey: "2026-10-08" }];
const students: GridStudent[] = [
  { id: "bi", name: "Bình", enrolledAt: D("2026-10-07T03:00:00Z"), active: true },   // ghi danh 07/10 → chưa thuộc lớp ở buổi 06/10
  { id: "an", name: "An", enrolledAt: D("2026-09-01T00:00:00Z"), active: true },
  { id: "chi", name: "Chi", enrolledAt: D("2026-09-01T00:00:00Z"), active: false },  // đã rời lớp, có bản ghi buổi 06/10
  { id: "dung", name: "Dũng", enrolledAt: D("2026-09-01T00:00:00Z"), active: false }, // đã rời lớp, không bản ghi nào → không có mặt trong bảng
  { id: "inj", name: INJ, enrolledAt: D("2026-09-01T00:00:00Z"), active: true },
  { id: "nay", name: "Nga", enrolledAt: D("2026-10-08T01:00:00Z"), active: true },  // ghi danh đúng ngày 08/10 (giờ VN) → buổi 08/10 vẫn tính
];
const records: GridRecord[] = [
  { sessionId: "s1", userId: "an", status: "present" }, { sessionId: "s2", userId: "an", status: "late" }, { sessionId: "s3", userId: "an", status: "absent" },
  { sessionId: "s2", userId: "bi", status: "excused" },
  { sessionId: "s1", userId: "chi", status: "present" },
  { sessionId: "sNGOAI", userId: "an", status: "absent" },     // phiên ngoài tháng → bỏ
  { sessionId: "s2", userId: "nay", status: "weird" },          // trạng thái lạ → coi như chưa điểm danh
];
const g = buildAttendanceGrid({ courseName: "Toán 9 — lớp A", month: "2026-10", sessions, students, records });
const row = (id: string) => g.rows.find(r => r.id === id)!;

section("Cột ngày và hàng học sinh");
check("cột ngày sắp tăng dần dù phiên đưa vào lộn xộn, nhãn dd/mm", g.dates.map(d => d.label).join() === "06/10,08/10,13/10" && g.monthLabel === "Tháng 10/2026", g.dates);
check("hàng: em đang học + em đã rời nhưng có bản ghi; em đã rời không bản ghi (Dũng) không có mặt", g.rows.map(r => r.id).sort().join() === "an,bi,chi,inj,nay" && !g.rows.some(r => r.id === "dung"), g.rows.map(r => r.id));
check("hàng sắp theo tên tiếng Việt (An trước Bình trước Chi)", ["an", "bi", "chi"].every((id, k, a) => k === 0 || g.rows.findIndex(r => r.id === a[k - 1]) < g.rows.findIndex(r => r.id === id)), g.rows.map(r => r.name));

section("Ô: trạng thái, trống, '–'");
check("An: có mặt / muộn / vắng đúng ngày", row("an").cells.join() === "present,late,absent", row("an").cells);
check("Bình ghi danh 07/10: buổi 06/10 là '–' (chưa thuộc lớp), 08/10 có phép, 13/10 TRỐNG (chưa điểm danh)", row("bi").cells.join() === "na,excused," && row("bi").cells[2] === null, row("bi").cells);
check("Chi đã rời lớp: có bản ghi 06/10; các buổi còn lại '–' (không đòi điểm danh)", row("chi").cells.join() === "present,na,na", row("chi").cells);
check("ghi danh ĐÚNG ngày buổi (theo giờ VN) thì buổi đó vẫn tính; trạng thái lạ → trống, không phải vắng", row("nay").cells.join() === "na,,"  && row("nay").cells[1] === null && row("nay").counts.unmarked === 2, row("nay").cells);
check("bản ghi của phiên ngoài tháng bị bỏ (An không có thêm 'vắng')", row("an").counts.absent === 1);

section("Số đếm và chuyên cần");
check("An: có mặt 1, muộn 1, vắng 1, chưa điểm danh 0", JSON.stringify(row("an").counts) === JSON.stringify({ present: 1, late: 1, excused: 0, absent: 1, unmarked: 0 }), row("an").counts);
check("An: chuyên cần = (1 + 0,9 + 0,5)/3 = 80%", row("an").rate === 80, row("an").rate);
check("Bình: có phép 1, chưa điểm danh 1 ('–' không đếm là thiếu); chuyên cần 80% (một buổi có phép, hệ số 0,8)", row("bi").counts.excused === 1 && row("bi").counts.unmarked === 1 && row("bi").rate === 80, [row("bi").counts, row("bi").rate]);
check("Chi: 100% và chưa điểm danh 0 (em đã rời lớp không bị đếm thiếu)", row("chi").rate === 100 && row("chi").counts.unmarked === 0);
check("em chưa có bản ghi nào → chuyên cần null (không phải 0%)", row("inj").rate === null && row("inj").counts.unmarked === 3);

section("Tháng chưa có buổi nào");
const empty = buildAttendanceGrid({ courseName: "Lớp", month: "2026-11", sessions: [], students, records: [] });
check("không cột ngày; vẫn liệt kê em đang học, mọi số đếm 0, chuyên cần null", empty.dates.length === 0 && empty.rows.map(r => r.id).sort().join() === "an,bi,inj,nay" && empty.rows.every(r => r.cells.length === 0 && r.counts.unmarked === 0 && r.rate === null), empty.rows);

section("Tháng hợp lệ");
const NOW = new Date("2026-10-21T20:00:00Z"); // 03:00 sáng 22/10 giờ VN
check("YYYY-MM hợp lệ", parseExportMonth("2026-10").ok && parseExportMonth("2020-01").ok && parseExportMonth("2100-12").ok);
check("sai định dạng / ngoài khoảng bị từ chối", ["2026-13", "2026-00", "2019-12", "2101-01", "abc", "2026-1", "2026-10-05", "2026/10", " 2026-10", "2026-10; drop"].every(s => !parseExportMonth(s).ok));
check("thiếu / rỗng → tháng hiện tại theo giờ VN (kể cả sát ranh giới tháng)", (() => {
  const a = parseExportMonth(null, NOW), b = parseExportMonth("", NOW), c = parseExportMonth(undefined, new Date("2026-10-31T18:00:00Z")); // 01:00 ngày 01/11 giờ VN
  return a.ok && a.month === "2026-10" && b.ok && b.month === "2026-10" && c.ok && c.month === "2026-11";
})());
const r10 = monthRangeUtc("2026-10"), r12 = monthRangeUtc("2026-12");
check("khoảng [đầu tháng, đầu tháng sau) theo 00:00 UTC, kể cả tháng 12 sang năm sau", r10.start.toISOString() === "2026-10-01T00:00:00.000Z" && r10.endExclusive.toISOString() === "2026-11-01T00:00:00.000Z" && r12.endExclusive.toISOString() === "2027-01-01T00:00:00.000Z");

const daysIn = (mo: string) => { const r = monthRangeUtc(mo); return (r.endExclusive.getTime() - r.start.getTime()) / 86_400_000; };
check("độ dài tháng đúng: 28 (02/2026) · 29 (02/2028 nhuận) · 30 (09/2026) · 31 (10/2026)", daysIn("2026-02") === 28 && daysIn("2028-02") === 29 && daysIn("2026-09") === 30 && daysIn("2026-10") === 31);
{
  // Buổi cuối tháng 28 ngày vào trong lưới, buổi 01/03 thì không (cùng danh sách buổi do API lọc theo khoảng này)
  const r = monthRangeUtc("2026-02");
  const inRange = (d: string) => new Date(`${d}T00:00:00Z`) >= r.start && new Date(`${d}T00:00:00Z`) < r.endExclusive;
  check("ngày 28/02 thuộc tháng 02/2026, ngày 01/03 và 31/01 thì không", inRange("2026-02-28") && inRange("2026-02-01") && !inRange("2026-03-01") && !inRange("2026-01-31"));
}

section("Ma trận CSV / Excel");
const m = gridToMatrix(g);
check("2 dòng đề + dòng trống + tiêu đề ở đúng chỉ số", m[0].join("|") === "Điểm danh|Toán 9 — lớp A" && m[1].join("|") === "Tháng|10/2026" && m[2].length === 0 && m[HEADER_ROW_INDEX].join("|") === ["STT", "Học sinh", "06/10", "08/10", "13/10", ...SUMMARY_HEADERS].join("|"), m.slice(0, 4));
const anRow = m.find(r => r[1] === "An")!;
check("dòng An: ký hiệu ✓ M V rồi 5 số đếm và 80", anRow.join("|") === [2, "An", "✓", "M", "V", 1, 1, 0, 1, 0, 80].join("|") || anRow.slice(1).join("|") === ["An", "✓", "M", "V", 1, 1, 0, 1, 0, 80].join("|"), anRow);
check("dòng cuối là chú giải; trước nó là dòng trống", m[m.length - 1][0] === GRID_LEGEND && m[m.length - 2].length === 0);
check("cellText: trống cho chưa điểm danh, '–' cho không thuộc lớp", cellText(null) === "" && cellText("na") === "–" && cellText("late") === "M");
const csv = toCsv(m);
check("CSV có BOM UTF-8 và xuống dòng CRLF", csv.startsWith("﻿") && csv.includes("\r\n"));
check("CSV chống tiêm công thức: tên bắt đầu bằng '=' được đặt dấu nháy đơn đứng đầu", csv.includes(`'=HYPERLINK`) && !/(^|,)=HYPERLINK/m.test(csv), csv.split("\r\n").find(l => l.includes("HYPERLINK")));
check("CSV giữ ký hiệu ✓ và tên có dấu", csv.includes("✓") && csv.includes("Toán 9 — lớp A"));

section("Tên tệp, tên sheet");
check("tên tệp chỉ ASCII, bỏ dấu tên lớp, có tháng và đuôi", exportFileName("Toán 9 — lớp A", "2026-10", "csv") === "diem-danh-toan-9-lop-a-2026-10.csv" && /^[\x20-\x7e]+$/.test(exportFileName("Lớp “Ôn thi” \"x\" \\ ../", "2026-10", "xlsx")));
check("tên lớp toàn ký tự lạ → 'lop'; tên rất dài bị cắt", exportFileName("🙂🙂", "2026-10", "xlsx") === "diem-danh-lop-2026-10.xlsx" && exportFileName("a".repeat(200), "2026-10", "csv").length < 60);
check("tên sheet ≤ 31 ký tự và không chứa : \\ / ? * [ ]", sheetNameOf("2026-10") === "Điểm danh 10-2026" && sheetNameOf("2026-10").length <= 31 && !/[:\\/?*[\]]/.test(sheetNameOf("2026-10")));

(async () => {
  section("Tệp Excel: đọc lại bằng exceljs");
  const bytes = await attendanceXlsx(g);
  check("ra tệp xlsx thật (ZIP 'PK'), không rỗng", bytes.length > 1000 && bytes[0] === 0x50 && bytes[1] === 0x4b, bytes.length);
  const wb = new Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const ws = wb.worksheets[0];
  check("một sheet, đúng tên", wb.worksheets.length === 1 && ws.name === "Điểm danh 10-2026", wb.worksheets.map(w => w.name));
  check("dòng đề: tên lớp, tháng", ws.getRow(1).getCell(2).value === "Toán 9 — lớp A" && ws.getRow(2).getCell(2).value === "10/2026");
  const hdr = ws.getRow(HEADER_ROW_INDEX + 1);
  check("tiêu đề ngày và nhóm số đếm đúng cột", hdr.getCell(3).value === "06/10" && hdr.getCell(4).value === "08/10" && hdr.getCell(5).value === "13/10" && hdr.getCell(6).value === "Có mặt" && hdr.getCell(11).value === "Chuyên cần (%)");
  let anR = 0; ws.eachRow((r, n) => { if (r.getCell(2).value === "An") anR = n; });
  const an = ws.getRow(anR);
  check("dòng An: ký hiệu ✓ M V và số đếm là KIỂU SỐ (Excel cộng trừ được)", an.getCell(3).value === "✓" && an.getCell(4).value === "M" && an.getCell(5).value === "V" && [1, 1, 0, 1, 0, 80].every((v, k) => an.getCell(6 + k).value === v && typeof an.getCell(6 + k).value === "number"), [3, 4, 5, 6, 7, 8, 9, 10, 11].map(c => an.getCell(c).value));
  let injR = 0; ws.eachRow((r, n) => { if (typeof r.getCell(2).value === "string" && String(r.getCell(2).value).startsWith("=HYPERLINK")) injR = n; });
  const injCell = ws.getRow(injR).getCell(2);
  check("tên '=HYPERLINK(...)' ra đúng CHỮ đó, không phải công thức", injR > 0 && typeof injCell.value === "string" && injCell.value === INJ && !injCell.formula, injCell.value);
  const v = ws.views[0] as { state?: string; xSplit?: number; ySplit?: number };
  check("đóng băng tiêu đề và hai cột đầu", v.state === "frozen" && v.xSplit === 2 && v.ySplit === HEADER_ROW_INDEX + 1, v);
  const lastVals: unknown[] = []; ws.eachRow(r => lastVals.push(r.getCell(1).value));
  check("dòng cuối là chú giải", lastVals[lastVals.length - 1] === GRID_LEGEND, lastVals[lastVals.length - 1]);

  section("Nối vào API và giao diện (quét mã nguồn)");
  const root = process.cwd();
  const api = readFileSync(join(root, "src/app/api/courses/[id]/attendance-export/route.ts"), "utf8");
  check("API đòi quyền quản lý lớp rồi kiểm chủ lớp (ownsResource); lớp không có → 404, không phải chủ → 403", /requirePermission\(PERMISSIONS\.MANAGE_COURSES\)/.test(api) && /ownsResource\(auth, course\.ownerId\)/.test(api) && /fail\(404/.test(api) && /fail\(403/.test(api));
  check("API không bao giờ cache (tên học sinh là dữ liệu cá nhân) kể cả lỗi", /"Cache-Control": "no-store"/.test(api) && /headers: NO_STORE/.test(api));
  check("API kiểm tháng và định dạng → 400; có đủ json / csv / xlsx", /parseExportMonth\(/.test(api) && /fail\(400, "month/.test(api) && /fail\(400, "format/.test(api) && /\["json", "csv", "xlsx"\]/.test(api));
  check("CSV đi qua toCsv (chống tiêm công thức) và tên tệp qua exportFileName", /toCsv\(gridToMatrix\(grid\)\)/.test(api) && /exportFileName\(/.test(api));
  check("API chỉ đọc lớp của chính nó: mọi truy vấn đều khoá theo courseId", /attendanceSession\.findMany\(\{\s*where: \{ courseId: id/.test(api) && /enrollment\.findMany\(\{ where: \{ courseId: id/.test(api));
  const page = readFileSync(join(root, "src/app/(admin)/admin/khoa-hoc/[id]/diem-danh/page.tsx"), "utf8");
  check("trang điểm danh có 3 nút: Tải CSV, Tải Excel, In / Lưu PDF (tháng của ngày đang chọn)", /format=csv/.test(page) && /format=xlsx/.test(page) && /diem-danh\/in\?month=/.test(page) && /Tải CSV/.test(page) && /Tải Excel/.test(page) && /In \/ Lưu PDF/.test(page));
  const inPage = readFileSync(join(root, "src/app/(admin)/admin/khoa-hoc/[id]/diem-danh/in/page.tsx"), "utf8");
  check("trang in: window.print, khổ A4 ngang, chỉ in khối .kin-print, bọc Suspense, đọc ?month=", /window\.print\(\)/.test(inPage) && /@page \{ size: A4 landscape/.test(inPage) && /body \* \{ visibility: hidden/.test(inPage) && /<Suspense/.test(inPage) && /useSearchParams\(\)\.get\("month"\)/.test(inPage));
  check("trang in lấy dữ liệu từ cùng API (format=json) nên khớp CSV / Excel", /attendance-export\?month=\$\{month\}&format=json/.test(inPage));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
