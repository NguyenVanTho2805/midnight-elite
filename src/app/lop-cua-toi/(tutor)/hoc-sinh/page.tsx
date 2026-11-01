// Học sinh của gia sư (Figma 299:113083). Chỉ gia sư; dữ liệu tải ở HocSinh qua /api/tutor/hoc-sinh.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import HocSinh from "@/components/tutor/HocSinh";

export const dynamic = "force-dynamic";

export default async function HocSinhPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/hoc-sinh" });
  return <HocSinh />;
}
