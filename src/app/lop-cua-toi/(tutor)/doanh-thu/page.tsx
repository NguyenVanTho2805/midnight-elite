// FE-153 — doanh thu của gia sư (học phí đã thu). Chỉ gia sư.
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DoanhThuClient from "./DoanhThuClient";

export const dynamic = "force-dynamic";

export default async function DoanhThuGiaSuPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/doanh-thu");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect(session.role === "student" ? "/student/hoc-phi" : "/lop-cua-toi");
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
