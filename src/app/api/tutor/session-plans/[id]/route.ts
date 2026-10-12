// PH-223 — một kế hoạch buổi.
//   GET    → kế hoạch đầy đủ (bản gia sư). Phiếu học sinh dựng ở giao diện từ chính dữ liệu này, bỏ đáp án và ghi chú gia sư.
//   PUT    { title, goal, dateKey, activities, updatedAt } → lưu. `updatedAt` là mốc lúc tải: nếu kế hoạch đã bị sửa ở nơi khác
//          (tab khác, máy khác) thì trả 409 thay vì ghi đè âm thầm.
//   DELETE → xoá
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { parsePlanInput, readActivities } from "@/lib/sessionPlan";

async function loadOwned(id: string, tutorId: string) {
  const r = await prisma.sessionPlan.findUnique({ where: { id } });
  return r && r.tutorId === tutorId ? r : null;
}
const present = (r: NonNullable<Awaited<ReturnType<typeof loadOwned>>>, courseName: string) => ({
  id: r.id, courseId: r.courseId, courseName, title: r.title, goal: r.goal ?? "", dateKey: r.dateKey,
  activities: readActivities(r.activities), updatedAt: r.updatedAt.toISOString(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await loadOwned(id, auth.userId);
  if (!r) return NextResponse.json({ error: "Không tìm thấy kế hoạch" }, { status: 404 });
  const course = await prisma.course.findUnique({ where: { id: r.courseId }, select: { name: true } });
  return NextResponse.json({ plan: present(r, course?.name ?? "") });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await loadOwned(id, auth.userId);
  if (!r) return NextResponse.json({ error: "Không tìm thấy kế hoạch" }, { status: 404 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = parsePlanInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const base = typeof body?.updatedAt === "string" ? new Date(body.updatedAt) : null;
  if (!base || Number.isNaN(base.getTime())) return NextResponse.json({ error: "Thiếu mốc updatedAt (tải lại kế hoạch)" }, { status: 400 });
  const p = parsed.value;
  const u = await prisma.sessionPlan.updateMany({
    where: { id, tutorId: auth.userId, updatedAt: base },
    data: { title: p.title, goal: p.goal || null, dateKey: p.dateKey, activities: p.activities as unknown as object },
  });
  if (u.count === 0) return NextResponse.json({ error: "Kế hoạch vừa được sửa ở nơi khác — tải lại trang để xem bản mới" }, { status: 409 });
  const fresh = await prisma.sessionPlan.findUnique({ where: { id } });
  const course = await prisma.course.findUnique({ where: { id: r.courseId }, select: { name: true } });
  return NextResponse.json({ ok: true, plan: present(fresh!, course?.name ?? "") });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const d = await prisma.sessionPlan.deleteMany({ where: { id, tutorId: auth.userId } });
  if (d.count === 0) return NextResponse.json({ error: "Không tìm thấy kế hoạch" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
