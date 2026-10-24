// Thưởng Coin khi học sinh làm bài (quiz / bài tập về nhà). Hàm THUẦN: không đụng DB,
// để test hết các ngưỡng. Ghi vào ví nằm ở wallet.ts (addQuizRewardCoins).
//
// Nguyên tắc: Coin này là "tiền chơi", chỉ kiếm bằng học, không mua được, không đổi ra tiền.
// Mọi con số lấy từ wallet-constants.ts; ở đây không viết cứng số nào.
import {
  QUIZ_REWARD_BASE, QUIZ_REWARD_FAST_BONUS, QUIZ_MIN_SCORE_RATIO, QUIZ_FAST_SCORE_RATIO,
  QUIZ_FAST_TIME_RATIO, QUIZ_MIN_SECONDS, QUIZ_MAX_TAB_SWITCH,
} from "@/lib/wallet-constants";

export type QuizRewardInput = {
  status: string;                 // chỉ "submitted" mới được thưởng ("expired" = hết giờ, không thưởng)
  score: number | null;
  examTotalPoints: number;        // thang điểm đề (Exam.totalPoints)
  startedAt: Date;
  submittedAt: Date | null;
  expiresAt: Date;
  tabSwitchCount: number;
};

export type QuizRewardResult = { coins: number; fast: boolean; why: string };

export function computeQuizReward(a: QuizRewardInput): QuizRewardResult {
  const none = (why: string): QuizRewardResult => ({ coins: 0, fast: false, why });
  if (a.status !== "submitted" || !a.submittedAt) return none("not_submitted");
  if (a.score == null || !Number.isFinite(a.score) || !(a.examTotalPoints > 0)) return none("no_score");
  if (a.tabSwitchCount > QUIZ_MAX_TAB_SWITCH) return none("tab_switch");
  if (a.submittedAt.getTime() > a.expiresAt.getTime()) return none("late");

  const ratio = Math.min(1, Math.max(0, a.score / a.examTotalPoints));
  if (ratio < QUIZ_MIN_SCORE_RATIO) return none("low_score");

  const allowedMs = a.expiresAt.getTime() - a.startedAt.getTime();
  const usedMs = a.submittedAt.getTime() - a.startedAt.getTime();
  const fast =
    ratio >= QUIZ_FAST_SCORE_RATIO &&
    allowedMs > 0 &&
    usedMs >= QUIZ_MIN_SECONDS * 1000 &&
    usedMs <= allowedMs * QUIZ_FAST_TIME_RATIO;

  return { coins: QUIZ_REWARD_BASE + (fast ? QUIZ_REWARD_FAST_BONUS : 0), fast, why: fast ? "fast" : "ok" };
}
