// BU-03 — đường cũ bai-tap/nhap-de, giữ để link trong thông báo đã lưu DB và dấu trang vẫn tới. Chuyển 307 (không 308) sang đường mới của Đề thi; cổng gia sư kiểm trước bằng đường cũ.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";

export const dynamic = "force-dynamic";

export default async function NhapDeRedirect() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/bai-tap/nhap-de" });
  redirect("/lop-cua-toi/de-thi/tao-moi");
}
