// QZ hoàn thiện — dữ liệu giả: (1) hạn nộp riêng cho hai học sinh thử của quiz QZ-08 (một còn hạn, một đã QUÁ hạn); (2) một quiz có câu NHIỀU ĐÁP ÁN mà
// hocsinh@kin.local đã làm sai để thử "Chữa lại các câu sai"; (3) một đầu mục ngân hàng câu hỏi để thử "Lưu vào ngân hàng". Chạy lại không nhân đôi.
import type { MockFn } from "../mock-seed";

const MID = "qzht-multi";

const mock: MockFn = async ({ prisma, tutor, student, tw }) => {
  const lines: string[] = [];

  // (3) đầu mục ngân hàng
  if (!(await prisma.questionCategory.findFirst({ where: { name: "Toán 9 (đầu mục thử)" } }))) await prisma.questionCategory.create({ data: { name: "Toán 9 (đầu mục thử)" } });

  // (1) hạn riêng trên quiz QZ-08 (nếu mock đó đã chạy)
  const qz08 = await prisma.exam.findUnique({ where: { id: "qz08-mix" } });
  if (qz08) {
    const enrolled = await prisma.enrollment.findMany({ where: { courseId: tw.c1.id, status: "active", user: { name: { startsWith: "Học sinh Thử" } } }, select: { userId: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
    const [a, b] = enrolled;
    if (a && !(await prisma.quizStudentDeadline.findUnique({ where: { examId_userId: { examId: qz08.id, userId: a.userId } } }))) await prisma.quizStudentDeadline.create({ data: { examId: qz08.id, userId: a.userId, dueAt: new Date(Date.now() + 2 * 86_400_000), note: "Em ốm, gia hạn 2 ngày", setById: tutor.id } });
    if (b && !(await prisma.quizStudentDeadline.findUnique({ where: { examId_userId: { examId: qz08.id, userId: b.userId } } }))) await prisma.quizStudentDeadline.create({ data: { examId: qz08.id, userId: b.userId, dueAt: new Date(Date.now() - 3_600_000), note: "Hạn riêng đã qua (dữ liệu thử)", setById: tutor.id } });
    lines.push(`Hạn nộp riêng · đăng nhập ${tutor.email} → mở quiz "Ôn tập tổng hợp · Toán 9 (thử chấm quiz)" → Phiên bản → tab "Hạn riêng": ${a?.user.name ?? "?"} còn hạn 2 ngày, ${b?.user.name ?? "?"} đã quá hạn; chọn học sinh, đặt hoặc bỏ hạn.`);
    lines.push(`Xuất nhật ký CSV · cùng quiz → "Chấm và theo dõi" → tab "Lịch sử công bố" → nút "Tải nhật ký (CSV)".`);
  } else lines.push("Hạn riêng: chưa có quiz QZ-08 để gắn (chạy lại seed.sh --reset).");

  // (2) quiz nhiều đáp án + bài làm sai để chữa
  if (!(await prisma.exam.findUnique({ where: { id: MID } }))) {
    const exam = await prisma.exam.create({ data: { id: MID, code: "QZHTMULTI", title: "Câu nhiều đáp án · thử chữa bài", category: "toan", date: "01/01/2024", time: "08:00", duration: "20 phút", questions: 3, status: "available", createdAt: new Date().toISOString(), totalPoints: 6, ownerId: tutor.id, answerVisibility: "after_submit" } });
    const mk = async (order: number, text: string, type: string, opts: [string, boolean][], extra: { hint?: string; explanation?: string } = {}) => {
      const q = await prisma.examQuestion.create({ data: { id: `${MID}-q${order}`, examId: exam.id, order, text, type, points: 2, hint: extra.hint ?? null, explanation: extra.explanation ?? null } });
      const ids: string[] = [];
      for (const [i, [t, ok]] of opts.entries()) ids.push((await prisma.examOption.create({ data: { id: `${MID}-q${order}-o${i}`, questionId: q.id, order: i, text: t, isCorrect: ok } })).id);
      return { q, ids };
    };
    const m1 = await mk(1, "Chọn TẤT CẢ các số nguyên tố.", "MC_MULTI", [["2", true], ["4", false], ["3", true], ["9", false]], { hint: "Số nguyên tố chỉ chia hết cho 1 và chính nó.", explanation: "2 và 3 là số nguyên tố; 4 = 2×2 và 9 = 3×3 không phải." });
    const m2 = await mk(2, "Chọn các số chẵn.", "MC_MULTI", [["2", true], ["3", false], ["4", true], ["5", false]], { explanation: "Số chẵn chia hết cho 2." });
    const m3 = await mk(3, "Thủ đô của Việt Nam?", "MC", [["Hà Nội", true], ["Huế", false]], { hint: "Thành phố nằm bên sông Hồng.", explanation: "Hà Nội là thủ đô." });
    await prisma.examResult.create({ data: { userId: student.id, examId: exam.id, score: 2, totalPoints: 6 } });
    const att = await prisma.examAttempt.create({ data: { userId: student.id, examId: exam.id, startedAt: new Date(Date.now() - 7_200_000), expiresAt: new Date(Date.now() - 6_000_000), submittedAt: new Date(Date.now() - 6_300_000), status: "submitted", totalPoints: 6, score: 2 } });
    await prisma.examAnswerBoolean.create({ data: { attemptId: att.id, optionId: m1.ids[0], answerTrue: true } });                       // thiếu ô 3 → sai
    await prisma.examAnswerBoolean.createMany({ data: [m2.ids[0], m2.ids[2]].map(o => ({ attemptId: att.id, optionId: o, answerTrue: true })) }); // đúng
    await prisma.examAnswer.create({ data: { attemptId: att.id, questionId: m3.q.id, optionId: m3.ids[1] } });                            // sai
    lines.push(`Chữa bài câu nhiều đáp án · đăng nhập ${student.email} → /student/thi-thu/${MID} → "Xem lại bài làm": câu 1 (nhiều đáp án) và câu 3 làm sai nên đáp án đang bị giấu → "Chữa lại các câu sai": tích chọn nhiều ô, sai lần 1 thấy gợi ý, lần 2 thấy đáp án.`);
  } else lines.push(`Chữa bài câu nhiều đáp án: quiz "${MID}" đã có từ lần nạp trước (${student.email} → /student/thi-thu/${MID}).`);

  lines.push(`Lưu vào ngân hàng · ${tutor.email} → Bài tập → quiz bất kỳ của cô (vd "Câu nhiều đáp án · thử chữa bài") → nút "Lưu vào ngân hàng" cạnh từng câu → chọn đầu mục "Toán 9 (đầu mục thử)".`);
  lines.push(`Bảng Excel mẫu · ${tutor.email} → Bài tập → "Nhập đề từ tệp" → "Tải bảng mẫu Excel", nhập câu, rồi "Chọn bảng đã nhập".`);
  return lines;
};
export default mock;
