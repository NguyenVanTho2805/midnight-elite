// Phòng thi — phần thuần (src/lib/examRoom.ts): đồng hồ, tiêu đề Phần, dòng tiến độ, ghi chú hết giờ, câu đang xem.
import { formatClock, spokenClock, lowTimeAnnouncement, roomHeading, questionCounter, progressLine, timeUpNote, shortSectionName, currentQuestionIndex } from "@/lib/examRoom";
import { check, section, done } from "./h";

section("formatClock / spokenClock");
check("1902 giây → 31:42 (đúng Figma)", formatClock(1902) === "31:42", formatClock(1902));
check("0 → 00:00; âm → 00:00; NaN → 00:00", formatClock(0) === "00:00" && formatClock(-5) === "00:00" && formatClock(NaN) === "00:00");
check("9 giây → 00:09 (đệm số 0)", formatClock(9) === "00:09");
check("90 phút → 90:00 (không cắt ở 59)", formatClock(5400) === "90:00", formatClock(5400));
check("số lẻ giây bị làm tròn xuống", formatClock(61.9) === "01:01");
check("đọc to: 31 phút 42 giây / 42 giây", spokenClock(1902) === "31 phút 42 giây" && spokenClock(42) === "42 giây");

section("lowTimeAnnouncement");
check("còn nhiều → không đọc", lowTimeAnnouncement(1800) === "" && lowTimeAnnouncement(301) === "");
check("≤ 5 phút → 'Còn dưới 5 phút.'; ≤ 1 phút → 'Còn dưới 1 phút.'", lowTimeAnnouncement(300) === "Còn dưới 5 phút." && lowTimeAnnouncement(61) === "Còn dưới 5 phút." && lowTimeAnnouncement(60) === "Còn dưới 1 phút.");
check("hết giờ (0) → không đọc thêm", lowTimeAnnouncement(0) === "");
const set = new Set(Array.from({ length: 301 }, (_, i) => lowTimeAnnouncement(i)));
check("chỉ có 3 giá trị khác nhau trong 5 phút cuối (không đọc mỗi giây)", set.size === 3, [...set]);

section("roomHeading");
check("không chia Phần → tên đề", roomHeading({ examTitle: "  Đề thử Toán 9 " }) === "Đề thử Toán 9");
check("tên Phần đã bắt đầu bằng 'Phần' → giữ nguyên", roomHeading({ examTitle: "Đề", sectionLabel: "Phần Trắc nghiệm", sectionIndex: 0 }) === "Phần Trắc nghiệm");
check("'Phần 1: Toán…' giữ nguyên", roomHeading({ examTitle: "Đề", sectionLabel: "Phần 1: Toán và xử lý số liệu", sectionIndex: 0 }) === "Phần 1: Toán và xử lý số liệu");
check("tên Phần không có 'Phần' → thêm 'Phần n · '", roomHeading({ examTitle: "Đề", sectionLabel: "Toán và xử lý số liệu", sectionIndex: 0 }) === "Phần 1 · Toán và xử lý số liệu");
check("Phần thứ 3 → 'Phần 3 · …'", roomHeading({ examTitle: "Đề", sectionLabel: "Khoa học", sectionIndex: 2 }) === "Phần 3 · Khoa học");
check("tên Phần toàn khoảng trắng → coi như không có", roomHeading({ examTitle: "Đề", sectionLabel: "   " }) === "Đề");

section("questionCounter / progressLine");
check("Câu 18 / 50", questionCounter(18, 50) === "Câu 18 / 50");
check("ép trong khoảng: 0 → Câu 1; 99 → Câu 50", questionCounter(0, 50) === "Câu 1 / 50" && questionCounter(99, 50) === "Câu 50 / 50");
check("không có câu → chữ rõ ràng", questionCounter(1, 0) === "Chưa có câu hỏi");
check("tiến độ có tên Phần", progressLine(17, 50, "Phần 1") === "Đã trả lời 17 / 50 câu Phần 1");
check("tiến độ không chia Phần", progressLine(0, 2) === "Đã trả lời 0 / 2 câu");

