// TT-201/202/203 — Lịch tuần của gia sư: buổi học, tin nhắc lịch chờ gửi, báo nghỉ sát giờ.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LichClient from "./LichClient";

export const dynamic = "force-dynamic";

export default async function LichPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/lich");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <LichClient />;
}
