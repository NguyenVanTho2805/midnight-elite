// BU-01..07, LI-10/11/16/17, DD-03 — bài THUẦN cho quy tắc trang buổi học (src/lib/sessionBook.ts). Không cần máy chủ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-session-book-lib.ts
import {
  buildSessionShareMessage, cleanStudentNote, closeCheck, conflictText, effectiveLocation, effectiveMode, findSlotConflicts, isOffScheduleKind,
  LOCATION_MAX, NOTE_MAX, parseExtraSession, parseSessionPatch, patchCalendarPrefs, readCalendarPrefs, reopenWarning, resolveJoinUrl, sessionStatusLabel,
  slotsOverlap, STUDENT_NOTE_MAX, tallyAttendance, type SlotWithStudents,
} from "@/lib/sessionBook";
import { check, section, done } from "./h";

const NOW = new Date("2026-10-24T05:00:00Z"); // 12:00 ngày 24/10/2026 giờ VN
const slot = (key: string, courseId: string, s: number, e: number, studentIds: string[] = [], dateKey = "2026-10-26"): SlotWithStudents =>
  ({ key, courseId, courseName: `Lớp ${courseId}`, dateKey, startMin: s, endMin: e, studentIds });

(async () => {
  section("Ghi chép 3 phần (BU-04) và hình thức (LI-16)");
  const p1 = parseSessionPatch({ taught: "  Hàm số bậc nhất \r\nvà đồ thị ", homework: "Bài 1-5 trang 40", summary: "Cả lớp theo kịp", mode: "offline", location: "  Số 5   Ngõ 3 ", joinUrl: "" });
  check("đọc đúng: cắt khoảng trắng, đổi xuống dòng kiểu Windows, gộp khoảng trắng ở địa chỉ, link rỗng = xoá", p1.ok && p1.value.taught === "Hàm số bậc nhất \nvà đồ thị" && p1.value.location === "Số 5 Ngõ 3" && p1.value.joinUrl === null && p1.value.mode === "offline");
  check("trường vắng mặt = giữ nguyên (không có khoá trong kết quả)", (() => { const r = parseSessionPatch({ taught: "x" }); return r.ok && Object.keys(r.value).join() === "taught"; })());
  check("chuỗi rỗng / null = xoá (null)", (() => { const r = parseSessionPatch({ taught: "   ", homework: null, mode: "" }); return r.ok && r.value.taught === null && r.value.homework === null && r.value.mode === null; })());
  check(`quá ${NOTE_MAX} ký tự → từ chối, nêu tên phần`, (() => { const r = parseSessionPatch({ homework: "a".repeat(NOTE_MAX + 1) }); return !r.ok && r.error.includes("Bài tập về nhà"); })() && parseSessionPatch({ summary: "a".repeat(NOTE_MAX) }).ok);
  check(`địa chỉ quá ${LOCATION_MAX} → từ chối`, !parseSessionPatch({ location: "a".repeat(LOCATION_MAX + 1) }).ok);
  check("sai kiểu (số, mảng, đối tượng) → từ chối", [{ taught: 5 }, { summary: ["a"] }, { location: {} }].every(b => !parseSessionPatch(b).ok));
  check("hình thức lạ ('hybrid', 'ONLINE') → từ chối", !parseSessionPatch({ mode: "hybrid" }).ok && !parseSessionPatch({ mode: "ONLINE" }).ok);
  check("link không phải http(s) (javascript:, ftp:) → từ chối", !parseSessionPatch({ joinUrl: "javascript:alert(1)" }).ok && !parseSessionPatch({ joinUrl: "ftp://a.b" }).ok && parseSessionPatch({ joinUrl: "https://meet.google.com/abc" }).ok);
  check("không phải đối tượng / null / mảng → từ chối, không ném lỗi", !parseSessionPatch(null).ok && !parseSessionPatch("x").ok && !parseSessionPatch([]).ok);

  section("Ba cách đặt link online: riêng buổi > theo khung giờ > chung lớp (LI-17)");
  check("có cả ba → lấy riêng buổi", resolveJoinUrl({ sessionUrl: "https://a/s", scheduleUrl: "https://a/k", classUrl: "https://a/c" })?.source === "session");
  check("không có riêng buổi → khung giờ", (() => { const r = resolveJoinUrl({ sessionUrl: null, scheduleUrl: "https://a/k", classUrl: "https://a/c" }); return r?.source === "schedule" && r.url === "https://a/k"; })());
  check("chỉ có chung lớp → chung lớp", resolveJoinUrl({ classUrl: "https://a/c" })?.source === "class");
  check("chuỗi toàn khoảng trắng coi như trống; không có gì → null", resolveJoinUrl({ sessionUrl: "   ", scheduleUrl: "", classUrl: undefined }) === null);
  check("link bị cắt khoảng trắng hai đầu", resolveJoinUrl({ classUrl: "  https://a/c " })?.url === "https://a/c");

  section("Hình thức hiệu lực và địa chỉ (LI-16)");
  check("riêng buổi thắng khung giờ", effectiveMode({ sessionMode: "online", scheduleMode: "offline" }) === "online");
  check("buổi chưa chọn → theo khung giờ; cả hai chưa chọn / giá trị lạ → null", effectiveMode({ sessionMode: null, scheduleMode: "offline" }) === "offline" && effectiveMode({ sessionMode: "x", scheduleMode: "y" }) === null && effectiveMode({}) === null);
  check("địa chỉ chỉ hiện khi OFFLINE; ưu tiên địa chỉ của buổi", effectiveLocation({ mode: "offline", sessionLocation: "A", scheduleLocation: "B" }) === "A" && effectiveLocation({ mode: "offline", sessionLocation: null, scheduleLocation: "B" }) === "B" && effectiveLocation({ mode: "online", sessionLocation: "A" }) === null && effectiveLocation({ mode: null, scheduleLocation: "B" }) === null);

  section("Chốt buổi 'Đã dạy xong' (BU-02)");
  check("buổi hôm nay chưa chốt → chốt được, không phải 'đã chốt trước đó'", (() => { const r = closeCheck({ dateKey: "2026-10-24", state: null, now: NOW }); return r.ok && r.already === false; })());
  check("buổi đã qua → chốt được", closeCheck({ dateKey: "2026-10-01", state: "open", now: NOW }).ok);
  check("buổi ngày mai → TỪ CHỐI (chưa tới ngày)", (() => { const r = closeCheck({ dateKey: "2026-10-25", state: null, now: NOW }); return !r.ok && r.error.includes("chưa tới ngày"); })());
  check("ranh giới múi giờ: 23:30 VN ngày 24 (16:30Z) vẫn là hôm nay; 00:30 VN ngày 25 (17:30Z ngày 24) thì buổi ngày 25 chốt được", closeCheck({ dateKey: "2026-10-24", state: null, now: new Date("2026-10-24T16:30:00Z") }).ok && !closeCheck({ dateKey: "2026-10-25", state: null, now: new Date("2026-10-24T16:30:00Z") }).ok && closeCheck({ dateKey: "2026-10-25", state: null, now: new Date("2026-10-24T17:30:00Z") }).ok);
  check("đã chốt rồi → ok nhưng already=true (không ghi đè thời điểm chốt)", (() => { const r = closeCheck({ dateKey: "2026-10-01", state: "closed", now: NOW }); return r.ok && r.already === true; })());
  check("ngày sai định dạng / không tồn tại → từ chối", !closeCheck({ dateKey: "2026-02-31", state: null, now: NOW }).ok && !closeCheck({ dateKey: "hôm qua", state: null, now: NOW }).ok);

  section("Chữ trạng thái luôn có chữ (BU-01)");
  const lab = (dateKey: string, state: string | null, cancelled = false) => sessionStatusLabel({ dateKey, state, now: NOW, cancelled });
  check("đã chốt → 'Đã dạy xong' (xong)", lab("2026-10-20", "closed").text === "Đã dạy xong" && lab("2026-10-20", "closed").tone === "xong");
  check("tương lai → 'Sắp diễn ra'; hôm nay chưa chốt; đã qua chưa chốt", lab("2026-10-30", null).text === "Sắp diễn ra" && lab("2026-10-24", null).text.includes("Hôm nay") && lab("2026-10-20", "open").text.includes("Đã qua"));
  check("huỷ thắng mọi trạng thái; chốt thắng ngày", lab("2026-10-30", "closed", true).text === "Đã huỷ" && lab("2026-10-30", "closed").text === "Đã dạy xong");

  section("Mở lại buổi đã chốt: cảnh báo, không tự sửa phiếu (BU-03)");
  check("không có phiếu, không dòng phí đã vào phiếu → không cảnh báo", reopenWarning({ invoicedCharges: 0, invoices: 0, yearMonth: "2026-10" }) === null);
  check("có dòng phí đã vào phiếu → cảnh báo nêu số dòng + tháng", (() => { const w = reopenWarning({ invoicedCharges: 2, invoices: 0, yearMonth: "2026-10" }); return !!w && w.includes("2 dòng học phí") && w.includes("10/2026"); })());
  check("chỉ có phiếu tháng (lớp cách cũ) → cảnh báo nêu số phiếu", (() => { const w = reopenWarning({ invoicedCharges: 0, invoices: 3, yearMonth: "2026-09" }); return !!w && w.includes("3 phiếu") && w.includes("09/2026"); })());
  check("lời cảnh báo nói rõ KHÔNG tự sửa phiếu; không có từ cấm 'đã xác minh'", (() => { const w = reopenWarning({ invoicedCharges: 1, invoices: 1, yearMonth: "2026-10" })!; return w.includes("KHÔNG tự sửa") && !/xác minh/i.test(w); })());

  section("Nhận xét riêng từng em (BU-07)");
  check("cắt khoảng trắng; rỗng → null", (() => { const a = cleanStudentNote("  Em   làm bài tốt "); const b = cleanStudentNote("   "); return a.ok && a.value === "Em làm bài tốt" && b.ok && b.value === null; })());
  check(`quá ${STUDENT_NOTE_MAX} ký tự / không phải chữ → từ chối`, !cleanStudentNote("a".repeat(STUDENT_NOTE_MAX + 1)).ok && !cleanStudentNote(5).ok && cleanStudentNote("a".repeat(STUDENT_NOTE_MAX)).ok);

  section("Bộ đếm điểm danh (DD-03)");
  const t = tallyAttendance([{ status: "present" }, { status: "present", dirty: true }, { status: "late" }, { status: "excused" }, { status: "absent", dirty: true }, { status: null }, { status: "linh-tinh" }]);
  check("đếm đúng từng trạng thái; null và giá trị lạ tính là chưa điểm danh", t.present === 2 && t.late === 1 && t.excused === 1 && t.absent === 1 && t.none === 2 && t.total === 7 && t.dirty === 2);
  check("lớp rỗng → toàn 0", JSON.stringify(tallyAttendance([])) === JSON.stringify({ present: 0, late: 0, excused: 0, absent: 0, none: 0, total: 0, dirty: 0 }));

  section("Xung đột lịch (LI-10)");
  check("chồng giờ → true; chạm đầu mút (10:00 kết thúc, 10:00 bắt đầu) → false", slotsOverlap({ startMin: 540, endMin: 600 }, { startMin: 570, endMin: 630 }) && !slotsOverlap({ startMin: 540, endMin: 600 }, { startMin: 600, endMin: 660 }) && !slotsOverlap({ startMin: 600, endMin: 660 }, { startMin: 540, endMin: 600 }));
  check("khoảng rỗng/ngược (end <= start) không làm hỏng: coi là 1 phút", slotsOverlap({ startMin: 600, endMin: 600 }, { startMin: 540, endMin: 660 }) && !slotsOverlap({ startMin: 600, endMin: 500 }, { startMin: 700, endMin: 760 }));
  const cand = slot("new", "A", 1140, 1260, ["s1", "s2"]); // 19:00–21:00
  check("gia sư có buổi khác cùng giờ → 1 xung đột 'gia-su'", (() => { const c = findSlotConflicts(cand, [slot("k1", "B", 1200, 1320, ["s9"])]); return c.length === 1 && c[0].kind === "gia-su" && c[0].other.courseId === "B"; })());
  check("lớp khác chung học sinh → thêm 'hoc-sinh' kèm SỐ em chung (không có tên)", (() => { const c = findSlotConflicts(cand, [slot("k1", "B", 1200, 1320, ["s2", "s3"])]); return c.length === 2 && c[1].kind === "hoc-sinh" && c[1].sharedStudents === 1 && !JSON.stringify(c).includes("s2"); })());
  check("khác ngày hoặc không chồng giờ → không xung đột", findSlotConflicts(cand, [slot("k1", "B", 1200, 1320, [], "2026-10-27"), slot("k2", "B", 1260, 1320)]).length === 0);
  check("chính buổi đang sửa (cùng key) bị bỏ qua", findSlotConflicts(cand, [slot("new", "A", 1140, 1260, ["s1"])]).length === 0);
  check("cùng lớp, hai khung chồng nhau → 'gia-su' nhưng KHÔNG báo 'hoc-sinh' (em của chính lớp đó)", (() => { const c = findSlotConflicts(cand, [slot("k1", "A", 1150, 1200, ["s1"])]); return c.length === 1 && c[0].kind === "gia-su"; })());
  check("chữ báo có giờ + tên lớp, không lộ id em", (() => { const c = findSlotConflicts(cand, [slot("k1", "B", 1200, 1320, ["s2"])]); return conflictText(c[0]).includes("Lớp B") && conflictText(c[0]).includes("20:00") && !conflictText(c[1]).includes("s2"); })());

  section("Thêm buổi nhanh (LI-11)");
  const okBody = { dateKey: "2026-10-31", startTime: "9:00", endTime: "10:30", kind: "makeup", mode: "offline", location: "Nhà em A" };
  check("hợp lệ: chuẩn hoá giờ 9:00 → 09:00, giữ loại/hình thức/địa chỉ", (() => { const r = parseExtraSession(okBody, NOW); return r.ok && r.value.startTime === "09:00" && r.value.kind === "makeup" && r.value.mode === "offline" && r.value.location === "Nhà em A"; })());
  check("cho nhập bù ngày đã qua", parseExtraSession({ ...okBody, dateKey: "2026-09-01" }, NOW).ok);
  check("quá 1 năm tới → từ chối", !parseExtraSession({ ...okBody, dateKey: "2028-01-01" }, NOW).ok);
  check("kết thúc không sau bắt đầu / giờ sai → từ chối", !parseExtraSession({ ...okBody, endTime: "09:00" }, NOW).ok && !parseExtraSession({ ...okBody, startTime: "25:00" }, NOW).ok && !parseExtraSession({ ...okBody, endTime: undefined }, NOW).ok);
  check("loại 'regular' hoặc lạ → từ chối (buổi theo lịch tuần không tạo bằng đường này)", !parseExtraSession({ ...okBody, kind: "regular" }, NOW).ok && !parseExtraSession({ ...okBody, kind: "x" }, NOW).ok);
  check("ngày không tồn tại → từ chối; link sai → từ chối", !parseExtraSession({ ...okBody, dateKey: "2026-02-30" }, NOW).ok && !parseExtraSession({ ...okBody, joinUrl: "javascript:1" }, NOW).ok);
  check("isOffScheduleKind: extra/makeup/adhoc đúng, regular/null sai", isOffScheduleKind("extra") && isOffScheduleKind("makeup") && isOffScheduleKind("adhoc") && !isOffScheduleKind("regular") && !isOffScheduleKind(null));

  section("Bộ lọc lịch lưu ở tài khoản (LI-03)");
  check("mặc định hiện buổi đã huỷ, tất cả lớp; chỉ đúng boolean true mới ẩn", !readCalendarPrefs(undefined).hideCancelled && !readCalendarPrefs({ hideCancelled: "true" }).hideCancelled && !readCalendarPrefs([]).hideCancelled && readCalendarPrefs({ hideCancelled: true }).hideCancelled && readCalendarPrefs({}).courseId === null);
  check("mã lớp: chữ ngắn thì nhận; rỗng / số / quá 100 ký tự → coi như tất cả lớp", readCalendarPrefs({ courseId: "lop-1" }).courseId === "lop-1" && readCalendarPrefs({ courseId: "" }).courseId === null && readCalendarPrefs({ courseId: 5 }).courseId === null && readCalendarPrefs({ courseId: "x".repeat(101) }).courseId === null);
  const base = { hideCancelled: false, courseId: null };
  check("vá từng khoá, giữ khoá còn lại", (() => { const r = patchCalendarPrefs({ hideCancelled: true, courseId: "a" }, { courseId: "b" }); return r.ok && r.value.courseId === "b" && r.value.hideCancelled === true; })());
  check("null / rỗng đưa khoá về mặc định", (() => { const r = patchCalendarPrefs({ hideCancelled: true, courseId: "a" }, { hideCancelled: null, courseId: "" }); return r.ok && r.value.hideCancelled === false && r.value.courseId === null; })());
  check("[phá] khoá lạ / sai kiểu / không phải đối tượng → lỗi", !patchCalendarPrefs(base, { sapXep: 1 }).ok && !patchCalendarPrefs(base, { hideCancelled: "co" }).ok && !patchCalendarPrefs(base, { courseId: 7 }).ok && !patchCalendarPrefs(base, { courseId: "x".repeat(101) }).ok && !patchCalendarPrefs(base, null).ok && !patchCalendarPrefs(base, []).ok);

  section("Tin chia sẻ báo cáo buổi (BU-14): chung cả lớp, không tên em, không tiền");
  const msg = buildSessionShareMessage({ courseName: "Toán 9", dateKey: "2026-10-20", taught: "Hàm số", homework: "Bài 1-5", summary: "Cả lớp tốt" });
  check("có ngày dd/mm, đủ ba phần", msg.includes("20/10") && msg.includes("Đã dạy: Hàm số") && msg.includes("Bài tập về nhà: Bài 1-5") && msg.includes("Nhận xét chung: Cả lớp tốt"));
  check("không có ghi chép → nói thật là chưa ghi, không bịa", buildSessionShareMessage({ courseName: "Toán 9", dateKey: "2026-10-20" }).includes("chưa ghi nội dung"));
  check("không chứa chữ tiền / học phí / 'đã gửi'", !/(học phí|đồng|vnđ|đã gửi)/i.test(msg));

  await done();
})();
