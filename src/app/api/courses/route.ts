import { featureOn } from "@/lib/features";
import { NextRequest, NextResponse } from "next/server";
import { isReservedCourseId } from "@/lib/courseIds";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownerScopeWhere } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { validateTutorCourseFields } from "@/lib/courseValidation";
import { FEE_MODE_LEGACY, FEE_MODE_SHEET, validateFeeSetup, type FeeSetup } from "@/lib/tuitionFee";
import { PREVIEW_BLOCKED_MESSAGE, createInitialFeeRate, moneyPathsBlocked } from "@/lib/feeChargeServer";
import { courseFor, type MediaViewer } from "@/lib/mediaAccess";
import { canUseOpenPolicy, isFreeClass, parseJoinPolicy } from "@/lib/joinRequest";
import { loadFeeRateCourseIds } from "@/lib/enrollServer";
import { SCHEDULES_MAX_PER_COURSE, parseScheduleInput, type ScheduleInput } from "@/lib/scheduleInput";

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
    // BU-01: `isFree` tính sẵn bằng isFreeClass (một truy vấn cho cả trang) để mọi nơi hiện nhãn "Miễn phí" dùng cùng một điều kiện.
    const rated = await loadFeeRateCourseIds(courses.map(c => c.id));
    return NextResponse.json(courses.map(c => ({
      ...courseFor({ viewer, courseOwnerId: c.ownerId, enrollment: enrollmentOf.get(c.id) ?? null }, c),
      isFree: isFreeClass({ price: c.price, tag: c.tag, hasFeeRate: rated.has(c.id) }),
    })));
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
      "introVideo","price","originalPrice","lessons","hours","status","joinPolicy",
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
    // HOCPHI-THEO-BUOI 3.1: có đơn giá (feeRate) mà không nói feeMode → mặc định theo buổi. Không gửi cả hai → lớp cũ như trước (đường quản trị / ngăn kéo cũ).
    // HP-BO (17/11/2026): phần Học phí đang ẩn (cờ HOC_PHI tắt) ⇒ bỏ qua mọi trường học phí: lớp tạo ra là lớp mặc định, không có đơn giá, chốt buổi không sinh phí.
    const feeModeIn: unknown = !featureOn("HOC_PHI") ? undefined
      : body.feeMode !== undefined ? body.feeMode : (body.feeRate !== undefined && body.feeRate !== null ? "per_session" : undefined);
    let feeSetup: FeeSetup | null = null;
    if (feeModeIn !== undefined && feeModeIn !== FEE_MODE_LEGACY) {
      if (moneyPathsBlocked()) return NextResponse.json({ error: PREVIEW_BLOCKED_MESSAGE }, { status: 503 });
      const v = validateFeeSetup({ mode: feeModeIn, rate: body.feeRate, sessionMinutes: body.feeSessionMinutes });
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      feeSetup = v.value;
    }

    // BU-01: cách vào lớp. "open" (vào ngay) chỉ cho lớp miễn phí: price 0 + dấu "Miễn phí" + không nhập đơn giá lúc tạo.
    if ("joinPolicy" in data) {
      const jp = parseJoinPolicy(data.joinPolicy);
      if (!jp.ok) return NextResponse.json({ error: jp.error }, { status: 400 });
      if (jp.value === "open" && !canUseOpenPolicy({ price: Number(data.price ?? 0), tag: typeof data.tag === "string" ? data.tag : null, hasFeeRate: !!feeSetup })) {
        return NextResponse.json({ error: "Vào ngay chỉ dành cho lớp miễn phí" }, { status: 400 });
      }
      data.joinPolicy = jp.value ?? null;
    }

    // TUT-lich-keo-tha: khung giờ hằng tuần tạo CÙNG LÚC với lớp (một giao dịch). Không gửi `schedules` và không bật `requireSchedule` → hành vi cũ 100%.
    // Một khung sai → 400 kèm `index`, KHÔNG tạo gì. `requireSchedule` (wizard gửi) mà không có khung và không `noFixedSchedule` → 400 `schedule_required`.
    const scheduleRows: ScheduleInput[] = [];
    if (body.schedules !== undefined && body.schedules !== null) {
      if (!Array.isArray(body.schedules)) return NextResponse.json({ error: "schedules phải là danh sách khung giờ", field: "schedules" }, { status: 400 });
      if (body.schedules.length > SCHEDULES_MAX_PER_COURSE) {
        return NextResponse.json({ error: `Một lớp có tối đa ${SCHEDULES_MAX_PER_COURSE} khung giờ.`, field: "schedules" }, { status: 400 });
      }
      for (let i = 0; i < body.schedules.length; i++) {
        const p = parseScheduleInput(body.schedules[i]);
        if (!p.ok) return NextResponse.json({ error: p.error, field: "schedules", index: i }, { status: 400 });
        scheduleRows.push(p.value);
      }
    }
    if (body.requireSchedule === true && scheduleRows.length === 0 && body.noFixedSchedule !== true) {
      return NextResponse.json({ error: "Lớp cần ít nhất một khung giờ học hằng tuần, hoặc chọn lớp học buổi lẻ.", code: "schedule_required" }, { status: 400 });
    }

    // Mã trùng tên một trang cố định của KiN (vd "lich") thì trang lớp không bao giờ mở được — xem src/lib/courseIds.ts.
    if (isReservedCourseId(data.id)) {
      return NextResponse.json({ error: `Mã "${data.id}" trùng tên một trang của KiN. Hãy đặt tên lớp khác để tạo mã khác.` }, { status: 400 });
    }

    // Mã lớp trùng (hai gia sư cùng đặt "Toán 9"): HP-BO (17/11/2026) gia sư được tự thêm hậu tố -2, -3… thay vì báo lỗi "Slug" khó hiểu. Quản trị giữ báo trùng như cũ.
    let existing = await prisma.course.findUnique({ where: { id: data.id as string }, select: { id: true } });
    if (existing && auth.adminRole === "teacher") {
      const base = String(data.id);
      for (let n = 2; n <= 50 && existing; n++) {
        const cand = `${base}-${n}`;
        if (isReservedCourseId(cand)) continue;
        existing = await prisma.course.findUnique({ where: { id: cand }, select: { id: true } });
        if (!existing) data.id = cand;
      }
    }
    if (existing) {
      return NextResponse.json(
        { error: "Đã có lớp trùng mã này. Hãy đặt tên lớp khác một chút (vd thêm năm học hoặc ca học)." },
        { status: 409 },
      );
    }

    data.createdAt = new Date().toLocaleDateString("vi-VN") + " 08:00:00";
    data.ownerId = auth.userId;
    // SCL-A (P1-4): tên gia sư = tên thật của người tạo lớp (cùng nguồn với màn vào lớp: owner.name), không để trống / tên giữ chỗ "KiN".
    const instr = typeof data.instructor === "string" ? data.instructor.trim() : "";
    if (!instr || instr.toLowerCase() === "kin") {
      const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
      const nm = me?.name?.trim() ?? "";
      data.instructor = nm;
      data.teacherAvatar = nm.charAt(0).toUpperCase();
    }
    // SCL-A (P1-3, Q10): lớp của gia sư là riêng — chỉ lớp "Vào ngay" (open) hiện ở trang công khai, bất kể client gửi gì.
    if (auth.adminRole === "teacher") data.status = data.joinPolicy === "open";

    // adminId trong transaction để tránh race condition giữa hai POST đồng thời
    const course = await prisma.$transaction(async (tx) => {
      const maxRow = await tx.course.findFirst({ orderBy: { adminId: "desc" }, select: { adminId: true } });
      data.adminId = (maxRow?.adminId ?? 0) + 1;
      if (feeSetup) data.feeMode = feeSetup.mode;
      const created = await tx.course.create({ data: data as Parameters<typeof prisma.course.create>[0]["data"] });
      // HP-LOP-TRUONG: lớp "theo bảng học phí tháng" KHÔNG có đơn giá lớp → không tạo CourseFeeRate (bậc đặt sau ở tab Học phí: CourseFeeTable).
      if (feeSetup && feeSetup.mode !== FEE_MODE_SHEET) await createInitialFeeRate(tx, created.id, feeSetup, auth.userId);
      if (scheduleRows.length) await tx.classSchedule.createMany({ data: scheduleRows.map(r => ({ courseId: created.id, ...r })) });
      return created;
    });
    return NextResponse.json({ ...course, scheduleCount: scheduleRows.length }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/courses]", e);
    return NextResponse.json({ error: "Tạo khóa học thất bại" }, { status: 400 });
  }
}
