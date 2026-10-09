// NV-185 + NV-186 + NV-187 (06/10/2026) — Năng lực / Nỗ lực / Phút học thật.
// Spec Thanh: docs/kin/nghiep-vu/hoc-tu-khan.md (sheet note), áp dụng:
//   - NV-185: Mức thành thạo tính theo 3 bài kiểm tra GẦN NHẤT, không phải
//     TB cả kỳ. Phụ huynh thấy kiến thức đang trượt ngay.
//   - NV-186: Tách "Nỗ lực" (chuyên cần + BTVN) khỏi "Năng lực" (mastery).
//     Khan tách energy points khỏi mastery — gộp lại là mất thông tin.
//   - NV-187: Đếm PHÚT HỌC THẬT, không đếm lượt đăng nhập/xem bài.
//
// Hàm pure, test được không cần Prisma.

export interface TestScore {
  score:    number;   // 0-10
  takenAt:  Date;     // thời điểm làm
}

// Trả về Năng lực = trung bình 3 bài gần nhất; null nếu chưa có bài nào.
// Nhãn "đang tụt" = điểm bài mới nhất THẤP HƠN TB 3 bài > 1.0.
export interface MasteryResult {
  value:     number | null; // 0-10
  n:         number;        // số bài tham gia tính
  isSlipping: boolean;      // "Đang tụt" theo spec NV-185
}

export function computeMastery(scores: TestScore[]): MasteryResult {
  if (scores.length === 0) return { value: null, n: 0, isSlipping: false };
  // Sort theo takenAt desc, lấy 3 bài đầu.
  const sorted = [...scores].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
  const last3 = sorted.slice(0, 3);
  const avg = last3.reduce((s, x) => s + x.score, 0) / last3.length;
  // Chỉ gọi "đang tụt" khi có ≥ 2 bài để so sánh — 1 bài thì không đủ dữ liệu.
  const isSlipping = last3.length >= 2 && last3[0].score < avg - 1.0;
  return { value: avg, n: last3.length, isSlipping };
}

// Nỗ lực = 0.5 × chuyên cần + 0.5 × BTVN, thang 0-10. Spec NV-186.
export function computeEffort(opts: {
  attendanceRatio: number; // 0-1 (từ computeAttendanceStats của AS-191)
  homeworkRatio:   number; // 0-1 (số BTVN đã nộp / tổng BTVN giao)
}): number {
  const a = Math.max(0, Math.min(1, opts.attendanceRatio));
  const h = Math.max(0, Math.min(1, opts.homeworkRatio));
  return 10 * (0.5 * a + 0.5 * h);
}

// NV-187: phút tự luyện ngoài giờ. Vạch cảnh báo: < 5 phút/tuần = không
// hiệu quả (NBER). < 30 phút/tuần = nhắc. ≥ 30 phút/tuần = tốt.
export type DosageLevel = "zero" | "low" | "ok";

export function dosageLevelFromMinutes(minutesPerWeek: number): DosageLevel {
  if (minutesPerWeek < 5)  return "zero";
  if (minutesPerWeek < 30) return "low";
  return "ok";
}

export const DOSAGE_LABEL: Record<DosageLevel, string> = {
  zero: "Chưa học thêm",
  low:  "Mới chạm vạch",
  ok:   "Đủ liều",
};

// Nhãn khuyến nghị theo spec: dưới 5 phút = không có tác động, cần nhắc gấp.
export function dosageAdvice(minutesPerWeek: number): string {
  const level = dosageLevelFromMinutes(minutesPerWeek);
  if (level === "zero") return "Dưới 5 phút/tuần — không có tác động đo được, cần nhắc gấp.";
  if (level === "low")  return `${Math.round(minutesPerWeek)} phút/tuần — chưa đủ 30 phút/tuần, cần tăng.`;
  return `${Math.round(minutesPerWeek)} phút/tuần — ổn.`;
}
