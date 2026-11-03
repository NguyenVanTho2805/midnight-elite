// BU-03 P2 — Tệp đề gốc (thay bí danh thi-thu/ngan-hang-de-thi): lưu Word/PDF/ảnh, tách Word thành đề không AI.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import TepGoc from "@/components/tutor/de-thi/TepGoc";

export const dynamic = "force-dynamic";

export default async function TepGocPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/de-thi/ngan-hang-de-thi" });
  return <TepGoc />;
}
