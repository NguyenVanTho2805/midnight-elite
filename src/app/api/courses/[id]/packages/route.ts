// HP-31 — gói buổi trả trước và sổ sử dụng của một lớp kiểu mới (theo buổi / theo giờ). SỔ BUỔI: không thu, không chuyển, không gạch nợ tiền.
//   GET  → các gói của lớp (kèm số buổi còn lại, lịch sử trừ buổi). Có tên em: chỉ gia sư chủ lớp / quản trị.
//   POST { studentId, sessions, note? } → lập gói; giá một buổi CHỤP theo đơn giá lớp (hoặc giá riêng của em) tại ngày lập, chỉ để ghi lại.
// Quyền như các route lớp chị em: chủ lớp / quản trị; lớp người khác 403, không có 404. Lớp cũ / theo khoá: 409.
import { NextRequest, NextResponse } from "next/server";
import { logAction } from "@/lib/auditLog";
import { authorizeCourse } from "@/lib/sessionBookServer";
import { createPackage, listCoursePackages } from "@/lib/sessionPackageServer";
import { PACKAGE_NOTICE, parsePackageInput } from "@/lib/sessionPackage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  const [items, enr] = await Promise.all([
    listCoursePackages(id),
    prisma.enrollment.findMany({ where: { courseId: id, status: "active" }, include: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);
  return NextResponse.json({ items, students: enr.map(e => ({ id: e.user.id, name: e.user.name })), notice: PACKAGE_NOTICE }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  const v = parsePackageInput(await req.json().catch(() => null));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const res = await createPackage({ courseId: id, by: r.auth.userId, input: v.value });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  await logAction(r.auth.userId, "session_package.create", "SessionPackage", res.id, { courseId: id, sessions: v.value.sessions, totalPrice: res.totalPrice });
  return NextResponse.json({ ok: true, id: res.id, unitPrice: res.unitPrice, totalPrice: res.totalPrice }, { status: 201, headers: NO_STORE });
}
