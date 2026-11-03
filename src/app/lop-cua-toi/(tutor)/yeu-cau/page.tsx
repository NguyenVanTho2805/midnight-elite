// Yêu cầu tìm gia sư của khách gửi tới gia sư này (KH-04): xem, tiếp nhận thành hồ sơ, từ chối. Chỉ gia sư.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import YeuCauGiaSu from "@/components/tutor/YeuCauGiaSu";

export const dynamic = "force-dynamic";

export default async function YeuCauGiaSuPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/yeu-cau" });
  return <YeuCauGiaSu />;
}
