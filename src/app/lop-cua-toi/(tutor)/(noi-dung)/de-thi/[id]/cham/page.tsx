// BU-03 P2 — chấm, công bố điểm, theo dõi lượt làm của MỘT đề (đường mới của bai-tap/de/[examId]). Đề không phải của mình: trang báo rõ (API trả 403/404).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import ChamQuiz from "@/components/tutor/ChamQuiz";

export const dynamic = "force-dynamic";

export default async function DeThiChamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/${id}/cham` });
  return <ChamQuiz examId={id} />;
}
