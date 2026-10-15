// Hộp việc của gia sư — phần thuần (src/lib/tutorInbox.ts): thứ tự dòng, chữ, góc giờ, số việc còn lại.
import { buildInboxItems, inboxTotal, inboxWhen, inboxDateTime, inboxVnd, INBOX_DETAIL_LIMIT, INBOX_KINDS, type InboxRaw, type InboxSource } from "@/lib/tutorInbox";
import { check, section, done } from "./h";

const none: InboxSource = { count: 0, rows: [], at: null };
const raw = (o: Partial<InboxRaw>): InboxRaw => ({ absence: none, check: none, bank: none, consent: none, reports: none, ungraded: none, reminders: none, makeup: none, draft: none, ...o });
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Em ${i + 1}`, sub: `chi tiết ${i + 1}`, href: "/lop-cua-toi/lich" }));
const NOW = new Date("2026-10-14T05:00:00Z"); // 12:00 giờ Việt Nam

section("buildInboxItems");
check("không việc nào → rỗng", buildInboxItems(raw({}), NOW).length === 0);
check("loại có count=0 bị bỏ dù còn rows", buildInboxItems(raw({ bank: { count: 0, rows: rows(2), at: null } }), NOW).length === 0);
check("mọi loại việc đều có trong thứ tự khai báo (9)", INBOX_KINDS.length === 9 && new Set(INBOX_KINDS).size === 9, INBOX_KINDS);

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
  const it = buildInboxItems(raw({ [k]: { count: 1, rows: [{ title: "x", sub: "y", href: "/admin/khoa-hoc/a" }], at: null } }), NOW)[0];
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
done();
