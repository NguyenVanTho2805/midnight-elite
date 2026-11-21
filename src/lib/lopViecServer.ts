// SCL-G-GS (21/11/2026) — phần chạm DB của Hộp việc gia sư (gom mọi lớp), khối "Cần bạn xử lý" của một lớp, thanh "Lớp của bạn" và cột "Nộp x/y" của hàng bài.
// Chỉ ĐỌC, không đổi schema. Ai thấy lớp nào: Chủ nhiệm (quản trị trung tâm) mọi lớp; gia sư lớp mình là chủ (việc chấm / duyệt / nhận học sinh là của chủ lớp — ma trận
// courseAccess `score.write`), còn thanh bên thêm cả lớp mình đồng giảng. Tên học sinh chỉ trả cho người có quyền đó (trang gọi đã kiểm vai).
import { prisma } from "@/lib/prisma";
import { isCenterAdmin, type GateSession } from "@/lib/tutorGate";
import { classAccentFor } from "@/lib/classColor";
import { vnDateKeyOf } from "@/lib/classSessions";
import { vnDayStart } from "@/lib/unmarkedDaily";
import { emptyTodo, type ClassTodo } from "@/lib/lopViec";

type Who = GateSession & { userId: string };
const MAX_CLASSES = 200;
const MAX_ROWS = 2000;

export interface RailClass { id: string; name: string; color: string; students: number; ownerName: string | null; owned: boolean }

/** Lớp cho thanh bên: gia sư = lớp mình làm chủ + lớp đồng giảng đang hoạt động; Chủ nhiệm = mọi lớp. Mới tạo trước. */
export async function loadRailClasses(s: Who): Promise<RailClass[]> {
  const head = isCenterAdmin(s);
  const rows = await prisma.course.findMany({
    where: head ? {} : { OR: [{ ownerId: s.userId }, { courseTeachers: { some: { userId: s.userId, status: "active" } } }] },
    select: { id: true, name: true, calendarColor: true, ownerId: true, owner: { select: { name: true } }, _count: { select: { enrollments: { where: { status: "active" } } } } },
    orderBy: { createdAt: "desc" }, take: MAX_CLASSES,
  });
  return rows.map(c => ({
    id: c.id, name: c.name, color: classAccentFor(c.id, c.calendarColor), students: c._count.enrollments,
    ownerName: head ? (c.owner?.name ?? null) : null, owned: head || c.ownerId === s.userId,
  }));
}

/** Id các lớp có việc của người này (chủ lớp; Chủ nhiệm mọi lớp). */
export async function inboxCourseIds(s: Who): Promise<string[]> {
  const rows = await prisma.course.findMany({ where: isCenterAdmin(s) ? {} : { ownerId: s.userId }, select: { id: true }, orderBy: { createdAt: "desc" }, take: MAX_CLASSES });
  return rows.map(r => r.id);
}

const inCourses = (ids: string[]) => ({ chapter: { section: { courseId: { in: ids } } } });

/** Đếm việc theo lớp: bài nộp chưa chấm (bài tập nộp tệp), điểm tự khai chờ duyệt, xin vào lớp; và buổi sắp tới (từ hôm nay, giờ VN) chưa gắn video.
 *  "Xin vào lớp" chỉ tính lớp `joinOwnerId` làm chủ: duyệt / từ chối chỉ chủ lớp làm được (requireCourseTutor), Chủ nhiệm không nhận hộ. */
export async function loadClassTodos(ids: string[], now: Date, joinOwnerId: string): Promise<Map<string, ClassTodo>> {
  const out = new Map(ids.map(id => [id, emptyTodo(id)]));
  if (!ids.length) return out;
  const [subs, results, joins, lessons] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { score: null, assignment: { mode: { not: "azota" }, lesson: inCourses(ids) } },
      select: { assignment: { select: { lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } } } } }, take: MAX_ROWS,
    }),
    prisma.examResult.findMany({ where: { pendingReview: true, exam: { courseId: { in: ids } } }, select: { exam: { select: { courseId: true } } }, take: MAX_ROWS }),
    prisma.classJoinRequest.groupBy({ by: ["courseId"], where: { status: "pending", courseId: { in: ids }, course: { ownerId: joinOwnerId } }, _count: { _all: true } }),
    prisma.lesson.findMany({
      where: { ...inCourses(ids), scheduledAt: { gte: vnDayStart(now) }, OR: [{ videoUrl: null }, { videoUrl: "" }] },
      select: { id: true, title: true, scheduledAt: true, chapter: { select: { section: { select: { courseId: true } } } } }, orderBy: { scheduledAt: "asc" }, take: MAX_ROWS,
    }),
  ]);
  for (const s of subs) { const t = out.get(s.assignment.lesson.chapter.section.courseId); if (t) t.choCham++; }
  for (const r of results) { const t = r.exam.courseId ? out.get(r.exam.courseId) : undefined; if (t) t.choDuyet++; }
  for (const j of joins) { const t = out.get(j.courseId); if (t) t.xinVao = j._count._all; }
  for (const l of lessons) {
    const t = out.get(l.chapter.section.courseId);
    if (t && !t.nextNoVideo && l.scheduledAt) t.nextNoVideo = { lessonId: l.id, title: l.title, dateKey: vnDateKeyOf(l.scheduledAt) };
  }
  return out;
}

