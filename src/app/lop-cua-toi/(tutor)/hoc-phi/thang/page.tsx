// HOCPHI-THEO-BUOI mục 5.3 — Học phí theo tháng của gia sư. Tháng = tháng dương lịch giờ VN (?ym=YYYY-MM), chuyển tháng bằng liên kết.
// Chỉ gia sư đã duyệt (redirectIfNotTutor). Dữ liệu lấy qua GET /api/tutor/hoc-phi-thang; trang này không tính tiền.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { vnMonthKey } from "@/lib/revenue";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { KinMoneyEye } from "@/components/kin/MoneyVisibility";
import HocPhiThangClient from "./HocPhiThangClient";

export const dynamic = "force-dynamic";

export default async function HocPhiThangPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/hoc-phi/thang" });
  const maxYm = vnMonthKey(new Date());
  const { ym: raw } = await searchParams;
  // ym sai định dạng hoặc ở tương lai → về tháng hiện tại (không cho xem tương lai).
  const ym = typeof raw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= maxYm ? raw : maxYm;
  return (
    <KinPage>
      <KinPageHeader title="Học phí theo tháng"
        back={{ href: "/lop-cua-toi/hoc-phi", label: "Học phí" }}
        sub="Tổng hợp từ các buổi đã chốt. Chỉ xem, không sửa ở đây."
        actions={<KinMoneyEye />} />
      <HocPhiThangClient ym={ym} maxYm={maxYm} />
    </KinPage>
  );
}
