// HOCPHI-THEO-BUOI 3.3 (phần B) — "mốc tháng" chống hai hệ phí trên một lớp. THUẦN: không Prisma, không node:*.
// Lớp chuyển từ cách cũ sang theo buổi có CourseFeeRate đầu tiên với effectiveFrom = "S-01" (S = tháng chuyển). Lớp tạo mới luôn có mốc đầu
// "2000-01-01" (FEE_RATE_FROM_START) = không có mốc. Mốc suy từ dữ liệu có sẵn, không thêm cột.
import { FEE_MODE_LEGACY, FEE_RATE_FROM_START, isNewFeeMode, normalizeFeeMode, type FeeMode } from "@/lib/tuitionFee";

export interface RateFrom { effectiveFrom: string }

/** Tháng "YYYY-MM" của mốc chuyển, hoặc null nếu lớp không có mốc (lớp mới từ đầu, hoặc chưa có đơn giá nào). */
export function feeFloorMonth(classRates: readonly RateFrom[]): string | null {
  if (classRates.length === 0) return null;
  let first = classRates[0].effectiveFrom;
  for (const r of classRates) if (r.effectiveFrom < first) first = r.effectiveFrom;
  if (first === FEE_RATE_FROM_START) return null;
  return first.slice(0, 7);
}

/** Một lớp, một tháng ⇒ đúng một hệ phí. Kiểu mới nhưng tháng đứng TRƯỚC mốc → cách cũ; còn lại giữ nguyên kiểu của lớp. */
export function effectiveFeeModeForMonth(feeMode: unknown, classRates: readonly RateFrom[], yearMonth: string): FeeMode {
  const mode = normalizeFeeMode(feeMode);
  if (!isNewFeeMode(mode)) return mode;
  const floor = feeFloorMonth(classRates);
  if (floor !== null && yearMonth < floor) return FEE_MODE_LEGACY;
  return mode;
}

/** Ngày hiệu lực có lùi trước mốc của lớp không? Trả câu lỗi (tiếng Việt) hoặc null nếu được. Dùng ở fee-rates POST: mốc lùi sẽ hạ "sàn" và mở lại hai hệ chồng nhau. */
export function floorViolation(effectiveFrom: string, classRates: readonly RateFrom[]): string | null {
  const floor = feeFloorMonth(classRates);
  if (floor === null) return null;
  if (effectiveFrom >= `${floor}-01`) return null;
  const [y, m] = floor.split("-");
  return `Lớp này tính theo buổi từ tháng ${m}/${y}. Ngày hiệu lực không được trước mốc đó.`;
}
