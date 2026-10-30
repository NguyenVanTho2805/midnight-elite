// Hồ sơ một học sinh của gia sư (HS-03/04/10/11). Chỉ gia sư; dữ liệu tải ở HoSoHocSinh qua /api/tutor/ho-so/[id] (gia sư khác 403, không có 404).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import HoSoHocSinh from "@/components/tutor/HoSoHocSinh";

export const dynamic = "force-dynamic";

export default async function HoSoHocSinhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/hoc-sinh/${id}` });
  return <HoSoHocSinh id={id} />;
}
