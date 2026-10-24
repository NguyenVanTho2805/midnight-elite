// QZ-03 — luật soạn câu hỏi của gia sư (src/lib/quizQuestion.ts). Thuần, không DB, không máy chủ. Mỗi mục có ca phá cố ý (đầu vào xấu / sát biên).
import { check, section, done } from "./h";
import {
  coerceQuestionInput, validateForDraft, duplicateGroups, dupKey, describeValidity, multiRuleText, normalizeRubric, rubricTotal, scoreMultiSelect, validateQuizQuestion, round2, LIMITS,
  type QuizQuestionInput,
} from "@/lib/quizQuestion";

const multi = (over: Partial<QuizQuestionInput> = {}): QuizQuestionInput => ({
  type: "MC_MULTI", text: "Chọn tất cả các giá trị của x thỏa mãn x² = 4.", points: 2,
  options: [{ text: "x = −2", isCorrect: true }, { text: "x = 2", isCorrect: true }, { text: "x = 4", isCorrect: false }, { text: "x = 0", isCorrect: false }], ...over,
});
const essay = (over: Partial<QuizQuestionInput> = {}): QuizQuestionInput => ({
  type: "ESSAY", text: "Giải x² − 5x + 6 = 0 bằng cách phân tích thành nhân tử.", points: 10, options: [],
  rubric: [{ name: "Phương pháp", requirement: "Phân tích đúng", points: 4 }, { name: "Tính toán", requirement: "Tìm x", points: 4 }, { name: "Trình bày", requirement: "Rõ bước", points: 2 }], ...over,
});

