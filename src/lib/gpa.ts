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
