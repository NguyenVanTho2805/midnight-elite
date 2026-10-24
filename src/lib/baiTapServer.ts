// "Bài tập và kiểm tra" của gia sư — phần CÓ DB. Chỉ đọc; chấm điểm vẫn đi qua API cũ /api/assignments/[id]/submissions/[id]/grade.
// Gồm bài tập thuộc lớp mình sở hữu (Course.ownerId) hoặc do mình tạo (Assignment.ownerId) và đề thi do mình tạo (Exam.ownerId).
import { prisma } from "@/lib/prisma";
import { computeExamStatus } from "@/lib/examData";
import { essayNeedsGrading } from "@/lib/quizGrade";
import { assignmentSub, classifyAssignment, classifyExam, GROUP_ORDER, type BaiTapItem } from "@/lib/baiTap";

const MAX_ASSIGNMENTS = 300, MAX_EXAMS = 100;

export interface BaiTapData { items: BaiTapItem[]; courses: { id: string; name: string }[] }

export async function loadBaiTap(tutorId: string, now: Date): Promise<BaiTapData> {
  const [courses, assignments, exams] = await Promise.all([
    prisma.course.findMany({ where: { ownerId: tutorId }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.assignment.findMany({
      where: { OR: [{ ownerId: tutorId }, { lesson: { chapter: { section: { course: { ownerId: tutorId } } } } }] },
      select: {
        id: true, title: true, mode: true, dueDate: true, maxPoints: true,
        lesson: { select: { chapter: { select: { section: { select: { course: { select: { id: true, name: true } } } } } } } },
      },
      orderBy: { createdAt: "desc" }, take: MAX_ASSIGNMENTS,
    }),
    prisma.exam.findMany({
      where: { ownerId: tutorId },
      select: { id: true, title: true, date: true, time: true, questions: true, active: true, courseId: true, course: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: MAX_EXAMS,
    }),
  ]);

  const ids = assignments.map(a => a.id);
  const courseIds = [...new Set(assignments.map(a => a.lesson.chapter.section.course.id))];
  const [all, ungraded, lastSubs, enrolled] = await Promise.all([
    prisma.assignmentSubmission.groupBy({ by: ["assignmentId"], where: { assignmentId: { in: ids } }, _count: { _all: true } }),
    prisma.assignmentSubmission.groupBy({ by: ["assignmentId"], where: { assignmentId: { in: ids }, gradedAt: null }, _count: { _all: true } }),
    prisma.assignmentSubmission.findMany({ where: { assignmentId: { in: ids } }, orderBy: { submittedAt: "desc" }, distinct: ["assignmentId"], select: { assignmentId: true, submittedAt: true, user: { select: { name: true } } } }),
    prisma.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, status: "active" }, _count: { _all: true } }),
  ]);
  const nAll = new Map(all.map(g => [g.assignmentId, g._count._all]));
  const nUn = new Map(ungraded.map(g => [g.assignmentId, g._count._all]));
  const last = new Map(lastSubs.map(s => [s.assignmentId, { name: s.user?.name ?? "Học viên", at: s.submittedAt }]));
  const nEnr = new Map(enrolled.map(g => [g.courseId, g._count._all]));

  const items: BaiTapItem[] = assignments.map(a => {
    const c = a.lesson.chapter.section.course;
    const submitted = nAll.get(a.id) ?? 0, un = nUn.get(a.id) ?? 0;
    const cls = classifyAssignment({ submitted, ungraded: un, dueAt: a.dueDate }, now);
    return {
      id: a.id, kind: "assignment", courseId: c.id, courseName: c.name, title: a.title, mode: a.mode, maxPoints: a.maxPoints,
      submitted, ungraded: un, group: cls.group, statusLabel: cls.label, statusTone: cls.tone,
      sub: assignmentSub({ submitted, enrolled: nEnr.get(c.id) ?? 0, dueAt: a.dueDate, last: last.get(a.id) ?? null }),
      href: `/admin/khoa-hoc/${c.id}?tab=chuong-bai`,
    };
  });
  // QZ-08: đề có bài nộp còn câu tự luận chưa chấm → "Chờ chấm" (số bài, không đếm câu). Bài bỏ trống không cần chấm.
  const examIds = exams.map(e => e.id);
  const essayRows = examIds.length === 0 ? [] : await prisma.examAnswer.findMany({
    where: { attempt: { examId: { in: examIds }, status: { not: "in_progress" } }, question: { type: "ESSAY" }, pointsAwarded: null, textAnswer: { not: null } },
    select: { attemptId: true, textAnswer: true, attempt: { select: { examId: true } } },
  });
  const pendingByExam = new Map<string, Set<string>>();
  for (const r of essayRows) {
    if (!essayNeedsGrading({ textAnswer: r.textAnswer, pointsAwarded: null })) continue;
    const set = pendingByExam.get(r.attempt.examId) ?? new Set<string>();
    set.add(r.attemptId); pendingByExam.set(r.attempt.examId, set);
  }
  for (const e of exams) {
    const cls = classifyExam(computeExamStatus(e.date, e.time, e.active));
    const waiting = pendingByExam.get(e.id)?.size ?? 0;
    items.push({
      id: e.id, kind: "exam", courseId: e.courseId, courseName: e.course?.name ?? "Đề dùng chung", title: e.title, mode: "exam", maxPoints: 0,
      submitted: 0, ungraded: waiting,
      group: waiting > 0 ? "cho" : cls.group, statusLabel: waiting > 0 ? "Chờ chấm" : cls.label, statusTone: waiting > 0 ? "cho" : cls.tone,
      sub: `${e.questions} câu · thi ${e.date} lúc ${e.time}${waiting > 0 ? ` · ${waiting} bài chờ chấm` : ""}`, href: `/admin/thi-thu/${e.id}`,
    });
  }
  // Ổn định: nhóm trước, cùng nhóm giữ thứ tự mới → cũ đã lấy từ DB.
  items.sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group]);
  return { items, courses };
}
