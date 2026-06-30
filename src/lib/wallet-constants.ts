// Tham số kinh tế xu — tách riêng khỏi wallet.ts vì file đó import Prisma,
// không thể dùng trong Client Component. File này an toàn cho cả server và client.

// ─── Hỏi đáp ──────────────────────────────────────────────────────────────────
export const SIGNUP_BONUS  = 50; // xu tặng khi đăng ký
export const QUESTION_COST = 10; // xu trừ khi đăng câu hỏi
export const ANSWER_REWARD = 20; // xu thưởng khi câu trả lời được chấp nhận

// ─── Hành động học tập ────────────────────────────────────────────────────────
export const LESSON_REWARD = 3;  // xu nhận khi hoàn thành bài học lần đầu tiên

// ─── Cộng đồng ────────────────────────────────────────────────────────────────
export const THREAD_REWARD = 5;  // xu nhận khi đăng bài viết
export const REPLY_REWARD  = 2;  // xu nhận khi trả lời bài viết

export const MAX_THREAD_REWARDS_PER_DAY = 3; // tối đa 3 bài được thưởng/ngày
export const MAX_REPLY_REWARDS_PER_DAY  = 5; // tối đa 5 reply được thưởng/ngày
