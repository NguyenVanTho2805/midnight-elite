// LI-09 — "Dời buổi và học bù" gom một chỗ (Figma 464:6223): dời, huỷ, thêm buổi dạy bù, kiểm xung đột. Không có phần học phí ở màn này.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DoiBuoiHocBu from "@/components/tutor/DoiBuoiHocBu";

export const dynamic = "force-dynamic";

export default async function DoiBuoiPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/lich");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <Suspense fallback={<div aria-busy="true" className="p-6">Đang tải…</div>}><DoiBuoiHocBu /></Suspense>;
}
