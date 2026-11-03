// BU-03 P3 — kết quả một đề (src/lib/deThiResults.ts): 5 khối, bảng điểm. THUẦN, số kỳ vọng TÍNH TAY (ghi chú cạnh từng ca).
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-results-lib.ts
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - bỏ `pending.has(a.id) ||` trong prepare → ca "lượt còn tự luận chờ chấm không vào điểm" đỏ;
//   - đổi toHalfStep thành Math.floor → ca 3,25 → 3,5 đỏ; bỏ lọc `status !== "in_progress"` → ca lượt đang làm dở đỏ;
//   - bỏ `${key}#${nth}` (gộp theo khoá thuần) → ca "câu lặp hai lần vẫn hai dòng" đỏ; đổi variantKey thành id câu → ca gộp xuyên mã đề đỏ;
//   - đổi `>=` thành `>` ở passN → ca "đúng 5/10 là đạt" đỏ.
import { check, section, done } from "./h";
import { capRows, RESULTS_MAX_ATTEMPTS, buildKetQua, buildScoreTable, median, toHalfStep, DISTRIBUTION_LABELS, type RAnswer, type RAttempt, type RBool, type RExam, type RQuestion, type ResultsInput } from "@/lib/deThiResults";
import { variantKey } from "@/lib/deThiVariants";

const T0 = Date.parse("2026-11-01T02:00:00Z");
const at = (id: string, userId: string, examId: string, status: string, score: number | null, startMin: number, durSec: number | null, tab = 0): RAttempt => ({
  id, userId, examId, status, score, totalPoints: 10, tabSwitchCount: tab,
  startedAt: new Date(T0 + startMin * 60_000), submittedAt: durSec === null ? null : new Date(T0 + startMin * 60_000 + durSec * 1000),
});
const mc = (id: string, examId: string, order: number, text: string, opts: [string, string, boolean][], type = "MC", points = 2): RQuestion =>
  ({ id, examId, order, type, points, text, options: opts.map(([oid, t, c]) => ({ id: oid, text: t, isCorrect: c })) });
const ans = (attemptId: string, questionId: string, optionId: string | null, textAnswer: string | null = null, pointsAwarded: number | null = null): RAnswer => ({ attemptId, questionId, optionId, textAnswer, pointsAwarded });

const exams: RExam[] = [{ id: "R", variantNo: 1, totalPoints: 10 }, { id: "C", variantNo: 2, totalPoints: 10 }];
// Đề gốc R: r1 MC, r2 MC, r3 tự luận. Mã đề C: cùng 3 câu, PHƯƠNG ÁN ĐẢO (cùng variantKey).
const questions: RQuestion[] = [
  mc("r1", "R", 1, "Câu một", [["r1a", "Một", true], ["r1b", "Hai", false]]),
  mc("r2", "R", 2, "Câu hai", [["r2a", "Ba", true], ["r2b", "Bốn", false]]),
  mc("r3", "R", 3, "Câu ba tự luận", [], "ESSAY"),
  mc("c1", "C", 1, "Câu một", [["c1b", "Hai", false], ["c1a", "Một", true]]),
  mc("c2", "C", 2, "Câu hai", [["c2b", "Bốn", false], ["c2a", "Ba", true]]),
  mc("c3", "C", 3, "Câu ba tự luận", [], "ESSAY"),
];
// Lượt: A1 u1 8đ · A2 u2 5đ · A3 u3 10đ · A8 u7 2đ nhưng còn tự luận chờ chấm · A4 u4 3,25đ · A5 u5 6đ · A6 u1 (lần 2, mã 102) 9đ · A7 u6 đang làm dở
const attempts: RAttempt[] = [
  at("A1", "u1", "R", "submitted", 8, 0, 600, 2), at("A2", "u2", "R", "submitted", 5, 5, 300), at("A3", "u3", "R", "submitted", 10, 10, 900),
  at("A8", "u7", "R", "submitted", 2, 20, 120),
  at("A4", "u4", "C", "submitted", 3.25, 30, 600), at("A5", "u5", "C", "submitted", 6, 31, 480), at("A6", "u1", "C", "submitted", 9, 60, 300, 1),
  at("A7", "u6", "C", "in_progress", null, 40, null),
];
const answers: RAnswer[] = [
  ans("A1", "r1", "r1a"), ans("A2", "r1", "r1b"), ans("A3", "r1", "r1a"), ans("A8", "r1", "r1a"),
  ans("A1", "r2", "r2a"), ans("A2", "r2", "r2a"), ans("A3", "r2", null), ans("A8", "r2", "r2b"),
  ans("A1", "r3", null, "x", 1), ans("A2", "r3", null, ""), ans("A3", "r3", null, "y", 1), ans("A8", "r3", null, "z", null),
  ans("A4", "c1", "c1b"), ans("A5", "c1", "c1a"), ans("A6", "c1", "c1a"), ans("A7", "c1", "c1a"), // A7 đang làm dở: PHẢI bị bỏ qua
  ans("A4", "c2", "c2b"), ans("A5", "c2", "c2b"), ans("A6", "c2", "c2a"),
  ans("A4", "c3", null, ""), ans("A5", "c3", null, ""), ans("A6", "c3", null, "w", 1),
];
const input: ResultsInput = { exams, questions, attempts, answers, booleans: [] };
const names = new Map([["u1", "Nguyễn An"], ["u2", "Bùi Bình"], ["u3", "Cao Chi"], ["u4", "Đỗ Dũng"], ["u5", "Lê Em"], ["u6", "Phạm Giang"], ["u7", "Vũ Hà"]]);

