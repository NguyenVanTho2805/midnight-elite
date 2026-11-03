// BU-03 P3 — Giao đề của một đề gốc: chế độ, lớp, giờ, mật khẩu, số lần, hiển thị đáp án, phát hành / đóng. useSearchParams (?lop=) → Suspense.
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import GiaoDe from "@/components/tutor/de-thi/GiaoDe";

export const dynamic = "force-dynamic";

export default async function GiaoDePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/${id}/giao` });
  return <Suspense fallback={null}><GiaoDe id={id} /></Suspense>;
}
