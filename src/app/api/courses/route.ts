import { NextRequest, NextResponse } from "next/server";
import { isReservedCourseId } from "@/lib/courseIds";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownerScopeWhere } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { validateTutorCourseFields } from "@/lib/courseValidation";
import { FEE_MODE_LEGACY, validateFeeSetup, type FeeSetup } from "@/lib/tuitionFee";
import { PREVIEW_BLOCKED_MESSAGE, createInitialFeeRate, moneyPathsBlocked } from "@/lib/feeChargeServer";
import { courseFor, type MediaViewer } from "@/lib/mediaAccess";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const allFlag  = searchParams.get("all");  // "1" = admin panel requesting all courses

    const session = await getSession();
    const isAdmin = session?.role === "admin";
    // Trạng thái ghi danh của học viên theo từng lớp: để quyết định ai được thấy link nhóm Zalo / link học online của lớp (xem courseFor).
    const enrollmentOf = new Map<string, { status: string }>();

    let statusWhere: Record<string, unknown>;

    if (allFlag === "1") {
      // Admin panel requesting all courses — require admin auth
      if (!isAdmin) {
        return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
      }
      // Giáo viên (adminRole "teacher") chỉ thấy khoá học do chính mình tạo;
      // admin_super/admin_content thấy tất cả.
      statusWhere = ownerScopeWhere(session!);
    } else {
      // Public access (homepage, catalog, student page):
      // Always show only active courses.
      // Exception: enrolled students also see courses they paid for, even if hidden.
      if (session?.role === "student") {
        const enrollments = await prisma.enrollment.findMany({
          where:  { userId: session.userId },
          select: { courseId: true, status: true },
        });
        for (const e of enrollments) enrollmentOf.set(e.courseId, { status: e.status });
        const enrolledIds = enrollments.map(e => e.courseId);
        statusWhere = enrolledIds.length > 0
          ? { OR: [{ status: true }, { id: { in: enrolledIds } }] }
          : { status: true };
      } else {
        statusWhere = { status: true };
      }
    }

    const courses = await prisma.course.findMany({
      where: { ...(category ? { category } : {}), ...statusWhere },
      orderBy: { sortOrder: "asc" },
    });

    // Link nhóm Zalo (zaloGroupLink, zaloGroupUrl) và link học online (classJoinUrl) chỉ đi tới quản lý lớp và học viên đang học: danh sách công khai
    // (trang chủ, danh mục) trả cả dòng Course nên trước đây khách nào cũng lấy được qua DevTools.
    const viewer: MediaViewer | null = session ? { userId: session.userId, role: session.role, adminRole: session.adminRole } : null;
    return NextResponse.json(courses.map(c => courseFor({ viewer, courseOwnerId: c.ownerId, enrollment: enrollmentOf.get(c.id) ?? null }, c)));
  } catch (e) {
    console.error("[GET /api/courses]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const allowed = [
      "id","name","adminName","shortTitle","category","instructor",
      "teacherAvatar","openDate","types","tag","tagColor","bg","strip",
      "introVideo","price","originalPrice","lessons","hours","status",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    if (!data.name || !data.id) {
      return NextResponse.json({ error: "Thiếu id hoặc name" }, { status: 400 });
    }

    // NC2-035: gia sư chỉ được gửi giá/số bài/giờ/trạng thái hợp lý. Quản trị giữ hành vi cũ. Chỉ từ chối, không đổi cách tính phí.
    if (auth.adminRole === "teacher") {
      const bad = validateTutorCourseFields(data);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    }

    // HP-15: hình thức học phí chọn LÚC TẠO LỚP (theo buổi / giờ / khoá). Không gửi, hoặc gửi cách cũ → lớp mặc định, y như trước.
    // Chỉ lớp tạo SAU mới có thể khác mặc định; không có đường nào đổi hình thức của lớp đã tạo.
    let feeSetup: FeeSetup | null = null;
    if (body.feeMode !== undefined && body.feeMode !== FEE_MODE_LEGACY) {
      if (moneyPathsBlocked()) return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 503 });
      const v = validateFeeSetup({ mode: body.feeMode, rate: body.feeRate, sessionMinutes: body.feeSessionMinutes });
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      feeSetup = v.value;
    }

    // Mã trùng tên một trang cố định của KiN (vd "lich") thì trang lớp không bao giờ mở được — xem src/lib/courseIds.ts.
    if (isReservedCourseId(data.id)) {
      return NextResponse.json({ error: `Mã "${data.id}" trùng tên một trang của KiN. Hãy đặt tên lớp khác để tạo mã khác.` }, { status: 400 });
    }

    // Kiểm tra slug trùng trước khi insert
    const existing = await prisma.course.findUnique({ where: { id: data.id as string } });
    if (existing) {
      return NextResponse.json(
        { error: `Slug "${data.id}" đã tồn tại. Hãy đặt tên khác để tạo slug duy nhất.` },
        { status: 409 },
      );
    }

    data.createdAt = new Date().toLocaleDateString("vi-VN") + " 08:00:00";
    data.ownerId = auth.userId;

    // adminId trong transaction để tránh race condition giữa hai POST đồng thời
    const course = await prisma.$transaction(async (tx) => {
      const maxRow = await tx.course.findFirst({ orderBy: { adminId: "desc" }, select: { adminId: true } });
      data.adminId = (maxRow?.adminId ?? 0) + 1;
      if (feeSetup) data.feeMode = feeSetup.mode;
      const created = await tx.course.create({ data: data as Parameters<typeof prisma.course.create>[0]["data"] });
      if (feeSetup) await createInitialFeeRate(tx, created.id, feeSetup, auth.userId);
      return created;
    });
    return NextResponse.json(course, { status: 201 });
  } catch (e) {
    console.error("[POST /api/courses]", e);
    return NextResponse.json({ error: "Tạo khóa học thất bại" }, { status: 400 });
  }
}
