// BU-03 P3 — Kết quả của một đề gốc: 5 khối (chỉ số, phổ điểm, tần số, đúng/sai theo câu, bảng điểm) + Xuất Excel. Khối bảng điểm là nơi duy nhất có tên học sinh.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import KetQuaDe from "@/components/tutor/de-thi/KetQuaDe";

export const dynamic = "force-dynamic";

export default async function KetQuaDePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/${id}/ket-qua` });
  return <KetQuaDe id={id} />;
}
