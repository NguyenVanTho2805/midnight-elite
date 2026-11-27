// Vỏ của mọi trang dưới /lop-cua-toi, chọn theo người đang xem (máy chủ biết phiên ngay nên không nháy trang trần rồi mới có vỏ). Bốn nhánh (BU-00 bước 4–5,
// 31/10/2026, quy tắc thuần ở src/lib/tutorGate.ts tutorShellKind):
//   - gia sư → vỏ GIA SƯ (TT-203): thanh module bật sẵn + số việc, lấy ở máy chủ;
//   - gia sư CHỜ DUYỆT (role student + đơn đang chờ) → vỏ GIA SƯ dạng chờ duyệt (3 mục, băng "Hồ sơ gia sư đang chờ duyệt");
//   - học sinh → vỏ HỌC SINH (cùng quy tắc với src/lib/signedInShell.ts);
//   - quản trị cấp 1 / nội dung → SCL-B (21/11/2026, Q1): vỏ GIA SƯ bản "Chủ nhiệm" (module Lớp + nhóm "Quản lý" sang tên miền admin), không còn xem thử;
//   - role admin không rõ adminRole → vỏ HỌC SINH kèm băng "Đang xem thử giao diện học sinh · Về bảng quản trị";
//   - chưa đăng nhập → không vỏ: các trang tự chuyển sang /dang-nhap?redirect=…
// Dùng ở (tutor)/layout.tsx và [courseId]/layout.tsx. Trước 16/10/2026 chỉ nhóm (tutor) có vỏ và chỉ cho gia sư: trang lớp /lop-cua-toi/[lớp] của CẢ HAI vai và danh sách
// /lop-cua-toi của học sinh hiện ra trần, không còn đường đi đâu — bài rà vai học sinh bắt được, bài rà vai gia sư trước đó chỉ kiểm "vỏ sai", không kiểm "không vỏ".
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readPreferences, isTutorModuleVisible } from "@/lib/userPreferences";
import { loadScheduleCounters } from "@/lib/reminderServer";
import { loadTutorTodoTotal } from "@/lib/tutorDashboard";
import { tutorApplicationStatus } from "@/lib/tutorProfile";
import { isCenterAdmin, tutorShellKind } from "@/lib/tutorGate";
import { tutorShellManageLinks } from "@/lib/adminNav";
import type { AdminRole } from "@/lib/permissions";
import TutorShell from "@/components/tutor/TutorShell";
import { loadInboxTotal, loadRailClasses } from "@/lib/lopViecServer";
import StudentFrame from "@/components/shell/StudentFrame";
import { nguoiLopBca } from "@/lib/lop/phien";

export default async function LopCuaToiFrame({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  // Một truy vấn cho cả hai việc: module đã bật (gia sư) và trạng thái đơn gia sư (học sinh có đơn đang chờ). Quản trị không cần cột nào nhưng cùng một câu
  // cho gọn; lỗi DB → coi như không có đơn, vỏ theo vai trong cookie.
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { preferences: true, tutorAppliedAt: true, tutorVerified: true, tutorRejectedAt: true },
  }).catch(() => null);
  const status = me && session.role === "student" ? tutorApplicationStatus(me) : "none";
  const kind = tutorShellKind(session, status);

  if (kind === "tutor-pending") return <TutorShell badges={{}} pending>{children}</TutorShell>;
  if (kind === "student") return <StudentFrame>{children}</StudentFrame>;
  if (kind !== "tutor") return <StudentFrame preview>{children}</StudentFrame>; // quản trị không rõ cấp: xem thử
  // Chủ nhiệm: không Hộp việc / Lịch / Học phí riêng ⇒ không số đếm; nhóm Quản lý theo quyền từng trang quản trị.
  // SCL-G-GS: thanh "Lớp của bạn" (Chủ nhiệm: mọi lớp, nhóm theo gia sư) + số việc của Hộp việc dạy học. Lỗi DB → vỏ vẫn hiện, không danh sách / số.
  const [classes, lopViec] = await Promise.all([loadRailClasses(session).catch(() => undefined), loadInboxTotal(session, new Date()).catch(() => 0)]);
  if (isCenterAdmin(session)) return <TutorShell badges={{}} classes={classes} inbox={lopViec} manage={tutorShellManageLinks(session.adminRole as AdminRole)}>{children}</TutorShell>;

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
  // KiN lớp bước 7: mục "Lớp ôn" chỉ khi cờ LOP_ON bật (tắt ⇒ nguoiLopBca trả null, không đọc gì) và giáo viên có dòng bca_nguoi_dung chưa khoá.
  const lopOn = (await nguoiLopBca().catch(() => null))?.vai === "giao_vien";
  return <TutorShell modules={prefs.modules} badges={badges} classes={classes} inbox={lopViec} lopOn={lopOn}>{children}</TutorShell>;
}
