// Shared GPA + completion formula — dùng trong admin/students và honor-leaderboard
// GPA = 40% tiến độ + 60% điểm thi thử, cả hai normalize về /10

export function computeCompletion(
  completedLessons: number,
  totalLessons: number,
): number {
  if (totalLessons === 0) return 0;
  return Math.min(100, Math.round(completedLessons / totalLessons * 100));
}

export function computeGpa(
  completion: number,
  bestExam?: { score: number; totalPoints: number },
): number {
  const completionNorm = completion / 10;
  if (!bestExam) return Math.round(completionNorm * 10) / 10;
  const examNorm = bestExam.score / bestExam.totalPoints * 10;
  return Math.round((completionNorm * 0.4 + examNorm * 0.6) * 10) / 10;
}

// Điểm trung bình bài tập tự nộp (Assignment/AssignmentSubmission) — chỉ số
// RIÊNG, KHÔNG gộp vào computeGpa ở trên (theo yêu cầu: hiển thị cạnh GPA,
// không ảnh hưởng công thức xét học bổng gốc). null = chưa có bài nào được
// chấm, khác 0 (0 nghĩa là có bài chấm nhưng điểm 0).
export function computeAssignmentAverage(graded: { score: number; maxPoints: number }[]): number | null {
  if (graded.length === 0) return null;
  const avgNorm = graded.reduce((sum, g) => sum + (g.score / g.maxPoints * 10), 0) / graded.length;
  return Math.round(avgNorm * 10) / 10;
}
