// BU-03 P2 — Tạo đề: bốn lối (ma trận · Word · PDF/ảnh · soạn trắng) trong MỘT trang; thay bí danh thi-thu/tao-moi. useSearchParams (?cach=) → Suspense.
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import TaoDe from "@/components/tutor/de-thi/TaoDe";

export const dynamic = "force-dynamic";

export default async function TaoDePage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/de-thi/tao-moi" });
  return <Suspense fallback={null}><TaoDe /></Suspense>;
}
