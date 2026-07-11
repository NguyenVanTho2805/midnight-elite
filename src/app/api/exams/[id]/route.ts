import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  try {
    const { id } = await params;
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { examQuestions: true } } },
    });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    const { _count, ...rest } = exam;
    return NextResponse.json({ ...rest, hasQuestions: _count.examQuestions > 0 });
  } catch (e) {
    console.error("[GET /api/exams/[id]]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const body   = await req.json();

    // Allowlist — không cho ghi đè id, code, participants, createdAt
    const allowed = ["title", "category", "date", "time", "duration", "questions",
                     "status", "azotaUrl", "active", "activeGuest", "guestCanTake"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const exam = await prisma.exam.update({ where: { id }, data });
    return NextResponse.json(exam);
  } catch (e) {
    console.error("[PUT /api/exams/[id]]", e);
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    }
    return NextResponse.json({ error: "Cập nhật đề thi thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  try {
    await prisma.exam.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/exams]", id, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
