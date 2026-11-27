// Mục menu "Điểm danh" trỏ vào đây để cả ma trận tháng lẫn màn một buổi cùng sáng mục này (matchSub khớp theo tiền tố).
import { redirect } from "next/navigation";
import { LOP_GOC } from "@/components/lop/hien-thi";

export default function LopOnDiemDanh() {
  redirect(`${LOP_GOC}/diem-danh/thang`);
}
