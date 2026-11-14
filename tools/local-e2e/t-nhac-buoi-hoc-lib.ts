// DG-HOC-ONLINE — bài THUẦN cho src/lib/lessonReminder.ts (không DB, không máy chủ). Chạy: TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-nhac-buoi-hoc-lib.ts
// Ca phá cố ý (đã thử khi viết): đổi `sendAt > t - windowMinutes*60_000` thành `>=` ⇒ ca "đúng mép 20 phút trước" đỏ; bỏ `start <= t` ⇒ ca "buổi đã bắt đầu" đỏ;
// thêm "http:" vào parseOnlineLink ⇒ ca "http bị từ chối" đỏ.
import {
  buildLessonReminderEmail, extraSessionKey, httpsJoinUrl, isReminderDue, LEAD_OPTIONS, leadOf, looksLikeMoney, MAX_EMAILS_PER_RUN, parseLeadMinutes, parseOnlineLink,
  regularSessionKey, searchRangeKeys, WINDOW_MINUTES, NO_LINK_TEXT,
} from "@/lib/lessonReminder";
import { lessonReminderHtml } from "@/lib/email";

let pass = 0, fail = 0;
const check = (name: string, cond: unknown, extra?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)); }
};
const vn = (s: string) => new Date(`${s}+07:00`); // "2026-11-14T19:00:00" giờ VN
const min = 60_000;

console.log("▸ hằng số");
check("1. ba lựa chọn 15 / 60 / 1440, cửa sổ 20 phút > nhịp gọi 15 phút, giới hạn thư mỗi lượt dương", LEAD_OPTIONS.join() === "15,60,1440" && WINDOW_MINUTES === 20 && MAX_EMAILS_PER_RUN > 0);

console.log("▸ isReminderDue — cửa sổ (now − 20 phút, now]");
const start = vn("2026-11-14T19:00:00");
check("2. lead 60, now đúng 18:00 (thời điểm gửi = now) ⇒ tới hạn", isReminderDue(start, 60, vn("2026-11-14T18:00:00")));
check("3. lead 60, now 18:19 (gửi lẽ ra 19 phút trước) ⇒ tới hạn", isReminderDue(start, 60, vn("2026-11-14T18:19:00")));
check("4. lead 60, now 18:20 (đúng mép 20 phút) ⇒ KHÔNG (mép trái mở)", !isReminderDue(start, 60, vn("2026-11-14T18:20:00")));
check("5. lead 60, now 17:59 (chưa tới giờ gửi) ⇒ KHÔNG", !isReminderDue(start, 60, vn("2026-11-14T17:59:00")));
check("6. lead 15, now 18:45 ⇒ tới hạn; now 18:44 ⇒ chưa", isReminderDue(start, 15, vn("2026-11-14T18:45:00")) && !isReminderDue(start, 15, vn("2026-11-14T18:44:00")));
check("7. buổi đã bắt đầu (now 19:00, lead 15 lệch) ⇒ KHÔNG nhắc", !isReminderDue(start, 15, vn("2026-11-14T19:00:00")) && !isReminderDue(start, 15, vn("2026-11-14T19:05:00")));
check("8. lead TẮT (null / undefined) ⇒ không bao giờ", !isReminderDue(start, null, vn("2026-11-14T18:00:00")) && !isReminderDue(start, undefined, vn("2026-11-14T18:00:00")));
check("9. lead lạ trong DB (30, 0, -60) ⇒ coi như tắt", [30, 0, -60].every(l => !isReminderDue(start, l, new Date(start.getTime() - l * min))));
check("10. lead 1 ngày qua nửa đêm: buổi 00:30 ngày 15, now 00:30 ngày 14 ⇒ tới hạn", isReminderDue(vn("2026-11-15T00:30:00"), 1440, vn("2026-11-14T00:30:00")));
check("11. lead 1 giờ qua nửa đêm: buổi 00:10 ngày 15, now 23:15 ngày 14 ⇒ tới hạn", isReminderDue(vn("2026-11-15T00:10:00"), 60, vn("2026-11-14T23:15:00")));
check("12. lead 1 ngày qua năm: buổi 01/01/2027 07:00, now 31/12 07:05 ⇒ tới hạn", isReminderDue(vn("2027-01-01T07:00:00"), 1440, vn("2026-12-31T07:05:00")));
check("13. ngày giờ hỏng (Invalid Date) ⇒ KHÔNG", !isReminderDue(new Date("x"), 60, vn("2026-11-14T18:00:00")));
// Mỗi buổi được thấy tới hạn ở ĐÚNG MỘT hoặc HAI lượt liền nhau (nhịp 15 phút, cửa sổ 20 phút) — không lượt nào bỏ sót, chống trùng ở bảng log.
const runs = Array.from({ length: 12 }, (_, i) => new Date(vn("2026-11-14T17:00:00").getTime() + i * 15 * min + 7 * min));
const seen = runs.filter(r => isReminderDue(start, 60, r)).length;
check("14. gọi mỗi 15 phút (lệch giờ chẵn 7 phút) ⇒ buổi được thấy ≥ 1 lượt và ≤ 2 lượt", seen >= 1 && seen <= 2, seen);

