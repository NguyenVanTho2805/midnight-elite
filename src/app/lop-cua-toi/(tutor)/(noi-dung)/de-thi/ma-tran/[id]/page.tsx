// BU-03 P2 — dựng / sửa một ma trận đề, bốc câu, tạo đề. id "moi" = ma trận mới (chưa lưu). Quyền theo từng ma trận kiểm ở API (của người khác 403, không có 404).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import MaTranBuilder from "@/components/tutor/de-thi/MaTranBuilder";

export const dynamic = "force-dynamic";

export default async function MaTranPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/ma-tran/${id}` });
  return <MaTranBuilder id={id} />;
}