section("timeUpNote / shortSectionName");
check("Phần giữa → nói rõ khoá và tự sang Phần kế", timeUpNote({ sectionName: "Phần 1", nextSectionName: "Phần 2" }) === "Hết giờ Phần 1 thì Phần 1 khoá lại, tự sang Phần 2. Không sửa lại được.");
check("Phần cuối / không chia Phần → 'tự nộp bài'", timeUpNote({ sectionName: "Phần 2" }) === "Hết giờ hệ thống tự nộp bài." && timeUpNote({}) === "Hết giờ hệ thống tự nộp bài.");
check("shortSectionName: 'Phần 1: Toán…' → 'Phần 1'", shortSectionName("Phần 1: Toán và xử lý số liệu", 0) === "Phần 1");
check("'Phần Trắc nghiệm' (không số) → nguyên tên", shortSectionName("Phần Trắc nghiệm", 0) === "Phần Trắc nghiệm");
check("'Khoa học' ở vị trí 2 → 'Phần 3'", shortSectionName("Khoa học", 2) === "Phần 3");
check("không có tên → null", shortSectionName(null, 0) === null && shortSectionName("  ", 1) === null);

section("currentQuestionIndex");
check("không có câu → 0", currentQuestionIndex([], 600) === 0);
check("đầu trang: câu 1 đang ở mép trên → câu 1", currentQuestionIndex([0, 300, 600], 600) === 0);
check("cuộn tới khi câu 2 vượt vạch 30% (180px) → câu 2", currentQuestionIndex([-250, 120, 420], 600) === 1);
check("câu 2 còn dưới vạch → vẫn câu 1", currentQuestionIndex([-100, 200, 500], 600) === 0);
check("cuộn hết: câu cuối", currentQuestionIndex([-900, -600, -300, 10], 600) === 3);

// ═══ BU-04 · examRoomLib.ts ═══════════════════════════════════════════════════
import {
  initialSaveState, enqueue, markSaved, markFailed, dropQueued, markRejected, retryRejected, backoffMs, classifySaveFailure, chipLabel, answerKey,
  serializeQueue, parseQueue, gridCell, toggleFlag, parseFlags, pruneFlags, submitConfirmWithFlags, defaultView, resolveView,
  daysLeftLabel, opensLabel, assignmentState, sortAssignments,
} from "@/lib/examRoomLib";
import type { SaveAnswerBody } from "@/lib/examRoomApi";

const opt = (q: string, o: string): SaveAnswerBody => ({ kind: "option", questionId: q, optionId: o });
const bool = (o: string, v: boolean): SaveAnswerBody => ({ kind: "bool", optionId: o, answerTrue: v });

section("BU-04 chip lưu: idle → saving → saved");
let st = initialSaveState();
check("ban đầu idle, chip rỗng", st.status === "idle" && chipLabel(st) === "");
st = enqueue(st, opt("q1", "a"));
check("có đáp án → saving, 'Đang lưu…'", st.status === "saving" && chipLabel(st) === "Đang lưu…");
st = markSaved(st, "q:q1", st.seq, "2026-11-05T07:03:22.000Z");
check("lưu xong → saved, giờ MÁY CHỦ theo VN (14:03:22)", st.status === "saved" && chipLabel(st) === "Đã lưu 14:03:22", chipLabel(st));
check("hàng đợi rỗng sau khi lưu", st.queue.length === 0);

section("BU-04 chip lưu: lỗi, thử lại, gộp bản mới nhất");
st = enqueue(initialSaveState(), opt("q1", "a"));
st = markFailed(st);
check("lỗi → failed, nói rõ số câu + Thử lại", st.status === "failed" && chipLabel(st) === "Chưa lưu được · 1 câu · Thử lại", chipLabel(st));
st = enqueue(st, opt("q2", "b"));
check("thêm câu khác khi đang lỗi → 'Đang lưu…' và đợi có 2 câu", st.status === "saving" && st.queue.length === 2);
st = markFailed(st);
check("lỗi lần 2: retries=2, 2 câu", st.retries === 2 && chipLabel(st).includes("2 câu"));
const a1 = enqueue(initialSaveState(), opt("q1", "a"));
const a2 = enqueue(a1, opt("q1", "c"));
check("đổi đáp án cùng câu → hàng đợi vẫn 1 mục, giữ bản CUỐI (c)", a2.queue.length === 1 && a2.queue[0].body.kind === "option" && (a2.queue[0].body as { optionId: string }).optionId === "c");
// ca phá: bản cũ (seq 1) gửi xong NHƯNG học sinh đã đổi sang seq 2 → không được xoá bản mới, không được báo 'Đã lưu'
const stale = markSaved(a2, "q:q1", a1.seq, "2026-11-05T07:00:00.000Z");
check("ca phá: xác nhận bản cũ KHÔNG xoá bản mới, chip vẫn 'Đang lưu…'", stale.queue.length === 1 && stale.status === "saving" && stale.queue[0].seq === a2.seq, stale);
const fresh = markSaved(stale, "q:q1", a2.seq, "2026-11-05T07:00:01.000Z");
check("xác nhận bản mới → rỗng + saved", fresh.queue.length === 0 && fresh.status === "saved");
const ok = markSaved(markFailed(a1), "q:q1", a1.seq, "2026-11-05T07:00:00.000Z");
check("thử lại thành công → saved, retries về 0", ok.status === "saved" && ok.retries === 0);
check("Đúng–Sai: mỗi ý một khoá riêng", enqueue(enqueue(initialSaveState(), bool("o1", true)), bool("o2", false)).queue.length === 2 && answerKey(bool("o1", true)) === "b:o1");
check("dropQueued bỏ mục lỗi dữ liệu", dropQueued(a1, "q:q1", a1.seq).queue.length === 0);
check("markFailed khi hàng đợi rỗng không bật 'failed' giả", markFailed(initialSaveState()).status === "idle");

