// NV-189 — Báo cáo tháng gửi phụ huynh: Nỗ lực và Năng lực tách riêng + mục cố định "Điều chưa đạt tháng này".
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import BaoCaoClient from "./BaoCaoClient";

export const dynamic = "force-dynamic";

export default async function BaoCaoThangPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/bao-cao-thang");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <BaoCaoClient />;
}
