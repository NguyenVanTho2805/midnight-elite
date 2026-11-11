// BU-05 — chi tiết bài toàn trang kiểu Threads. Máy chủ chỉ đặt metadata chung (không đọc DB nên không lộ gì về bài); phần động ở ThreadDetailView.
// LOI-01 (11/11/2026): khi bảng tin cộng đồng đang ẨN (src/lib/features.ts, cờ CONG_DONG), trang này vẫn mở cho câu hỏi TRONG LỚP (Thread.courseId != null) —
// Hộp việc gia sư (src/lib/tutorInboxServer.ts) và thông báo trả lời trỏ đúng /cong-dong/<id>. Chọn giữ đường này thay vì đổi link sang chỗ khác vì ít đụng nhất:
// một chỗ kiểm ở đây phủ cả Hộp việc lẫn mọi thông báo cũ, không phải sửa từng nơi tạo link. Quyền xem bài lớp vẫn do API /api/community/threads/<id> quyết (403 → "Không tìm thấy").
// Bài cộng đồng CHUNG (courseId = null) hoặc không có → 307 về trang đầu theo vai. Chỉ đọc courseId để quyết, không đưa gì của bài vào trang hay metadata.
// Khi ẩn, bài lớp hiện KHÔNG kèm khung Cộng đồng (thanh trái / cột phải dẫn vào bảng tin đã ẩn) và nút quay lại về trang của người xem.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThreadDetailView } from "@/components/community/ThreadDetailView";
import { featureOn } from "@/lib/features";
import { getSession } from "@/lib/session";
import { landingPath } from "@/lib/landing";
import { prisma } from "@/lib/prisma";

const TITLE = "Bài viết cộng đồng — KiN";
const DESC = "Đọc bài viết và các trả lời trong Cộng đồng KiN. Đăng nhập để thích, lưu và trả lời.";

export const metadata: Metadata = { title: TITLE, description: DESC, openGraph: { title: TITLE, description: DESC, type: "article" } };

export default async function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (featureOn("CONG_DONG")) return <ThreadDetailView id={id} />;

  const session = await getSession();
  const home = session ? landingPath(session.role, session.adminRole) : "/";
  let classThread: boolean | null;
  try {
    const t = await prisma.thread.findUnique({ where: { id }, select: { courseId: true } });
    classThread = !!t?.courseId;
  } catch {
    classThread = null; // DB lỗi: để màn chi tiết tự báo lỗi + Thử lại, không đoán.
  }
  if (classThread === false) redirect(home);
  return <ThreadDetailView id={id} bare backHref={session ? home : `/dang-nhap?redirect=${encodeURIComponent(`/cong-dong/${id}`)}`} backLabel={session ? "Về trang của tôi" : "Đăng nhập"} />;
}
