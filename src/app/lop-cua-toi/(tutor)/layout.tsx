// TT-203 — vỏ của gia sư: thanh module bên trái (điện thoại: thanh dưới), chỉ hiện module đang
// bật. Mặc định "chế độ gọn": Lịch + Học phí. Học viên/quản trị mở các trang này thì không có vỏ.
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readPreferences, isTutorModuleVisible } from "@/lib/userPreferences";
import { loadScheduleCounters } from "@/lib/reminderServer";
import { loadTutorTodoTotal } from "@/lib/tutorDashboard";
import TutorShell from "@/components/tutor/TutorShell";

export default async function TutorGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin" || session.adminRole !== "teacher") return <>{children}</>;

  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true } });
  const prefs = readPreferences(me?.preferences);
  const inboxOn = isTutorModuleVisible(prefs, "hop-viec");
  const now = new Date();
  // Số đếm chỉ tính khi cần hiển thị: Hộp việc bật → badge Hộp việc; tắt → việc hiện ở Lịch (TT-203).
  const [inbox, sched] = await Promise.all([
    inboxOn ? loadTutorTodoTotal(session.userId, now) : Promise.resolve(0),
    inboxOn ? Promise.resolve(null) : loadScheduleCounters(session.userId, now),
  ]);
  const badges: Record<string, number> = {};
  if (inboxOn) badges["hop-viec"] = inbox;
  else if (sched) badges["lich"] = sched.pendingAbsences + sched.remindersDue;

  return <TutorShell modules={prefs.modules ?? []} badges={badges}>{children}</TutorShell>;
}
