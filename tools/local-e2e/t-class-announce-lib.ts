// TB-LOP (17/11/2026) — hàm thuần của "Thông báo lớp" (src/lib/classAnnouncement.ts). Không DB, không máy chủ.
// Chạy: TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-class-announce-lib.ts
import { check, section, done } from "./h";
import {
  ANNOUNCE_BODY_MAX, ANNOUNCE_MESSAGES, announceLink, announceMessage, announceNotice, announceTime, cleanAnnouncementBody, linkParts, parsePinned, sortAnnouncements,
} from "@/lib/classAnnouncement";

section("cleanAnnouncementBody");
const c = (v: unknown) => cleanAnnouncementBody(v);
check("chữ thường giữ nguyên", (() => { const r = c("Tối nay học online"); return r.ok && r.body === "Tối nay học online"; })());
check("\\r\\n → \\n, bỏ khoảng trắng cuối dòng, cắt đầu/cuối", (() => { const r = c("  a  \r\nb\t \r\n"); return r.ok && r.body === "a\nb"; })());
check("quá 2 dòng trống liền nhau rút còn 2", (() => { const r = c("a\n\n\n\n\n\nb"); return r.ok && r.body === "a\n\n\nb"; })());
check("CA PHÁ: bỏ ký tự đảo hướng chữ (RLO, LRI…)", (() => { const r = c("https://x.vn/\u202Egpj.exe \u2066a\u2069\u200F"); return r.ok && !/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(r.body); })());
check("bỏ ký tự điều khiển, giữ tab giữa dòng", (() => { const r = c("a\u0000b\u0007c\td"); return r.ok && r.body === "abc\td"; })());
for (const bad of ["", "   ", "\n\n\t", "\u0000\u0001", null, undefined, 5, {}, ["x"]]) check(`CA PHÁ: ${JSON.stringify(bad)} → trong`, (() => { const r = c(bad); return !r.ok && r.code === "trong"; })());
check(`đúng ${ANNOUNCE_BODY_MAX} ký tự có dấu → nhận`, c("ạ".repeat(ANNOUNCE_BODY_MAX)).ok);
check(`CA PHÁ: ${ANNOUNCE_BODY_MAX + 1} ký tự → dai`, (() => { const r = c("a".repeat(ANNOUNCE_BODY_MAX + 1)); return !r.ok && r.code === "dai"; })());
check("đếm theo ký tự, không theo đơn vị UTF-16: 1500 emoji vẫn nhận", c("😀".repeat(ANNOUNCE_BODY_MAX)).ok);

section("parsePinned");
check("on / 1 / true / true(bool) → true", [ "on", "1", "true", true ].every(parsePinned));
check("CA PHÁ: off / 0 / '' / undefined / 'ON' → false", ["off", "0", "", undefined, "ON", 1].every(v => !parsePinned(v)));

section("announceMessage");
check("mọi mã có chữ tiếng Việt", Object.values(ANNOUNCE_MESSAGES).every(m => m.text.length > 5));
check("mã lạ / mảng / toString → null", announceMessage("x") === null && announceMessage(["ok"]) === null && announceMessage("toString") === null && announceMessage(undefined) === null);
check("ok là thành công, nhieu là lỗi", announceMessage("ok")?.tone === "ok" && announceMessage("nhieu")?.tone === "err");

section("announceNotice / announceLink");
const n = announceNotice("toan 9/ab", "Toán 9");
check("loại class_announcement, link về tab Thông báo (mã lớp đã mã hoá)", n.type === "class_announcement" && n.link === "/student/hoc-tap?course=toan%209%2Fab&tab=thong-bao" && announceLink("a") === "/student/hoc-tap?course=a&tab=thong-bao", n);
check("chữ thông báo có tên lớp, không có số tiền / số điện thoại", /Toán 9/.test(n.message) && !/\d{4,}|đ\b|VND/i.test(n.title + n.message), n);
check("tên lớp rỗng → câu vẫn đọc được", /Lớp của bạn có thông báo mới/.test(announceNotice("x", "  ").message));
check("tên lớp bắt đầu bằng 'Lớp' không bị lặp 'Lớp Lớp'", announceNotice("x", "Lớp Toán 9A").message.startsWith("Lớp Toán 9A có") && announceNotice("x", "lớp 10 chuyên").message.startsWith("lớp 10 chuyên có") && announceNotice("x", "Lớpxyz").message.startsWith("Lớp Lớpxyz"));
check("tên lớp dài cắt còn 80 ký tự", announceNotice("x", "L".repeat(300)).message.length < 140);

