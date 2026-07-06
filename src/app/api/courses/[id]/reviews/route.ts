import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reviews = await prisma.courseReview.findMany({
      where: { courseId: id, status: "approved" },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const avg = reviews.length
      ? reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviews.length
      : null;
    return NextResponse.json({ reviews, avg, total: reviews.length });
  } catch (e) {
    console.error("[GET /api/courses/[id]/reviews]", e);
    return NextResponse.json({ reviews: [], avg: null, total: 0 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

  const { id } = await params;
  const { rating, comment } = await req.json();

  if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: "Điểm đánh giá từ 1–5" }, { status: 400 });
  if (!comment?.trim()) return NextResponse.json({ error: "Vui lòng nhập nhận xét" }, { status: 400 });

  // Chỉ học viên đã mua mới được đánh giá (admin bypass)
  if (session.role !== "admin") {
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId: id } },
    });
    if (!enrolled) return NextResponse.json({ error: "Chỉ học viên đã mua khóa học mới có thể đánh giá" }, { status: 403 });
  }

  const existing = await prisma.courseReview.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId: id } },
  });
  if (existing) return NextResponse.json({ error: "Bạn đã đánh giá khóa học này rồi" }, { status: 409 });

  const review = await prisma.courseReview.create({
    data: { userId: session.userId, courseId: id, rating, comment: comment.trim(), status: "pending" },
  });
  return NextResponse.json({ review }, { status: 201 });
}
