// Nhập danh sách (LO-06 dán, LO-17 CSV/Excel — học sinh và lịch): xem trước, lỗi từng dòng, hộp xác nhận. Chỉ gia sư.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import NhapHocSinh from "@/components/tutor/NhapHocSinh";

export const dynamic = "force-dynamic";

export default async function NhapPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/hoc-sinh/nhap" });
  return <NhapHocSinh />;
}
