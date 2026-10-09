// AS-196 (06/10/2026) — gợi ý học bổng theo TOP1 100% / TOP2 90%.
//
// Spec Thanh: "KiN chỉ GỢI Ý học bổng TOP1 100% / TOP2 90% tiền môn,
// gia sư bấm Áp dụng mới vào phiếu (NV-184). Chỉ xét khi điểm TB > 0."
//
// Lỗi thật đã gặp: môn Sử 7 em cùng 4.6 điểm → cả 7 cùng TOP1 miễn 100%.
// Fix: dùng rankWithTies (AS-195) → ai có rank 1 cùng được 100%, cùng
// rank 2 cùng được 90%. Nhưng để chống lạm dụng (vd cả lớp cùng 0 điểm),
// chỉ xét những em có avg > 0.
//
// Không auto-apply — hàm chỉ trả gợi ý, UI gia sư bấm Áp dụng mới tính
// vào MonthlyFee.scholarship.

import { rankWithTies, type Rankable } from "./ranking";

export const SCHOLARSHIP_TOP1_PERCENT = 100;
export const SCHOLARSHIP_TOP2_PERCENT = 90;

export interface ScholarshipSuggestion {
  userId: string;
  rank:   number;
  tied:   boolean;
  suggestedPercent: number; // 100 | 90
  // Số VND được giảm — caller nhân với subtotal của môn.
}

export function suggestScholarship(students: Rankable[]): ScholarshipSuggestion[] {
  // Lọc avg > 0 trước khi xếp hạng — nếu lọc sau, 1 em 0 điểm có thể bị
  // xếp rank 2 (do em TOP1 có điểm > 0 → rank 1, em 0 điểm xếp rank 2
  // sai nghĩa).
  const eligible = students.filter(s => s.avg > 0);
  if (eligible.length === 0) return [];

  const ranked = rankWithTies(eligible);
  const out: ScholarshipSuggestion[] = [];
  for (const r of ranked) {
    if (r.rank === 1) {
      out.push({ userId: r.userId, rank: r.rank, tied: r.tied, suggestedPercent: SCHOLARSHIP_TOP1_PERCENT });
    } else if (r.rank === 2) {
      out.push({ userId: r.userId, rank: r.rank, tied: r.tied, suggestedPercent: SCHOLARSHIP_TOP2_PERCENT });
    }
  }
  return out;
}
