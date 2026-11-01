// BU-01 — trang chi tiết một buổi học: breadcrumb lớp - ngày - trạng thái, Online/Offline, ghi chép 3 phần, điểm danh, chốt buổi.
// Mở được cả buổi suy từ lịch tuần chưa có bản ghi (không tạo gì khi chỉ xem). Quyền kiểm ở API (lớp người khác 403, không có 404).
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { isValidDateKey } from "@/lib/classSessions";
import BuoiChiTiet from "@/components/tutor/BuoiChiTiet";

export const dynamic = "force-dynamic";

export default async function BuoiPage({ params }: { params: Promise<{ courseId: string; dateKey: string }> }) {
  const { courseId, dateKey } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/buoi/${courseId}/${dateKey}` });
  if (!isValidDateKey(dateKey)) notFound();
  return <Suspense fallback={<div aria-busy="true" className="p-6">Đang tải buổi học…</div>}><BuoiChiTiet courseId={courseId} dateKey={dateKey} /></Suspense>;
}
