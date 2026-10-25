// PT-05 — dữ liệu GIẢ cho Sổ điểm và tiến bộ (/lop-cua-toi/so-diem): gắn 3 bài kiểm tra thử (một bài tháng trước, hai bài tháng này,
// kèm một bài quiz đang GIỮ điểm chưa công bố — không được tính) cho các em đang học lớp của gia sư giasu@kin.local. Chạy lặp lại được.
import type { MockFn } from "../mock-seed";

const mock: MockFn = async ({ prisma, tutor }) => {
  const course = await prisma.course.findFirst({ where: { ownerId: tutor.id, enrollments: { some: { status: "active" } } }, select: { id: true, name: true, enrollments: { where: { status: "active" }, select: { userId: true }, take: 3 } } });
  if (!course) return ["PT-05: gia sư thử chưa có lớp nào có học sinh, bỏ qua."];
  const now = Date.now();
  const defs: Array<[string, number, number, boolean]> = [["PT05-A", 8, 2, false], ["PT05-B", 9, 5, false], ["PT05-C", 6, -35, false], ["PT05-HELD", 10, 1, true]];
  for (const [code, score, daysAgo, held] of defs) {
    const exam = await prisma.exam.upsert({
      where: { code }, update: {},
      create: { id: `ex-${code.toLowerCase()}`, code, title: `Bài kiểm tra thử ${code}`, category: "toan", date: "2026-10-01", time: "08:00", duration: "45", questions: 1, status: "completed", createdAt: "2026-01-01", courseId: course.id, ownerId: tutor.id },
    });
    if (held) await prisma.examPublishPolicy.upsert({ where: { examId: exam.id }, update: {}, create: { examId: exam.id, holdUntilPublish: true } });
    for (const e of course.enrollments) {
      await prisma.examResult.upsert({ where: { userId_examId: { userId: e.userId, examId: exam.id } }, update: {}, create: { userId: e.userId, examId: exam.id, score, totalPoints: 10, completedAt: new Date(now - daysAgo * 86_400_000) } });
    }
  }
  return [`PT-05 · giasu@kin.local → /lop-cua-toi/so-diem: lớp ${course.name} có ${course.enrollments.length} em với 3 bài kiểm tra thử; bài PT05-HELD (10/10) đang giữ điểm nên KHÔNG hiện trong điểm.`];
};
export default mock;
