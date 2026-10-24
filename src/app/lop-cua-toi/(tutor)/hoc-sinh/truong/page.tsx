// Trường tuỳ chỉnh cho hồ sơ học sinh (LO-18). Chỉ gia sư.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TruongTuyChinh from "@/components/tutor/TruongTuyChinh";

export const dynamic = "force-dynamic";

export default async function TruongPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/hoc-sinh/truong");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <TruongTuyChinh />;
}
