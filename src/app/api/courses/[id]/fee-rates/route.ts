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
import { FEE_MODE_SHEET, isNewFeeMode, normalizeFeeMode, pickClassRate, pickStudentRate, validateEffectiveFrom, validateFeeSetup } from "@/lib/tuitionFee";
import { floorViolation } from "@/lib/feeModeFloor";
import { buildFeeAuditMetadata, buildFeeOverrideNotification, feeAuditAction, isFeeOverride } from "@/lib/feeRuleAudit";
import { notify } from "@/lib/notify";

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

  // HP-LOP-TRUONG: lớp theo bảng học phí tháng không có đơn giá lớp (bậc theo số môn ở CourseFeeTable) → không bao giờ ghi CourseFeeRate / CourseStudentRate.
  if (mode === FEE_MODE_SHEET) {
    return NextResponse.json({ error: "Lớp này tính học phí theo bảng tháng, không có đơn giá lớp. Đổi bảng bậc ở tab Học phí.", code: "SHEET_MODE" }, { status: 409 });
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
  // HOCPHI-THEO-BUOI 3.3.5: lớp đã có mốc tháng chuyển thì không cho ngày hiệu lực lùi trước mốc (nếu không "sàn" bị hạ và hai hệ phí chồng nhau).
  const classRates = await prisma.courseFeeRate.findMany({ where: { courseId: id }, select: { effectiveFrom: true, rate: true }, orderBy: { effectiveFrom: "asc" } });
  const below = floorViolation(eff.dateKey, classRates);
  if (below) return NextResponse.json({ error: below }, { status: 400 });
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

  // Đơn giá đang hiệu lực tại ngày hiệu lực mới, đọc TRƯỚC khi đổi (để audit biết "từ bao nhiêu").
  let previousRate: number | null = null;
  if (apply) {
    if (change.type === "class") previousRate = pickClassRate(classRates, eff.dateKey)?.rate ?? null;
    else {
      const sr = await prisma.courseStudentRate.findMany({ where: { courseId: id, studentId: change.studentId }, select: { effectiveFrom: true, rate: true } });
      previousRate = pickStudentRate(sr, eff.dateKey)?.rate ?? null;
    }
  }

  const res = await changeRate(id, change, auth.userId, { apply, note });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const ownerId = r.course!.ownerId;
  const override = apply && isFeeOverride(auth.userId, ownerId);
  if (apply) {
    await logAction(auth.userId, feeAuditAction(change.type), "Course", id, buildFeeAuditMetadata({
      type: change.type, actorId: auth.userId, adminRole: auth.adminRole, ownerId, effectiveFrom: eff.dateKey, rate: change.rate,
      ...(change.type === "student" ? { studentId: change.studentId } : { sessionMinutes: change.sessionMinutes }),
      previousRate, repriced: res.plan.changedCount, delta: res.plan.delta, frozen: res.plan.frozenCount,
    }));
    // Quản trị ghi đè → báo chủ lớp (không tên/tiền/tên lớp). Chống dội: đã có thông báo CHƯA ĐỌC cùng loại + liên kết thì không tạo thêm.
    if (override && ownerId) {
      const n = buildFeeOverrideNotification(id);
      const pending = await prisma.notification.findFirst({ where: { userId: ownerId, type: n.type, link: n.link, isRead: false }, select: { id: true } });
      if (!pending) await notify(ownerId, n);
    }
  }
  const { updates, ...summary } = res.plan;
  return NextResponse.json({ ok: true, applied: apply, ...(apply ? { override } : {}), plan: { ...summary, updates: updates.slice(0, 50) }, perCourse: res.perCourse ?? null });
}
