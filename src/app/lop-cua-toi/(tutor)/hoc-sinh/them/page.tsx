// Thêm học sinh (HS-13): wizard 4 bước. Chỉ gia sư. `?userId=` = ghi hồ sơ riêng về em đã có tài khoản trong lớp của mình.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import HocSinhWizard from "@/components/tutor/HocSinhWizard";
import { KinPageSkeleton } from "@/components/kin/PageLayout";

export const dynamic = "force-dynamic";

export default async function ThemHocSinhPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/hoc-sinh/them");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <Suspense fallback={<KinPageSkeleton label="Đang tải" side={false} />}><HocSinhWizard /></Suspense>;
}