section("BU-04 lùi mũi + phân loại lỗi lưu");
check("1s,2s,4s,8s", [0, 1, 2, 3].map(backoffMs).join() === "1000,2000,4000,8000", [0, 1, 2, 3].map(backoffMs));
check("trần 15s (kể cả số rất lớn / NaN / âm)", backoffMs(4) === 15000 && backoffMs(50) === 15000 && backoffMs(NaN) === 1000 && backoffMs(-3) === 1000);
check("expired/finished → time_up (không phải lỗi mạng)", classifySaveFailure(409, "expired") === "time_up" && classifySaveFailure(409, "finished") === "time_up");
check("mạng / 5xx / 429 → retry", classifySaveFailure(0, "network") === "retry" && classifySaveFailure(503, undefined) === "retry" && classifySaveFailure(429, undefined) === "retry");
check("section_locked / 400 → drop (không lặp mãi)", classifySaveFailure(409, "section_locked") === "drop" && classifySaveFailure(400, undefined) === "drop");

section("5A (04/11/2026): máy chủ từ chối đáp án bằng 4xx → chip 'Chưa lưu được', không im lặng 'Đã lưu'");
// Ca gốc của lỗi: em đã có một lần lưu thành công (savedAt có) rồi một đáp án bị 4xx — trước đây dropQueued đưa chip về "Đã lưu" dù đáp án chưa lên máy chủ.
let r0 = markSaved(enqueue(initialSaveState(), opt("q1", "a")), "q:q1", 1, "2026-11-05T07:00:00.000Z");
check("tiền đề: đã lưu câu 1, chip 'Đã lưu 14:00:00'", r0.status === "saved" && chipLabel(r0) === "Đã lưu 14:00:00", chipLabel(r0));
r0 = enqueue(r0, opt("q2", "b"));
const old = dropQueued(r0, "q:q2", r0.seq);
check("(hành vi cũ, còn dùng được ở chỗ khác) dropQueued vẫn đưa chip về 'saved'", old.status === "saved" && old.rejected.length === 0);
const rj = markRejected(r0, "q:q2", r0.seq);
check("markRejected: chip → failed, đúng chữ 'Chưa lưu được · 1 câu · Thử lại'", rj.status === "failed" && chipLabel(rj) === "Chưa lưu được · 1 câu · Thử lại", chipLabel(rj));
check("…hàng đợi rỗng (không thử lại tự động mãi), đáp án bị từ chối được GIỮ, retries không tăng", rj.queue.length === 0 && rj.rejected.length === 1 && rj.rejected[0].key === "q:q2" && rj.retries === r0.retries, rj);
check("…KHÔNG còn chữ 'Đã lưu'", !chipLabel(rj).includes("Đã lưu"));
check("markRejected với khoá không có trong hàng đợi → không đổi gì", markRejected(r0, "q:khong-co", 99) === r0);
check("markRejected lúc CHƯA từng lưu (savedAt rỗng) cũng ra failed, không phải idle", markRejected(enqueue(initialSaveState(), opt("q1", "a")), "q:q1", 1).status === "failed");

