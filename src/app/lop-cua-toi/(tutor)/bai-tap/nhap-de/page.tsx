// QZ-05 — nhập đề từ PDF / Word / ảnh của gia sư (hai bước: chọn tệp, rà soát). Chỉ gia sư.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import QuizImport from "@/components/tutor/quiz/QuizImport";

export const dynamic = "force-dynamic";

export default async function NhapDePage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/bai-tap/nhap-de");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <QuizImport />;
}
