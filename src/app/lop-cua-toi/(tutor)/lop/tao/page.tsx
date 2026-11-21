// Tạo lớp (Figma "Gia sư · Tạo lớp đầu tiên" 299:112849). Gia sư + Chủ nhiệm (SCL-F2: cửa tạo lớp DUY NHẤT, ngăn kéo cũ của admin đã bỏ); ghi qua POST /api/courses (đã kiểm quyền ở máy chủ).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { isCenterAdmin } from "@/lib/tutorGate";
import TaoLop from "@/components/tutor/TaoLop";

export const dynamic = "force-dynamic";

export default async function TaoLopPage() {
  const session = await getSession();
  await redirectIfNotTutor(session, { allowAdmin: true, path: "/lop-cua-toi/lop/tao" });
  return <TaoLop centerAdmin={isCenterAdmin(session)} />;
}
