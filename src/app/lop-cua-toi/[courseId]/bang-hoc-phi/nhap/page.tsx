// HP-LOP-TRUONG — trang con "Nhập học phí từ Excel / Google Sheet" của một lớp tính học phí theo bảng tháng (feeMode = monthly_sheet).
// Chỉ gia sư CHỦ lớp: người không phải chủ lớp (gia sư lớp khác, gia sư bộ môn, đồng giảng, học sinh) thấy 404 — không lộ lớp có tồn tại, không rò số.
// Gia sư chờ duyệt / học sinh / chưa đăng nhập đi qua cổng sẵn có (redirectIfNotTutor). Lớp chưa phải bảng tháng → về tab Học phí, nơi có nút bật chế độ.
// Trang không tính tiền: giao diện gọi /api/tutor/lop/[courseId]/bang-hoc-phi/* (xem trước không ghi, xác nhận mới ghi).
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { FEE_MODE_SHEET } from "@/lib/tuitionFee";
import BangHocPhiNhap from "@/components/tutor/BangHocPhiNhap";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseId: string }>; searchParams: Promise<{ ym?: string }> };

export default async function BangHocPhiNhapPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const { ym: raw } = await searchParams;
  const session = await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/${courseId}/bang-hoc-phi/nhap` });
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { name: true, ownerId: true, feeMode: true } });
  if (!course || course.ownerId !== session.userId) notFound();
  if (course.feeMode !== FEE_MODE_SHEET) redirect(`/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-phi`);
  const ym = typeof raw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;
  return <BangHocPhiNhap courseId={courseId} courseName={course.name} ym={ym} />;
}
