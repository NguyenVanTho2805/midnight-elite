// Tạo lớp (Figma "Gia sư · Tạo lớp đầu tiên" 299:112849). Chỉ gia sư; ghi qua POST /api/courses (đã kiểm quyền ở máy chủ).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TaoLop from "@/components/tutor/TaoLop";

export const dynamic = "force-dynamic";

export default async function TaoLopPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/lop/tao");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <TaoLop />;
}
