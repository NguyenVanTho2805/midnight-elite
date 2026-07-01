import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyMany } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status   = searchParams.get("status");
    const activeOnly      = searchParams.get("active") === "true";
    const activeGuestOnly = searchParams.get("activeGuest") === "true";

    const exams = await prisma.exam.findMany({
      where: {
        ...(category        ? { category }             : {}),
        ...(status          ? { status }               : {}),
        ...(activeOnly      ? { active: true }         : {}),
        ...(activeGuestOnly ? { activeGuest: true }    : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(exams);
  } catch (e) {
    console.error("[GET /api/exams]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();

    // Allowlist — chỉ nhận fields đúng với Prisma schema
    const allowed = ["id", "code", "title", "category", "date", "time", "duration",
                     "questions", "status", "azotaUrl", "participants", "active", "activeGuest", "guestCanTake", "createdAt"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exam = await prisma.exam.create({ data: data as any });

    // Thông báo cho học viên đã đăng ký khoá học cùng category với đề thi
    if (exam.active) {
      const enrollments = await prisma.enrollment.findMany({
        where:  { course: { category: { contains: exam.category.split(" ")[0] } } },
        select: { userId: true },
      });
      const studentIds = [...new Set(enrollments.map(e => e.userId))];
      await notifyMany(studentIds, {
        type:    "exam_new",
        title:   "Có đề thi mới",
        message: `Đề thi mới: "${exam.title}" — diễn ra ngày ${exam.date}`,
        link:    `/student/thi-thu`,
      });
    }

    return NextResponse.json(exam, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exams]", e);
    return NextResponse.json({ error: "Tạo đề thi thất bại" }, { status: 400 });
  }
}
