// BU-02 / BU-03 — "Đã dạy xong" (chốt buổi) và mở lại buổi đã chốt.
//   POST { action: "close" }                    → ghi state="closed" + closedAt. Chốt lần hai: bỏ qua, GIỮ thời điểm chốt cũ.
//   POST { action: "reopen", confirm?: boolean } → nếu phiếu tháng đã lập mà chưa confirm → 409 { needsConfirm, warning }. KHÔNG tự sửa phiếu.
//
// BẤT BIẾN TIỀN: route này chỉ ghi attendance_sessions.state/closedAt/closedBy/reopenedAt. Không gọi syncSessionCharges, không tạo/sửa/xoá
// FeeCharge, không đụng phiếu. Tiền vẫn do đường điểm danh sẵn có quyết định (PUT /api/attendance-sessions/[id]).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidDateKey } from "@/lib/classSessions";
import { closeCheck, isClosed } from "@/lib/sessionBook";
import { authorizeCourse, dayDate, ensureSession, loadSessionDetail, reopenImpact } from "@/lib/sessionBookServer";
import { logAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; dateKey: string }> }) {
  const { id, dateKey } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  if (!isValidDateKey(dateKey)) return NextResponse.json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { action?: unknown; confirm?: unknown } | null;
  const now = new Date();

  if (body?.action === "close") {
    // Kiểm ngày TRƯỚC khi tạo bản ghi: buổi chưa tới ngày thì không tạo buổi trống nào.
    const early = closeCheck({ dateKey, state: null, now });
    if (!early.ok) return NextResponse.json({ error: early.error }, { status: 400 });
    const session = await ensureSession(prisma, id, dateKey, r.auth.userId);
    const c = closeCheck({ dateKey, state: session.state, now });
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
    if (!c.already) {
      // updateMany có điều kiện: hai lần bấm cùng lúc chỉ một lần ghi thời điểm chốt.
      await prisma.attendanceSession.updateMany({ where: { id: session.id, OR: [{ state: null }, { state: { not: "closed" } }] }, data: { state: "closed", closedAt: now, closedBy: r.auth.userId } });
      await logAction(r.auth.userId, "attendance_session.close", "AttendanceSession", session.id, { courseId: id, dateKey });
    }
    return NextResponse.json({ ok: true, already: c.already, detail: await loadSessionDetail(r.course, dateKey) }, { headers: NO_STORE });
  }

  if (body?.action === "reopen") {
    const session = await prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: id, date: dayDate(dateKey) } } });
    if (!session || !isClosed(session.state)) return NextResponse.json({ error: "Buổi này chưa chốt nên không cần mở lại" }, { status: 409 });
    const impact = await reopenImpact(prisma, session, r.course.ownerId);
    if (impact.warning && body.confirm !== true) {
      return NextResponse.json({ error: impact.warning, needsConfirm: true, warning: impact.warning, invoicedCharges: impact.invoicedCharges, invoices: impact.invoices }, { status: 409, headers: NO_STORE });
    }
    await prisma.attendanceSession.updateMany({ where: { id: session.id, state: "closed" }, data: { state: "open", reopenedAt: now, closedAt: null, closedBy: null } });
    await logAction(r.auth.userId, "attendance_session.reopen", "AttendanceSession", session.id, { courseId: id, dateKey, hadInvoice: !!impact.warning });
    return NextResponse.json({ ok: true, detail: await loadSessionDetail(r.course, dateKey) }, { headers: NO_STORE });
  }

  return NextResponse.json({ error: "action phải là close hoặc reopen" }, { status: 400 });
}
