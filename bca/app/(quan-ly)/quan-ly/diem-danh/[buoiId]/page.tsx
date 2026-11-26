// Điểm danh một buổi (man-diem-danh.md §3–§5). Máy chủ kiểm quyền môn; buổi môn khác hiện "Không tìm thấy" như hồ sơ
// em không học môn mình (không lộ việc buổi đó tồn tại).
import { notFound } from "next/navigation";
import { chiTietDiemDanh } from "@/server/diem-danh";
import { LoiQuyen } from "@/lib/quyen";
import { layNguoiQuanLy, tai } from "@/components/khung/nguoi";
import { DiemDanhBuoi } from "@/components/quan-ly/diem-danh-buoi";

export const metadata = { title: "Điểm danh" };

export default async function TrangDiemDanhBuoi({ params }: { params: Promise<{ buoiId: string }> }) {
  const { buoiId } = await params;
  if (!/^\d+$/.test(buoiId)) notFound();
  const u = await layNguoiQuanLy();
  const d = await tai(() => chiTietDiemDanh(u, Number(buoiId)).catch((e) => { if (e instanceof LoiQuyen) notFound(); throw e; }));
  return <DiemDanhBuoi key={buoiId} d={d} toi={u.ten} chu={u.vai === "chu"} />;
}
