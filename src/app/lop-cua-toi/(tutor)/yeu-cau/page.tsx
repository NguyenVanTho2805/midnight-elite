// Yêu cầu tìm gia sư của khách gửi tới gia sư này (KH-04): xem, tiếp nhận thành hồ sơ, từ chối. Chỉ gia sư.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import YeuCauGiaSu from "@/components/tutor/YeuCauGiaSu";

export const dynamic = "force-dynamic";

export default async function YeuCauGiaSuPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/yeu-cau");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <YeuCauGiaSu />;
}
