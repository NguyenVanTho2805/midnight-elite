// BU-04 — chấm từng câu luyện tập (src/lib/examPracticeLib.ts). Có CA PHÁ: trạng thái `hint` không bao giờ chứa đáp án / lời giải / id đáp án đúng.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-exam-practice-lib.ts
import { practicePolicy, clusterRightCount, buildPracticeResponse, type PracticeInput, type PracticePolicy } from "@/lib/examPracticeLib";
import { afterSubmit, EMPTY_CORRECTION, afterReveal } from "@/lib/examCorrection";
import { check, section, done } from "./h";

const SECRET_OPT = "OPT-DUNG-BI-MAT-7731";
const SECRET_EXPL = "LỜI-GIẢI-BÍ-MẬT-9921";
const SECRET_TEXT = "ĐÁP-ÁN-ĐIỀN-NGẮN-5518";
const HINT = "GỢI-Ý-MỒI-4417";
const openPolicy: PracticePolicy = practicePolicy({ mode: "practice", answerVisibility: "after_submit", hideAnswerForWrong: false }, false);

const base = (over: Partial<PracticeInput> = {}): PracticeInput => ({
  questionId: "q1", type: "MC", correct: false, row: afterSubmit(EMPTY_CORRECTION, false, true), hint: HINT,
  correctOptionIds: [SECRET_OPT], correctText: SECRET_TEXT, clusterTruths: [{ optionId: SECRET_OPT, isTrue: true }], explanation: SECRET_EXPL, ...over,
});
const dump = (o: unknown) => JSON.stringify(o);

section("practicePolicy");
check("practice + không giữ điểm → instant", practicePolicy({ mode: "practice", answerVisibility: "after_submit", hideAnswerForWrong: false }, false).feedback === "instant");
check("test / đề cũ (mode null) → none", practicePolicy({ mode: "test", answerVisibility: "after_submit", hideAnswerForWrong: false }, false).feedback === "none" && practicePolicy({ mode: null, answerVisibility: "after_submit", hideAnswerForWrong: false }, false).feedback === "none");
check("đề giữ điểm tới khi công bố → none dù là practice", practicePolicy({ mode: "practice", answerVisibility: "after_submit", hideAnswerForWrong: false }, true).feedback === "none");
check("answerVisibility never → không được lộ; hideAnswerForWrong → hideWrong", !practicePolicy({ mode: "practice", answerVisibility: "never", hideAnswerForWrong: false }, false).revealAllowed && practicePolicy({ mode: "practice", answerVisibility: "after_submit", hideAnswerForWrong: true }, false).hideWrong);
// BU-04 rà soát: "chỉ sau khi hết thời hạn" không được mở sớm hơn màn Xem lại; giá trị lạ coi như CHƯA mở (cùng STU-001: rác = never)
const apx = (v: string, ended?: boolean) => practicePolicy({ mode: "practice", answerVisibility: v, hideAnswerForWrong: false }, false, ended);
check("after_exam_ends: chưa hết khung → KHÔNG lộ đáp án/lời giải; hết khung → được", !apx("after_exam_ends", false).revealAllowed && !apx("after_exam_ends", false).explainAllowed && apx("after_exam_ends", true).revealAllowed && apx("after_exam_ends", true).explainAllowed);
check("after_exam_ends mà không truyền windowEnded → mặc định an toàn (chưa mở)", !apx("after_exam_ends").revealAllowed);
check("PHÁ: giá trị rác ('xyz', '') không lộ đáp án dù windowEnded=true; after_submit không phụ thuộc khung", !apx("xyz", true).revealAllowed && !apx("", true).revealAllowed && apx("after_submit", false).revealAllowed);

section("clusterRightCount");
const truths = [{ optionId: "a", isTrue: true }, { optionId: "b", isTrue: false }, { optionId: "c", isTrue: true }, { optionId: "d", isTrue: false }];
check("4/4, 2/4, 0/4", clusterRightCount(truths, { a: true, b: false, c: true, d: false }) === 4 && clusterRightCount(truths, { a: true, b: true, c: false, d: false }) === 2 && clusterRightCount(truths, { a: false, b: true, c: false, d: true }) === 0);
check("ý bỏ trống / null không tính", clusterRightCount(truths, { a: true, b: null }) === 1 && clusterRightCount(truths, {}) === 0);

