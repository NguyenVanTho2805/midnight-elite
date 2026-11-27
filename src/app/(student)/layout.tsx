// Vỏ học sinh kiểu Outlook (Figma 11:98): thanh module trái / thanh dưới, dải trên có logo + xu + chuông. Phòng thi (/student/thi-thu/<mã đề>) không có vỏ — xem StudentShell.
// SCL-H (P2-30, 21/11/2026): đọc phiên Ở MÁY CHỦ rồi truyền người dùng vào vỏ (trước đây cả nhóm là "use client": HTML chỉ có vòng xoay, phải chờ JS → /api/auth/me
// → dữ liệu trang, 3 vòng mạng). Lỗi DB → undefined: vỏ tự hỏi /api/auth/me như cũ, không chặn nhầm.
import { getSession } from "@/lib/session";
import { loadAuthUser } from "@/lib/authUserServer";
import { expireTrials } from "@/lib/trialServer";
import { coLopOn } from "@/lib/lop/server/hs";
import StudentLayoutClient from "./StudentLayoutClient";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => undefined);
  // SCL đợt 5 (D7): học thử của em đã quá hạn ⇒ lật trial_expired ngay khi em mở vỏ (không chờ cron đêm). Lỗi không chặn vỏ.
  if (session?.role === "student") await expireTrials({ userId: session.userId }).catch(() => undefined);
  const initialUser = session === undefined ? undefined : session ? await loadAuthUser(session.userId).catch(() => undefined) : null;
  // KiN lớp bước 7: mục "Lớp ôn" chỉ hiện khi cờ LOP_ON bật VÀ em có hồ sơ lớp (lần đầu mở vỏ thì nối hồ sơ theo Gmail đã xác minh). Cờ tắt ⇒ không đọc gì. Lỗi không chặn vỏ.
  const lopOn = session ? await coLopOn(session).catch(() => false) : false;
  return <StudentLayoutClient initialUser={initialUser} lopOn={lopOn}>{children}</StudentLayoutClient>;
}
