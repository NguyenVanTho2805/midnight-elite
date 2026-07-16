import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownerScopeWhere } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyMany } from "@/lib/notify";

// Sinh mã đề duy nhất ở server (không tin mã client tự tính) — client chỉ thấy
// đề của mình (ownerScopeWhere), nên đếm số đề theo prefix ở phía client dễ bị
// trùng mã với đề của giáo viên/admin khác (Exam.code có ràng buộc @unique).
function examCodePrefix(category: string): string {
  if (category.includes("HSA")) return "HSA";
  if (category.includes("HCM")) return "HCM";
  if (category.includes("TSA")) return "TSA";
  if (category.includes("BCA")) return "BCA";
  return "THPT";
}

async function generateUniqueExamCode(category: string): Promise<string> {
  const prefix = examCodePrefix(category);
  const count = await prisma.exam.count({ where: { code: { startsWith: `${prefix}.` } } });
  for (let i = 0; i < 50; i++) {
    const code = `${prefix}.${String(count + 1 + i).padStart(2, "0")}`;
    const exists = await prisma.exam.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Không tạo được mã đề duy nhất");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status   = searchParams.get("status");
  const activeOnly      = searchParams.get("active") === "true";
  const activeGuestOnly = searchParams.get("activeGuest") === "true";

  // activeGuest=true là public endpoint — không cần auth
  // Các query khác (active=true, category, status) yêu cầu session
  let scopeWhere: { ownerId?: string } = {};
  if (!activeGuestOnly) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    // Danh sách quản trị (admin panel) — giáo viên chỉ thấy đề của mình.
    // Học viên xem danh sách đề (không phải panel admin) không bị scope này.
    if (session.role === "admin") scopeWhere = ownerScopeWhere(session);
  }

  try {
    const exams = await prisma.exam.findMany({
      where: {
        ...(category        ? { category }             : {}),
        ...(status          ? { status }               : {}),
        ...(activeOnly      ? { active: true }         : {}),
        ...(activeGuestOnly ? { activeGuest: true }    : {}),
        ...scopeWhere,
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { examQuestions: true } } },
    });

    // Không bao giờ trả password thô qua API — chỉ báo có/không có mật khẩu.
    return NextResponse.json(
      exams.map(({ _count, password, ...e }) => ({ ...e, hasQuestions: _count.examQuestions > 0, hasPassword: !!password }))
    );
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
                     "questions", "status", "azotaUrl", "participants", "active", "activeGuest", "guestCanTake",
                     "createdAt", "courseId", "price", "password", "showLeaderboard", "totalPoints"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    data.ownerId = auth.userId;
    data.code = await generateUniqueExamCode(typeof data.category === "string" ? data.category : "");
    if (typeof data.password === "string") data.password = data.password.trim() || null;

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
        link:    `/thi-thu`,
      });
    }

    // Không bao giờ trả password thô qua API — chỉ báo có/không có mật khẩu.
    const { password, ...rest } = exam;
    return NextResponse.json({ ...rest, hasPassword: !!password }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exams]", e);
    return NextResponse.json({ error: "Tạo đề thi thất bại" }, { status: 400 });
  }
}
