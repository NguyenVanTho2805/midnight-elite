// Module "Lớp" của gia sư (Figma "Gia sư · Lớp" 299:112349): bảng các lớp đang dạy. Dữ liệu tải ở LopHoc (có đủ trạng thái tải / lỗi / rỗng).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import LopHoc from "@/components/tutor/LopHoc";

export const dynamic = "force-dynamic";

export default async function LopPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/lop" });
  return <LopHoc />;
}
