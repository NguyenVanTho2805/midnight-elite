// SCL-C (21/11/2026, P1-1) — sổ điểm gọn (phần chạm DB): bảng học sinh × bài của MỘT lớp. Cột = bài tập nộp tệp (Assignment của các bài trong lớp)
// + đề gắn lớp (quiz có câu hỏi, đề Azota không câu hỏi). Ô = điểm hoặc chữ trạng thái (src/lib/soDiem.ts). Điểm quiz tự luận đang giữ (examHold) ⇒ "Chờ chấm".
// Ai thấy lớp nào: Chủ nhiệm (quản trị trung tâm) mọi lớp; gia sư chỉ lớp mình làm chủ (Course.ownerId); học sinh chỉ dòng của mình (loadStudentResults).
import { prisma } from "@/lib/prisma";
import { dropHeldResults } from "@/lib/examHold";
import { PUBLISHED_ONLY } from "@/lib/lessonStatus";
import { isCenterAdmin, type GateSession } from "@/lib/tutorGate";
import { assignmentCell, examCell, type Cell, type Column } from "@/lib/soDiem";

export const GRADEBOOK_MAX_STUDENTS = 200;
const MAX_COLUMNS = 60;

export type GradeCell = Cell & { submissionId?: string; resultId?: string };
export interface GradeRow { studentId: string; name: string; cells: Record<string, GradeCell> }

/** Lớp người này được mở sổ điểm. */
export async function gradebookCourses(s: GateSession & { userId: string }): Promise<{ id: string; name: string }[]> {
  return prisma.course.findMany({ where: isCenterAdmin(s) ? {} : { ownerId: s.userId }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 200 });
}

async function loadGrid(courseId: string, userIds: string[], learner: boolean): Promise<{ columns: Column[]; cells: Map<string, Record<string, GradeCell>> }> {
  const [assignments, exams] = await Promise.all([
    prisma.assignment.findMany({
      where: { mode: { not: "azota" }, lesson: { ...(learner ? PUBLISHED_ONLY : {}), chapter: { section: { courseId } } } },
      select: { id: true, title: true, maxPoints: true }, orderBy: { createdAt: "asc" }, take: MAX_COLUMNS,
    }),
    prisma.exam.findMany({
      where: { courseId, isDraft: false, supersededById: null, variantOfId: null, ...(learner ? { active: true } : {}) },
      select: { id: true, title: true, totalPoints: true, _count: { select: { examQuestions: true } } }, orderBy: { createdAt: "asc" }, take: MAX_COLUMNS,
    }),
  ]);
  const columns: Column[] = [
    ...assignments.map(a => ({ id: a.id, kind: "bai-tap" as const, title: a.title, max: a.maxPoints })),
    ...exams.map(e => ({ id: e.id, kind: e._count.examQuestions > 0 ? "quiz" as const : "azota" as const, title: e.title, max: e.totalPoints })),
  ];
  const examIds = exams.map(e => e.id);
  const [subs, results, attempts] = await Promise.all([
    prisma.assignmentSubmission.findMany({ where: { assignmentId: { in: assignments.map(a => a.id) }, userId: { in: userIds } }, select: { id: true, assignmentId: true, userId: true, score: true } }),
    examIds.length ? prisma.examResult.findMany({ where: { examId: { in: examIds }, userId: { in: userIds } }, select: { id: true, examId: true, userId: true, score: true, totalPoints: true, pendingReview: true } }) : [],
    examIds.length ? prisma.examAttempt.findMany({
      where: { userId: { in: userIds }, status: { not: "in_progress" }, OR: [{ examId: { in: examIds } }, { exam: { variantOfId: { in: examIds } } }] },
      select: { userId: true, examId: true, exam: { select: { variantOfId: true } } },
    }) : [],
  ]);
  const shown = await dropHeldResults(results);
  const key = (u: string, c: string) => `${u}|${c}`;
  const sub = new Map(subs.map(s => [key(s.userId, s.assignmentId), s]));
  const res = new Map(shown.map(r => [key(r.userId, r.examId), r]));
  const done = new Set(attempts.map(a => key(a.userId, a.exam.variantOfId ?? a.examId)));

  const cells = new Map<string, Record<string, GradeCell>>();
  for (const u of userIds) {
    const row: Record<string, GradeCell> = {};
    for (const a of assignments) { const s = sub.get(key(u, a.id)); row[a.id] = { ...assignmentCell(s, a.maxPoints), ...(s ? { submissionId: s.id } : {}) }; }
    for (const e of exams) { const r = res.get(key(u, e.id)); row[e.id] = { ...examCell(r, done.has(key(u, e.id))), ...(r ? { resultId: r.id } : {}) }; }
    cells.set(u, row);
  }
  return { columns, cells };
}

/** Sổ điểm một lớp cho người dạy. Người gọi đã kiểm quyền với lớp (route / trang). */
export async function loadClassGradebook(courseId: string): Promise<{ columns: Column[]; rows: GradeRow[]; truncated: boolean }> {
  const enr = await prisma.enrollment.findMany({
    where: { courseId, status: "active" }, select: { userId: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: GRADEBOOK_MAX_STUDENTS + 1,
  });
  const list = enr.slice(0, GRADEBOOK_MAX_STUDENTS);
  const { columns, cells } = await loadGrid(courseId, list.map(e => e.userId), false);
  return { columns, rows: list.map(e => ({ studentId: e.userId, name: e.user.name ?? "Học sinh", cells: cells.get(e.userId) ?? {} })), truncated: enr.length > GRADEBOOK_MAX_STUDENTS };
}

/** Kết quả của CHÍNH học sinh: các lớp đang học (hoặc một lớp), mỗi bài một dòng. Không trả id dòng điểm / bài nộp. */
/** SCL-G-HS (R4): điểm "Chờ duyệt" KHÔNG rời máy chủ tới học sinh (score = null) — chỉ chủ nhiệm xác nhận xong mới thấy số. */
export async function loadStudentResults(userId: string, courseId: string | null) {
  const enr = await prisma.enrollment.findMany({
    where: { userId, status: "active", ...(courseId ? { courseId } : {}) }, select: { course: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 30,
  });
  const out: { courseId: string; courseName: string; items: (Column & Omit<Cell, "max">)[] }[] = [];
  for (const { course } of enr) {
    const { columns, cells } = await loadGrid(course.id, [userId], true);
    const mine = cells.get(userId) ?? {};
    out.push({ courseId: course.id, courseName: course.name, items: columns.map(c => { const x = mine[c.id]; return { ...c, state: x.state, label: x.label, score: x.state === "cho-duyet" ? null : x.score }; }) });
  }
  return out;
}
