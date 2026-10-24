// BU-01 / BU-04 / LI-16 / LI-17 — trang buổi học của một lớp trong một ngày VN.
//   GET   → chi tiết buổi (kể cả khi CHƯA có bản ghi: buổi suy từ lịch tuần vẫn mở được; không tạo gì khi chỉ xem)
//   PATCH → ghi chép 3 phần (đã dạy, bài tập về nhà, nhận xét chung) + hình thức Online/Offline + địa chỉ + link riêng buổi
// Không đụng điểm danh hay tiền. Quyền: mẫu route chị em (MANAGE_COURSES + chủ lớp; lớp người khác 403, không có 404).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidDateKey } from "@/lib/classSessions";
import { parseSessionPatch } from "@/lib/sessionBook";
import { authorizeCourse, ensureSession, loadSessionDetail } from "@/lib/sessionBookServer";
import { logAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
type Ctx = { params: Promise<{ id: string; dateKey: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, dateKey } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  if (!isValidDateKey(dateKey)) return NextResponse.json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
  return NextResponse.json(await loadSessionDetail(r.course, dateKey), { headers: NO_STORE });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, dateKey } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  if (!isValidDateKey(dateKey)) return NextResponse.json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const p = parseSessionPatch(body);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  if (Object.keys(p.value).length === 0) return NextResponse.json({ error: "Chưa có gì để lưu" }, { status: 400 });

  const session = await ensureSession(prisma, id, dateKey, r.auth.userId);
  await prisma.attendanceSession.update({ where: { id: session.id }, data: p.value });
  // Nhật ký chỉ ghi tên các trường đã đổi, KHÔNG ghi nội dung ghi chép.
  await logAction(r.auth.userId, "attendance_session.notes", "AttendanceSession", session.id, { courseId: id, fields: Object.keys(p.value) });
  return NextResponse.json(await loadSessionDetail(r.course, dateKey), { headers: NO_STORE });
}
