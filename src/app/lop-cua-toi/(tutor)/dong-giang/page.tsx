// TUT-dong-giang 7.4 — trang lời mời đồng giảng. Dữ liệu tải ở LoiMoiDongGiang (API kiểm quyền: gia sư đã duyệt).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import LoiMoiDongGiang from "@/components/tutor/LoiMoiDongGiang";

export const dynamic = "force-dynamic";

export default async function DongGiangPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/dong-giang" });
  return <LoiMoiDongGiang />;
}