console.log("▸ searchRangeKeys — đủ ngày để không bỏ sót buổi lead 1 ngày");
check("15. 10:00 ngày 14 ⇒ 14 → 15", JSON.stringify(searchRangeKeys(vn("2026-11-14T10:00:00"))) === JSON.stringify({ fromKey: "2026-11-14", toKey: "2026-11-15" }));
check("16. 23:50 ngày 14 ⇒ 14 → 16 (buổi 00:05 ngày 16 nhắc trước 1 ngày còn nằm trong cửa sổ)", JSON.stringify(searchRangeKeys(vn("2026-11-14T23:50:00"))) === JSON.stringify({ fromKey: "2026-11-14", toKey: "2026-11-16" }));
check("17. 00:00 ngày 1/1 theo giờ VN (17:00 UTC hôm trước) ⇒ bắt đầu từ ngày VN, không phải ngày UTC", searchRangeKeys(vn("2027-01-01T00:00:00")).fromKey === "2027-01-01");

console.log("▸ parseLeadMinutes / leadOf");
check("18. '' / 'off' / '0' / null ⇒ tắt", ["", "off", "0", null, undefined].every(v => { const r = parseLeadMinutes(v); return r.ok && r.value === null; }));
check("19. '15' / '60' / '1440' / 60 ⇒ số", ["15", "60", "1440", 60].every(v => { const r = parseLeadMinutes(v); return r.ok && r.value === Number(v); }));
check("20. '30' / '-15' / '60.5' / 'abc' / mảng ⇒ lỗi (không đoán)", ["30", "-15", "60.5", "abc", "99999", [] as unknown].every(v => !parseLeadMinutes(v).ok));
check("21. leadOf: chỉ nhận đúng ba lựa chọn", leadOf(60) === 60 && leadOf(30) === null && leadOf(null) === null);

console.log("▸ parseOnlineLink — bắt buộc https");
const meet = parseOnlineLink("  https://meet.google.com/abc-defg-hij ");
check("22. Meet ⇒ ok, cắt khoảng trắng, isMeet", meet.ok && meet.value === "https://meet.google.com/abc-defg-hij" && meet.isMeet);
const zoom = parseOnlineLink("https://us02web.zoom.us/j/123456789");
check("23. Zoom / Teams ⇒ ok, không phải Meet", zoom.ok && !zoom.isMeet && parseOnlineLink("https://teams.microsoft.com/l/meetup-join/x").ok);
check("24. http:// ⇒ từ chối", !parseOnlineLink("http://meet.google.com/abc").ok);
check("25. javascript: / data: / chữ thường / không tên miền / có tài khoản ⇒ từ chối",
  ["javascript:alert(1)", "data:text/html,x", "meet.google.com/abc", "https://localhost/x", "https://a:b@meet.google.com/x"].every(v => !parseOnlineLink(v).ok));
check("26. rỗng ⇒ gỡ link (null), dài > 500 ⇒ từ chối", (() => { const r = parseOnlineLink("   "); return r.ok && r.value === null; })() && !parseOnlineLink(`https://meet.google.com/${"a".repeat(500)}`).ok);

console.log("▸ khoá buổi");
check("27. khoá buổi theo lịch = khung giờ + ngày GỐC; buổi lẻ = extra:<id>", regularSessionKey("s1", "2026-11-14") === "s1:2026-11-14" && extraSessionKey("a1") === "extra:a1");

