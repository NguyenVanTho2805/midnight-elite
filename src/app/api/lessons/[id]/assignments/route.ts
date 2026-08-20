import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateQuestionOptions } from "@/lib/examQuestionParser";

// GET /api/lessons/[id]/assignments — danh sách bài tập tự nộp của 1 bài
// giảng. Bất kỳ ai đã đăng nhập đều xem được danh sách (giống tài liệu đính
// kèm) — kèm `mySubmission` khi người gọi là học viên đã nộp, để trang bài
// giảng không cần gọi thêm request thứ 2. Param dùng tên `id` (không phải
// `lessonId`) để khớp với src/app/api/lessons/[id]/context/route.ts đã có
// sẵn — Next.js không cho 2 route cùng cấp dùng tên slug khác nhau.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: lessonId } = await params;

  try {
    const assignments = await prisma.assignment.findMany({
      where: { lessonId },
      orderBy: { createdAt: "asc" },
      include: {
        submissions: auth.role === "student" ? { where: { userId: auth.userId } } : false,
        _count: { select: { submissions: true, questions: true } },
      },
    });

    const shaped = assignments.map(a => ({
      id: a.id, lessonId: a.lessonId, title: a.title, instructions: a.instructions,
      fileUrl: a.fileUrl, fileName: a.fileName, maxPoints: a.maxPoints, dueDate: a.dueDate,
      mode: a.mode, questionCount: a._count.questions,
      ownerId: a.ownerId, createdAt: a.createdAt,
      submissionCount: a._count.submissions,
      mySubmission: auth.role === "student" ? (a.submissions?.[0] ?? null) : undefined,
    }));

    return NextResponse.json(shaped);
  } catch (e) {
    console.error("[GET /api/lessons/[id]/assignments]", lessonId, e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// POST /api/lessons/[id]/assignments — tạo bài tập mới cho 1 bài giảng.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: lessonId } = await params;

  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
    if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài giảng" }, { status: 404 });

    const body = await req.json();
    const { title, instructions, fileUrl, fileName, maxPoints, dueDate, mode, questions } = body as {
      title?: string; instructions?: string; fileUrl?: string; fileName?: string;
      maxPoints?: number; dueDate?: string | null; mode?: string;
      questions?: {
        text: string; type?: string; points?: number; imageUrl?: string;
        options: { text: string; isCorrect?: boolean }[];
      }[];
    };
    if (!title?.trim()) {
      return NextResponse.json({ error: "Thiếu tiêu đề bài tập" }, { status: 400 });
    }
    const isInteractive = mode === "interactive";
    if (isInteractive && !dueDate) {
      return NextResponse.json({ error: "Bài tập làm trên web bắt buộc phải có Hạn nộp" }, { status: 400 });
    }
    if (isInteractive && (!questions || questions.length === 0)) {
      return NextResponse.json({ error: "Chưa có câu hỏi nào — trích xuất hoặc thêm câu hỏi trước khi lưu" }, { status: 400 });
    }
    if (isInteractive && questions) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text?.trim()) {
          return NextResponse.json({ error: `Câu ${i + 1}: thiếu nội dung` }, { status: 400 });
        }
        const type = q.type === "ESSAY" ? "ESSAY" : "MC";
        const optionsErr = validateQuestionOptions(type, (q.options ?? []).map(o => ({ text: o.text, isCorrect: !!o.isCorrect })));
        if (optionsErr) return NextResponse.json({ error: `Câu ${i + 1}: ${optionsErr}` }, { status: 400 });
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        lessonId,
        title: title.trim(),
        instructions: instructions?.trim() || null,
        fileUrl: fileUrl?.trim() || null,
        fileName: fileName?.trim() || null,
        maxPoints: typeof maxPoints === "number" && maxPoints > 0 ? maxPoints : 10,
        dueDate: dueDate ? new Date(dueDate) : null,
        mode: isInteractive ? "interactive" : "file",
        ownerId: auth.userId,
        ...(isInteractive && questions ? {
          questions: {
            create: questions.map((q, i) => ({
              order: i,
              text: q.text,
              type: q.type === "ESSAY" ? "ESSAY" : "MC",
              points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
              imageUrl: q.imageUrl || null,
              options: {
                create: q.options.map((o, j) => ({ order: j, text: o.text, isCorrect: !!o.isCorrect })),
              },
            })),
          },
        } : {}),
      },
    });

    return NextResponse.json({ ...assignment, submissionCount: 0, questionCount: questions?.length ?? 0, mySubmission: undefined }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/lessons/[id]/assignments]", lessonId, e);
    return NextResponse.json({ error: "Tạo bài tập thất bại" }, { status: 400 });
  }
}
