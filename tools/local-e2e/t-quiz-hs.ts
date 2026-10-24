// QZ-11/12 phía học sinh — API + DB. Cổng vào đề, giờ máy chủ, số lượt, nộp trung thực, không lộ điểm/đáp án trước khi công bố, quyền chặt.
// Cần máy chủ đang chạy (BASE). Mỗi bài wipe() DB riêng.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" });
  const B = await mkUser({ name: "Em Bình" });
  const X = await mkUser({ name: "Em Xa" }); // không thuộc lớp
  const C = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });

  // createdAt >= 24/10/2026 + có tự luận = quiz MỚI → mặc định GIỮ điểm tới khi gia sư công bố (examHold). Đề cũ (createdAt "2020") giữ hành vi cũ.
  // Quiz hỗn hợp: 1 MC + 1 tự luận, 15 phút, tối đa 1 lượt, thuộc lớp C.
  const ex = await prisma.exam.create({ data: { id: "qz-mix", code: "qz-mix", title: "Ôn tập tổng hợp", category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 2, status: "available", createdAt: "2026-10-24", ownerId: T.id, courseId: C.id, totalPoints: 10, answerVisibility: "after_submit" } });
  const qMc = await prisma.examQuestion.create({ data: { id: "qz-mc", examId: ex.id, order: 1, text: "2 + 2 = ?", type: "MC", points: 1, explanation: "LỜI-GIẢI-BÍ-MẬT" } });
  await prisma.examOption.create({ data: { id: "qz-o-ok", questionId: qMc.id, order: 0, text: "4", isCorrect: true } });
  await prisma.examOption.create({ data: { id: "qz-o-no", questionId: qMc.id, order: 1, text: "5", isCorrect: false } });
  const qEs = await prisma.examQuestion.create({ data: { id: "qz-es", examId: ex.id, order: 2, text: "Giải x² − 5x + 6 = 0", type: "ESSAY", points: 2 } });
  await prisma.quizAttemptLimit.create({ data: { examId: ex.id, maxAttempts: 1 } });

  section("Cổng vào đề");
  const noAuth = await api("GET", `/api/exams/${ex.id}/gate`);
  check("chưa đăng nhập → 401", noAuth.status === 401);
  const g = await api("GET", `/api/exams/${ex.id}/gate`, { as: A });
  check("học sinh trong lớp: 200, vào được", g.status === 200 && g.json.canStart === true && g.json.blockReason === null, g.json);
  check("hiện tên lớp, số câu, 15 phút, có tự luận, nhãn 'Lượt 1/1'", g.json.klass?.name === "Toán 9" && g.json.exam.questionCount === 2 && g.json.exam.durationMinutes === 15 && g.json.exam.hasEssay === true && g.json.attempts.label === "Lượt 1/1", g.json);
  check("cổng KHÔNG chứa đáp án / lời giải / mật khẩu", !/LỜI-GIẢI|isCorrect|passwordHash|"password"/.test(g.text), g.text.slice(0, 300));
  const gx = await api("GET", `/api/exams/${ex.id}/gate`, { as: X });
  check("không thuộc lớp → blockReason not_enrolled (dẫn tới nhập mã lớp)", gx.json.canStart === false && gx.json.blockReason === "not_enrolled" && gx.json.enrolled === false, gx.json);
  const sx = await api("POST", `/api/exams/${ex.id}/start`, { as: X, body: {} });
  check("không thuộc lớp mà gọi thẳng start → 403 (máy chủ kiểm, không chỉ giao diện)", sx.status === 403, sx.json);
  check("gate đề không tồn tại → 404", (await api("GET", `/api/exams/khong-co/gate`, { as: A })).status === 404);

  section("Bắt đầu: giờ máy chủ, không lộ đáp án");
  const st = await api("POST", `/api/exams/${ex.id}/start`, { as: A, body: {} });
  check("start 200 có attemptId, expiresAt và serverNow", st.status === 200 && !!st.json.attemptId && !!st.json.expiresAt && !!st.json.serverNow, st.json);
  check("serverNow gần giờ thật (≤ 10 giây)", Math.abs(Date.parse(st.json.serverNow) - Date.now()) < 10_000);
  check("hạn = bắt đầu + 15 phút (máy chủ tính)", (() => { const a = Date.parse(st.json.expiresAt) - Date.now(); return a > 14 * 60_000 && a <= 15 * 60_000 + 5000; })());
  check("câu hỏi gửi học sinh KHÔNG có isCorrect / lời giải", !/isCorrect|LỜI-GIẢI|explanation/.test(st.text));
  const aid: string = st.json.attemptId;
  const st2 = await api("POST", `/api/exams/${ex.id}/start`, { as: A, body: {} });
  check("bấm bắt đầu lần nữa khi đang làm → tiếp tục đúng lượt đó, không tạo lượt mới", st2.status === 200 && st2.json.attemptId === aid && (await prisma.examAttempt.count({ where: { userId: A.id, examId: ex.id } })) === 1);

  section("Lưu nháp (máy chủ)");
  const p1 = await api("PATCH", `/api/exams/attempts/${aid}/answer`, { as: A, body: { questionId: qMc.id, optionId: "qz-o-ok" } });
  const p2 = await api("PATCH", `/api/exams/attempts/${aid}/answer`, { as: A, body: { questionId: qEs.id, textAnswer: "(x−2)(x−3)=0 ⇒ x=2 hoặc x=3" } });
  check("lưu trắc nghiệm + tự luận → 200", p1.status === 200 && p2.status === 200);
  const resume = await api("GET", `/api/exams/attempts/${aid}`, { as: A });
  check("mở lại (mất tab) thấy đúng bản nháp tự luận và đáp án đã chọn", resume.json.textAnswers?.[qEs.id]?.includes("x=2") && resume.json.answers?.[qMc.id] === "qz-o-ok" && !!resume.json.serverNow, resume.json);

  section("Quyền: học sinh khác không đụng được bài của em An");
  check("xem lượt của người khác → 404", (await api("GET", `/api/exams/attempts/${aid}`, { as: B })).status === 404);
  check("ghi đè câu trả lời của người khác → 404", (await api("PATCH", `/api/exams/attempts/${aid}/answer`, { as: B, body: { questionId: qEs.id, textAnswer: "phá bài" } })).status === 404);
  check("nộp hộ → 404", (await api("POST", `/api/exams/attempts/${aid}/submit`, { as: B })).status === 404);
  check("xem lại (review) của người khác → 404", (await api("GET", `/api/exams/attempts/${aid}/review`, { as: B })).status === 404);
  check("bản nháp của em An không bị đổi", (await prisma.examAnswer.findUnique({ where: { attemptId_questionId: { attemptId: aid, questionId: qEs.id } } }))?.textAnswer?.includes("x=2") === true);

  section("Nộp: trung thực, không lộ điểm dở dang");
  const sub = await api("POST", `/api/exams/attempts/${aid}/submit`, { as: A });
  check("nộp 200, status submitted, có biên nhận mã lượt", sub.status === 200 && sub.json.status === "submitted" && /^KN-[A-Z0-9]{8}$/.test(sub.json.receipt) && !!sub.json.submittedAt, sub.json);
  check("bài có tự luận chưa công bố: score = null, rank = null, pendingManual = true", sub.json.score === null && sub.json.rank === null && sub.json.pendingManual === true, sub.json);
  const dbAtt = await prisma.examAttempt.findUnique({ where: { id: aid } });
  check("trong DB đã chấm phần tự động nhưng KHÔNG lộ ra API", dbAtt?.status === "submitted" && typeof dbAtt.score === "number");
  const again = await api("POST", `/api/exams/attempts/${aid}/submit`, { as: A });
  check("nộp lại (mạng đứt rồi thử lại) → 200, không lỗi, không thưởng thêm", again.status === 200 && again.json.coinsEarned === 0 && again.json.pendingManual === true);
  const late = await api("PATCH", `/api/exams/attempts/${aid}/answer`, { as: A, body: { questionId: qEs.id, textAnswer: "sửa sau khi nộp" } });
  check("sửa bài sau khi nộp → 409", late.status === 409);
  const getDone = await api("GET", `/api/exams/attempts/${aid}`, { as: A });
  check("GET lượt đã nộp: score null, pendingManual", getDone.json.status === "submitted" && getDone.json.score === null && getDone.json.pendingManual === true, getDone.json);

  section("Kết quả: không lộ đáp án / điểm tự luận trước khi công bố");
  await prisma.examAnswer.update({ where: { attemptId_questionId: { attemptId: aid, questionId: qEs.id } }, data: { pointsAwarded: 2, teacherComment: "NHẬN-XÉT-RIÊNG" } });
  const rv = await api("GET", `/api/exams/attempts/${aid}/review`, { as: A });
  check("review 200, score null, canSeeAnswers false, pendingManual", rv.status === 200 && rv.json.score === null && rv.json.canSeeAnswers === false && rv.json.pendingManual === true, { s: rv.json.score, c: rv.json.canSeeAnswers });
  check("review KHÔNG chứa lời giải, không đáp án đúng (isCorrect toàn null), không điểm/nhận xét tự luận", !/LỜI-GIẢI|NHẬN-XÉT-RIÊNG/.test(rv.text) && !rv.text.includes('"isCorrect":true') && !rv.text.includes('"isCorrect":false'), rv.text.slice(0, 400));
  check("review vẫn cho em xem câu trả lời của chính mình", rv.text.includes("x=2"));
  const cor = await api("GET", `/api/exams/attempts/${aid}/correction`, { as: A });
  check("chữa bài cũng khoá (không lộ đáp án qua đường vòng)", cor.status === 200 && cor.json.available === false && cor.json.items.length === 0, cor.json);
  const hist = await api("GET", `/api/exams/${ex.id}/attempts?mine=true`, { as: A });
  check("lịch sử lượt: điểm null", hist.status === 200 && hist.json.length === 1 && hist.json[0].score === null, hist.json);
  const mine = await api("GET", `/api/exam-results?mine=true`, { as: A });
  const mineRow = (mine.json as any[]).find(r => r.examId === ex.id);
  check("exam-results?mine: điểm null, hạng null, pendingManual", !!mineRow && mineRow.score === null && mineRow.rank === null && mineRow.pendingManual === true, mineRow);
  const lb = await api("GET", `/api/exam-results?examId=${ex.id}`, { as: A });
  check("bảng xếp hạng của đề chưa công bố: rỗng (không lộ điểm dở dang của ai)", lb.status === 200 && Array.isArray(lb.json) && lb.json.length === 0, lb.json);

  section("Số lượt tối đa (máy chủ chặn)");
  const again2 = await api("POST", `/api/exams/${ex.id}/start`, { as: A, body: {} });
  check("đã dùng hết 1 lượt → 409 attempts_exhausted", again2.status === 409 && again2.json.code === "attempts_exhausted", again2.json);
  check("không có thêm lượt nào trong DB", (await prisma.examAttempt.count({ where: { userId: A.id, examId: ex.id } })) === 1);
  const gA = await api("GET", `/api/exams/${ex.id}/gate`, { as: A });
  check("cổng báo hết lượt, không cho vào", gA.json.canStart === false && gA.json.blockReason === "attempts_exhausted");
  // Hai yêu cầu bắt đầu đồng thời của em Bình với max=1: chỉ một lượt được tạo.
  const [r1, r2] = await Promise.all([api("POST", `/api/exams/${ex.id}/start`, { as: B, body: {} }), api("POST", `/api/exams/${ex.id}/start`, { as: B, body: {} })]);
  check("hai lần bấm cùng lúc: cả hai 200 và cùng một lượt", r1.status === 200 && r2.status === 200 && r1.json.attemptId === r2.json.attemptId, [r1.status, r2.status]);
  check("chỉ 1 dòng lượt trong DB (không vượt số lượt)", (await prisma.examAttempt.count({ where: { userId: B.id, examId: ex.id } })) === 1);

  section("Hết giờ: máy chủ không nhận thêm chữ, nộp trễ vẫn chốt tại hạn");
  const bid: string = r1.json.attemptId;
  await api("PATCH", `/api/exams/attempts/${bid}/answer`, { as: B, body: { questionId: qEs.id, textAnswer: "bài viết kịp giờ" } });
  await prisma.examAttempt.update({ where: { id: bid }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  const lateEdit = await api("PATCH", `/api/exams/attempts/${bid}/answer`, { as: B, body: { questionId: qEs.id, textAnswer: "viết thêm sau giờ" } });
  check("gõ thêm sau hết giờ → 409 'hết giờ'", lateEdit.status === 409, lateEdit.json);
  const bAtt = await prisma.examAttempt.findUnique({ where: { id: bid } });
  check("lượt tự chuyển 'expired' khi bị chạm sau hạn", bAtt?.status === "expired");
  check("chữ viết kịp giờ còn nguyên, chữ sau giờ KHÔNG vào", (await prisma.examAnswer.findUnique({ where: { attemptId_questionId: { attemptId: bid, questionId: qEs.id } } }))?.textAnswer === "bài viết kịp giờ");
  const bsub = await api("POST", `/api/exams/attempts/${bid}/submit`, { as: B });
  check("nộp sau hạn → 200 nhưng ghi nhận là hết giờ, vẫn không lộ điểm", bsub.status === 200 && bsub.json.expired === true && bsub.json.score === null && bsub.json.pendingManual === true, bsub.json);
  check("hạn không bị kéo dài", (await prisma.examAttempt.findUnique({ where: { id: bid } }))!.expiresAt.getTime() < Date.now());

  section("Không tự nhập điểm cho đề làm trong KiN");
  const post = await api("POST", `/api/exam-results`, { as: X, body: { examId: ex.id, score: 150 } });
  check("POST /api/exam-results lên đề có câu hỏi → 409, không ghi điểm", post.status === 409 && (await prisma.examResult.count({ where: { userId: X.id } })) === 0, post.json);
  await prisma.exam.create({ data: { id: "qz-azota", code: "qz-azota", title: "Đề Azota", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", azotaUrl: "https://azota.vn/x" } });
  const az = await api("POST", `/api/exam-results`, { as: X, body: { examId: "qz-azota", score: 120 } });
  check("đề Azota (không có câu hỏi) vẫn nhập điểm được như cũ", az.status === 200 || az.status === 201, az.json);

  section("Quiz chỉ trắc nghiệm: điểm và đáp án hiện ngay (không hồi quy)");
  const ex2 = await prisma.exam.create({ data: { id: "qz-mc-only", code: "qz-mc-only", title: "Trắc nghiệm", category: "Toán", date: "01/01/2030", time: "08:00", duration: "10 phút", questions: 1, status: "available", createdAt: "2020", ownerId: T.id, totalPoints: 10 } });
  const q2 = await prisma.examQuestion.create({ data: { id: "qz2-q", examId: ex2.id, order: 1, text: "Thủ đô Việt Nam?", type: "MC", points: 1, explanation: "Hà Nội" } });
  await prisma.examOption.create({ data: { id: "qz2-ok", questionId: q2.id, order: 0, text: "Hà Nội", isCorrect: true } });
  await prisma.examOption.create({ data: { id: "qz2-no", questionId: q2.id, order: 1, text: "Huế", isCorrect: false } });
  const s2 = await api("POST", `/api/exams/${ex2.id}/start`, { as: A, body: {} });
  await api("PATCH", `/api/exams/attempts/${s2.json.attemptId}/answer`, { as: A, body: { questionId: q2.id, optionId: "qz2-ok" } });
  const sb2 = await api("POST", `/api/exams/attempts/${s2.json.attemptId}/submit`, { as: A });
  check("điểm số thật, hạng thật, không chờ chấm", typeof sb2.json.score === "number" && sb2.json.score > 0 && typeof sb2.json.rank === "number" && sb2.json.pendingManual === false, sb2.json);
  const rv2 = await api("GET", `/api/exams/attempts/${s2.json.attemptId}/review`, { as: A });
  check("review: thấy đáp án đúng và lời giải như trước", rv2.json.canSeeAnswers === true && rv2.text.includes('"isCorrect":true') && rv2.text.includes("Hà Nội"));
  const g2 = await api("GET", `/api/exams/${ex2.id}/gate`, { as: A });
  check("đề không gắn lớp: cổng cho vào, không đòi mã lớp, không giới hạn lượt", g2.json.canStart === true && g2.json.klass === null && g2.json.attempts.max === null, g2.json);

  section("Một nguồn sự thật với phía gia sư: công bố mở điểm; đề cũ có tự luận giữ hành vi cũ");
  const aAtt = await prisma.examAttempt.findFirst({ where: { examId: "qz-mix", userId: A.id } });
  await prisma.examAttemptPublish.create({ data: { attemptId: aAtt!.id, examId: "qz-mix", publishedById: T.id } });
  const rvPub = await api("GET", `/api/exams/attempts/${aAtt!.id}/review`, { as: A });
  check("lượt A đã có dòng công bố → xem lại có điểm, không chờ chấm", rvPub.status === 200 && typeof rvPub.json.score === "number" && rvPub.json.pendingManual === false && rvPub.json.canSeeAnswers === true, rvPub.json);
  const histPub = await api("GET", `/api/exams/qz-mix/attempts?mine=true`, { as: A });
  check("lịch sử của A: có điểm thật", histPub.json.every((h: { score: number | null }) => typeof h.score === "number"), histPub.json);
  const rvB = await api("GET", `/api/exams/attempts/${(await prisma.examAttempt.findFirst({ where: { examId: "qz-mix", userId: B.id } }))!.id}/review`, { as: B });
  check("PHÁ: công bố lượt của A KHÔNG mở lượt của B (mỗi lượt một dòng)", rvB.status === 200 && rvB.json.score === null && rvB.json.pendingManual === true && rvB.json.canSeeAnswers === false, rvB.json);
  const cross = await api("GET", `/api/exams/attempts/${aAtt!.id}/review`, { as: B });
  check("PHÁ: B xem lượt của A → 404", cross.status === 404);

  const oldEx = await prisma.exam.create({ data: { id: "qz-old-essay", code: "qz-old-essay", title: "Đề cũ có tự luận", category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 2, status: "available", createdAt: "2020", ownerId: T.id, totalPoints: 10 } });
  const oq = await prisma.examQuestion.create({ data: { id: "qo-mc", examId: oldEx.id, order: 1, text: "1+1?", type: "MC", points: 1 } });
  await prisma.examOption.create({ data: { id: "qo-ok", questionId: oq.id, order: 0, text: "2", isCorrect: true } });
  await prisma.examQuestion.create({ data: { id: "qo-es", examId: oldEx.id, order: 2, text: "Trình bày", type: "ESSAY", points: 2 } });
  const so = await api("POST", `/api/exams/${oldEx.id}/start`, { as: A, body: {} });
  await api("PATCH", `/api/exams/attempts/${so.json.attemptId}/answer`, { as: A, body: { questionId: oq.id, optionId: "qo-ok" } });
  const sbo = await api("POST", `/api/exams/attempts/${so.json.attemptId}/submit`, { as: A });
  check("đề CŨ có tự luận (chưa có chính sách): hiện điểm ngay như trước, không bị giữ", typeof sbo.json.score === "number" && sbo.json.pendingManual === false && sbo.json.held === false, sbo.json);
  await prisma.examPublishPolicy.create({ data: { examId: oldEx.id, holdUntilPublish: true } });
  const so2 = await api("POST", `/api/exams/${oldEx.id}/start`, { as: B, body: {} });
  await api("PATCH", `/api/exams/attempts/${so2.json.attemptId}/answer`, { as: B, body: { questionId: oq.id, optionId: "qo-ok" } });
  const sbo2 = await api("POST", `/api/exams/attempts/${so2.json.attemptId}/submit`, { as: B });
  check("gia sư bật giữ điểm cho đề cũ → lượt mới bị giữ", sbo2.json.score === null && sbo2.json.pendingManual === true, sbo2.json);

  await done();
})();