// Còn mục khác đang gửi: vẫn 'saving' cho tới khi chúng xong; xong rồi mà còn bị từ chối → failed, KHÔNG 'saved'.
let two = enqueue(enqueue(initialSaveState(), opt("q1", "a")), opt("q2", "b"));
two = markRejected(two, "q:q1", 1);
check("một câu bị từ chối, câu kia còn gửi → vẫn 'saving'", two.status === "saving" && two.queue.length === 1 && two.rejected.length === 1, two);
two = markSaved(two, "q:q2", 2, "2026-11-05T07:01:00.000Z");
check("câu kia lưu xong mà câu 1 vẫn bị từ chối → 'failed' (không 'Đã lưu' giả)", two.status === "failed" && chipLabel(two) === "Chưa lưu được · 1 câu · Thử lại" && two.savedAt === "2026-11-05T07:01:00.000Z", two);
check("2 câu bị từ chối + 1 câu lỗi mạng → chip đếm đủ 3", (() => { let x = enqueue(enqueue(enqueue(initialSaveState(), opt("q1", "a")), opt("q2", "b")), opt("q3", "c")); x = markRejected(x, "q:q1", 1); x = markRejected(x, "q:q2", 2); x = markFailed(x); return chipLabel(x) === "Chưa lưu được · 3 câu · Thử lại"; })());

// Em đổi đáp án đúng câu bị từ chối: lần thử mới thay bản cũ.
const re = enqueue(rj, opt("q2", "c"));
check("đổi đáp án câu bị từ chối → bản bị từ chối cũ bị thay, chip 'Đang lưu…'", re.rejected.length === 0 && re.queue.length === 1 && re.status === "saving", re);
check("…rồi lưu được → 'Đã lưu' trở lại", markSaved(re, "q:q2", re.seq, "2026-11-05T07:02:00.000Z").status === "saved");
const other = enqueue(rj, opt("q3", "a"));
check("đổi đáp án câu KHÁC không xoá bản bị từ chối", other.rejected.length === 1 && other.queue.length === 1);
check("…và khi câu khác lưu xong chip vẫn 'failed' vì câu kia còn bị từ chối", markSaved(other, "q:q3", other.seq, "2026-11-05T07:03:00.000Z").status === "failed");

// Nút Thử lại.
const rt = retryRejected(rj);
check("retryRejected: đưa về hàng đợi với seq MỚI lớn hơn mọi seq cũ, rejected rỗng, chip 'Đang lưu…'", rt.status === "saving" && rt.rejected.length === 0 && rt.queue.length === 1 && rt.queue[0].key === "q:q2" && rt.queue[0].seq > rj.seq && rt.seq === rt.queue[0].seq, rt);
check("…bản thử lại giữ nguyên nội dung đáp án", JSON.stringify(rt.queue[0].body) === JSON.stringify(opt("q2", "b")));
check("…bị từ chối lần nữa → lại 'failed', không lặp vô hạn (queue rỗng)", (() => { const x = markRejected(rt, "q:q2", rt.queue[0].seq); return x.status === "failed" && x.queue.length === 0 && x.rejected.length === 1; })());
check("…lưu được → 'Đã lưu'", markSaved(rt, "q:q2", rt.queue[0].seq, "2026-11-05T07:04:00.000Z").status === "saved");
check("retryRejected khi không có gì bị từ chối → trả nguyên trạng thái", retryRejected(r0) === r0);
check("retryRejected thay mục cùng khoá còn trong hàng đợi (không trùng khoá)", (() => { const x = { ...rj, queue: [{ key: "q:q2", seq: 50, body: opt("q2", "z") }], seq: 50 }; const y = retryRejected(x); return y.queue.filter(q => q.key === "q:q2").length === 1 && y.queue[0].seq > 50; })());
check("lỗi mạng (markFailed) và bị từ chối không lẫn nhau: markFailed khi chỉ còn bị từ chối (queue rỗng) vẫn 'failed', retries +1 không đổi trạng thái", (() => { const x = markFailed(rj); return x.status === "failed" && x.rejected.length === 1; })());
check("Đúng–Sai: ý bị từ chối giữ riêng theo khoá b:<ý>", (() => { let x = enqueue(enqueue(initialSaveState(), bool("o1", true)), bool("o2", false)); x = markRejected(x, "b:o1", 1); return x.rejected.length === 1 && x.rejected[0].key === "b:o1" && x.queue.length === 1; })());

