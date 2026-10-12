// PH-209 — soạn bài đăng tìm học sinh cho nhóm Facebook / Zalo. KiN KHÔNG tự đăng (Groups API đã đóng từ 22/04/2024):
// soạn sẵn từ hồ sơ + sổ lớp, mỗi nhóm một link riêng (?n=) để biết nhóm nào mang người về.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import BaiDangClient from "./BaiDangClient";

export const dynamic = "force-dynamic";

export default async function BaiDangPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?next=/lop-cua-toi/bai-dang");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <BaiDangClient />;
}
