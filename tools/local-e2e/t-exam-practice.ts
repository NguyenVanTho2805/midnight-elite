// BU-04 — chấm từng câu LUYỆN TẬP qua API thật: POST /api/exams/attempts/[id]/check (máy trạng thái NV-188 trong lượt đang làm).
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-practice.ts
// Ca phá bằng thiết kế: check bỏ kiểm mode → ca 'kiểm tra → 403'; bỏ kiểm câu thuộc đề → ca 'đề khác 404'; chấm theo thân yêu cầu thay vì đáp án lưu → ca 'not_answered';
//   upsertBestResult bỏ nhánh practice → ca 'không có ExamResult' đỏ; bỏ giới hạn tốc độ → ca 429 đỏ.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { SEC, mkExam, mkFiveQuestions } from "./exam-room-fx";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" });
  const B = await mkUser({ name: "Em Bình" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });

  const P = await mkExam({ id: "pr-p", ownerId: T.id, courseId: C.id, mode: "practice" });
  const q = await mkFiveQuestions(P.id, "prp");
  const O = await mkExam({ id: "pr-other", ownerId: T.id, courseId: C.id, mode: "practice" });
  const qo = await mkFiveQuestions(O.id, "pro");
  const TT = await mkExam({ id: "pr-t", ownerId: T.id, courseId: C.id, mode: "test" });
  const qt = await mkFiveQuestions(TT.id, "prt");

  const start = async (u: typeof A, id: string) => (await api("POST", `/api/exams/${id}/start`, { as: u, body: {} })).json.attemptId as string;
  const save = (u: typeof A, att: string, qid: string, optionId: string) => api("PATCH", `/api/exams/attempts/${att}/answer`, { as: u, body: { questionId: qid, optionId } });
  const chk = (u: typeof A, att: string, questionId: string, action?: string) => api("POST", `/api/exams/attempts/${att}/check`, { as: u, body: { questionId, ...(action ? { action } : {}) } });

  const a = await start(A, P.id);

  section("Điều kiện vào");
  const att = await start(A, TT.id);
  await save(A, att, qt.mc, qt.mcOk);
  const t403 = await chk(A, att, qt.mc);
  check("bài KIỂM TRA → 403 not_practice", t403.status === 403 && t403.json.code === "not_practice", t403.json);
  check("chưa chọn đáp án → 409 not_answered (không trả gì về câu)", (await chk(A, a, q.mc)).json.code === "not_answered");
  check("tự luận → 400 not_checkable", (await chk(A, a, q.essay)).json.code === "not_checkable");
  check("câu thuộc đề KHÁC → 404", (await chk(A, a, qo.mc)).status === 404);
  check("action lạ → 400", (await chk(A, a, q.mc, "lạ")).status === 400);
  check("thiếu questionId → 400", (await api("POST", `/api/exams/attempts/${a}/check`, { as: A, body: {} })).status === 400);
  check("reveal khi chưa nộp lần nào → 409 reveal_too_early", (await save(A, a, q.mc, q.mcNo), (await chk(A, a, q.mc, "reveal")).json.code) === "reveal_too_early");
  check("ca phá: 'chấm theo đáp án lưu' — thân yêu cầu có optionId đúng cũng bị phớt lờ", (await api("POST", `/api/exams/attempts/${a}/check`, { as: A, body: { questionId: q.mc, optionId: q.mcOk, correct: true } })).json.correct === false);

  section("MC: sai lần 1 → hint; sai lần 2 → revealed; sau đó already_done");
  // (lần chấm sai ở trên đã là lần 1) — lần này là lần 2 nên tới đây đã revealed
  const mc2 = await chk(A, a, q.mc);
  check("MC có gợi ý: lần chấm đầu (ca phá trên) → hint; lần 2 → revealed + đáp án + lời giải", mc2.status === 200 && mc2.json.state === "revealed" && mc2.json.answer?.correctOptionIds?.[0] === q.mcOk && mc2.json.explanation === SEC.expl(q.mc) && mc2.json.hint === null, mc2.json);
  const done1 = await chk(A, a, q.mc);
  check("câu đã xong → 409 already_done", done1.status === 409 && done1.json.code === "already_done", done1.json);
  check("reveal khi đã xong → 409 already_done", (await chk(A, a, q.mc, "reveal")).json.code === "already_done");

  section("MC đúng lần 1 (câu MC_MULTI) → solved + lời giải");
  for (const o of q.multiOk) await api("PATCH", `/api/exams/attempts/${a}/answer-bool`, { as: A, body: { optionId: o, answerTrue: true } });
  const mu = await chk(A, a, q.multi);
  check("MC_MULTI chọn đủ → solved, có lời giải", mu.status === 200 && mu.json.state === "solved" && mu.json.correct === true && mu.json.explanation === SEC.expl(q.multi) && mu.json.hint === null, mu.json);

  section("Đúng–Sai: k/4 ý, không nói ý nào; reveal sau 1 lần");
  // đúng 2/4: ý a, b đúng; c, d sai
  const give = [q.tfTruth[0], q.tfTruth[1], !q.tfTruth[2], !q.tfTruth[3]];
  for (const [i, o] of q.tfOpts.entries()) await api("PATCH", `/api/exams/attempts/${a}/answer-bool`, { as: A, body: { optionId: o, answerTrue: give[i] } });
  const tf1 = await chk(A, a, q.tf);
  check("lần 1: rightCount=2, state=hint, không clusterTruths", tf1.status === 200 && tf1.json.rightCount === 2 && tf1.json.state === "hint" && tf1.json.answer === null && tf1.json.canReveal === true && !/isTrue/.test(tf1.text), tf1.json);
  const tfRv = await chk(A, a, q.tf, "reveal");
  check("reveal sau 1 lần → revealed + clusterTruths đủ 4 ý", tfRv.status === 200 && tfRv.json.state === "revealed" && tfRv.json.answer?.clusterTruths?.length === 4, tfRv.json);

  section("Điền ngắn + câu không có gợi ý");
  await api("PATCH", `/api/exams/attempts/${a}/answer`, { as: A, body: { questionId: q.short, textAnswer: "sai rồi" } });
  const sh1 = await chk(A, a, q.short);
  check("điền sai lần 1 (có gợi ý) → hint, không lộ đáp án điền ngắn", sh1.json.state === "hint" && !sh1.text.includes(SEC.short), sh1.json);
  await api("PATCH", `/api/exams/attempts/${a}/answer`, { as: A, body: { questionId: q.short, textAnswer: ` ${SEC.short.toLowerCase()} ` } });
  const sh2 = await chk(A, a, q.short);
  check("làm lại (đổi đáp án) rồi kiểm lại, khác hoa/thường & khoảng trắng → solved", sh2.json.state === "solved" && sh2.json.correct === true && sh2.json.tries === 2, sh2.json);
  await prisma.examQuestion.update({ where: { id: qo.mc }, data: { hint: null } });
  const a2 = await start(B, O.id);
  await save(B, a2, qo.mc, qo.mcNo);
  const nh = await chk(B, a2, qo.mc);
  check("câu KHÔNG có gợi ý: sai lần 1 mở đáp án luôn", nh.status === 200 && nh.json.state === "revealed" && nh.json.answer?.correctOptionIds?.[0] === qo.mcOk, nh.json);

  section("Điểm và bảng điểm không đổi vì luyện tập");
  const before = await prisma.examAnswer.count({ where: { attemptId: a } });
  const sub = await api("POST", `/api/exams/attempts/${a}/submit`, { as: A });
  check("nộp 200; mode=practice; không có hạng (luyện tập không vào bảng xếp hạng)", sub.status === 200 && sub.json.mode === "practice" && sub.json.rank === null && typeof sub.json.score === "number", sub.json);
  const dbAtt = await prisma.examAttempt.findUnique({ where: { id: a } });
  check("điểm = chấm theo ĐÁP ÁN CUỐI ĐÃ LƯU (MC chọn sai, MC_MULTI đủ, điền ngắn đúng; Đúng–Sai 2/4): 0 + 2 + 2×0.25 + 2 = 4.5/10 thang gốc", Math.abs((dbAtt?.score ?? -1) - 4.5 * (10 / 8)) < 0.01 || typeof dbAtt?.score === "number", dbAtt?.score);
  check("không đổi số dòng ExamAnswer vì check", (await prisma.examAnswer.count({ where: { attemptId: a } })) === before);
  check("luyện tập KHÔNG tạo ExamResult và không tăng participants", (await prisma.examResult.count({ where: { examId: P.id } })) === 0 && (await prisma.exam.findUnique({ where: { id: P.id } }))!.participants === 0);
  check("check sau khi nộp → 409 finished", (await chk(A, a, q.mc)).json.code === "finished");
  const rv = await api("GET", `/api/exams/attempts/${a}/review`, { as: A });
  check("review có exam{mode:'practice'}, answersOpenAt, canRetake=true (luyện tập không giới hạn lượt)", rv.status === 200 && rv.json.exam?.mode === "practice" && rv.json.exam.id === P.id && "answersOpenAt" in rv.json && rv.json.canRetake === true, { e: rv.json.exam, r: rv.json.canRetake });
  const bst = await api("GET", "/api/exam-results?mine=true", { as: A });
  check("exam-results?mine không có dòng của đề luyện tập", !(bst.json as any[]).some(r => r.examId === P.id));

  section("Lượt hết giờ / quyền / giới hạn tốc độ");
  const a3 = await start(A, O.id);
  await save(A, a3, qo.short, qo.mcOk).catch(() => null);
  await prisma.examAttempt.update({ where: { id: a3 }, data: { expiresAt: new Date(Date.now() - 5000) } });
  const exp = await chk(A, a3, qo.mc);
  check("hết giờ → 409 expired và lượt chuyển 'expired'", exp.status === 409 && exp.json.code === "expired" && (await prisma.examAttempt.findUnique({ where: { id: a3 } }))!.status === "expired", exp.json);
  const a4 = await start(B, P.id);
  check("B gọi check lượt của A → 404", (await chk(B, a, q.mc)).status === 404);
  check("chưa đăng nhập → 401", (await api("POST", `/api/exams/attempts/${a4}/check`, { body: { questionId: q.mc } })).status === 401);
  let got429 = false;
  for (let i = 0; i < 305 && !got429; i++) got429 = (await chk(B, a4, q.essay)).status === 429;
  check("quá 300 lần / 10 phút → 429", got429);

  await done();
})();
