// Module "Bài tập" của gia sư (Figma 299:113312): bài tập, bài nộp chờ chấm và đề thi của các lớp mình dạy. Không phải gia sư → về /lop-cua-toi.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import BaiTap from "@/components/tutor/BaiTap";

export const dynamic = "force-dynamic";

export default async function BaiTapPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/bai-tap");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <BaiTap />;
}
