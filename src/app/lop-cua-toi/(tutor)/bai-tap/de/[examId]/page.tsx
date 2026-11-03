// BU-03 — đường cũ bai-tap/de/[examId], giữ để link trong thông báo đã lưu DB và dấu trang vẫn tới. Chuyển 307 (không 308) sang đường mới của Đề thi; cổng gia sư kiểm trước bằng đường cũ.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";

export const dynamic = "force-dynamic";

export default async function DeRedirect({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/bai-tap/de/${examId}` });
  redirect(`/lop-cua-toi/de-thi/${examId}/cham`);
}
