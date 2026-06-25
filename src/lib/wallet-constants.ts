// Tham số kinh tế xu (Knowledge Bounty) — tách riêng khỏi wallet.ts vì file đó
// import Prisma, không thể dùng trong Client Component. File này an toàn cho
// cả server và client.
export const SIGNUP_BONUS  = 50; // xu tặng khi đăng ký
export const QUESTION_COST = 10; // xu trừ khi đăng câu hỏi
export const ANSWER_REWARD = 20; // xu thưởng khi câu trả lời được chấp nhận (hệ thống cấp riêng)
