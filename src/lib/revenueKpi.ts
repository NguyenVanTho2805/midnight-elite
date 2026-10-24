// PT-01 — số cho 2 thẻ KPI thêm ở trang doanh thu của gia sư. CHỈ TRÌNH BÀY: chỉ cộng lại các cột
// amountDue / paidAmount của phiếu đã có, KHÔNG phải công thức tiền mới và không đụng cách tính phiếu.
// Thuần (không import Prisma) để test được.

export interface InvoiceMoney { status: string; amountDue: number; paidAmount: number }

// Phiếu đã gửi cho phụ huynh (kể cả đã đóng đủ). Nháp và đã huỷ không tính vào tỷ lệ thu.
export const SENT_STATUSES = ["sent", "parent_reported", "partial", "paid"] as const;

export interface InvoiceKpi {
  draftAmount: number;   // "Tiềm năng": phiếu NHÁP đã lập, chưa gửi — chưa phải khoản phải thu
  draftCount: number;
  sentDue: number;       // tổng amountDue của phiếu đã gửi
  sentPaid: number;      // phần đã đóng trên các phiếu đó (mỗi phiếu không quá amountDue)
  sentCount: number;
  collectionRatePct: number | null; // null khi chưa có phiếu đã gửi: không bịa 0%
}

export function invoiceKpi(rows: InvoiceMoney[]): InvoiceKpi {
  let draftAmount = 0, draftCount = 0, sentDue = 0, sentPaid = 0, sentCount = 0;
  for (const r of rows) {
    if (r.status === "draft") { draftAmount += r.amountDue; draftCount++; continue; }
    if (!(SENT_STATUSES as readonly string[]).includes(r.status)) continue;
    sentDue += r.amountDue; sentPaid += Math.min(Math.max(0, r.paidAmount), r.amountDue); sentCount++;
  }
  return { draftAmount, draftCount, sentDue, sentPaid, sentCount, collectionRatePct: sentDue > 0 ? Math.round((sentPaid / sentDue) * 100) : null };
}
