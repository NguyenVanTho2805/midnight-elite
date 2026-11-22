// Lớp của tôi (Figma "Học sinh · Lớp của tôi" 299:114766). Đọc ?course=<lớp>; thiếu thì thư viện lớp. Bố cục nằm ở components/student/LopCuaToi.
// SCL-G-HS (QUYET-DINH §3.4): link gia sư gửi qua Zalo dạng ?course=…&bai=<mã bài> mở THẲNG trang bài, không bắt chọn lớp trước (chưa đăng nhập thì
// AuthGuard ở trang bài đưa đi đăng nhập rồi quay lại đúng bài). Mã lạ ⇒ bỏ qua, vào trang lớp như thường.
import { redirect } from "next/navigation";
import LopCuaToi from "@/components/student/LopCuaToi";

export default async function HocTapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { bai, course, tab } = await searchParams;
  if (typeof bai === "string" && /^[\w-]{1,100}$/.test(bai)) redirect(`/student/bai-giang/${bai}`);
  // Link cũ tới tab Video (đã bỏ): bản ghi nay ở cuối màn Tất cả bài học.
  if (tab === "video" && typeof course === "string" && course) redirect(`/student/hoc-tap?course=${encodeURIComponent(course)}&xem=bai-hoc#ban-ghi`);
  // SCL đợt 5 (D5): KHÔNG mở đồng hồ lúc dựng trang (link tới đây có thể bị prefetch, và ?course= lạ không được làm em bắt đầu đếm).
  // Đồng hồ mở ở GET /api/courses/<lớp> mà LopCuaToi gọi sau khi tải, chỉ khi đúng ghi danh thử của em — xem openTrialClockFor.
  return <LopCuaToi />;
}
