import { api, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { applyAttemptOrder } from "@/lib/examGrading";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

async function mkExam(ownerId: string, o: { answerVisibility?: string; hideAnswerForWrong?: boolean } = {}) {
  const eid = id("ex");
  return prisma.exam.create({ data: { id: eid, code: eid, title: "Đề thử", category: "Toán", date: "01/01/2020", time: "08:00", duration: "60 phút", questions: 0, status: "available", createdAt: "2020-01-01", ownerId, answerVisibility: o.answerVisibility ?? "after_submit", hideAnswerForWrong: o.hideAnswerForWrong ?? false } });
}
// Tạo câu MC: options[0] là đáp án đúng.
async function mkMC(examId: string, order: number, text: string, opts: { hint?: string; explanation?: string; correct: string; wrong: string[] }) {
  const qid = id("q");
  const q = await prisma.examQuestion.create({ data: { id: qid, examId, order, text, hint: opts.hint ?? null, explanation: opts.explanation ?? null, type: "MC" } });
  const oc = await prisma.examOption.create({ data: { id: id("o"), questionId: qid, order: 0, text: opts.correct, isCorrect: true } });
  const ow: string[] = [];
  for (let i = 0; i < opts.wrong.length; i++) ow.push((await prisma.examOption.create({ data: { id: id("o"), questionId: qid, order: i + 1, text: opts.wrong[i], isCorrect: false } })).id);
  return { q, correctId: oc.id, wrongIds: ow };
}
async function mkShort(examId: string, order: number, text: string, correct: string, hint?: string) {
  const qid = id("q");
  const q = await prisma.examQuestion.create({ data: { id: qid, examId, order, text, hint: hint ?? null, explanation: "Giải điền ngắn", type: "SHORT_ANSWER" } });
  await prisma.examOption.create({ data: { id: id("o"), questionId: qid, order: 0, text: correct, isCorrect: true } });
  return q;
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const stu = await mkUser({ name: "Em An" }), other = await mkUser({ name: "Em Khác" });
  const exam = await mkExam(tutor.id);

  const q1 = await mkMC(exam.id, 1, "Câu 1 MC có gợi ý", { hint: "GỢI-Ý-1", explanation: "LỜI-GIẢI-1", correct: "ĐÁP-ÁN-ĐÚNG-1", wrong: ["sai 1a", "sai 1b", "sai 1c"] });
  const q2 = await mkMC(exam.id, 2, "Câu 2 làm đúng", { hint: "GỢI-Ý-2", correct: "đúng 2", wrong: ["sai 2a"] });
  const q3 = await mkMC(exam.id, 3, "Câu 3 không gợi ý", { explanation: "LỜI-GIẢI-3", correct: "ĐÁP-ÁN-ĐÚNG-3", wrong: ["sai 3a", "sai 3b"] });
  const q4 = await mkShort(exam.id, 4, "Câu 4 điền ngắn", "ĐÁP-ÁN-3.5", "GỢI-Ý-4");
  const q5 = await prisma.examQuestion.create({ data: { id: id("q"), examId: exam.id, order: 5, text: "Câu 5 tự luận", type: "ESSAY" } });
  const q6 = await mkMC(exam.id, 6, "Câu 6 bỏ trống", { hint: "GỢI-Ý-6", explanation: "LỜI-GIẢI-6", correct: "ĐÁP-ÁN-ĐÚNG-6", wrong: ["sai 6a"] });
  const q8 = await mkMC(exam.id, 8, "Câu 8 đúng ngay lần 1 ở chữa bài", { hint: "GỢI-Ý-8", explanation: "LỜI-GIẢI-8", correct: "ĐÁP-ÁN-ĐÚNG-8", wrong: ["sai 8a"] });
  const q9 = await mkMC(exam.id, 9, "Câu 9 để thử song song", { hint: "GỢI-Ý-9", explanation: "LỜI-GIẢI-9", correct: "ĐÁP-ÁN-ĐÚNG-9", wrong: ["sai 9a"] });
  const q7 = await prisma.examQuestion.create({ data: { id: id("q"), examId: exam.id, order: 7, text: "Câu 7 đúng-sai", type: "TRUE_FALSE_CLUSTER" } });

  const attempt = await prisma.examAttempt.create({ data: { userId: stu.id, examId: exam.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", score: 12.5, totalPoints: 30 } });
  const ans = (qid: string, optionId: string | null, textAnswer: string | null = null) => prisma.examAnswer.create({ data: { attemptId: attempt.id, questionId: qid, optionId, textAnswer } });
  await ans(q1.q.id, q1.wrongIds[0]);                 // sai
  await ans(q2.q.id, q2.correctId);                   // đúng
  await ans(q3.q.id, q3.wrongIds[1]);                 // sai
  await ans(q4.id, null, "4");                         // sai
  await ans(q5.id, null, "bài văn");                  // tự luận
  /* q6: bỏ trống */
  await ans(q8.q.id, q8.wrongIds[0]);                 // sai
  await ans(q9.q.id, q9.wrongIds[0]);                 // sai
  const inProgress = await prisma.examAttempt.create({ data: { userId: stu.id, examId: exam.id, expiresAt: new Date(Date.now() + 3600_000), status: "in_progress" } });

  const get = (as?: any, aid = attempt.id) => api("GET", `/api/exams/attempts/${aid}/correction`, { as });
  const post = (qid: string, body: object, as: any = stu, aid = attempt.id) => api("POST", `/api/exams/attempts/${aid}/correction/${qid}`, { as, body });
  // Chữ của đáp án đúng của câu MC là một lựa chọn bình thường nên HIỆN cho học sinh; thứ không được lộ là cờ đúng/sai, lời giải, gợi ý.
  const secrets = ["LỜI-GIẢI", "GỢI-Ý", "ĐÁP-ÁN-3.5", "isCorrect", "correctOptionId", "correctText", "explanation", "Giải điền ngắn"];
  const leaks = (j: unknown) => secrets.filter(s => JSON.stringify(j).includes(s));

  section("Quyền truy cập");
  check("chưa đăng nhập → 401", (await get(undefined)).status === 401 && (await api("POST", `/api/exams/attempts/${attempt.id}/correction/${q1.q.id}`, { body: { action: "reveal" } })).status === 401);
  check("lượt thi của người khác → 404 (không lộ có tồn tại)", (await get(other)).status === 404 && (await post(q1.q.id, { action: "reveal" }, other)).status === 404);
  check("lượt thi chưa nộp → 409", (await get(stu, inProgress.id)).status === 409);
  check("lượt thi không tồn tại → 404", (await get(stu, "khong-co")).status === 404);

  section("Danh sách: chỉ câu MC/điền ngắn đã làm sai hoặc bỏ trống");
  let g = await get(stu);
  const items = g.json.items as any[];
  check("200 + available", g.status === 200 && g.json.available === true, g.json);
  check("đúng 6 câu: 1, 3, 4, 6, 8, 9 (không có câu đúng, tự luận, đúng-sai)", eq(items.map(i => i.index), [1, 3, 4, 6, 8, 9]), items.map(i => i.index));
  check("mọi câu đang ở trạng thái 'new', chưa nộp lần nào", items.every(i => i.state === "new" && i.tries === 0 && !i.canReveal && !i.canReflect));
  check("KHÔNG lộ đáp án, lời giải, gợi ý, cờ isCorrect", leaks(g.json).length === 0, leaks(g.json));
  check("MC có lựa chọn (chỉ id + chữ); điền ngắn không có lựa chọn", items[0].options.length === 4 && items[0].options.every((o: any) => Object.keys(o).sort().join() === "id,text") && items[2].options.length === 0);
  check("tổng kết: 6 câu, còn 6", eq(g.json.summary, { total: 6, solved: 0, revealed: 0, remaining: 6 }), g.json.summary);

  section("Điểm dừng 2 lần nộp (câu có gợi ý)");
  let r = await post(q1.q.id, { action: "submit", optionId: q1.wrongIds[1] });
  check("nộp lần 1 sai → state 'hint', hiện ĐÚNG 1 gợi ý, chưa có đáp án", r.status === 200 && r.json.item.state === "hint" && r.json.item.hint === "GỢI-Ý-1" && r.json.item.answer === null && r.json.item.canReveal === true && r.json.item.lastTryCorrect === false, r.json);
  check("phản hồi không lộ đáp án/lời giải", leaks({ ...r.json, item: { ...r.json.item, hint: null } }).length === 0 && r.json.item.answer === null, leaks({ ...r.json, item: { ...r.json.item, hint: null } }));
  check("nhớ lựa chọn vừa nộp (để tô đỏ)", r.json.item.yourOptionId === q1.wrongIds[1]);
  g = await get(stu);
  check("tải lại danh sách: vẫn đang ở bước 2, gợi ý còn đó, đáp án chưa lộ", g.json.items[0].state === "hint" && g.json.items[0].hint === "GỢI-Ý-1" && g.json.items[0].answer === null && !JSON.stringify(g.json.items[0]).includes("LỜI-GIẢI-1"));
  r = await post(q1.q.id, { action: "submit", optionId: q1.correctId });
  check("thử lại đúng (lần 2) → solved, hiện đáp án + lời giải, hết gợi ý", r.status === 200 && r.json.item.state === "solved" && r.json.item.tries === 2 && r.json.item.answer?.correctOptionId === q1.correctId && r.json.item.answer?.explanation === "LỜI-GIẢI-1" && r.json.item.hint === null, r.json);
  check("câu đã xong: nộp thêm → 409; tries không tăng", (await post(q1.q.id, { action: "submit", optionId: q1.wrongIds[0] })).status === 409 && (await prisma.examCorrection.findFirst({ where: { attemptId: attempt.id, questionId: q1.q.id } }))?.tries === 2);

  section("Ô tự giải thích (chỉ khi đã được xem gợi ý)");
  check("q1 đã xem gợi ý → canReflect", r.json.item.canReflect === true);
  let rf = await post(q1.q.id, { action: "reflect", text: "Gợi ý giúp mình nhớ lại công thức." });
  check("viết được, lưu lại", rf.status === 200 && rf.json.item.reflection === "Gợi ý giúp mình nhớ lại công thức.");
  check("quá dài → 400; rỗng → 400", (await post(q1.q.id, { action: "reflect", text: "x".repeat(501) })).status === 400 && (await post(q1.q.id, { action: "reflect", text: "  " })).status === 400);

  section("Đúng ngay lần 1: không qua gợi ý");
  r = await post(q8.q.id, { action: "submit", optionId: q8.correctId });
  check("solved ngay, tries 1, không hiện gợi ý, có lời giải", r.status === 200 && r.json.item.state === "solved" && r.json.item.tries === 1 && r.json.item.hint === null && r.json.item.answer?.explanation === "LỜI-GIẢI-8", r.json);
  check("chưa từng thấy gợi ý → không viết 'gợi ý giúp bạn chỗ nào' được (409)", r.json.item.canReflect === false && (await post(q8.q.id, { action: "reflect", text: "ok" })).status === 409);

  section("Câu chưa có gợi ý: bỏ bước 2");
  r = await post(q3.q.id, { action: "submit", optionId: q3.wrongIds[0] });
  check("sai lần 1 → hiện đáp án luôn (revealed)", r.status === 200 && r.json.item.state === "revealed" && r.json.item.tries === 1 && r.json.item.answer?.correctOptionId === q3.correctId && r.json.item.hint === null, r.json);
  check("nộp tiếp → 409", (await post(q3.q.id, { action: "submit", optionId: q3.correctId })).status === 409);
  check("không có gợi ý thì không có ô tự giải thích", r.json.item.canReflect === false);

  section("'Xem đáp án' chỉ sau khi đã thử");
  check("chưa nộp lần nào mà bấm Xem đáp án → 409, không lộ gì", (await post(q6.q.id, { action: "reveal" })).status === 409 && !(await prisma.examCorrection.findFirst({ where: { attemptId: attempt.id, questionId: q6.q.id } })));
  await post(q6.q.id, { action: "submit", optionId: q6.wrongIds[0] });
  r = await post(q6.q.id, { action: "reveal" });
  check("sau 1 lần sai → Xem đáp án được: revealed, tries vẫn 1", r.status === 200 && r.json.item.state === "revealed" && r.json.item.tries === 1 && r.json.item.answer?.correctOptionId === q6.correctId, r.json);
  check("bấm lần 2 → 409; xem rồi cũng viết được tự giải thích", (await post(q6.q.id, { action: "reveal" })).status === 409 && r.json.item.canReflect === true);

  section("Câu điền ngắn");
  r = await post(q4.id, { action: "submit", text: "5" });
  check("sai lần 1 → gợi ý, chưa lộ đáp án", r.json.item.state === "hint" && r.json.item.hint === "GỢI-Ý-4" && !JSON.stringify(r.json).includes("ĐÁP-ÁN-3.5") && r.json.item.yourText === "5", r.json);
  const q4b = await mkShort(exam.id, 40, "Câu điền 2", "3.5", "gợi ý điền 2");
  const q4c = await mkShort(exam.id, 41, "Câu điền 3", "Hà Nội");
  await prisma.examAnswer.create({ data: { attemptId: attempt.id, questionId: q4b.id, textAnswer: "x" } });
  await prisma.examAnswer.create({ data: { attemptId: attempt.id, questionId: q4c.id, textAnswer: "y" } });
  r = await post(q4b.id, { action: "submit", text: " 3,5 " });
  check("'3,5' khớp đáp án '3.5' (như lúc chấm bài thi) → solved", r.json.item.state === "solved" && r.json.item.answer?.correctText === "3.5", r.json);
  r = await post(q4c.id, { action: "submit", text: "hà  nội" });
  check("không phân biệt hoa/thường/khoảng trắng", r.json.item.state === "solved");

  section("Đầu vào sai");
  check("lựa chọn không thuộc câu → 400", (await post(q9.q.id, { action: "submit", optionId: q1.correctId })).status === 400 && (await post(q9.q.id, { action: "submit" })).status === 400 && (await post(q9.q.id, { action: "submit", optionId: 5 })).status === 400);
  check("câu điền: thiếu/quá dài → 400", (await post(q4c.id, { action: "submit", text: "" })).status === 400);
  const q4d = await mkShort(exam.id, 42, "Câu điền 4", "1", "gợi ý");
  await prisma.examAnswer.create({ data: { attemptId: attempt.id, questionId: q4d.id, textAnswer: "z" } });
  check("câu điền: >200 ký tự → 400", (await post(q4d.id, { action: "submit", text: "x".repeat(201) })).status === 400);
  check("action lạ / body hỏng → 400", (await post(q9.q.id, { action: "xoa" } as any)).status === 400 && (await api("POST", `/api/exams/attempts/${attempt.id}/correction/${q9.q.id}`, { as: stu, raw: "{hỏng", headers: { "content-type": "application/json" } })).status === 400);
  check("câu đã làm đúng trong bài thi (q2) → 404", (await post(q2.q.id, { action: "submit", optionId: q2.correctId })).status === 404);
  check("tự luận / đúng-sai → 404", (await post(q5.id, { action: "submit", text: "a" })).status === 404 && (await post(q7.id, { action: "reveal" })).status === 404);
  const exam2 = await mkExam(tutor.id);
  const o2 = await mkMC(exam2.id, 1, "Câu đề khác", { correct: "a", wrong: ["b"] });
  check("câu của đề khác → 404", (await post(o2.q.id, { action: "submit", optionId: o2.correctId })).status === 404);

  section("Chữa bài KHÔNG đổi điểm bài thi");
  const after = await prisma.examAttempt.findUnique({ where: { id: attempt.id } });
  const answersAfter = await prisma.examAnswer.findMany({ where: { attemptId: attempt.id, questionId: { in: [q1.q.id, q3.q.id, q6.q.id] } }, orderBy: { questionId: "asc" } });
  check("score/totalPoints/status nguyên", after?.score === 12.5 && after.totalPoints === 30 && after.status === "submitted");
  check("câu trả lời gốc nguyên (vẫn là lựa chọn sai ban đầu)", answersAfter.find(a => a.questionId === q1.q.id)?.optionId === q1.wrongIds[0] && answersAfter.find(a => a.questionId === q3.q.id)?.optionId === q3.wrongIds[1] && answersAfter.find(a => a.questionId === q6.q.id) === undefined);

  section("Hai lần nộp cùng lúc không đếm đôi");
  const rs = await Promise.all(Array.from({ length: 6 }, () => post(q9.q.id, { action: "submit", optionId: q9.wrongIds[0] })));
  const okN = rs.filter(x => x.status === 200).length, conflict = rs.filter(x => x.status === 409).length;
  const row9 = await prisma.examCorrection.findFirst({ where: { attemptId: attempt.id, questionId: q9.q.id } });
  check("6 lần sai cùng lúc: đúng 2 lần được tính (điểm dừng), 4 lần 409", okN === 2 && conflict === 4 && row9?.tries === 2 && row9.revealed === true, { okN, conflict, row9 });

  section("Cấu hình đề: không cho xem đáp án thì không có chữa bài");
  for (const [label, o] of [["answerVisibility = never", { answerVisibility: "never" }], ["hideAnswerForWrong = true", { hideAnswerForWrong: true }], ["after_exam_ends khi đề chưa hết hạn", { answerVisibility: "after_exam_ends" }]] as const) {
    const ex = await mkExam(tutor.id, o as any);
    if (label.startsWith("after_exam_ends")) await prisma.exam.update({ where: { id: ex.id }, data: { date: "01/01/2099" } });
    const m = await mkMC(ex.id, 1, "Câu", { hint: "h", correct: "đúng", wrong: ["sai"] });
    const at = await prisma.examAttempt.create({ data: { userId: stu.id, examId: ex.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", score: 0, totalPoints: 1 } });
    await prisma.examAnswer.create({ data: { attemptId: at.id, questionId: m.q.id, optionId: m.wrongIds[0] } });
    const gg = await get(stu, at.id);
    check(`${label}: available=false, không liệt kê câu nào`, gg.status === 200 && gg.json.available === false && gg.json.items.length === 0 && !!gg.json.reason, gg.json);
    check(`${label}: thao tác → 403`, (await post(m.q.id, { action: "submit", optionId: m.correctId }, stu, at.id)).status === 403);
    check(`${label}: /review báo correctableCount = 0`, (await api("GET", `/api/exams/attempts/${at.id}/review`, { as: stu })).json?.correctableCount === 0);
  }
  const rv = await api("GET", `/api/exams/attempts/${attempt.id}/review`, { as: stu });
  check("đề cho xem đáp án: /review báo correctableCount = 9 (6 câu ban đầu + 3 câu điền ngắn thêm sau)", rv.status === 200 && rv.json.correctableCount === 9, rv.json?.correctableCount);

  section("Gợi ý do gia sư soạn (API)");
  const ex3 = await mkExam(tutor.id);
  const body = (extra: object) => ({ text: "Câu mới", type: "MC", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }], ...extra });
  let c = await api("POST", `/api/exams/${ex3.id}/questions`, { as: tutor, body: body({ hint: "  Nhớ định lý Pytago  " }) });
  check("tạo câu kèm gợi ý → lưu (đã cắt khoảng trắng)", c.status === 201 && c.json.hint === "Nhớ định lý Pytago", c.json);
  check("gợi ý quá 1000 ký tự → 400", (await api("POST", `/api/exams/${ex3.id}/questions`, { as: tutor, body: body({ hint: "x".repeat(1001) }) })).status === 400);
  check("gợi ý sai kiểu → 400", (await api("POST", `/api/exams/${ex3.id}/questions`, { as: tutor, body: body({ hint: 5 }) })).status === 400);
  const noHint = await api("POST", `/api/exams/${ex3.id}/questions`, { as: tutor, body: body({}) });
  check("không có gợi ý → null", noHint.status === 201 && noHint.json.hint === null);
  const u = await api("PUT", `/api/exams/${ex3.id}/questions/${c.json.id}`, { as: tutor, body: body({ hint: "" }) });
  check("sửa: gợi ý rỗng → xoá về null", u.status === 200 && u.json.hint === null, u.json);
  const cat = await prisma.questionCategory.create({ data: { name: "Đại số" } as any }).catch(() => null);
  if (cat) {
    const b = await api("POST", "/api/question-bank", { as: tutor, body: { text: "Câu ngân hàng", type: "MC", categoryId: cat.id, difficulty: "NB", hint: "gợi ý ngân hàng", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] } });
    check("ngân hàng câu hỏi: lưu gợi ý", [200, 201].includes(b.status) && b.json.hint === "gợi ý ngân hàng", b.json);
    const saved = await api("POST", `/api/exams/${ex3.id}/questions/${noHint.json.id}/save-to-bank`, { as: tutor, body: { categoryId: cat.id, difficulty: "NB" } });
    check("lưu câu của đề vào ngân hàng: copy cả gợi ý (câu này không có → null)", [200, 201].includes(saved.status) && saved.json.hint === null, saved.json);
  } else check("(bỏ qua phần ngân hàng: không tạo được danh mục)", true);
  const pub = applyAttemptOrder(await prisma.examQuestion.findMany({ where: { examId: exam.id }, include: { options: true } }), { questionOrder: null, optionOrderByQuestion: null });
  check("lúc ĐANG LÀM BÀI học viên không nhận gợi ý/đáp án/lời giải", leaks(pub).length === 0, leaks(pub));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
