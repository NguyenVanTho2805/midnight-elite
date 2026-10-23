// TT-199 giai đoạn 1 — gửi phiếu học phí qua Zalo bằng tay (spec gui-qua-zalo.md).
//  • Link riêng từng phiếu, hết hạn sau 30 ngày (Thọ chốt 12/10; PH-214 ghi 30 ngày, GD-28 từng ghi 60), mở không cần tài khoản.
//  • Chat riêng: tin có tên con, số tiền và link. Nhóm Zalo lớp: tin chung, KHÔNG số tiền, KHÔNG link, KHÔNG tên con
//    (ai trong nhóm cũng mở được link).
//  • KiN chỉ ghi "đã mở Zalo", không bao giờ ghi "đã gửi".
// Hàm thuần — dùng được ở cả máy chủ và trình duyệt.

import { dueClause } from "@/lib/invoiceReminder";

export const INVOICE_LINK_DAYS = 30;
const DAY_MS = 24 * 3600_000;

/** Phiếu có thể gửi cho phụ huynh: đã gửi, phụ huynh đã báo chuyển, hoặc đóng một phần. Nháp/đã đóng/đã huỷ thì không. */
export const ZALO_SENDABLE_STATUSES = ["sent", "parent_reported", "partial"] as const;

export function invoiceLinkExpiry(now: Date): Date {
  return new Date(now.getTime() + INVOICE_LINK_DAYS * DAY_MS);
}

export type InvoiceLinkState = "none" | "live" | "expired";
export function invoiceLinkState(inv: { viewToken: string | null; viewTokenExpiresAt: Date | null }, now: Date): InvoiceLinkState {
  if (!inv.viewToken || !inv.viewTokenExpiresAt) return "none";
  return inv.viewTokenExpiresAt.getTime() > now.getTime() ? "live" : "expired";
}

export const invoiceLinkPath = (token: string) => `/phieu/${token}`;

/** Số ngày còn lại của link (làm tròn lên), tối thiểu 0. */
export function invoiceLinkDaysLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS));
}

const monthNumber = (ym: string) => Number(ym.split("-")[1]);
const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

/** Tin vào CHAT RIÊNG với phụ huynh — mẫu của spec, gia sư sửa được trước khi gửi. */
export function privateInvoiceMessage(o: { studentName: string; yearMonth: string; amount: number; url: string; dueDate?: string | null }): string {
  // F2: có hạn đóng thật thì ghi hạn đó; chưa có (null/bỏ trống) thì giữ ĐÚNG chữ cũ "hạn trước ngày 20".
  return `Dạ em gửi anh/chị phiếu học phí tháng ${monthNumber(o.yearMonth)} của con ${o.studentName}: ${money(o.amount)}, ${dueClause(o.dueDate)}. ` +
    `Anh/chị bấm vào đây để xem phiếu và quét mã chuyển khoản: ${o.url}`;
}

/** Tin vào NHÓM Zalo lớp — không số tiền, không link, không tên con. */
export function groupInvoiceMessage(o: { yearMonth: string; dueDate?: string | null }): string {
  return `Phiếu học phí tháng ${monthNumber(o.yearMonth)} đã gửi riêng cho từng anh/chị, ${dueClause(o.dueDate)}. Anh/chị xem tin nhắn riêng giúp em nhé.`;
}

/** Tin điểm danh một buổi (spec mục 1). Link chỉ kèm khi có — câu mời xem lại chỉ hiện khi con vắng. */
export type AttendanceMsgStatus = "present" | "late" | "excused" | "absent";
export const ATTENDANCE_MSG_LABEL: Record<AttendanceMsgStatus, string> = { present: "Có mặt", late: "Muộn", excused: "Có phép", absent: "Vắng" };

export function attendanceMessage(o: { subject: string; dateLabel: string; studentName: string; status: AttendanceMsgStatus; url?: string | null }): string {
  const head = `Buổi ${o.subject} ${o.dateLabel} của con ${o.studentName}: ${ATTENDANCE_MSG_LABEL[o.status]}.`;
  return o.status === "absent" && o.url ? `${head} Nếu con vắng, anh/chị xem lại bản ghi buổi học ở đây: ${o.url}` : head;
}

// ─── Tin CHUNG vào nhóm Zalo lớp (PH-216): không tên em, không điểm, không số tiền, không link riêng ─────────────────
/** "đủ 5/5 bạn" khi cả lớp có mặt; nếu không thì "có mặt 4/5 bạn" — không bao giờ nêu em nào vắng. Có mặt = có mặt hoặc muộn. */
export function attendanceGroupMessage(o: { subject: string; dateLabel: string; present: number; total: number }): string {
  const total = Math.max(0, Math.round(o.total)), present = Math.min(total, Math.max(0, Math.round(o.present)));
  return present === total
    ? `Buổi ${o.subject} ${o.dateLabel}: đủ ${total}/${total} bạn.`
    : `Buổi ${o.subject} ${o.dateLabel}: có mặt ${present}/${total} bạn.`;
}
/** Báo cáo tháng luôn gửi riêng; vào nhóm chỉ nhắn là đã gửi riêng. */
export function monthlyReportGroupMessage(o: { yearMonth: string }): string {
  return `Báo cáo tháng ${monthNumber(o.yearMonth)} đã gửi riêng cho từng anh/chị. Anh/chị xem tin nhắn riêng giúp em nhé.`;
}
