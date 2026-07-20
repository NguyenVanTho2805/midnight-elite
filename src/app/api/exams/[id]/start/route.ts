import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { finalizeAttempt, parseDurationMinutes, shuffleArray, shuffleQuestionOrderBySections, applyAttemptOrder, loadAnswerState } from "@/lib/examGrading";

// POST /api/exams/[id]/start — tạo attempt mới hoặc resume attempt in_progress đang có.
// Idempotent: gọi lại nhiều lần (vd sau khi refresh trang) sẽ trả về cùng 1 attempt
// kèm các câu trả lời đã lưu, cho tới khi attempt đó submit hoặc hết giờ.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id: examId } = await params;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examQuestions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (exam.examQuestions.length === 0) {
      return NextResponse.json(
        { error: "Đề thi này chưa có câu hỏi trong platform" },
        { status: 409 }
      );
    }

    // Đề thi thu phí: miễn phí cho học viên đã đăng ký đúng khoá học gắn với
    // đề, người khác (guest hoặc học viên khoá khác) cần được admin duyệt
    // qua ExamGuestAccess (thủ công, tái dùng quy trình sales hiện có —
    // không có cổng thanh toán tự động, xem reports/2026-07-13.md Giai đoạn 3).
    if (exam.price && exam.price > 0) {
      const isEnrolledInExamCourse = exam.courseId
        ? !!(await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: session.userId, courseId: exam.courseId } },
          }))
        : false;

      if (!isEnrolledInExamCourse) {
        const granted = await prisma.examGuestAccess.findUnique({
          where: { userId_examId: { userId: session.userId, examId } },
        });
        if (!granted) {
          return NextResponse.json(
            { error: "Đề thi này yêu cầu phí — liên hệ tư vấn để được duyệt quyền vào thi" },
            { status: 402 }
          );
        }
      }
    }

    let attempt = await prisma.examAttempt.findFirst({
      where: { userId: session.userId, examId, status: "in_progress" },
      orderBy: { startedAt: "desc" },
    });

    // Mật khẩu đề thi: chỉ kiểm tra lúc bắt đầu lượt MỚI (không hỏi lại khi
    // resume/refresh trang giữa chừng — đã vào phòng thi rồi thì không hỏi nữa).
    if (exam.password && !attempt) {
      const { password } = await req.json().catch(() => ({})) as { password?: string };
      if (password !== exam.password) {
        return NextResponse.json({ error: "Sai mật khẩu đề thi" }, { status: 403 });
      }
    }

    // Lazy-expiry: attempt cũ đã hết giờ nhưng chưa được chấm — chấm luôn rồi tạo attempt mới
    if (attempt && attempt.expiresAt.getTime() <= Date.now()) {
      await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      attempt = null;
    }

    if (!attempt) {
      const totalPoints = exam.examQuestions.reduce((sum, q) => sum + q.points, 0);
      const minutes = parseDurationMinutes(exam.duration);

      // Xáo thứ tự câu hỏi + đáp án riêng cho lượt này, cố định suốt attempt
      // (chống chép bài — học sinh ngồi cạnh nhau thấy thứ tự khác nhau).
      // Chỉ xáo TRONG PHẠM VI TỪNG PHẦN — giữ nguyên thứ tự các Phần.
      const questionOrder = shuffleQuestionOrderBySections(exam.examQuestions);
      const optionOrderByQuestion: Record<string, string[]> = {};
      for (const q of exam.examQuestions) {
        optionOrderByQuestion[q.id] = shuffleArray(q.options.map(o => o.id));
      }

      attempt = await prisma.examAttempt.create({
        data: {
          userId: session.userId,
          examId,
          expiresAt: new Date(Date.now() + minutes * 60_000),
          totalPoints,
          questionOrder,
          optionOrderByQuestion,
        },
      });
    }

    const { answers, textAnswers, boolAnswersByOption } = await loadAnswerState(attempt.id);
    const questions = applyAttemptOrder(exam.examQuestions, attempt);

    return NextResponse.json({
      attemptId: attempt.id,
      expiresAt: attempt.expiresAt,
      questions,
      answers,
      textAnswers,
      boolAnswers: boolAnswersByOption,
    });
  } catch (e) {
    console.error("[POST /api/exams/[id]/start]", e);
    return NextResponse.json({ error: "Không thể bắt đầu bài thi" }, { status: 500 });
  }
}
