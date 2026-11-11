// BU-05 — chi tiết bài toàn trang kiểu Threads. Máy chủ chỉ đặt metadata chung (không đọc DB nên không lộ gì về bài); phần động ở ThreadDetailView.
// LOI-01 (11/11/2026): khi bảng tin cộng đồng đang ẨN (src/lib/features.ts, cờ CONG_DONG), trang này vẫn mở cho câu hỏi TRONG LỚP (Thread.courseId != null) với người
// thuộc lớp — Hộp việc gia sư (src/lib/tutorInboxServer.ts) và thông báo trả lời trỏ đúng /cong-dong/<id>. Chọn giữ đường này thay vì đổi link sang chỗ khác vì ít đụng
// nhất: một chỗ kiểm ở đây phủ cả Hộp việc lẫn mọi thông báo cũ, không phải sửa từng nơi tạo link.
// Rà soát LOI-01 (COO): mã không có, bài CHUNG, bài lớp mà người xem KHÔNG thuộc lớp (và khách) cho CÙNG một kết quả — chuyển về trang đầu theo vai — để không lộ
// bài nào tồn tại / thuộc lớp nào. Không đọc được courseId (DB lỗi) → coi như bài chung, KHÔNG vẽ bài. Quyền lớp dùng canAccessClass, cùng hàm API dùng.
// Đã biết: nhóm (guest) có loading.tsx nên redirect() ở đây là chuyển hướng phía máy khách (200 + NEXT_REDIRECT), không phải 307 — COO chấp nhận.
// Khi ẩn, bài lớp hiện KHÔNG kèm khung Cộng đồng (thanh trái / cột phải dẫn vào bảng tin đã ẩn); nút quay lại về hỏi đáp của chính lớp đó.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThreadDetailView } from "@/components/community/ThreadDetailView";
import { featureOn } from "@/lib/features";
import { getSession } from "@/lib/session";
import { landingPath } from "@/lib/landing";
import { prisma } from "@/lib/prisma";
import { canAccessClass } from "@/lib/classThreadAccess";

const TITLE = "Bài viết cộng đồng — KiN";
const DESC = "Đọc bài viết và các trả lời trong Cộng đồng KiN. Đăng nhập để thích, lưu và trả lời.";

export const metadata: Metadata = { title: TITLE, description: DESC, openGraph: { title: TITLE, description: DESC, type: "article" } };

export default async function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (featureOn("CONG_DONG")) return <ThreadDetailView id={id} />;

  const session = await getSession();
  const home = session ? landingPath(session.role, session.adminRole) : "/";
  let courseId: string | null = null;
  try {
    const t = await prisma.thread.findUnique({ where: { id }, select: { courseId: true } });
    courseId = t?.courseId && (await canAccessClass(session, t.courseId)) ? t.courseId : null;
  } catch {
    courseId = null; // DB lỗi: coi như bài chung, không vẽ bài.
  }
  if (!courseId) redirect(home);
  // Quay lại = hỏi đáp của chính lớp đó (/cong-dong?scope=<mã lớp>, lối hỏi trong lớp còn mở khi bảng tin ẩn — xem src/lib/features.ts classScopeOf).
  return <ThreadDetailView id={id} bare backHref={`/cong-dong?scope=${encodeURIComponent(courseId)}`} backLabel="Hỏi đáp của lớp" />;
}
