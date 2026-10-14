// PH-223 — danh sách kế hoạch buổi 4 hoạt động của gia sư + tạo mới. Một lần soạn ra hai bản: bản gia sư và phiếu học sinh.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import KeHoachListClient from "./KeHoachListClient";

export const dynamic = "force-dynamic";

export default async function KeHoachBuoiPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/ke-hoach-buoi");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <KeHoachListClient />;
}
