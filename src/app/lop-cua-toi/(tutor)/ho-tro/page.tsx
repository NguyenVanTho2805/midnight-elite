// KiN Pro F6 — "Liên hệ hỗ trợ" (gia sư): gửi yêu cầu và xem câu trả lời. Pro được xếp trước, trả lời trong giờ hành chính; lỗi nghiêm trọng/riêng tư không phân tầng.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import HoTroClient from "./HoTroClient";

export const dynamic = "force-dynamic";

export default async function HoTroPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/ho-tro");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect(session.role === "student" ? "/student" : "/lop-cua-toi");
  return <HoTroClient />;
}
