// BU-02 / BU-03 — "Đã dạy xong" (chốt buổi) và mở lại buổi đã chốt.
//   POST { action: "close" }                    → ghi state="closed" + closedAt rồi (lớp kiểu mới theo buổi/giờ) sinh/đồng bộ dòng phí của buổi.
//                                                  Chốt lần hai: bỏ qua, GIỮ thời điểm chốt cũ, không đụng dòng phí.
//   POST { action: "reopen", confirm?: boolean } → nếu phiếu tháng đã lập mà chưa confirm → 409 { needsConfirm, warning }. KHÔNG tự sửa phiếu.
//                                                  Mở lại: gỡ dòng phí CHƯA vào phiếu của buổi; dòng đã vào phiếu giữ nguyên (đóng băng).
//
// TIỀN (chủ chốt 24/10/2026): CHỐT BUỔI là điều kiện sinh phí của lớp kiểu mới. Lớp cũ (monthly_sessions) và lớp theo khoá: không ghi gì ở
// bảng phí. Không bao giờ đổi dòng đã vào phiếu / phiếu đã lập. Ghi trạng thái và dòng phí trong CÙNG một transaction, khoá theo buổi.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidDateKey } from "@/lib/classSessions";
import { closeCheck, isClosed } from "@/lib/sessionBook";
import { authorizeCourse, dayDate, ensureSession, loadSessionDetail, reopenImpact } from "@/lib/sessionBookServer";
import { logAction } from "@/lib/auditLog";
import { lockAttendanceSession, removeChargesOnReopen, syncChargesOnClose, type SyncResult } from "@/lib/feeChargeServer";

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
    let charges: SyncResult | null = null;
    if (!c.already) {
      // updateMany có điều kiện: hai lần bấm cùng lúc chỉ một lần ghi thời điểm chốt (và chỉ lần đó sinh phí).
      charges = await prisma.$transaction(async tx => {
        await lockAttendanceSession(tx, session.id);
        const u = await tx.attendanceSession.updateMany({ where: { id: session.id, OR: [{ state: null }, { state: { not: "closed" } }] }, data: { state: "closed", closedAt: now, closedBy: r.auth.userId } });
        return u.count === 1 ? syncChargesOnClose(tx, session.id, r.auth.userId) : null;
      });
      await logAction(r.auth.userId, "attendance_session.close", "AttendanceSession", session.id, { courseId: id, dateKey, chargesCreated: charges?.created ?? 0 });
    }
    return NextResponse.json({ ok: true, already: c.already, charges, detail: await loadSessionDetail(r.course, dateKey) }, { headers: NO_STORE });
  }

  if (body?.action === "reopen") {
    const session = await prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: id, date: dayDate(dateKey) } } });
    if (!session || !isClosed(session.state)) return NextResponse.json({ error: "Buổi này chưa chốt nên không cần mở lại" }, { status: 409 });
    const impact = await reopenImpact(prisma, session, r.course.ownerId);
    if (impact.warning && body.confirm !== true) {
      return NextResponse.json({ error: impact.warning, needsConfirm: true, warning: impact.warning, invoicedCharges: impact.invoicedCharges, invoices: impact.invoices }, { status: 409, headers: NO_STORE });
    }
    const removal = await prisma.$transaction(async tx => {
      await lockAttendanceSession(tx, session.id);
      const u = await tx.attendanceSession.updateMany({ where: { id: session.id, state: "closed" }, data: { state: "open", reopenedAt: now, closedAt: null, closedBy: null } });
      return u.count === 1 ? removeChargesOnReopen(tx, session.id) : null;
    });
    await logAction(r.auth.userId, "attendance_session.reopen", "AttendanceSession", session.id, { courseId: id, dateKey, hadInvoice: !!impact.warning, chargesRemoved: removal?.removed ?? 0 });
    return NextResponse.json({ ok: true, charges: removal, detail: await loadSessionDetail(r.course, dateKey) }, { headers: NO_STORE });
  }

  return NextResponse.json({ error: "action phải là close hoặc reopen" }, { status: 400 });
}
