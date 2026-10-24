// QZ-04 — tạo quiz mới (bước đặt tên). Chỉ gia sư; không phải gia sư → về /lop-cua-toi.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import QuizNew from "@/components/tutor/quiz/QuizNew";

export const dynamic = "force-dynamic";

export default async function QuizMoiPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/bai-tap/quiz/moi");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <QuizNew />;
}
