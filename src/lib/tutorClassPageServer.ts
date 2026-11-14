// GS-LOP-GON (09/11/2026) — phần MÁY CHỦ của trang lớp gia sư /lop-cua-toi/quan-lop/[id]*: cổng quyền (đúng thứ tự 401 → 403 khoá → 403 không phải gia sư →
// 404 không có lớp → 403 người lạ của courseAccessServer.loadCourseAccess) và dữ liệu cho tab Học sinh / Cài đặt / Điểm danh, TÁCH từ trang cũ
// src/app/lop-cua-toi/[courseId]/page.tsx (khối dành cho chủ lớp). Không viết INSERT nào; không đụng tiền (feeMode chỉ được ĐỌC để truyền cho LopHocPhi như trước).
// Hàm thuần (đường, mục con) nằm ở tutorClassRoutes.ts.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { loadCourseAccess } from "@/lib/courseAccessServer";
import { vnDateKeyOf } from "@/lib/classSessions";
import { normalizeFeeMode, type FeeMode } from "@/lib/tuitionFee";
import { effectivePolicy, canUseOpenPolicy, isFreeClass, type JoinPolicy } from "@/lib/joinRequest";
import { loadPendingJoinRequests } from "@/lib/enrollServer";
import type { PendingJoinRequest } from "@/components/tutor/JoinRequests";
import { coTeacherClassHref, mucCaiDatOf, mucHocSinhOf, type ClassQuery, type MucCaiDat, type MucHocSinh } from "@/lib/tutorClassRoutes";

/** Vai của người xem trong lớp khi đã qua cổng gia sư (quản trị trung tâm không vào đường này — redirectIfNotTutor đã đưa đi). */
export type ClassViewRole = "owner" | "co_teacher" | "subject_teacher";

/** Đầu lớp: một lần cho mọi tab (ClassHead). Chỉ SỐ học sinh, không tên. */
export interface ClassHeadData {
  id: string; name: string; category: string; classStatus: string; hidden: boolean; studentCount: number;
}
export type ClassGate =
  | { ok: true; role: ClassViewRole; head: ClassHeadData }
  | { ok: false; reason: "not_found" | "forbidden" };

/**
 * Cổng của mọi trang quan-lop/[id]*. Id lạ (rỗng / NUL / > 200 ký tự) và lớp không có → not_found (404); lớp của người khác → forbidden (403, KHÔNG mang tên lớp / môn);
 * chủ lớp hoặc đồng giảng / giáo viên bộ môn đang hoạt động → ok kèm đầu lớp. Quản trị trung tâm (role "admin" của loadCourseAccess) không thuộc đường này → forbidden.
 */
export async function loadClassHead(session: SessionPayload, courseId: string): Promise<ClassGate> {
  const acc = await loadCourseAccess(session, courseId);
  if (!acc.ok) return { ok: false, reason: acc.res.status === 404 ? "not_found" : "forbidden" };
  if (acc.role === "admin") return { ok: false, reason: "forbidden" };
  const [c, studentCount] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, category: true, classStatus: true, status: true } }),
    prisma.enrollment.count({ where: { courseId, status: "active" } }),
  ]);
  if (!c) return { ok: false, reason: "not_found" };
  return { ok: true, role: acc.role, head: { id: c.id, name: c.name, category: c.category, classStatus: c.classStatus, hidden: !c.status, studentCount } };
}

export interface ClassPageGate {
  /** false = người này không có quyền với lớp: layout đã hiện màn "Bạn không có quyền với lớp này"; trang trả null và KHÔNG tải dữ liệu lớp. */
  ok: boolean;
  role: ClassViewRole;
}

/**
 * Cổng cho từng TRANG con (layout và trang chạy độc lập nên trang không được tin layout). Không có lớp → notFound(); người lạ → { ok: false } (trang trả null, không tải gì);
 * `ownerOnly` mà người xem là đồng giảng / bộ môn → redirect() 307 về /lop-cua-toi/<id> (LopChiTiet của đồng giảng). Gọi SAU redirectIfNotTutor.
 */
export async function gateClassPage(session: SessionPayload, courseId: string, o: { ownerOnly: boolean }): Promise<ClassPageGate> {
  const g = await loadClassHead(session, courseId);
  if (!g.ok) {
    if (g.reason === "not_found") notFound();
    return { ok: false, role: "owner" };
  }
  if (o.ownerOnly && g.role !== "owner") redirect(coTeacherClassHref(courseId));
  return { ok: true, role: g.role };
}

// ─── Tab Học sinh ──────────────────────────────────────────────────────────────────────────────────────────────
export interface StudentsTabData {
  courseId: string; courseName: string; category: string; viewerName: string | null;
  /** Mục con đang mở (?muc=): danh-ba · xin-vao · ma-moi · them. */
  muc: MucHocSinh;
  /** Tên + id học sinh đang học (dành cho liên kết Hồ sơ /lop-cua-toi/hoc-sinh/em/<id>). */
  students: { id: string; name: string }[];
  studentCount: number;
  /** Mã lớp dài hạn (không giới hạn lượt, không hết hạn, chưa thu hồi) hoặc null. */
  inviteCode: string | null;
  joinPolicy: JoinPolicy; isFree: boolean; canOpen: boolean; feeMode: FeeMode;
  pending: PendingJoinRequest[]; pendingFailed: boolean;
  duyet: string | null; duyetN: number | null;
  /** Hạ cánh sau các thao tác: tạo lớp (?moi=1), thêm cùng lúc N em (?them=N | loi), mã lớp chưa tạo (?ma=loi), khung giờ chưa lưu (?lich=loi). */
  justCreated: boolean; addedStudents: number | null; addFailed: boolean; codeFailed: boolean; scheduleFailed: boolean;
}

