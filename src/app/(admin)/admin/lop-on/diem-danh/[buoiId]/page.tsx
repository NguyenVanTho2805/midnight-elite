// Lớp ôn · Điểm danh một buổi (KiN lớp bước 5, Figma FyUkgGJHrhXo0u4gnREyfk 9:762). Chỉ chủ lớp, sau cờ LOP_ON. Ghi qua /api/lop/diem-danh/[buoiId].
import { notFound } from "next/navigation";
import { chuLop } from "@/lib/lop/server/cua";
import { chiTietDiemDanh } from "@/lib/lop/server/diem-danh";
import { LoiDuLieu } from "@/lib/lop/quyen";
import { DiemDanhBuoi } from "@/components/lop/DiemDanhBuoi";
import { LOP_GOC } from "@/components/lop/hien-thi";

export const metadata = { title: "Lớp ôn · Điểm danh" };
export const dynamic = "force-dynamic";

export default async function LopOnDiemDanhBuoi({ params }: { params: Promise<{ buoiId: string }> }) {
  const u = await chuLop();
  const { buoiId } = await params;
  if (!/^\d{1,9}$/.test(buoiId)) notFound();
  const d = await chiTietDiemDanh(u, Number(buoiId)).catch((e) => { if (e instanceof LoiDuLieu && e.status === 404) return null; throw e; });
  if (!d) notFound();
  return <DiemDanhBuoi d={d} chu veHref={`${LOP_GOC}/buoi-hoc?tuan=${d.buoi.ngay}`} />;
}
