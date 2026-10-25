// Thưởng Coin làm bài — bài thuần: các ngưỡng của computeQuizReward. Không cần máy chủ.
import { computeQuizReward, type QuizRewardInput } from "@/lib/quizReward";
import { QUIZ_REWARD_BASE, QUIZ_REWARD_FAST_BONUS, QUIZ_MAX_TAB_SWITCH, QUIZ_MIN_SECONDS } from "@/lib/wallet-constants";
import { check, section, done } from "./h";

const T0 = new Date("2026-10-22T08:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
// Đề 10 phút, thang 150 điểm.
const base = (o: Partial<QuizRewardInput> = {}): QuizRewardInput => ({
  status: "submitted", score: 150, examTotalPoints: 150, startedAt: T0, submittedAt: at(120), expiresAt: at(600), tabSwitchCount: 0, ...o,
});
const coins = (o: Partial<QuizRewardInput>) => computeQuizReward(base(o)).coins;
const why = (o: Partial<QuizRewardInput>) => computeQuizReward(base(o)).why;

(async () => {
  section("Thưởng cơ bản và thưởng nhanh");
  check("đúng hết, nộp sau 2/10 phút → cơ bản + nhanh", coins({}) === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS, computeQuizReward(base()));
  check("đúng hết nhưng nộp ở phút 9 → chỉ cơ bản", coins({ submittedAt: at(540) }) === QUIZ_REWARD_BASE);
  check("đúng 50% (vừa đủ) → cơ bản", coins({ score: 75, submittedAt: at(540) }) === QUIZ_REWARD_BASE);
  check("đúng 80% + nhanh → nhanh", coins({ score: 120 }) === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS);
  check("đúng 79% + nhanh → chỉ cơ bản (chưa đủ mức nhanh)", coins({ score: 118 }) === QUIZ_REWARD_BASE);
  check("đúng đúng 50% thời gian → vẫn là nhanh", coins({ submittedAt: at(300) }) === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS);
  check("quá 50% thời gian 1 giây → không nhanh", coins({ submittedAt: at(301) }) === QUIZ_REWARD_BASE);

  section("Không thưởng");
  check("đúng dưới 50% → 0 (low_score)", coins({ score: 74 }) === 0 && why({ score: 74 }) === "low_score");
  check("điểm 0 → 0", coins({ score: 0 }) === 0);
  check("hết giờ (expired) → 0", coins({ status: "expired" }) === 0 && why({ status: "expired" }) === "not_submitted");
  check("đang làm (in_progress) → 0", coins({ status: "in_progress", submittedAt: null }) === 0);
  check("không có điểm (null) → 0", coins({ score: null }) === 0 && why({ score: null }) === "no_score");
  check("điểm NaN → 0", coins({ score: NaN }) === 0);
  check("thang điểm 0 hoặc âm → 0 (không chia cho 0)", coins({ examTotalPoints: 0 }) === 0 && coins({ examTotalPoints: -5 }) === 0);
  check("nộp sau hạn → 0 (late)", coins({ submittedAt: at(601) }) === 0 && why({ submittedAt: at(601) }) === "late");
  check(`rời tab quá ${QUIZ_MAX_TAB_SWITCH} lần → 0`, coins({ tabSwitchCount: QUIZ_MAX_TAB_SWITCH + 1 }) === 0 && why({ tabSwitchCount: QUIZ_MAX_TAB_SWITCH + 1 }) === "tab_switch");
  check(`rời tab đúng ${QUIZ_MAX_TAB_SWITCH} lần → vẫn thưởng`, coins({ tabSwitchCount: QUIZ_MAX_TAB_SWITCH }) > 0);

  section("Chống làm quá nhanh");
  check(`nộp trong ${QUIZ_MIN_SECONDS - 1} giây dù đúng hết → chỉ cơ bản, không thưởng nhanh`, coins({ submittedAt: at(QUIZ_MIN_SECONDS - 1) }) === QUIZ_REWARD_BASE);
  check(`nộp đúng ${QUIZ_MIN_SECONDS} giây → được nhanh`, coins({ submittedAt: at(QUIZ_MIN_SECONDS) }) === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS);
  check("điểm vượt thang (lỗi dữ liệu) bị kẹp về 100%, không thưởng quá mức", coins({ score: 9999 }) === QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS);
  check("thời gian cho phép 0 → không thưởng nhanh, không lỗi", coins({ expiresAt: T0, submittedAt: T0 }) === QUIZ_REWARD_BASE);
  check("không bao giờ vượt cơ bản + nhanh", [0, 50, 100, 150, 1e9].every(s => coins({ score: s }) <= QUIZ_REWARD_BASE + QUIZ_REWARD_FAST_BONUS));
  await done();
})();
