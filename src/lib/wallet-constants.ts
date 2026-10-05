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

// ─── CoinTransaction.sourceType — phân loại nguồn dòng tiền ───────────────────
// Dùng chung giữa server (wallet.ts, coin_transactions schema) và client (nếu
// cần hiển thị bộ lọc trong UI lịch sử ví).
export const COIN_SOURCE_TYPES = {
  TOPUP:              "topup",              // người dùng nạp tiền quy đổi ra xu
  REWARD:             "reward",              // thưởng từ hệ thống (signup, học bài, cộng đồng, chấp nhận trả lời)
  CLASS_SUBSCRIPTION: "class_subscription", // (giữ cho tương thích) trừ xu để mua gói lớp — mô hình backlog gốc, hiện chưa dùng
  TUTOR_SUBSCRIPTION: "tutor_subscription", // trừ xu để gia sư mua VIP (D01 chốt 05/10/2026)
  REFUND:             "refund",              // hoàn xu (huỷ gói, chấm điểm sai, v.v.)
  PENALTY:            "penalty",             // phạt (báo cáo trả lời vi phạm)
} as const;
export type CoinSourceType = (typeof COIN_SOURCE_TYPES)[keyof typeof COIN_SOURCE_TYPES];

// ─── CoinTransaction.reason — mã nghiệp vụ cụ thể ─────────────────────────────
// Danh sách này tập trung mọi reason đang được ghi vào DB — thay vì rải chuỗi
// tự do khắp các route (hiện tượng cũ: "thread_reward"/"reply_reward" được
// phát sinh ngoài 4 giá trị liệt kê ở comment schema). Khi thêm reason mới
// hãy khai báo ở đây rồi dùng COIN_REASONS.XYZ ở nơi cần.
export const COIN_REASONS = {
  SIGNUP_BONUS:        "signup_bonus",         // tặng khi tạo tài khoản
  QUESTION_COST:       "question_cost",         // trừ khi đăng câu hỏi
  ANSWER_REWARD:       "answer_reward",         // thưởng khi trả lời được chấp nhận
  REPORT_PENALTY:      "report_penalty",        // phạt khi trả lời bị báo cáo vi phạm
  LESSON_REWARD:       "lesson_reward",         // thưởng khi hoàn thành bài học lần đầu
  THREAD_REWARD:       "thread_reward",         // thưởng khi đăng bài viết cộng đồng
  REPLY_REWARD:        "reply_reward",          // thưởng khi trả lời bài viết cộng đồng
  CLASS_SUBSCRIPTION:  "class_subscription",    // (chưa dùng) trừ khi học viên mua gói lớp — backlog gốc
  TUTOR_VIP_PURCHASE:  "tutor_vip_purchase",    // trừ khi gia sư mua VIP
  SUBSCRIPTION_REFUND: "subscription_refund",   // hoàn khi huỷ/sai gói
} as const;
export type CoinReason = (typeof COIN_REASONS)[keyof typeof COIN_REASONS];

// Bản đồ reason → sourceType mặc định — chỉ dùng ở nơi gọi wallet KHÔNG truyền
// opts.sourceType rõ ràng. Reason không có trong bảng → null (ví dụ reason
// mới chưa phân loại). Không suy đoán ngược cho bản ghi cũ (BE-039).
export const DEFAULT_SOURCE_TYPE_FOR_REASON: Partial<Record<CoinReason, CoinSourceType>> = {
  [COIN_REASONS.SIGNUP_BONUS]:        COIN_SOURCE_TYPES.REWARD,
  [COIN_REASONS.ANSWER_REWARD]:       COIN_SOURCE_TYPES.REWARD,
  [COIN_REASONS.LESSON_REWARD]:       COIN_SOURCE_TYPES.REWARD,
  [COIN_REASONS.THREAD_REWARD]:       COIN_SOURCE_TYPES.REWARD,
  [COIN_REASONS.REPLY_REWARD]:        COIN_SOURCE_TYPES.REWARD,
  [COIN_REASONS.QUESTION_COST]:       COIN_SOURCE_TYPES.PENALTY,
  [COIN_REASONS.REPORT_PENALTY]:      COIN_SOURCE_TYPES.PENALTY,
  [COIN_REASONS.CLASS_SUBSCRIPTION]:  COIN_SOURCE_TYPES.CLASS_SUBSCRIPTION,
  [COIN_REASONS.TUTOR_VIP_PURCHASE]:  COIN_SOURCE_TYPES.TUTOR_SUBSCRIPTION,
  [COIN_REASONS.SUBSCRIPTION_REFUND]: COIN_SOURCE_TYPES.REFUND,
};
