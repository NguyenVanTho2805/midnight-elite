// NC2-011 — gửi tin `unmarked_daily` (thông báo trong ứng dụng + đẩy qua notify()/ĐX-02) cho mỗi gia sư còn buổi HÔM QUA chưa điểm danh.
// Gọi từ cron remind-class (07:00 VN), TRƯỚC mọi lệnh thoát sớm của cron đó. Quy tắc thuần ở unmarkedDaily.ts.
//
// Chỉ duyệt gia sư CÓ lớp đang mở với khung giờ hoạt động (một truy vấn); gia sư không có lớp không tốn truy vấn nào thêm.
// Chống gửi trùng: tối đa 1 thông báo `unmarked_daily` / gia sư / ngày VN (tra bảng Notification theo mốc 00:00 ngày VN) — cron chạy lại thì bỏ qua.
// Giờ yên lặng / PUSH_ENABLED / Preview: do notify() → pushToUser() xử lý như mọi loại tin (07:00 đúng không thuộc giờ yên lặng 22:00–07:00).
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { loadUnmarkedSessions } from "@/lib/unmarkedServer";
import { countUnmarkedOn, pickTutorsToRemind, unmarkedDailyMessage, vnDayStart, yesterdayKeyVn } from "@/lib/unmarkedDaily";

export interface UnmarkedDailyResult { date: string; tutorsChecked: number; notified: number; alreadySent: number }

export async function sendUnmarkedDaily(now: Date = new Date()): Promise<UnmarkedDailyResult> {
  const date = yesterdayKeyVn(now);
  const owners = await prisma.course.findMany({
    where: { ownerId: { not: null }, classStatus: "open", classSchedules: { some: { active: true } } },
    select: { ownerId: true }, distinct: ["ownerId"],
  });
  const tutorIds = owners.map(o => o.ownerId).filter((id): id is string => !!id);

  const counts: [string, number][] = [];
  for (const id of tutorIds) {
    try { counts.push([id, countUnmarkedOn(await loadUnmarkedSessions(id, now), date)]); }
    catch (e) { console.error("[unmarked_daily] không đếm được cho một gia sư:", e); }
  }
  const todo = pickTutorsToRemind(counts);
  if (todo.length === 0) return { date, tutorsChecked: tutorIds.length, notified: 0, alreadySent: 0 };

  const sent = await prisma.notification.findMany({
    where: { type: "unmarked_daily", userId: { in: todo.map(t => t.tutorId) }, createdAt: { gte: vnDayStart(now) } },
    select: { userId: true },
  });
  const done = new Set(sent.map(n => n.userId));
  let notified = 0;
  for (const t of todo) {
    if (done.has(t.tutorId)) continue;
    await notify(t.tutorId, { type: "unmarked_daily", title: "Buổi hôm qua chưa điểm danh", message: unmarkedDailyMessage(t.count), link: "/lop-cua-toi" }, { count: t.count });
    notified++;
  }
  return { date, tutorsChecked: tutorIds.length, notified, alreadySent: todo.length - notified };
}
