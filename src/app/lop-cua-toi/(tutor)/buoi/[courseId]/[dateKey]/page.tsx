// BU-01 — trang chi tiết một buổi học: breadcrumb lớp - ngày - trạng thái, Online/Offline, ghi chép 3 phần, điểm danh, chốt buổi.
// Mở được cả buổi suy từ lịch tuần chưa có bản ghi (không tạo gì khi chỉ xem). Quyền kiểm ở API (lớp người khác 403, không có 404).
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { isValidDateKey } from "@/lib/classSessions";
import { prisma } from "@/lib/prisma";
import { isNewFeeMode } from "@/lib/tuitionFee";
import BuoiChiTiet from "@/components/tutor/BuoiChiTiet";
import { courseRoleForPage } from "@/lib/courseAccessServer";

export const dynamic = "force-dynamic";

export default async function BuoiPage({ params }: { params: Promise<{ courseId: string; dateKey: string }> }) {
  const { courseId, dateKey } = await params;
  const session = await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/buoi/${courseId}/${dateKey}` });
  if (!isValidDateKey(dateKey)) notFound();
  // HOCPHI-THEO-BUOI: chữ ở khung "chưa chốt" phụ thuộc kiểu phí. Chỉ đọc cột feeMode của lớp mình; lỗi DB → coi như lớp cũ (câu cũ, không hứa việc tính tiền).
  let perSessionFee = false;
  try {
    const c = await prisma.course.findUnique({ where: { id: courseId }, select: { feeMode: true, ownerId: true } });
    perSessionFee = !!c && c.ownerId === session.userId && isNewFeeMode(c.feeMode) && c.feeMode !== "per_course";
  } catch { /* giữ câu cũ */ }
  // TUT-dong-giang: vai trong lớp (đồng giảng / bộ môn → màn bớt nút chốt, không chữ học phí). Quyền thật vẫn do API kiểm; lỗi đọc vai → coi như chủ (API sẽ 403 nếu không phải).
  let viewRole: "co_teacher" | "subject_teacher" | undefined;
  try {
    const cr = await courseRoleForPage(session, courseId);
    if (cr && (cr.role === "co_teacher" || cr.role === "subject_teacher")) { viewRole = cr.role; perSessionFee = false; }
  } catch { /* giữ mặc định */ }
  return <Suspense fallback={<div aria-busy="true" className="p-6">Đang tải buổi học…</div>}><BuoiChiTiet courseId={courseId} dateKey={dateKey} perSessionFee={perSessionFee} viewRole={viewRole} /></Suspense>;
}
