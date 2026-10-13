import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadStudentScheduleEvents } from "@/lib/studentSchedule";

export type { ScheduleEvent } from "@/lib/studentSchedule";

// Lịch của học sinh. Logic nằm ở src/lib/studentSchedule.ts để "Việc của tôi" dùng chung đúng một nguồn.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  return NextResponse.json({ events: await loadStudentScheduleEvents(session.userId, new Date()) });
}
