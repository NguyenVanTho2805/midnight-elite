// LO-13: tổng hợp LINK BÁO CÁO RIÊNG của cả lớp. GET → { items: [{ userId, state, links: [{ linkId, state, url }] }] }.
// KHÔNG trả tên người (giao diện ghép tên từ danh sách lớp đã có). Chỉ gia sư chủ lớp (lớp người khác 403, không có 404); chỉ em đang học lớp này.
// Bật / thu hồi từng em dùng /api/tutor/hoc-sinh/[userId]/bao-cao-link (cùng quyền, cùng token ngẫu nhiên 128 bit).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { reportLinkOf, reportPath } from "@/lib/tutorStudentView";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  if (course.ownerId !== auth.userId) return NextResponse.json({ error: "Lớp này không phải của bạn" }, { status: 403 });
  const enr = await prisma.enrollment.findMany({ where: { courseId, status: "active" }, select: { userId: true }, orderBy: { createdAt: "asc" } });
  const ids = enr.map(e => e.userId);
  const links = ids.length ? await prisma.parentLink.findMany({ where: { studentId: { in: ids }, status: "verified" }, select: { id: true, studentId: true, status: true, portalToken: true }, orderBy: { createdAt: "asc" } }) : [];
  const by = new Map<string, typeof links>();
  for (const l of links) { const a = by.get(l.studentId) ?? []; a.push(l); by.set(l.studentId, a); }
  return NextResponse.json({
    items: ids.map(userId => {
      const ls = by.get(userId) ?? [];
      return { userId, state: reportLinkOf(ls), links: ls.map(l => ({ linkId: l.id, state: l.portalToken ? "on" : "off", url: l.portalToken ? reportPath(l.portalToken) : null })) };
    }),
  }, { headers: NO_STORE });
}
