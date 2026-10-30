// PH-223 — danh sách kế hoạch buổi 4 hoạt động của gia sư + tạo mới. Một lần soạn ra hai bản: bản gia sư và phiếu học sinh.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import KeHoachListClient from "./KeHoachListClient";

export const dynamic = "force-dynamic";

export default async function KeHoachBuoiPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/ke-hoach-buoi" });
  return <KeHoachListClient />;
}
