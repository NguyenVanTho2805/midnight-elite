// Tạo lớp (Figma "Gia sư · Tạo lớp đầu tiên" 299:112849). Chỉ gia sư; ghi qua POST /api/courses (đã kiểm quyền ở máy chủ).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import TaoLop from "@/components/tutor/TaoLop";

export const dynamic = "force-dynamic";

export default async function TaoLopPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/lop/tao" });
  return <TaoLop />;
}