section("BU-04 hàng đợi localStorage");
const q2 = enqueue(enqueue(enqueue(initialSaveState(), opt("q1", "a")), bool("o1", true)), { kind: "text", questionId: "q9", textAnswer: "xin chào" });
check("vòng tròn serialize/parse giữ nguyên 3 mục", parseQueue(serializeQueue(q2.queue)).length === 3 && JSON.stringify(parseQueue(serializeQueue(q2.queue)).map(x => x.body)) === JSON.stringify(q2.queue.map(x => x.body)));
check("ca phá: rỗng / JSON hỏng / không phải mảng / phần tử rác → [] (không ném)", parseQueue(null).length === 0 && parseQueue("{").length === 0 && parseQueue("{}").length === 0 && parseQueue('[1,null,{"key":1},{"key":"x","seq":1,"body":{"kind":"zzz"}}]').length === 0);

section("BU-04 ô lưới + đánh dấu xem lại");
check("chưa làm → dash; đã làm → dot; đánh dấu → flag; hiện tại → current", gridCell(1, false, false, false).marker === "dash" && gridCell(1, true, false, false).marker === "dot" && gridCell(1, true, true, false).marker === "flag" && gridCell(1, true, true, true).marker === "current");
check("nhãn đọc to nói đủ: đã làm + đánh dấu + đang xem", gridCell(3, true, true, true).ariaLabel === "Câu 3, đã làm, đánh dấu xem lại, đang xem", gridCell(3, true, true, true).ariaLabel);
check("nhãn không chỉ dựa màu: chưa làm có chữ", gridCell(7, false, false, false).ariaLabel === "Câu 7, chưa làm");
check("toggleFlag bật rồi tắt, không sửa mảng gốc", (() => { const a = ["q1"]; const b = toggleFlag(a, "q2"); const c = toggleFlag(b, "q1"); return a.length === 1 && b.join() === "q1,q2" && c.join() === "q2"; })());
check("parseFlags: hỏng → []; trùng gộp; không phải chuỗi bỏ", parseFlags("x").length === 0 && parseFlags('["a","a",1,"b"]').join() === "a,b");
check("pruneFlags bỏ cờ của câu không còn", pruneFlags(["a", "z"], ["a", "b"]).join() === "a");
const msgNone = submitConfirmWithFlags([], false, 0, []);
check("không đánh dấu → giữ nguyên lời cũ", msgNone === "Em đã trả lời hết các câu. Nộp rồi thì không sửa lại được.", msgNone);
const msgF = submitConfirmWithFlags([{ index: 3, id: "x", essay: false }, { index: 5, id: "y", essay: false }], false, 0, [5, 3, 3]);
check("đếm câu chưa làm + câu đánh dấu (không trùng), câu chốt vẫn ở cuối", msgF.includes("Em còn 2 câu chưa làm: Câu 3, 5.") && msgF.includes("2 câu đánh dấu xem lại: Câu 3, 5.") && msgF.endsWith("Nộp rồi thì không sửa lại được."), msgF);

section("BU-04 chế độ xem");
check("luyện tập luôn Từng câu (kể cả màn rộng, kể cả đã nhớ 'whole')", defaultView("practice", 1600) === "per-question" && resolveView("whole", "practice", 1600) === "per-question");
check("kiểm tra: ≥1024 → Cả đề; hẹp → Từng câu", defaultView("test", 1280) === "whole" && defaultView("test", 390) === "per-question" && defaultView(null, 1024) === "whole" && defaultView(null, 1023) === "per-question");
check("đã nhớ thì thắng mặc định; giá trị lạ → mặc định", resolveView("per-question", "test", 1600) === "per-question" && resolveView("zzz", "test", 1600) === "whole" && resolveView(null, "test", 390) === "per-question");

