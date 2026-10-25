// Nhập danh sách (LO-06 dán, LO-17 CSV/Excel — học sinh và lịch): xem trước, lỗi từng dòng, hộp xác nhận. Chỉ gia sư.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NhapHocSinh from "@/components/tutor/NhapHocSinh";

export const dynamic = "force-dynamic";

export default async function NhapPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/hoc-sinh/nhap");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <NhapHocSinh />;
}
