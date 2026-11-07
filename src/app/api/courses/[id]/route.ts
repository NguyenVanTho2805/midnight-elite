import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { isEnrollmentActive, ENROLLMENT_STATUS } from "@/lib/enrollment";
import { getSession } from "@/lib/session";
import { isSuspended, contactTutorHref } from "@/lib/suspendedContent";
import { PERMISSIONS } from "@/lib/permissions";
import { validateTutorCourseFields } from "@/lib/courseValidation";
import { canUseOpenPolicy, isFreeClass, parseJoinPolicy } from "@/lib/joinRequest";
import { loadFeeRateCourseIds } from "@/lib/enrollServer";
import { pruneTreeForViewer } from "@/lib/lessonStatus";
import { loadCourseAccess } from "@/lib/courseAccessServer";
import { redactCourseForRole, canSeeMoney, type CourseRole } from "@/lib/courseAccess";
import { canViewAllMaterials, isCourseManager, redactCourseLinks, redactCourseTree, type MediaContext, type MediaViewer } from "@/lib/mediaAccess";

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
    let enrolled: { status: string } | null = null;
    // TUT-dong-giang: đồng giảng / bộ môn ĐANG HIỆU LỰC (đọc lại User từ DB) xem lớp như quản lý, nhưng KHÔNG thấy tiền / link nhóm phụ huynh.
    let coRole: CourseRole | null = null;

    if (session) {
      if (session.role === "admin" && session.adminRole === "teacher" && course.ownerId !== session.userId) {
        const acc = await loadCourseAccess(session, id);
        if (acc.ok && (acc.role === "co_teacher" || acc.role === "subject_teacher")) coRole = acc.role;
      }
      if (coRole) {
        hasAccess = true;
      } else if (session.role === "admin") {
        // V7 (BU-02): trước đây MỌI tài khoản admin đều coi là có quyền ⇒ gia sư không phải chủ thấy cây tên bài của lớp ẩn. Nay: quản trị hoặc đúng chủ lớp.
        hasAccess = isCourseManager({ userId: session.userId, role: "admin", adminRole: session.adminRole }, course.ownerId);
      } else {
        enrolled = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: session.userId, courseId: id } },
        });
        // "pending_consent" chưa được học, "suspended" (đã nghỉ lớp) cũng không xem được nữa (quyết định 06/11/2026) — hasAccess ở route này
        // quyết định mở khoá toàn bộ lessons, nên dùng active làm chuẩn.
        hasAccess = isEnrollmentActive(enrolled);
      }
    }

    // Hidden courses: only the class manager (admin / owner tutor) or enrolled students can access
    if (!course.status && !hasAccess) {
      return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    }

    // BU-02-PHẲNG (R1): chỉ quản lý lớp (quản trị / gia sư chủ) thấy mục Nháp và Ẩn. Học sinh (kể cả đã ghi danh), khách, gia sư khác chỉ thấy mục Đã đăng.
    // Lọc TRƯỚC redact để tên/link mục nháp không đi vào bất kỳ nhánh nào của câu trả lời.
    const isManager = session ? isCourseManager({ userId: session.userId, role: session.role, adminRole: session.adminRole }, course.ownerId, coRole !== null) : false;
    course.sections = pruneTreeForViewer({ sections: course.sections }, isManager).sections;

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

    // MD-03: link học liệu (videoUrl, zoomUrl, azotaUrl, documents) chỉ đi tới quản lý lớp, học viên đang học và bài miễn phí.
    // Khách / chưa ghi danh vẫn thấy tên Phần, Chương, Bài để quyết định đăng ký, nhưng link bị bỏ trống.
    // Cùng quyền với link nhóm Zalo (zaloGroupLink, zaloGroupUrl) và link học online (classJoinUrl) của lớp: chỉ quản lý lớp và học viên đang học.
    const viewer: MediaViewer | null = session ? { userId: session.userId, role: session.role, adminRole: session.adminRole } : null;
    const ctx: MediaContext = { viewer, courseOwnerId: course.ownerId, enrollment: enrolled, coTeacher: coRole !== null };
    const tree = redactCourseTree(ctx, course);
    // BU-01: nhãn "Miễn phí" tính sẵn bằng isFreeClass (cùng điều kiện mọi nơi); joinPolicy đã nằm trong dòng Course.
    const rated = await loadFeeRateCourseIds([course.id]);
    const isFree = isFreeClass({ price: course.price, tag: course.tag, hasFeeRate: rated.has(course.id) });
    // Đã nghỉ lớp (quyết định 06/11/2026): thêm `suspended` để trang "Lớp của tôi" hiện thông báo + nút liên hệ gia sư thay vì bài học. Chỉ cho CHÍNH em đó.
    const suspended = isSuspended(enrolled) ? { contactHref: contactTutorHref({ id: course.id, ownerId: course.ownerId }) } : undefined;
    if (coRole) {
      // Đồng giảng: bỏ price / originalPrice / feeMode / tag / link nhóm Zalo và cả nhãn isFree (suy từ giá) — tiền và liên hệ phụ huynh chờ chủ (Q2–Q4).
      const view = redactCourseForRole(coRole, tree as unknown as Record<string, unknown>);
      return NextResponse.json({ ...view, role: coRole, canSeeMoney: canSeeMoney(coRole) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ ...(canViewAllMaterials(ctx) ? tree : redactCourseLinks(tree)), isFree, ...(suspended ? { suspended } : {}) });
  } catch (e) {
    console.error("[GET /api/courses/[id]]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

async function updateCourse(req: NextRequest, id: string, auth: Awaited<ReturnType<typeof requirePermission>>) {
  if (!("userId" in auth)) return auth;
  const existing = await prisma.course.findUnique({ where: { id }, select: { ownerId: true, price: true, originalPrice: true, lessons: true, hours: true, status: true, tag: true } });
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
    "capacity","classStatus","joinPolicy",
  ];
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  // NC2-035: như POST /api/courses — chỉ vai gia sư bị kiểm giá trị vô lý.
  if (auth.adminRole === "teacher") {
    // Giá trị KHÔNG đổi so với hiện có thì bỏ qua: lớp cũ (tạo trước khi có trần) vẫn sửa tên/trạng thái được.
    const changed = Object.fromEntries(Object.entries(data).filter(([k, v]) => !(k in existing && (existing as Record<string, unknown>)[k] === v)));
    const bad = validateTutorCourseFields(changed);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
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

  // BU-01: cách vào lớp. "open" chỉ cho lớp miễn phí (price 0 + dấu "Miễn phí" + chưa có đơn giá), tính trên giá trị SAU khi sửa.
  if ("joinPolicy" in data) {
    const jp = parseJoinPolicy(data.joinPolicy);
    if (!jp.ok) return NextResponse.json({ error: jp.error }, { status: 400 });
    if (jp.value === "open") {
      const rated = await loadFeeRateCourseIds([id]);
      const price = "price" in data ? Number(data.price) : existing.price;
      const tag = "tag" in data ? (typeof data.tag === "string" ? data.tag : null) : existing.tag;
      if (!canUseOpenPolicy({ price, tag, hasFeeRate: rated.has(id) })) {
        return NextResponse.json({ error: "Vào ngay chỉ dành cho lớp miễn phí" }, { status: 400 });
      }
    }
    data.joinPolicy = jp.value ?? null;
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
