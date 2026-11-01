// QZ-04 — tạo quiz mới (bước đặt tên). Chỉ gia sư; không phải gia sư → về /lop-cua-toi.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import QuizNew from "@/components/tutor/quiz/QuizNew";

export const dynamic = "force-dynamic";

export default async function QuizMoiPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/bai-tap/quiz/moi" });
  return <QuizNew />;
}
