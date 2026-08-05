import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// PATCH /api/assignments/[id]/submissions/[submissionId]/grade — chấm điểm 1
// bài đã nộp. Điểm không được vượt quá maxPoints của bài tập.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  const { id: assignmentId, submissionId } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { ownerId: true, maxPoints: true },
    });
    if (!assignment) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, assignment.ownerId);
    if (isNextResponse(auth)) return auth;

    const submission = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId } });
    if (!submission || submission.assignmentId !== assignmentId) {
      return NextResponse.json({ error: "Không tìm thấy bài nộp" }, { status: 404 });
    }

    const { score, comment } = await req.json() as { score?: number; comment?: string };
    if (typeof score !== "number" || score < 0 || score > assignment.maxPoints) {
      return NextResponse.json({ error: `Điểm phải từ 0 đến ${assignment.maxPoints}` }, { status: 400 });
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { score, comment: comment?.trim() || null, gradedAt: new Date(), gradedBy: auth.userId },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/assignments/[id]/submissions/[submissionId]/grade]", submissionId, e);
    return NextResponse.json({ error: "Chấm điểm thất bại" }, { status: 400 });
  }
}
