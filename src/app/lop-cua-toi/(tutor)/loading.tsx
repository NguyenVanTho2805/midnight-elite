// Khung chờ chung của các trang gia sư dưới /lop-cua-toi (máy chủ còn đang tải dữ liệu).
// 23/10/2026 (rà soát căn chỉnh): trước đây là khung của "Lớp của tôi" cũ (max-w-5xl mx-auto, tiêu đề 32px, ba thẻ vuông) nên khi trang thật hiện ra,
// lề trái nhảy từ giữa màn hình về 40px và tiêu đề đổi cỡ. Giờ dùng đúng lề + đầu trang + cột phải 354px của trang thật (KinPageSkeleton), không nhảy bố cục.
import { KinPageSkeleton } from "@/components/kin/PageLayout";

export default function Loading() {
  return <KinPageSkeleton label="Đang tải" />;
}
