// QZ-08 / QZ-06 — quy tắc THUẦN (src/lib/quizGrade.ts). Không DB, không mạng. Có ca phá cố ý: đầu vào xấu, biên, và "nếu ai bỏ kiểm tra này thì bài đỏ".
import {
  essayNeedsGrading, gradeState, isHeld, examHoldsResults, parseExamCreatedAt, HOLD_DEFAULT_SINCE, validateEssayPoints, normalizeComment, publishEligibility, planPublishBatch, fmtPoints,
  buildQuizAnalytics, percentOf, COMMENT_MAX, type QzQuestion, type QzAttempt, type QzAnswer,
} from "@/lib/quizGrade";
import { check, section, done } from "./h";

section("Câu tự luận nào cần chấm");
check("có chữ, chưa chấm → cần chấm", essayNeedsGrading({ textAnswer: "bài làm", pointsAwarded: null }));
check("đã chấm 0 điểm → KHÔNG cần chấm nữa (0 ≠ chưa chấm)", !essayNeedsGrading({ textAnswer: "bài làm", pointsAwarded: 0 }));
check("bỏ trống / chỉ khoảng trắng → không có gì để chấm", !essayNeedsGrading({ textAnswer: "   \n", pointsAwarded: null }) && !essayNeedsGrading({ textAnswer: null, pointsAwarded: null }));
check("không có dòng trả lời → không cần chấm", !essayNeedsGrading(null) && !essayNeedsGrading(undefined));

section("Trạng thái Chờ chấm / Đã chấm / Đã công bố");
check("còn tự luận chưa chấm → Chờ chấm", gradeState({ pendingEssays: 2, published: false }) === "cho");
check("chấm hết, chưa công bố → Đã chấm", gradeState({ pendingEssays: 0, published: false }) === "da_cham");
check("đã công bố → Đã công bố", gradeState({ pendingEssays: 0, published: true }) === "cong_bo");
check("công bố thắng cả khi sau đó có câu chờ chấm lại", gradeState({ pendingEssays: 1, published: true }) === "cong_bo");

section("Giữ điểm với học sinh (isHeld)");
check("đề KHÔNG có chính sách (đề cũ) → không bao giờ giữ", !isHeld(null, false) && !isHeld(undefined, false));
check("chính sách tắt → không giữ", !isHeld({ holdUntilPublish: false }, false));
check("chính sách bật, chưa công bố → GIỮ", isHeld({ holdUntilPublish: true }, false));
check("chính sách bật, đã công bố → không giữ", !isHeld({ holdUntilPublish: true }, true));

section("Một nguồn sự thật: đề nào giữ điểm (examHoldsResults)");
const NEW = "2026-10-24", OLD = "2026-10-23", T = (hasEssay: boolean, createdAt: string) => ({ hasEssay, createdAt });
check("đề CÓ tự luận tạo mới, chưa có chính sách → mặc định GIỮ", examHoldsResults(null, T(true, NEW)) && examHoldsResults(undefined, T(true, "24/10/2026")) && examHoldsResults(null, T(true, "2026-11-02T08:00:00.000Z")));
check("đề KHÔNG tự luận (mới) → không giữ", !examHoldsResults(null, T(false, NEW)));
check("đề cũ có tự luận (tạo trước mốc, hoặc ngày tạo không đọc được) → hành vi cũ, không giữ", !examHoldsResults(null, T(true, OLD)) && !examHoldsResults(null, T(true, "23/10/2026")) && !examHoldsResults(null, T(true, "2020")) && !examHoldsResults(null, T(true, "")) && !examHoldsResults(null, T(true, "tuần trước")));
check("chính sách tắt thắng mặc định: gia sư tắt giữ điểm cho đề mới có tự luận → không giữ", !examHoldsResults({ holdUntilPublish: false }, T(true, NEW)));
check("chính sách bật thắng mặc định: đề cũ gia sư bật giữ → giữ", examHoldsResults({ holdUntilPublish: true }, T(false, OLD)));
check("PHÁ: ngày tạo rác không làm đề tự động bị giữ (không NaN lọt qua)", parseExamCreatedAt("31/02/9999x") === null || !Number.isNaN((parseExamCreatedAt("31/02/9999x") as Date).getTime()));
check("mốc áp dụng là 00:00 ngày 24/10/2026 giờ VN", HOLD_DEFAULT_SINCE.toISOString() === "2026-10-23T17:00:00.000Z" && parseExamCreatedAt("2026-10-24")!.getTime() === HOLD_DEFAULT_SINCE.getTime());

