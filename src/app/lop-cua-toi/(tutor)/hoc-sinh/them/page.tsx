// Thêm học sinh (HS-13): wizard 4 bước. Chỉ gia sư. `?userId=` = ghi hồ sơ riêng về em đã có tài khoản trong lớp của mình.
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import HocSinhWizard from "@/components/tutor/HocSinhWizard";
import { KinPageSkeleton } from "@/components/kin/PageLayout";

export const dynamic = "force-dynamic";

export default async function ThemHocSinhPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/hoc-sinh/them" });
  return <Suspense fallback={<KinPageSkeleton label="Đang tải" side={false} />}><HocSinhWizard /></Suspense>;
}
