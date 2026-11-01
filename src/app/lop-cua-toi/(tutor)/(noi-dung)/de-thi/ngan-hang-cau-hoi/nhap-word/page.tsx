// BU-03 P1 — Nhập câu hỏi từ Word (mẫu Azota, không AI) vào ngân hàng. Chỉ gia sư; chờ duyệt → /lop-cua-toi/cho-duyet.
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import NhapWord from "@/components/tutor/de-thi/NhapWord";

export const dynamic = "force-dynamic";

export default async function NhapWordPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/nhap-word" });
  return <Suspense fallback={null}><NhapWord /></Suspense>;
}
