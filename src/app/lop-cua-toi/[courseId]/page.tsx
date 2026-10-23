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
import LopChiTiet, { type LopTab } from "@/components/tutor/LopChiTiet";
import { formatScheduleRules } from "@/lib/tutorClassTable";
import { vnDateKeyOf } from "@/lib/classSessions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseId: string }>; searchParams: Promise<{ tab?: string; moi?: string; lich?: string }> };
const TABS: LopTab[] = ["diem-danh", "hoc-sinh", "ma-moi", "hoc-phi", "cong-dong"];

export default async function LopPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=/lop-cua-toi/${courseId}`);

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

  // Tên người đang xem để tin mời phụ huynh tự giới thiệu gia sư; học viên không cần.
  const viewerName = roleView === "tutor"
    ? (await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name ?? null
    : null;

  // Gia sư (chủ lớp hoặc quản trị): trang chi tiết lớp theo Figma 299:112581. Học sinh giữ vỏ cũ.
  if (roleView === "tutor") {
    const now = new Date();
    const [students, rules, sessions, taught, invites] = await Promise.all([
      prisma.enrollment.findMany({ where: { courseId, status: "active" }, select: { userId: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.classSchedule.findMany({ where: { courseId, active: true }, select: { dayOfWeek: true, startTime: true, endTime: true } }),
      prisma.attendanceSession.findMany({ where: { courseId }, orderBy: { date: "desc" }, take: 5, select: { id: true, date: true, note: true, _count: { select: { records: true } } } }),
      prisma.attendanceSession.count({ where: { courseId } }),
      prisma.classInvite.findMany({ where: { courseId, revoked: false }, orderBy: { createdAt: "desc" }, take: 10, select: { code: true, maxUses: true, usedCount: true, expiresAt: true } }),
    ]);
    const usable = invites.find(i => (!i.expiresAt || i.expiresAt > now) && (i.maxUses == null || i.usedCount < i.maxUses));
    return <LopChiTiet d={{
      courseId: course.id, courseName: course.name, category: course.category, viewerName,
      schedule: formatScheduleRules(rules),
      students: students.map(s => ({ id: s.userId, name: s.user.name ?? "Học sinh" })),
      history: sessions.map(s => ({ id: s.id, dateKey: vnDateKeyOf(s.date), note: s.note, marked: s._count.records })),
      sessionsTaught: taught, inviteCode: usable?.code ?? null,
      initialTab: TABS.find(t => t === sp.tab) ?? "diem-danh", justCreated: sp.moi === "1", scheduleFailed: sp.lich === "loi",
    }} />;
  }

  return <OutlookShell courseId={course.id} courseName={course.name} category={course.category} role={roleView} viewerName={viewerName} />;
}
