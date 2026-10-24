// QZ-03/04/05/07 — API gia sư soạn quiz, nhập đề (lưu bản nháp), phiên bản. Cần máy chủ dev (BASE) + DB riêng; wipe() ở đầu bài.
// Điểm cần chứng minh (brief BRIEF-QUIZ): bài đã có người làm thì KHÔNG sửa đè; bài làm cũ vẫn trỏ phiên bản cũ và điểm cũ không đổi;
// không lộ đáp án / hướng dẫn chấm cho học sinh; quyền chặt (gia sư khác 403, không có 404); bản nháp / bản cũ không tới học sinh.
import { api, mkCourse, mkTutor, mkUser, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const MC = (text: string, correct = 0, points = 1) => ({ type: "MC", text, points, options: ["A", "B", "C", "D"].map((t, i) => ({ text: `Đáp án ${t}`, isCorrect: i === correct })) });
const MULTI = (points = 2) => ({ type: "MC_MULTI", text: "Chọn mọi x thỏa x² = 4", points, options: [{ text: "−2", isCorrect: true }, { text: "2", isCorrect: true }, { text: "4", isCorrect: false }, { text: "0", isCorrect: false }] });
const ESSAY = (over: Record<string, unknown> = {}) => ({
  type: "ESSAY", text: "Giải x² − 5x + 6 = 0", points: 10, studentGuide: "HD-HỌC-SINH-XYZ", graderGuide: "HD-CHẤM-BÍ-MẬT-XYZ",
  rubric: [{ name: "Phương pháp", requirement: "r1", points: 4 }, { name: "Tính toán", requirement: "r2", points: 4 }, { name: "Trình bày", requirement: "r3", points: 2 }], options: [], ...over,
});

// Danh sách đề học sinh thấy (id). Không phải mảng (lỗi API) → ném, để kiểm tra "không thấy" không đậu giả vì API lỗi.
const listIds = async (as: TUser): Promise<string[]> => {
  const r = await api("GET", "/api/exams?active=true", { as });
  if (!Array.isArray(r.json)) throw new Error(`GET /api/exams lỗi ${r.status}`);
  return r.json.map((e: { id: string }) => e.id);
};

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" });
  const course = await mkCourse(T.id, { name: "Toán 9 (quiz)" });
  const course2 = await mkCourse(T2.id, { name: "Lớp của cô khác" });
  for (const u of [S, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });

  section("Quyền và tạo quiz nháp");
  check("chưa đăng nhập → 401", (await api("POST", "/api/tutor/quiz", { body: { title: "x" } })).status === 401);
  check("học sinh → 403", (await api("POST", "/api/tutor/quiz", { as: S, body: { title: "x" } })).status === 403);
  check("thiếu tên → 400", (await api("POST", "/api/tutor/quiz", { as: T, body: { title: "  " } })).status === 400);
  check("tên quá dài → 400", (await api("POST", "/api/tutor/quiz", { as: T, body: { title: "x".repeat(151) } })).status === 400);
  check("gắn lớp của gia sư khác → 404", (await api("POST", "/api/tutor/quiz", { as: T, body: { title: "x", courseId: course2.id } })).status === 404);
  const made = await api("POST", "/api/tutor/quiz", { as: T, body: { title: "Quiz thử A", courseId: course.id } });
  const id = made.json?.id as string;
  check("tạo nháp → 201 + id", made.status === 201 && !!id, made.json);
  const row = await prisma.exam.findUnique({ where: { id } });
  check("là BẢN NHÁP, chưa active, thuộc gia sư, v1", !!row && row.isDraft && !row.active && row.ownerId === T.id && row.versionNo === 1 && row.rootExamId === null);
  check("gia sư khác xem → 403; id không có → 404", (await api("GET", `/api/tutor/quiz/${id}`, { as: T2 })).status === 403 && (await api("GET", "/api/tutor/quiz/khong-co-id", { as: T })).status === 404);
  check("học sinh xem chi tiết quiz của gia sư → 403", (await api("GET", `/api/tutor/quiz/${id}`, { as: S })).status === 403);
  const ex = await api("POST", "/api/exams/" + id + "/start", { as: S });
  check("học sinh vào thi BẢN NHÁP → 409 (không tới học sinh)", ex.status === 409, ex.json);
  check("học sinh không thấy bản nháp ở danh sách đề", !(await listIds(S)).includes(id));
  check("học sinh mở GET /api/exams/<nháp> → 404", (await api("GET", `/api/exams/${id}`, { as: S })).status === 404);

  section("Soạn câu: luật chạy ở máy chủ");
  const post = (b: unknown, as = T, eid = id) => api("POST", `/api/tutor/quiz/${eid}/questions`, { as, body: b });
  check("câu một đáp án hợp lệ → 201", (await post(MC("Câu 1. Chọn đáp án đúng", 1))).status === 201);
  check("MC có hai đáp án đúng → 400", (await post({ ...MC("q"), options: MC("q").options.map(o => ({ ...o, isCorrect: true })) })).status === 400);
  check("nhiều đáp án hợp lệ → 201", (await post(MULTI())).status === 201);
  check("nhiều đáp án: không đáp án đúng → 400", (await post({ ...MULTI(), options: MULTI().options.map(o => ({ ...o, isCorrect: false })) })).status === 400);
  check("nhiều đáp án: đúng cả mọi ô → 400", (await post({ ...MULTI(), options: MULTI().options.map(o => ({ ...o, isCorrect: true })) })).status === 400);
  check("tự luận có tiêu chí 4+4+2 = 10 → 201", (await post(ESSAY())).status === 201);
  const badRubric = await post(ESSAY({ rubric: [{ name: "A", requirement: "", points: 9 }] }));
  check("tự luận: tổng tiêu chí ≠ điểm câu → 400 nói rõ", badRubric.status === 400 && /phải bằng/.test(badRubric.json?.error ?? ""), badRubric.json);
  check("điểm 0 / âm / chữ → 400", (await Promise.all([0, -1, "abc"].map(p => post({ ...MC("q"), points: p })))).every(r => r.status === 400));
  check("loại câu lạ → 400; thân rỗng → 400", (await post({ type: "HACK", text: "q", points: 1, options: [] })).status === 400 && (await api("POST", `/api/tutor/quiz/${id}/questions`, { as: T, raw: "không phải json", headers: { "content-type": "application/json" } })).status === 400);
  check("gia sư khác thêm câu vào quiz này → 403", (await post(MC("x"), T2)).status === 403);
  const got = (await api("GET", `/api/tutor/quiz/${id}`, { as: T })).json;
  check("3 câu đã lưu; số câu và tổng điểm khớp (1+2+10 = 13)", got.questions.length === 3 && got.exam.questionCount === 3 && got.exam.totalPoints === 13, [got.exam.questionCount, got.exam.totalPoints]);
  check("tự luận lưu đủ tiêu chí + hướng dẫn chấm (gia sư xem được)", got.questions[2].graderGuide === "HD-CHẤM-BÍ-MẬT-XYZ" && got.questions[2].rubric?.length === 3);
  const essayId = got.questions[2].id as string, multiId = got.questions[1].id as string, q1Id = got.questions[0].id as string;

  section("Sửa, đổi thứ tự, bỏ câu");
  const put = await api("PUT", `/api/tutor/quiz/${id}/questions/${q1Id}`, { as: T, body: MC("Câu 1 (đã sửa)", 2, 3) });
  check("sửa câu → 200, đáp án đúng đổi sang C, điểm 3", put.status === 200 && put.json.questions[0].text === "Câu 1 (đã sửa)" && put.json.questions[0].options[2].isCorrect === true && put.json.questions[0].points === 3);
  check("sau sửa tổng điểm 3+2+10 = 15", (await api("GET", `/api/tutor/quiz/${id}`, { as: T })).json.exam.totalPoints === 15);
  check("sửa câu của quiz KHÁC qua đường dẫn này → 404 (câu phải thuộc đúng quiz)", await (async () => {
    const other = (await api("POST", "/api/tutor/quiz", { as: T, body: { title: "Quiz khác" } })).json.id as string;
    await api("POST", `/api/tutor/quiz/${other}/questions`, { as: T, body: MC("câu của quiz khác") });
    const oq = (await api("GET", `/api/tutor/quiz/${other}`, { as: T })).json.questions[0].id as string;
    const r = await api("PUT", `/api/tutor/quiz/${id}/questions/${oq}`, { as: T, body: MC("chiếm quyền") });
    const still = await prisma.examQuestion.findUnique({ where: { id: oq } });
    return r.status === 404 && still?.text === "câu của quiz khác";
  })());
  const ids = [essayId, q1Id, multiId];
  const re = await api("POST", `/api/tutor/quiz/${id}/questions/reorder`, { as: T, body: { ids } });
  check("đổi thứ tự → câu tự luận lên đầu", re.status === 200 && re.json.questions[0].id === essayId);
  check("thứ tự thiếu / thừa / trùng id → 400", (await Promise.all([[essayId, q1Id], [essayId, q1Id, multiId, "x"], [essayId, essayId, q1Id]].map(b => api("POST", `/api/tutor/quiz/${id}/questions/reorder`, { as: T, body: { ids: b } })))).every(r => r.status === 400));
  const del = await api("DELETE", `/api/tutor/quiz/${id}/questions/${q1Id}`, { as: T });
  check("bỏ một câu → 200 và tổng điểm cập nhật (2+10 = 12)", del.status === 200 && del.json.questions.length === 2 && (await prisma.exam.findUnique({ where: { id } }))?.totalPoints === 12);
  await api("POST", `/api/tutor/quiz/${id}/questions`, { as: T, body: MC("Câu thay thế", 0, 3) });

  section("Cài đặt và phát hành");
  check("giờ sai → 400; ngày không có thật → 400; thời lượng 0 / 301 → 400", (await Promise.all([{ time: "25:99" }, { dateKey: "2026-02-31" }, { durationMin: 0 }, { durationMin: 301 }].map(b => api("PATCH", `/api/tutor/quiz/${id}`, { as: T, body: b })))).every(r => r.status === 400));
  check("cách hiện đáp án lạ → 400", (await api("PATCH", `/api/tutor/quiz/${id}`, { as: T, body: { answerVisibility: "mọi lúc" } })).status === 400);
  const patch = await api("PATCH", `/api/tutor/quiz/${id}`, { as: T, body: { title: "Quiz thử A (đã đặt tên)", dateKey: "2026-11-02", time: "19:30", durationMin: 20, password: "Mat-khau-9", answerVisibility: "after_submit" } });
  check("lưu cài đặt → 200", patch.status === 200, patch.json);
  const after = await prisma.exam.findUnique({ where: { id } });
  check("ngày lưu dạng dd/mm/yyyy, giờ, thời lượng đúng", after?.date === "02/11/2026" && after.time === "19:30" && after.duration === "20 phút");
  check("mật khẩu chỉ lưu BĂM (cột thô trống) và không trả qua API", after?.password === null && !!after?.passwordHash && !JSON.stringify((await api("GET", `/api/tutor/quiz/${id}`, { as: T })).json).includes("Mat-khau-9") && !JSON.stringify(patch.json).includes(after!.passwordHash!));
  check("gắn lớp của gia sư khác → 404", (await api("PATCH", `/api/tutor/quiz/${id}`, { as: T, body: { courseId: course2.id } })).status === 404);

  const noCourse = (await api("POST", "/api/tutor/quiz", { as: T, body: { title: "Chưa có lớp" } })).json.id as string;
  await api("POST", `/api/tutor/quiz/${noCourse}/questions`, { as: T, body: MC("q") });
  check("phát hành thiếu lớp → 400", (await api("POST", `/api/tutor/quiz/${noCourse}/publish`, { as: T })).status === 400);
  const empty = (await api("POST", "/api/tutor/quiz", { as: T, body: { title: "Rỗng", courseId: course.id } })).json.id as string;
  check("phát hành quiz không có câu → 400", (await api("POST", `/api/tutor/quiz/${empty}/publish`, { as: T })).status === 400);
  check("gia sư khác phát hành → 403", (await api("POST", `/api/tutor/quiz/${id}/publish`, { as: T2 })).status === 403);
  const pub = await api("POST", `/api/tutor/quiz/${id}/publish`, { as: T });
  check("phát hành → 200", pub.status === 200, pub.json);
  const pubRow = await prisma.exam.findUnique({ where: { id } });
  check("đã active, hết nháp; học sinh trong lớp có thông báo (không tên học sinh)", !!pubRow && !pubRow.isDraft && pubRow.active && (await prisma.notification.count({ where: { userId: S.id, type: "exam_new" } })) === 1 && !(await prisma.notification.findFirst({ where: { userId: S.id, type: "exam_new" } }))!.message.includes("Em An"));
  check("phát hành lần hai → 409", (await api("POST", `/api/tutor/quiz/${id}/publish`, { as: T })).status === 409);
  check("học sinh thấy quiz ở danh sách", (await listIds(S)).includes(id));
  check("xoá quiz đã phát hành → 409", (await api("DELETE", `/api/tutor/quiz/${id}`, { as: T })).status === 409);
  check("xoá nháp của người khác → 403; xoá nháp mình → 200", (await api("DELETE", `/api/tutor/quiz/${empty}`, { as: T2 })).status === 403 && (await api("DELETE", `/api/tutor/quiz/${empty}`, { as: T })).status === 200 && !(await prisma.exam.findUnique({ where: { id: empty } })));

  section("Học sinh làm: không lộ đáp án / hướng dẫn chấm; nhiều đáp án chấm đủ-hoặc-không");
  const pw = await api("POST", `/api/exams/${id}/start`, { as: S });
  check("quiz có mật khẩu: không mật khẩu → 403", pw.status === 403);
  const start = await api("POST", `/api/exams/${id}/start`, { as: S, body: { password: "Mat-khau-9" } });
  check("đúng mật khẩu → vào thi", start.status === 200 && !!start.json?.attemptId, start.json);
  const text = JSON.stringify(start.json);
  check("PHÁ: phản hồi KHÔNG chứa hướng dẫn chấm, tiêu chí, isCorrect", !text.includes("HD-CHẤM-BÍ-MẬT-XYZ") && !text.includes("isCorrect") && !text.includes("Phương pháp") && !text.includes("rubric"));
  check("học sinh THẤY hướng dẫn cho học sinh của câu tự luận", text.includes("HD-HỌC-SINH-XYZ"));
  const att = start.json.attemptId as string;
  const qs = start.json.questions as { id: string; type: string; options: { id: string; text: string }[] }[];
  const qMulti = qs.find(q => q.type === "MC_MULTI")!, qMC = qs.find(q => q.type === "MC")!;
  const dbMulti = await prisma.examQuestion.findUnique({ where: { id: qMulti.id }, include: { options: true } });
  const correct = dbMulti!.options.filter(o => o.isCorrect).map(o => o.id), wrong = dbMulti!.options.filter(o => !o.isCorrect).map(o => o.id);
  const tick = (oid: string, v: boolean) => api("PATCH", `/api/exams/attempts/${att}/answer-bool`, { as: S, body: { optionId: oid, answerTrue: v } });
  check("tích ô của câu nhiều đáp án → 200", (await tick(correct[0], true)).status === 200 && (await tick(correct[1], true)).status === 200);
  check("tích ô của câu MỘT đáp án qua answer-bool → 400 (không lẫn dạng)", (await tick((await prisma.examOption.findFirst({ where: { questionId: qMC.id } }))!.id, true)).status === 400);
  const dbMC = await prisma.examQuestion.findUnique({ where: { id: qMC.id }, include: { options: true } });
  await api("PATCH", `/api/exams/attempts/${att}/answer`, { as: S, body: { questionId: qMC.id, optionId: dbMC!.options.find(o => o.isCorrect)!.id } });
  const sub = await api("POST", `/api/exams/attempts/${att}/submit`, { as: S });
  const gotScore = (await prisma.examAttempt.findUnique({ where: { id: att } }))!.score!;
  // tổng điểm thô: câu thay thế 3 + nhiều đáp án 2 + tự luận 10 = 15 → thang hiển thị = tổng điểm quiz (15). Đúng MC (3) + đúng đủ nhiều đáp án (2) + tự luận chưa chấm (0) = 5.
  check("nộp bài → chấm: MC đúng 3 + nhiều đáp án đủ 2 + tự luận chờ chấm 0 = 5", sub.status === 200 && gotScore === 5, gotScore);

  const start2 = await api("POST", `/api/exams/${id}/start`, { as: S2, body: { password: "Mat-khau-9" } });
  const att2 = start2.json.attemptId as string;
  const tick2 = (oid: string, v: boolean) => api("PATCH", `/api/exams/attempts/${att2}/answer-bool`, { as: S2, body: { optionId: oid, answerTrue: v } });
  await tick2(correct[0], true); // thiếu một đáp án đúng
  await api("POST", `/api/exams/attempts/${att2}/submit`, { as: S2 });
  check("PHÁ: chỉ tích thiếu một đáp án đúng → 0 điểm câu đó (không chấm từng phần)", (await prisma.examAttempt.findUnique({ where: { id: att2 } }))!.score === 0);
  const start3 = await api("POST", `/api/exams/${id}/start`, { as: S2, body: { password: "Mat-khau-9" } });
  const att3 = start3.json.attemptId as string;
  for (const o of [...correct, wrong[0]]) await api("PATCH", `/api/exams/attempts/${att3}/answer-bool`, { as: S2, body: { optionId: o, answerTrue: true } });
  await api("POST", `/api/exams/attempts/${att3}/submit`, { as: S2 });
  check("PHÁ: tích đủ đáp án đúng nhưng thêm một ô sai → 0 điểm câu đó (không trừ điểm âm)", (await prisma.examAttempt.findUnique({ where: { id: att3 } }))!.score === 0);
  const rv = await api("GET", `/api/exams/attempts/${att}/review`, { as: S });
  const rq = rv.json.questions.find((q: { type: string }) => q.type === "MC_MULTI");
  check("xem lại: câu nhiều đáp án có ô đã chọn và đáp án đúng (đề cho xem đáp án)", rv.status === 200 && rq?.options.filter((o: { picked: boolean }) => o.picked).length === 2 && rq.options.filter((o: { isCorrect: boolean }) => o.isCorrect).length === 2, rq);
  check("xem lại KHÔNG chứa hướng dẫn chấm", !JSON.stringify(rv.json).includes("HD-CHẤM-BÍ-MẬT-XYZ"));
  const scoresBefore = (await prisma.examAttempt.findMany({ where: { examId: id }, orderBy: { id: "asc" }, select: { id: true, score: true, examId: true } }));

  section("Đã có người làm → KHÔNG sửa đè");
  const lock = (r: { status: number; json: any }) => r.status === 409 && r.json?.code === "HAS_ATTEMPTS";
  check("sửa câu → 409 HAS_ATTEMPTS", lock(await api("PUT", `/api/tutor/quiz/${id}/questions/${qMC.id}`, { as: T, body: MC("sửa đè", 1) })));
  check("thêm câu → 409", lock(await post(MC("thêm"))));
  check("bỏ câu → 409", lock(await api("DELETE", `/api/tutor/quiz/${id}/questions/${qMC.id}`, { as: T })));
  check("đổi thứ tự → 409", lock(await api("POST", `/api/tutor/quiz/${id}/questions/reorder`, { as: T, body: { ids: qs.map(q => q.id) } })));
  check("đổi cài đặt (thời lượng) → 409", lock(await api("PATCH", `/api/tutor/quiz/${id}`, { as: T, body: { durationMin: 5 } })));
  check("API CŨ /api/exams/<id>/questions: sửa → 409", lock(await api("PUT", `/api/exams/${id}/questions/${qMC.id}`, { as: T, body: { ...MC("sửa đè API cũ", 1), type: "MC" } })));
  check("API CŨ: thêm / bỏ / đổi điểm hàng loạt → 409", lock(await api("POST", `/api/exams/${id}/questions`, { as: T, body: MC("thêm") })) && lock(await api("DELETE", `/api/exams/${id}/questions/${qMC.id}`, { as: T })) && lock(await api("PUT", `/api/exams/${id}/questions/set-points`, { as: T, body: { totalPoints: 100 } })));
  check("PHÁ: câu hỏi và điểm bài làm KHÔNG đổi sau các thử sửa đè", (await prisma.examQuestion.findUnique({ where: { id: qMC.id } }))?.text === "Câu thay thế" && (await prisma.examAttempt.findUnique({ where: { id: att } }))!.score === 5);
  check("đề cũ (soạn bằng trang /admin/thi-thu) chưa có lượt làm vẫn sửa được qua API cũ", await (async () => {
    const legacy = await prisma.exam.create({ data: { id: "legacy-1", code: "LEG.1", title: "Đề cũ", category: "Toán", date: "01/01/2030", time: "08:00", duration: "60 phút", questions: 0, status: "upcoming", createdAt: "x", ownerId: T.id } });
    const c = await api("POST", `/api/exams/${legacy.id}/questions`, { as: T, body: { ...MC("câu cũ"), type: "MC" } });
    const u = await api("PUT", `/api/exams/${legacy.id}/questions/${c.json.id}`, { as: T, body: { ...MC("câu cũ sửa", 2), type: "MC" } });
    return c.status === 201 && u.status === 200 && u.json.text === "câu cũ sửa";
  })());

  section("Phiên bản mới");
  check("gia sư khác tạo phiên bản → 403; học sinh → 403", (await api("POST", `/api/tutor/quiz/${id}/new-version`, { as: T2 })).status === 403 && (await api("POST", `/api/tutor/quiz/${id}/new-version`, { as: S })).status === 403);
  const longNote = await api("POST", `/api/tutor/quiz/${id}/new-version`, { as: T, body: { note: "x".repeat(501) } });
  check("lý do quá dài → 400", longNote.status === 400);
  // Một học sinh đang làm dở bản cũ TRƯỚC khi có bản mới
  const S3 = await mkUser({ name: "Em Chưa Xong" }); await prisma.enrollment.create({ data: { userId: S3.id, courseId: course.id, status: "active" } });
  const startOld = await api("POST", `/api/exams/${id}/start`, { as: S3, body: { password: "Mat-khau-9" } });
  check("em S3 bắt đầu làm bản cũ (đang làm dở)", startOld.status === 200);
  const nv = await api("POST", `/api/tutor/quiz/${id}/new-version`, { as: T, body: { note: "Sửa đáp án câu thay thế" } });
  const v2 = nv.json?.id as string;
  check("tạo phiên bản mới → 201 + id mới", nv.status === 201 && !!v2 && v2 !== id, nv.json);
  const v2row = await prisma.exam.findUnique({ where: { id: v2 } });
  check("v2: nháp, versionNo 2, cùng chuỗi (rootExamId = v1), cùng chủ, cùng lớp, mật khẩu băm được chép", !!v2row && v2row.isDraft && v2row.versionNo === 2 && v2row.rootExamId === id && v2row.ownerId === T.id && v2row.courseId === course.id && v2row.passwordHash === after!.passwordHash && v2row.code === `${pubRow!.code}-v2`);
  check("v2 có đủ 3 câu, nội dung giống v1, nhưng là DÒNG KHÁC (không dùng chung id)", await (async () => {
    const a = await prisma.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
    const b = await prisma.examQuestion.findMany({ where: { examId: v2 }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
    const strip = (qs: typeof a) => JSON.stringify(qs.map(q => [q.type, q.text, q.points, q.graderGuide, q.rubric, q.options.map(o => [o.text, o.isCorrect])]));
    return a.length === 3 && b.length === 3 && strip(a) === strip(b) && a.every(q => !b.some(x => x.id === q.id)) && a.flatMap(q => q.options).every(o => !b.flatMap(q => q.options).some(x => x.id === o.id));
  })());
  const again = await api("POST", `/api/tutor/quiz/${id}/new-version`, { as: T });
  check("gọi lại → trả ĐÚNG bản nháp đã có (không tạo bản thứ hai)", again.status === 200 && again.json.id === v2 && again.json.existed === true && (await prisma.exam.count({ where: { rootExamId: id } })) === 1);
  const [c1, c2] = await Promise.all([api("POST", `/api/tutor/quiz/${v2}/new-version`, { as: T }), api("POST", `/api/tutor/quiz/${id}/new-version`, { as: T })]);
  check("tạo từ bản nháp → 409; gọi song song vẫn chỉ có MỘT bản nháp", c1.status === 409 && c2.status === 200 && (await prisma.exam.count({ where: { rootExamId: id } })) === 1);
  check("học sinh không thấy v2 (nháp): danh sách / vào thi / xem chi tiết", !(await listIds(S)).includes(v2) && (await api("POST", `/api/exams/${v2}/start`, { as: S, body: { password: "Mat-khau-9" } })).status === 409 && (await api("GET", `/api/exams/${v2}`, { as: S })).status === 404);
  // Sửa v2 thoải mái, v1 không đổi
  const v2q = (await api("GET", `/api/tutor/quiz/${v2}`, { as: T })).json.questions as { id: string; type: string; text: string }[];
  const edit = await api("PUT", `/api/tutor/quiz/${v2}/questions/${v2q.find(q => q.type === "MC")!.id}`, { as: T, body: MC("Câu thay thế (v2 đã sửa)", 3, 3) });
  check("sửa v2 → 200 (bản nháp sửa tự do)", edit.status === 200);
  check("v1 KHÔNG đổi: câu hỏi cũ nguyên vẹn, điểm và bài làm cũ nguyên", (await prisma.examQuestion.findUnique({ where: { id: qMC.id } }))?.text === "Câu thay thế" && (await prisma.examQuestion.count({ where: { examId: id } })) === 3);
  const vs0 = await api("GET", `/api/tutor/quiz/${id}/versions`, { as: T });
  check("trang phiên bản: chuỗi v1 (đang dùng) + v2 (nháp); lượt làm đếm theo từng phiên bản", vs0.status === 200 && vs0.json.chain.length === 2 && vs0.json.currentId === id && vs0.json.draftId === v2
    && vs0.json.chain[0].attemptCount === 4 && vs0.json.chain[1].attemptCount === 0, vs0.json?.chain);
  check("so sánh: 1 câu sửa và 1 câu đổi đáp án/điểm được báo", vs0.json.diff?.data.changed === 1 && vs0.json.diff.data.keyChanges === 1 && /đổi đáp án/.test(vs0.json.diff.summary), vs0.json.diff);
  check("gia sư khác xem phiên bản → 403", (await api("GET", `/api/tutor/quiz/${id}/versions`, { as: T2 })).status === 403);
  check("v2 chưa đủ điều kiện (ví dụ bị gỡ lớp) không phát hành → 400", await (async () => {
    await prisma.exam.update({ where: { id: v2 }, data: { courseId: null } });
    const r = await api("POST", `/api/tutor/quiz/${v2}/publish`, { as: T });
    await prisma.exam.update({ where: { id: v2 }, data: { courseId: course.id } });
    return r.status === 400;
  })());
  const pub2 = await api("POST", `/api/tutor/quiz/${v2}/publish`, { as: T });
  check("phát hành v2 → 200", pub2.status === 200, pub2.json);
  const v1After = await prisma.exam.findUnique({ where: { id } });
  check("v1 được đánh dấu ĐÃ BỊ THAY bởi v2 (supersededById / supersededAt)", v1After?.supersededById === v2 && !!v1After.supersededAt);
  check("PHÁ: điểm và bài làm cũ KHÔNG đổi, vẫn trỏ v1", JSON.stringify(await prisma.examAttempt.findMany({ where: { examId: id, status: "submitted" }, orderBy: { id: "asc" }, select: { id: true, score: true, examId: true } })) === JSON.stringify(scoresBefore.filter(a => a.score !== null)) && (await prisma.examAttempt.count({ where: { examId: v2 } })) === 0);
  check("v1 hết hiện ở danh sách; v2 hiện", await (async () => { const l = await listIds(S); return !l.includes(id) && l.includes(v2); })());
  check("học sinh mở lượt MỚI ở v1 → 409 SUPERSEDED kèm id bản mới", await (async () => { const r = await api("POST", `/api/exams/${id}/start`, { as: S2, body: { password: "Mat-khau-9" } }); return r.status === 409 && r.json?.code === "SUPERSEDED" && r.json?.supersededById === v2; })());
  const resume = await api("POST", `/api/exams/${id}/start`, { as: S3 });
  check("em đang làm dở v1 vẫn tiếp tục được lượt cũ (không bị đuổi)", resume.status === 200 && resume.json.attemptId === startOld.json.attemptId, resume.json);
  const submitOld = await api("POST", `/api/exams/attempts/${startOld.json.attemptId}/submit`, { as: S3 });
  check("và nộp vào ĐÚNG v1", submitOld.status === 200 && (await prisma.examAttempt.findUnique({ where: { id: startOld.json.attemptId } }))?.examId === id);
  check("v1 (bản cũ) không sửa được nữa: PATCH / câu / tạo phiên bản → 409 SUPERSEDED", await (async () => {
    const rs = await Promise.all([api("PATCH", `/api/tutor/quiz/${id}`, { as: T, body: { title: "x" } }), api("POST", `/api/tutor/quiz/${id}/new-version`, { as: T }), post(MC("x"))]);
    return rs.every(r => r.status === 409);
  })());
  check("S vào v2 làm lượt MỚI bình thường (mật khẩu được chép sang)", (await api("POST", `/api/exams/${v2}/start`, { as: S, body: { password: "Mat-khau-9" } })).status === 200);
  const logs = await prisma.examChangeLog.findMany({ where: { OR: [{ examId: id }, { rootExamId: id }] }, orderBy: { createdAt: "asc" } });
  check("nhật ký ghi: tạo, phát hành, đề xuất v2, phát hành v2", ["create", "publish", "new_version", "version_published"].every(k => logs.some(l => l.kind === k)), logs.map(l => l.kind));
  check("bỏ đề xuất (xoá nháp phiên bản mới) → 200 và không đụng bản đang dùng", await (async () => {
    const nv3 = await api("POST", `/api/tutor/quiz/${v2}/new-version`, { as: T });
    const r = await api("DELETE", `/api/tutor/quiz/${nv3.json.id}`, { as: T });
    return nv3.status === 201 && r.status === 200 && r.json.rootId === id && !!(await prisma.exam.findUnique({ where: { id: v2 } }));
  })());

  section("Nhập đề: lưu bản nháp đã rà soát");
  const save = (b: unknown, as = T) => api("POST", "/api/tutor/quiz/import-save", { as, body: b });
  check("chưa đăng nhập 401; học sinh 403", (await api("POST", "/api/tutor/quiz/import-save", { body: { questions: [MC("x")] } })).status === 401 && (await save({ questions: [MC("x")] }, S)).status === 403);
  check("không có câu → 400", (await save({ title: "x", questions: [] })).status === 400 && (await save({ title: "x" })).status === 400);
  check("thiếu tên và không có tên tệp → 400", (await save({ questions: [MC("x")] })).status === 400);
  check("câu hỏng báo ĐÚNG số câu (câu 2 thiếu chữ đề) → 400", await (async () => { const r = await save({ title: "x", questions: [MC("ok"), { ...MC(""), text: "" }] }); return r.status === 400 && /Câu 2/.test(r.json?.error ?? ""); })());
  check("quá 200 câu → 400", (await save({ title: "x", questions: Array.from({ length: 201 }, (_, i) => MC(`q${i}`)) })).status === 400);
  const noAnswer = { type: "MC", text: "Câu 8: công thức chưa xác nhận, thiếu đáp án", points: 1, options: [{ text: "A", isCorrect: false }, { text: "B", isCorrect: false }] };
  const imp = await save({ title: "Đề nhập từ PDF", courseId: course.id, fileName: "On-tap.pdf", questions: [MC("Câu 1"), noAnswer, ESSAY(), { ...MULTI(), imageUrl: "javascript:alert(1)" }] });
  check("lưu bản nháp (câu thiếu đáp án VẪN lưu) → 201", imp.status === 201 && imp.json.added === 4, imp.json);
  const impRow = await prisma.exam.findUnique({ where: { id: imp.json.id }, include: { examQuestions: true } });
  check("là bản nháp, 4 câu, số câu / tổng điểm khớp (1+1+10+2 = 14)", !!impRow && impRow.isDraft && impRow.examQuestions.length === 4 && impRow.questions === 4 && impRow.totalPoints === 14);
  check("PHÁ: địa chỉ ảnh javascript: bị bỏ", impRow!.examQuestions.every(q => q.imageUrl === null || q.imageUrl.startsWith("https://")));
  const pubImp = await api("POST", `/api/tutor/quiz/${imp.json.id}/publish`, { as: T });
  check("bản nháp có câu thiếu đáp án KHÔNG phát hành được (nêu rõ câu 2)", pubImp.status === 400 && /Câu 2/.test(JSON.stringify(pubImp.json)), pubImp.json);
  check("nhật ký ghi nguồn tệp", (await prisma.examChangeLog.findFirst({ where: { examId: imp.json.id, kind: "import" } }))?.note?.includes("On-tap.pdf") === true);
  const add = await save({ targetExamId: imp.json.id, questions: [MC("Thêm vào nháp")] });
  check("thêm vào quiz nháp đã có → 200, thêm 1 câu", add.status === 200 && (await prisma.examQuestion.count({ where: { examId: imp.json.id } })) === 5);
  check("thêm vào quiz ĐÃ PHÁT HÀNH → 409; của gia sư khác → 403; không có → 404", (await save({ targetExamId: v2, questions: [MC("x")] })).status === 409 && (await save({ targetExamId: imp.json.id, questions: [MC("x")] }, T2)).status === 403 && (await save({ targetExamId: "không-có", questions: [MC("x")] })).status === 404);
  check("danh sách quiz sửa được (chọn nơi thêm): chỉ của mình, không có bản đã bị thay", await (async () => {
    const mine = (await api("GET", "/api/tutor/quiz?editable=1", { as: T })).json.items as { id: string }[];
    const theirs = (await api("GET", "/api/tutor/quiz", { as: T2 })).json.items as { id: string }[];
    return mine.some(x => x.id === imp.json.id) && !mine.some(x => x.id === id) && theirs.length === 0;
  })());

  section("Dữ liệu cũ không đổi");
  check("đề cũ KHÔNG có isDraft / phiên bản lạ: mặc định isDraft=false, versionNo=1, không bị thay", await (async () => { const l = await prisma.exam.findUnique({ where: { id: "legacy-1" } }); return !!l && !l.isDraft && l.versionNo === 1 && l.rootExamId === null && l.supersededById === null; })());
  check("đề cũ vẫn hiện ở GET /api/exams của quản trị chủ đề", (await api("GET", "/api/exams", { as: T })).json?.some((e: { id: string }) => e.id === "legacy-1"));

  await done();
})();
