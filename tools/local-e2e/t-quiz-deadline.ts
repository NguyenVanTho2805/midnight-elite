// QZ — API hạn nộp riêng từng học sinh. Cần máy chủ dev đang chạy ở BASE; gọi wipe() trên DB riêng.
// Trọng tâm: (1) chỉ gia sư chủ đề đặt/xem/bỏ; gia sư khác, học sinh, admin tổng, chưa đăng nhập bị chặn; (2) chỉ học sinh trong LỚP CỦA CÔ,
// học sinh ngoài lớp → 403 và không có dòng nào được ghi; (3) hạn riêng KHÔNG đổi lịch chung của đề (Exam.date/time/duration/active nguyên vẹn);
// (4) học sinh quá hạn riêng không mở được lượt mới (/start 409 past_deadline, /gate nói rõ), lượt đang làm dở vẫn tiếp tục, em khác không bị ảnh hưởng;
// (5) mỗi lần đặt/bỏ có dòng nhật ký, không chứa tên học sinh; (6) gate không lộ hạn của em khác.
import { api, mkTutor, mkUser, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const stamp = Date.now().toString(36);
let seq = 0;
const id = (p: string) => `${p}-${stamp}-${++seq}`;
const vnKey = (offsetDays: number) => new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác"), SU = await mkSuper("Admin");
  const s1 = await mkUser({ name: "Em Một" }), s2 = await mkUser({ name: "Em Hai" }), s3 = await mkUser({ name: "Em Ngoài Lớp" });
  const course = await mkCourse(T.id, { name: "Lớp của cô Lan" });
  const course2 = await mkCourse(T2.id, { name: "Lớp cô Khác" });
  for (const s of [s1, s2]) await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: s3.id, courseId: course2.id, status: "active" } });

  const eid = id("quiz");
  const exam = await prisma.exam.create({ data: { id: eid, code: eid, title: "Quiz hạn riêng", category: "Quiz", date: "01/01/2026", time: "08:00", duration: "45 phút", questions: 1, status: "available", createdAt: "2026-01-01", ownerId: T.id, courseId: course.id, totalPoints: 1 } });
  const q = await prisma.examQuestion.create({ data: { id: id("q"), examId: eid, order: 1, text: "1+1=?", type: "MC", points: 1 } });
  await prisma.examOption.create({ data: { id: id("o"), questionId: q.id, order: 0, text: "2", isCorrect: true } });
  await prisma.examOption.create({ data: { id: id("o"), questionId: q.id, order: 1, text: "3", isCorrect: false } });
  const eidOther = id("quiz");
  await prisma.exam.create({ data: { id: eidOther, code: eidOther, title: "Quiz cô khác", category: "Quiz", date: "01/01/2026", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-01-01", ownerId: T2.id, courseId: course2.id, totalPoints: 1 } });

  const base = `/api/tutor/quiz-cham/${eid}/han-rieng`;
  const tomorrow = vnKey(1), yesterday = vnKey(-1);
  const setBody = (userIds: string[], dateKey = tomorrow, time = "20:00") => ({ action: "set", userIds, dateKey, time, note: "ốm" });

  section("Quyền");
  const calls: [string, string, unknown?][] = [["GET", base], ["POST", base, setBody([s1.id])], ["POST", base, { action: "clear", userIds: [s1.id] }]];
  const codes = async (as: Awaited<ReturnType<typeof mkUser>> | undefined) => Promise.all(calls.map(async ([m, u, b]) => (await api(m, u, { as, body: b })).status));
  check("chưa đăng nhập → 401", (await codes(undefined)).every(c => c === 401));
  check("học sinh → 403", (await codes(s1)).every(c => c === 403));
  check("gia sư KHÁC → 403 (cả ghi)", (await codes(T2)).every(c => c === 403));
  check("admin tổng → 403 qua màn gia sư", (await codes(SU)).every(c => c === 403));
  check("đề không có → 404", (await api("GET", "/api/tutor/quiz-cham/khong-co/han-rieng", { as: T })).status === 404);
  check("sau các lần bị chặn: chưa có dòng hạn nào", (await prisma.quizStudentDeadline.count()) === 0);

  section("Danh sách = đúng học sinh trong lớp của cô");
  const g = await api("GET", base, { as: T });
  check("200, thấy 2 em trong lớp, không thấy em ngoài lớp", g.status === 200 && g.json.students.length === 2 && !JSON.stringify(g.json).includes("Em Ngoài Lớp"), g.json);
  check("chưa em nào có hạn riêng", g.json.students.every((s: { dueAt: string | null }) => s.dueAt === null));
  check("trả kèm lịch chung để gia sư thấy hạn riêng không thay nó", g.json.shared.date === "01/01/2026" && g.json.shared.duration === "45 phút");

  section("Đặt hạn riêng — kiểm đầu vào");
  const bad = async (body: unknown, code: number, name: string) => check(name, (await api("POST", base, { as: T, body })).status === code);
  await bad(setBody([s1.id], yesterday), 400, "hạn ở quá khứ → 400");
  await bad(setBody([s1.id], "2026-02-31"), 400, "ngày không có thật → 400");
  await bad(setBody([s1.id], tomorrow, "25:99"), 400, "giờ sai → 400");
  await bad(setBody([]), 400, "không chọn ai → 400");
  await bad({ action: "set", userIds: "abc", dateKey: tomorrow, time: "20:00" }, 400, "userIds không phải mảng → 400");
  await bad({ action: "xoa-het" }, 400, "action lạ → 400");
  await bad({ ...setBody([s1.id]), note: "x".repeat(201) }, 400, "ghi chú quá dài → 400");
  const out = await api("POST", base, { as: T, body: setBody([s1.id, s3.id]) });
  check("lẫn một em NGOÀI lớp → 403, KHÔNG ghi gì (kể cả em trong lớp)", out.status === 403 && (await prisma.quizStudentDeadline.count()) === 0, out.json);
  const noClass = await api("POST", `/api/tutor/quiz-cham/${eidOther}/han-rieng`, { as: T2, body: setBody([s1.id]) });
  check("em của lớp khác không đặt được vào đề của gia sư khác → 403", noClass.status === 403 && (await prisma.quizStudentDeadline.count()) === 0);

  section("Đặt thật + không đổi lịch chung");
  const before = await prisma.exam.findUnique({ where: { id: eid } });
  const okSet = await api("POST", base, { as: T, body: setBody([s1.id]) });
  check("đặt cho Em Một → 200", okSet.status === 200 && okSet.json.count === 1, okSet.json);
  const after = await prisma.exam.findUnique({ where: { id: eid } });
  check("lịch chung của đề KHÔNG đổi (date/time/duration/active/status)", before!.date === after!.date && before!.time === after!.time && before!.duration === after!.duration && before!.active === after!.active && before!.status === after!.status);
  const g2 = await api("GET", base, { as: T });
  const row1 = g2.json.students.find((s: { userId: string }) => s.userId === s1.id), row2 = g2.json.students.find((s: { userId: string }) => s.userId === s2.id);
  check("Em Một có hạn riêng + ghi chú; Em Hai vẫn theo lịch chung", !!row1.dueAt && row1.note === "ốm" && row2.dueAt === null);
  const due = new Date(row1.dueAt);
  check("hạn lưu đúng giờ VN (20:00 VN = 13:00 UTC)", due.getUTCHours() === 13 && due.getUTCMinutes() === 0, row1.dueAt);
  const again = await api("POST", base, { as: T, body: setBody([s1.id], vnKey(2), "09:30") });
  check("đặt lại cho cùng em → cập nhật, vẫn một dòng", again.status === 200 && (await prisma.quizStudentDeadline.count({ where: { examId: eid, userId: s1.id } })) === 1);
  const logs = await prisma.examChangeLog.findMany({ where: { examId: eid, kind: "deadline" } });
  check("nhật ký đề có 2 dòng 'deadline', KHÔNG chứa tên học sinh", logs.length === 2 && logs.every(l => !(l.note ?? "").includes("Em Một")) && logs.every(l => (l.note ?? "").includes("1 học sinh")), logs.map(l => l.note));
  check("audit log có hành động", (await prisma.auditLog.count({ where: { action: "quiz_deadline.set", resourceId: eid } })) === 2);

  section("Phía học sinh: quá hạn riêng thì không mở lượt mới");
  // Đẩy hạn của Em Một về quá khứ trực tiếp trong DB (API không cho đặt quá khứ).
  await prisma.quizStudentDeadline.update({ where: { examId_userId: { examId: eid, userId: s1.id } }, data: { dueAt: new Date(Date.now() - 60_000) } });
  const gate1 = await api("GET", `/api/exams/${eid}/gate`, { as: s1 });
  check("gate: Em Một bị chặn, lý do past_deadline, canStart=false", gate1.status === 200 && gate1.json.blockReason === "past_deadline" && gate1.json.canStart === false, gate1.json);
  check("gate: trả hạn của CHÍNH em đó (đã qua)", gate1.json.deadline?.state === "passed");
  const start1 = await api("POST", `/api/exams/${eid}/start`, { as: s1, body: {} });
  check("start: 409 past_deadline, câu báo nói hạn riêng", start1.status === 409 && start1.json.code === "past_deadline" && /hạn nộp riêng/i.test(start1.json.error), start1.json);
  check("start bị chặn: KHÔNG tạo lượt thi nào", (await prisma.examAttempt.count({ where: { userId: s1.id, examId: eid } })) === 0);
  const gate2 = await api("GET", `/api/exams/${eid}/gate`, { as: s2 });
  check("gate: Em Hai không bị ảnh hưởng, không thấy hạn của em khác", gate2.json.canStart === true && gate2.json.blockReason === null && gate2.json.deadline === null && !JSON.stringify(gate2.json).includes(s1.id), gate2.json);
  const start2 = await api("POST", `/api/exams/${eid}/start`, { as: s2, body: {} });
  check("start: Em Hai vào được bình thường", start2.status === 200 && !!start2.json.attemptId, start2.json);

  section("Lượt đang làm dở không bị cắt; gia hạn mở lại cửa");
  await prisma.quizStudentDeadline.create({ data: { examId: eid, userId: s2.id, dueAt: new Date(Date.now() - 60_000), setById: T.id } });
  const resume = await api("POST", `/api/exams/${eid}/start`, { as: s2, body: {} });
  check("Em Hai quá hạn riêng nhưng đang có lượt dở → vẫn tiếp tục được", resume.status === 200 && resume.json.attemptId === start2.json.attemptId, resume.json);
  const gate3 = await api("GET", `/api/exams/${eid}/gate`, { as: s2 });
  check("gate: lượt dở → canStart (tiếp tục)", gate3.json.canStart === true && gate3.json.attempts.resumable === true);
  const ext = await api("POST", base, { as: T, body: setBody([s1.id], vnKey(3)) });
  const start1b = await api("POST", `/api/exams/${eid}/start`, { as: s1, body: {} });
  check("gia sư gia hạn cho Em Một → vào được", ext.status === 200 && start1b.status === 200, start1b.json);

  section("Bỏ hạn riêng");
  const clr = await api("POST", base, { as: T, body: { action: "clear", userIds: [s1.id, s2.id] } });
  check("bỏ cho 2 em → count 2, hết dòng", clr.status === 200 && clr.json.count === 2 && (await prisma.quizStudentDeadline.count({ where: { examId: eid } })) === 0, clr.json);
  const clr2 = await api("POST", base, { as: T, body: { action: "clear", userIds: [s3.id] } });
  check("bỏ cho em ngoài lớp → 403", clr2.status === 403);
  check("nhật ký có dòng bỏ hạn", (await prisma.examChangeLog.count({ where: { examId: eid, kind: "deadline", note: { contains: "Bỏ hạn" } } })) === 1);

  section("Đề chưa gắn lớp");
  await prisma.exam.update({ where: { id: eid }, data: { courseId: null } });
  const noC = await api("POST", base, { as: T, body: setBody([s1.id]) });
  const noCg = await api("GET", base, { as: T });
  check("không gắn lớp → 409 (KiN chưa biết ai thuộc lớp), GET báo enrolledKnown=false", noC.status === 409 && noCg.json.enrolledKnown === false && noCg.json.students.length === 0, noC.json);

  await done();
})();
