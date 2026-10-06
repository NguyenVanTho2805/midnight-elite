// AS-192 — gia sư nhập/sửa số buổi tháng cho lớp của mình.
//
// GET  /api/courses/[id]/fees?yearMonth=YYYY-MM — xem bản ghi tháng.
// PUT  /api/courses/[id]/fees — upsert theo (courseId, yearMonth).
//      Body: { yearMonth, sessionCount, freeCount? }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { parseYearMonth, validateSessionCount } from "@/lib/tuition";
import { logAction } from "@/lib/auditLog";

type FeeRow = { id: string; courseId: string; yearMonth: string; sessionCount: number; freeCount: number; updatedBy: string; updatedAt: Date };
type FeeDelegate = {
  findUnique(args: unknown): Promise<FeeRow | null>;
  upsert(args: unknown): Promise<FeeRow>;
};
const fees = () => (prisma as unknown as { monthlyCourseFee: FeeDelegate }).monthlyCourseFee;

async function authorize(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const course = await prisma.course.findUnique({ where: { id }, select: { ownerId: true } });
  if (!course) return { res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) {
    return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  }
  return { auth };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;

  const ym = parseYearMonth(new URL(req.url).searchParams.get("yearMonth"));
  if (!ym) return NextResponse.json({ error: "yearMonth phải định dạng YYYY-MM" }, { status: 400 });

  const row = await fees().findUnique({ where: { courseId_yearMonth: { courseId: id, yearMonth: ym.yearMonth } } });
  return NextResponse.json({ fee: row });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const auth = r.auth!;

  let body: { yearMonth?: unknown; sessionCount?: unknown; freeCount?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const ym = parseYearMonth(body.yearMonth);
  if (!ym) return NextResponse.json({ error: "yearMonth phải định dạng YYYY-MM" }, { status: 400 });

  const sessionCount = validateSessionCount(body.sessionCount);
  if (sessionCount == null) {
    return NextResponse.json({ error: "sessionCount phải là số nguyên 0–60" }, { status: 400 });
  }
  const freeCount = body.freeCount == null ? 0 : validateSessionCount(body.freeCount);
  if (freeCount == null) {
    return NextResponse.json({ error: "freeCount phải là số nguyên 0–60" }, { status: 400 });
  }
  if (freeCount > sessionCount) {
    return NextResponse.json({ error: "Số buổi miễn không vượt quá tổng số buổi" }, { status: 400 });
  }

  const row = await fees().upsert({
    where: { courseId_yearMonth: { courseId: id, yearMonth: ym.yearMonth } },
    create: { courseId: id, yearMonth: ym.yearMonth, sessionCount, freeCount, updatedBy: auth.userId },
    update: { sessionCount, freeCount, updatedBy: auth.userId },
  });

  await logAction(auth.userId, "monthly_course_fee.upsert", "MonthlyCourseFee", row.id, {
    courseId: id, yearMonth: ym.yearMonth, sessionCount, freeCount,
  });

  return NextResponse.json({ fee: row });
}
