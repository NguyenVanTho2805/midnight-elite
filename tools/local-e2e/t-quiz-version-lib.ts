// QZ-07 — luật phiên bản quiz (src/lib/quizVersion.ts). Thuần, không DB. Ca phá cố ý ở từng mục.
import { check, section, done } from "./h";
import {
  answerKeySignature, canEditInPlace, cloneQuestionForVersion, currentPublished, diffQuestionSets, diffSummary, nextVersionNo, pendingDraft,
  questionSignature, rootIdOf, type SnapQuestion,
} from "@/lib/quizVersion";

const q = (text: string, correct = 0, points = 1): SnapQuestion => ({
  type: "MC", text, points, options: ["A", "B", "C", "D"].map((t, i) => ({ text: t, isCorrect: i === correct })),
});
const ex = (id: string, v: number, o: { root?: string | null; sup?: string | null; draft?: boolean } = {}) => ({ id, rootExamId: o.root ?? null, versionNo: v, supersededById: o.sup ?? null, isDraft: !!o.draft });

(async () => {
section("Có được sửa trực tiếp không");
check("chưa ai làm → sửa trực tiếp được", canEditInPlace(0));
check("có 1 lượt (kể cả đang làm dở) → KHÔNG sửa đè", !canEditInPlace(1) && !canEditInPlace(250));
check("PHÁ: số âm coi như chưa ai làm nhưng NaN thì không", canEditInPlace(-1) === true && canEditInPlace(NaN) === false && canEditInPlace(Infinity) === false);

section("Chuỗi phiên bản");
check("đề cũ chưa có phiên bản: gốc là chính nó", rootIdOf({ id: "e1", rootExamId: null }) === "e1");
check("phiên bản sau trỏ về gốc", rootIdOf({ id: "e2", rootExamId: "e1" }) === "e1");
check("số phiên bản kế = lớn nhất + 1 (không đếm dòng)", nextVersionNo([{ versionNo: 1 }, { versionNo: 3 }]) === 4 && nextVersionNo([]) === 1);
check("PHÁ: versionNo hỏng (NaN) coi là 1", nextVersionNo([{ versionNo: NaN }]) === 2);
const chain = [ex("e1", 1, { sup: "e2" }), ex("e2", 2), ex("e3", 3, { root: "e1", draft: true })];
check("bản đang dùng = bản đã phát hành chưa bị thay, KHÔNG phải bản nháp", currentPublished(chain)?.id === "e2");
check("bản nháp đang chờ tìm đúng", pendingDraft(chain)?.id === "e3");
check("PHÁ: chuỗi toàn bản bị thay hoặc nháp → không có bản đang dùng", currentPublished([ex("a", 1, { sup: "b" }), ex("b", 2, { draft: true })]) === null);
check("không có nháp → pendingDraft null", pendingDraft([ex("a", 1)]) === null);

section("So sánh phiên bản");
const v1 = [q("Câu 1", 1), q("Câu 2", 2), q("Câu 3", 0)];
check("giống hệt → identical, không dòng nào đổi", (() => { const d = diffQuestionSets(v1, v1.map(cloneQuestionForVersion)); return d.identical && d.same === 3 && d.keyChanges === 0; })());
check("sửa chữ đề (đáp án giữ) → changed nhưng KHÔNG tính là đổi đáp án", (() => { const to = [{ ...v1[0], text: "Câu 1 (rõ hơn)" }, v1[1], v1[2]]; const d = diffQuestionSets(v1, to); return d.changed === 1 && d.keyChanges === 0 && d.rows[0].keyChanged === false; })());
check("đổi đáp án đúng → keyChanges = 1", (() => { const to = [q("Câu 1", 3), v1[1], v1[2]]; const d = diffQuestionSets(v1, to); return d.keyChanges === 1 && d.rows[0].keyChanged; })());
check("đổi điểm → tính là đổi đáp án/điểm", (() => { const d = diffQuestionSets(v1, [{ ...v1[0], points: 2 }, v1[1], v1[2]]); return d.keyChanges === 1 && d.totalPointsFrom === 3 && d.totalPointsTo === 4; })());
check("thêm / bỏ câu đếm đúng", (() => { const a = diffQuestionSets(v1, [...v1, q("Câu 4")]); const r = diffQuestionSets(v1, v1.slice(0, 2)); return a.added === 1 && r.removed === 1 && !a.identical && !r.identical; })());
check("PHÁ: đổi thứ tự lựa chọn là thay đổi (không bị coi là giống)", (() => { const swapped = { ...v1[0], options: [...v1[0].options].reverse() }; return questionSignature(swapped) !== questionSignature(v1[0]); })());
check("PHÁ: khoảng trắng thừa đầu/cuối không tạo thay đổi giả", questionSignature({ ...v1[0], text: "  Câu 1  " }) === questionSignature(v1[0]));
check("PHÁ: đổi hướng dẫn chấm (chỉ gia sư thấy) vẫn là một thay đổi", questionSignature({ ...v1[0], graderGuide: "mới" }) !== questionSignature(v1[0]));
check("chữ ký đáp án bỏ qua chữ giải thích nhưng bắt đổi đáp án", answerKeySignature({ ...v1[0], explanation: "x" }) === answerKeySignature(v1[0]) && answerKeySignature(q("Câu 1", 2)) !== answerKeySignature(q("Câu 1", 1)));
check("hai danh sách rỗng → giống hệt", diffQuestionSets([], []).identical);
check("tóm tắt nói rõ số câu đổi đáp án", /1 câu đổi đáp án/.test(diffSummary(diffQuestionSets(v1, [q("Câu 1", 3), v1[1], v1[2]]))) && /Chưa có thay đổi/.test(diffSummary(diffQuestionSets(v1, v1))));
check("tổng điểm làm tròn 2 chữ số (0,1+0,2)", diffQuestionSets([{ ...v1[0], points: 0.1 }, { ...v1[0], points: 0.2 }], []).totalPointsFrom === 0.3);

section("Sao chép câu sang phiên bản mới");
check("bản sao không dùng chung mảng lựa chọn với bản gốc (sửa bên này không đụng bên kia)", (() => {
  const src = { ...q("Câu 1"), rubric: [{ name: "A", points: 1 }] }; const c = cloneQuestionForVersion(src);
  c.options[0].text = "ĐÃ SỬA"; return src.options[0].text === "A" && c.options !== src.options;
})());
check("bản sao giữ đủ nội dung và đáp án đúng", (() => { const src = { ...q("Câu 1", 2, 3), explanation: "gt", studentGuide: "hd", graderGuide: "cham" }; const c = cloneQuestionForVersion(src); return questionSignature(c) === questionSignature(src); })());

await done();
})();
