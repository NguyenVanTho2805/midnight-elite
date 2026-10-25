// Học sinh của gia sư (Figma 299:113083). Chỉ gia sư; dữ liệu tải ở HocSinh qua /api/tutor/hoc-sinh.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import HocSinh from "@/components/tutor/HocSinh";

export const dynamic = "force-dynamic";

export default async function HocSinhPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/hoc-sinh");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <HocSinh />;
}
