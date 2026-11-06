// HOCPHI-THEO-BUOI 3.4 — bài THUẦN cho src/lib/hocPhiDashboard.ts (bảng học phí tháng). Có ca phá. Không DB, không mạng.
// Chạy ở cả UTC và TZ=Asia/Ho_Chi_Minh (không phụ thuộc múi giờ máy).
import { buildMonthTable, isYearMonth, monthTableCsvRows, pctChange, prevYearMonth, type ChargeRow } from "@/lib/hocPhiDashboard";
import { check, section, done } from "./h";

const ch = (courseId: string, studentId: string, ym: string, amount: number, o: Partial<ChargeRow> = {}): ChargeRow => ({ courseId, studentId, kind: "session", yearMonth: ym, amount, invoiceId: null, ...o });
const sess = (courseId: string, date: string) => ({ courseId, date: new Date(`${date}T00:00:00.000Z`) });

(async () => {
section("prevYearMonth / isYearMonth");
check("01 → tháng 12 năm trước; 12 → 11; 03 → 02", prevYearMonth("2026-01") === "2025-12" && prevYearMonth("2026-12") === "2026-11" && prevYearMonth("2026-03") === "2026-02");
check("đúng: 2026-01, 2026-12", isYearMonth("2026-01") && isYearMonth("2026-12"));
check("[phá] 2026-13, 2026-00, 26-11, '', null, 2026-1, 2026-11-01, ' 2026-11'", ["2026-13", "2026-00", "26-11", "", null, undefined, 2026, "2026-1", "2026-11-01", " 2026-11"].every(v => !isYearMonth(v)));

section("pctChange");
check("prev 0 → null (không chia 0); prev âm → null", pctChange(0, 100) === null && pctChange(0, 0) === null && pctChange(-5, 5) === null);
check("+20,0 (6.000.000 → 7.200.000)", pctChange(6_000_000, 7_200_000) === 20);
check("−33,3 (900.000 → 600.000)", pctChange(900_000, 600_000) === -33.3);
check("cur = prev → 0 (không phải -0)", Object.is(pctChange(500_000, 500_000), 0));
check("làm tròn nửa ra xa số 0: 2000 → 2001 = +0,05% → 0,1; 2000 → 1999 = −0,05% → −0,1", pctChange(2000, 2001) === 0.1 && pctChange(2000, 1999) === -0.1);
check("dưới nửa: 4000 → 4001 = 0,025% → 0,0 (không âm)", Object.is(pctChange(4000, 4001), 0) && Object.is(pctChange(4000, 3999), 0));
check("về 0 → −100,0; tăng gấp ba → +200,0", pctChange(750_000, 0) === -100 && pctChange(100_000, 300_000) === 200);

section("buildMonthTable — hai lớp, hai tháng, số tay tính");
// Toán 9 (per_session): tháng 11 có 3 dòng 150k (em a,b + em a buổi 2) + 1 dòng course? không. Tháng 10: 6.000.000
const courses = [
  { id: "toan", name: "Toán 9", feeMode: "per_session" },
  { id: "ly", name: "Lý 10", feeMode: "per_hour" },
];
const charges: ChargeRow[] = [
  ch("toan", "a", "2026-11", 150_000, { invoiceId: "inv1" }), ch("toan", "b", "2026-11", 150_000, { invoiceId: "inv1" }),
  ch("toan", "a", "2026-11", 150_000), ch("toan", "c", "2026-11", 150_000),
  ch("toan", "a", "2026-11", 50_000, { kind: "extra" }),
  ch("toan", "a", "2026-10", 150_000, { invoiceId: "inv0" }), ch("toan", "b", "2026-10", 150_000, { invoiceId: "inv0" }),
  ch("ly", "a", "2026-11", 100_000, { invoiceId: "invX" }),
  ch("ly", "a", "2026-10", 400_000),
];
const closed = [sess("toan", "2026-11-03"), sess("toan", "2026-11-10"), sess("toan", "2026-10-31"), sess("ly", "2026-11-05")];
const t = buildMonthTable({ ym: "2026-11", courses, charges, closedSessions: closed, legacyInvoices: [], cancelledInvoiceIds: ["invX"] });
const toan = t.rows.find(r => r.courseId === "toan")!, ly = t.rows.find(r => r.courseId === "ly")!;
check("tháng/ tháng trước đúng", t.yearMonth === "2026-11" && t.prevYearMonth === "2026-10");
check("Toán: học phí 600.000 (4 dòng), phí khác 50.000 tách riêng, không lẫn", toan.tuition === 600_000 && toan.extra === 50_000, toan);
check("Toán: 2 buổi chốt trong tháng 11 (buổi 31/10 không tính), 3 học sinh khác nhau", toan.closedSessions === 2 && toan.students === 3, toan);
check("Toán: tháng trước 300.000 → chênh +300.000, +100,0%", toan.prevTuition === 300_000 && toan.delta === 300_000 && toan.deltaPct === 100, toan);
check("Lý: 100.000 (nằm trong phiếu đã huỷ), tháng trước 400.000 → −300.000, −75,0%", ly.tuition === 100_000 && ly.delta === -300_000 && ly.deltaPct === -75, ly);
check("tổng = Σ dòng: tuition 700.000, extra 50.000, prev 700.000, buổi chốt 3", t.totals.tuition === 700_000 && t.totals.extra === 50_000 && t.totals.prevTuition === 700_000 && t.totals.closedSessions === 3, t.totals);
check("tổng %: tính từ hai tổng (700.000 vs 700.000 = 0,0), KHÔNG trung bình +100/−75", t.totals.delta === 0 && t.totals.deltaPct === 0, t.totals);
check("phân ba: đã vào phiếu 300.000 · chưa 300.000 · trong phiếu huỷ 100.000 → cộng đúng bằng tổng", t.totals.invoiced === 300_000 && t.totals.uninvoiced === 300_000 && t.totals.inCancelledInvoice === 100_000 && t.totals.invoiced + t.totals.uninvoiced + t.totals.inCancelledInvoice === t.totals.tuition, t.totals);
check("perSession = 700.000, legacyByInvoice = 0", t.totals.perSession === 700_000 && t.totals.legacyByInvoice === 0);
check("không rỗng", t.emptyMonth === false);
check("[phá] đầu ra không có studentId / tên (quét JSON)", !/"studentId"|"a"|"b"|"c"/.test(JSON.stringify(t).replace(/"courseId"|"courseName"/g, "")) && !JSON.stringify(t).includes("studentId"));

section("tháng rỗng / tháng trước rỗng");
const e = buildMonthTable({ ym: "2026-11", courses, charges: [], closedSessions: [], legacyInvoices: [] });
check("tháng rỗng: emptyMonth, mọi số 0, delta/% null", e.emptyMonth === true && e.totals.tuition === 0 && e.totals.extra === 0 && e.totals.closedSessions === 0 && e.totals.delta === null && e.totals.deltaPct === null && e.rows.every(r => r.tuition === 0 && r.delta === null && r.deltaPct === null), e);
check("hideInactive: lớp không có gì bị bỏ → rows rỗng", buildMonthTable({ ym: "2026-11", courses, charges: [], closedSessions: [], legacyInvoices: [], hideInactive: true }).rows.length === 0);
check("không có lớp nào (gia sư mới) → rows [], emptyMonth", (() => { const z = buildMonthTable({ ym: "2026-11", courses: [], charges: [], closedSessions: [], legacyInvoices: [] }); return z.rows.length === 0 && z.emptyMonth && z.totals.tuition === 0; })());
const onlyNow = buildMonthTable({ ym: "2026-11", courses: [courses[0]], charges: [ch("toan", "a", "2026-11", 150_000)], closedSessions: [], legacyInvoices: [] });
check("tháng trước rỗng: tuition có số nhưng delta / deltaPct null (UI: 'Tháng trước chưa có')", onlyNow.rows[0].tuition === 150_000 && onlyNow.rows[0].prevTuition === 0 && onlyNow.rows[0].delta === null && onlyNow.rows[0].deltaPct === null && onlyNow.totals.delta === null);
check("buổi VẮNG: có buổi chốt nhưng không dòng phí → vào closedSessions, không vào students, học phí 0", (() => { const z = buildMonthTable({ ym: "2026-11", courses: [courses[0]], charges: [], closedSessions: [sess("toan", "2026-11-04")], legacyInvoices: [] }); return z.rows[0].closedSessions === 1 && z.rows[0].students === 0 && z.rows[0].tuition === 0 && z.emptyMonth === false; })());
check("[phá] chỉ có phí khác (tài liệu) → học phí 0, extra có, không rỗng", (() => { const z = buildMonthTable({ ym: "2026-11", courses: [courses[0]], charges: [ch("toan", "a", "2026-11", 80_000, { kind: "extra" })], closedSessions: [], legacyInvoices: [] }); return z.rows[0].tuition === 0 && z.rows[0].extra === 80_000 && z.rows[0].students === 0 && !z.emptyMonth; })());
check("[phá] dòng phí của tháng KHÁC (09) hoặc lớp KHÁC không lọt vào", (() => { const z = buildMonthTable({ ym: "2026-11", courses: [courses[0]], charges: [ch("toan", "a", "2026-09", 999_000), ch("khac", "a", "2026-11", 999_000)], closedSessions: [], legacyInvoices: [] }); return z.totals.tuition === 0 && z.totals.prevTuition === 0; })());
check("dòng kind=course tính vào học phí và số học sinh (lớp per_course)", (() => { const z = buildMonthTable({ ym: "2026-11", courses: [{ id: "k", name: "Khoá", feeMode: "per_course" }], charges: [ch("k", "a", "2026-11", 2_000_000, { kind: "course" }), ch("k", "b", "2026-11", 2_000_000, { kind: "course" })], closedSessions: [], legacyInvoices: [] }); return z.rows[0].tuition === 4_000_000 && z.rows[0].students === 2; })());

section("ranh giới tháng của buổi chốt (múi giờ)");
const edge = buildMonthTable({ ym: "2026-11", courses: [courses[0]], charges: [], legacyInvoices: [],
  closedSessions: [sess("toan", "2026-10-31"), sess("toan", "2026-11-01"), sess("toan", "2026-11-30"), sess("toan", "2026-12-01"), { courseId: "toan", date: "2026-11-30T00:00:00.000Z" }] });
check("buổi 31/10 và 01/12 ngoài tháng; 01/11, 30/11 (Date và chuỗi ISO) trong tháng → 3", edge.rows[0].closedSessions === 3, edge.rows[0]);
check("kết quả như nhau khi chạy ở TZ khác (hàm không đọc giờ địa phương)", (() => { const had = process.env.TZ; process.env.TZ = "Asia/Ho_Chi_Minh"; const x = buildMonthTable({ ym: "2026-11", courses: [courses[0]], charges: [], legacyInvoices: [], closedSessions: [sess("toan", "2026-11-30"), sess("toan", "2026-10-31")] }).rows[0].closedSessions; process.env.TZ = had; return x === 1; })());

section("lớp cũ (theo phiếu)");
const old = [{ id: "cu", name: "Hoá 8", feeMode: "monthly_sessions" }];
const noInv = buildMonthTable({ ym: "2026-11", courses: old, charges: [], closedSessions: [], legacyInvoices: [] });
check("chưa lập phiếu → source invoice, tuition null (UI 'Chưa lập phiếu'), tổng không tính", noInv.rows[0].source === "invoice" && noInv.rows[0].tuition === null && noInv.totals.tuition === 0 && noInv.totals.legacyByInvoice === 0);
const inv = [
  { id: "p1", yearMonth: "2026-11", perSubject: [{ courseId: "cu", subtotal: 560_000 }, { courseId: "khac", subtotal: 100_000 }] },
  { id: "p2", yearMonth: "2026-11", perSubject: [{ courseId: "cu", subtotal: 280_000 }] },
  { id: "p3", yearMonth: "2026-11", perSubject: [{ courseId: "cu", subtotal: 0 }] },
  { id: "p4", yearMonth: "2026-10", perSubject: [{ courseId: "cu", subtotal: 420_000 }] },
  { id: "pc", yearMonth: "2026-11", perSubject: [{ courseId: "cu", subtotal: 9_999_999 }] },
];
const withInv = buildMonthTable({ ym: "2026-11", courses: [...old, courses[0]], charges: [ch("toan", "a", "2026-11", 150_000)], closedSessions: [], legacyInvoices: inv, cancelledInvoiceIds: ["pc"] });
const cu = withInv.rows.find(r => r.courseId === "cu")!;
check("Hoá 8: Σ subtotal phiếu không huỷ = 840.000 (bỏ phiếu huỷ pc, bỏ lớp khác), 2 em có tiền", cu.tuition === 840_000 && cu.students === 2, cu);
check("tháng trước 420.000 → +420.000, +100,0%", cu.prevTuition === 420_000 && cu.delta === 420_000 && cu.deltaPct === 100, cu);
check("tổng tách 'theo buổi' 150.000 / 'cách cũ' 840.000 / cộng 990.000", withInv.totals.perSession === 150_000 && withInv.totals.legacyByInvoice === 840_000 && withInv.totals.tuition === 990_000, withInv.totals);
check("dòng phí của lớp cũ KHÔNG thành 'theo buổi' (phân ba chỉ tính lớp theo buổi)", withInv.totals.invoiced + withInv.totals.uninvoiced + withInv.totals.inCancelledInvoice === 150_000);

section("mốc tháng (phần B): lớp chuyển tháng S dùng hai nguồn theo tháng");
const conv = [{ id: "ch", name: "Văn 7", feeMode: "per_session", classRates: [{ effectiveFrom: "2026-12-01" }] }];
const decInv = [{ id: "q1", yearMonth: "2026-11", perSubject: [{ courseId: "ch", subtotal: 700_000 }] }];
const dec = buildMonthTable({ ym: "2026-12", courses: conv, charges: [ch("ch", "a", "2026-12", 150_000), ch("ch", "a", "2026-11", 77_000)], closedSessions: [], legacyInvoices: decInv });
check("tháng S: nguồn fee_charge, tháng trước (trước mốc) lấy từ PHIẾU 700.000 chứ không từ FeeCharge 77.000", dec.rows[0].source === "fee_charge" && dec.rows[0].tuition === 150_000 && dec.rows[0].prevTuition === 700_000 && dec.rows[0].delta === -550_000, dec.rows[0]);
const nov = buildMonthTable({ ym: "2026-11", courses: conv, charges: [ch("ch", "a", "2026-11", 77_000)], closedSessions: [], legacyInvoices: decInv });
check("tháng trước mốc: nguồn invoice (700.000), bỏ qua FeeCharge lạc", nov.rows[0].source === "invoice" && nov.rows[0].tuition === 700_000, nov.rows[0]);

section("CSV");
const rows = monthTableCsvRows(t);
check("tiêu đề + 2 lớp + dòng Tổng; mọi dòng cùng số cột", rows.length === 4 && rows.every(r => r.length === rows[0].length) && rows[3][0] === "Tổng", rows);
check("[phá] CSV không có studentId / tên em", !JSON.stringify(rows).includes("studentId"));

await done();
})();
