import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/exams/[id]/attempts/admin — giáo viên/admin: danh sách tất cả lượt
// đã nộp của đề thi này (không phải chỉ của chính mình như route ?mine=true).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true, totalPoints: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (!ownsResource(auth, exam.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
  }

  try {
    const attempts = await prisma.examAttempt.findMany({
      where: { examId, status: { not: "in_progress" } },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true, status: true, score: true,
        startedAt: true, submittedAt: true, tabSwitchCount: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Đếm số câu tự luận chưa chấm (pointsAwarded null) theo từng attempt —
    // dùng để hiện nhãn "Chưa chấm tự luận" mà không cần mở từng bài.
    const ungradedEssays = await prisma.examAnswer.findMany({
      where: {
        attemptId: { in: attempts.map(a => a.id) },
        pointsAwarded: null,
        question: { type: "ESSAY" },
      },
      select: { attemptId: true },
    });
    const ungradedCountByAttempt = new Map<string, number>();
    for (const a of ungradedEssays) {
      ungradedCountByAttempt.set(a.attemptId, (ungradedCountByAttempt.get(a.attemptId) ?? 0) + 1);
    }

    return NextResponse.json(
      attempts.map(a => ({ ...a, totalPoints: exam.totalPoints, ungradedEssayCount: ungradedCountByAttempt.get(a.id) ?? 0 }))
    );
  } catch (e) {
    console.error("[GET /api/exams/[id]/attempts/admin]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
