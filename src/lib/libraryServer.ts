// Thư viện — phần CÓ DB: gom bài học (video, tài liệu, bài tập + trạng thái) của các lớp một người. Phần thuần: src/lib/library.ts.
//   Học viên: các lớp đang học (Enrollment.status = "active"), kèm tiến độ xem và bài nộp CỦA CHÍNH HỌ.
//   Gia sư  : các lớp mình sở hữu (Course.ownerId), kèm số bài nộp / chờ chấm.
// Chỉ liệt kê bài có gì để xem (video, tài liệu hoặc bài tập); số bài còn trống được đếm riêng để giao diện nói rõ.
import { prisma } from "@/lib/prisma";
import { assignmentStatus, parseDurationSeconds, parseLessonDocuments, tutorAssignmentSummary, watchLabel, shortDate, type LibDoc, type LibTone } from "@/lib/library";

export interface LibAssignment { id: string; title: string; due: string | null; status: { label: string; tone: LibTone } }
export interface LibLesson {
  id: string;
  title: string;
  type: string;
  where: string; // "Phần · Chương"
  duration: string | null;
  hasVideo: boolean;
  watch: { label: string; tone: LibTone } | null; // chỉ học viên
  docs: LibDoc[];
  assignments: LibAssignment[];
}
export interface LibClass { id: string; name: string; lessons: LibLesson[]; emptyLessons: number }

const MAX_CLASSES = 50, MAX_LESSONS = 300;

const courseSelect = {
  id: true, name: true,
  sections: {
    orderBy: { order: "asc" as const },
    select: {
      title: true,
      chapters: {
        orderBy: { order: "asc" as const },
        select: {
          title: true,
          lessons: {
            orderBy: { order: "asc" as const },
            select: { id: true, title: true, type: true, duration: true, videoUrl: true, documents: true, assignments: { where: { mode: { not: "azota" } }, select: { id: true, title: true, dueDate: true, maxPoints: true }, orderBy: { createdAt: "asc" as const } } },
          },
        },
      },
    },
  },
};

type CourseTree = Awaited<ReturnType<typeof loadTrees>>[number];
const loadTrees = (where: { id?: { in: string[] }; ownerId?: string }) =>
  prisma.course.findMany({ where, select: courseSelect, take: MAX_CLASSES, orderBy: { createdAt: "desc" } });

function flatten(c: CourseTree) {
  const out: { where: string; l: CourseTree["sections"][number]["chapters"][number]["lessons"][number] }[] = [];
  for (const s of c.sections) for (const ch of s.chapters) for (const l of ch.lessons) out.push({ where: [s.title, ch.title].filter(Boolean).join(" · "), l });
  return out.slice(0, MAX_LESSONS);
}

export async function loadStudentLibrary(userId: string, now: Date): Promise<LibClass[]> {
  const enr = await prisma.enrollment.findMany({ where: { userId, status: "active" }, select: { courseId: true } });
  if (enr.length === 0) return [];
  const courses = await loadTrees({ id: { in: enr.map(e => e.courseId) } });
  const flat = courses.map(c => ({ c, items: flatten(c) }));
  const lessonIds = flat.flatMap(f => f.items.map(i => i.l.id));
  const assignIds = flat.flatMap(f => f.items.flatMap(i => i.l.assignments.map(a => a.id)));
  const [progress, subs] = await Promise.all([
    prisma.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } }, select: { lessonId: true, watchedSeconds: true } }),
    prisma.assignmentSubmission.findMany({ where: { userId, assignmentId: { in: assignIds } }, select: { assignmentId: true, score: true, gradedAt: true } }),
  ]);
  const watched = new Map(progress.map(p => [p.lessonId, p.watchedSeconds]));
  const sub = new Map(subs.map(s => [s.assignmentId, s]));
  return flat.map(({ c, items }) => {
    const lessons: LibLesson[] = [];
    for (const { where, l } of items) {
      const docs = parseLessonDocuments(l.documents);
      const hasVideo = !!l.videoUrl;
      if (!hasVideo && docs.length === 0 && l.assignments.length === 0) continue;
      lessons.push({
        id: l.id, title: l.title, type: l.type, where, duration: l.duration, hasVideo, docs,
        watch: hasVideo ? watchLabel(watched.get(l.id), parseDurationSeconds(l.duration)) : null,
        assignments: l.assignments.map(a => ({ id: a.id, title: a.title, due: a.dueDate ? shortDate(a.dueDate) : null, status: assignmentStatus(a, sub.get(a.id) ?? null, now) })),
      });
    }
    return { id: c.id, name: c.name, lessons, emptyLessons: items.length - lessons.length };
  });
}

export async function loadTutorLibrary(userId: string): Promise<LibClass[]> {
  const courses = await loadTrees({ ownerId: userId });
  if (courses.length === 0) return [];
  const flat = courses.map(c => ({ c, items: flatten(c) }));
  const assignIds = flat.flatMap(f => f.items.flatMap(i => i.l.assignments.map(a => a.id)));
  const [all, ungraded] = await Promise.all([
    prisma.assignmentSubmission.groupBy({ by: ["assignmentId"], where: { assignmentId: { in: assignIds } }, _count: { _all: true } }),
    prisma.assignmentSubmission.groupBy({ by: ["assignmentId"], where: { assignmentId: { in: assignIds }, gradedAt: null }, _count: { _all: true } }),
  ]);
  const nAll = new Map(all.map(g => [g.assignmentId, g._count._all])), nUn = new Map(ungraded.map(g => [g.assignmentId, g._count._all]));
  return flat.map(({ c, items }) => {
    const lessons: LibLesson[] = [];
    for (const { where, l } of items) {
      const docs = parseLessonDocuments(l.documents);
      const hasVideo = !!l.videoUrl;
      if (!hasVideo && docs.length === 0 && l.assignments.length === 0) continue;
      lessons.push({
        id: l.id, title: l.title, type: l.type, where, duration: l.duration, hasVideo, docs, watch: null,
        assignments: l.assignments.map(a => ({ id: a.id, title: a.title, due: a.dueDate ? shortDate(a.dueDate) : null, status: tutorAssignmentSummary(nAll.get(a.id) ?? 0, nUn.get(a.id) ?? 0) })),
      });
    }
    return { id: c.id, name: c.name, lessons, emptyLessons: items.length - lessons.length };
  });
}
