// PH-223 — soạn một kế hoạch buổi: 4 hoạt động (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng), mỗi hoạt động có Sản phẩm.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import KeHoachEditorClient from "./KeHoachEditorClient";

export const dynamic = "force-dynamic";

export default async function KeHoachEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/ke-hoach-buoi/${id}` });
  return <KeHoachEditorClient id={id} />;
}
