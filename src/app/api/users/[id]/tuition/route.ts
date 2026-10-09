// AS-192 — xem học phí 1 học viên trong 1 tháng.
//
// GET /api/users/[id]/tuition?yearMonth=YYYY-MM[&scholarship=X&discount=Y]
// Quyền:
//   - Chính học viên xem được của mình.
//   - Gia sư của ÍT NHẤT 1 lớp em đang học (Course.ownerId = session.userId).
//   - admin_super / admin_content luôn xem được.
//   - Phụ huynh (ParentLink verified) — chưa trong scope PR này; sẽ bổ sung
//     khi làm Sổ của con (TK-178) qua token riêng, không qua route này.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS, checkPermission } from "@/lib/permissions";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { computeMonthlyFee, parseYearMonth, type SubjectFeeInput } from "@/lib/tuition";

type FeeRow = { courseId: string; yearMonth: string; sessionCount: number; freeCount: number };
type FeeDelegate = { findMany(args: unknown): Promise<FeeRow[]> };
const fees = () => (prisma as unknown as { monthlyCourseFee: FeeDelegate }).monthlyCourseFee;

type OverrideRow = { pricePerSession: number };
type OverrideDelegate = { findUnique(args: unknown): Promise<OverrideRow | null> };
const overrides = () => (prisma as unknown as { tuitionOverride: OverrideDelegate }).tuitionOverride;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: userId } = await params;
  const ymParam = new URL(req.url).searchParams.get("yearMonth");
  const ym = parseYearMonth(ymParam);
  if (!ym) return NextResponse.json({ error: "yearMonth phải định dạng YYYY-MM" }, { status: 400 });

  // ── Scope quyền ──────────────────────────────────────────────────────────
  const isSelf = auth.userId === userId;
  const isTopAdmin = auth.role === "admin" &&
    checkPermission(auth.adminRole, PERMISSIONS.MANAGE_STUDENTS);
  let allowed = isSelf || isTopAdmin;
  if (!allowed && auth.role === "admin" && auth.adminRole === "teacher") {
    // Gia sư thấy học phí HV nếu có ít nhất 1 lớp HV đang học thuộc mình.
    const hit = await prisma.enrollment.findFirst({
      where:  {
        userId,
        status: ENROLLMENT_STATUS.ACTIVE,
        course: { ownerId: auth.userId },
      },
      select: { id: true },
    });
    allowed = !!hit;
  }
  if (!allowed) return NextResponse.json({ error: "Không có quyền xem" }, { status: 403 });

  // ── Lấy dữ liệu ──────────────────────────────────────────────────────────
  const enrollments = await prisma.enrollment.findMany({
    where:   { userId, status: ENROLLMENT_STATUS.ACTIVE },
    include: { course: { select: { id: true, name: true } } },
  });
  if (enrollments.length === 0) {
    return NextResponse.json({
      yearMonth: ym.yearMonth,
      breakdown: computeMonthlyFee({ subjects: [] }),
    });
  }

  const [feeRows, override] = await Promise.all([
    fees().findMany({
      where: {
        yearMonth: ym.yearMonth,
        courseId:  { in: enrollments.map(e => e.courseId) },
      },
    }),
    overrides().findUnique({ where: { userId } }),
  ]);
  const feeByCourse = new Map(feeRows.map(f => [f.courseId, f]));

  const subjects: SubjectFeeInput[] = enrollments.map(e => {
    const f = feeByCourse.get(e.courseId);
    return {
      courseId:     e.course.id,
      courseName:   e.course.name,
      sessionCount: f?.sessionCount ?? 0,
      freeCount:    f?.freeCount ?? 0,
    };
  });

  // Scholarship/discount lấy từ query string (admin UI có thể preview trước
  // khi lưu — thực tế lưu bằng model StudentMonthlyBill PR sau).
  const sp = new URL(req.url).searchParams;
  const scholarship = Math.max(0, Number(sp.get("scholarship") ?? "0") || 0);
  const discount    = Math.max(0, Number(sp.get("discount")    ?? "0") || 0);

  const breakdown = computeMonthlyFee({
    subjects,
    override: override?.pricePerSession ?? null,
    scholarship,
    discount,
  });

  return NextResponse.json({ yearMonth: ym.yearMonth, breakdown });
}
