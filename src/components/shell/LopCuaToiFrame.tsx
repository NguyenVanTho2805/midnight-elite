// Vỏ của mọi trang dưới /lop-cua-toi, chọn theo người đang xem (máy chủ biết phiên ngay nên không nháy trang trần rồi mới có vỏ):
//   - gia sư → vỏ GIA SƯ (TT-203): thanh module bật sẵn + số việc, lấy ở máy chủ;
//   - học sinh / quản trị xem thử → vỏ HỌC SINH (cùng quy tắc với src/lib/signedInShell.ts);
//   - chưa đăng nhập → không vỏ: các trang tự chuyển sang /dang-nhap?redirect=…
// Dùng ở (tutor)/layout.tsx và [courseId]/layout.tsx. Trước 16/10/2026 chỉ nhóm (tutor) có vỏ và chỉ cho gia sư: trang lớp /lop-cua-toi/[lớp] của CẢ HAI vai và danh sách
// /lop-cua-toi của học sinh hiện ra trần, không còn đường đi đâu — bài rà vai học sinh bắt được, bài rà vai gia sư trước đó chỉ kiểm "vỏ sai", không kiểm "không vỏ".
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readPreferences, isTutorModuleVisible } from "@/lib/userPreferences";
import { loadScheduleCounters } from "@/lib/reminderServer";
import { loadTutorTodoTotal } from "@/lib/tutorDashboard";
import TutorShell from "@/components/tutor/TutorShell";
import StudentFrame from "@/components/shell/StudentFrame";

export default async function LopCuaToiFrame({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>;
  if (session.role !== "admin" || session.adminRole !== "teacher") return <StudentFrame>{children}</StudentFrame>;

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

  // BU-00: truyền nguyên `prefs.modules` — vắng mặt là đủ module, không ép về `[]` (= chế độ gọn tường minh).
  return <TutorShell modules={prefs.modules} badges={badges}>{children}</TutorShell>;
}
