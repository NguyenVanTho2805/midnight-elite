// BU-03 P2 — danh sách Ma trận đề đã lưu của gia sư. Mới hoàn toàn (không có bí danh quản trị).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import MaTranList from "@/components/tutor/de-thi/MaTranList";

export const dynamic = "force-dynamic";

export default async function MaTranListPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/de-thi/ma-tran" });
  return <MaTranList />;
}
