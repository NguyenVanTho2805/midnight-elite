// PH-209 — soạn bài đăng tìm học sinh cho nhóm Facebook / Zalo. KiN KHÔNG tự đăng (Groups API đã đóng từ 22/04/2024):
// soạn sẵn từ hồ sơ + sổ lớp, mỗi nhóm một link riêng (?n=) để biết nhóm nào mang người về.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import BaiDangClient from "./BaiDangClient";

export const dynamic = "force-dynamic";

export default async function BaiDangPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/bai-dang" });
  return <BaiDangClient />;
}
