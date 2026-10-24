// QZ-03/04/05/07 — dữ liệu GIẢ cho trang gia sư soạn quiz và phiên bản (/lop-cua-toi/bai-tap/quiz/…). Chạy lặp lại được (đã có thì bỏ qua).
// Dựng: (A) một quiz NHÁP đủ 5 dạng câu (nhiều đáp án, tự luận có tiêu chí); (B) một quiz ĐÃ PHÁT HÀNH có hai học sinh đã nộp (điểm cũ) kèm
// bản đề xuất v2 đổi một đáp án — để thấy ngay "không sửa đè" và trang so sánh phiên bản. Tên và dữ liệu đều là dữ liệu thử.
import type { MockFn } from "../mock-seed";

const HOUR = 3_600_000;
const dmy = (t: number) => { const [y, m, d] = new Date(t + 7 * HOUR).toISOString().slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const mc = (text: string, correct: number, points = 1, expl: string | null = null) => ({
  type: "MC", text, points, explanation: expl,
  options: ["A", "B", "C", "D"].map((t, i) => ({ text: `Phương án ${t}`, isCorrect: i === correct, subLabel: null as string | null })),
});

const mock: MockFn = async ({ prisma, tutor, tw }) => {
  if (await prisma.exam.findUnique({ where: { id: "quiz-mock-nhap" }, select: { id: true } })) return ["QZ: quiz thử đã có sẵn, bỏ qua."];
  const now = Date.now();
  const base = { category: "Quiz", date: dmy(now + 24 * HOUR), time: "19:00", duration: "15 phút", status: "upcoming", participants: 0, activeGuest: false, guestCanTake: false, createdAt: new Date().toLocaleDateString("vi-VN"), ownerId: tutor.id, courseId: tw.c1.id };

  const mkQuestions = async (examId: string, qs: ReturnType<typeof mc>[] | Array<Record<string, unknown>>) => {
    let order = 1;
    for (const q of qs as Array<{ type: string; text: string; points: number; explanation?: string | null; studentGuide?: string; graderGuide?: string; rubric?: unknown; options: { text: string; isCorrect: boolean; subLabel: string | null }[] }>) {
      await prisma.examQuestion.create({
        data: {
          id: `eq-${examId}-${order}`, examId, order: order++, type: q.type, text: q.text, points: q.points, explanation: q.explanation ?? null,
          studentGuide: q.studentGuide ?? null, graderGuide: q.graderGuide ?? null, rubric: (q.rubric ?? undefined) as never,
          options: { create: q.options.map((o, i) => ({ id: `eo-${examId}-${order}-${i}`, order: i, text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })) },
        },
      });
    }
    const agg = await prisma.examQuestion.aggregate({ where: { examId }, _count: { _all: true }, _sum: { points: true } });
    await prisma.exam.update({ where: { id: examId }, data: { questions: agg._count._all, totalPoints: agg._sum.points ?? 10 } });
  };

  // (A) Quiz nháp: 5 dạng câu
  await prisma.exam.create({ data: { ...base, id: "quiz-mock-nhap", code: "QZ.MOCK-A", title: "Quiz thử · Phương trình bậc hai (bản nháp)", active: false, isDraft: true, versionNo: 1, totalPoints: 10, questions: 0 } });
  await mkQuestions("quiz-mock-nhap", [
    mc("Phương trình $x^2 - 5x + 6 = 0$ có hai nghiệm là:", 1, 1, "Phân tích thành $(x-2)(x-3)=0$."),
    { type: "MC_MULTI", text: "Chọn tất cả các giá trị của $x$ thỏa mãn $x^2 = 4$.", points: 2, explanation: "$x = \\pm 2$.", options: [
      { text: "$x = -2$", isCorrect: true, subLabel: null }, { text: "$x = 2$", isCorrect: true, subLabel: null }, { text: "$x = 4$", isCorrect: false, subLabel: null }, { text: "$x = 0$", isCorrect: false, subLabel: null }] },
    { type: "TRUE_FALSE_CLUSTER", text: "Xét phương trình $x^2 - x - 2 = 0$.", points: 1, options: [
      { text: "Có hai nghiệm phân biệt", isCorrect: true, subLabel: "a" }, { text: "Có nghiệm $x = 1$", isCorrect: false, subLabel: "b" }, { text: "Tổng hai nghiệm bằng 1", isCorrect: true, subLabel: "c" }, { text: "Tích hai nghiệm bằng 2", isCorrect: false, subLabel: "d" }] },
    { type: "SHORT_ANSWER", text: "Biệt thức $\\Delta$ của $x^2 + 2x - 3 = 0$ bằng bao nhiêu?", points: 1, options: [{ text: "16", isCorrect: true, subLabel: null }] },
    { type: "ESSAY", text: "Giải phương trình $x^2 - 5x + 6 = 0$ bằng cách phân tích thành nhân tử. Trình bày các bước và kiểm tra nghiệm.", points: 10, studentGuide: "Viết lời giải hoặc đính kèm ảnh rõ nét. Nêu kết luận và thử lại nghiệm.",
      graderGuide: "Chấp nhận cách dùng $\\Delta$ nếu lập luận đầy đủ. Sai số tính toán ở một bước chỉ trừ trong tiêu chí tương ứng, không trừ lặp.",
      rubric: [{ name: "Phương pháp", requirement: "Phân tích đúng thành $(x-2)(x-3)$", points: 4 }, { name: "Tính toán", requirement: "Tìm $x = 2$, $x = 3$ và kiểm tra", points: 4 }, { name: "Trình bày", requirement: "Các bước rõ, đủ kết luận", points: 2 }], options: [] },
  ]);
  await prisma.exam.update({ where: { id: "quiz-mock-nhap" }, data: { totalPoints: 15 } });

  // (B) Quiz đã phát hành v1 + hai bài nộp
  await prisma.exam.create({ data: { ...base, id: "quiz-mock-v1", code: "QZ.MOCK-B", title: "Quiz thử · Kiểm tra 15 phút (đã có người làm)", active: true, isDraft: false, versionNo: 1, date: dmy(now - 24 * HOUR), status: "available" } });
  await mkQuestions("quiz-mock-v1", [mc("Câu 1. $x^2 - 5x + 6 = 0$ có hai nghiệm là:", 1), mc("Câu 2. Biệt thức $\\Delta$ của $x^2 + 2x - 3 = 0$ bằng:", 2)]);
  await prisma.exam.update({ where: { id: "quiz-mock-v1" }, data: { totalPoints: 2 } });
  for (const [u, correctN] of [[tw.s1, 2], [tw.s2, 1]] as const) {
    const qs = await prisma.examQuestion.findMany({ where: { examId: "quiz-mock-v1" }, orderBy: { order: "asc" }, include: { options: true } });
    const at = await prisma.examAttempt.create({ data: { userId: u.id, examId: "quiz-mock-v1", startedAt: new Date(now - 20 * HOUR), expiresAt: new Date(now - 20 * HOUR + 15 * 60_000), submittedAt: new Date(now - 20 * HOUR + 600_000), status: "submitted", score: correctN, totalPoints: 2 } });
    for (let i = 0; i < qs.length; i++) {
      const right = qs[i].options.find(o => o.isCorrect)!, wrong = qs[i].options.find(o => !o.isCorrect)!;
      await prisma.examAnswer.create({ data: { attemptId: at.id, questionId: qs[i].id, optionId: i < correctN ? right.id : wrong.id } });
    }
    await prisma.examResult.create({ data: { userId: u.id, examId: "quiz-mock-v1", score: correctN, totalPoints: 2, completedAt: new Date(now - 20 * HOUR + 600_000) } });
  }
  await prisma.exam.update({ where: { id: "quiz-mock-v1" }, data: { participants: 2 } });

  // v2 đề xuất: giữ câu 1, đổi đáp án đúng của câu 2, thêm câu 3
  await prisma.exam.create({ data: { ...base, id: "quiz-mock-v2", code: "QZ.MOCK-B-v2", title: "Quiz thử · Kiểm tra 15 phút (đã có người làm)", active: false, isDraft: true, rootExamId: "quiz-mock-v1", versionNo: 2, versionNote: "Câu 2 sai đáp án gốc", date: dmy(now + 24 * HOUR) } });
  await mkQuestions("quiz-mock-v2", [mc("Câu 1. $x^2 - 5x + 6 = 0$ có hai nghiệm là:", 1), mc("Câu 2. Biệt thức $\\Delta$ của $x^2 + 2x - 3 = 0$ bằng:", 3), mc("Câu 3. Tích hai nghiệm của $x^2 - 5x + 6 = 0$ bằng:", 0)]);
  await prisma.examChangeLog.createMany({ data: [
    { examId: "quiz-mock-v1", rootExamId: null, actorId: tutor.id, kind: "publish", note: "Phát hành quiz", createdAt: new Date(now - 26 * HOUR) },
    { examId: "quiz-mock-v2", rootExamId: "quiz-mock-v1", actorId: tutor.id, kind: "new_version", note: "Soạn đề xuất v2 từ v1 · Câu 2 sai đáp án gốc", createdAt: new Date(now - 2 * HOUR) },
  ] });

  return [
    "QZ · Đăng nhập giasu@kin.local → Bài tập (cần bật module Bài tập ở Cài đặt, hoặc mở thẳng /lop-cua-toi/bai-tap): có “Nhập đề từ tệp” và “Tạo quiz”.",
    "QZ-03/04 · /lop-cua-toi/bai-tap/quiz/quiz-mock-nhap — quiz NHÁP đủ 5 dạng câu (nhiều đáp án, tự luận có tiêu chí 4+4+2). Bấm Sửa để thấy trình soạn; tab “Đáp án và phát hành” có bảng đáp án và nút Phát hành.",
    "QZ-07 · /lop-cua-toi/bai-tap/quiz/quiz-mock-v1 — đã có 2 bài nộp nên mọi ô sửa khoá, có hộp “Tạo phiên bản mới”. /lop-cua-toi/bai-tap/quiz/quiz-mock-v1/phien-ban — so sánh v1 với bản đề xuất v2 (1 câu đổi đáp án, 1 câu thêm) và nhật ký.",
    "QZ-05 · /lop-cua-toi/bai-tap/nhap-de — chọn PDF/Word/ảnh đề gốc (≤ 4 MB). Cần GEMINI_API_KEY trên máy; không có khoá thì báo lỗi và gợi ý soạn tay.",
  ];
};
export default mock;
