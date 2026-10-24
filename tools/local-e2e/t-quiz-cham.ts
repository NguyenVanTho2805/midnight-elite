// QZ-08 / QZ-06 — API chấm quiz hỗn hợp, công bố, lịch sử sửa điểm, theo dõi và phân tích. Cần máy chủ dev đang chạy ở BASE; gọi wipe() trên DB riêng.
// Trọng tâm: (1) chỉ gia sư chủ đề chấm được (đề người khác 403, không có 404, học sinh/admin khác 403, chưa đăng nhập 401);
// (2) học sinh KHÔNG thấy điểm tổng / điểm / nhận xét tự luận / đáp án trước khi công bố — soi nguyên văn phản hồi các API phía học sinh;
// (3) đề cũ không có chính sách giữ điểm giữ nguyên hành vi; (4) mọi lần sửa điểm có lịch sử; (5) số phân tích KHỚP truy vấn gốc, không có tên.
import { api, mkTutor, mkUser, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { regradeAttempt } from "@/lib/examGrading";

const stamp = Date.now().toString(36);
let seq = 0;
const id = (p: string) => `${p}-${stamp}-${++seq}`;
const SECRET = "NHAN-XET-BI-MAT-" + stamp;

async function mkMixedExam(ownerId: string, title: string) {
  const eid = id("ex");
  const exam = await prisma.exam.create({ data: { id: eid, code: eid, title, category: "toan", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 3, status: "available", createdAt: "2026-01-01", ownerId, totalPoints: 10 } });
  const mk = async (order: number, type: string, points: number) => prisma.examQuestion.create({ data: { id: id("q"), examId: eid, order, text: `Câu ${order}`, type, points, explanation: type === "ESSAY" ? "ĐÁP-ÁN-THAM-KHẢO" : "LỜI-GIẢI" } });
  const q1 = await mk(1, "MC", 1), q2 = await mk(2, "MC", 1), q3 = await mk(3, "ESSAY", 2);
  const opt = async (qid: string, order: number, isCorrect: boolean) => prisma.examOption.create({ data: { id: id("o"), questionId: qid, order, text: isCorrect ? "đúng" : "sai", isCorrect } });
  const o1 = [await opt(q1.id, 0, true), await opt(q1.id, 1, false)], o2 = [await opt(q2.id, 0, true), await opt(q2.id, 1, false)];
  return { exam, q1, q2, q3, o1, o2 };
}
type E = Awaited<ReturnType<typeof mkMixedExam>>;
async function mkAttempt(e: E, userId: string, o: { q1: boolean; q2: boolean; essay?: string | null }) {
  const a = await prisma.examAttempt.create({ data: { userId, examId: e.exam.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", totalPoints: 4 } });
  await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: e.q1.id, optionId: (o.q1 ? e.o1[0] : e.o1[1]).id } });
  await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: e.q2.id, optionId: (o.q2 ? e.o2[0] : e.o2[1]).id } });
  if (o.essay !== null && o.essay !== undefined) await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: e.q3.id, textAnswer: o.essay } });
  await regradeAttempt(a.id);
  return a;
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác"), SU = await mkSuper("Admin");
  const s1 = await mkUser({ name: "Em Một" }), s2 = await mkUser({ name: "Em Hai" }), s3 = await mkUser({ name: "Em Ba" }), s4 = await mkUser({ name: "Em Bốn" });
  const E1 = await mkMixedExam(T.id, "Quiz hỗn hợp thử");
  // Chính sách giữ điểm có TRƯỚC khi học sinh nộp (nếu bật sau, điểm tạm thời đã vào bảng xếp hạng từ lúc nộp — xem ghi chú ở báo cáo).
  await prisma.examPublishPolicy.create({ data: { examId: E1.exam.id, holdUntilPublish: true, updatedById: T.id } });
  const base = `/api/tutor/quiz-cham/${E1.exam.id}`;

  const A = await mkAttempt(E1, s1.id, { q1: true, q2: false, essay: "bài làm một" });  // chờ chấm
  const B = await mkAttempt(E1, s2.id, { q1: true, q2: true, essay: "bài làm hai" });   // sẽ chấm, chưa công bố
  const C = await mkAttempt(E1, s3.id, { q1: false, q2: false, essay: "bài làm ba" });  // sẽ chấm + công bố
  const D = await mkAttempt(E1, s4.id, { q1: true, q2: false, essay: null });           // bỏ trống tự luận

  section("Quyền: chỉ gia sư chủ đề");
  const urls: [string, string, unknown?][] = [
    ["GET", base], ["GET", `${base}/attempts/${A.id}`], ["POST", `${base}/attempts/${A.id}`, { grades: [{ questionId: E1.q3.id, points: 1 }] }],
    ["POST", `${base}/publish`, {}], ["POST", `${base}/policy`, { hold: true }], ["GET", `${base}/history`], ["GET", `${base}/thong-ke`], ["GET", `${base}/theo-doi`],
  ];
  const codes = async (as: Awaited<ReturnType<typeof mkUser>> | undefined) => Promise.all(urls.map(async ([m, u, b]) => (await api(m, u, { as, body: b })).status));
  check("chưa đăng nhập → 401 ở mọi route", (await codes(undefined)).every(c => c === 401), await codes(undefined));
  check("học sinh → 403 ở mọi route", (await codes(s1)).every(c => c === 403), await codes(s1));
  check("gia sư KHÁC → 403 ở mọi route (kể cả ghi)", (await codes(T2)).every(c => c === 403), await codes(T2));
  check("admin tổng KHÔNG chấm quiz qua màn gia sư → 403", (await codes(SU)).every(c => c === 403), await codes(SU));
  check("đề không có → 404", (await api("GET", "/api/tutor/quiz-cham/khong-co", { as: T })).status === 404);
  const before = await prisma.examAnswer.findMany({ where: { attemptId: A.id, questionId: E1.q3.id } });
  check("gia sư khác ghi điểm bị chặn: điểm trong DB không đổi", before[0].pointsAwarded === null && (await prisma.examGradeEdit.count()) === 0);
  const Eo = await mkMixedExam(T2.id, "Đề của gia sư khác"); const Ao = await mkAttempt(Eo, s1.id, { q1: true, q2: true, essay: "x" });
  check("bài nộp của đề KHÁC dán vào đường dẫn đề của mình → 404, không chấm lén", (await api("GET", `${base}/attempts/${Ao.id}`, { as: T })).status === 404 && (await api("POST", `${base}/attempts/${Ao.id}`, { as: T, body: { grades: [{ questionId: E1.q3.id, points: 1 }] } })).status === 404);
  check("công bố bài thuộc đề khác → 404 và không có dòng công bố", (await api("POST", `${base}/publish`, { as: T, body: { attemptIds: [Ao.id] } })).status === 404 && (await prisma.examAttemptPublish.count()) === 0);

  section("Tổng quan: trạng thái Chờ chấm / Đã chấm / Đã công bố");
  let ov = (await api("GET", base, { as: T })).json;
  check("đề có tự luận và đang giữ điểm", ov.hasEssay === true && ov.hold === true);
  check("4 bài: A,B,C chờ chấm; D bỏ trống tự luận → đã chấm", ov.counts.cho === 3 && ov.counts.da_cham === 1 && ov.counts.cong_bo === 0, ov.counts);
  const rowA = ov.attempts.find((r: any) => r.attemptId === A.id);
  check("hàng A: khách quan 1/2 (đúng câu 1), tự luận chờ 1 câu, tên hiện cho gia sư chủ", rowA.objectiveRaw === 1 && rowA.objectiveMax === 2 && rowA.pendingEssays === 1 && rowA.studentName === "Em Một", rowA);
  check("cấu trúc đề: 2 khách quan + 1 tự luận, 2 + 2 điểm", ov.structure.objectiveQuestions === 2 && ov.structure.essayQuestions === 1 && ov.structure.objectiveMax === 2 && ov.structure.essayMax === 2, ov.structure);

  section("Đề CŨ (chưa có chính sách giữ điểm): học sinh thấy điểm ngay như trước");
  const E0 = await mkMixedExam(T.id, "Đề cũ không giữ điểm");
  const X = await mkAttempt(E0, s1.id, { q1: true, q2: true, essay: "bài" });
  check("tổng quan đề cũ: hold=false", (await api("GET", `/api/tutor/quiz-cham/${E0.exam.id}`, { as: T })).json.hold === false);
  await api("POST", `/api/tutor/quiz-cham/${E0.exam.id}/attempts/${X.id}`, { as: T, body: { grades: [{ questionId: E0.q3.id, points: 2, comment: "ổn" }] } });
  const rev0 = await api("GET", `/api/exams/attempts/${X.id}/review`, { as: s1 });
  check("review đề cũ: điểm 10, held=false, thấy điểm và nhận xét tự luận ngay khi gia sư lưu", rev0.status === 200 && rev0.json.held === false && rev0.json.score === 10 && rev0.json.questions.find((q: any) => q.type === "ESSAY").teacherComment === "ổn", rev0.json);

  section("Bật giữ điểm; chấm; học sinh KHÔNG thấy gì trước khi công bố");
  check("policy phải có hold boolean", (await api("POST", `${base}/policy`, { as: T, body: { hold: "yes" } })).status === 400);
  check("bật giữ điểm", (await api("POST", `${base}/policy`, { as: T, body: { hold: true } })).json?.hold === true);
  // Chấm B (1,5/2) và C (2/2) bằng API mới
  const gB = await api("POST", `${base}/attempts/${B.id}`, { as: T, body: { grades: [{ questionId: E1.q3.id, points: "1,5", comment: SECRET }] } });
  check("chấm B 1,5 điểm (chuỗi dấu phẩy Việt) → ok, đã đổi 1", gB.status === 200 && gB.json.changed === 1, gB.json);
  const bAtt = await prisma.examAttempt.findUnique({ where: { id: B.id } });
  check("điểm quy đổi B = (2 + 1,5)/4 × 10 = 8,75 (tính bằng regradeAttempt có sẵn)", bAtt?.score === 8.75, bAtt?.score);
  await api("POST", `${base}/attempts/${C.id}`, { as: T, body: { grades: [{ questionId: E1.q3.id, points: 2, comment: "tốt" }] } });

  const bodies: string[] = [];
  const r1 = await api("GET", `/api/exams/attempts/${B.id}`, { as: s2 }); bodies.push(r1.text);
  const r2 = await api("GET", `/api/exams/attempts/${B.id}/review`, { as: s2 }); bodies.push(r2.text);
  const r3 = await api("GET", `/api/exams/${E1.exam.id}/attempts?mine=true`, { as: s2 }); bodies.push(r3.text);
  const r4 = await api("POST", `/api/exams/attempts/${B.id}/submit`, { as: s2 }); bodies.push(r4.text);
  const r5 = await api("GET", `/api/exams/attempts/${B.id}/correction`, { as: s2 }); bodies.push(r5.text);
  check("GET attempt: score null, held true", r1.status === 200 && r1.json.score === null && r1.json.held === true, r1.json);
  check("review: score null, held true, KHÔNG đáp án", r2.json.score === null && r2.json.held === true && r2.json.canSeeAnswers === false, { s: r2.json.score, h: r2.json.held, c: r2.json.canSeeAnswers });
  const essayQ = r2.json.questions.find((q: any) => q.type === "ESSAY");
  check("review: điểm và nhận xét tự luận null", essayQ.pointsAwarded === null && essayQ.teacherComment === null, essayQ);
  check("review: không câu MC nào lộ isCorrect", r2.json.questions.filter((q: any) => q.type === "MC").every((q: any) => q.options.every((o: any) => o.isCorrect === null) && q.explanation === null));
  check("lịch sử lượt của học sinh: score null", r3.json.every((a: any) => a.score === null && a.held === true), r3.json);
  check("nộp lại (idempotent): không trả điểm/hạng", r4.status === 200 && r4.json.score === null && r4.json.held === true && r4.json.rank === null, r4.json); // hợp nhất với phòng thi (QZ-11): chưa có hạng = null (không phải 0)
  check("chữa bài chưa mở trong lúc giữ điểm", r5.status === 200 && r5.json.available === false && r5.json.items.length === 0, r5.json);
  check("NGUYÊN VĂN mọi phản hồi phía học sinh không chứa nhận xét bí mật, không chứa '8.75'", bodies.every(t => !t.includes(SECRET) && !t.includes("8.75") && !t.includes("ĐÁP-ÁN-THAM-KHẢO")), bodies.map(t => t.slice(0, 120)));
  check("bảng xếp hạng (ExamResult) chưa có B trong lúc giữ điểm", (await prisma.examResult.count({ where: { examId: E1.exam.id, userId: s2.id } })) === 0);
  const rOther = await api("GET", `/api/exams/attempts/${B.id}/review`, { as: s1 });
  check("học sinh khác xem bài của B → 404", rOther.status === 404);

  section("Kiểm tra điểm trước khi lưu (đầu vào xấu)");
  const bad = async (grades: unknown) => (await api("POST", `${base}/attempts/${A.id}`, { as: T, body: { grades } })).status;
  check("vượt tối đa / âm / chữ / rỗng / thiếu / trùng câu / câu trắc nghiệm → 400", [
    await bad([{ questionId: E1.q3.id, points: 2.5 }]), await bad([{ questionId: E1.q3.id, points: -1 }]), await bad([{ questionId: E1.q3.id, points: "abc" }]),
    await bad([{ questionId: E1.q3.id, points: "" }]), await bad([]), await bad("x"), await bad([{ questionId: E1.q3.id, points: 1 }, { questionId: E1.q3.id, points: 1 }]),
    await bad([{ questionId: E1.q1.id, points: 1 }]), await bad([{ questionId: "khong-co", points: 1 }]),
  ].every(c => c === 400));
  check("lô có một câu xấu thì KHÔNG ghi câu tốt nào (A vẫn chưa chấm)", (await prisma.examAnswer.findFirst({ where: { attemptId: A.id, questionId: E1.q3.id } }))?.pointsAwarded === null);
  check("nhận xét quá dài → 400", await bad([{ questionId: E1.q3.id, points: 1, comment: "a".repeat(2001) }]) === 400);

  section("Công bố: không công bố bài chưa chấm; từng em; cả lô; không công bố đôi");
  const pA = await api("POST", `${base}/publish`, { as: T, body: { attemptIds: [A.id] } });
  check("công bố đúng bài A (còn tự luận chờ) → 409, nêu lý do, không có dòng công bố", pA.status === 409 && /chưa chấm/.test(pA.json.error) && (await prisma.examAttemptPublish.count({ where: { attemptId: A.id } })) === 0, pA.json);
  const pC = await api("POST", `${base}/publish`, { as: T, body: { attemptIds: [C.id] } });
  check("công bố từng em C → ok", pC.status === 200 && pC.json.published.length === 1 && pC.json.published[0] === C.id, pC.json);
  const rc = await api("GET", `/api/exams/attempts/${C.id}/review`, { as: s3 });
  const ec = rc.json.questions.find((q: any) => q.type === "ESSAY");
  check("sau công bố: C thấy score 5 (raw 2/4 → 5), held false, điểm + nhận xét tự luận, đáp án", rc.json.score === 5 && rc.json.held === false && ec.pointsAwarded === 2 && ec.teacherComment === "tốt" && rc.json.canSeeAnswers === true, { s: rc.json.score, h: rc.json.held, ec });
  check("sau công bố: C vào bảng xếp hạng đúng một lần, participants +1", (await prisma.examResult.count({ where: { examId: E1.exam.id, userId: s3.id } })) === 1 && (await prisma.exam.findUnique({ where: { id: E1.exam.id } }))?.participants === 1);
  const pC2 = await api("POST", `${base}/publish`, { as: T, body: { attemptIds: [C.id] } });
  check("công bố lại C: không đôi (published rỗng, alreadyPublished có C)", pC2.status === 200 && pC2.json.published.length === 0 && pC2.json.alreadyPublished[0] === C.id && (await prisma.examAttemptPublish.count({ where: { attemptId: C.id } })) === 1, pC2.json);
  const pAll = await api("POST", `${base}/publish`, { as: T, body: {} });
  check("cả lô: B và D (đã chấm xong) được công bố; A bị bỏ qua có lý do; C đã công bố", pAll.json.published.sort().join() === [B.id, D.id].sort().join() && pAll.json.skipped.length === 1 && pAll.json.skipped[0].id === A.id && pAll.json.alreadyPublished.includes(C.id), pAll.json);
  const rb = await api("GET", `/api/exams/attempts/${B.id}/review`, { as: s2 });
  check("B sau công bố thấy score 8,75 và nhận xét", rb.json.score === 8.75 && rb.json.questions.find((q: any) => q.type === "ESSAY").teacherComment === SECRET);
  const rA = await api("GET", `/api/exams/attempts/${A.id}/review`, { as: s1 });
  check("A (chưa công bố) vẫn không thấy gì", rA.json.score === null && rA.json.held === true);
  check("publish body sai → 400", (await api("POST", `${base}/publish`, { as: T, body: { attemptIds: "x" } })).status === 400 && (await api("POST", `${base}/publish`, { as: T, body: { attemptIds: [] } })).status === 400);

  section("Sửa điểm có lịch sử (chỉ thêm, có điểm cũ → mới)");
  const g1 = await api("POST", `${base}/attempts/${B.id}`, { as: T, body: { grades: [{ questionId: E1.q3.id, points: 1.5, comment: SECRET }] } });
  check("lưu lại y hệt → changed 0 và KHÔNG thêm dòng lịch sử", g1.json.changed === 0);
  const g2 = await api("POST", `${base}/attempts/${B.id}`, { as: T, body: { grades: [{ questionId: E1.q3.id, points: 2, comment: "Sửa lại cho đủ điểm" }] } });
  check("đổi 1,5 → 2: changed 1, điểm quy đổi cập nhật 10 (đã công bố nên học sinh thấy)", g2.json.changed === 1 && g2.json.score === 10 && (await api("GET", `/api/exams/attempts/${B.id}/review`, { as: s2 })).json.score === 10, g2.json);
  const edits = await prisma.examGradeEdit.findMany({ where: { attemptId: B.id }, orderBy: { createdAt: "asc" } });
  check("lịch sử B: 2 dòng (null→1,5 rồi 1,5→2), có người sửa", edits.length === 2 && edits[0].prevPoints === null && edits[0].newPoints === 1.5 && edits[1].prevPoints === 1.5 && edits[1].newPoints === 2 && edits[1].editedById === T.id, edits);
  const hist = (await api("GET", `${base}/history`, { as: T })).json;
  check("API lịch sử: có công bố và sửa điểm, có tên (chỉ gia sư chủ)", hist.publishes.length === 3 && hist.edits.length >= 3 && hist.edits.every((e: any) => typeof e.studentName === "string" && e.studentName.length > 0), { p: hist.publishes.length, e: hist.edits.length });
  check("điểm tự luận cũng có kiểm toán (exam_answer.grade)", (await prisma.auditLog.count({ where: { action: "exam_answer.grade" } })) >= 3);

  section("Phân tích (QZ-06): số hiển thị KHỚP truy vấn gốc, không tên");
  const st = (await api("GET", `${base}/thong-ke`, { as: T })).json;
  const atts = await prisma.examAttempt.findMany({ where: { examId: E1.exam.id } });
  const pend = new Set((await prisma.examAnswer.findMany({ where: { attempt: { examId: E1.exam.id }, question: { type: "ESSAY" }, pointsAwarded: null, textAnswer: { not: null } } })).map(a => a.attemptId));
  const counted = atts.filter(a => a.status !== "in_progress" && !pend.has(a.id));
  const manualAvg = Math.round((counted.reduce((s, a) => s + (a.score ?? 0) / 10 * 100, 0) / counted.length) * 100) / 100;
  check("lượt nộp / lượt tính điểm / trung bình % khớp truy vấn gốc", st.submittedCount === atts.length && st.scoredCount === counted.length && st.avgPercent === manualAvg, { st: [st.submittedCount, st.scoredCount, st.avgPercent], manualAvg });
  check("đối chiếu số tay: B=100%, C=50%, D=25%; A còn chờ nên chưa tính → 3 lượt, trung bình 58,33", counted.length === 3 && manualAvg === 58.33 && st.avgPercent === 58.33 && st.maxPercent === 100 && st.minPercent === 25 && st.waitingCount === 1, { manualAvg, max: st.maxPercent, min: st.minPercent, w: st.waitingCount });
  const rawCorrect = async (qid: string) => prisma.examAnswer.count({ where: { questionId: qid, attempt: { examId: E1.exam.id, status: { not: "in_progress" } }, option: { isCorrect: true } } });
  const sq1 = st.questions.find((q: any) => q.questionId === E1.q1.id), sq2 = st.questions.find((q: any) => q.questionId === E1.q2.id);
  check("tỉ lệ đúng câu 1 và câu 2 khớp đếm trực tiếp từ ExamAnswer × ExamOption", sq1.correct === (await rawCorrect(E1.q1.id)) && sq2.correct === (await rawCorrect(E1.q2.id)) && sq1.counted === 4, { sq1, sq2 });
  check("số trong phân tích KHÔNG chứa tên hay mã học sinh", !/Em (Một|Hai|Ba|Bốn)/.test(JSON.stringify(st)) && !JSON.stringify(st).includes(s1.id));
  check("phân bố cộng lại đúng số lượt tính điểm", st.distribution.reduce((s: number, b: any) => s + b.count, 0) === st.scoredCount);
  const tr = (await api("GET", `${base}/theo-doi`, { as: T })).json;
  check("theo dõi: 4 học sinh, mỗi em 1 lượt, có tên (chỉ gia sư chủ)", tr.students.length === 4 && tr.students.every((s: any) => s.attemptCount === 1) && tr.students.some((s: any) => s.name === "Em Một"), tr.students);
  check("đề chưa gắn lớp → 'chưa biết ai chưa làm' (enrolledKnown false)", tr.enrolledKnown === false && tr.notStarted.length === 0);

  section("Danh sách Bài tập của gia sư: đề có bài chờ chấm hiện 'Chờ chấm'");
  const bt = (await api("GET", "/api/tutor/bai-tap", { as: T })).json;
  const it = bt.items.find((i: any) => i.id === E1.exam.id);
  check("đề E1 còn A chờ chấm → nhóm 'cho', 1 bài chờ", it && it.group === "cho" && it.ungraded === 1 && it.statusLabel === "Chờ chấm", it);
  await api("POST", `${base}/attempts/${A.id}`, { as: T, body: { grades: [{ questionId: E1.q3.id, points: 0 }] } });
  const bt2 = (await api("GET", "/api/tutor/bai-tap", { as: T })).json.items.find((i: any) => i.id === E1.exam.id);
  check("chấm A 0 điểm (0 ≠ chưa chấm) → hết chờ chấm", bt2.ungraded === 0 && bt2.group !== "cho", bt2);

  // API chấm một câu có sẵn (màn admin cũ) cũng ghi lịch sử
  const old = await api("PATCH", `/api/exams/attempts/${A.id}/answers/${E1.q3.id}/grade`, { as: T, body: { points: 1, comment: "chấm bằng route cũ" } });
  check("route chấm cũ vẫn chạy và cũng ghi lịch sử (A: null→0 rồi 0→1)", old.status === 200 && (await prisma.examGradeEdit.count({ where: { attemptId: A.id } })) === 2);

  section("Đề không có tự luận: không có gì bị giữ");
  const eid = id("ex2");
  await prisma.exam.create({ data: { id: eid, code: eid, title: "Chỉ trắc nghiệm", category: "toan", date: "01/01/2030", time: "08:00", duration: "30 phút", questions: 1, status: "available", createdAt: "2026-01-01", ownerId: T.id, totalPoints: 10 } });
  const qq = await prisma.examQuestion.create({ data: { id: id("q"), examId: eid, order: 1, text: "MC", type: "MC", points: 1 } });
  const oo = await prisma.examOption.create({ data: { id: id("o"), questionId: qq.id, order: 0, text: "đ", isCorrect: true } });
  const at = await prisma.examAttempt.create({ data: { userId: s1.id, examId: eid, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", totalPoints: 1 } });
  await prisma.examAnswer.create({ data: { attemptId: at.id, questionId: qq.id, optionId: oo.id } });
  await regradeAttempt(at.id);
  const rr = await api("GET", `/api/exams/attempts/${at.id}/review`, { as: s1 });
  check("đề cũ chỉ trắc nghiệm: học sinh thấy điểm 10 ngay", rr.json.score === 10 && rr.json.held === false, rr.json);

  await done();
})();