section("buildPracticeResponse — sai lần 1, có gợi ý (CA PHÁ: không rò gì)");
const h1 = buildPracticeResponse(base(), openPolicy);
check("state=hint, có gợi ý, canReveal", h1.state === "hint" && h1.hint === HINT && h1.canReveal && h1.tries === 1 && h1.correct === false);
check("hint: answer & explanation = null, không revealBlockedReason", h1.answer === null && h1.explanation === null && h1.revealBlockedReason === null);
const j1 = dump(h1);
check("CA PHÁ: JSON ở state hint không chứa id đáp án đúng / lời giải / đáp án điền ngắn", !j1.includes(SECRET_OPT) && !j1.includes(SECRET_EXPL) && !j1.includes(SECRET_TEXT), j1);
check("CA PHÁ: Object.keys/values cũng không", !Object.values(h1).some(v => typeof v === "string" && (v.includes(SECRET_OPT) || v.includes(SECRET_EXPL) || v.includes(SECRET_TEXT))));
check("CA PHÁ: chính sách cho phép hết vẫn không lộ khi state hint", buildPracticeResponse(base(), { feedback: "instant", revealAllowed: true, explainAllowed: true, hideWrong: false }).answer === null);
check("CA PHÁ: câu có thêm trường lạ trong dữ liệu vào không lọt ra (danh sách trắng)", !dump(buildPracticeResponse({ ...base(), graderGuide: "RUBRIC-MẬT" } as PracticeInput, openPolicy)).includes("RUBRIC-MẬT"));

section("buildPracticeResponse — Đúng–Sai");
const tf = buildPracticeResponse(base({ type: "TRUE_FALSE_CLUSTER", rightCount: 2, correctOptionIds: ["a", "c"], clusterTruths: truths }), openPolicy);
check("lần 1: chỉ rightCount=2, không nói ý nào (không clusterTruths)", tf.rightCount === 2 && tf.answer === null && !dump(tf).includes('"isTrue"'));
const tfDone = buildPracticeResponse(base({ type: "TRUE_FALSE_CLUSTER", rightCount: 4, correct: true, row: afterSubmit(EMPTY_CORRECTION, true, true), clusterTruths: truths }), openPolicy);
check("đúng cả 4 → solved, lộ clusterTruths", tfDone.state === "solved" && tfDone.answer?.clusterTruths.length === 4);
check("câu MC không có rightCount", buildPracticeResponse(base({ rightCount: 3 }), openPolicy).rightCount === undefined);

section("buildPracticeResponse — hết lượt / xem đáp án / đúng");
const second = afterSubmit(afterSubmit(EMPTY_CORRECTION, false, true), false, true);
const r2 = buildPracticeResponse(base({ row: second }), openPolicy);
check("sai lần 2 → revealed + đáp án + lời giải", r2.state === "revealed" && r2.answer?.correctOptionIds[0] === SECRET_OPT && r2.explanation === SECRET_EXPL && r2.hint === null && !r2.canReveal);
const rv = buildPracticeResponse(base({ row: afterReveal(afterSubmit(EMPTY_CORRECTION, false, true)) }), openPolicy);
check("bấm Xem đáp án sau 1 lần → revealed", rv.state === "revealed" && rv.answer !== null);
const ok = buildPracticeResponse(base({ correct: true, row: afterSubmit(EMPTY_CORRECTION, true, true) }), openPolicy);
check("đúng lần 1 → solved, có lời giải, không gợi ý", ok.state === "solved" && ok.correct && ok.hint === null && ok.explanation === SECRET_EXPL);
const noHint = buildPracticeResponse(base({ hint: null, row: afterSubmit(EMPTY_CORRECTION, false, false) }), openPolicy);
check("câu không gợi ý: sai lần 1 mở đáp án luôn", noHint.state === "revealed" && noHint.answer !== null);
check("điền ngắn: correctText ra khi xong", buildPracticeResponse(base({ type: "SHORT_ANSWER", row: second }), openPolicy).answer?.correctText === SECRET_TEXT);

section("buildPracticeResponse — chính sách chặn");
const never = practicePolicy({ mode: "practice", answerVisibility: "never", hideAnswerForWrong: false }, false);
const rn = buildPracticeResponse(base({ row: second }), never);
check("never: xong nhưng answer=null, explanation=null, lý do 'never'", rn.state === "revealed" && rn.answer === null && rn.explanation === null && rn.revealBlockedReason === "never");
check("never: JSON không chứa đáp án", !dump(rn).includes(SECRET_OPT) && !dump(rn).includes(SECRET_EXPL));
const hw = practicePolicy({ mode: "practice", answerVisibility: "after_submit", hideAnswerForWrong: true }, false);
const rw = buildPracticeResponse(base({ row: second }), hw);
check("hideAnswerForWrong: sai hết lượt → answer=null, 'hide_wrong'", rw.answer === null && rw.explanation === null && rw.revealBlockedReason === "hide_wrong" && !dump(rw).includes(SECRET_OPT));
const rwOk = buildPracticeResponse(base({ correct: true, row: afterSubmit(EMPTY_CORRECTION, true, true) }), hw);
check("hideAnswerForWrong: đúng thì có đáp án + lời giải, không bị chặn", rwOk.answer !== null && rwOk.explanation === SECRET_EXPL && rwOk.revealBlockedReason === null);
check("lời giải rỗng / khoảng trắng → null", buildPracticeResponse(base({ row: second, explanation: "   " }), openPolicy).explanation === null);
check("state hint không có revealBlockedReason ngay cả khi chính sách never", buildPracticeResponse(base(), never).revealBlockedReason === null);
check("không sửa input (immutable)", (() => { const i = base(); const copy = JSON.stringify(i); buildPracticeResponse(i, openPolicy); return JSON.stringify(i) === copy; })());
done();
