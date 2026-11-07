// PT-05 — Sổ điểm và tiến bộ theo học sinh / lớp. Chỉ gia sư (chủ lớp). Chỉ đọc số đã có, không thu điểm mới.
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import SoDiemClient from "./SoDiemClient";

export const dynamic = "force-dynamic";

export default async function SoDiemPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/so-diem", studentTo: "/student" });
  return (
    <KinPage>
      <KinPageHeader
        // B5 GS-10 (08/11/2026): Sổ điểm là chuyện lớp và điểm, không trộn với tiền — nút quay lại về Lớp, không về Doanh thu.
        back={{ href: "/lop-cua-toi/lop", label: "← Lớp" }}
        title="Sổ điểm và tiến bộ"
        sub="Chuyên cần, bài về nhà và bài kiểm tra của học sinh trong lớp bạn dạy, theo tháng. Bài quiz có tự luận chưa công bố điểm thì chưa được tính."
      />
      <SoDiemClient />
    </KinPage>
  );
}