/** Tổng số việc cần ra tay (badge Hộp việc) — cùng nguồn với loadClassTodos. */
export async function loadInboxTotal(s: Who, now: Date): Promise<number> {
  const todos = await loadClassTodos(await inboxCourseIds(s), now, s.userId);
  let n = 0;
  for (const t of todos.values()) n += t.choCham + t.choDuyet + t.xinVao;
  return n;
}

export interface InboxGradeItem { submissionId: string; assignmentId: string; courseId: string; courseName: string; studentName: string; title: string; maxPoints: number; submittedAt: Date; fileUrl: string; kind: string }
export interface InboxApproveItem { resultId: string; courseId: string; courseName: string; studentName: string; title: string; score: number; totalPoints: number; completedAt: Date }
export interface InboxJoinItem { id: string; courseId: string; courseName: string; studentName: string; createdAt: Date }

/** Từng việc (bản điện thoại: duyệt điểm, chấm từng bài, nhận học sinh ngay trên Hộp việc). Cũ nhất trước. */
export async function loadInboxItems(ids: string[], joinOwnerId: string, limit = 50): Promise<{ grade: InboxGradeItem[]; approve: InboxApproveItem[]; join: InboxJoinItem[] }> {
  if (!ids.length) return { grade: [], approve: [], join: [] };
  const [subs, results, joins] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { score: null, assignment: { mode: { not: "azota" }, lesson: inCourses(ids) } }, orderBy: { submittedAt: "asc" }, take: limit,
      select: {
        id: true, assignmentId: true, submittedAt: true, fileUrl: true, kind: true, user: { select: { name: true } },
        assignment: { select: { title: true, maxPoints: true, lesson: { select: { chapter: { select: { section: { select: { course: { select: { id: true, name: true } } } } } } } } } },
      },
    }),
    prisma.examResult.findMany({
      where: { pendingReview: true, exam: { courseId: { in: ids } } }, orderBy: { completedAt: "asc" }, take: limit,
      select: { id: true, score: true, totalPoints: true, completedAt: true, user: { select: { name: true } }, exam: { select: { title: true, course: { select: { id: true, name: true } } } } },
    }),
    prisma.classJoinRequest.findMany({
      where: { status: "pending", courseId: { in: ids }, course: { ownerId: joinOwnerId } }, orderBy: { createdAt: "asc" }, take: limit,
      select: { id: true, createdAt: true, user: { select: { name: true } }, course: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    grade: subs.map(s => {
      const c = s.assignment.lesson.chapter.section.course;
      return { submissionId: s.id, assignmentId: s.assignmentId, courseId: c.id, courseName: c.name, studentName: s.user.name ?? "Học sinh", title: s.assignment.title, maxPoints: s.assignment.maxPoints, submittedAt: s.submittedAt, fileUrl: s.fileUrl, kind: s.kind };
    }),
    approve: results.filter(r => r.exam.course).map(r => ({ resultId: r.id, courseId: r.exam.course!.id, courseName: r.exam.course!.name, studentName: r.user.name ?? "Học sinh", title: r.exam.title, score: r.score, totalPoints: r.totalPoints, completedAt: r.completedAt })),
    join: joins.map(j => ({ id: j.id, courseId: j.course.id, courseName: j.course.name, studentName: j.user.name ?? "Học sinh", createdAt: j.createdAt })),
  };
}

export interface LessonStat { submitted: number; total: number; hasAssignment: boolean; /** Bài nộp chưa có điểm (học sinh đang học). */ pending: number }

/** Cột "Nộp x/y" của từng bài: số học sinh ĐANG HỌC đã nộp ít nhất một bài tập (không tính Azota) của bài / sĩ số. */
export async function loadLessonStats(courseId: string): Promise<Record<string, LessonStat>> {
  const [students, assignments] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId, status: "active" }, select: { userId: true } }),
    prisma.assignment.findMany({
      where: { mode: { not: "azota" }, lesson: { chapter: { section: { courseId } } } },
      select: { lessonId: true, submissions: { select: { userId: true, score: true } } }, take: MAX_ROWS,
    }),
  ]);
  const active = new Set(students.map(s => s.userId));
  const by = new Map<string, { set: Set<string>; pending: number }>();
  for (const a of assignments) {
    const e = by.get(a.lessonId) ?? { set: new Set<string>(), pending: 0 };
    for (const s of a.submissions) if (active.has(s.userId)) { e.set.add(s.userId); if (s.score === null) e.pending++; }
    by.set(a.lessonId, e);
  }
  const out: Record<string, LessonStat> = {};
  for (const [lessonId, e] of by) out[lessonId] = { submitted: e.set.size, total: active.size, hasAssignment: true, pending: e.pending };
  return out;
}
