// SCL-C — dữ liệu GIẢ cho duyệt điểm tự khai: một đề Azota thử của lớp có học sinh của giasu@kin.local, học sinh thử đã tự khai điểm (CHỜ DUYỆT). Chạy lặp lại được.
import type { MockFn } from "../mock-seed";

const mock: MockFn = async ({ prisma, tutor, student }) => {
  const course = await prisma.course.findFirst({ where: { ownerId: tutor.id, enrollments: { some: { userId: student.id, status: "active" } } }, select: { id: true, name: true } });
  if (!course) return ["SCL-C: học sinh thử chưa học lớp nào của gia sư thử, bỏ qua."];
  const exam = await prisma.exam.upsert({
    where: { code: "SCLC-AZ" }, update: {},
    create: { id: "ex-sclc-az", code: "SCLC-AZ", title: "Đề Azota thử (tự khai)", category: "toan", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-11-21", azotaUrl: "https://azota.vn/de-thu", totalPoints: 10, courseId: course.id, ownerId: tutor.id },
  });
  await prisma.examResult.upsert({ where: { userId_examId: { userId: student.id, examId: exam.id } }, update: { pendingReview: true }, create: { userId: student.id, examId: exam.id, score: 7, totalPoints: 10, pendingReview: true } });
  return [
    `SCL-C · giasu@kin.local → /lop-cua-toi/so-diem?lop=${course.id}: ô "Chờ duyệt" 7/10 của đề Azota thử, có Duyệt / Sửa điểm / Từ chối.`,
    `SCL-C · học sinh thử → /student/diem và tab Kết quả của lớp ${course.name}: đề Azota thử ghi "Chờ gia sư duyệt".`,
  ];
};
export default mock;
