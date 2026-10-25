// QZ-04 / QZ-03 — trình soạn quiz của gia sư: nội dung đề, đáp án, phát hành. Quyền theo từng quiz kiểm ở API (của người khác → 403, không có → 404, hiện thành lời giải thích).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import QuizEditor from "@/components/tutor/quiz/QuizEditor";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=${encodeURIComponent(`/lop-cua-toi/bai-tap/quiz/${id}`)}`);
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <QuizEditor id={id} />;
}
