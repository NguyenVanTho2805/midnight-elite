// BU-03 P2 — Mã đề của một đề gốc (101, 102…): tạo, đảo câu / phương án, phát hành cả nhóm. useSearchParams (?loi=) → Suspense.
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import MaDe from "@/components/tutor/de-thi/MaDe";

export const dynamic = "force-dynamic";

export default async function MaDePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/${id}/ma-de` });
  return <Suspense fallback={null}><MaDe id={id} /></Suspense>;
}
