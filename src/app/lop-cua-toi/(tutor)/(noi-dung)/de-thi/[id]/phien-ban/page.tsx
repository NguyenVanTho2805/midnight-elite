// BU-03 P2 — phiên bản của một đề (đường mới của bai-tap/quiz/[id]/phien-ban). Quyền theo từng đề kiểm ở API.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import QuizVersions from "@/components/tutor/quiz/QuizVersions";

export const dynamic = "force-dynamic";

export default async function DeThiVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/${id}/phien-ban` });
  return <QuizVersions id={id} />;
}
