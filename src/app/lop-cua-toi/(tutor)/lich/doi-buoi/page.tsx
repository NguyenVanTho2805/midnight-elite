// LI-09 — "Dời buổi và học bù" gom một chỗ (Figma 464:6223): dời, huỷ, thêm buổi dạy bù, kiểm xung đột. Không có phần học phí ở màn này.
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import DoiBuoiHocBu from "@/components/tutor/DoiBuoiHocBu";

export const dynamic = "force-dynamic";

export default async function DoiBuoiPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/lich" });
  return <Suspense fallback={<div aria-busy="true" className="p-6">Đang tải…</div>}><DoiBuoiHocBu /></Suspense>;
}
