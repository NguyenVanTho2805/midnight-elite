// SCL-G-GS — dữ liệu giả cho màn gia sư theo bản chốt: một bài nộp chờ chấm, một điểm tự khai chờ duyệt, một học sinh xin vào lớp và một buổi tới chưa có video
// ở lớp đầu của gia sư chính ⇒ thấy ngay khối "Cần bạn xử lý", cột "Nộp x/y", Hộp việc (máy tính + điện thoại). Chạy lặp lại được (id cố định / upsert).
import type { MockFn } from "../mock-seed";

const mock: MockFn = async ({ prisma, tutor, student }) => {
  const course = await prisma.course.findFirst({ where: { ownerId: tutor.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (!course) return ["SCL-G-GS: gia sư chính chưa có lớp nên chưa dựng dữ liệu."];
  await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: course.id } }, update: {}, create: { userId: student.id, courseId: course.id, status: "active" } });
  const sec = await prisma.section.upsert({ where: { id: `sclg-s-${course.id}` }, update: {}, create: { id: `sclg-s-${course.id}`, title: "Thử SCL-G", courseId: course.id, order: 96 } });
  const ch = await prisma.chapter.upsert({ where: { id: `sclg-c-${course.id}` }, update: {}, create: { id: `sclg-c-${course.id}`, title: "Chương thử · Hệ phương trình", sectionId: sec.id, order: 0 } });
  const lesson = await prisma.lesson.upsert({ where: { id: `sclg-l-${course.id}` }, update: {}, create: {
    id: `sclg-l-${course.id}`, code: "sclg", title: "Buổi thử: Hệ phương trình bậc nhất", type: "document", chapterId: ch.id, order: 0, isLocked: false, isFree: false, status: "published", documents: "[]",
    scheduledAt: new Date(Date.now() + 2 * 86_400_000),
  } });
  const asg = await prisma.assignment.findFirst({ where: { lessonId: lesson.id } }) ?? await prisma.assignment.create({ data: { lessonId: lesson.id, title: "Bài tập buổi thử", mode: "file", ownerId: tutor.id } });
  if (!(await prisma.assignmentSubmission.findFirst({ where: { assignmentId: asg.id, userId: student.id } }))) {
    await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: student.id, fileUrl: "https://example.com/bai-lam-thu.pdf", kind: "link" } });
  }
  const examId = `sclg-az-${course.id}`;
  await prisma.exam.upsert({ where: { id: examId }, update: {}, create: { id: examId, code: `SCLG${course.id.slice(-6)}`, title: "Đề Azota thử (SCL-G)", category: "toan", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-11-21", azotaUrl: "https://azota.vn/thu", totalPoints: 10, courseId: course.id, ownerId: tutor.id } as never });
  await prisma.examResult.upsert({ where: { userId_examId: { userId: student.id, examId } }, update: {}, create: { userId: student.id, examId, score: 7.5, totalPoints: 10, pendingReview: true } });
  const ha = await prisma.user.upsert({ where: { email: "thu-ha-sclg@test.local" }, update: {}, create: { email: "thu-ha-sclg@test.local", name: "Lê Thu Hà (thử)", password: "x", role: "student", emailVerified: false } });
  await prisma.classJoinRequest.upsert({ where: { userId_courseId: { userId: ha.id, courseId: course.id } }, update: { status: "pending" }, create: { userId: ha.id, courseId: course.id } });
  return [
    `SCL-G-GS · ${tutor.email} (1280): /lop-cua-toi/quan-lop/${course.id} → thanh bên "Hộp việc" có số, "Lớp của bạn"; đầu cột trái "Cần bạn xử lý" 3 hàng; ngăn "Sửa bài" luôn mở bên phải, tự lưu.`,
    `SCL-G-GS · ${tutor.email}: /lop-cua-toi/hop-viec → gom theo lớp (Bài chờ chấm / Điểm chờ duyệt / Xin vào lớp / Buổi tới chưa có video); điện thoại 390: duyệt, chấm, nhận học sinh ngay tại chỗ, thanh dưới Hộp việc / Lớp / Tôi.`,
  ];
};
export default mock;