(async () => {
section("Chấm nhiều đáp án: đủ-hoặc-không");
const C = ["a", "b"];
check("chọn đúng và đủ → trọn điểm", scoreMultiSelect(C, ["a", "b"], 2) === 2);
check("thứ tự chọn không quan trọng", scoreMultiSelect(C, ["b", "a"], 2) === 2);
check("thiếu một đáp án đúng → 0 (không chấm từng phần)", scoreMultiSelect(C, ["a"], 2) === 0);
check("chọn thêm một ô sai → 0 (không trừ điểm âm)", scoreMultiSelect(C, ["a", "b", "c"], 2) === 0);
check("chọn đủ số lượng nhưng lẫn ô sai → 0", scoreMultiSelect(C, ["a", "c"], 2) === 0);
check("không chọn gì → 0", scoreMultiSelect(C, [], 2) === 0);
check("PHÁ: tích trùng một id hai lần không đánh lừa được số lượng", scoreMultiSelect(C, ["a", "a"], 2) === 0 && scoreMultiSelect(["a"], ["a", "a"], 3) === 3);
check("PHÁ: id lạ thay cho đáp án đúng → 0", scoreMultiSelect(C, ["a", "zzz"], 2) === 0);
check("PHÁ: câu hỏng không có đáp án đúng thì 'không chọn gì' KHÔNG được điểm", scoreMultiSelect([], [], 5) === 0);
check("PHÁ: điểm 0 / âm / NaN → 0, không âm điểm", scoreMultiSelect(C, ["a", "b"], 0) === 0 && scoreMultiSelect(C, ["a", "b"], -3) === 0 && scoreMultiSelect(C, ["a", "b"], NaN) === 0);
check("điểm lẻ giữ nguyên", scoreMultiSelect(C, ["a", "b"], 1.5) === 1.5);

section("Câu nhiều đáp án: kiểm tra");
check("hợp lệ: 2 đúng / 4 lựa chọn", validateQuizQuestion(multi()) === null);
check("chỉ 1 đáp án đúng vẫn hợp lệ (gia sư có thể muốn đánh lạc hướng)", validateQuizQuestion(multi({ options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] })) === null);
check("không có đáp án đúng → lỗi nói rõ", /ít nhất 1 đáp án đúng/.test(validateQuizQuestion(multi({ options: multi().options.map(o => ({ ...o, isCorrect: false })) })) ?? ""));
check("đúng cả mọi ô → lỗi", /cả mọi lựa chọn/.test(validateQuizQuestion(multi({ options: multi().options.map(o => ({ ...o, isCorrect: true })) })) ?? ""));
check("dưới 2 lựa chọn → lỗi", /ít nhất 2/.test(validateQuizQuestion(multi({ options: [{ text: "A", isCorrect: true }] })) ?? ""));
check("PHÁ: lựa chọn trống (chỉ khoảng trắng) → lỗi", /còn trống/.test(validateQuizQuestion(multi({ options: [{ text: "A", isCorrect: true }, { text: "   ", isCorrect: false }] })) ?? ""));
check("PHÁ: nhiều hơn mức tối đa lựa chọn → lỗi", validateQuizQuestion(multi({ options: Array.from({ length: LIMITS.maxOptions + 1 }, (_, i) => ({ text: `o${i}`, isCorrect: i === 0 })) })) !== null);
check("PHÁ: nội dung rỗng / chỉ khoảng trắng → lỗi", validateQuizQuestion(multi({ text: "   " })) !== null && validateQuizQuestion(multi({ text: "" })) !== null);
check("PHÁ: điểm 0, âm, NaN, vô cực, quá lớn → lỗi", [0, -1, NaN, Infinity, LIMITS.points + 1].every(p => validateQuizQuestion(multi({ points: p })) !== null));
check("PHÁ: loại câu lạ → lỗi", validateQuizQuestion({ ...multi(), type: "HACK" as never }) !== null);
check("PHÁ: nội dung dài vô lý → lỗi", validateQuizQuestion(multi({ text: "x".repeat(LIMITS.text + 1) })) !== null);
check("dòng hợp lệ đúng như Figma: '2 đáp án đúng, tổng 2 điểm'", describeValidity(multi()).message === "Hợp lệ · 2 đáp án đúng, tổng 2 điểm", describeValidity(multi()));
check("câu sai thì dòng trạng thái là lỗi, không phải 'Hợp lệ'", !describeValidity(multi({ text: "" })).ok && !/^Hợp lệ/.test(describeValidity(multi({ text: "" })).message));
check("chữ quy tắc điểm nêu đủ: không chấm từng phần, không trừ điểm âm", /không trừ điểm âm/i.test(multiRuleText(2)) && /2 điểm/.test(multiRuleText(2)) && /không chấm từng phần/i.test(multiRuleText(2)));

section("Câu tự luận và tiêu chí chấm");
check("hợp lệ: tiêu chí 4+4+2 = 10", validateQuizQuestion(essay()) === null);
check("tự luận không có tiêu chí vẫn hợp lệ", validateQuizQuestion(essay({ rubric: [] })) === null && validateQuizQuestion(essay({ rubric: null })) === null);
check("tổng tiêu chí khác điểm câu → lỗi nêu cả hai số", /\(9\).*\(10\)/.test(validateQuizQuestion(essay({ rubric: [{ name: "A", requirement: "", points: 9 }] })) ?? ""));
check("sai số số thực không làm lỗi: 0,1+0,2 = 0,3", validateQuizQuestion(essay({ points: 0.3, rubric: [{ name: "A", requirement: "", points: 0.1 }, { name: "B", requirement: "", points: 0.2 }] })) === null);
check("PHÁ: tiêu chí không tên → lỗi; điểm 0/âm/chữ → lỗi", validateQuizQuestion(essay({ rubric: [{ name: " ", requirement: "", points: 10 }] })) !== null
  && validateQuizQuestion(essay({ rubric: [{ name: "A", requirement: "", points: 0 }] })) !== null
  && validateQuizQuestion(essay({ rubric: [{ name: "A", requirement: "", points: -4 }] })) !== null
  && !normalizeRubric([{ name: "A", points: "abc" }]).ok);
check("PHÁ: nhiều hơn số dòng tối đa → lỗi", !normalizeRubric(Array.from({ length: LIMITS.rubricRows + 1 }, () => ({ name: "A", requirement: "", points: 1 }))).ok);
check("PHÁ: rubric không phải mảng / phần tử rác → lỗi, không ném", !normalizeRubric("x").ok && !normalizeRubric({}).ok && !normalizeRubric([null]).ok && !normalizeRubric([5]).ok);
check("rubric null/undefined → rỗng", JSON.stringify(normalizeRubric(null)) === JSON.stringify({ ok: true, rows: [] }) && JSON.stringify(normalizeRubric(undefined)) === JSON.stringify({ ok: true, rows: [] }));
check("điểm tiêu chí ghi 'x,5' (dấu phẩy) đọc được", (() => { const r = normalizeRubric([{ name: "A", requirement: "", points: "2,5" }]); return r.ok && r.rows[0].points === 2.5; })());
check("tên/yêu cầu được cắt khoảng trắng", (() => { const r = normalizeRubric([{ name: "  Ý  ", requirement: " r ", points: 1 }]); return r.ok && r.rows[0].name === "Ý" && r.rows[0].requirement === "r"; })());
check("PHÁ: tự luận mà có lựa chọn → lỗi", validateQuizQuestion(essay({ options: [{ text: "A", isCorrect: true }] })) !== null);
check("rubricTotal / round2", rubricTotal([{ name: "a", requirement: "", points: 0.1 }, { name: "b", requirement: "", points: 0.2 }]) === 0.3 && round2(2.346) === 2.35);
check("hướng dẫn chấm quá dài → lỗi", validateQuizQuestion(essay({ graderGuide: "x".repeat(LIMITS.note + 1) })) !== null);

section("Các dạng cũ giữ đúng luật cũ");
check("MC: đúng 1 đáp án đúng", validateQuizQuestion({ type: "MC", text: "q", points: 1, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] }) === null);
check("MC: hai đáp án đúng → lỗi (khác MC_MULTI)", validateQuizQuestion({ type: "MC", text: "q", points: 1, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }] }) !== null);
check("MC: không có đáp án đúng → lỗi", validateQuizQuestion({ type: "MC", text: "q", points: 1, options: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: false }] }) !== null);
check("Đúng-Sai: đủ 4 nhãn a-d", validateQuizQuestion({ type: "TRUE_FALSE_CLUSTER", text: "q", points: 1, options: ["a", "b", "c", "d"].map((l, i) => ({ text: `ý ${l}`, isCorrect: i % 2 === 0, subLabel: l })) }) === null);
check("Đúng-Sai: thiếu nhãn → lỗi", validateQuizQuestion({ type: "TRUE_FALSE_CLUSTER", text: "q", points: 1, options: ["a", "a", "c", "d"].map(l => ({ text: "ý", isCorrect: true, subLabel: l })) }) !== null);
check("Trả lời ngắn: đúng 1 đáp án, không trống", validateQuizQuestion({ type: "SHORT_ANSWER", text: "q", points: 1, options: [{ text: "12", isCorrect: true }] }) === null
  && validateQuizQuestion({ type: "SHORT_ANSWER", text: "q", points: 1, options: [{ text: " ", isCorrect: true }] }) !== null);

