// MD-16 + MD-14 — hạn Azota theo giờ Việt Nam (src/lib/azotaDeadline.ts) và tách link Azota/Zoom (src/lib/lessonLinks.ts). Thuần.
import { check, section, done } from "./h";
import { calendarDaysLeft, formatAzotaDeadline, parseAzotaDeadline } from "@/lib/azotaDeadline";
import { firstHttpLink, httpLinks, parseLinkList } from "@/lib/lessonLinks";

section("Hạn từ ô datetime-local (không múi giờ = giờ Việt Nam)");
const a = parseAzotaDeadline("2026-10-23T20:00");
check("2026-10-23T20:00 → ngày 2026-10-23, giờ 20:00, tức 13:00Z", a?.dateKey === "2026-10-23" && a.time === "20:00" && a.instant.toISOString() === "2026-10-23T13:00:00.000Z", a);
const early = parseAzotaDeadline("2026-10-23T00:30");
check("00:30 giờ VN vẫn thuộc NGÀY 23 (UTC là 22/10 17:30) — không lệch ngày", early?.dateKey === "2026-10-23" && early.instant.toISOString() === "2026-10-22T17:30:00.000Z", early);
check("23:59 giờ VN", parseAzotaDeadline("2026-10-23T23:59")?.dateKey === "2026-10-23");
check("có giây / dấu cách thay chữ T", parseAzotaDeadline("2026-10-23 20:00:30")?.time === "20:00" && parseAzotaDeadline("2026-10-23T20:00:00.000")?.time === "20:00");

section("Dạng khác");
check("chỉ ngày YYYY-MM-DD → hết ngày 23:59", (() => { const d = parseAzotaDeadline("2026-10-23"); return d?.time === "23:59" && d.dateKey === "2026-10-23"; })());
check("DD/MM/YYYY và D/M/YYYY, có giờ", (() => { const d = parseAzotaDeadline("5/9/2026 08:15"); return d?.dateKey === "2026-09-05" && d.time === "08:15"; })() && parseAzotaDeadline("23/10/2026")?.dateKey === "2026-10-23");
check("có múi giờ Z: 2026-10-23T18:00Z = 01:00 ngày 24 giờ VN", (() => { const d = parseAzotaDeadline("2026-10-23T18:00:00Z"); return d?.dateKey === "2026-10-24" && d.time === "01:00"; })());
check("có +07:00 giữ nguyên giờ VN; -05:00 đổi đúng", parseAzotaDeadline("2026-10-23T20:00+07:00")?.time === "20:00" && parseAzotaDeadline("2026-10-23T20:00-05:00")?.dateKey === "2026-10-24");

section("Ca phá cố ý — không đọc được thì null, không đoán");
check("rỗng, null, undefined, số, đối tượng", ["", "  ", null, undefined, 5, {}].every(v => parseAzotaDeadline(v as never) === null));
check("ngày không có thật: 30/02, tháng 13, ngày 32", ["2026-02-30", "2026-13-01", "2026-10-32", "30/02/2026", "31/04/2026"].every(v => parseAzotaDeadline(v) === null));
check("giờ không có thật: 24:00, 12:60", ["2026-10-23T24:00", "2026-10-23T12:60", "23/10/2026 25:00"].every(v => parseAzotaDeadline(v) === null));
check("văn bản tự do", ["tối mai", "hết tuần", "2026/10/23", "23-10-2026", "abc"].every(v => parseAzotaDeadline(v) === null));
check("năm nhuận: 29/02/2028 hợp lệ, 29/02/2027 không", parseAzotaDeadline("2028-02-29") !== null && parseAzotaDeadline("2027-02-29") === null);

section("Hiển thị và đếm ngày");
check("formatAzotaDeadline: '20:00 23/10/2026'", formatAzotaDeadline("2026-10-23T20:00") === "20:00 23/10/2026");
check("không đọc được → trả nguyên văn; null → ''", formatAzotaDeadline("tối mai") === "tối mai" && formatAzotaDeadline(null) === "");
// Máy chủ ở UTC lúc 18:00Z 22/10 = 01:00 ngày 23/10 giờ VN.
const now = new Date("2026-10-22T18:00:00Z");
check("còn 0 ngày lịch khi hạn là hôm nay (giờ VN)", calendarDaysLeft(parseAzotaDeadline("2026-10-23T20:00")!, now) === 0);
check("còn 1 ngày khi hạn là ngày mai; 2 ngày; -1 khi đã qua ngày", calendarDaysLeft(parseAzotaDeadline("2026-10-24T08:00")!, now) === 1 && calendarDaysLeft(parseAzotaDeadline("2026-10-25")!, now) === 2 && calendarDaysLeft(parseAzotaDeadline("2026-10-22T10:00")!, now) === -1);
check("qua ranh giới tháng/năm", calendarDaysLeft(parseAzotaDeadline("2027-01-01")!, new Date("2026-12-30T17:30:00Z")) === 1);

section("Link: một link hoặc chuỗi JSON của mảng (bài có 2 link Azota)");
const two = JSON.stringify(["https://azota.vn/a", "https://azota.vn/b"]);
check("parseLinkList tách chuỗi JSON thành 2 link", parseLinkList(two).join("|") === "https://azota.vn/a|https://azota.vn/b");
check("httpLinks(chuỗi JSON 2 link) = 2 link; KHÔNG ra chuỗi JSON làm href", httpLinks(two).length === 2 && httpLinks(two).every(u => !u.startsWith("[")));
check("link đơn giữ nguyên", httpLinks("https://azota.vn/a").join() === "https://azota.vn/a" && firstHttpLink("https://azota.vn/a") === "https://azota.vn/a");
check("firstHttpLink của 2 link = link đầu", firstHttpLink(two) === "https://azota.vn/a");
check("bỏ ô trống, trùng lặp, khoảng trắng", httpLinks(JSON.stringify(["", "  https://a.vn/x ", "https://a.vn/x", 5, null])).join() === "https://a.vn/x");
check("CA PHÁ: javascript:, data:, ftp:, vbscript: bị bỏ", httpLinks(JSON.stringify(["javascript:alert(1)", "data:text/html,x", "ftp://a.vn/f", "vbscript:x", "https://ok.vn/a"])).join() === "https://ok.vn/a");
check("CA PHÁ: chuỗi toàn link xấu → rỗng, firstHttpLink = null", httpLinks("javascript:alert(1)").length === 0 && firstHttpLink("javascript:alert(1)") === null && firstHttpLink(JSON.stringify(["data:x"])) === null);
check("JSON hỏng bắt đầu bằng [ → coi như một link (và bị lọc nếu không phải http)", parseLinkList("[https://a.vn/x").length === 1 && httpLinks("[https://a.vn/x").length === 0);
check("null / undefined / rỗng / không phải chuỗi → []", [null, undefined, "", "  ", 5].every(v => parseLinkList(v as never).length === 0));
check("link có khoảng trắng bên trong không phải http hợp lệ", httpLinks("https://a.vn/x y").length === 0);

done();
