// BU-02 — tab "Giáo trình" của lớp (Figma 606:5, chưa đối chiếu). Trang mỏng: cổng gia sư rồi giao cho GiaoTrinh (dữ liệu lấy bằng G1 ở trình duyệt để có đủ trạng thái
// đang tải / lỗi / rỗng; quyền chủ lớp do máy chủ kiểm ở G1 — lớp người khác trả 403 và màn hiện "Bạn không có quyền với lớp này", không mang dữ liệu lớp).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import GiaoTrinh from "@/components/tutor/giao-trinh/GiaoTrinh";

export const dynamic = "force-dynamic";

export default async function GiaoTrinhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/quan-lop/${id}/giao-trinh`, adminTo: "/admin" });
  return <GiaoTrinh courseId={id} />;
}
