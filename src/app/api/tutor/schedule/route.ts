// TT-201/202/203 — lịch tuần của gia sư: các buổi, tin nhắc tới hạn, báo nghỉ.
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (giờ VN, gồm cả hai đầu; mặc định tuần này, tối đa 62 ngày).
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { addDaysKey, isValidDateKey, MAX_WINDOW_DAYS, vnDateKeyOf, weekRangeOf } from "@/lib/classSessions";
import { loadScheduleCounters, loadTutorSchedule } from "@/lib/reminderServer";

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;

  const now = new Date();
  const sp = new URL(req.url).searchParams;
  const def = weekRangeOf(vnDateKeyOf(now));
  const from = sp.get("from") ?? def.from;
  const to = sp.get("to") ?? (sp.get("from") ? addDaysKey(from, 6) : def.to);
  if (!isValidDateKey(from) || !isValidDateKey(to)) return NextResponse.json({ error: "from/to phải có dạng YYYY-MM-DD" }, { status: 400 });
  if (from > to) return NextResponse.json({ error: "from phải trước hoặc bằng to" }, { status: 400 });
  if (addDaysKey(from, MAX_WINDOW_DAYS - 1) < to) return NextResponse.json({ error: `Chỉ xem tối đa ${MAX_WINDOW_DAYS} ngày một lần` }, { status: 400 });

  const [sched, counters] = await Promise.all([loadTutorSchedule(auth.userId, from, to, now), loadScheduleCounters(auth.userId, now)]);
  return NextResponse.json({ from, to, now: now.toISOString(), ...sched, counters });
}
