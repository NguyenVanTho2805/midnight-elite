// TK-179 (09/10/2026) — Hộp việc kiểu Outlook cho 1 lớp.
// Figma 123:6, phương án C 119:149.
//
// Shell 2 panel:
//   - Trái: danh sách việc (nav list).
//   - Phải: content pane. Mặc định mở "Tổng quan".
// Mobile: trái gộp thành dropdown ở đầu trang, phải full-width.
//
// Role-aware: gia sư thấy điểm danh/roster/học phí; học viên thấy lịch
// học, học phí xem, bài tập đang chờ.
//
// Server component wrapper lấy course + role, client component render UI.
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import OutlookShell from "./OutlookShell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseId: string }> };

export default async function LopPage({ params }: Props) {
  const { courseId } = await params;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?next=/lop-cua-toi/${courseId}`);

  const course = await prisma.course.findUnique({
    where:  { id: courseId },
    select: { id: true, name: true, category: true, ownerId: true },
  });
  if (!course) notFound();

  // Quyền:
  //   - admin + ownerId=self → tutor.
  //   - admin super/content → tutor (xem toàn phần).
  //   - student có Enrollment active → student.
  //   - còn lại: 404 (không lộ sự tồn tại của lớp).
  const isAdmin   = session.role === "admin";
  const isOwner   = isAdmin && session.userId === course.ownerId;
  const isElevated = isAdmin && session.adminRole !== "teacher";

  if (!isOwner && !isElevated) {
    if (session.role !== "student") notFound();
    const enr = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId } },
      select: { status: true },
    });
    if (!enr || enr.status !== "active") notFound();
  }

  const roleView: "tutor" | "student" = isOwner || isElevated ? "tutor" : "student";

  return <OutlookShell courseId={course.id} courseName={course.name} category={course.category} role={roleView} />;
}
