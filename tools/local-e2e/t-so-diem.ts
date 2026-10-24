import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnMonthKey } from "@/lib/revenue";

let n = 0;
async function mkExam(courseId: string, ownerId: string) {
  n++;
  return prisma.exam.create({ data: { id: `ex-sd-${Date.now()}-${n}`, code: `SD${Date.now()}${n}`, title: `Bài kiểm tra ${n}`, category: "toan", date: "2026-10-01", time: "08:00", duration: "45", questions: 1, status: "completed", createdAt: "2026-01-01", courseId, ownerId } });
}
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác"), sup = await mkSuper("Admin");
  const s1 = await mkUser({ name: "Bé Gia Bảo" }), s2 = await mkUser({ name: "Bé Đỗ Hà" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), x1 = await mkCourse(T2.id, { name: "Hoá 9" });
  for (const [u, c] of [[s1, c1], [s2, c1], [s1, x1]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  const ym = vnMonthKey(new Date());
  const monthStart = new Date(`${ym}-01T00:00:00+07:00`);
  const prevMid = new Date(monthStart.getTime() - 5 * 86400000);

  // Chuyên cần: 1 buổi có mặt trong tháng này cho s1, s2 vắng
  const sess = await prisma.attendanceSession.create({ data: { courseId: c1.id, date: new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)), createdBy: T.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: sess.id, userId: s1.id, status: "present" } });
  await prisma.attendanceRecord.create({ data: { sessionId: sess.id, userId: s2.id, status: "absent" } });

  // Điểm: A (không giữ) 8/10 tháng này; C (không giữ) 5/10 tháng trước; B (GIỮ, chưa công bố) 10/10 tháng này
  const A = await mkExam(c1.id, T.id), B = await mkExam(c1.id, T.id), C = await mkExam(c1.id, T.id);
  await prisma.examResult.create({ data: { userId: s1.id, examId: A.id, score: 8, totalPoints: 10, completedAt: new Date() } });
  await prisma.examResult.create({ data: { userId: s1.id, examId: C.id, score: 5, totalPoints: 10, completedAt: prevMid } });
  await prisma.examResult.create({ data: { userId: s1.id, examId: B.id, score: 10, totalPoints: 10, completedAt: new Date() } });
  await prisma.examPublishPolicy.create({ data: { examId: B.id, holdUntilPublish: true } });
  // Điểm của lớp gia sư khác không được lẫn vào
  const X = await mkExam(x1.id, T2.id);
  await prisma.examResult.create({ data: { userId: s1.id, examId: X.id, score: 1, totalPoints: 10, completedAt: new Date() } });

  section("Quyền");
  check("ẩn danh 401", (await api("GET", "/api/tutor/so-diem")).status === 401);
  check("học viên 403", (await api("GET", "/api/tutor/so-diem", { as: s1 })).status === 403);
  check("admin_super 403", (await api("GET", "/api/tutor/so-diem", { as: sup })).status === 403);
  check("lớp của gia sư khác → 403", (await api("GET", `/api/tutor/so-diem?courseId=${c1.id}`, { as: T2 })).status === 403);
  check("lớp không tồn tại → 404", (await api("GET", "/api/tutor/so-diem?courseId=khong-co", { as: T })).status === 404);
  check("tháng sai định dạng → 400", (await api("GET", "/api/tutor/so-diem?yearMonth=abc", { as: T })).status === 400);
  check("tháng chưa tới → 400", (await api("GET", "/api/tutor/so-diem?yearMonth=2099-01", { as: T })).status === 400);

  section("Số liệu của gia sư chủ lớp");
  const r = await api("GET", "/api/tutor/so-diem", { as: T });
  check("200", r.status === 200, r.json);
  const rows = r.json.rows as any[];
  const g = rows.find(x => x.studentId === s1.id), h = rows.find(x => x.studentId === s2.id);
  check("2 dòng (s1, s2) ở Toán 9; s1 KHÔNG có dòng Hoá 9 của gia sư khác", rows.length === 2 && rows.every(x => x.courseId === c1.id), rows.map(x => x.courseName));
  check("chuyên cần s1 = 100%, s2 = 50% (vắng có hệ số 0,5 theo computeAttendanceStats)", g.attendance.ratio === 1 && h.attendance.ratio === 0.5, [g.attendance, h.attendance]);
  check("điểm tự luận chưa công bố (10/10 đề B) KHÔNG tính; chỉ còn 8 (đề A) tháng này", g.mastery.scores.includes(8) && !g.mastery.scores.includes(10) && !g.mastery.scores.includes(1), g.mastery);
  check("s2 chưa có điểm → null, không ghi 0", h.mastery.value === null && h.progress.code === "chua-so-sanh", h);
  check("tiến bộ: tháng trước có điểm 5 → có so sánh (không 'chưa so sánh')", g.progress.code !== "chua-so-sanh", g.progress);
  check("tóm tắt lớp: 2 học sinh, 1 em có điểm", r.json.classes.length === 1 && r.json.classes[0].students === 2 && r.json.classes[0].masteryCount === 1, r.json.classes);
  check("điểm lớp gia sư khác (1/10) không lọt vào", !JSON.stringify(r.json).includes('"scores":[1'));

  section("Công bố điểm B → mới được tính");
  const att = await prisma.examAttempt.create({ data: { userId: s1.id, examId: B.id, expiresAt: new Date(), status: "submitted", score: 10, totalPoints: 10 } });
  await prisma.examAttemptPublish.create({ data: { attemptId: att.id, examId: B.id, publishedById: T.id } });
  const r2 = await api("GET", "/api/tutor/so-diem", { as: T });
  check("sau công bố, 10 xuất hiện trong điểm của s1", (r2.json.rows as any[]).find(x => x.studentId === s1.id).mastery.scores.includes(10), r2.json.rows);

  section("Lọc lớp + tách quyền xem tên");
  const f = await api("GET", `/api/tutor/so-diem?courseId=${c1.id}`, { as: T });
  check("lọc đúng lớp của mình: 200 và 2 dòng", f.status === 200 && f.json.rows.length === 2);
  const o = await api("GET", "/api/tutor/so-diem", { as: T2 });
  check("gia sư khác chỉ thấy học sinh trong lớp của mình, không có Bé Đỗ Hà", o.status === 200 && !JSON.stringify(o.json).includes("Đỗ Hà") && o.json.rows.every((x: any) => x.courseId === x1.id), o.json.rows);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