(async () => {
const k = buildKetQua(input);

section("Khối 1 — cơ bản (tính tay)");
// Đã nộp: A1 A2 A3 A8 A4 A5 A6 = 7 lượt, 6 học sinh (u1 hai lượt; u6 đang làm dở nên không tính). A8 còn tự luận chờ chấm → không vào điểm.
// Điểm tính được (thang 10): 3,25 · 5 · 6 · 8 · 9 · 10 → tổng 41,25 → TB 6,875 → 6,88; trung vị (6+8)/2 = 7; đạt (≥5): 5/6.
check("lượt đã nộp = 7 (không tính lượt đang làm dở), học sinh = 6", k.basic.attempts === 7 && k.basic.students === 6, k.basic);
check("trung bình 6,88 · trung vị 7 · cao nhất 10 · thấp nhất 3,25", k.basic.avg === 6.88 && k.basic.median === 7 && k.basic.max === 10 && k.basic.min === 3.25, k.basic);
check("tỉ lệ đạt = 5/6 = 0,8333 (từ 5/10 là đạt)", k.basic.passRate === 0.8333, k.basic.passRate);
// Thời gian: 600+300+900+120+600+480+300 = 3300 / 7 = 471,43 → 471 (lượt đang làm dở không có giờ nộp nên bị loại)
check("thời gian làm trung bình 471 giây", k.basic.avgDurationSec === 471, k.basic.avgDurationSec);
check("PHÁ: lượt còn tự luận chờ chấm (A8, 2đ) KHÔNG kéo điểm thấp nhất xuống 2", k.basic.min !== 2);
check("khớp buildQuizAnalytics: scoredCount cùng 6 lượt (một công thức)", k.distribution.reduce((s, d) => s + d.count, 0) === 6);

section("Khối 2 — 5 khoảng %");
// % = 80, 50, 100, 32,5, 60, 90 → [0,20)=0 · [20,40)=1 · [40,60)=1 · [60,80)=1 · [80,100]=3
check("nhãn đúng 5 khoảng theo đặc tả", k.distribution.map(d => d.label).join("|") === DISTRIBUTION_LABELS.join("|") && DISTRIBUTION_LABELS.join("|") === "0–<20%|20–<40%|40–<60%|60–<80%|80–100%");
check("số lượt từng khoảng 0,1,1,1,3 (80 thuộc khoảng cuối, 100 vẫn nằm trong 80–100)", k.distribution.map(d => d.count).join() === "0,1,1,1,3", k.distribution);

section("Khối 3 — tần số bước 0,5");
const f = new Map(k.frequency.map(x => [x.score, x.count] as const));
check("đủ 21 mốc từ 0 đến 10, bước 0,5, không trùng", k.frequency.length === 21 && k.frequency[0].score === 0 && k.frequency[20].score === 10 && k.frequency.every((x, i) => x.score === i * 0.5));
check("3,25 làm tròn LÊN 3,5; 5/6/8/9/10 đúng mốc; các mốc khác 0", f.get(3.5) === 1 && f.get(3) === 0 && [5, 6, 8, 9, 10].every(s => f.get(s) === 1) && k.frequency.reduce((s, x) => s + x.count, 0) === 6);
check("PHÁ: toHalfStep(3,25)=3,5 · (3,24)=3 · (3,75)=4 · (0)=0 · (10)=10", toHalfStep(3.25) === 3.5 && toHalfStep(3.24) === 3 && toHalfStep(3.75) === 4 && toHalfStep(0) === 0 && toHalfStep(10) === 10);

section("Khối 4 — từng câu, gộp theo variantKey xuyên mã đề");
// Câu 1: R đếm 4 lượt (A1 đúng, A2 sai, A3 đúng, A8 đúng) + C đếm 3 lượt (A4 sai, A5 đúng, A6 đúng; A7 đang làm dở bị bỏ) → 5/7 = 0,7143, 7 lượt trả lời
// Câu 2: R: A1 ✓, A2 ✓, A3 trống, A8 ✗ → 2/4, đã trả lời 3 · C: A4 ✗, A5 ✗, A6 ✓ → 1/3, 3 → tổng 3/7 = 0,4286, trả lời 6
// Câu 3 tự luận: R: A1=1, A3=1 của 2đ → 0,5 trên 2 lượt chấm, A8 chờ chấm (vẫn tính là đã trả lời) → đã trả lời 3 · C: A6=1 → 0,5 trên 1 → 1,5/3 = 0,5; trả lời 4
check("ba dòng, gộp hai mã đề thành MỘT dòng mỗi câu, đúng thứ tự đề gốc", k.questions.length === 3 && k.questions.map(q => q.order).join() === "1,2,3", k.questions);
check("câu 1: tỉ lệ đúng 0,7143, 7 lượt trả lời", k.questions[0].correctRate === 0.7143 && k.questions[0].answered === 7, k.questions[0]);
check("câu 2: 0,4286, 6 lượt trả lời (một lượt bỏ trống)", k.questions[1].correctRate === 0.4286 && k.questions[1].answered === 6, k.questions[1]);
check("câu tự luận: 0,5, 4 lượt trả lời (kể cả bài chờ chấm)", k.questions[2].correctRate === 0.5 && k.questions[2].answered === 4, k.questions[2]);
check("variantKey của dòng = khoá của câu ở đề gốc (đảo phương án không đổi khoá)", k.questions[0].variantKey === variantKey({ type: "MC", text: "Câu một", options: [{ text: "Một", isCorrect: true }, { text: "Hai", isCorrect: false }] }));
check("avgSec luôn null (hệ thống chưa ghi thời gian từng câu); không câu nào bị đánh dấu", k.questions.every(q => q.avgSec === null && q.flagged === false));
check("PHÁ: lượt đang làm dở (A7 trả lời câu 1) không được đếm vào câu 1", k.questions[0].answered === 7);

section("Khối 5 — theo mã đề");
// R (101): đã nộp A1 A2 A3 A8 = 4, điểm tính được 8,5,10 → 7,6667 → 7,67 · C (102): đã nộp A4 A5 A6 = 3, 3,25 6 9 → 6,0833 → 6,08
check("hai mã đề, mã hiển thị 101 và 102", k.variants.map(v => v.code).join() === "101,102" && k.variants.map(v => v.variantNo).join() === "1,2");
check("lượt đã nộp 4 và 3; điểm TB 7,67 và 6,08", k.variants.map(v => v.attempts).join() === "4,3" && k.variants[0].avg === 7.67 && k.variants[1].avg === 6.08, k.variants);

section("Không có tên học sinh ở khối thống kê");
const json = JSON.stringify(k);
check("PHÁ: toàn bộ JSON khối thống kê không chứa tên / mã người dùng nào", [...names.values(), ...names.keys()].every(n => !json.includes(n)), json.slice(0, 200));
check("đúng năm khoá cấp 1", Object.keys(k).sort().join() === "basic,distribution,frequency,questions,variants");

section("Câu bị đánh dấu (flagged) và dữ liệu ngoài đề nhiều mã");
const q1: RQuestion[] = [mc("a", "E", 1, "Khó", [["a1", "Đúng", true], ["a2", "Sai", false]]), mc("b", "E", 2, "Lặp", [["b1", "X", true]]), mc("b2", "E", 3, "Lặp", [["b3", "X", true]])];
const mk = (n: number, correct: boolean[]): ResultsInput => ({
  exams: [{ id: "E", variantNo: 1, totalPoints: 10 }], questions: q1,
  attempts: Array.from({ length: n }, (_, i) => at(`Z${i}`, `s${i}`, "E", "submitted", 0, i, 60)),
  answers: correct.map((c, i) => ans(`Z${i}`, "a", c ? "a1" : "a2")), booleans: [],
});
check("3 lượt trả lời, 0 đúng → flagged (đúng < 30%, đủ mẫu)", buildKetQua(mk(3, [false, false, false])).questions[0].flagged === true);
check("PHÁ: chỉ 2 lượt trả lời → KHÔNG flagged (mẫu quá nhỏ)", buildKetQua(mk(2, [false, false])).questions[0].flagged === false);
check("đúng 30% (3/10) → không flagged; 2/10 → flagged", (() => { const a = buildKetQua(mk(10, [true, true, true, false, false, false, false, false, false, false])).questions[0]; const b = buildKetQua(mk(10, [true, true, false, false, false, false, false, false, false, false])).questions[0]; return !a.flagged && a.correctRate === 0.3 && b.flagged; })());
check("PHÁ: hai câu GIỐNG HỆT trong một đề vẫn là hai dòng (không gộp nhầm)", buildKetQua(mk(2, [true, true])).questions.filter(q => q.order >= 2).length === 2);

section("Nhiều đáp án và Đúng-Sai 4 ý");
const bq: RQuestion[] = [
  { id: "m", examId: "B", order: 1, type: "MC_MULTI", points: 2, text: "Chọn các số chẵn", options: [{ id: "m1", text: "2", isCorrect: true }, { id: "m2", text: "4", isCorrect: true }, { id: "m3", text: "5", isCorrect: false }] },
  { id: "t", examId: "B", order: 2, type: "TRUE_FALSE_CLUSTER", points: 2, text: "Bốn ý", options: [["t1", true], ["t2", false], ["t3", true], ["t4", false]].map(([id, c]) => ({ id: id as string, text: id as string, isCorrect: c as boolean, subLabel: id as string })) },
];
const bAtt = [at("B1", "p1", "B", "submitted", 0, 0, 60), at("B2", "p2", "B", "submitted", 0, 1, 60), at("B3", "p3", "B", "submitted", 0, 2, 60)];
const bBool: RBool[] = [
  { attemptId: "B1", optionId: "m1", answerTrue: true }, { attemptId: "B1", optionId: "m2", answerTrue: true },        // đủ cả hai ô đúng → đúng
  { attemptId: "B2", optionId: "m1", answerTrue: true },                                                              // thiếu một ô → sai (đủ-hoặc-không)
  // B3 bỏ trống
  { attemptId: "B1", optionId: "t1", answerTrue: true }, { attemptId: "B1", optionId: "t2", answerTrue: false }, { attemptId: "B1", optionId: "t3", answerTrue: true }, { attemptId: "B1", optionId: "t4", answerTrue: false }, // 4/4
  { attemptId: "B2", optionId: "t1", answerTrue: true }, { attemptId: "B2", optionId: "t2", answerTrue: true }, { attemptId: "B2", optionId: "t3", answerTrue: null },                                                          // 1/4
];
const b = buildKetQua({ exams: [{ id: "B", variantNo: 1, totalPoints: 10 }], questions: bq, attempts: bAtt, answers: [], booleans: bBool });
// Nhiều đáp án: 1 đúng / 3 lượt đã nộp = 0,3333; trả lời 2. Đúng-Sai: (4/4 + 1/4 + 0) / 3 = 0,4167; trả lời 2.
check("nhiều đáp án: đủ-hoặc-không → 1/3 = 0,3333, trả lời 2", b.questions[0].correctRate === 0.3333 && b.questions[0].answered === 2, b.questions[0]);
check("Đúng-Sai 4 ý: (1 + 0,25 + 0) / 3 = 0,4167, trả lời 2", b.questions[1].correctRate === 0.4167 && b.questions[1].answered === 2, b.questions[1]);

section("Mã đề lệch tổng điểm vẫn so sánh được");
const sc = buildKetQua({ exams: [{ id: "R", variantNo: 1, totalPoints: 10 }, { id: "C", variantNo: 2, totalPoints: 100 }], questions: [], attempts: [at("S1", "a", "R", "submitted", 8, 0, 60), at("S2", "b", "C", "submitted", 80, 0, 60)], answers: [], booleans: [] });
check("80/100 ở mã con = 8/10 ở đề gốc → TB 8, cả hai cùng mốc 8 trong tần số", sc.basic.avg === 8 && sc.frequency.find(x => x.score === 8)!.count === 2, sc.basic);

section("Chưa có lượt nộp / chỉ có lượt dở");
const empty = buildKetQua({ exams: [{ id: "R", variantNo: 1, totalPoints: 10 }], questions: questions.slice(0, 3), attempts: [], answers: [], booleans: [] });
check("không lượt nào: số liệu rỗng, không ném, vẫn đủ 5 khoảng và 21 mốc", empty.basic.attempts === 0 && empty.basic.avg === null && empty.basic.median === null && empty.basic.passRate === null && empty.basic.avgDurationSec === null && empty.distribution.length === 5 && empty.frequency.length === 21 && empty.frequency.every(x => x.count === 0));
check("câu hỏi vẫn liệt kê với 0 lượt trả lời", empty.questions.length === 3 && empty.questions.every(q => q.answered === 0 && q.correctRate === 0 && !q.flagged));
check("chỉ có lượt đang làm dở → như rỗng", buildKetQua({ ...input, attempts: [attempts[7]], answers: [] }).basic.attempts === 0);
check("median: rỗng null, chẵn lẻ đúng", median([]) === null && median([3]) === 3 && median([1, 9, 3]) === 3 && median([1, 2, 3, 4]) === 2.5);

section("Bảng điểm (CÓ TÊN, một dòng một học sinh)");
const rowsOf = (c: "dau" | "cuoi" | "cao-nhat") => buildScoreTable({ ...input, names }, c);
const byName = (rs: ReturnType<typeof rowsOf>, n: string) => rs.find(r => r.studentName === n);
check("6 dòng (u6 chỉ có lượt dở nên không có dòng), xếp theo tên tiếng Việt", rowsOf("cao-nhat").length === 6 && rowsOf("cao-nhat").map(r => r.studentName).join("|") === ["Bùi Bình", "Cao Chi", "Đỗ Dũng", "Lê Em", "Nguyễn An", "Vũ Hà"].join("|"), rowsOf("cao-nhat").map(r => r.studentName));
check("dau: lần nộp sớm nhất của u1 = A1 (8đ, mã 101)", (() => { const r = byName(rowsOf("dau"), "Nguyễn An")!; return r.attemptId === "A1" && r.score === 8 && r.variantNo === 1 && r.tabSwitchCount === 2; })());
check("cuoi: lần muộn nhất của u1 = A6 (9đ, mã 102)", (() => { const r = byName(rowsOf("cuoi"), "Nguyễn An")!; return r.attemptId === "A6" && r.score === 9 && r.variantNo === 2 && r.tabSwitchCount === 1; })());
check("cao-nhat: điểm cao nhất của u1 = A6 (9đ)", byName(rowsOf("cao-nhat"), "Nguyễn An")!.attemptId === "A6");
check("PHÁ: hai lượt cùng điểm cao nhất → lấy lượt sớm hơn", (() => {
  const tie = buildScoreTable({ exams, questions: [], attempts: [at("T1", "u1", "R", "submitted", 7, 0, 60), at("T2", "u1", "R", "submitted", 7, 10, 60)], answers: [], booleans: [], names }, "cao-nhat");
  return tie.length === 1 && tie[0].attemptId === "T1";
})());
check("bài còn tự luận chờ chấm: score = null (chờ chấm), vẫn có dòng", (() => { const r = byName(rowsOf("cao-nhat"), "Vũ Hà")!; return r.score === null && r.attemptId === "A8"; })());
check("thời gian làm và giờ nộp đúng (A1: 600 giây)", (() => { const r = byName(rowsOf("dau"), "Nguyễn An")!; return r.durationSec === 600 && r.submittedAt === new Date(T0 + 600_000).toISOString(); })());
check("thiếu tên trong sổ → 'Học viên', không ném", buildScoreTable({ ...input, names: new Map() }, "dau").every(r => r.studentName === "Học viên"));
check("chưa có ai nộp → bảng rỗng", buildScoreTable({ ...input, attempts: [], answers: [], names }, "dau").length === 0);

// capRows: cắt ở trần và BÁO (không im lặng). Ca phá: đổi `>` thành `>=` → ca "đúng trần không cắt" đỏ; bỏ cờ truncated → ca "vượt trần báo true" đỏ.
{
  const five = [1, 2, 3, 4, 5];
  const exact = capRows(five, 5), over = capRows([...five, 6], 5), few = capRows([], 5);
  check("đúng trần: không cắt, truncated=false", exact.rows.length === 5 && exact.truncated === false);
  check("vượt trần 1 hàng: cắt về trần, truncated=true", over.rows.length === 5 && over.truncated === true && over.rows[4] === 5);
  check("rỗng: truncated=false", few.rows.length === 0 && !few.truncated);
  check("trần thật = 5000", RESULTS_MAX_ATTEMPTS === 5000);
}

await done();
})();
