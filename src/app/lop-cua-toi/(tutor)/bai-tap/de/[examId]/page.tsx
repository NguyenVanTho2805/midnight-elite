// QZ-08 + QZ-06: chấm quiz hỗn hợp, công bố điểm, theo dõi lượt làm và phân tích kết quả của MỘT đề. Chỉ gia sư; đề không phải của mình thì trang báo rõ (API trả 403/404).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import ChamQuiz from "@/components/tutor/ChamQuiz";

export const dynamic = "force-dynamic";

export default async function ChamQuizPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/bai-tap/de/${examId}` });
  return <ChamQuiz examId={examId} />;
}
