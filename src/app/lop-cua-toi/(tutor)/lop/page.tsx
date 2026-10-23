// Module "Lớp" của gia sư (Figma "Gia sư · Lớp" 299:112349): bảng các lớp đang dạy. Dữ liệu tải ở LopHoc (có đủ trạng thái tải / lỗi / rỗng).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LopHoc from "@/components/tutor/LopHoc";

export const dynamic = "force-dynamic";

export default async function LopPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/lop");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <LopHoc />;
}
