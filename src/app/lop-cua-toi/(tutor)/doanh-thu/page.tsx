// FE-153 — doanh thu của gia sư (học phí đã thu). Chỉ gia sư.
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import DoanhThuClient from "./DoanhThuClient";

export const dynamic = "force-dynamic";

export default async function DoanhThuGiaSuPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/doanh-thu", studentTo: "/student/hoc-phi" });
  return (
    <KinPage>
      <KinPageHeader
        back={{ href: "/lop-cua-toi", label: "← Lớp của tôi" }}
        title="Doanh thu của tôi"
        sub="Học phí đã thu vào tài khoản của bạn, tính từ các phiếu đã gạch. KiN không giữ tiền và không cắt phần trăm."
      />
      <div className="max-w-4xl"><DoanhThuClient /></div>
    </KinPage>
  );
}
