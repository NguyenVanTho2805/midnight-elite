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
import { normalizeFeeMode } from "@/lib/tuitionFee";
import { effectivePolicy, canUseOpenPolicy, isFreeClass } from "@/lib/joinRequest";
import { loadPendingJoinRequests } from "@/lib/enrollServer";
import type { PendingJoinRequest } from "@/components/tutor/JoinRequests";
import { courseRoleForPage } from "@/lib/courseAccessServer";
import { legacyClassTarget } from "@/lib/tutorClassRoutes";
import { loadTutorStatus } from "@/lib/tutorGateServer";
import { TUTOR_PENDING_PATH } from "@/lib/tutorGate";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseId: string }>; searchParams: Promise<{ tab?: string; moi?: string; lich?: string; them?: string; duyet?: string; n?: string; ma?: string }> };
const TABS: LopTab[] = ["diem-danh", "hoc-sinh", "giao-vien", "ma-moi", "hoc-phi", "cong-dong"];

export default async function LopPage({ params, searchParams }: Props) {
  const { courseId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=/lop-cua-toi/${courseId}`);

  const course = await prisma.course.findUnique({
    where:  { id: courseId },
    select: { id: true, name: true, category: true, ownerId: true, feeMode: true, joinPolicy: true, tag: true, price: true },
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
  const isTeacher  = isAdmin && session.adminRole === "teacher"; // BU-00: lối tắt trong OutlookShell đi bí danh gia sư hay /admin/khoa-hoc tuỳ vai thật

  // GS-LOP-GON (09/11/2026): CHỦ LỚP là gia sư thật chỉ có MỘT dải tab của lớp (…/quan-lop/<id>/*, mỗi tab một đường). Trang hộp việc 6 tab này không còn là
  // menu cạnh tranh với dải đó: chuyển hướng sang đúng tab, giữ các tham số phụ (moi, lich, them, duyet, n, ma) vì các POST 303 của tạo lớp / duyệt vào lớp /
  // thêm học sinh / mã mời trả về đây. Trang này không có loading.tsx nên redirect() ở đây là 307 thật (kiểm ở t-lop-gon). Đồng giảng, quản trị xem, học sinh: KHÔNG đổi.
  if (isOwner && isTeacher) redirect(legacyClassTarget(courseId, sp));

  // TUT-dong-giang: gia sư không phải chủ lớp có thể là đồng giảng / giáo viên bộ môn (CourseTeacher active, đọc lại User từ DB). Người lạ vẫn 404 như cũ.
  let coRole: "co_teacher" | "subject_teacher" | null = null;
  if (!isOwner && !isElevated && isTeacher) {
    const cr = await courseRoleForPage(session, courseId);
    if (cr && (cr.role === "co_teacher" || cr.role === "subject_teacher")) coRole = cr.role;
  }

  if (!isOwner && !isElevated && !coRole) {
    if (session.role !== "student") notFound();
    const enr = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId } },
      select: { status: true },
    });
    if (!enr || enr.status !== "active") {
      // Gia sư CHỜ DUYỆT (vẫn là học sinh trong phiên) chưa học lớp này: về trang chờ duyệt thay vì 404 (không mang dữ liệu lớp). Người đã ghi danh vẫn thấy lớp như học sinh.
      if (await loadTutorStatus(session) === "pending") redirect(TUTOR_PENDING_PATH);
      notFound();
    }
  }

  const roleView: "tutor" | "student" = isOwner || isElevated || coRole ? "tutor" : "student";

  // Tên người đang xem để tin mời phụ huynh tự giới thiệu gia sư; học viên không cần.
  const viewerName = roleView === "tutor"
    ? (await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name ?? null
    : null;

  // Gia sư (chủ lớp hoặc quản trị): trang chi tiết lớp theo Figma 299:112581. Học sinh giữ vỏ cũ.
  if (roleView === "tutor") {
    const co = coRole !== null;
    // BU-01: hàng chờ duyệt qua enrollServer (trang không gọi prisma.classJoinRequest). Lỗi tải chỉ làm khối này báo lỗi, danh sách em vẫn hiện.
    let pending: PendingJoinRequest[] = [], pendingFailed = false;
    try {
      if (!co) pending = (await loadPendingJoinRequests(courseId)).map(r => ({ id: r.id, studentName: r.studentName, sentOn: `${vnDateKeyOf(r.createdAt).slice(8, 10)}/${vnDateKeyOf(r.createdAt).slice(5, 7)}` }));
    } catch { pendingFailed = true; }
    const hasFeeRate = co ? false : (await prisma.courseFeeRate.count({ where: { courseId } })) > 0; // đồng giảng không đọc cấu hình học phí
    const feeInfo = { price: course.price, tag: course.tag, hasFeeRate };
    const [students, rules, sessions, taught, classCodeRow] = await Promise.all([
      prisma.enrollment.findMany({ where: { courseId, status: "active" }, select: { userId: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.classSchedule.findMany({ where: { courseId, active: true }, select: { dayOfWeek: true, startTime: true, endTime: true } }),
      prisma.attendanceSession.findMany({ where: co ? { courseId, taughtBy: session.userId } : { courseId }, orderBy: { date: "desc" }, take: 5, select: { id: true, date: true, note: true, _count: { select: { records: true } } } }),
      prisma.attendanceSession.count({ where: co ? { courseId, taughtBy: session.userId } : { courseId } }),
      co ? Promise.resolve(null) : prisma.classInvite.findFirst({ where: { courseId, revoked: false, kind: "class", maxUses: null, expiresAt: null }, orderBy: { createdAt: "asc" }, select: { code: true } }),
    ]);
    // Giáo viên bộ môn chưa được giao gì (khung, nhóm bài, buổi) chỉ thấy số học sinh (ma trận 4.3, điều kiện a).
    const rosterHidden = coRole === "subject_teacher"
      && (await Promise.all([
        prisma.classSchedule.count({ where: { courseId, teacherId: session.userId } }),
        prisma.chapter.count({ where: { section: { courseId }, teacherId: session.userId } }),
        prisma.attendanceSession.count({ where: { courseId, taughtBy: session.userId } }),
      ])).every(c => c === 0);
    // Mã lớp = mã dài hạn (không giới hạn lượt, không hết hạn, chưa thu hồi), tra riêng nên không bị đẩy ra ngoài bởi các mã giới hạn tạo sau.
    const usable = classCodeRow;
    return <LopChiTiet d={{
      courseId: course.id, courseName: course.name, category: course.category, viewerName, isTeacher,
      schedule: formatScheduleRules(rules),
      students: rosterHidden ? [] : students.map(s => ({ id: s.userId, name: s.user.name ?? "Học sinh" })), studentCount: students.length, rosterHidden, viewRole: coRole ?? undefined,
      history: sessions.map(s => ({ id: s.id, dateKey: vnDateKeyOf(s.date), note: s.note, marked: s._count.records })),
      sessionsTaught: taught, inviteCode: usable?.code ?? null,
      initialTab: TABS.find(t => t === sp.tab) ?? "diem-danh", justCreated: sp.moi === "1", scheduleFailed: sp.lich === "loi", addedStudents: /^\d{1,3}$/.test(sp.them ?? "") ? Number(sp.them) : null, addFailed: sp.them === "loi", codeFailed: sp.ma === "loi",
      // Đồng giảng/bộ môn: giá trị trung tính, không đẩy chính sách vào lớp / miễn phí / feeMode thật xuống client.
      joinPolicy: co ? effectivePolicy(null) : effectivePolicy(course.joinPolicy), isFree: co ? false : isFreeClass(feeInfo), canOpen: co ? false : canUseOpenPolicy(feeInfo),
      pending, pendingFailed, duyet: sp.duyet ?? null, duyetN: /^\d{1,3}$/.test(sp.n ?? "") ? Number(sp.n) : null, feeMode: normalizeFeeMode(co ? null : course.feeMode),
    }} />;
  }

  return <OutlookShell courseId={course.id} courseName={course.name} category={course.category} role={roleView} viewerName={viewerName} isTeacher={isTeacher} />;
}
