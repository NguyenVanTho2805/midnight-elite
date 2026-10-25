// QZ-07 — phiên bản của một quiz: so sánh, nhật ký. Quyền theo từng quiz kiểm ở API.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import QuizVersions from "@/components/tutor/quiz/QuizVersions";

export const dynamic = "force-dynamic";

export default async function QuizVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=${encodeURIComponent(`/lop-cua-toi/bai-tap/quiz/${id}/phien-ban`)}`);
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <QuizVersions id={id} />;
}
