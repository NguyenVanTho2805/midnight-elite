// HS-06: đánh dấu học sinh "Đã nghỉ" (suspended) hoặc cho học lại (active). Body: { status, courseId? }. KHÔNG xoá gì: điểm danh, điểm, phiếu, hồ sơ đều giữ nguyên.
// Không có courseId = áp cho mọi lớp CỦA GIA SƯ NÀY mà em đang ghi danh (không đụng lớp của gia sư khác). "pending_consent" không đổi được ở đây.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { checkStatusChange, isSettableStatus } from "@/lib/tutorStudentView";
import { ownStudent } from "@/lib/tutorStudentDetailServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { userId } = await params;
  const own = await ownStudent(auth, userId);
  if ("res" in own) return own.res;
  const b = await req.json().catch(() => null) as { status?: unknown; courseId?: unknown } | null;
  if (!isSettableStatus(b?.status)) return NextResponse.json({ error: "Trạng thái phải là đang học hoặc đã nghỉ" }, { status: 400 });
  const to = b.status;
  if (b.courseId !== undefined && b.courseId !== null && typeof b.courseId !== "string") return NextResponse.json({ error: "Lớp không hợp lệ" }, { status: 400 });
  const enrolls = await prisma.enrollment.findMany({
    where: { userId, course: { ownerId: auth.userId }, ...(typeof b.courseId === "string" && b.courseId ? { courseId: b.courseId } : {}) },
    select: { id: true, courseId: true, status: true },
  });
  if (!enrolls.length) return NextResponse.json({ error: "Không tìm thấy lớp của bạn có em này" }, { status: 404, headers: NO_STORE });
  const blocked = enrolls.map(e => checkStatusChange(e.status, to)).find(r => !r.ok);
  if (blocked && !blocked.ok) return NextResponse.json({ error: blocked.error }, { status: 409, headers: NO_STORE });
  const todo = enrolls.filter(e => e.status !== to);
  if (todo.length) {
    await prisma.enrollment.updateMany({ where: { id: { in: todo.map(e => e.id) } }, data: { status: to } });
    await logAction(auth.userId, to === "suspended" ? "enrollment.mark_left" : "enrollment.mark_back", "User", userId, { courseIds: todo.map(e => e.courseId) });
  }
  return NextResponse.json({ ok: true, changed: todo.length, status: to }, { headers: NO_STORE });
}
