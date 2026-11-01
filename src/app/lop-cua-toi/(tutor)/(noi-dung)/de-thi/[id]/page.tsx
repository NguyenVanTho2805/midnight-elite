// BU-03 P2 — trình soạn đề DUY NHẤT của gia sư (QuizEditor; thay bí danh thi-thu/[id] 1.369 dòng). Quyền theo từng đề kiểm ở API: của người khác 403, không có 404 (hiện thành lời giải thích).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import QuizEditor from "@/components/tutor/quiz/QuizEditor";

export const dynamic = "force-dynamic";

export default async function DeThiEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/${id}` });
  return <QuizEditor id={id} />;
}
