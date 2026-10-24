// QZ-11/12 phía học sinh — phần thuần (src/lib/quizRoom.ts): giờ máy chủ, câu chưa làm, cổng số lượt, ai thấy gì, chữ "đã nộp", bản nháp.
// CA PHÁ CỐ Ý: ở mỗi nhóm có ca bắt đúng lỗi hay gặp (tin giờ trình duyệt, coi "điểm dở dang" là điểm thật, lộ đáp án khi chưa công bố, vượt số lượt).
import {
  clockOffsetMs, remainingSecFrom, isAnswered, unansweredList, unansweredLabel, submitConfirmMessage, attemptsGate, attemptCounterLabel,
  resultVisibility, submittedNotice, pickDraft, draftStatusLabel, receiptCode, type RoomQuestion, type RoomAnswerState,
} from "@/lib/quizRoom";
import { check, section, done } from "./h";

section("Giờ theo máy chủ, không theo trình duyệt");
const serverNow = "2026-10-24T12:00:00.000Z";
const expires = "2026-10-24T12:15:00.000Z"; // còn đúng 15 phút theo máy chủ
const skewedClient = Date.parse(serverNow) - 40 * 60_000; // đồng hồ máy học sinh chậm 40 phút
check("offset = máy chủ − trình duyệt", clockOffsetMs(serverNow, skewedClient) === 40 * 60_000);
check("đồng hồ máy học sinh LỆCH vẫn ra 900 giây (không tin giờ trình duyệt)", remainingSecFrom(expires, clockOffsetMs(serverNow, skewedClient), skewedClient) === 900);
check("PHÁ: nếu không bù offset thì sẽ ra 3300 giây (sai) — chứng minh offset có tác dụng", remainingSecFrom(expires, 0, skewedClient) === 3300);
check("đồng hồ nhanh 10 phút cũng vẫn 900", remainingSecFrom(expires, clockOffsetMs(serverNow, Date.parse(serverNow) + 600_000), Date.parse(serverNow) + 600_000) === 900);
check("quá hạn → 0, không âm", remainingSecFrom(expires, 0, Date.parse(expires) + 5000) === 0);
check("hạn rỗng/rác → 0 (coi như hết giờ, không kéo dài giờ)", remainingSecFrom(null, 0, 1) === 0 && remainingSecFrom("không phải ngày", 0, 1) === 0 && remainingSecFrom(undefined, 0, 1) === 0);
check("serverNow rác/thiếu → offset 0", clockOffsetMs(null, 5) === 0 && clockOffsetMs("rác", 5) === 0 && clockOffsetMs(serverNow, NaN) === 0);
check("offset NaN không làm hỏng phép tính", remainingSecFrom(expires, NaN, Date.parse(serverNow)) === 900);