section("Điểm một câu tự luận: biên và đầu vào xấu");
const ok = (r: ReturnType<typeof validateEssayPoints>) => r.ok;
check("0 và đúng điểm tối đa đều hợp lệ", ok(validateEssayPoints(0, 2)) && ok(validateEssayPoints(2, 2)));
check("vượt tối đa 2,01 / âm → từ chối", !ok(validateEssayPoints(2.01, 2)) && !ok(validateEssayPoints(-0.01, 2)));
check("NaN / Infinity / null / undefined / object → từ chối", !ok(validateEssayPoints(NaN, 2)) && !ok(validateEssayPoints(Infinity, 2)) && !ok(validateEssayPoints(null, 2)) && !ok(validateEssayPoints(undefined, 2)) && !ok(validateEssayPoints({}, 2)));
check("chuỗi rỗng KHÔNG bị hiểu là 0 điểm", !ok(validateEssayPoints("", 2)) && !ok(validateEssayPoints("   ", 2)));
const c = validateEssayPoints("1,5", 2);
check("'1,5' (dấu phẩy Việt) = 1.5", c.ok && c.value === 1.5);
const r = validateEssayPoints(1.234, 2);
check("làm tròn 0,01", r.ok && r.value === 1.23);
check("thông báo lỗi nói rõ khoảng điểm", (() => { const e = validateEssayPoints(3, 2.5); return !e.ok && e.error === "Điểm phải từ 0 đến 2,5."; })());

section("Nhận xét");
check("không có → null", (() => { const n = normalizeComment(undefined); return n.ok && n.value === null; })());
check("cắt khoảng trắng, rỗng → null", (() => { const n = normalizeComment("  \n "); return n.ok && n.value === null; })());
check("dài đúng giới hạn nhận, dài hơn từ chối", normalizeComment("a".repeat(COMMENT_MAX)).ok && !normalizeComment("a".repeat(COMMENT_MAX + 1)).ok);
check("không phải chữ → từ chối", !normalizeComment(5).ok && !normalizeComment({}).ok);

section("Điều kiện công bố");
check("bài đang làm dở → không công bố", !publishEligibility({ attemptStatus: "in_progress", pendingEssays: 0 }).ok);
check("còn tự luận chưa chấm → không công bố, lý do nêu số câu", (() => { const e = publishEligibility({ attemptStatus: "submitted", pendingEssays: 2 }); return !e.ok && e.reason.includes("2"); })());
check("đã nộp, chấm hết → công bố được (kể cả hết giờ = expired)", publishEligibility({ attemptStatus: "submitted", pendingEssays: 0 }).ok && publishEligibility({ attemptStatus: "expired", pendingEssays: 0 }).ok);
const batch = planPublishBatch([
  { id: "a", attemptStatus: "submitted", pendingEssays: 0, published: false },
  { id: "b", attemptStatus: "submitted", pendingEssays: 1, published: false },
  { id: "c", attemptStatus: "submitted", pendingEssays: 0, published: true },
  { id: "d", attemptStatus: "in_progress", pendingEssays: 0, published: false },
]);
check("lô: chỉ 'a' được công bố; 'c' đã công bố từ trước; 'b','d' bị bỏ qua có lý do", JSON.stringify(batch.toPublish) === '["a"]' && JSON.stringify(batch.alreadyPublished) === '["c"]' && batch.skipped.map(s => s.id).join() === "b,d" && batch.skipped.every(s => s.reason.length > 0));
check("lô rỗng → không có gì", planPublishBatch([]).toPublish.length === 0);

section("Chữ điểm");
check("bỏ số 0 thừa, dấu phẩy Việt", fmtPoints(2) === "2" && fmtPoints(1.5) === "1,5" && fmtPoints(0.8) === "0,8" && fmtPoints(7.25) === "7,25" && fmtPoints(0) === "0");

