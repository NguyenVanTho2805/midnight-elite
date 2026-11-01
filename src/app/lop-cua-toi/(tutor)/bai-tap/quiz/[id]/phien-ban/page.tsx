// QZ-07 — phiên bản của một quiz: so sánh, nhật ký. Quyền theo từng quiz kiểm ở API.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import QuizVersions from "@/components/tutor/quiz/QuizVersions";

export const dynamic = "force-dynamic";

export default async function QuizVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/bai-tap/quiz/${id}/phien-ban` });
  return <QuizVersions id={id} />;
}
