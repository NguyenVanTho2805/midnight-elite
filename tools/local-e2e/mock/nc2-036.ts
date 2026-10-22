// NC2-036 — dữ liệu giả cho Coin thưởng làm bài. Dựng một quiz 3 câu, 10 phút, miễn phí, của gia sư chính.
// Học sinh hocsinh@kin.local làm xong: đúng từ 50% được 5 Coin; đúng từ 80% và nộp trong nửa thời gian (tối thiểu 30 giây) được thêm 5 Coin.
import type { MockFn } from "../mock-seed";

const MOCK_EXAM_ID = "mock-quiz-coin";

const mock: MockFn = async ({ prisma, tutor, student }) => {
  if (!(await prisma.exam.findUnique({ where: { id: MOCK_EXAM_ID }, select: { id: true } }))) {
    await prisma.exam.create({
      data: {
        id: MOCK_EXAM_ID, code: MOCK_EXAM_ID, title: "Quiz nhanh thưởng Coin (3 câu)", category: "Toán", date: "01/01/2026", time: "08:00",
        duration: "10 phút", questions: 3, status: "available", createdAt: "2026-01-01", ownerId: tutor.id, totalPoints: 30, active: true,
      },
    });
    const bank = [
      ["2 + 3 = ?", "5", ["4", "6", "7"]],
      ["Số nào chia hết cho 3?", "12", ["10", "11", "14"]],
      ["Hình vuông có mấy cạnh?", "4", ["3", "5", "6"]],
    ] as const;
    for (let i = 0; i < bank.length; i++) {
      const qid = `${MOCK_EXAM_ID}-q${i + 1}`;
      await prisma.examQuestion.create({ data: { id: qid, examId: MOCK_EXAM_ID, order: i + 1, text: bank[i][0], type: "MC", points: 10 } });
      await prisma.examOption.create({ data: { id: `${qid}-ok`, questionId: qid, order: 0, text: bank[i][1], isCorrect: true } });
      for (let j = 0; j < bank[i][2].length; j++) await prisma.examOption.create({ data: { id: `${qid}-x${j}`, questionId: qid, order: j + 1, text: bank[i][2][j], isCorrect: false } });
    }
  }
  return [
    `Coin thưởng làm bài · đăng nhập ${student.email}, mở /student/vi xem số dư, rồi vào đề "Quiz nhanh thưởng Coin (3 câu)" (mã ${MOCK_EXAM_ID}) và làm: đúng từ 2/3 câu → +5 Coin; đúng cả 3 câu và nộp sau ít nhất 30 giây nhưng trong vòng 5 phút → +10 Coin. Làm lại cùng đề không thưởng thêm; tối đa 5 lượt thưởng mỗi ngày.`,
    `Học sinh mở /student/vi: KHÔNG còn form "Yêu cầu nạp Coin" (Coin học sinh chỉ nhận từ làm bài). Gia sư (${tutor.email}) vẫn nạp để mua VIP khi cờ chạy thử tắt.`,
  ];
};
export default mock;
