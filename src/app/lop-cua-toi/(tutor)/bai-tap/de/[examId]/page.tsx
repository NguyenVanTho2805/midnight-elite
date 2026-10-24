// QZ-08 + QZ-06: chấm quiz hỗn hợp, công bố điểm, theo dõi lượt làm và phân tích kết quả của MỘT đề. Chỉ gia sư; đề không phải của mình thì trang báo rõ (API trả 403/404).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ChamQuiz from "@/components/tutor/ChamQuiz";

export const dynamic = "force-dynamic";

export default async function ChamQuizPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=/lop-cua-toi/bai-tap/de/${encodeURIComponent(examId)}`);
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <ChamQuiz examId={examId} />;
}