section("sortAnnouncements");
const rows = [
  { id: "a", pinned: false, createdAt: "2026-11-10T01:00:00Z" },
  { id: "b", pinned: true, createdAt: "2026-11-01T01:00:00Z" },
  { id: "c", pinned: false, createdAt: "2026-11-12T01:00:00Z" },
  { id: "d", pinned: true, createdAt: "2026-11-05T01:00:00Z" },
  { id: "e", pinned: false, createdAt: "2026-11-12T01:00:00Z" },
];
check("ghim trước (mới trước), rồi mới nhất; bằng giờ theo id", sortAnnouncements(rows).map(r => r.id).join("") === "dbcea", sortAnnouncements(rows).map(r => r.id));
check("không sửa mảng gốc", rows[0].id === "a");

section("linkParts");
const lp = (s: string) => linkParts(s).map(p => p.kind === "link" ? `[${p.href}]` : p.text).join("");
check("link https giữa câu", lp("Vào https://meet.google.com/abc-def nhé") === "Vào [https://meet.google.com/abc-def] nhé");
check("dấu câu dính cuối trả về chữ", lp("Link: https://zoom.us/j/123). Hết.") === "Link: [https://zoom.us/j/123]). Hết.");
check("ngoặc cân thuộc về link (wikipedia), ngoặc thừa trả về chữ", lp("Xem https://vi.wikipedia.org/wiki/Foo_(bar) nhé") === "Xem [https://vi.wikipedia.org/wiki/Foo_(bar)] nhé" && lp("(https://x.vn/a_(b))") === "([https://x.vn/a_(b)])");
check("hai link, có query", lp("a http://x.vn/?q=1&b=2 b https://y.vn") === "a [http://x.vn/?q=1&b=2] b [https://y.vn]");
check("CA PHÁ: javascript: / data: / www. → chữ thường", linkParts("javascript:alert(1) data:text/html,x www.abc.vn").every(p => p.kind === "text"));
check("CA PHÁ: link có tài khoản (https://a:b@x.vn) → chữ", linkParts("https://a:b@x.vn").every(p => p.kind === "text"));
check("CA PHÁ: thẻ HTML giữ là chữ (React thoát khi hiện)", (() => { const p = linkParts("<img src=x onerror=alert(1)>"); return p.length === 1 && p[0].kind === "text" && p[0].text.includes("<img"); })());
check("chuỗi rỗng → mảng rỗng; không link → một đoạn", linkParts("").length === 0 && linkParts("abc").length === 1);

section("announceTime (giờ Việt Nam)");
const now = new Date("2026-11-17T05:00:00Z"); // 12:00 17/11 giờ VN
check("hôm nay", announceTime("2026-11-17T00:30:00Z", now) === "Hôm nay · 07:30", announceTime("2026-11-17T00:30:00Z", now));
check("qua nửa đêm giờ VN là hôm nay dù UTC còn hôm trước", announceTime("2026-11-16T17:30:00Z", now) === "Hôm nay · 00:30", announceTime("2026-11-16T17:30:00Z", now));
check("hôm qua", announceTime("2026-11-16T12:05:00Z", now) === "Hôm qua · 19:05", announceTime("2026-11-16T12:05:00Z", now));
check("cùng năm: dd/mm", announceTime("2026-11-05T01:00:00Z", now) === "05/11 · 08:00", announceTime("2026-11-05T01:00:00Z", now));
check("khác năm: dd/mm/yyyy", announceTime("2025-12-31T16:59:00Z", now) === "31/12/2025 · 23:59", announceTime("2025-12-31T16:59:00Z", now));
check("CA PHÁ: ngày hỏng → chuỗi rỗng", announceTime("abc", now) === "");

done();
