import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";

// GET /api/assignments/[id]/answer — học viên lấy toàn bộ câu hỏi + đáp án
// đã tự lưu của chính mình, kèm % hoàn thiện và trạng thái khoá. Trước khi
// qua Hạn nộp: ẨN isCorrect/đáp án đúng/giải thích — chỉ hiện sau khi khoá,
// để tất cả học viên thấy đáp án cùng lúc (xem ghi chú PATCH bên dưới).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") {
    return NextResponse.json({ error: "Chỉ học viên mới làm được bài tập" }, { status: 403 });
  }

  const { id: assignmentId } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        mode: true, dueDate: true,
        lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true, order: true, text: true, imageUrl: true, points: true, type: true, explanation: true,
            options: { orderBy: { order: "asc" }, select: { id: true, order: true, text: true, isCorrect: true } },
            answers: { where: { userId: auth.userId }, select: {
              optionId: true, textAnswer: true, isCorrect: true, pointsAwarded: true, teacherComment: true, updatedAt: true,
            } },
          },
        },
      },
    });
    if (!assignment) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });
    if (assignment.mode !== "interactive") {
      return NextResponse.json({ error: "Bài tập này không phải kiểu làm trên web" }, { status: 400 });
    }

    const courseId = assignment.lesson.chapter.section.courseId;
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: auth.userId, courseId } },
    });
    if (!enrolled) {
      return NextResponse.json({ error: "Bạn chưa ghi danh khoá học này" }, { status: 403 });
    }

    const locked = !assignment.dueDate || new Date() >= assignment.dueDate;

    let answered = 0;
    const questions = assignment.questions.map(q => {
      const mine = q.answers[0] ?? null;
      const hasAnswer = q.type === "MC" ? !!mine?.optionId : !!mine?.textAnswer;
      if (hasAnswer) answered++;
      return {
        id: q.id, order: q.order, text: q.text, imageUrl: q.imageUrl, points: q.points, type: q.type,
        explanation: locked ? q.explanation : null,
        options: q.options.map(o => ({ id: o.id, order: o.order, text: o.text, isCorrect: locked ? o.isCorrect : null })),
        myAnswer: mine ? {
          optionId: mine.optionId, textAnswer: mine.textAnswer,
          isCorrect: locked ? mine.isCorrect : null,
          pointsAwarded: mine.pointsAwarded, teacherComment: mine.teacherComment,
        } : null,
      };
    });

    return NextResponse.json({
      locked, dueDate: assignment.dueDate,
      completion: { answered, total: questions.length },
      questions,
    });
  } catch (e) {
    console.error("[GET /api/assignments/[id]/answer]", assignmentId, e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// PATCH /api/assignments/[id]/answer — học viên tự lưu 1 câu trả lời (bài
// tập kiểu "interactive"), gọi ngay mỗi lần chọn đáp án/rời khỏi ô tự luận
// — không có bước "Nộp bài" riêng. Khoá theo Assignment.dueDate, so sánh
// ĐỘNG mỗi lần gọi (không snapshot lúc bắt đầu) — sửa dueDate muộn hơn tự
// mở khoá lại, sớm hơn tự khoá lại ngay, xem ghi chú ở model Assignment.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") {
    return NextResponse.json({ error: "Chỉ học viên mới làm được bài tập" }, { status: 403 });
  }

  const { id: assignmentId } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        mode: true, dueDate: true,
        lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } },
      },
    });
    if (!assignment) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });
    if (assignment.mode !== "interactive") {
      return NextResponse.json({ error: "Bài tập này không phải kiểu làm trên web" }, { status: 400 });
    }

    const courseId = assignment.lesson.chapter.section.courseId;
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: auth.userId, courseId } },
    });
    if (!enrolled) {
      return NextResponse.json({ error: "Bạn chưa ghi danh khoá học này" }, { status: 403 });
    }

    if (!assignment.dueDate || new Date() >= assignment.dueDate) {
      return NextResponse.json({ error: "Đã hết hạn nộp bài, không thể sửa nữa" }, { status: 403 });
    }

    const { questionId, optionId, textAnswer } = await req.json() as {
      questionId?: string; optionId?: string | null; textAnswer?: string | null;
    };
    if (!questionId) return NextResponse.json({ error: "Thiếu câu hỏi" }, { status: 400 });

    const question = await prisma.assignmentQuestion.findUnique({
      where: { id: questionId },
      select: { assignmentId: true, type: true, options: { select: { id: true, isCorrect: true } } },
    });
    if (!question || question.assignmentId !== assignmentId) {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
    }

    // optionId phải thuộc ĐÚNG câu hỏi này — không tin trực tiếp giá trị từ
    // client, tránh lưu rác (id thuộc câu khác/assignment khác) làm sai lệch
    // isCorrect và hiển thị "?" ở màn hình xem lại/chấm điểm.
    let optionIdToSave: string | null = null;
    let isCorrect: boolean | null = null;
    if (question.type === "MC" && optionId) {
      const opt = question.options.find(o => o.id === optionId);
      if (opt) { optionIdToSave = opt.id; isCorrect = opt.isCorrect; }
    }

    await prisma.assignmentAnswer.upsert({
      where: { userId_questionId: { userId: auth.userId, questionId } },
      create: {
        userId: auth.userId, questionId,
        optionId: optionIdToSave,
        textAnswer: question.type === "ESSAY" ? (textAnswer?.trim() || null) : null,
        isCorrect,
      },
      update: {
        optionId: optionIdToSave,
        textAnswer: question.type === "ESSAY" ? (textAnswer?.trim() || null) : null,
        isCorrect,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[PATCH /api/assignments/[id]/answer]", assignmentId, e);
    return NextResponse.json({ error: "Lưu đáp án thất bại" }, { status: 400 });
  }
}
