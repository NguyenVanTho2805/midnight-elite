// BU-01 / BU-04 / LI-16 / LI-17 — trang buổi học của một lớp trong một ngày VN.
//   GET   → chi tiết buổi (kể cả khi CHƯA có bản ghi: buổi suy từ lịch tuần vẫn mở được; không tạo gì khi chỉ xem)
//   PATCH → ghi chép 3 phần (đã dạy, bài tập về nhà, nhận xét chung) + hình thức Online/Offline + địa chỉ + link riêng buổi
// Không đụng điểm danh hay tiền. Quyền: mẫu route chị em (MANAGE_COURSES + chủ lớp; lớp người khác 403, không có 404).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidDateKey } from "@/lib/classSessions";
import { parseSessionPatch } from "@/lib/sessionBook";
import { ensureSession, loadSessionDetail } from "@/lib/sessionBookServer";
import { requireCourseAccess, checkMarkSession, createdByFor, isHelperRole, roleForbidden } from "@/lib/courseAccessServer";
import { dayDate } from "@/lib/sessionBookServer";
import { logAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
type Ctx = { params: Promise<{ id: string; dateKey: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, dateKey } = await params;
  // TUT-dong-giang: đồng giảng / bộ môn XEM được (course.view) nhưng chi tiết bỏ cảnh báo phiếu (reopenWarning = tiền) và link nhóm Zalo phụ huynh.
  const acc = await requireCourseAccess(id, "course.view");
  if (!acc.ok) return acc.res;
  if (!isValidDateKey(dateKey)) return NextResponse.json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
  const c = await prisma.course.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true, classJoinUrl: true, zaloGroupUrl: true, calendarColor: true } });
  const detail = await loadSessionDetail(c!, dateKey);
  if (isHelperRole(acc.role)) {
    return NextResponse.json({ ...detail, reopenWarning: null, course: { ...detail.course, zaloGroupUrl: null } }, { headers: NO_STORE });
  }
  return NextResponse.json(detail, { headers: NO_STORE });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, dateKey } = await params;
  // TUT-dong-giang: ghi chép buổi MÌNH dạy (session.note.own). `taughtBy` do client gửi ⇒ 403 với đồng giảng (đổi người dạy chỉ chủ).
  const acc = await requireCourseAccess(id, "session.note.own");
  if (!acc.ok) return acc.res;
  if (!isValidDateKey(dateKey)) return NextResponse.json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (isHelperRole(acc.role) && body && typeof body === "object" && ("taughtBy" in body || "teacherId" in body)) return roleForbidden();
  const p = parseSessionPatch(body);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  if (Object.keys(p.value).length === 0) return NextResponse.json({ error: "Chưa có gì để lưu" }, { status: 400 });

  const existing = await prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: id, date: dayDate(dateKey) } }, select: { courseId: true, date: true, taughtBy: true, startTime: true, state: true } });
  if (isHelperRole(acc.role)) {
    // chỉ buổi mình dạy (ghi chép không sinh phí nên buổi đã chốt vẫn ghi được; chốt chỉ chủ)
    const denied = await checkMarkSession(acc, existing ? { ...existing, state: null } : null, dayDate(dateKey));
    if (denied) return denied;
  }
  const session = await ensureSession(prisma, id, dateKey, createdByFor(acc), isHelperRole(acc.role) ? { taughtBy: acc.session.userId } : {});
  await prisma.attendanceSession.update({ where: { id: session.id }, data: p.value });
  // Nhật ký chỉ ghi tên các trường đã đổi, KHÔNG ghi nội dung ghi chép.
  await logAction(acc.session.userId, "attendance_session.notes", "AttendanceSession", session.id, { courseId: id, fields: Object.keys(p.value) });
  const c = await prisma.course.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true, classJoinUrl: true, zaloGroupUrl: true, calendarColor: true } });
  const detail = await loadSessionDetail(c!, dateKey);
  if (isHelperRole(acc.role)) return NextResponse.json({ ...detail, reopenWarning: null, course: { ...detail.course, zaloGroupUrl: null } }, { headers: NO_STORE });
  return NextResponse.json(detail, { headers: NO_STORE });
}
