// KiN Pro F6 — "Liên hệ hỗ trợ" (gia sư): gửi yêu cầu và xem câu trả lời. Pro được xếp trước, trả lời trong giờ hành chính; lỗi nghiêm trọng/riêng tư không phân tầng.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import HoTroClient from "./HoTroClient";

export const dynamic = "force-dynamic";

export default async function HoTroPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/ho-tro", studentTo: "/student", allowPending: true });
  return <HoTroClient />;
}
