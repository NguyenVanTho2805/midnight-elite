// HP-15/HP-16/HP-17 — đơn giá học phí của lớp tạo theo kiểu mới (theo buổi / giờ / khoá).
//   GET  → hình thức của lớp, lịch sử đơn giá lớp, đơn giá riêng từng em, danh sách em (chỉ lớp của chính gia sư; admin xem mọi lớp).
//   POST { action, ... } — mọi thay đổi có NGÀY HIỆU LỰC; "preview_*" chỉ XEM TRƯỚC tác động (không ghi), "set_*" mới ghi.
//     preview_class / set_class     { rate, sessionMinutes?, effectiveFrom, note? }       đổi đơn giá cả lớp từ ngày
//     preview_student / set_student { studentId, rate | null, effectiveFrom, note? }      đơn giá riêng của em; rate null = xoá mốc đó
// Lớp cách cũ (mặc định) → 409: giữ nguyên cách tính cũ. Phiếu và dòng phí đã chốt không bao giờ đổi (xem planReprice).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { feeOverview, changeRate, type RateChange } from "@/lib/feeChargeServer";
import { isNewFeeMode, normalizeFeeMode, validateEffectiveFrom, validateFeeSetup } from "@/lib/tuitionFee";

const RANGE_DAYS = 400;

async function authorize(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const course = await prisma.course.findUnique({ where: { id }, select: { ownerId: true, feeMode: true } });
  if (!course) return { res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  return { auth, course };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const [overview, students] = await Promise.all([
    feeOverview(id),
    prisma.enrollment.findMany({ where: { courseId: id, status: "active" }, select: { userId: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);
  return NextResponse.json({
    ...overview,
    students: students.map(s => ({ id: s.userId, name: s.user.name ?? "Học sinh" })),
    today: vnDateKeyOf(new Date()),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const auth = r.auth!;
  const mode = normalizeFeeMode(r.course!.feeMode);
  if (!isNewFeeMode(mode)) {
    return NextResponse.json({ error: "Lớp này tính học phí theo số buổi trong tháng (cách cũ) nên không đổi đơn giá ở đây." }, { status: 409 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  if (action !== "preview_class" && action !== "set_class" && action !== "preview_student" && action !== "set_student") {
    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  }
  const apply = action === "set_class" || action === "set_student";

  const eff = validateEffectiveFrom(body?.effectiveFrom);
  if (!eff.ok) return NextResponse.json({ error: eff.error }, { status: 400 });
  const today = vnDateKeyOf(new Date());
  if (eff.dateKey < addDaysKey(today, -RANGE_DAYS) || eff.dateKey > addDaysKey(today, RANGE_DAYS)) {
    return NextResponse.json({ error: `Ngày hiệu lực phải trong khoảng ${RANGE_DAYS} ngày quanh hôm nay` }, { status: 400 });
  }
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;

  let change: RateChange;
  if (action === "preview_class" || action === "set_class") {
    const v = validateFeeSetup({ mode, rate: body?.rate, sessionMinutes: body?.sessionMinutes });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    change = { type: "class", rate: v.value.rate, sessionMinutes: v.value.sessionMinutes, effectiveFrom: eff.dateKey };
  } else {
    const studentId = body?.studentId;
    if (typeof studentId !== "string" || !studentId) return NextResponse.json({ error: "Thiếu học sinh" }, { status: 400 });
    let rate: number | null = null;
    if (body?.rate !== null) {
      const v = validateFeeSetup({ mode, rate: body?.rate, sessionMinutes: mode === "per_hour" ? 60 : undefined }); // thời lượng không dùng ở đây, chỉ để dùng chung kiểm đơn giá
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      rate = v.value.rate;
      const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: studentId, courseId: id } }, select: { status: true } });
      if (!enr || enr.status !== "active") return NextResponse.json({ error: "Học sinh này không học lớp này" }, { status: 400 });
    }
    change = { type: "student", studentId, rate, effectiveFrom: eff.dateKey };
  }

  const res = await changeRate(id, change, auth.userId, { apply, note });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  if (apply) {
    await logAction(auth.userId, change.type === "class" ? "course_fee.set_rate" : "course_fee.set_student_rate", "Course", id, {
      effectiveFrom: eff.dateKey, rate: change.rate, ...(change.type === "student" ? { studentId: change.studentId } : { sessionMinutes: change.sessionMinutes }),
      repriced: res.plan.changedCount, delta: res.plan.delta, frozen: res.plan.frozenCount,
    });
  }
  const { updates, ...summary } = res.plan;
  return NextResponse.json({ ok: true, applied: apply, plan: { ...summary, updates: updates.slice(0, 50) }, perCourse: res.perCourse ?? null });
}
