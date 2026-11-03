// QZ-04 / QZ-03 — trình soạn quiz của gia sư: nội dung đề, đáp án, phát hành. Quyền theo từng quiz kiểm ở API (của người khác → 403, không có → 404, hiện thành lời giải thích).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import QuizEditor from "@/components/tutor/quiz/QuizEditor";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/bai-tap/quiz/${id}` });
  return <QuizEditor id={id} />;
}
