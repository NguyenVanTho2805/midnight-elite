import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScheduleAccess, roleForbidden } from "@/lib/courseAccessServer";
import { canEditSchedule } from "@/lib/courseAccess";
import { normalizeHm, normalizeJoinUrl } from "@/lib/classSessions";
import { conflictText, parseSessionPatch } from "@/lib/sessionBook";
import { conflictsForRule } from "@/lib/sessionBookServer";

// PUT /api/class-schedules/[id] — sửa 1 khung giờ học cố định.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TUT-dong-giang: chủ / quản trị sửa mọi khung; đồng giảng chỉ khung `teacherId = me` (và không đổi người dạy); bộ môn không sửa (403 ROLE_FORBIDDEN).
  const g = await requireScheduleAccess(id);
  if (!g.ok) return g.res;
  const auth = g.acc.session;
  const existing = g.schedule;
  if (!canEditSchedule(g.acc.role, auth.userId, existing.teacherId)) return roleForbidden();

  try {
    const body = await req.json();
    if (g.acc.role !== "owner" && g.acc.role !== "admin" && "teacherId" in (body as Record<string, unknown>)) return roleForbidden();
    const { dayOfWeek, startTime, endTime, note, active, joinUrl } = body as {
      dayOfWeek?: number; startTime?: string; endTime?: string; note?: string | null; active?: boolean; joinUrl?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (typeof dayOfWeek === "number") {
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json({ error: "Thứ trong tuần không hợp lệ" }, { status: 400 });
      }
      data.dayOfWeek = dayOfWeek;
    }
    if (startTime !== undefined) {
      const v = normalizeHm(startTime);
      if (!v) return NextResponse.json({ error: "Giờ bắt đầu phải có dạng HH:MM" }, { status: 400 });
      data.startTime = v;
    }
    if (endTime !== undefined) {
      const v = normalizeHm(endTime);
      if (!v) return NextResponse.json({ error: "Giờ kết thúc phải có dạng HH:MM" }, { status: 400 });
      data.endTime = v;
    }
    // So sánh với giá trị HIỆU LỰC sau khi cập nhật (field không đổi thì lấy
    // giá trị cũ) — chỉ so 2 field trong body chưa đủ, vì sửa 1 mình
    // startTime/endTime riêng lẻ vẫn có thể tạo khoảng giờ ngược nếu không đối
    // chiếu với giá trị đang lưu của field còn lại.
    const nextStart = (data.startTime as string | undefined) ?? existing.startTime;
    const nextEnd = (data.endTime as string | undefined) ?? existing.endTime;
    if (nextEnd <= nextStart) {
      return NextResponse.json({ error: "Giờ kết thúc phải sau giờ bắt đầu" }, { status: 400 });
    }
    if (note !== undefined) data.note = note?.trim() || null;
    if (joinUrl !== undefined) {
      const j = normalizeJoinUrl(joinUrl);
      if (!j.ok) return NextResponse.json({ error: "Link vào lớp phải là địa chỉ http(s) hợp lệ" }, { status: 400 });
      data.joinUrl = j.value;
    }
    if (typeof active === "boolean") data.active = active;
    // Chủ / quản trị giao khung cho giáo viên đang dạy trong lớp (null = về chủ lớp).
    if ("teacherId" in (body as Record<string, unknown>)) {
      const t = (body as Record<string, unknown>).teacherId;
      if (t === null || t === "" || t === existing.course.ownerId) data.teacherId = null;
      else if (typeof t === "string") {
        const ok = await prisma.courseTeacher.findFirst({ where: { courseId: existing.courseId, userId: t, status: "active" }, select: { id: true } });
        if (!ok) return NextResponse.json({ error: "Người dạy phải là giáo viên đang dạy trong lớp" }, { status: 400 });
        data.teacherId = t;
      } else return NextResponse.json({ error: "Người dạy không hợp lệ" }, { status: 400 });
    }
    // LI-16: hình thức + địa chỉ của khung giờ.
    if ("mode" in body || "location" in body) {
      const mp = parseSessionPatch({ ...("mode" in body ? { mode: (body as Record<string, unknown>).mode } : {}), ...("location" in body ? { location: (body as Record<string, unknown>).location } : {}) });
      if (!mp.ok) return NextResponse.json({ error: mp.error }, { status: 400 });
      if ("mode" in mp.value) data.mode = mp.value.mode ?? null;
      if ("location" in mp.value) data.location = mp.value.location ?? null;
    }
    // LI-10: kiểm xung đột khi gọi xin kiểm (checkConflicts), trừ khi đã chọn "vẫn lưu" (force) hoặc đang tắt khung giờ.
    if ((body as Record<string, unknown>).checkConflicts === true && (body as Record<string, unknown>).force !== true && active !== false && ((data.teacherId as string | null | undefined) ?? existing.teacherId ?? existing.course.ownerId)) {
      const conflicts = await conflictsForRule(((data.teacherId as string | null | undefined) ?? existing.teacherId ?? existing.course.ownerId) as string, {
        courseId: existing.courseId, dayOfWeek: (data.dayOfWeek as number | undefined) ?? existing.dayOfWeek, startTime: nextStart, endTime: nextEnd, ignoreScheduleId: id,
      });
      if (conflicts.length) return NextResponse.json({ error: "Khung giờ này trùng lịch.", needsConfirm: true, conflicts: conflicts.map(c => ({ kind: c.kind, text: conflictText(c), sharedStudents: c.sharedStudents })) }, { status: 409 });
    }

    const schedule = await prisma.classSchedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch (e) {
    console.error("[PUT /api/class-schedules/[id]]", id, e);
    return NextResponse.json({ error: "Cập nhật khung giờ học thất bại" }, { status: 400 });
  }
}

// DELETE /api/class-schedules/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TUT-dong-giang: đồng giảng chỉ xoá khung của MÌNH; không xoá khung của người khác / của chủ lớp.
  const g = await requireScheduleAccess(id);
  if (!g.ok) return g.res;
  if (!canEditSchedule(g.acc.role, g.acc.session.userId, g.schedule.teacherId)) return roleForbidden();

  try {
    await prisma.classSchedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/class-schedules/[id]]", id, e);
    return NextResponse.json({ error: "Xoá khung giờ học thất bại" }, { status: 400 });
  }
}
