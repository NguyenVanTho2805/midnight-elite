// KiN Pro — "Gói của tôi" (gia sư): gói hiện tại, thanh x/N, lượt AI còn lại, so sánh Free và Pro, mua theo kỳ bằng QR. Dữ liệu tải ở GoiClient qua /api/tutor/goi.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import GoiClient from "./GoiClient";

export const dynamic = "force-dynamic";

export default async function GoiCuaToiPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/goi", studentTo: "/student" });
  return <GoiClient />;
}
