// QZ-08 / QZ-06 — dữ liệu giả: một quiz hỗn hợp (8 trắc nghiệm + 1 tự luận 2 điểm, giữ điểm đến khi công bố) của giasu@kin.local với 4 học sinh thử:
// hai bài đang CHỜ CHẤM (tự luận chưa chấm), một bài ĐÃ CHẤM chưa công bố, một bài ĐÃ CÔNG BỐ; thêm một học sinh trong lớp chưa làm.
// Chỉ tên thử rõ ràng. Chạy lại không nhân đôi (đề có id cố định).
import type { MockFn } from "../mock-seed";
import { mkUser } from "../h";
import { regradeAttempt } from "@/lib/examGrading";

const ID = "qz08-mix";

const mock: MockFn = async ({ prisma, tutor, tw }) => {
  if (await prisma.exam.findUnique({ where: { id: ID } })) return ["Quiz hỗn hợp thử (QZ-08) đã có sẵn từ lần nạp trước."];

  const exam = await prisma.exam.create({
    data: { id: ID, code: "QZ08MIX", title: "Ôn tập tổng hợp · Toán 9 (thử chấm quiz)", category: "toan", date: "01/01/2030", time: "19:00", duration: "45 phút", questions: 9, status: "available", createdAt: new Date().toISOString(), totalPoints: 10, ownerId: tutor.id, courseId: tw.c1.id },
  });
  const mcIds: string[] = [], correct: string[] = [], wrong: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const q = await prisma.examQuestion.create({ data: { id: `${ID}-q${i}`, examId: exam.id, order: i, text: `Câu trắc nghiệm ${i}: chọn đáp án đúng.`, points: 1, type: "MC" } });
    const ok = await prisma.examOption.create({ data: { id: `${ID}-q${i}-ok`, questionId: q.id, order: 0, text: "Đáp án đúng", isCorrect: true } });
    const no = await prisma.examOption.create({ data: { id: `${ID}-q${i}-no`, questionId: q.id, order: 1, text: "Đáp án sai", isCorrect: false } });
    mcIds.push(q.id); correct.push(ok.id); wrong.push(no.id);
  }
  const essay = await prisma.examQuestion.create({
    data: { id: `${ID}-q9`, examId: exam.id, order: 9, text: "Giải x² − 5x + 6 = 0 bằng phân tích nhân tử; kiểm tra nghiệm.", points: 2, type: "ESSAY", explanation: "(x − 2)(x − 3) = 0 ⇒ x ∈ {2; 3}. Thử x = 2: 4 − 10 + 6 = 0. Thử x = 3: 9 − 15 + 6 = 0." },
  });
  await prisma.examPublishPolicy.create({ data: { examId: exam.id, holdUntilPublish: true, updatedById: tutor.id } });

  const mk = async (name: string, rightCount: number, essayText: string, grade?: { points: number; comment: string }, publish = false) => {
    const u = await mkUser({ name });
    await prisma.enrollment.create({ data: { userId: u.id, courseId: tw.c1.id, status: "active" } }).catch(() => {});
    const a = await prisma.examAttempt.create({
      data: { userId: u.id, examId: exam.id, startedAt: new Date(Date.now() - 3_600_000), expiresAt: new Date(Date.now() + 3_600_000), submittedAt: new Date(Date.now() - 1_800_000), status: "submitted", totalPoints: 10, tabSwitchCount: name.includes("B") ? 2 : 0 },
    });
    for (let i = 0; i < 8; i++) await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: mcIds[i], optionId: i < rightCount ? correct[i] : wrong[i] } });
    await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: essay.id, textAnswer: essayText, ...(grade ? { pointsAwarded: grade.points, teacherComment: grade.comment } : {}) } });
    if (grade) await prisma.examGradeEdit.create({ data: { examId: exam.id, attemptId: a.id, questionId: essay.id, editedById: tutor.id, prevPoints: null, newPoints: grade.points, prevComment: null, newComment: grade.comment } });
    if (publish) await prisma.examAttemptPublish.create({ data: { attemptId: a.id, examId: exam.id, publishedById: tutor.id } });
    await regradeAttempt(a.id);
  };
  const work = "x² − 5x + 6 = 0\n⇔ (x − 2)(x − 3) = 0\n⇒ x = 2 hoặc x = 3.";
  await mk("Học sinh Thử A", 6, work);
  await mk("Học sinh Thử B", 7, work);
  await mk("Học sinh Thử C", 5, work + "\nThử lại: x = 2 → 0; x = 3 → 0.", { points: 1.5, comment: "Phân tích đúng. Bổ sung bước thử lại cả hai nghiệm." });
  await mk("Học sinh Thử D", 8, work + "\nThử lại đủ.", { points: 2, comment: "Trình bày gọn, đủ bước." }, true);
  const idle = await mkUser({ name: "Học sinh Thử E (chưa làm)" });
  await prisma.enrollment.create({ data: { userId: idle.id, courseId: tw.c1.id, status: "active" } }).catch(() => {});

  return [
    `Chấm quiz hỗn hợp (QZ-08) · đăng nhập ${tutor.email} → /lop-cua-toi/bai-tap → mục "Ôn tập tổng hợp · Toán 9 (thử chấm quiz)" (Chờ chấm, 2 bài) → "Chấm và theo dõi": 2 bài Chờ chấm, 1 Đã chấm, 1 Đã công bố; thử chấm, lưu, công bố từng em hoặc cả lô.`,
    `Theo dõi và phân tích (QZ-06) · cùng đề, tab "Theo dõi lượt làm" (4 học sinh làm, 1 chưa làm) và "Phân tích kết quả" (phân bố điểm, tỉ lệ đúng từng câu). Học sinh Thử A/B/C/D đều là tài khoản thử (mật khẩu chung Passw0rd!, email tự sinh).`,
  ];
};
export default mock;
