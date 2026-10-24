// LI-10 — kiểm xung đột lịch TRƯỚC khi lưu. Chỉ đọc, không ghi gì.
//   POST { dateKey, startTime, endTime, ignoreKey? }          → một buổi cụ thể (dời buổi, buổi lẻ/bù)
//   POST { dayOfWeek, startTime, endTime, ignoreScheduleId? } → một khung giờ hằng tuần
// Trả { conflicts: [{ kind: "gia-su"|"hoc-sinh", text, courseName, dateKey, sharedStudents }] } — chỉ SỐ em chung, KHÔNG có tên em.
import { NextRequest, NextResponse } from "next/server";
import { isValidDateKey, normalizeHm } from "@/lib/classSessions";
import { conflictText } from "@/lib/sessionBook";
import { authorizeCourse, conflictsForRule, conflictsForSlot } from "@/lib/sessionBookServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  if (!r.course.ownerId) return NextResponse.json({ conflicts: [] });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const start = normalizeHm(b?.startTime), end = normalizeHm(b?.endTime);
  if (!b || !start || !end) return NextResponse.json({ error: "Giờ phải có dạng HH:mm" }, { status: 400 });
  if (end <= start) return NextResponse.json({ error: "Giờ kết thúc phải sau giờ bắt đầu" }, { status: 400 });
  let list;
  if (typeof b.dateKey === "string") {
    if (!isValidDateKey(b.dateKey)) return NextResponse.json({ error: "Ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
    list = await conflictsForSlot(r.course.ownerId, { courseId: id, dateKey: b.dateKey, startTime: start, endTime: end, ignoreKey: typeof b.ignoreKey === "string" ? b.ignoreKey : undefined });
  } else if (typeof b.dayOfWeek === "number" && Number.isInteger(b.dayOfWeek) && b.dayOfWeek >= 0 && b.dayOfWeek <= 6) {
    list = await conflictsForRule(r.course.ownerId, { courseId: id, dayOfWeek: b.dayOfWeek, startTime: start, endTime: end, ignoreScheduleId: typeof b.ignoreScheduleId === "string" ? b.ignoreScheduleId : undefined });
  } else return NextResponse.json({ error: "Thiếu dateKey hoặc dayOfWeek" }, { status: 400 });
  return NextResponse.json({
    conflicts: list.map(c => ({ kind: c.kind, text: conflictText(c), courseName: c.other.courseName, dateKey: c.other.dateKey, sharedStudents: c.sharedStudents })),
  }, { headers: { "Cache-Control": "no-store" } });
}