section("BU-04 daysLeftLabel / opensLabel (giờ VN)");
const NOW = "2026-11-05T10:00:00+07:00";
check("3 ngày nữa → 'Còn 3 ngày'", daysLeftLabel("2026-11-08T21:00:00+07:00", NOW) === "Còn 3 ngày");
check("ngày mai (dù chưa đủ 24h) → 'Còn 1 ngày'", daysLeftLabel("2026-11-06T08:00:00+07:00", NOW) === "Còn 1 ngày");
check("hôm nay chưa tới giờ → 'Hết hạn hôm nay 21:00'", daysLeftLabel("2026-11-05T21:00:00+07:00", NOW) === "Hết hạn hôm nay 21:00", daysLeftLabel("2026-11-05T21:00:00+07:00", NOW));
check("đã qua giờ → 'Đã quá hạn' (cả hôm nay lẫn hôm qua)", daysLeftLabel("2026-11-05T09:00:00+07:00", NOW) === "Đã quá hạn" && daysLeftLabel("2026-11-01T09:00:00+07:00", NOW) === "Đã quá hạn");
check("ca biên: UTC 17:30 đã là 00:30 ngày sau ở VN → hạn 21:00 VN cùng ngày VN là 'hôm nay'", daysLeftLabel("2026-11-06T14:00:00Z", "2026-11-05T17:30:00Z") === "Hết hạn hôm nay 21:00", daysLeftLabel("2026-11-06T14:00:00Z", "2026-11-05T17:30:00Z"));
check("ca biên: 23:59 VN, hạn 00:30 VN ngày sau → 'Còn 1 ngày' (đếm ngày lịch)", daysLeftLabel("2026-11-05T17:30:00Z", "2026-11-05T16:59:00Z") === "Còn 1 ngày");
check("không hạn / hạn hỏng → ''", daysLeftLabel(null, NOW) === "" && daysLeftLabel("không phải ngày", NOW) === "" && daysLeftLabel("2026-11-08T21:00:00+07:00", "hỏng") === "");
check("opensLabel: 'Mở lúc 19:00 05/11'", opensLabel("2026-11-05T19:00:00+07:00") === "Mở lúc 19:00 05/11" && opensLabel(null) === "" && opensLabel("x") === "");

section("BU-04 assignmentState / sortAssignments");
const F = { inProgress: false, used: 0, max: null as number | null, pendingPublish: false, windowState: "open" as const, active: true, mode: "test" as string | null };
check("lượt đang làm → dang-lam (thắng mọi thứ, kể cả đã đóng)", assignmentState({ ...F, inProgress: true, windowState: "closed" }) === "dang-lam");
check("chờ công bố → cho-cong-bo", assignmentState({ ...F, used: 1, pendingPublish: true }) === "cho-cong-bo");
check("chưa tới giờ → chua-mo; đóng + chưa làm → da-dong; đóng + đã làm → da-lam", assignmentState({ ...F, windowState: "not_open" }) === "chua-mo" && assignmentState({ ...F, windowState: "closed" }) === "da-dong" && assignmentState({ ...F, windowState: "closed", used: 1 }) === "da-lam");
check("tắt đề (active=false) → da-dong", assignmentState({ ...F, active: false }) === "da-dong");
check("kiểm tra còn lượt → dang-mo; hết lượt → da-lam; luyện tập đã làm → da-lam", assignmentState({ ...F, used: 1, max: 2 }) === "dang-mo" && assignmentState({ ...F, used: 2, max: 2 }) === "da-lam" && assignmentState({ ...F, used: 1, mode: "practice" }) === "da-lam");
const A = (id: string, state: any, dueAt: string | null, opensAt: string | null = null, title = id) => ({ id, title, state, dueAt, opensAt });
const sorted = sortAssignments([
  A("lam", "da-lam", "2026-10-01T00:00:00Z"), A("dong", "da-dong", "2026-10-20T00:00:00Z"), A("cho", "cho-cong-bo", null),
  A("mo-xa", "dang-mo", "2026-11-20T00:00:00Z"), A("mo-gan", "dang-mo", "2026-11-06T00:00:00Z"), A("mo-khong-han", "dang-mo", null),
  A("chua-muon", "chua-mo", null, "2026-12-01T00:00:00Z"), A("chua-som", "chua-mo", null, "2026-11-10T00:00:00Z"), A("dang", "dang-lam", null),
]);
check("thứ tự đúng đặc tả", sorted.map(x => x.id).join() === "dang,mo-gan,mo-xa,mo-khong-han,chua-som,chua-muon,cho,dong,lam", sorted.map(x => x.id));
const tie = sortAssignments([A("b", "dang-mo", null, null, "Đề B"), A("a", "dang-mo", null, null, "Đề A")]);
check("hòa → theo tên, ổn định", tie.map(x => x.id).join() === "a,b");
const input = [A("2", "da-lam", null), A("1", "dang-lam", null)]; sortAssignments(input);
check("không sửa mảng đầu vào", input[0].id === "2");
done();
