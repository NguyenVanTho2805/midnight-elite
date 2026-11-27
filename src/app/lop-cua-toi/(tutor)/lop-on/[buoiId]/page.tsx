// Lớp ôn của GIÁO VIÊN · điểm danh một buổi trên điện thoại (KiN lớp bước 5, Figma FyUkgGJHrhXo0u4gnREyfk 9:762 / 9:883). Sau cờ LOP_ON.
// Giáo viên chỉ mở được buổi của môn mình được phân công: buổi môn khác, buổi không có, chưa có tài khoản lớp ⇒ đều "không tìm thấy" (không lộ buổi có tồn tại hay không).
import { notFound } from "next/navigation";
import { giaoVienLop } from "@/lib/lop/server/cua";
import { chiTietDiemDanh } from "@/lib/lop/server/diem-danh";
import { LoiDuLieu, LoiQuyen } from "@/lib/lop/quyen";
import { KIN_PAGE } from "@/components/kin";
import { DiemDanhBuoi } from "@/components/lop/DiemDanhBuoi";

export const metadata = { title: "Lớp ôn · Điểm danh" };
export const dynamic = "force-dynamic";

const GOC = "/lop-cua-toi/lop-on";

export default async function LopOnGiaoVienBuoi({ params }: { params: Promise<{ buoiId: string }> }) {
  const { buoiId } = await params;
  const u = await giaoVienLop(`${GOC}/${buoiId}`);
  if (!u || !/^\d{1,9}$/.test(buoiId)) notFound();
  const d = await chiTietDiemDanh(u, Number(buoiId)).catch((e) => { if (e instanceof LoiQuyen || (e instanceof LoiDuLieu && e.status === 404)) return null; throw e; });
  if (!d) notFound();
  // Vỏ gia sư cuộn cả trang và có thanh tab dưới ở điện thoại: thanh "Đánh tất cả" dính phía trên thanh đó (cùng số đo với components/tutor/DiemDanh.tsx).
  return <div className={KIN_PAGE}><DiemDanhBuoi d={d} chu={false} veHref={GOC} day="bottom-[68px] md:bottom-4" /></div>;
}
