// BU-04 — BÀI TẤN CÔNG LỘ ĐÁP ÁN: quét TOÀN BỘ JSON mà máy chủ trả cho người đang làm bài (đề đủ 5 loại câu, có lời giải, gợi ý, đáp án điền ngắn mồi).
// Khẳng định không chỗ nào chứa lời giải mồi / đáp án điền ngắn mồi / isCorrect / correctOption* / graderGuide / mật khẩu-băm; gợi ý mồi chỉ ở check#hint.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-attack.ts
// Ca phá bằng thiết kế (sửa mã → đúng ca đó đỏ): start bỏ applyAttemptOrder/trả thẳng câu hỏi → ca 'start'; check không chặn mode≠practice → ca 'kiểm tra → 403';
//   check trả answer ở state hint → ca 'check hint'; practicePolicy bỏ 'never' → ca 'never'; hideAnswerForWrong bị bỏ → ca 'hide_wrong'.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { SEC, leaksIn, minutesFromNow, mkExam, mkFiveQuestions } from "./exam-room-fx";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" });
  const B = await mkUser({ name: "Em Bình" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });

  const P = await mkExam({ id: "at-p", ownerId: T.id, courseId: C.id, mode: "practice" });
  const qp = await mkFiveQuestions(P.id, "atp");
  const TT = await mkExam({ id: "at-t", ownerId: T.id, courseId: C.id, mode: "test", opensAt: minutesFromNow(-10), durationMin: 60, answerVisibility: "after_exam_ends" });
  const qt = await mkFiveQuestions(TT.id, "att");

  const clean = (name: string, r: { text: string }, o: { allowHint?: boolean } = {}) => { const l = leaksIn(r.text, o); check(`${name}: không rò (${l.join(", ") || "sạch"})`, l.length === 0, r.text.slice(0, 300)); };

  section("Cổng + vào phòng (kiểm tra và luyện tập)");
  const gP = await api("GET", `/api/exams/${P.id}/gate`, { as: A }); clean("gate luyện tập", gP);
  const gT = await api("GET", `/api/exams/${TT.id}/gate`, { as: A }); clean("gate kiểm tra", gT);
  check("gate: có mode/window/feedback và KHÔNG có variantNo", gP.json.exam.mode === "practice" && gP.json.feedback === "instant" && gT.json.window.state === "open" && gT.json.feedback === "none" && !/variantNo/.test(gP.text + gT.text), [gP.json, gT.json]);
  const sP = await api("POST", `/api/exams/${P.id}/start`, { as: A, body: {} }); clean("start luyện tập (lần đầu)", sP);
  const sP2 = await api("POST", `/api/exams/${P.id}/start`, { as: A, body: {} }); clean("start luyện tập (tiếp tục)", sP2);
  const sT = await api("POST", `/api/exams/${TT.id}/start`, { as: A, body: {} }); clean("start kiểm tra (lần đầu)", sT);
  const sT2 = await api("POST", `/api/exams/${TT.id}/start`, { as: A, body: {} }); clean("start kiểm tra (tiếp tục)", sT2);
  check("start trả đủ 5 câu, SHORT_ANSWER options rỗng, có variantCode=null và examId gốc", sP.status === 200 && sP.json.questions.length === 5 && sP.json.questions.find((q: any) => q.type === "SHORT_ANSWER").options.length === 0 && sP.json.variantCode === null && sP.json.examId === P.id, sP.json?.questions?.length);
  const aP: string = sP.json.attemptId, aT: string = sT.json.attemptId;
  clean("GET lượt đang làm (luyện tập)", await api("GET", `/api/exams/attempts/${aP}`, { as: A }));
  clean("GET lượt đang làm (kiểm tra)", await api("GET", `/api/exams/attempts/${aT}`, { as: A }));

  section("Lưu đáp án: 200 và 409 đều sạch, có savedAt/serverNow/expiresAt");
  const w1 = await api("PATCH", `/api/exams/attempts/${aT}/answer`, { as: A, body: { questionId: qt.mc, optionId: qt.mcNo } }); clean("answer 200", w1);
  check("answer 200 có savedAt, serverNow, expiresAt", w1.status === 200 && !!w1.json.savedAt && !!w1.json.serverNow && !!w1.json.expiresAt, w1.json);
  const w2 = await api("PATCH", `/api/exams/attempts/${aT}/answer-bool`, { as: A, body: { optionId: qt.multiOk[0], answerTrue: true } }); clean("answer-bool 200", w2);
  const tabs = await Promise.all(Array.from({ length: 3 }, () => api("PATCH", `/api/exams/attempts/${aT}/tab-event`, { as: A })));
  tabs.forEach((t, i) => clean(`tab-event #${i + 1}`, t));
  // ghi đáp án sang CÂU CỦA ĐỀ KHÁC phải bị chặn (không lẫn điểm giữa các đề)
  const cross = await api("PATCH", `/api/exams/attempts/${aT}/answer`, { as: A, body: { questionId: qp.mc, optionId: qp.mcOk } });
  check("PHÁ: ghi đáp án vào câu của đề khác → 400, DB không có dòng", cross.status === 400 && (await prisma.examAnswer.count({ where: { attemptId: aT, questionId: qp.mc } })) === 0, cross.json);
  // 409 expired trên lượt riêng của B
  const sB = await api("POST", `/api/exams/${TT.id}/start`, { as: B, body: {} });
  await prisma.examAttempt.update({ where: { id: sB.json.attemptId }, data: { expiresAt: new Date(Date.now() - 5_000) } });
  const late = await api("PATCH", `/api/exams/attempts/${sB.json.attemptId}/answer`, { as: B, body: { questionId: qt.mc, optionId: qt.mcOk } });
  check("answer sau hết giờ → 409 code=expired", late.status === 409 && late.json.code === "expired", late.json); clean("answer 409 expired", late);
  const fin = await api("PATCH", `/api/exams/attempts/${sB.json.attemptId}/answer`, { as: B, body: { questionId: qt.mc, optionId: qt.mcOk } });
  check("answer sau khi đã chốt → 409 code=finished", fin.status === 409 && fin.json.code === "finished", fin.json); clean("answer 409 finished", fin);

  section("check: kiểm tra → 403; luyện tập khi chưa chọn → 409; state hint không rò");
  const ck403 = await api("POST", `/api/exams/attempts/${aT}/check`, { as: A, body: { questionId: qt.mc } });
  check("check ở bài KIỂM TRA → 403 not_practice", ck403.status === 403 && ck403.json.code === "not_practice", ck403.json); clean("check 403", ck403);
  const ck409 = await api("POST", `/api/exams/attempts/${aP}/check`, { as: A, body: { questionId: qp.mc } });
  check("check câu chưa chọn → 409 not_answered", ck409.status === 409 && ck409.json.code === "not_answered", ck409.json); clean("check 409", ck409);
  await api("PATCH", `/api/exams/attempts/${aP}/answer`, { as: A, body: { questionId: qp.mc, optionId: qp.mcNo } });
  const ckHint = await api("POST", `/api/exams/attempts/${aP}/check`, { as: A, body: { questionId: qp.mc } });
  check("sai lần 1 → state hint + có gợi ý, answer=null, explanation=null", ckHint.status === 200 && ckHint.json.state === "hint" && ckHint.json.hint === SEC.hint(qp.mc) && ckHint.json.answer === null && ckHint.json.explanation === null, ckHint.json);
  clean("check hint (chỉ gợi ý được phép)", ckHint, { allowHint: true });
  check("check hint: JSON không chứa id đáp án đúng", !ckHint.text.includes(qp.mcOk), ckHint.text);
  // Đúng–Sai lần 1 sai: chỉ rightCount
  for (const [i, o] of qp.tfOpts.entries()) await api("PATCH", `/api/exams/attempts/${aP}/answer-bool`, { as: A, body: { optionId: o, answerTrue: !qp.tfTruth[i] } });
  const ckTf = await api("POST", `/api/exams/attempts/${aP}/check`, { as: A, body: { questionId: qp.tf } });
  check("Đúng–Sai sai hết: rightCount=0, không có clusterTruths", ckTf.status === 200 && ckTf.json.rightCount === 0 && ckTf.json.answer === null && !/isTrue/.test(ckTf.text), ckTf.json); clean("check Đúng–Sai hint", ckTf, { allowHint: true });
  const ckEs = await api("POST", `/api/exams/attempts/${aP}/check`, { as: A, body: { questionId: qp.essay } });
  check("tự luận → 400 not_checkable", ckEs.status === 400 && ckEs.json.code === "not_checkable", ckEs.json); clean("check tự luận", ckEs);

  section("Danh sách và đề: không lộ gì của câu hỏi");
  clean("GET /api/exams?active=true (học sinh)", await api("GET", "/api/exams?active=true", { as: A }));
  clean("GET /api/exams/[id]", await api("GET", `/api/exams/${P.id}`, { as: A }));
  clean("GET /api/exams?activeGuest=true (khách)", await api("GET", "/api/exams?activeGuest=true"));
  clean("GET exam-results?examId", await api("GET", `/api/exam-results?examId=${P.id}`, { as: A }));
  clean("GET exam-results?mine", await api("GET", "/api/exam-results?mine=true", { as: A }));
  const dt = await api("GET", "/api/student/de-thi", { as: A }); clean("GET student/de-thi", dt);
  check("de-thi không có tên học sinh khác / ownerId / giá", !/Em Bình|ownerId|"price"/.test(dt.text), dt.text.slice(0, 300));

  section("Quyền: học sinh B không đụng được lượt của A (check, review, answer)");
  check("B gọi check lượt của A → 404", (await api("POST", `/api/exams/attempts/${aP}/check`, { as: B, body: { questionId: qp.mc } })).status === 404);
  check("B xem review lượt của A → 404", (await api("GET", `/api/exams/attempts/${aP}/review`, { as: B })).status === 404);
  check("chưa đăng nhập: check/de-thi → 401", (await api("POST", `/api/exams/attempts/${aP}/check`, { body: { questionId: qp.mc } })).status === 401 && (await api("GET", "/api/student/de-thi")).status === 401);
  check("review khi chưa nộp → 409", (await api("GET", `/api/exams/attempts/${aP}/review`, { as: A })).status === 409);

  section("Chính sách đáp án: never / hideAnswerForWrong / giữ điểm");
  const N = await mkExam({ id: "at-never", ownerId: T.id, courseId: C.id, mode: "practice", answerVisibility: "never" });
  const qn = await mkFiveQuestions(N.id, "atn");
  const sN = await api("POST", `/api/exams/${N.id}/start`, { as: A, body: {} });
  await api("PATCH", `/api/exams/attempts/${sN.json.attemptId}/answer`, { as: A, body: { questionId: qn.mc, optionId: qn.mcNo } });
  await api("POST", `/api/exams/attempts/${sN.json.attemptId}/check`, { as: A, body: { questionId: qn.mc } });
  const nSecond = await api("POST", `/api/exams/attempts/${sN.json.attemptId}/check`, { as: A, body: { questionId: qn.mc } });
  check("answerVisibility=never: sai 2 lần → revealed nhưng answer=null, lý do 'never'", nSecond.status === 200 && nSecond.json.state === "revealed" && nSecond.json.answer === null && nSecond.json.explanation === null && nSecond.json.revealBlockedReason === "never", nSecond.json);
  clean("check never (hết lượt)", nSecond);

  const H = await mkExam({ id: "at-hide", ownerId: T.id, courseId: C.id, mode: "practice", hideAnswerForWrong: true });
  const qh = await mkFiveQuestions(H.id, "ath");
  const sH = await api("POST", `/api/exams/${H.id}/start`, { as: A, body: {} });
  await api("PATCH", `/api/exams/attempts/${sH.json.attemptId}/answer`, { as: A, body: { questionId: qh.mc, optionId: qh.mcNo } });
  await api("POST", `/api/exams/attempts/${sH.json.attemptId}/check`, { as: A, body: { questionId: qh.mc } });
  const hWrong = await api("POST", `/api/exams/attempts/${sH.json.attemptId}/check`, { as: A, body: { questionId: qh.mc } });
  check("hideAnswerForWrong: sai hết lượt → answer=null, lý do 'hide_wrong'", hWrong.status === 200 && hWrong.json.answer === null && hWrong.json.revealBlockedReason === "hide_wrong", hWrong.json); clean("check hide_wrong", hWrong);
  await api("PATCH", `/api/exams/attempts/${sH.json.attemptId}/answer`, { as: A, body: { questionId: qh.short, textAnswer: SEC.short } });
  const hRight = await api("POST", `/api/exams/attempts/${sH.json.attemptId}/check`, { as: A, body: { questionId: qh.short } });
  check("hideAnswerForWrong: làm đúng thì có đáp án + lời giải", hRight.status === 200 && hRight.json.state === "solved" && hRight.json.answer?.correctText === SEC.short && !!hRight.json.explanation, hRight.json);

  const HOLD = await mkExam({ id: "at-hold", ownerId: T.id, courseId: C.id, mode: "practice", createdAt: "2026-10-24" }); // có tự luận + đề mới → giữ điểm
  const qhold = await mkFiveQuestions(HOLD.id, "athd");
  const sHold = await api("POST", `/api/exams/${HOLD.id}/start`, { as: A, body: {} });
  check("đề luyện tập giữ điểm: start trả feedback='none'", sHold.json.feedback === "none", sHold.json?.feedback);
  await api("PATCH", `/api/exams/attempts/${sHold.json.attemptId}/answer`, { as: A, body: { questionId: qhold.mc, optionId: qhold.mcNo } });
  const ckHold = await api("POST", `/api/exams/attempts/${sHold.json.attemptId}/check`, { as: A, body: { questionId: qhold.mc } });
  check("đề giữ điểm: check → 403 no_feedback", ckHold.status === 403 && ckHold.json.code === "no_feedback", ckHold.json); clean("check no_feedback", ckHold);
  const subHold = await api("POST", `/api/exams/attempts/${sHold.json.attemptId}/submit`, { as: A });
  check("đề giữ điểm: submit không điểm, không hạng", subHold.json.score === null && subHold.json.rank === null && subHold.json.pendingManual === true, subHold.json);
  const rvHold = await api("GET", `/api/exams/attempts/${sHold.json.attemptId}/review`, { as: A });
  check("đề giữ điểm: review không điểm/đáp án/lời giải", rvHold.json.score === null && rvHold.json.canSeeAnswers === false && !/LỜI-GIẢI-/.test(rvHold.text) && !rvHold.text.includes('"isCorrect":true') && !rvHold.text.includes('"isCorrect":false'), rvHold.text.slice(0, 300));

  await done();
})();
