// HP-18/HP-19 — phí khác áp chung cả lớp (tài liệu, quỹ lớp, phí thi…), thành dòng phí trong phiếu.
//   GET  → các khoản phí khác của lớp (50 gần nhất): tên, số tiền, ngày, của em nào, đã vào phiếu chưa.
//   POST { action: "add", label, amount, dateKey?, studentIds? }  mỗi em một dòng; bỏ trống studentIds = cả lớp
//   POST { action: "remove", chargeId }                          gỡ khoản CHƯA vào phiếu
// Quyền như các route lớp chị em: chủ lớp / quản trị; lớp người khác 403, không có 404.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { addDaysKey, isValidDateKey, vnDateKeyOf } from "@/lib/classSessions";
import { addExtraFee, removeExtraFee } from "@/lib/feeChargeServer";
import { validateExtraFee } from "@/lib/tuitionFee";

async function authorize(id: string) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return { res: auth as NextResponse };
  const course = await prisma.course.findUnique({ where: { id }, select: { ownerId: true } });
  if (!course) return { res: NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 }) };
  if (!ownsResource(auth, course.ownerId)) return { res: NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 }) };
  return { auth };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const rows = await prisma.feeCharge.findMany({ where: { courseId: id, kind: "extra" }, orderBy: [{ dateKey: "desc" }, { createdAt: "desc" }], take: 50 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map(x => x.studentId))] } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map(u => [u.id, u.name]));
  return NextResponse.json({
    today: vnDateKeyOf(new Date()),
    items: rows.map(x => ({ id: x.id, label: x.label, amount: x.amount, dateKey: x.dateKey, studentId: x.studentId, studentName: nameOf.get(x.studentId) ?? "Học sinh", invoiced: !!x.invoiceId })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorize(id);
  if (r.res) return r.res;
  const auth = r.auth!;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (body?.action === "remove") {
    if (typeof body.chargeId !== "string") return NextResponse.json({ error: "Thiếu khoản cần gỡ" }, { status: 400 });
    const ok = await removeExtraFee(id, body.chargeId);
    if (!ok) return NextResponse.json({ error: "Khoản này đã vào phiếu (không gỡ được) hoặc không còn" }, { status: 409 });
    await logAction(auth.userId, "course_fee.extra_remove", "Course", id, { chargeId: body.chargeId });
    return NextResponse.json({ ok: true });
  }
  if (body?.action !== "add") return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });

  const v = validateExtraFee({ label: body.label, amount: body.amount });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const today = vnDateKeyOf(new Date());
  const dateKey = body.dateKey === undefined || body.dateKey === "" ? today : body.dateKey;
  if (typeof dateKey !== "string" || !isValidDateKey(dateKey) || dateKey < addDaysKey(today, -400) || dateKey > addDaysKey(today, 400)) {
    return NextResponse.json({ error: "Ngày phát sinh không hợp lệ (trong khoảng 400 ngày quanh hôm nay)" }, { status: 400 });
  }
  let studentIds: string[] | null = null;
  if (body.studentIds !== undefined && body.studentIds !== null) {
    if (!Array.isArray(body.studentIds) || body.studentIds.some(x => typeof x !== "string")) return NextResponse.json({ error: "studentIds không hợp lệ" }, { status: 400 });
    studentIds = body.studentIds as string[];
  }
  const out = await addExtraFee({ courseId: id, by: auth.userId, label: v.label, amount: v.amount, dateKey, studentIds });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  await logAction(auth.userId, "course_fee.extra_add", "Course", id, { label: v.label, amount: v.amount, dateKey, created: out.created, skippedDuplicate: out.skippedDuplicate, total: out.total });
  return NextResponse.json({ ok: true, created: out.created, skippedDuplicate: out.skippedDuplicate, total: out.total }, { status: 201 });
}
