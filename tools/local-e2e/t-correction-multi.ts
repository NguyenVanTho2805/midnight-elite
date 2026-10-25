// NV-188 + QZ-03 — Chữa bài cho câu NHIỀU ĐÁP ÁN (MC_MULTI). Cần máy chủ dev đang chạy ở BASE; gọi wipe() trên DB riêng.
// Trọng tâm: (1) danh sách chỉ có câu nhiều đáp án làm SAI (thiếu / thừa / bỏ trống), không lộ đáp án, lời giải, gợi ý; (2) "Xem lại bài làm" giấu đáp án câu chưa chữa;
// (3) điểm dừng 2 lần nộp; đúng = chọn ĐỦ và KHÔNG thừa; (4) đầu vào xấu bị chặn; (5) chữa bài không đổi điểm bài thi; (6) quyền; (7) đề không cho xem đáp án → không chữa.
import { api, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

async function mkExam(ownerId: string, o: { hideAnswerForWrong?: boolean } = {}) {
  const eid = id("ex");
  return prisma.exam.create({ data: { id: eid, code: eid, title: "Đề nhiều đáp án", category: "Toán", date: "01/01/2020", time: "08:00", duration: "60 phút", questions: 0, status: "available", createdAt: "2020-01-01", ownerId, answerVisibility: "after_submit", hideAnswerForWrong: o.hideAnswerForWrong ?? false } });
}
// Câu nhiều đáp án: 4 ô, đúng là ô 0 và ô 2.
async function mkMulti(examId: string, order: number, text: string, o: { hint?: string; explanation?: string } = {}) {
  const qid = id("q");
  const q = await prisma.examQuestion.create({ data: { id: qid, examId, order, text, hint: o.hint ?? null, explanation: o.explanation ?? null, type: "MC_MULTI", points: 2 } });
  const opts: string[] = [];
  for (let i = 0; i < 4; i++) opts.push((await prisma.examOption.create({ data: { id: id("o"), questionId: qid, order: i, text: `lựa chọn ${i}`, isCorrect: i === 0 || i === 2 } })).id);
  return { q, opts, correct: [opts[0], opts[2]] };
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const stu = await mkUser({ name: "Em An" }), other = await mkUser({ name: "Em Khác" });
  const exam = await mkExam(tutor.id);
  const m1 = await mkMulti(exam.id, 1, "Câu 1 thiếu một ô", { hint: "GỢI-Ý-M1", explanation: "LỜI-GIẢI-M1" });
  const m2 = await mkMulti(exam.id, 2, "Câu 2 chọn đủ và đúng", { hint: "GỢI-Ý-M2", explanation: "LỜI-GIẢI-M2" });
  const m3 = await mkMulti(exam.id, 3, "Câu 3 thừa một ô sai", { hint: "GỢI-Ý-M3", explanation: "LỜI-GIẢI-M3" });
  const m4 = await mkMulti(exam.id, 4, "Câu 4 bỏ trống", { explanation: "LỜI-GIẢI-M4" });          // không có gợi ý
  const m5 = await mkMulti(exam.id, 5, "Câu 5 thử đúng ngay lần 1", { hint: "GỢI-Ý-M5", explanation: "LỜI-GIẢI-M5" });
  const attempt = await prisma.examAttempt.create({ data: { userId: stu.id, examId: exam.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", score: 4, totalPoints: 10 } });
  const tick = (optIds: string[]) => Promise.all(optIds.map(o => prisma.examAnswerBoolean.create({ data: { attemptId: attempt.id, optionId: o, answerTrue: true } })));
  await tick([m1.opts[0]]);                          // thiếu ô 2 → sai
  await tick([m2.opts[0], m2.opts[2]]);              // đúng
  await tick([m3.opts[0], m3.opts[2], m3.opts[1]]);  // thừa ô 1 → sai
  /* m4 bỏ trống */
  await tick([m5.opts[1]]);                          // sai
  const inProgress = await prisma.examAttempt.create({ data: { userId: stu.id, examId: exam.id, expiresAt: new Date(Date.now() + 3600_000), status: "in_progress" } });

  const get = (as?: any, aid = attempt.id) => api("GET", `/api/exams/attempts/${aid}/correction`, { as });
  const post = (qid: string, body: object, as: any = stu, aid = attempt.id) => api("POST", `/api/exams/attempts/${aid}/correction/${qid}`, { as, body });
  const secrets = ["LỜI-GIẢI", "GỢI-Ý", "isCorrect", "correctOptionId", "correctText", "explanation"];
  const leaks = (j: unknown) => secrets.filter(s => JSON.stringify(j).includes(s));
  const before = { score: (await prisma.examAttempt.findUnique({ where: { id: attempt.id } }))?.score, ticks: await prisma.examAnswerBoolean.count({ where: { attemptId: attempt.id } }) };

  section("Quyền");
  check("chưa đăng nhập → 401; của người khác → 404; chưa nộp → 409", (await get(undefined)).status === 401 && (await get(other)).status === 404 && (await get(stu, inProgress.id)).status === 409);

  section("Danh sách: chỉ câu nhiều đáp án làm SAI, không lộ gì");
  let g = await get(stu);
  const items = g.json.items as any[];
  check("200, đúng 4 câu: 1, 3, 4, 5 (câu 2 chọn đủ và đúng thì không có)", g.status === 200 && eq(items.map(i => i.index), [1, 3, 4, 5]), items.map(i => i.index));
  check("type MC_MULTI, 4 lựa chọn chỉ có id + chữ", items.every(i => i.type === "MC_MULTI" && i.options.length === 4 && i.options.every((o: any) => Object.keys(o).sort().join() === "id,text")));
  check("chưa nộp: state new, yourOptionIds rỗng, KHÔNG lộ đáp án/lời giải/gợi ý/cờ đúng sai", items.every(i => i.state === "new" && eq(i.yourOptionIds, []) && i.answer === null && i.hint === null) && leaks(g.json).length === 0, leaks(g.json));

  section("'Xem lại bài làm' giấu đáp án của câu nhiều đáp án CHƯA chữa");
  const review = async () => (await api("GET", `/api/exams/attempts/${attempt.id}/review`, { as: stu })).json;
  let rv = await review(); let rq = rv.questions as any[];
  const rOf = (qid: string) => rq.find(x => x.id === qid);
  check("câu 1 (sai, chưa chữa): isCorrect null ở mọi ô, không lời giải, correctionPending", rOf(m1.q.id).options.every((o: any) => o.isCorrect === null) && rOf(m1.q.id).explanation === null && rOf(m1.q.id).correctionPending === true && !JSON.stringify(rOf(m1.q.id)).includes("LỜI-GIẢI-M1"), rOf(m1.q.id));
  check("câu 4 (bỏ trống) cũng giấu", rOf(m4.q.id).correctionPending === true && rOf(m4.q.id).options.every((o: any) => o.isCorrect === null));
  check("vẫn cho thấy ô em đã chọn (picked)", rOf(m1.q.id).options.filter((o: any) => o.picked).length === 1);
  check("câu 2 làm ĐÚNG: hiện đáp án + lời giải như cũ, không chờ chữa", rOf(m2.q.id).options.filter((o: any) => o.isCorrect === true).length === 2 && rOf(m2.q.id).explanation === "LỜI-GIẢI-M2" && rOf(m2.q.id).correctionPending === false);
  check("correctableCount = 4", rv.correctableCount === 4, rv.correctableCount);

  section("Đầu vào xấu bị chặn (không ghi gì)");
  const bad = async (body: object, name: string) => check(name, (await post(m1.q.id, body)).status === 400);
  await bad({ action: "submit" }, "thiếu optionIds → 400");
  await bad({ action: "submit", optionIds: [] }, "optionIds rỗng → 400");
  await bad({ action: "submit", optionIds: "abc" }, "optionIds không phải mảng → 400");
  await bad({ action: "submit", optionIds: [m1.opts[0], 5] }, "phần tử không phải chuỗi → 400");
  await bad({ action: "submit", optionIds: [m1.opts[0], m2.opts[0]] }, "ô của CÂU KHÁC lẫn vào → 400");
  await bad({ action: "submit", optionIds: ["khong-co"] }, "id lạ → 400");
  await bad({ action: "submit", optionId: m1.opts[0] }, "gửi optionId đơn cho câu nhiều đáp án → 400 (phải là optionIds)");
  check("câu 2 (đã đúng, không cần chữa) → 404", (await post(m2.q.id, { action: "submit", optionIds: m2.correct })).status === 404);
  check("sau mọi lần bị chặn: chưa có dòng chữa bài nào", (await prisma.examCorrection.count({ where: { attemptId: attempt.id } })) === 0);

  section("Điểm dừng 2 lần nộp (câu có gợi ý)");
  let r = await post(m1.q.id, { action: "submit", optionIds: [m1.opts[0], m1.opts[1]] }); // vẫn sai (thừa ô 1, thiếu ô 2)
  check("sai lần 1 → state hint, hiện đúng 1 gợi ý, chưa có đáp án", r.status === 200 && r.json.item.state === "hint" && r.json.item.hint === "GỢI-Ý-M1" && r.json.item.answer === null && r.json.item.canReveal === true, r.json);
  check("nhớ các ô vừa chọn (yourOptionIds)", eq([...r.json.item.yourOptionIds].sort(), [m1.opts[0], m1.opts[1]].sort()));
  check("phản hồi không lộ đáp án/lời giải", leaks({ ...r.json, item: { ...r.json.item, hint: null } }).length === 0, leaks({ ...r.json, item: { ...r.json.item, hint: null } }));
  g = await get(stu);
  check("tải lại: vẫn ở bước 2, đáp án chưa lộ", g.json.items[0].state === "hint" && g.json.items[0].answer === null && !JSON.stringify(g.json.items[0]).includes("LỜI-GIẢI-M1"));
  r = await post(m1.q.id, { action: "submit", optionIds: [m1.opts[0]] }); // thiếu ô 2 → sai lần 2
  check("sai lần 2 → revealed: hiện đủ 2 ô đúng + lời giải, hết gợi ý", r.json.item.state === "revealed" && r.json.item.tries === 2 && eq([...r.json.item.answer.correctOptionIds].sort(), [...m1.correct].sort()) && r.json.item.answer.explanation === "LỜI-GIẢI-M1" && r.json.item.hint === null, r.json);
  check("câu đã xong: nộp thêm → 409, tries không tăng", (await post(m1.q.id, { action: "submit", optionIds: m1.correct })).status === 409 && (await prisma.examCorrection.findFirst({ where: { attemptId: attempt.id, questionId: m1.q.id } }))?.tries === 2);
  check("viết tự giải thích được (đã xem gợi ý và xong câu)", r.json.item.canReflect === true && (await post(m1.q.id, { action: "reflect", text: "Mình quên ô còn lại." })).status === 200);

  section("Đúng = chọn ĐỦ và KHÔNG thừa");
  r = await post(m3.q.id, { action: "submit", optionIds: [m3.opts[0], m3.opts[2], m3.opts[3]] });
  check("chọn đủ ô đúng nhưng thừa một ô sai → vẫn SAI (state hint)", r.json.item.state === "hint" && r.json.item.lastTryCorrect === false, r.json);
  r = await post(m3.q.id, { action: "submit", optionIds: [m3.opts[2], m3.opts[0]] }); // thứ tự đảo
  check("thử lại chọn đúng đủ (đảo thứ tự) → solved lần 2, hiện đáp án + lời giải", r.json.item.state === "solved" && r.json.item.tries === 2 && r.json.item.answer.explanation === "LỜI-GIẢI-M3" && r.json.item.answer.correctOptionIds.length === 2, r.json);
  r = await post(m5.q.id, { action: "submit", optionIds: [...m5.correct, m5.correct[0]] }); // id lặp được gộp
  check("đúng ngay lần 1 (kể cả id lặp) → solved, tries 1, không hiện gợi ý", r.json.item.state === "solved" && r.json.item.tries === 1 && r.json.item.hint === null, r.json);
  check("chưa từng thấy gợi ý → không viết tự giải thích được (409)", r.json.item.canReflect === false && (await post(m5.q.id, { action: "reflect", text: "ok" })).status === 409);

  section("Câu chưa có gợi ý: bỏ bước 2");
  r = await post(m4.q.id, { action: "submit", optionIds: [m4.opts[1]] });
  check("sai lần 1 → hiện đáp án luôn (revealed), tries 1", r.json.item.state === "revealed" && r.json.item.tries === 1 && r.json.item.answer.correctOptionIds.length === 2 && r.json.item.hint === null, r.json);

  section("Sau khi chữa, màn xem lại hiện đáp án; tổng kết");
  rv = await review(); rq = rv.questions as any[];
  check("câu 1, 3, 4, 5 đã xong → hiện đáp án + lời giải, hết correctionPending", [m1, m3, m4, m5].every(m => rOf(m.q.id).correctionPending === false && rOf(m.q.id).options.filter((o: any) => o.isCorrect === true).length === 2));
  g = await get(stu);
  check("tổng kết: 4 câu, 2 tự làm đúng (3, 5), 2 đã xem đáp án (1, 4), còn 0", eq(g.json.summary, { total: 4, solved: 2, revealed: 2, remaining: 0 }), g.json.summary);

  section("Chữa bài không đổi điểm bài thi");
  const after = { score: (await prisma.examAttempt.findUnique({ where: { id: attempt.id } }))?.score, ticks: await prisma.examAnswerBoolean.count({ where: { attemptId: attempt.id } }) };
  check("score và các ô đã tích trong bài thi y nguyên", eq(before, after), { before, after });

  section("Đề không cho xem đáp án (hideAnswerForWrong) → không chữa");
  const exam2 = await mkExam(tutor.id, { hideAnswerForWrong: true });
  const x = await mkMulti(exam2.id, 1, "Câu ẩn");
  const att2 = await prisma.examAttempt.create({ data: { userId: stu.id, examId: exam2.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", totalPoints: 2 } });
  await prisma.examAnswerBoolean.create({ data: { attemptId: att2.id, optionId: x.opts[1], answerTrue: true } });
  const g2 = await get(stu, att2.id);
  check("available=false, không có câu nào, không lộ", g2.status === 200 && g2.json.available === false && g2.json.items.length === 0 && leaks(g2.json).length === 0, g2.json);
  check("nộp bị chặn 403", (await post(x.q.id, { action: "submit", optionIds: x.correct }, stu, att2.id)).status === 403);

  await done();
})();
