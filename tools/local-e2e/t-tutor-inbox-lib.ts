// Hộp việc của gia sư — phần thuần (src/lib/tutorInbox.ts): thứ tự dòng, chữ, góc giờ, số việc còn lại.
// Ca phá cố ý (LOI-02 F): cho inboxTotal cộng lại INBOX_KINDS (gồm consent) → ca "inboxTotal bỏ consent" + "số đỏ = Σ dòng không waiting" đỏ;
//   bỏ một khoá trong todoCountsToRaw → ca "đủ 14 khoá, không khoá nào rơi" đỏ; todoBadgeTotal cộng Object.values (kiểu cũ) → ca "bỏ pendingConsent" đỏ.
import { buildInboxItems, inboxTotal, inboxWhen, inboxDateTime, inboxVnd, INBOX_DETAIL_LIMIT, INBOX_KINDS, INBOX_ACTION_KINDS, todoCountsToRaw, todoBadgeTotal, type InboxRaw, type InboxSource } from "@/lib/tutorInbox";
import { buildTodoItems, type TodoCounts } from "@/lib/tutorTodo";
import { buildHopViecOverview } from "@/lib/tutorOverview";
import { check, section, done } from "./h";

const none: InboxSource = { count: 0, rows: [], at: null };
const raw = (o: Partial<InboxRaw>): InboxRaw => ({ absence: none, check: none, bank: none, consent: none, reports: none, ungraded: none, unmarked: none, reminders: none, makeup: none, invoiceRemind: none, draft: none, joinRequests: none, questions: none, noSchedule: none, ...o });
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Em ${i + 1}`, sub: `chi tiết ${i + 1}`, href: "/lop-cua-toi/lich" }));
const NOW = new Date("2026-10-14T05:00:00Z"); // 12:00 giờ Việt Nam

section("buildInboxItems");
check("không việc nào → rỗng", buildInboxItems(raw({}), NOW).length === 0);
check("loại có count=0 bị bỏ dù còn rows", buildInboxItems(raw({ bank: { count: 0, rows: rows(2), at: null } }), NOW).length === 0);
check("mọi loại việc đều có trong thứ tự khai báo (14, kể cả noSchedule của TUT-lich-keo-tha, unmarked của ĐX-01, invoiceRemind của F2, joinRequests của BU-01 và questions của TUT-003)", INBOX_KINDS.length === 14 && new Set(INBOX_KINDS).size === 14 && INBOX_KINDS.includes("noSchedule") && INBOX_KINDS.includes("questions") && INBOX_KINDS.includes("joinRequests") && INBOX_KINDS.includes("unmarked") && INBOX_KINDS.includes("invoiceRemind"), INBOX_KINDS);
const un = buildInboxItems(raw({ unmarked: { count: 3, rows: [{ title: "Toán 9", sub: "buổi 20/10 19:00 · thiếu 2/5 em: An, Bình", href: "/lop-cua-toi/quan-lop/c1/diem-danh?date=2026-10-20" }], at: "2026-10-20T12:00:00Z" } }), NOW)[0];
check("ĐX-01: 'unmarked' là việc thường (không khẩn), tiêu đề có số buổi, có chữ trạng thái", un.id === "unmarked" && !un.urgent && un.title === "3 buổi đã qua giờ, chưa điểm danh xong" && un.status.label === "Chưa điểm danh" && un.status.tone === "cho", un);
check("ĐX-01: dòng việc dẫn tới trang điểm danh của lớp kèm ngày; khung đọc nói rõ học phí không đổi", un.detail.rows[0].href === "/lop-cua-toi/quan-lop/c1/diem-danh?date=2026-10-20" && /Học phí không đổi/.test(un.detail.meta), un.detail);
const jq = buildInboxItems(raw({ joinRequests: { count: 3, rows: [{ title: "Toán 9", sub: "3 yêu cầu đang chờ duyệt", href: "/lop-cua-toi/c1?tab=hoc-sinh" }], at: "2026-10-13T03:00:00Z" } }), NOW)[0];
check("BU-01: 'joinRequests' là việc thường, tiêu đề có số, nút 'Mở lớp', dòng chỉ có tên lớp + số (không tên em)", jq.id === "joinRequests" && !jq.urgent && jq.title === "3 học sinh xin vào lớp" && jq.status.label === "Chờ duyệt" && jq.detail.commands[0].label === "Mở lớp" && jq.detail.rows[0].title === "Toán 9", jq);
check("BU-01 (phá): count 0 thì không có dòng joinRequests", buildInboxItems(raw({ joinRequests: { count: 0, rows: rows(2), at: null } }), NOW).length === 0);
const qs = buildInboxItems(raw({ questions: { count: 4, rows: [{ title: "Cách giải phương trình bậc hai?", sub: "Toán 9 · hỏi lúc 13/10 08:30", href: "/cong-dong/t1" }], at: "2026-10-13T01:30:00Z" } }), NOW)[0];
check("TUT-003: 'questions' là việc thường (không khẩn), tiêu đề có số, có chữ trạng thái 'Chờ trả lời'", qs.id === "questions" && !qs.urgent && qs.title === "4 câu hỏi của học sinh chưa trả lời" && qs.status.label === "Chờ trả lời", qs);
check("TUT-003: dòng dẫn tới đúng câu hỏi, chỉ có tiêu đề câu hỏi + lớp + giờ (không tên em); dòng việc dẫn tới câu hỏi đầu", qs.detail.rows[0].href === "/cong-dong/t1" && !/Em |An |Bình/.test(JSON.stringify(qs.detail.rows)) && qs.href === "/cong-dong/t1", qs.detail);
check("TUT-003 (phá): count 0 thì không có dòng questions", buildInboxItems(raw({ questions: { count: 0, rows: rows(2), at: null } }), NOW).length === 0);
check("TUT-003: tính vào số đỏ trên thanh module (inboxTotal)", inboxTotal(raw({ questions: { count: 4, rows: [], at: null }, bank: { count: 1, rows: [], at: null } })) === 5);
const ns = buildInboxItems(raw({ noSchedule: { count: 2, rows: [{ title: "Toán 9", sub: "Chưa có khung giờ học hằng tuần · Đặt lịch", href: "/lop-cua-toi/quan-lop/c1/lich-hoc" }], at: null } }), NOW)[0];
check("TUT-lich-keo-tha: 'noSchedule' là việc thường (KHÔNG khẩn), tiêu đề có số, chữ trạng thái 'Chưa có lịch'", ns.id === "noSchedule" && !ns.urgent && ns.title === "2 lớp chưa có lịch học" && ns.status.label === "Chưa có lịch" && ns.status.tone === "cho", ns);
check("TUT-lich-keo-tha: dòng việc dẫn tới trang khung giờ của lớp đầu tiên; dòng chỉ có tên lớp (không tên em)", ns.href === "/lop-cua-toi/quan-lop/c1/lich-hoc" && ns.detail.rows[0].title === "Toán 9" && ns.detail.commands.length === 0, ns);
check("TUT-lich-keo-tha (phá): count 0 thì không có dòng noSchedule; có việc khẩn thì khẩn đứng trước", buildInboxItems(raw({ noSchedule: { count: 0, rows: rows(2), at: null } }), NOW).length === 0 && buildInboxItems(raw({ noSchedule: { count: 9, rows: rows(1), at: null }, bank: { count: 1, rows: rows(1), at: null } }), NOW).map(i => i.id).join() === "bank,noSchedule");
check("TUT-lich-keo-tha: khi có dòng (cờ lịch bật), tính vào số đỏ (inboxTotal)", inboxTotal(raw({ noSchedule: { count: 3, rows: [], at: null }, bank: { count: 1, rows: [], at: null } })) === 4);
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

section("inboxTotal = số đỏ trên thanh module (LOI-02: chỉ việc cô cần làm)");
check("cộng đủ mọi loại việc của cô", inboxTotal(raw({ bank: { count: 2, rows: [], at: null }, draft: { count: 5, rows: [], at: null }, makeup: { count: 1, rows: [], at: null } })) === 8);
check("LOI-02 phá: inboxTotal BỎ 'consent' (chờ phụ huynh)", inboxTotal(raw({ consent: { count: 3, rows: [], at: null } })) === 0 && inboxTotal(raw({ consent: { count: 3, rows: [], at: null }, bank: { count: 1, rows: [], at: null } })) === 1);
check("LOI-02: inboxTotal = Σ số đầu tiêu đề các dòng KHÔNG waiting (đúng 'N việc' của Hộp việc), với đủ 14 loại có việc", (() => {
  const r = raw(Object.fromEntries(INBOX_KINDS.map((k, i) => [k, { count: i + 1, rows: [], at: null }])));
  const items = buildInboxItems(r, NOW);
  return inboxTotal(r) === items.filter(i => !i.waiting).reduce((n, i) => n + Number(i.title.match(/^\d+/)?.[0] ?? 0), 0) && items.length === 14;
})());
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
section("LOI-02 F: INBOX_ACTION_KINDS · todoCountsToRaw · todoBadgeTotal (một nguồn cho số đỏ)");
const zeroC: TodoCounts = { bankPending: 0, needBankCheck: 0, draftInvoices: 0, pendingConsent: 0, classReports: 0, ungraded: 0, lateAbsences: 0, remindersDue: 0, makeupExpiring: 0, invoiceReminders: 0, unmarkedSessions: 0, joinRequests: 0, noSchedule: 0, unansweredQuestions: 0 };
check("INBOX_ACTION_KINDS: 13 loại, KHÔNG có 'consent', đủ mọi loại còn lại theo thứ tự khai báo", INBOX_ACTION_KINDS.length === 13 && !INBOX_ACTION_KINDS.includes("consent") && INBOX_ACTION_KINDS.join() === INBOX_KINDS.filter(k => k !== "consent").join(), INBOX_ACTION_KINDS);
check("INBOX_ACTION_KINDS = đúng các loại buildInboxItems đánh dấu KHÔNG waiting", (() => { const it = buildInboxItems(raw(Object.fromEntries(INBOX_KINDS.map(k => [k, { count: 1, rows: [], at: null }]))), NOW); return it.filter(i => !i.waiting).map(i => i.id).sort().join() === [...INBOX_ACTION_KINDS].sort().join(); })());
{
  // Mỗi bộ đếm một số nguyên tố khác nhau ⇒ khoá nào rơi / gán nhầm đều lộ.
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
  const keys = Object.keys(zeroC) as (keyof TodoCounts)[];
  const c = Object.fromEntries(keys.map((k, i) => [k, primes[i]])) as unknown as TodoCounts;
  const m = todoCountsToRaw(c);
  check("todoCountsToRaw: đủ 14 khoá = INBOX_KINDS, không khoá nào rơi, mỗi bộ đếm dùng đúng một lần", Object.keys(m).sort().join() === [...INBOX_KINDS].sort().join() && Object.values(m).sort((a, b) => a - b).join() === primes.join(), m);
  check("todoCountsToRaw: gán đúng tên (consent ← pendingConsent, absence ← lateAbsences, questions ← unansweredQuestions, unmarked ← unmarkedSessions, invoiceRemind ← invoiceReminders, draft ← draftInvoices, check ← needBankCheck, bank ← bankPending, reports ← classReports, reminders ← remindersDue, makeup ← makeupExpiring)",
    m.consent === c.pendingConsent && m.absence === c.lateAbsences && m.questions === c.unansweredQuestions && m.unmarked === c.unmarkedSessions && m.invoiceRemind === c.invoiceReminders && m.draft === c.draftInvoices
    && m.check === c.needBankCheck && m.bank === c.bankPending && m.reports === c.classReports && m.reminders === c.remindersDue && m.makeup === c.makeupExpiring && m.ungraded === c.ungraded && m.joinRequests === c.joinRequests && m.noSchedule === c.noSchedule);
  const all = primes.reduce((a, b) => a + b, 0);
  check("todoBadgeTotal = Σ mọi bộ đếm TRỪ pendingConsent", todoBadgeTotal(c) === all - c.pendingConsent, [todoBadgeTotal(c), all, c.pendingConsent]);
  check("todoBadgeTotal = inboxTotal của dòng dựng từ cùng bộ đếm (một nguồn)", todoBadgeTotal(c) === inboxTotal(raw(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { count: v, rows: [], at: null }])) as Partial<InboxRaw>)));
}
{
  // LOI-02 vòng 2 P3-B: ô "Việc cần làm" của Tổng quan = buildTodoItems(c) lọc bằng INBOX_ACTION_KINDS (đúng phép lọc ở
  // src/app/lop-cua-toi/(tutor)/TutorDashboard.tsx:64-65) ⇒ không có "consent" và Σ count = todoBadgeTotal(c) = số đỏ Hộp việc.
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
  const c = Object.fromEntries((Object.keys(zeroC) as (keyof TodoCounts)[]).map((k, i) => [k, primes[i]])) as unknown as TodoCounts;
  const allItems = buildTodoItems(c);
  const dash = allItems.filter(t => (INBOX_ACTION_KINDS as string[]).includes(t.key));
  const sum = (xs: { count: number }[]) => xs.reduce((n, t) => n + t.count, 0);
  check("P3-B: mọi khoá của buildTodoItems trùng tên một InboxKind (không khoá nào bị lọc nhầm vì sai tên)", allItems.length === 14 && allItems.every(t => (INBOX_KINDS as string[]).includes(t.key)), allItems.map(t => t.key));
  check("P3-B: pendingConsent > 0 (và mọi khoá khác > 0) — sau lọc KHÔNG có khoá 'consent', còn đúng 13 dòng", c.pendingConsent > 0 && dash.length === 13 && !dash.some(t => t.key === "consent"), dash.map(t => t.key));
  check("P3-B: Σ count của 'Việc cần làm' (đã lọc) = todoBadgeTotal(c) (= số đỏ Hộp việc)", sum(dash) === todoBadgeTotal(c), [sum(dash), todoBadgeTotal(c)]);
  check("P3-B (phá): KHÔNG lọc thì Σ count ≠ todoBadgeTotal (lệch đúng pendingConsent)", sum(allItems) !== todoBadgeTotal(c) && sum(allItems) - todoBadgeTotal(c) === c.pendingConsent, [sum(allItems), todoBadgeTotal(c), c.pendingConsent]);
  const only = { ...zeroC, pendingConsent: 1 };
  check("P3-B: tình huống của chủ (chỉ pendingConsent = 1) → 'Việc cần làm' rỗng, Σ 0 = số đỏ 0", buildTodoItems(only).filter(t => (INBOX_ACTION_KINDS as string[]).includes(t.key)).length === 0 && todoBadgeTotal(only) === 0);
}
check("LOI-02 F, tình huống của chủ (cờ lịch tắt): chỉ pendingConsent = 1 → số đỏ 0", todoBadgeTotal({ ...zeroC, pendingConsent: 1 }) === 0);
check("LOI-02 F (giả thuyết H1+H2, cờ bật): noSchedule 1 + pendingConsent 1 → số đỏ 1 (trước sửa: 2)", todoBadgeTotal({ ...zeroC, pendingConsent: 1, noSchedule: 1 }) === 1);
check("phá: bộ đếm âm / NaN không làm số đỏ âm hay NaN", todoBadgeTotal({ ...zeroC, bankPending: -5, draftInvoices: Number.NaN, ungraded: 2 }) === 2);
check("rỗng → 0", todoBadgeTotal(zeroC) === 0);
done();
