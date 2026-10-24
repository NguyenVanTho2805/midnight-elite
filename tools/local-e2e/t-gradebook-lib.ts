import { progressOf, summariseClasses, type GradeRow } from "@/lib/gradebook";
import { check, section, done } from "./h";

section("progressOf");
check("tăng 6,5 → 8,0 = +1,5", progressOf(8, 6.5).code === "tang" && progressOf(8, 6.5).delta === 1.5 && progressOf(8, 6.5).text.startsWith("Tăng 1,5"));
check("giảm", progressOf(5, 8).code === "giam" && progressOf(5, 8).delta === -3);
check("bằng nhau", progressOf(7, 7).code === "giu");
check("thiếu một vế → chưa so sánh, không suy ra 0", progressOf(null, 7).code === "chua-so-sanh" && progressOf(7, null).code === "chua-so-sanh" && progressOf(null, null).delta === null);
check("NaN/Infinity bị chặn", progressOf(NaN, 7).code === "chua-so-sanh" && progressOf(7, Infinity).code === "chua-so-sanh");
check("sai số dấu phẩy động không thành 'giảm' (0,1+0,2 vs 0,3)", progressOf(0.1 + 0.2, 0.3).code === "giu");

section("summariseClasses");
const base = { studentId: "", name: "", effort: null, progress: progressOf(null, null) };
const mk = (id: string, course: string, ratio: number | null, value: number | null, assigned = 0, onTime = 0): GradeRow => ({
  ...base, studentId: id, courseId: course, courseName: course === "a" ? "Toán" : "Lý",
  attendance: { sessions: ratio === null ? 0 : 4, ratio }, homework: { assigned, onTime, ratio: assigned ? onTime / assigned : null },
  mastery: { code: "chua-du", text: "", value, n: value === null ? 0 : 1, scores: value === null ? [] : [value] },
});
const s = summariseClasses([mk("1", "a", 1, 8, 4, 3), mk("2", "a", 0.5, null, 4, 1), mk("3", "b", null, null)]);
const a = s.find(x => x.courseId === "a")!, b = s.find(x => x.courseId === "b")!;
check("lớp a: chuyên cần TB 75%, năng lực TB 8 trên 1 em, bài đúng hạn 4/8 = 50%", a.attendanceAvgPct === 75 && a.masteryAvg === 8 && a.masteryCount === 1 && a.homeworkOnTimePct === 50 && a.students === 2, a);
check("lớp b không có số → null (không 0)", b.attendanceAvgPct === null && b.masteryAvg === null && b.homeworkOnTimePct === null, b);
check("rỗng → rỗng", summariseClasses([]).length === 0);
done();
