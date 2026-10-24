// PT-05 — sổ điểm và tiến bộ của gia sư: phần THUẦN (không Prisma). Số gốc (chuyên cần, bài về nhà, năng lực) đến từ
// loadStudentMonth/buildSubjectMetrics đã có — ở đây chỉ so tháng này với tháng trước và gom theo lớp. Không thu điểm mới,
// không công thức tiền. Điểm quiz tự luận chưa công bố đã bị loại ở nguồn (dropHeldResults); thiếu số thì để null, không ghi 0.
import type { SubjectMonthMetrics } from "@/lib/monthlyReport";

export type ProgressCode = "tang" | "giam" | "giu" | "chua-so-sanh";
export interface Progress { code: ProgressCode; delta: number | null; text: string }

const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => r1(Math.abs(n)).toFixed(1).replace(".", ",");

/** So điểm năng lực (thang 10) tháng này với tháng trước. Thiếu một trong hai → "Chưa so sánh" (không suy ra 0). */
export function progressOf(cur: number | null, prev: number | null): Progress {
  if (cur === null || prev === null || !Number.isFinite(cur) || !Number.isFinite(prev)) return { code: "chua-so-sanh", delta: null, text: "Chưa so sánh được" };
  const d = r1(cur - prev);
  if (d === 0) return { code: "giu", delta: 0, text: "Giữ nguyên so với tháng trước" };
  return d > 0 ? { code: "tang", delta: d, text: `Tăng ${fmt(d)} điểm so với tháng trước` } : { code: "giam", delta: d, text: `Giảm ${fmt(d)} điểm so với tháng trước` };
}

export interface GradeRow {
  studentId: string; name: string; courseId: string; courseName: string;
  attendance: SubjectMonthMetrics["attendance"];
  homework: SubjectMonthMetrics["homework"];
  effort: number | null;
  mastery: { code: string; text: string; value: number | null; n: number; scores: number[] };
  progress: Progress;
}

export interface ClassSummary {
  courseId: string; courseName: string; students: number;
  attendanceAvgPct: number | null; masteryAvg: number | null; masteryCount: number;
  homeworkOnTimePct: number | null;
}

/** Gom từng lớp. Chỉ lấy trung bình trên những em CÓ số; không em nào có → null. */
export function summariseClasses(rows: GradeRow[]): ClassSummary[] {
  const by = new Map<string, GradeRow[]>();
  for (const r of rows) by.set(r.courseId, [...(by.get(r.courseId) ?? []), r]);
  return [...by.entries()].map(([courseId, rs]) => {
    const att = rs.map(r => r.attendance.ratio).filter((x): x is number => x !== null);
    const mas = rs.map(r => r.mastery.value).filter((x): x is number => x !== null);
    const assigned = rs.reduce((s, r) => s + r.homework.assigned, 0), onTime = rs.reduce((s, r) => s + r.homework.onTime, 0);
    return {
      courseId, courseName: rs[0].courseName, students: rs.length,
      attendanceAvgPct: att.length ? Math.round((att.reduce((a, b) => a + b, 0) / att.length) * 100) : null,
      masteryAvg: mas.length ? r1(mas.reduce((a, b) => a + b, 0) / mas.length) : null, masteryCount: mas.length,
      homeworkOnTimePct: assigned > 0 ? Math.round((onTime / assigned) * 100) : null,
    };
  }).sort((a, b) => a.courseName.localeCompare(b.courseName, "vi"));
}
