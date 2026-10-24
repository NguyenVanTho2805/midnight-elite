// Hồ sơ một học sinh của gia sư (HS-03/04/10/11). Chỉ gia sư; dữ liệu tải ở HoSoHocSinh qua /api/tutor/ho-so/[id] (gia sư khác 403, không có 404).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import HoSoHocSinh from "@/components/tutor/HoSoHocSinh";

export const dynamic = "force-dynamic";

export default async function HoSoHocSinhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=/lop-cua-toi/hoc-sinh/${id}`);
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <HoSoHocSinh id={id} />;
}