console.log("▸ nội dung thư — không số tiền");
const mail = buildLessonReminderEmail({
  courseName: "Toán 9 <b>nâng cao</b>", startAt: vn("2026-11-14T19:00:00"), endAt: vn("2026-11-14T20:30:00"),
  joinUrl: "https://meet.google.com/abc-defg-hij", classUrl: "https://kin.example/student/hoc-tap?course=toan-9", leadMinutes: 60,
});
check("28. tiêu đề có tên lớp và giờ bắt đầu", mail.subject.includes("Toán 9") && mail.subject.includes("19:00"), mail.subject);
check("29. chữ thường có thứ, ngày, khung giờ VN và link Meet", mail.text.includes("Thứ 7, 14/11/2026 lúc 19:00–20:30") && mail.text.includes("https://meet.google.com/abc-defg-hij"), mail.text);
const html = lessonReminderHtml(mail.view);
check("30. HTML (email.ts) thoát tên lớp (không chèn thẻ <b>) và có nút Vào học online", html.includes("Toán 9 &lt;b&gt;") && !html.includes("<b>nâng") && html.includes("Vào học online") && html.includes("https://meet.google.com/abc-defg-hij"));
check("31. không có số tiền trong tiêu đề / chữ / HTML (bỏ mã màu)", !looksLikeMoney(mail.subject) && !looksLikeMoney(mail.text) && !looksLikeMoney(html.replace(/#[0-9a-f]{3,6}/gi, "")));
check("32. lead 1 ngày ⇒ 'ngày mai'; lead 15 ⇒ 'sau 15 phút nữa'",
  buildLessonReminderEmail({ courseName: "A", startAt: start, endAt: null, joinUrl: null, classUrl: "https://x.vn/a", leadMinutes: 1440 }).text.includes("ngày mai")
  && buildLessonReminderEmail({ courseName: "A", startAt: start, endAt: null, joinUrl: null, classUrl: "https://x.vn/a", leadMinutes: 15 }).text.includes("sau 15 phút nữa"));
const noLink = buildLessonReminderEmail({ courseName: "A", startAt: start, endAt: null, joinUrl: null, classUrl: "https://x.vn/a", leadMinutes: 60 });
check("33. không có link ⇒ nói rõ chưa có link, không có nút Vào học online", noLink.text.includes("chưa có link") && !lessonReminderHtml(noLink.view).includes("Vào học online"));
check("34. looksLikeMoney bắt được số tiền", ["Học phí 150.000đ", "còn 1.200.000 đồng", "500,000 VND", "2 triệu", "300 nghìn", "150000₫"].every(looksLikeMoney));
check("35. looksLikeMoney KHÔNG bắt giờ / ngày / thứ", ["lúc 19:00 đến 20:30", "Thứ 2 đến Thứ 6", "14/11/2026 lúc 19:00", "sau 15 phút nữa", "Lớp 9 đề 2"].every(s => !looksLikeMoney(s)));

console.log("▸ P2-1 (14/11/2026): link vào học trong thư chỉ nhận https");
// Ca phá cố ý (đã chạy): đổi httpsJoinUrl về /^https?:/ ⇒ 36–38 đỏ.
check("36. httpsJoinUrl: https giữ, http / javascript: / rác / rỗng → null", httpsJoinUrl("https://meet.google.com/abc-defg-hij") === "https://meet.google.com/abc-defg-hij"
  && [null, undefined, "", "http://meet.google.com/abc-defg-hij", "HTTP://x.y", "javascript:alert(1)", "meet.google.com/abc", "ftp://x.y"].every(u => httpsJoinUrl(u) === null));
{
  const m = buildLessonReminderEmail({ courseName: "Toán 8", startAt: vn("2026-11-14T19:00:00"), endAt: null, joinUrl: "http://meet.google.com/khong-ma-hoa", leadMinutes: 60, classUrl: "https://kin.vn/student/hoc-tap?course=x" });
  check("37. thư cron với link http: KHÔNG có link trong chữ thường lẫn view, ghi câu 'chưa có link'", !m.text.includes("http://meet") && m.view.joinUrl === null && m.text.includes(NO_LINK_TEXT), m.text);
  const h = lessonReminderHtml({ courseName: "Toán 8", soon: "sau 1 giờ nữa", when: "x", joinUrl: "http://meet.google.com/khong-ma-hoa", classUrl: "https://kin.vn/a" });
  check("38. HTML thư (kể cả nhận view có link http) không chèn link http, không nút 'Vào học online'", !h.includes("http://meet") && !h.includes("Vào học online"));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
