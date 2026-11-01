// Hộp việc của gia sư — phần thuần (src/lib/tutorInbox.ts): thứ tự dòng, chữ, góc giờ, số việc còn lại.
import { buildInboxItems, inboxTotal, inboxWhen, inboxDateTime, inboxVnd, INBOX_DETAIL_LIMIT, INBOX_KINDS, type InboxRaw, type InboxSource } from "@/lib/tutorInbox";
import { buildHopViecOverview } from "@/lib/tutorOverview";
import { check, section, done } from "./h";

const none: InboxSource = { count: 0, rows: [], at: null };
const raw = (o: Partial<InboxRaw>): InboxRaw => ({ absence: none, check: none, bank: none, consent: none, reports: none, ungraded: none, unmarked: none, reminders: none, makeup: none, invoiceRemind: none, draft: none, ...o });
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Em ${i + 1}`, sub: `chi tiết ${i + 1}`, href: "/lop-cua-toi/lich" }));
const NOW = new Date("2026-10-14T05:00:00Z"); // 12:00 giờ Việt Nam

section("buildInboxItems");
check("không việc nào → rỗng", buildInboxItems(raw({}), NOW).length === 0);
check("loại có count=0 bị bỏ dù còn rows", buildInboxItems(raw({ bank: { count: 0, rows: rows(2), at: null } }), NOW).length === 0);
check("mọi loại việc đều có trong thứ tự khai báo (11, kể cả unmarked của ĐX-01 và invoiceRemind của F2)", INBOX_KINDS.length === 11 && new Set(INBOX_KINDS).size === 11 && INBOX_KINDS.includes("unmarked") && INBOX_KINDS.includes("invoiceRemind"), INBOX_KINDS);
const un = buildInboxItems(raw({ unmarked: { count: 3, rows: [{ title: "Toán 9", sub: "buổi 20/10 19:00 · thiếu 2/5 em: An, Bình", href: "/lop-cua-toi/quan-lop/c1/diem-danh?date=2026-10-20" }], at: "2026-10-20T12:00:00Z" } }), NOW)[0];
check("ĐX-01: 'unmarked' là việc thường (không khẩn), tiêu đề có số buổi, có chữ trạng thái", un.id === "unmarked" && !un.urgent && un.title === "3 buổi đã qua giờ, chưa điểm danh xong" && un.status.label === "Chưa điểm danh" && un.status.tone === "cho", un);
check("ĐX-01: dòng việc dẫn tới trang điểm danh của lớp kèm ngày; khung đọc nói rõ học phí không đổi", un.detail.rows[0].href === "/lop-cua-toi/quan-lop/c1/diem-danh?date=2026-10-20" && /Học phí không đổi/.test(un.detail.meta), un.detail);
const mixedU = buildInboxItems(raw({ unmarked: { count: 9, rows: rows(2), at: null }, bank: { count: 1, rows: rows(1), at: null } }), NOW);
check("ĐX-01: việc khẩn (bank 1) vẫn đứng trước unmarked (9)", mixedU.map(i => i.id).join() === "bank,unmarked", mixedU.map(i => i.id));

const ir = buildInboxItems(raw({ invoiceRemind: { count: 3, rows: [{ title: "Minh Anh", sub: "Phiếu tháng 10/2026 · còn 1.200.000đ · nhắc bước 2 · quá hạn 5 ngày", href: "/lop-cua-toi/hoc-phi" }], at: null, tag: "bước 2 (quá hạn tới 5 ngày)" } }), NOW)[0];
check("F2: 'invoiceRemind' là việc thường (không khẩn), tiêu đề bắt đầu bằng SỐ + nêu bước + quá hạn", ir.id === "invoiceRemind" && !ir.urgent && ir.title === "3 phiếu đến lúc nhắc bước 2 (quá hạn tới 5 ngày)" && /^\d/.test(ir.title), ir.title);
check("F2: không tag thì tiêu đề mặc định 'bước 2–3'; không bao giờ có chữ 'đã gửi'", buildInboxItems(raw({ invoiceRemind: { count: 2, rows: [], at: null } }), NOW)[0].title === "2 phiếu đến lúc nhắc bước 2–3" && !/đã gửi/i.test(JSON.stringify(ir)));
check("F2: khung đọc nói rõ gia sư tự bấm gửi, KiN không gửi giúp, và dẫn tới Học phí", /tự bấm gửi/.test(ir.detail.meta) && /không gửi giúp/.test(ir.detail.meta) && ir.href === "/lop-cua-toi/hoc-phi");
const mixed = buildInboxItems(raw({
  draft: { count: 9, rows: rows(3), at: "2026-10-01T03:00:00Z" },
  reports: { count: 3, rows: rows(3), at: "2026-10-13T03:00:00Z" },
  bank: { count: 1, rows: rows(1), at: "2026-10-14T03:30:00Z" },
  absence: { count: 4, rows: rows(4), at: "2026-10-14T09:00:00Z" },
  ungraded: { count: 5, rows: rows(5), at: null },
}), NOW);
check("việc khẩn đứng trước dù số ít hơn: absence(4) rồi bank(1)", mixed[0].id === "absence" && mixed[1].id === "bank" && mixed[0].urgent && mixed[1].urgent, mixed.map(i => i.id));
check("cùng nhóm thường: nhiều trước (draft 9 > ungraded 5 > reports 3)", mixed.slice(2).map(i => i.id).join() === "draft,ungraded,reports", mixed.map(i => i.id));
check("tiêu đề có số thật", mixed[0].title === "4 báo nghỉ sát giờ" && mixed[1].title === "1 khoản tiền vào cần đối soát", mixed.map(i => i.title));
check("khung đọc cùng tiêu đề với dòng", mixed.every(i => i.detail.heading === i.title));
check("dòng phụ lấy việc đầu tiên", mixed[0].subtitle === "Em 1 · chi tiết 1", mixed[0].subtitle);
check("trạng thái có chữ (không chỉ màu)", mixed.every(i => i.status.label.length > 0) && mixed[0].status.label === "Cần xử lý" && mixed[1].status.label === "Chờ đối soát");
check("nút trong khung đọc đều dẫn về /lop-cua-toi", mixed.every(i => i.detail.commands.every(c => c.href.startsWith("/lop-cua-toi/"))), mixed.map(i => i.detail.commands.map(c => c.href)));
check("mỗi loại có việc đều có lối xử lý (nút hoặc dòng có href)", INBOX_KINDS.every(k => {
  const it = buildInboxItems(raw({ [k]: { count: 1, rows: [{ title: "x", sub: "y", href: "/lop-cua-toi/quan-lop/a" }], at: null } }), NOW)[0];
  return it.detail.commands.length > 0 || it.detail.rows.some(r => !!r.href);
}));

section("Số việc còn lại");
const big = buildInboxItems(raw({ bank: { count: 37, rows: rows(25), at: null } }), NOW)[0];
check(`chỉ liệt kê tối đa ${INBOX_DETAIL_LIMIT} việc, phần dư ghi "và N việc nữa"`, big.detail.rows.length === INBOX_DETAIL_LIMIT && big.detail.more === 37 - INBOX_DETAIL_LIMIT, [big.detail.rows.length, big.detail.more]);
const few = buildInboxItems(raw({ bank: { count: 2, rows: rows(2), at: null } }), NOW)[0];
check("đủ hết thì không còn dư", few.detail.more === 0);
const lag = buildInboxItems(raw({ bank: { count: 5, rows: rows(2), at: null } }), NOW)[0];
check("count lớn hơn rows → phần dư = count − rows", lag.detail.more === 3);
const empty = buildInboxItems(raw({ consent: { count: 2, rows: [], at: null } }), NOW)[0];
check("không có dòng chi tiết → dòng phụ dùng lời giải thích, không để trống", empty.subtitle.length > 10 && empty.detail.rows.length === 0 && empty.detail.more === 2, empty.subtitle);

section("inboxTotal = số đỏ trên thanh module");
check("cộng đủ mọi loại", inboxTotal(raw({ bank: { count: 2, rows: [], at: null }, draft: { count: 5, rows: [], at: null }, makeup: { count: 1, rows: [], at: null } })) === 8);
check("số âm / thiếu bị bỏ qua", inboxTotal(raw({ bank: { count: -3, rows: [], at: null } })) === 0);
check("rỗng = 0", inboxTotal(raw({})) === 0);

section("Góc giờ & định dạng (giờ Việt Nam)");
check("hôm nay → giờ 10:30", inboxWhen("2026-10-14T03:30:00Z", NOW) === "10:30", inboxWhen("2026-10-14T03:30:00Z", NOW));
check("sát nửa đêm giờ VN vẫn là hôm nay: 00:05", inboxWhen("2026-10-13T17:05:00Z", NOW) === "00:05", inboxWhen("2026-10-13T17:05:00Z", NOW));
check("ngày khác → 13/10", inboxWhen("2026-10-13T03:30:00Z", NOW) === "13/10");
check("không có mốc → rỗng; mốc hỏng → rỗng", inboxWhen(null, NOW) === "" && inboxWhen("không phải ngày", NOW) === "");
check("inboxDateTime = 14/10 10:30", inboxDateTime(new Date("2026-10-14T03:30:00Z")) === "14/10 10:30", inboxDateTime(new Date("2026-10-14T03:30:00Z")));
check("inboxVnd có dấu chấm nghìn + đ", /^1[., ]?250[., ]?000đ$/.test(inboxVnd(1250000)), inboxVnd(1250000));

section("Hộp việc dạng trang dọc (23/10/2026): action, href, waiting + dải số");
const all = buildInboxItems(raw(Object.fromEntries(INBOX_KINDS.map(k => [k, { count: 1, rows: [{ title: "x", sub: "y", href: "/lop-cua-toi/quan-lop/a" }], at: null }]))), NOW);
check("mỗi dòng có nhãn hành động và đường dẫn nội bộ (không đường chết)", all.every(i => i.action.length > 3 && i.href.startsWith("/")), all.map(i => [i.id, i.href]));
check("chỉ 'consent' là việc chờ phụ huynh (waiting)", all.filter(i => i.waiting).map(i => i.id).join() === "consent");
check("đối soát → tab đối soát; báo cáo → kiểm duyệt; nháp → Học phí", all.find(i => i.id === "bank")!.href === "/lop-cua-toi/hoc-phi?tab=doi-soat" && all.find(i => i.id === "reports")!.href === "/lop-cua-toi/kiem-duyet" && all.find(i => i.id === "draft")!.href === "/lop-cua-toi/hoc-phi");
const ov = buildHopViecOverview({
  now: NOW,
  invoices: [{ amountDue: 480000, paidAmount: 480000, status: "paid" }, { amountDue: 560000, paidAmount: 0, status: "draft" }, { amountDue: 999000, paidAmount: 0, status: "cancelled" }],
  classes: [{ id: "a", name: "Văn 8", students: 1, classStatus: "open" }, { id: "b", name: "Toán 9", students: 2, classStatus: "open" }],
  totalStudents: 3,
  occurrences: [
    { courseId: "b", courseName: "Toán 9", dateKey: "2026-10-14", startAt: "2026-10-14T12:00:00Z", endAt: "2026-10-14T13:30:00Z", status: "scheduled", studentCount: 2, pendingAbsences: 1 },
    { courseId: "a", courseName: "Văn 8", dateKey: "2026-10-17", startAt: "2026-10-17T09:00:00Z", endAt: "2026-10-17T10:00:00Z", status: "scheduled", studentCount: 1, pendingAbsences: 0 },
    { courseId: "a", courseName: "Văn 8", dateKey: "2026-10-14", startAt: "2026-10-14T05:00:00Z", endAt: "2026-10-14T06:00:00Z", status: "cancelled", studentCount: 1, pendingAbsences: 0 },
  ],
});
check("đã xác nhận = tổng paidAmount (bỏ phiếu huỷ); đã lập = tổng amountDue (bỏ huỷ), gồm bản nháp", ov.stats.confirmed.value.startsWith("480.000") && ov.stats.invoices.value.startsWith("1.040.000") && /Gồm 560\.000đ bản nháp/.test(ov.stats.invoices.hint) && ov.stats.confirmed.hint === "1 phiếu đã thanh toán", ov.stats);
check("lớp: 2 lớp / 3 học sinh; sắp theo sĩ số (Toán 9 trước)", ov.stats.classes.value === "2 lớp" && ov.stats.classes.hint === "3 học sinh đang học" && ov.classes.rows[0].name === "Toán 9", ov.classes);
check("lịch hôm nay lấy buổi chưa kết thúc (19:00 giờ VN), bỏ buổi đã huỷ", ov.stats.today.value === "19:00" && /Toán 9 · 2 học sinh/.test(ov.stats.today.hint), ov.stats.today);
check("buổi sắp tới: giờ, báo nghỉ chờ, buổi tiếp theo; link điểm danh theo ngày", ov.next?.time === "19:00 – 20:30" && !!ov.next.note && /Văn 8 · Thứ Bảy, 16:00/.test(ov.next.following ?? "") && ov.next.attendanceHref === "/lop-cua-toi/quan-lop/b/diem-danh?date=2026-10-14", ov.next);
const none2 = buildHopViecOverview({ now: NOW, invoices: [], classes: [], totalStudents: 0, occurrences: [] });
check("không có dữ liệu: không số bịa (0đ, 'Trống', next=null, không lớp)", none2.stats.confirmed.value === "0đ" && none2.stats.today.value === "Trống" && none2.next === null && none2.classes.rows.length === 0 && /Chưa có phiếu/.test(none2.stats.invoices.hint));
check("dòng ngày: 'Thứ Tư, 14 tháng 10'", ov.dateLine === "Thứ Tư, 14 tháng 10", ov.dateLine);
done();