section("Câu chưa làm");
const qs: RoomQuestion[] = [
  { id: "q1", type: "MC", options: [{ id: "a" }, { id: "b" }] },
  { id: "q2", type: "TRUE_FALSE_CLUSTER", options: [{ id: "c1" }, { id: "c2" }] },
  { id: "q3", type: "ESSAY", options: [] },
  { id: "q4", type: "SHORT_ANSWER", options: [] },
  { id: "q5", type: "MC", options: [{ id: "e" }] },
];
const none: RoomAnswerState = { selected: {}, text: {}, cluster: {} };
check("chưa làm gì → liệt kê đủ 5 câu theo thứ tự, số câu từ 1", unansweredList(qs, none).map(i => i.index).join() === "1,2,3,4,5");
const part: RoomAnswerState = { selected: { q1: "a" }, text: { q3: "   ", q4: "x = 2" }, cluster: { c1: true, c2: null } };
const left = unansweredList(qs, part);
check("tự luận toàn khoảng trắng = CHƯA làm; cụm Đúng–Sai thiếu một ý = chưa làm; MC/ngắn đã làm thì bỏ", left.map(i => i.index).join() === "2,3,5", left);
check("câu tự luận được đánh dấu essay", left.find(i => i.index === 3)?.essay === true && left.find(i => i.index === 2)?.essay === false);
check("cụm đủ ý (đúng và sai) = đã làm; false không bị coi là rỗng", isAnswered(qs[1], { ...none, cluster: { c1: false, c2: true } }));
check("cụm không có ý nào (rỗng) không bao giờ 'đã làm'", !isAnswered({ id: "z", type: "TRUE_FALSE_CLUSTER", options: [] }, none));
check("làm hết → danh sách rỗng", unansweredList(qs, { selected: { q1: "a", q5: "e" }, text: { q3: "bài", q4: "1" }, cluster: { c1: true, c2: false } }).length === 0);
check("nhãn: 'Câu 2, 3, 5'", unansweredLabel(left) === "Câu 2, 3, 5");
const many = Array.from({ length: 12 }, (_, i) => ({ index: i + 1, id: `q${i}`, essay: false }));
check("danh sách dài rút gọn 'và N câu nữa'", unansweredLabel(many) === "Câu 1, 2, 3, 4, 5, 6, 7, 8 và 4 câu nữa", unansweredLabel(many));
check("nhãn rỗng khi không còn câu", unansweredLabel([]) === "");
const msg = submitConfirmMessage(left, true);
check("hộp xác nhận: có số câu + liệt kê + nhắc tự luận chờ chấm + nộp rồi không sửa", msg.includes("3 câu chưa làm") && msg.includes("Câu 2, 3, 5") && msg.includes("chờ gia sư chấm") && msg.includes("không sửa lại được"), msg);
check("hộp xác nhận: tính cả câu ở Phần chưa mở vào tổng, nói rõ", submitConfirmMessage([{ index: 2, id: "q", essay: false }], false, 1).startsWith("Em còn 2 câu chưa làm: Câu 2 và 1 câu ở Phần chưa mở."), submitConfirmMessage([{ index: 2, id: "q", essay: false }], false, 1));
check("hộp xác nhận: chỉ còn câu ở Phần chưa mở (em đã làm hết câu đang thấy)", submitConfirmMessage([], false, 3).startsWith("Em còn 3 câu chưa làm: 3 câu ở Phần chưa mở."));
check("hộp xác nhận: hiddenUnopened âm/NaN bị bỏ qua", submitConfirmMessage([], false, -4).includes("trả lời hết") && submitConfirmMessage([], false, NaN).includes("trả lời hết"));
check("hộp xác nhận: làm hết và không có tự luận → không nhắc tự luận", !submitConfirmMessage([], false).includes("tự luận") && submitConfirmMessage([], false).includes("trả lời hết"));

section("Cổng số lượt (không làm lại vượt số lần cho phép)");
check("không giới hạn → luôn vào được", attemptsGate({ used: 99, max: null, hasInProgress: false }).canStart && attemptsGate({ used: 0, max: undefined, hasInProgress: false }).remaining === null);
check("max=1, chưa làm → vào được, còn 1", (() => { const g = attemptsGate({ used: 0, max: 1, hasInProgress: false }); return g.canStart && g.remaining === 1; })());
check("max=1, đã dùng 1 → KHÔNG vào được", (() => { const g = attemptsGate({ used: 1, max: 1, hasInProgress: false }); return !g.canStart && g.reason === "attempts_exhausted" && g.remaining === 0; })());
check("PHÁ: đã dùng vượt max (dữ liệu lệch) vẫn chặn", !attemptsGate({ used: 5, max: 2, hasInProgress: false }).canStart);
check("lượt đang làm dở luôn được tiếp tục, dù đã đủ số lượt", (() => { const g = attemptsGate({ used: 1, max: 1, hasInProgress: true }); return g.canStart && g.reason === "resume"; })());
check("max rác (0, âm, lẻ, NaN) = không giới hạn, không chặn nhầm", [0, -1, 1.5, NaN].every(m => attemptsGate({ used: 3, max: m, hasInProgress: false }).canStart));
check("used âm/NaN không làm hỏng", attemptsGate({ used: -4, max: 1, hasInProgress: false }).canStart && attemptsGate({ used: NaN, max: 1, hasInProgress: false }).canStart);
check("nhãn lượt: 'Lượt 1/1', 'Lượt 2/3', không giới hạn 'Lượt 3'", attemptCounterLabel(0, 1, false) === "Lượt 1/1" && attemptCounterLabel(1, 3, false) === "Lượt 2/3" && attemptCounterLabel(2, null, false) === "Lượt 3");
check("đang làm dở lượt 1 → 'Lượt 1/1' (không nhảy lên 2/1)", attemptCounterLabel(1, 1, true) === "Lượt 1/1");

