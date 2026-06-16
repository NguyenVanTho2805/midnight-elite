// ─── HONOR BOARD SHARED TYPES & RULES ────────────────────────────────────────
// Data thật được load từ GET /api/honor-leaderboard (tính từ DB).
// File này chỉ chứa types, badge rules, và sort helper.

export type SortKey = "gpa" | "completion" | "lastExamScore" | "monthDelta";
export type Period   = "thang5" | "thang4" | "thang3";

export const PERIOD_LABELS: Record<Period, string> = {
  thang5: "Tháng 5/2026",
  thang4: "Tháng 4/2026",
  thang3: "Tháng 3/2026",
};

export interface HonorStudent {
  id: string;
  name: string;
  school: string;
  gpa: number;
  completion: number;     // % tiến độ khoá học
  strikes: number;
  monthDelta: number;     // GPA delta so tháng trước (0 nếu chưa có historical data)
  submissions: number;    // bài đã hoàn thành
  submissionRate: number; // % bài nộp đúng hạn
  lastExamScore: number;  // điểm thi thử gần nhất
}

export interface BadgeRule {
  id: string;
  icon: string;
  title: string;
  color: string;
  bg: string;
  borderColor: string;
  desc: string;
  reward: string;
  check: (s: HonorStudent) => boolean;
}

export const BADGE_RULES: BadgeRule[] = [
  {
    id: "xuat-sac",
    icon: "⭐",
    title: "Học viên Xuất sắc",
    color: "#FE9900", bg: "#FFF7ED", borderColor: "#FED7AA",
    desc: "Top 3 GPA, không gậy",
    reward: "Badge vàng + Hoàn học phí 10%",
    check: (s) => s.strikes === 0 && s.gpa >= 8.8,
  },
  {
    id: "nop-bai",
    icon: "🔥",
    title: "Chiến thần Nộp bài",
    color: "#EF4444", bg: "#FEF2F2", borderColor: "#FECACA",
    desc: "Hoàn thành ≥ 95% tiến độ khoá học",
    reward: "Badge đỏ + EXP x2 tháng sau",
    check: (s) => s.submissionRate >= 95,
  },
  {
    id: "cai-thien",
    icon: "⚡",
    title: "Cải thiện nhanh nhất",
    color: "#0068FF", bg: "#EFF6FF", borderColor: "#BFDBFE",
    desc: "GPA tăng ≥ 1.0 so tháng trước",
    reward: "Badge xanh + Khóa học thưởng",
    check: (s) => s.monthDelta >= 1.0,
  },
  {
    id: "tiem-nang",
    icon: "🚀",
    title: "Tài năng Tiềm năng",
    color: "#7C3AED", bg: "#F5F3FF", borderColor: "#DDD6FE",
    desc: "Hoàn thành >85% bài, GPA ≥ 7.0",
    reward: "Badge tím + Ưu tiên mentor 1-1",
    check: (s) => s.completion >= 85 && s.gpa >= 7.0,
  },
];

export function computeRankings(students: HonorStudent[], key: SortKey = "gpa"): (HonorStudent & { rank: number })[] {
  return [...students]
    .sort((a, b) => b[key] - a[key])
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
