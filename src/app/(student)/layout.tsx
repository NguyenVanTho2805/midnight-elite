// Vỏ học sinh kiểu Outlook (Figma 11:98): thanh module trái / thanh dưới, dải trên có logo + xu + chuông. Phòng thi (/student/thi-thu/<mã đề>) không có vỏ — xem StudentShell.
// SCL-H (P2-30, 21/11/2026): đọc phiên Ở MÁY CHỦ rồi truyền người dùng vào vỏ (trước đây cả nhóm là "use client": HTML chỉ có vòng xoay, phải chờ JS → /api/auth/me
// → dữ liệu trang, 3 vòng mạng). Lỗi DB → undefined: vỏ tự hỏi /api/auth/me như cũ, không chặn nhầm.
import { getSession } from "@/lib/session";
import { loadAuthUser } from "@/lib/authUserServer";
import StudentLayoutClient from "./StudentLayoutClient";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => undefined);
  const initialUser = session === undefined ? undefined : session ? await loadAuthUser(session.userId).catch(() => undefined) : null;
  return <StudentLayoutClient initialUser={initialUser}>{children}</StudentLayoutClient>;
}
