// QZ-05 — nhập đề từ PDF / Word / ảnh của gia sư (hai bước: chọn tệp, rà soát). Chỉ gia sư.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import QuizImport from "@/components/tutor/quiz/QuizImport";

export const dynamic = "force-dynamic";

export default async function NhapDePage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/bai-tap/nhap-de" });
  return <QuizImport />;
}