section("Đọc dữ liệu không tin cậy từ API");
check("câu nhiều đáp án đọc đúng, trường lạ bị bỏ", (() => { const r = coerceQuestionInput({ type: "MC_MULTI", text: " Đề ", points: "2,5", options: [{ text: "a", isCorrect: true, evil: 1 }, { text: "b" }], isAdmin: true }); return !("error" in r) && r.text === "Đề" && r.points === 2.5 && r.options[1].isCorrect === false && !("isAdmin" in r) && !("evil" in r.options[0]); })());
check("PHÁ: isCorrect dạng chuỗi 'true' KHÔNG được tính là đúng", (() => { const r = coerceQuestionInput({ type: "MC_MULTI", text: "q", points: 1, options: [{ text: "a", isCorrect: "true" }] }); return !("error" in r) && r.options[0].isCorrect === false; })());
check("PHÁ: loại lạ / null / chuỗi / mảng → lỗi, không ném", ["x", null, 5, [], { type: "HACK" }].every(v => "error" in coerceQuestionInput(v)));
check("PHÁ: options không phải mảng → rỗng; phần tử rác → lỗi", (() => { const a = coerceQuestionInput({ type: "MC", text: "q", points: 1, options: "x" }); const b = coerceQuestionInput({ type: "MC", text: "q", points: 1, options: [null] }); return !("error" in a) && a.options.length === 0 && "error" in b; })());
check("tự luận: bỏ lựa chọn; hướng dẫn chỉ giữ ở tự luận", (() => {
  const e = coerceQuestionInput({ type: "ESSAY", text: "q", points: 10, options: [{ text: "a", isCorrect: true }], studentGuide: "hd", graderGuide: "cham" });
  const m = coerceQuestionInput({ type: "MC_MULTI", text: "q", points: 1, studentGuide: "hd", graderGuide: "cham", options: [] });
  return !("error" in e) && e.options.length === 0 && e.graderGuide === "cham" && !("error" in m) && m.graderGuide === null && m.studentGuide === null; })());
