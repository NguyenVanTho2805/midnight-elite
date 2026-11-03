// BU-01 (R6) — GET /api/tutor/lop/[courseId]/yeu-cau?status=pending|all: hàng chờ vào lớp của CHÍNH gia sư chủ lớp. Lớp gia sư khác 403, không có 404.
// Đây là chỗ DUY NHẤT trả tên học sinh (chỉ cho chủ lớp); không trả email, điện thoại, ngày sinh, userId.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseTutor } from "@/lib/enrollServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const g = await requireCourseTutor(courseId);
  if (g instanceof NextResponse) return g;
  const all = new URL(req.url).searchParams.get("status") === "all";
  const [rows, pending] = await Promise.all([
    prisma.classJoinRequest.findMany({
      where: { courseId, ...(all ? {} : { status: "pending" }) },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, status: true, createdAt: true, decidedAt: true, note: true, user: { select: { name: true } } },
    }),
    prisma.classJoinRequest.count({ where: { courseId, status: "pending" } }),
  ]);
  const items = rows.map((r) => ({ id: r.id, studentName: r.user.name ?? "Học sinh", status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt, note: r.note }));
  return NextResponse.json({ items, pending }, { headers: NO_STORE });
}
