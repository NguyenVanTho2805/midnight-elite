// KiN Pro — "Gói của tôi" (gia sư): gói hiện tại, thanh x/N, lượt AI còn lại, so sánh Free và Pro, mua theo kỳ bằng QR. Dữ liệu tải ở GoiClient qua /api/tutor/goi.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import GoiClient from "./GoiClient";

export const dynamic = "force-dynamic";

export default async function GoiCuaToiPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/goi");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect(session.role === "student" ? "/student" : "/lop-cua-toi");
  return <GoiClient />;
}
