// BU-03 P2 — Ngân hàng đề của gia sư (thay bí danh trang quản trị thi-thu). Vỏ + cổng gia sư do (noi-dung)/layout cấp; ?lop=<courseId> = chọn đề để giao cho lớp.
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import DeThiList from "@/components/tutor/de-thi/DeThiList";

export const dynamic = "force-dynamic";

export default async function DeThiPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/de-thi" });
  return <Suspense fallback={null}><DeThiList /></Suspense>;
}
