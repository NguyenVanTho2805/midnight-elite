import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { isEnrollmentActive, ENROLLMENT_STATUS } from "@/lib/enrollment";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            chapters: {
              orderBy: { order: "asc" },
              include: {
                lessons: {
                  orderBy: { order: "asc" },
                  include: { _count: { select: { assignments: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

    const session = await getSession();
    let hasAccess = false;

    if (session) {
      if (session.role === "admin") {
        hasAccess = true;
      } else {
        const enrolled = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: session.userId, courseId: id } },
        });
        // "pending_consent" chưa được học, "suspended" chỉ xem lại nhưng
        // không có hoạt động mới — hasAccess ở route này quyết định mở khoá
        // toàn bộ lessons, nên dùng active làm chuẩn.
        hasAccess = isEnrollmentActive(enrolled);
      }
    }

    // Hidden courses: only admin or enrolled students can access
    if (!course.status && !hasAccess) {
      return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    }

    // Học viên đã mua/đã enroll (hoặc admin) thì mọi bài học đều mở khoá,
    // bất kể cờ isLocked tĩnh trong DB — isLocked chỉ còn ý nghĩa cho khách chưa mua.
    if (hasAccess) {
      course.sections = course.sections.map(s => ({
        ...s,
        chapters: s.chapters.map(c => ({
          ...c,
          lessons: c.lessons.map(l => ({ ...l, isLocked: false })),
        })),
      }));
    }

    return NextResponse.json(course);
  } catch (e) {
    console.error("[GET /api/courses/[id]]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

async function updateCourse(req: NextRequest, id: string, auth: Awaited<ReturnType<typeof requirePermission>>) {
  if (!("userId" in auth)) return auth;
  const existing = await prisma.course.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
  if (!ownsResource(auth, existing.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

  const body = await req.json();

  // Chỉ pick các scalar fields của Course, tránh Unknown argument error khi Prisma client chưa reload
  const data: Record<string, unknown> = {};
  const allowed = [
    "name","adminName","shortTitle","category","instructor","teacherAvatar",
    "openDate","types","tag","tagColor","introVideo","zaloGroupLink","bg","strip",
    "price","originalPrice","lessons","hours","status",
    "capacity","classStatus",
  ];
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  // capacity: null = không giới hạn; nếu đang giảm, phải lớn hơn hoặc bằng
  // số Enrollment đang "active". Enrollment "pending_consent"/"suspended"
  // không tính vì đã bị khoá hoạt động, hạ capacity không làm họ vỡ gì.
  if ("capacity" in data) {
    const v = data.capacity;
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 0)) {
      return NextResponse.json({ error: "capacity phải là số nguyên không âm hoặc null" }, { status: 400 });
    }
    if (typeof v === "number") {
      const activeCount = await prisma.enrollment.count({ where: { courseId: id, status: ENROLLMENT_STATUS.ACTIVE } });
      if (v < activeCount) {
        return NextResponse.json(
          { error: `Không thể hạ sức chứa xuống ${v} — hiện có ${activeCount} học viên đang theo học` },
          { status: 400 },
        );
      }
    }
  }
  if ("classStatus" in data) {
    const v = data.classStatus;
    if (v !== "open" && v !== "closed" && v !== "paused") {
      return NextResponse.json({ error: 'classStatus phải là "open" | "closed" | "paused"' }, { status: 400 });
    }
  }

  const course = await prisma.course.update({ where: { id }, data });
  return NextResponse.json(course);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    return await updateCourse(req, id, auth);
  } catch (e) {
    console.error("[PUT /api/courses/[id]]", e);
    return NextResponse.json({ error: "Cập nhật khóa học thất bại" }, { status: 400 });
  }
}

// PATCH giữ bí danh của PUT — client gửi PATCH cho các field vận hành (capacity,
// classStatus) sẽ dùng chung cùng validate ở trên, không cần tách route.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    return await updateCourse(req, id, auth);
  } catch (e) {
    console.error("[PATCH /api/courses/[id]]", e);
    return NextResponse.json({ error: "Cập nhật khóa học thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const existing = await prisma.course.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    if (!ownsResource(auth, existing.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    await prisma.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/courses/[id]]", e);
    return NextResponse.json({ error: "Xoá khóa học thất bại" }, { status: 400 });
  }
}
