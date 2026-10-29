import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "tra-cuu", 10, 60_000);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const phone: string = String(body.phone ?? "").replace(/\s/g, "").trim();

    if (!phone || !/^(0[3|5|7|8|9])[0-9]{8}$/.test(phone)) {
      return NextResponse.json({ error: "Số điện thoại không hợp lệ" }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: {
        role: "student",
        OR: [{ phone }, { parentPhone: phone }],
      },
      select: {
        id:        true,
        name:      true,
        studentId: true,
        enrollments: {
          select: {
            course: {
              select: { id: true, name: true, shortTitle: true, category: true, status: true },
            },
          },
        },
      },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy học viên với số điện thoại này" }, { status: 404 });
    }

    const results = users.map(u => ({
      name:      u.name,
      studentId: u.studentId,
      courses:   u.enrollments.map(e => ({
        id:         e.course.id,
        name:       e.course.name,
        shortTitle: e.course.shortTitle,
        category:   e.course.category,
        status:     e.course.status,
      })),
    }));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[tra-cuu]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
