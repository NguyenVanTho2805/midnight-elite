// AS-192 + AS-193 (06/10/2026) — tính học phí tháng.
//
// Spec: docs/kin/quyet-dinh-giao-dien-va-hoc-phi.md mục 3.
//
//   Đơn giá/buổi = tier theo tổng số môn em đăng ký
//                  (1→70k, 2→60k, 3→55k, 4→50k).
//                  Em có TuitionOverride → dùng giá đó, bỏ tier.
//   Học phí gốc  = Σ theo môn: (sessionCount − freeCount) × đơn giá
//   Phải đóng    = gốc − học bổng − giảm trừ, sàn 0.

// VND, chốt theo spec. Admin có thể làm UI đổi sau nếu cần.
export const TUITION_TIER_VND: Record<number, number> = {
  1: 70_000,
  2: 60_000,
  3: 55_000,
  4: 50_000,
};

export function pricePerSessionVnd(subjectCount: number, override?: number | null): number {
  if (override != null && override >= 0) return override;
  if (subjectCount >= 4) return TUITION_TIER_VND[4];
  if (subjectCount <= 1) return TUITION_TIER_VND[1]; // 0 môn thì không đăng ký, nhưng guard an toàn.
  return TUITION_TIER_VND[subjectCount];
}

// Validate "YYYY-MM" + trả về Date UTC đầu tháng để query/so sánh. Trả
// null nếu format sai.
export function parseYearMonth(s: unknown): { yearMonth: string; firstDayUTC: Date } | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (y < 2020 || y > 2100) return null;
  if (mo < 1 || mo > 12) return null;
  return { yearMonth: s, firstDayUTC: new Date(Date.UTC(y, mo - 1, 1)) };
}

export function currentYearMonth(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Tổng hợp học phí 1 học viên trong 1 tháng. Input là dữ liệu đã lấy sẵn
// từ DB — hàm pure để test được không cần Prisma.
export interface SubjectFeeInput {
  courseId:     string;
  courseName:   string;
  sessionCount: number;    // từ MonthlyCourseFee
  freeCount:    number;    // từ MonthlyCourseFee
}

export interface MonthlyFeeBreakdown {
  subjectCount: number;
  pricePerSession: number;
  overrideUsed: boolean;
  perSubject: Array<{
    courseId:     string;
    courseName:   string;
    sessionCount: number;
    freeCount:    number;
    billable:     number; // sessionCount − freeCount, min 0
    subtotal:     number; // billable × pricePerSession
  }>;
  gross:         number; // Σ subtotal
  scholarship:   number; // input (admin áp)
  discount:      number; // input (admin áp)
  finalAmount:   number; // max(0, gross − scholarship − discount)
}

export function computeMonthlyFee(input: {
  subjects: SubjectFeeInput[];
  override?: number | null;
  scholarship?: number;
  discount?: number;
}): MonthlyFeeBreakdown {
  const subjectCount = input.subjects.length;
  const pricePerSession = pricePerSessionVnd(subjectCount, input.override ?? null);
  const overrideUsed = input.override != null && input.override >= 0;

  const perSubject = input.subjects.map(s => {
    const billable = Math.max(0, s.sessionCount - s.freeCount);
    const subtotal = billable * pricePerSession;
    return {
      courseId:     s.courseId,
      courseName:   s.courseName,
      sessionCount: s.sessionCount,
      freeCount:    s.freeCount,
      billable,
      subtotal,
    };
  });

  const gross       = perSubject.reduce((s, x) => s + x.subtotal, 0);
  const scholarship = Math.max(0, Math.floor(input.scholarship ?? 0));
  const discount    = Math.max(0, Math.floor(input.discount ?? 0));
  const finalAmount = Math.max(0, gross - scholarship - discount);

  return { subjectCount, pricePerSession, overrideUsed, perSubject, gross, scholarship, discount, finalAmount };
}

// Validate số buổi — không âm, dưới 60 (giới hạn phòng khi gõ sai 3 chữ số)
export function validateSessionCount(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  if (v < 0 || v > 60) return null;
  return v;
}
