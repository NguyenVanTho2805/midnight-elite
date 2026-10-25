// PT-05 — Sổ điểm và tiến bộ theo học sinh / lớp. Chỉ gia sư (chủ lớp). Chỉ đọc số đã có, không thu điểm mới.
import { redirect } from "next/navigation";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { getSession } from "@/lib/session";
import SoDiemClient from "./SoDiemClient";

export const dynamic = "force-dynamic";

export default async function SoDiemPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/so-diem");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect(session.role === "student" ? "/student" : "/lop-cua-toi");
  return (
    <KinPage>
      <KinPageHeader
        back={{ href: "/lop-cua-toi/doanh-thu", label: "← Dạy học và doanh thu" }}
        title="Sổ điểm và tiến bộ"
        sub="Chuyên cần, bài về nhà và bài kiểm tra của học sinh trong lớp bạn dạy, theo tháng. Bài quiz có tự luận chưa công bố điểm thì chưa được tính."
      />
      <SoDiemClient />
    </KinPage>
  );
}