section("Phân tích kết quả: tính tay rồi so");
// Đề: 2 trắc nghiệm (1 điểm), 1 điền ngắn (1 điểm, đáp án 3.5), 1 tự luận (2 điểm). Thang đề 10; điểm thô tối đa 5.
const Q: QzQuestion[] = [
  { id: "q1", type: "MC", points: 1, options: [{ id: "q1a", isCorrect: true, text: "đúng" }, { id: "q1b", isCorrect: false, text: "sai" }] },
  { id: "q2", type: "MC", points: 1, options: [{ id: "q2a", isCorrect: true, text: "đúng" }, { id: "q2b", isCorrect: false, text: "sai" }] },
  { id: "q3", type: "SHORT_ANSWER", points: 1, options: [{ id: "q3a", isCorrect: true, text: "3.5" }] },
  { id: "q4", type: "ESSAY", points: 2, options: [] },
];
const at = (id: string, userId: string, status: string, score: number | null): QzAttempt => ({ id, userId, status, score, totalPoints: 5, tabSwitchCount: 0, startedAt: new Date(0), submittedAt: status === "in_progress" ? null : new Date(1) });
const A: QzAttempt[] = [at("a1", "u1", "submitted", 8), at("a2", "u2", "submitted", 4), at("a3", "u3", "submitted", 6), at("a4", "u1", "submitted", 2), at("a5", "u4", "in_progress", null)];
const ans = (attemptId: string, questionId: string, o: Partial<QzAnswer> = {}): QzAnswer => ({ attemptId, questionId, optionId: null, textAnswer: null, pointsAwarded: null, ...o });
const R: QzAnswer[] = [
  ans("a1", "q1", { optionId: "q1a" }), ans("a1", "q2", { optionId: "q2a" }), ans("a1", "q3", { textAnswer: " 3,5 " }), ans("a1", "q4", { textAnswer: "bài", pointsAwarded: 2 }),
  ans("a2", "q1", { optionId: "q1a" }), ans("a2", "q2", { optionId: "q2b" }), ans("a2", "q3", { textAnswer: "4" }), ans("a2", "q4", { textAnswer: "bài", pointsAwarded: 0 }),
  ans("a3", "q1", { optionId: "q1b" }), ans("a3", "q3", { textAnswer: "3.5" }), ans("a3", "q4", { textAnswer: "bài", pointsAwarded: null }), // a3 còn tự luận chờ chấm
  ans("a4", "q1", { optionId: "q1a" }), ans("a4", "q4", { textAnswer: "  " }),                                                              // a4 bỏ trống tự luận, không có dòng q2/q3
  ans("a5", "q1", { optionId: "q1a" }),                                                                                                       // đang làm dở: không tính
];
const S = buildQuizAnalytics({ examTotal: 10, questions: Q, attempts: A, answers: R });
check("đếm lượt: 5 lượt, 4 đã nộp, 1 làm dở, 4 học sinh", S.attemptCount === 5 && S.submittedCount === 4 && S.inProgressCount === 1 && S.studentCount === 4, S);
check("a3 chờ chấm → không tính vào điểm: tính 3 lượt, chờ 1", S.scoredCount === 3 && S.waitingCount === 1, S);
check("trung bình (80% + 40% + 20%)/3 = 46,67; cao nhất 80; thấp nhất 20", S.avgPercent === 46.67 && S.maxPercent === 80 && S.minPercent === 20, S);
check("phân bố 5 khoảng: 20→[20-40), 40→[40-60), 80→[80-100]", JSON.stringify(S.distribution.map(b => b.count)) === "[0,1,1,0,1]", S.distribution);
check("tổng phân bố = số lượt tính điểm", S.distribution.reduce((s, b) => s + b.count, 0) === S.scoredCount);
const q = (id: string) => S.questions.find(x => x.questionId === id)!;
check("q1 trắc nghiệm: 4 lượt đã nộp, đúng a1,a2,a4 = 3, bỏ trống 0 (lượt làm dở KHÔNG tính)", q("q1").counted === 4 && q("q1").correct === 3 && q("q1").blank === 0, q("q1"));
check("q2: đúng 1 (a1), bỏ trống 2 (a3, a4 không có dòng)", q("q2").correct === 1 && q("q2").blank === 2, q("q2"));
check("q3 điền ngắn: ' 3,5 ' và '3.5' đúng, '4' sai, bỏ trống 1", q("q3").correct === 2 && q("q3").blank === 1, q("q3"));
check("q4 tự luận: 2 bài đã chấm (2 và 0 /2) → trung bình 50%; 1 chờ chấm; 1 bỏ trống", q("q4").counted === 2 && q("q4").essayAvgRatio === 0.5 && q("q4").pendingEssays === 1 && q("q4").blank === 1 && q("q4").correct === null, q("q4"));
check("không lộ tên hay mã học sinh trong kết quả", !JSON.stringify(S).includes('"name"') && !JSON.stringify(S).includes("userId") && !JSON.stringify(S).includes('"u1"'));
check("percentOf: null khi chưa có điểm hoặc thang 0", percentOf({ score: null, totalPoints: 5 }, 10) === null && percentOf({ score: 5, totalPoints: 5 }, 0) === null && percentOf({ score: 5, totalPoints: 5 }, 10) === 50);
const E = buildQuizAnalytics({ examTotal: 10, questions: Q, attempts: [], answers: [] });
check("chưa có lượt nào → mọi số 0 / null, không chia cho 0", E.submittedCount === 0 && E.avgPercent === null && E.maxPercent === null && E.distribution.every(b => b.count === 0) && E.questions.every(x => x.correct === null || x.correct === 0));

done();
