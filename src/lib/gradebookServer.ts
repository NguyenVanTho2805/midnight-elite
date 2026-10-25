// PT-05 — sổ điểm của gia sư (phần chạm DB). Dùng lại loadStudentMonth: nó chỉ tính các lớp có ownerId = gia sư,
// và đã bỏ điểm quiz tự luận chưa công bố (dropHeldResults/examHold). Tên học sinh chỉ trả cho gia sư chủ lớp.
import { listTutorStudents, loadStudentMonth } from "@/lib/monthlyReportServer";
import { prevYearMonth } from "@/lib/monthlyReport";
import { progressOf, summariseClasses, type GradeRow } from "@/lib/gradebook";

export const GRADEBOOK_MAX_STUDENTS = 200;

export async function loadTutorGradebook(tutorId: string, yearMonth: string, courseId: string | null) {
  const all = await listTutorStudents(tutorId);
  const students = all.filter(s => !courseId || s.courses.some(c => c.id === courseId)).slice(0, GRADEBOOK_MAX_STUDENTS);
  const prevYm = prevYearMonth(yearMonth);
  const rows: GradeRow[] = [];
  for (const s of students) {
    const [cur, prev] = await Promise.all([loadStudentMonth(tutorId, s.id, yearMonth), loadStudentMonth(tutorId, s.id, prevYm)]);
    if (!cur) continue;
    for (const sub of cur.subjects) {
      if (courseId && sub.courseId !== courseId) continue;
      const before = prev?.subjects.find(p => p.courseId === sub.courseId);
      rows.push({
        studentId: s.id, name: s.name, courseId: sub.courseId, courseName: sub.courseName,
        attendance: sub.attendance, homework: sub.homework, effort: sub.effort,
        mastery: { code: sub.mastery.code, text: sub.mastery.text, value: sub.mastery.value, n: sub.mastery.n, scores: sub.mastery.scores },
        progress: progressOf(sub.mastery.value, before?.mastery.value ?? null),
      });
    }
  }
  return { yearMonth, rows, classes: summariseClasses(rows), truncated: all.length > GRADEBOOK_MAX_STUDENTS };
}