section("Ai được thấy gì (không lộ điểm dở dang / đáp án trước khi công bố)");
const locked = resultVisibility({ hasEssay: true, published: false }, true);
check("có tự luận + chưa công bố → không điểm, không điểm tự luận, KHÔNG đáp án (dù đề cho phép xem)", !locked.showScore && !locked.showEssayPoints && !locked.showAnswers && locked.pendingManual, locked);
const pub = resultVisibility({ hasEssay: true, published: true }, true);
check("có tự luận + đã công bố + đề cho xem đáp án → thấy hết", pub.showScore && pub.showEssayPoints && pub.showAnswers && !pub.pendingManual);
check("PHÁ: công bố KHÔNG mở rộng cài đặt đề — đề 'never' vẫn không lộ đáp án dù đã công bố", !resultVisibility({ hasEssay: true, published: true }, false).showAnswers && resultVisibility({ hasEssay: true, published: true }, false).showScore);
const mc = resultVisibility({ hasEssay: false, published: true }, true);
check("chỉ trắc nghiệm → điểm hiện ngay, không chờ chấm", mc.showScore && !mc.pendingManual);
check("chỉ trắc nghiệm mà đề không cho xem đáp án → có điểm, không đáp án", (() => { const v = resultVisibility({ hasEssay: false, published: true }, false); return v.showScore && !v.showAnswers; })());

section("Chữ ở màn 'đã nộp' trung thực");
const n1 = submittedNotice({ hasEssay: true, published: false }, false);
check("chưa công bố: nói ghi nhận + chờ chấm; KHÔNG chữ 'đã chấm xong'", n1.body.includes("chờ gia sư chấm") && !/chấm xong|đã chấm/.test(n1.body), n1);
check("chưa công bố: không hứa điểm/đáp án ngay", n1.body.includes("chưa hiển thị"));
check("hết giờ: tiêu đề nói 'Hết giờ' nhưng vẫn 'ghi nhận'", submittedNotice({ hasEssay: false, published: true }, true).heading.includes("Hết giờ") && submittedNotice({ hasEssay: false, published: true }, true).heading.includes("ghi nhận"));
check("chỉ trắc nghiệm: được nói 'chấm xong'", submittedNotice({ hasEssay: false, published: true }, false).body.includes("chấm xong"));
check("không dùng từ 'đã xác minh'", !/xác minh/i.test(n1.body + submittedNotice({ hasEssay: false, published: true }, false).body));

section("Bản nháp");
check("máy chủ chuẩn khi bản máy này đã đồng bộ", pickDraft("A", { text: "B", synced: true }).text === "A" && !pickDraft("A", { text: "B", synced: true }).fromLocal);
check("mất mạng: bản máy này CHƯA đồng bộ và khác → dùng bản máy này, báo fromLocal", (() => { const d = pickDraft("A", { text: "A + gõ thêm", synced: false }); return d.text === "A + gõ thêm" && d.fromLocal; })());
check("bản máy này chưa đồng bộ nhưng rỗng/khoảng trắng → không đè bản máy chủ", pickDraft("A", { text: "   ", synced: false }).text === "A");
check("bản máy này trùng bản máy chủ → không đẩy lại", !pickDraft("A", { text: "A", synced: false }).fromLocal);
check("không có bản máy này / máy chủ rỗng", pickDraft(undefined, null).text === "" && pickDraft(null, undefined).text === "");
check("nhãn 'đã lưu' chỉ khi có mốc giờ từ máy chủ", draftStatusLabel({ kind: "saved", at: "19:08:12" }) === "Bản nháp đã lưu trên máy chủ · 19:08:12");
check("lưu lỗi: nói thật là chưa lưu, không nói 'đã lưu'", !/đã lưu/.test(draftStatusLabel({ kind: "failed" })) && draftStatusLabel({ kind: "failed" }).includes("Chưa lưu"));
check("đang lưu / rảnh có chữ riêng", draftStatusLabel({ kind: "saving" }).includes("Đang lưu") && draftStatusLabel({ kind: "idle" }).length > 0);

section("Mã lượt");
check("8 ký tự cuối, in hoa, tiền tố KN-", receiptCode("clx9abcd1234efgh") === "KN-1234EFGH", receiptCode("clx9abcd1234efgh"));
check("id rỗng → rỗng (không bịa mã)", receiptCode("") === "");

done();
