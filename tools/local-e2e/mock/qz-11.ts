// Dữ liệu GIẢ cho QZ-11/12 (học sinh làm quiz). Chạy lặp lại được (upsert / tìm-trước-tạo-sau).
// Lớp "Toán 9 (thử quiz)" của gia sư chính, học sinh chính ĐÃ ghi danh, một học sinh khác CHƯA. Ba đề:
//   1) quiz hỗn hợp (trắc nghiệm + tự luận), 15 phút, tối đa 1 lượt  → thử cổng vào đề, tự lưu nháp, hộp xác nhận nộp, màn "đã nộp, chờ chấm";
//   2) quiz chỉ trắc nghiệm, 10 phút, không giới hạn lượt            → điểm và lời giải hiện ngay sau nộp;
//   3) quiz hỗn hợp, đã đặt hết giờ trong DB (lượt dở quá hạn)        → thử màn "Hết giờ", nộp tự động.
import { mkCourse, mkUser } from "../h";
import type { MockCtx } from "../mock-seed";

const CLASS_NAME = "Toán 9 (thử quiz)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor, student } = ctx;
  let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: CLASS_NAME } });
  if (!c) c = await mkCourse(tutor.id, { name: CLASS_NAME });
  await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: c.id } }, update: { status: "active" }, create: { userId: student.id, courseId: c.id, status: "active" } });

  let outsider = await prisma.user.findUnique({ where: { email: "hocsinh-ngoai-lop-quiz@kin.local" } });
  if (!outsider) { const u = await mkUser({ name: "Học sinh ngoài lớp (thử quiz)" }); outsider = await prisma.user.update({ where: { id: u.id }, data: { email: "hocsinh-ngoai-lop-quiz@kin.local" } }); }

  const mkExam = async (id: string, title: string, minutes: number, essay: boolean) => {
    const data = { title, category: "toan", date: "01/01/2030", time: "08:00", duration: `${minutes} phút`, questions: essay ? 3 : 2, status: "available", createdAt: new Date().toISOString(), ownerId: tutor.id, courseId: c!.id, totalPoints: 10, answerVisibility: "after_submit" };
    await prisma.exam.upsert({ where: { id }, update: { title, courseId: c!.id }, create: { id, code: id.toUpperCase().slice(0, 24), ...data } });
    const mc = async (n: number, text: string, right: string, wrong: string) => {
      const qid = `${id}-q${n}`;
      await prisma.examQuestion.upsert({ where: { id: qid }, update: {}, create: { id: qid, examId: id, order: n, text, type: "MC", points: 1, explanation: "Lời giải thử cho câu này." } });
      await prisma.examOption.upsert({ where: { id: `${qid}-ok` }, update: {}, create: { id: `${qid}-ok`, questionId: qid, order: 0, text: right, isCorrect: true } });
      await prisma.examOption.upsert({ where: { id: `${qid}-no` }, update: {}, create: { id: `${qid}-no`, questionId: qid, order: 1, text: wrong, isCorrect: false } });
    };
    await mc(1, "Tổng hai nghiệm của x² − 5x + 6 = 0 là?", "5", "6");
    await mc(2, "Giá trị của 2³ là?", "8", "6");
    if (essay) await prisma.examQuestion.upsert({ where: { id: `${id}-q3` }, update: {}, create: { id: `${id}-q3`, examId: id, order: 3, text: "Giải phương trình x² − 5x + 6 = 0 bằng cách phân tích thành nhân tử. Trình bày các bước và kiểm tra nghiệm.", type: "ESSAY", points: 2 } });
  };
  await mkExam("qz11-hon-hop", "Ôn tập tổng hợp · Toán 9", 15, true);
  await mkExam("qz11-trac-nghiem", "Trắc nghiệm nhanh · Toán 9", 10, false);
  await mkExam("qz11-het-gio", "Quiz hết giờ (thử) · Toán 9", 15, true);
  await prisma.quizAttemptLimit.upsert({ where: { examId: "qz11-hon-hop" }, update: { maxAttempts: 1 }, create: { examId: "qz11-hon-hop", maxAttempts: 1 } });

  // Lượt dở đã quá hạn của đề 3: mở đề này sẽ thấy máy chủ chấm lượt cũ (hết giờ) rồi cho vào lượt mới.
  const old = await prisma.examAttempt.findFirst({ where: { userId: student.id, examId: "qz11-het-gio" } });
  if (!old) await prisma.examAttempt.create({ data: { userId: student.id, examId: "qz11-het-gio", startedAt: new Date(Date.now() - 3600_000), expiresAt: new Date(Date.now() - 2700_000), status: "in_progress", totalPoints: 4 } });

  return [
    `Đăng nhập ${student.email} (mật khẩu Passw0rd!) → /student/thi-thu/qz11-hon-hop : cổng vào đề (lớp "${CLASS_NAME}", 15 phút, "Lượt 1/1", có tự luận) → làm bài → gõ tự luận thấy "Bản nháp đã lưu trên máy chủ" → Nộp bài thấy danh sách câu chưa làm → màn "Máy chủ KiN đã nhận bài", KHÔNG có điểm.`,
    `/student/thi-thu/qz11-trac-nghiem : quiz chỉ trắc nghiệm, nộp xong có điểm và "Xem lại bài làm" có lời giải ngay.`,
    `/student/thi-thu/qz11-het-gio : có sẵn một lượt dở đã quá hạn — máy chủ chốt lượt đó, rồi em bắt đầu lượt mới.`,
    `Đăng nhập ${outsider.email} (Passw0rd!) → /student/thi-thu/qz11-hon-hop : cổng báo "Em chưa vào lớp của đề này" + nút "Nhập mã lớp"; nút bắt đầu bị khoá.`,
  ];
}
