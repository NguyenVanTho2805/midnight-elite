// Điểm danh một buổi (man-diem-danh.md §3–§5). Máy chủ kiểm quyền môn; giáo viên môn khác → 403 gọn.
import { notFound } from "next/navigation";
import { chiTietDiemDanh } from "@/server/diem-danh";
import { layNguoiQuanLy, tai } from "@/components/khung/nguoi";
import { KhongCoQuyen } from "@/components/ui/trang-thai";
import { DiemDanhBuoi } from "@/components/quan-ly/diem-danh-buoi";

export const metadata = { title: "Điểm danh" };

export default async function TrangDiemDanhBuoi({ params }: { params: Promise<{ buoiId: string }> }) {
  const { buoiId } = await params;
  if (!/^\d+$/.test(buoiId)) notFound();
  const u = await layNguoiQuanLy();
  const r = await tai(() => chiTietDiemDanh(u, Number(buoiId)));
  if (r.cam) return <KhongCoQuyen thongDiep="Buổi này không thuộc môn bạn dạy." />;
  return <DiemDanhBuoi key={buoiId} d={r.d} toi={u.ten} chu={u.vai === "chu"} />;
}
