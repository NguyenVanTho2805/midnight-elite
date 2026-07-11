import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/exams/[id]/attempts?mine=true — lịch sử các lần làm bài của học viên hiện tại
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id: examId } = await params;
  const { searchParams } = new URL(req.url);
  if (searchParams.get("mine") !== "true") {
    return NextResponse.json({ error: "Thiếu tham số mine=true" }, { status: 400 });
  }

  try {
    const attempts = await prisma.examAttempt.findMany({
      where: { userId: session.userId, examId, status: { not: "in_progress" } },
      orderBy: { submittedAt: "desc" },
      select: { id: true, status: true, score: true, submittedAt: true, startedAt: true },
    });
    return NextResponse.json(attempts);
  } catch (e) {
    console.error("[GET /api/exams/[id]/attempts]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
