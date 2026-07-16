import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { distributePoints } from "@/lib/scoreDistribution";

// PUT /api/exams/[id]/questions/set-points — admin: ghi đè điểm TOÀN BỘ câu hỏi
// đã có của đề bằng cách chia đều totalPoints, đồng thời lưu Exam.totalPoints
// (dùng để quy đổi thang điểm hiển thị cuối cùng — xem examGrading.ts).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const { totalPoints } = await req.json() as { totalPoints?: number };
    if (typeof totalPoints !== "number" || !Number.isFinite(totalPoints) || totalPoints <= 0) {
      return NextResponse.json({ error: "Tổng điểm phải là số dương" }, { status: 400 });
    }

    const questions = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (questions.length === 0) {
      return NextResponse.json({ error: "Đề thi chưa có câu hỏi nào" }, { status: 400 });
    }

    const distributed = distributePoints(totalPoints, questions.length);

    await prisma.$transaction(
      [
        ...questions.map((q, i) =>
          prisma.examQuestion.update({ where: { id: q.id, examId }, data: { points: distributed[i] } })
        ),
        prisma.exam.update({ where: { id: examId }, data: { totalPoints } }),
      ],
      { timeout: 30000 }
    );

    return NextResponse.json({ updated: questions.length, totalPoints });
  } catch (e) {
    console.error("[PUT /api/exams/[id]/questions/set-points]", e);
    return NextResponse.json({ error: "Áp dụng điểm thất bại" }, { status: 400 });
  }
}
