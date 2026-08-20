import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PATCH /api/assignments/[id]/questions/[questionId]/grade — giáo viên chấm
// tay 1 câu ESSAY của 1 học viên cụ thể. Không phụ thuộc Assignment.dueDate
// — chấm được cả trước hoặc sau khi hết hạn nộp.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id: assignmentId, questionId } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { ownerId: true },
    });
    if (!assignment) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, assignment.ownerId);
    if (isNextResponse(auth)) return auth;

    const question = await prisma.assignmentQuestion.findUnique({
      where: { id: questionId },
      select: { assignmentId: true, type: true, points: true },
    });
    if (!question || question.assignmentId !== assignmentId) {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });
    }
    if (question.type !== "ESSAY") {
      return NextResponse.json({ error: "Chỉ câu tự luận mới cần chấm tay" }, { status: 400 });
    }

    const { userId, pointsAwarded, teacherComment } = await req.json() as {
      userId?: string; pointsAwarded?: number; teacherComment?: string;
    };
    if (!userId) return NextResponse.json({ error: "Thiếu học viên" }, { status: 400 });
    if (typeof pointsAwarded !== "number" || pointsAwarded < 0 || pointsAwarded > question.points) {
      return NextResponse.json({ error: `Điểm phải từ 0 đến ${question.points}` }, { status: 400 });
    }

    // upsert (không phải update) — học viên có thể bỏ trống câu tự luận,
    // giáo viên vẫn cần chấm được (thường là 0 điểm) dù chưa có dòng đáp án nào.
    const updated = await prisma.assignmentAnswer.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId, pointsAwarded, teacherComment: teacherComment?.trim() || null },
      update: { pointsAwarded, teacherComment: teacherComment?.trim() || null },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/assignments/[id]/questions/[questionId]/grade]", questionId, e);
    return NextResponse.json({ error: "Chấm điểm thất bại" }, { status: 400 });
  }
}
