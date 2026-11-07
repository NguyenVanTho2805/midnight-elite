// TUT-lich-keo-tha — tab "Lịch học" của lớp: lưới khung giờ hằng tuần kéo-thả. Trang mỏng: cổng gia sư rồi giao cho LichKhung
// (dữ liệu lấy ở trình duyệt để có đủ trạng thái đang tải / lỗi / rỗng; quyền chủ lớp do máy chủ kiểm ở API — lớp người khác hiện "Bạn không có quyền với lớp này", không mang dữ liệu).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import LichKhung from "@/components/tutor/LichKhung";

export const dynamic = "force-dynamic";

export default async function LichHocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/quan-lop/${id}/lich-hoc`, adminTo: "/admin" });
  return <LichKhung courseId={id} />;
}