const first = (q: ClassQuery, k: string): string | undefined => {
  const v = q instanceof URLSearchParams ? q.get(k) : q[k];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s : undefined;
};
const smallInt = (s: string | undefined): number | null => (/^\d{1,3}$/.test(s ?? "") ? Number(s) : null);

/**
 * Dữ liệu tab Học sinh của CHỦ lớp (gọi sau gateClassPage ownerOnly). Cùng nguồn với khối "gia sư" cũ của [courseId]/page.tsx: hàng chờ duyệt qua
 * enrollServer.loadPendingJoinRequests (lỗi chỉ làm khối duyệt báo lỗi, danh sách em vẫn hiện), mã lớp tra riêng. Trả null nếu lớp biến mất giữa chừng.
 */
export async function loadStudentsTab(session: SessionPayload, courseId: string, query: ClassQuery): Promise<StudentsTabData | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, category: true, feeMode: true, joinPolicy: true, tag: true, price: true },
  });
  if (!course) return null;
  const [viewer, hasFeeRate, students, classCodeRow] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
    prisma.courseFeeRate.count({ where: { courseId } }),
    prisma.enrollment.findMany({ where: { courseId, status: "active" }, select: { userId: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.classInvite.findFirst({ where: { courseId, revoked: false, kind: "class", maxUses: null, expiresAt: null }, orderBy: { createdAt: "asc" }, select: { code: true } }),
  ]);
  let pending: PendingJoinRequest[] = [], pendingFailed = false;
  try {
    pending = (await loadPendingJoinRequests(courseId)).map(r => {
      const k = vnDateKeyOf(r.createdAt);
      return { id: r.id, studentName: r.studentName, sentOn: `${k.slice(8, 10)}/${k.slice(5, 7)}` };
    });
  } catch { pendingFailed = true; }
  const feeInfo = { price: course.price, tag: course.tag, hasFeeRate: hasFeeRate > 0 };
  const them = first(query, "them");
  return {
    courseId: course.id, courseName: course.name, category: course.category, viewerName: viewer?.name ?? null,
    muc: mucHocSinhOf(first(query, "muc")),
    students: students.map(s => ({ id: s.userId, name: s.user.name ?? "Học sinh" })), studentCount: students.length,
    inviteCode: classCodeRow?.code ?? null,
    joinPolicy: effectivePolicy(course.joinPolicy), isFree: isFreeClass(feeInfo), canOpen: canUseOpenPolicy(feeInfo), feeMode: normalizeFeeMode(course.feeMode),
    pending, pendingFailed,
    duyet: first(query, "duyet") ?? null, duyetN: smallInt(first(query, "n")),
    justCreated: first(query, "moi") === "1", addedStudents: smallInt(them), addFailed: them === "loi", codeFailed: first(query, "ma") === "loi", scheduleFailed: first(query, "lich") === "loi",
  };
}

// ─── Tab Cài đặt ───────────────────────────────────────────────────────────────────────────────────────────────
export interface ClassSettingsData {
  courseId: string; courseName: string; feeMode: FeeMode; muc: MucCaiDat;
  /** DG-HOC-ONLINE: link học online chung (Course.classJoinUrl) + nhắc email trước giờ học (Course.reminderLeadMinutes, null = tắt). `onlineFlash` từ ?luu= / ?loi= sau POST + 303. */
  online?: { joinUrl: string | null; leadMinutes: number | null; flash: "ok" | "link" | "lead" | null };
}

/** Dữ liệu tab Cài đặt của CHỦ lớp: chỉ cần hình thức học phí để truyền LopHocPhi (TIỀN: chỉ ĐỌC, không đổi). */
export async function loadClassSettings(courseId: string, query: ClassQuery): Promise<ClassSettingsData | null> {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, feeMode: true, classJoinUrl: true, reminderLeadMinutes: true } });
  if (!c) return null;
  const muc = mucCaiDatOf(first(query, "muc"));
  const luu = first(query, "luu"), loi = first(query, "loi");
  const flash = luu === "ok" ? "ok" : loi === "link" ? "link" : loi === "lead" ? "lead" : null;
  return {
    courseId: c.id, courseName: c.name, feeMode: normalizeFeeMode(c.feeMode), muc,
    ...(muc === "hoc-online" ? { online: { joinUrl: c.classJoinUrl, leadMinutes: c.reminderLeadMinutes, flash } } : {}),
  };
}

// ─── Tab Điểm danh: lịch sử buổi học ───────────────────────────────────────────────────────────────────────────
export interface AttendanceHistoryData {
  history: { id: string; dateKey: string; note: string | null; marked: number }[];
  sessionsTaught: number;
  studentCount: number;
}

/** 5 buổi điểm danh gần nhất + tổng số buổi (chủ lớp thấy mọi buổi của lớp). Không tên học sinh. */
export async function loadAttendanceHistory(courseId: string): Promise<AttendanceHistoryData> {
  const [sessions, taught, studentCount] = await Promise.all([
    prisma.attendanceSession.findMany({ where: { courseId }, orderBy: { date: "desc" }, take: 5, select: { id: true, date: true, note: true, _count: { select: { records: true } } } }),
    prisma.attendanceSession.count({ where: { courseId } }),
    prisma.enrollment.count({ where: { courseId, status: "active" } }),
  ]);
  return {
    history: sessions.map(s => ({ id: s.id, dateKey: vnDateKeyOf(s.date), note: s.note, marked: s._count.records })),
    sessionsTaught: taught, studentCount,
  };
}