check("rubric hỏng làm cả câu báo lỗi (không im lặng bỏ tiêu chí)", "error" in coerceQuestionInput({ type: "ESSAY", text: "q", points: 1, rubric: [{ name: "", points: 1 }] }));
check("điểm chữ / thiếu → NaN → bị bắt khi kiểm", (() => { const r = coerceQuestionInput({ type: "MC", text: "q", points: "abc", options: [] }); return !("error" in r) && Number.isNaN(r.points) && validateForDraft(r) !== null; })());
check("bản nháp: câu thiếu đáp án VẪN lưu được, nhưng phát hành thì bị chặn", (() => {
  const r = coerceQuestionInput({ type: "MC", text: "Câu 8", points: 1, options: [{ text: "A", isCorrect: false }, { text: "B", isCorrect: false }] });
  return !("error" in r) && validateForDraft(r) === null && validateQuizQuestion(r) !== null; })());
check("bản nháp: vẫn chặn chữ đề rỗng, điểm xấu, quá nhiều lựa chọn", (() => {
  const base = { type: "MC" as const, text: "q", points: 1, options: [] };
  return validateForDraft({ ...base, text: "" }) !== null && validateForDraft({ ...base, points: 0 }) !== null
    && validateForDraft({ ...base, options: Array.from({ length: 11 }, () => ({ text: "x", isCorrect: false })) }) !== null; })());
check("PHÁ: ảnh chỉ nhận https — javascript:, data:, http thường, có khoảng trắng đều bị bỏ", ["javascript:alert(1)", "data:image/png;base64,AAAA", "http://x.com/a.png", "https://x.com/a b.png", "//x.com/a.png"].every(u => { const r = coerceQuestionInput({ type: "MC", text: "q", points: 1, imageUrl: u, options: [] }); return !("error" in r) && r.imageUrl === null; })
  && (() => { const r = coerceQuestionInput({ type: "MC", text: "q", points: 1, imageUrl: "https://res.cloudinary.com/kin/a.png", options: [] }); return !("error" in r) && r.imageUrl === "https://res.cloudinary.com/kin/a.png"; })());

section("Trùng trong cùng một tệp");
check("hai câu giống chữ (khác hoa thường / khoảng trắng / dấu chấm cuối) → một nhóm", JSON.stringify(duplicateGroups(["Giải x² − 5x + 6 = 0.", "q khác", "giải  X² − 5X + 6 = 0"])) === JSON.stringify([[0, 2]]), duplicateGroups(["Giải x² − 5x + 6 = 0.", "q khác", "giải  X² − 5X + 6 = 0"]));
check("khác một số trong công thức thì KHÔNG trùng", duplicateGroups(["Tính 2 + 3", "Tính 2 + 4"]).length === 0);
check("PHÁ: nội dung rỗng / chỉ dấu câu không bao giờ bị coi là trùng", duplicateGroups(["", "   ", "...", "!!"]).length === 0 && dupKey("...") === "");
check("PHÁ: ba bản giống nhau → một nhóm ba; danh sách rỗng → không nhóm", duplicateGroups(["a b", "A  B", "a b."]).length === 1 && duplicateGroups(["a b", "A  B", "a b."])[0].length === 3 && duplicateGroups([]).length === 0);
check("PHÁ: chỉ khác sau 300 ký tự đầu thì coi là trùng (đủ để nhận ra câu lặp), khác trong 300 ký tự đầu thì không", (() => { const base = "x".repeat(300); return duplicateGroups([base + "A", base + "B"]).length === 1 && duplicateGroups(["x".repeat(299) + "A", "x".repeat(299) + "B"]).length === 0; })());

await done();
})();
