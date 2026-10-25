// Nhập hàng loạt (LO-06 dán, LO-17 CSV/Excel + lịch): đọc chữ → dòng đã kiểm + lỗi TỪNG DÒNG. Hàm THUẦN (src/lib/studentImport.ts), không cần máy chủ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-student-import-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeKey } from "@/lib/tutorArea";
import { parseAgeCell, parseDayOfWeek, parseScheduleImport, parseStudentImport, parseTimeCell, type ImportContext } from "@/lib/studentImport";
import { check, section, done } from "./h";

const NOW = new Date("2026-10-23T05:00:00Z");
const ctx = (o: Partial<ImportContext> = {}): ImportContext => ({
  defaultGroup: "7to15", customByKey: new Map([[normalizeKey("Lớp ở trường"), "cf1"]]), courseByKey: new Map([[normalizeKey("Toán 9"), "c-toan"], [normalizeKey("Văn 8"), "c-van"]]),
  now: NOW, maxRows: 100, ...o,
});
const P = (t: string, o: Partial<ImportContext> = {}) => parseStudentImport(t, ctx(o));
const names = (t: string, o: Partial<ImportContext> = {}) => P(t, o).rows.map(r => r.data.name).join("|");
const errs = (t: string, o: Partial<ImportContext> = {}) => P(t, o).errors.map(e => `${e.line}:${e.message}`).join(" || ");

