import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.VIEW_REVENUE);
  if (isNextResponse(auth)) return auth;

  try {
    const [enrollments, studentCount] = await Promise.all([
      prisma.enrollment.findMany({
        include: {
          course: { select: { name: true, price: true } },
          user:   { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: { role: "student", enrollments: { some: {} } } }),
    ]);

    const totalRevenue = enrollments.reduce((s, e) => s + (e.course.price ?? 0), 0);

    // Doanh thu theo khoá học
    const courseRevMap = new Map<string, { name: string; revenue: number; enrollments: number }>();
    for (const e of enrollments) {
      const price    = e.course.price ?? 0;
      const existing = courseRevMap.get(e.courseId);
      if (existing) { existing.revenue += price; existing.enrollments++; }
      else courseRevMap.set(e.courseId, { name: e.course.name, revenue: price, enrollments: 1 });
    }
    const byCourse = [...courseRevMap.values()].sort((a, b) => b.revenue - a.revenue);

    // Time-series: doanh thu theo tháng (từ enrollment.createdAt)
    const byMonth: Record<string, { month: string; revenue: number; enrollments: number }> = {};
    for (const e of enrollments) {
      const key   = e.createdAt.toISOString().slice(0, 7); // "2026-06"
      const price = e.course.price ?? 0;
      if (!byMonth[key]) byMonth[key] = { month: key, revenue: 0, enrollments: 0 };
      byMonth[key].revenue += price;
      byMonth[key].enrollments++;
    }
    const revenueByMonth = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

    const allEnrollments = enrollments.map(e => ({
      id:         e.id,
      userName:   e.user.name,
      userPhone:  e.user.phone ?? "—",
      courseName: e.course.name,
      amount:     e.course.price ?? 0,
      createdAt:  e.createdAt.toISOString(),
    }));

    return NextResponse.json({
      totalRevenue,
      totalEnrollments: enrollments.length,
      totalStudents:    studentCount,
      totalCourses:     courseRevMap.size,
      byCourse,
      revenueByMonth,   // NEW: time-series
      allEnrollments,
    });
  } catch (e) {
    console.error("[GET /api/admin/analytics]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