(async () => {
  section("Dán danh sách không có tiêu đề (LO-06)");
  check("chỉ tên, mỗi dòng một em", names("Minh Anh\nQuốc Huy\nBảo Ngọc") === "Minh Anh|Quốc Huy|Bảo Ngọc");
  check("'Tên, SĐT' → SĐT là của phụ huynh, chuẩn hoá 10 số", (() => { const r = P("Minh Anh, 0912 345 678"); return r.rows[0]?.data.guardianPhone === "0912345678" && r.errors.length === 0; })());
  check("dán từ Excel (TAB) và dấu ; | cũng tách được", names("A An\t0912345678\nB Bình;0987654321\nC Cúc|0905123456") === "A An|B Bình|C Cúc");
  check("'SĐT, Tên' (số đứng trước) vẫn nhận đúng", (() => { const r = P("0912345678, Minh Anh"); return r.rows[0]?.data.name === "Minh Anh" && r.rows[0]?.data.guardianPhone === "0912345678"; })());
  check("hai số: số đầu của phụ huynh, số hai của em", (() => { const r = P("Minh Anh, 0912345678, 0987654321"); return r.rows[0]?.data.guardianPhone === "0912345678" && r.rows[0]?.data.phone === "0987654321" && r.rows[0]?.hasExtended; })());
  check("dòng dán có thừa cột chữ (không tiêu đề) → báo lỗi nói cách sửa, KHÔNG bỏ lặng lẽ; hai ô chữ = tên em + tên phụ huynh", errs("A An, Chị Hoa, Dư, 0912345678").includes("tiêu đề") && P("Bé Một, Chị Hoa, 0912345678").rows[0]?.data.guardianName === "Chị Hoa");
  check("dòng chỉ có số, không tên → lỗi 'Thiếu tên em' đúng số dòng", errs("A An\n0912345678\nB Bình") === "2:Thiếu tên em", errs("A An\n0912345678\nB Bình"));
  check("số điện thoại sai → lỗi nêu ô, KHÔNG lưu dòng đó", (() => { const r = P("A An, 0912\nB Bình, 0987654321"); return r.rows.length === 1 && r.errors[0].line === 1 && r.errors[0].message.includes("10 chữ số"); })());
  check("dòng trống bỏ qua nhưng vẫn tính số thứ tự dòng khi báo lỗi", errs("A An\n\n\n0912345678") === "4:Thiếu tên em", errs("A An\n\n\n0912345678"));
  check("CRLF (Windows) và BOM đầu tệp đều đọc được", names("﻿A An\r\nB Bình\r\n") === "A An|B Bình");
  check("danh sách rỗng / chỉ khoảng trắng → 0 dòng, 0 lỗi", P("").rows.length === 0 && P("   \n\t\n").rows.length === 0 && P("   \n\t\n").errors.length === 0);
  check("dòng không tiêu đề mặc định nhóm tuổi cả lần nhập + cần phụ huynh và em", (() => { const r = P("Minh Anh"); return r.rows[0].data.ageGroup === "7to15" && r.parties.join() === "guardian,child"; })());

  section("Có dòng tiêu đề (LO-17): nhận cột kể cả khi thiếu dấu");
  const hdr = "Họ tên,Tên phụ huynh,SĐT phụ huynh,Ngày sinh,Địa chỉ,Môn,Ghi chú,Lớp,Trạng thái\nMinh Anh,Chị Hoa,0912345678,15/03/2014,1 Lê Lợi,\"Toán, Lý\",hay quên,Toán 9,Đang chờ\n";
  const r1 = P(hdr);
  check("đọc đủ cột, ngày sinh dd/mm/yyyy → yyyy-mm-dd, môn có dấu phẩy trong ngoặc kép, lớp → courseId, trạng thái → waitlist", (() => { const d = r1.rows[0]?.data; return r1.errors.length === 0 && d?.birthDate === "2014-03-15" && d?.subjects?.join() === "Toán,Lý" && d?.courseId === "c-toan" && d?.status === "waitlist" && d?.guardianName === "Chị Hoa" && d?.address === "1 Lê Lợi"; })(), r1.errors);
  check("tiêu đề không dấu / viết hoa khác vẫn nhận (HO TEN, sdt phu huynh)", P("HO TEN;SDT PHU HUYNH\nMinh Anh;0912345678").rows[0]?.data.guardianPhone === "0912345678");
  check("báo cột nhận ra / cột bị bỏ qua", (() => { const r = P("Họ tên,Cột lạ,Màu tóc\nA An,x,y"); return r.mapped.join() === "Họ tên" && r.ignored.join() === "Cột lạ,Màu tóc"; })());
  check("không có cột tên → từ chối cả tệp, nêu rõ", (() => { const r = P("SĐT phụ huynh,Ngày sinh\n0912345678,01/01/2012"); return r.rows.length === 0 && r.tooMany && r.errors[0].message.includes("cột tên"); })());
  check("trường tuỳ chỉnh nhận theo tên cột (của gia sư), lưu theo id", P("Họ tên,Lớp ở trường\nA An,6A").rows[0]?.data.customData?.cf1 === "6A");
  check("cột trùng tên trường tuỳ chỉnh của NGƯỜI KHÁC không được nhận (không nằm trong customByKey)", P("Họ tên,Sở thích\nA An,đá bóng").ignored.join() === "Sở thích" && P("Họ tên,Sở thích\nA An,đá bóng").rows[0]?.data.customData === undefined);
  check("lớp trong tệp KHÔNG phải lớp của gia sư → lỗi dòng đó, nêu tên lớp", errs("Họ tên,Lớp\nA An,Lý 12 của người khác\nB Bình,Toán 9") === "2:Lớp “Lý 12 của người khác” không phải lớp của bạn");
  check("lớp mặc định áp cho dòng không ghi lớp; dòng ghi lớp thì theo dòng", (() => { const r = P("Họ tên,Lớp\nA An,\nB Bình,Văn 8", { defaultCourseId: "c-toan" }); return r.rows[0].data.courseId === "c-toan" && r.rows[1].data.courseId === "c-van"; })());
  check("trạng thái lạ → lỗi dòng; mặc định theo lần nhập (vd. chờ xếp lớp)", errs("Họ tên,Trạng thái\nA An,bậy").includes("Trạng thái") && P("A An", { defaultStatus: "waitlist" }).rows[0].data.status === "waitlist");

  section("Nhóm tuổi quyết định ai phải đồng ý");
  check("parseAgeCell: số tuổi, 'dưới 7', '7-15', '16+', 'u7', ký tự bậy", parseAgeCell("5") === "u7" && parseAgeCell("12 tuổi") === "7to15" && parseAgeCell("Dưới 7") === "u7" && parseAgeCell("7-15") === "7to15" && parseAgeCell("16+") === "16plus" && parseAgeCell("Từ 16 tuổi trở lên") === "16plus" && parseAgeCell("u7") === "u7" && parseAgeCell("abc") === null && parseAgeCell("") === null && parseAgeCell("150") === null);
  check("cột Nhóm tuổi không đọc được → lỗi dòng (không đoán)", errs("Họ tên,Nhóm tuổi\nA An,bậy bạ").includes("Nhóm tuổi"));
  check("hợp các bên: 1 em 5 tuổi + 1 em 16+ → phụ huynh và chính người học (không cần 'em')", (() => { const r = P("Họ tên,Nhóm tuổi\nA An,5\nB Bình,16+"); return r.parties.join() === "guardian,self"; })());
  check("có ngày sinh thì ngày sinh quyết định, dù ô nhóm tuổi nói 16+", (() => { const r = P("Họ tên,Nhóm tuổi,Ngày sinh\nA An,16+,01/01/2016"); return r.rows[0].parties.join() === "guardian,child"; })());
  check("có thông tin mở rộng → hasExtended (để hộp xác nhận thêm phạm vi)", P("Họ tên,Địa chỉ\nA An,1 Lê Lợi").hasExtended && !P("Họ tên,SĐT phụ huynh\nA An,0912345678").hasExtended);

  section("Trùng lặp");
  check("cùng tên + cùng SĐT phụ huynh → giữ 1, đếm số dòng bị gộp", (() => { const r = P("Minh Anh, 0912345678\nminh anh,0912 345 678\nMinh Anh, 0912345678"); return r.rows.length === 1 && r.duplicates === 2; })());
  check("anh chị em cùng SĐT phụ huynh nhưng khác tên → giữ cả hai", P("Minh Anh, 0912345678\nMinh Khôi, 0912345678").rows.length === 2);

  section("Giới hạn số dòng (cấu hình)");
  const mk = (n: number) => Array.from({ length: n }, (_, i) => `Em ${i}x`).join("\n");
  check("đúng maxRows → nhận hết", P(mk(100)).rows.length === 100 && !P(mk(100)).tooMany);
  check("maxRows + 1 → TỪ CHỐI cả lần nhập (0 dòng) kèm lỗi nêu số lượng, không cắt lặng lẽ", (() => { const r = P(mk(101)); return r.tooMany && r.rows.length === 0 && r.errors[0].message.includes("101") && r.errors[0].message.includes("100"); })());
  check("cấu hình maxRows nhỏ hơn có hiệu lực (3)", P(mk(4), { maxRows: 3 }).tooMany && P(mk(3), { maxRows: 3 }).rows.length === 3);
  check("tiêu đề không tính vào số dòng", P("Họ tên\n" + mk(100)).rows.length === 100);
  check("tệp quá lớn → từ chối", P("x".repeat(500_000)).tooMany);

  section("Dữ liệu độc hại / công thức Excel được coi là CHỮ");
  check("ô bắt đầu bằng = + - @ giữ nguyên như chữ (không chạy công thức)", (() => { const r = P("Họ tên,Ghi chú\nA An,\"=HYPERLINK(\"\"http://x\"\",\"\"a\"\")\""); return r.rows[0]?.data.notes === '=HYPERLINK("http://x","a")'; })());
  check("ký tự vô hình trong tên bị làm sạch", P("A​An‮").rows[0]?.data.name === "A An");
  check("fuzz: 300 chuỗi ngẫu nhiên không ném lỗi và kết quả luôn đúng kiểu", (() => {
    const al = ["a", "Á", " ", ",", ";", "\t", "\n", "\r", "\"", "0", "9", "=", "-", "/", "đ", "|", "'"];
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 300; i++) {
      let s = ""; const n = Math.floor(rnd() * 120); for (let j = 0; j < n; j++) s += al[Math.floor(rnd() * al.length)];
      const r = parseStudentImport(s, ctx()); const q = parseScheduleImport(s, { courseByKey: ctx().courseByKey, maxRows: 100 });
      if (!Array.isArray(r.rows) || !Array.isArray(r.errors) || !Array.isArray(q.rows) || !Array.isArray(q.errors)) return false;
      if (r.rows.some(x => !x.data.name || !x.data.ageGroup || x.parties.length === 0)) return false;
    }
    return true;
  })());

  section("Lịch học hàng tuần (LO-17)");
  check("parseDayOfWeek: 2..7, T2..T7, CN, 'Thứ Hai', 'thu ba', 8", [parseDayOfWeek("2"), parseDayOfWeek("T3"), parseDayOfWeek("CN"), parseDayOfWeek("Thứ Hai"), parseDayOfWeek("thu ba"), parseDayOfWeek("7"), parseDayOfWeek("8")].join() === "1,2,0,1,2,6,0");
  check("thứ sai (1, 9, rỗng, chữ) → null", [parseDayOfWeek("1"), parseDayOfWeek("9"), parseDayOfWeek(""), parseDayOfWeek("hôm nào")].every(x => x === null));
  check("parseTimeCell: 19:00, 19h, 19h30, 7:05, 7h5 → HH:mm; 25:00, 19:75, chữ → null", [parseTimeCell("19:00"), parseTimeCell("19h"), parseTimeCell("19h30"), parseTimeCell("7:05"), parseTimeCell("7h5")].join() === "19:00,19:00,19:30,07:05,07:05" && [parseTimeCell("25:00"), parseTimeCell("19:75"), parseTimeCell("tối")].every(x => x === null));
  const cb = ctx().courseByKey;
  const S = (t: string, o: { defaultCourseId?: string | null; maxRows?: number } = {}) => parseScheduleImport(t, { courseByKey: cb, maxRows: o.maxRows ?? 100, defaultCourseId: o.defaultCourseId });
  check("có tiêu đề: đọc Lớp/Thứ/Bắt đầu/Kết thúc/Ghi chú", (() => { const r = S("Lớp,Thứ,Bắt đầu,Kết thúc,Ghi chú\nToán 9,2,19:00,21:00,học Zoom"); return r.rows[0]?.courseId === "c-toan" && r.rows[0]?.dayOfWeek === 1 && r.rows[0]?.startTime === "19:00" && r.rows[0]?.endTime === "21:00" && r.rows[0]?.note === "học Zoom"; })());
  check("không tiêu đề + lớp mặc định: cột Thứ, Bắt đầu, Kết thúc", S("5,18h,19h30", { defaultCourseId: "c-van" }).rows[0]?.dayOfWeek === 4);
  check("lỗi từng dòng: lớp lạ, thứ sai, giờ sai, kết thúc ≤ bắt đầu", (() => { const r = S("Lớp,Thứ,Bắt đầu,Kết thúc\nLý 12,2,19:00,20:00\nToán 9,9,19:00,20:00\nToán 9,2,xx,20:00\nToán 9,2,21:00,20:00\nToán 9,3,19:00,20:00"); return r.errors.map(e => e.line).join() === "2,3,4,5" && r.rows.length === 1; })());
  check("trùng khung (cùng lớp, thứ, giờ) bị gộp", (() => { const r = S("Lớp,Thứ,Bắt đầu,Kết thúc\nToán 9,2,19:00,20:00\nToán 9,T2,19h,20h"); return r.rows.length === 1 && r.duplicates === 1; })());
  check("quá số dòng → từ chối", S("Lớp,Thứ,Bắt đầu,Kết thúc\n" + "Toán 9,2,19:00,20:00\n".repeat(5), { maxRows: 4 }).tooMany);

  section("Quét tĩnh");
  const src = readFileSync(join(process.cwd(), "src/lib/studentImport.ts"), "utf8");
  check("lib nhập là thuần: không nạp Prisma / fs / mạng", !/@\/lib\/prisma|node:fs|fetch\(/.test(src));
  check("đã dùng chuỗi thoát cho BOM, không để ký tự vô hình trong mã", !/[​-‏‪-‮﻿]/.test(src));

  await done();
})();
