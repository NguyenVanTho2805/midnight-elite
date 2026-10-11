// FE-143 — danh sách "Việc cần làm" của gia sư, dựng từ các bộ đếm. Thuần để test.
export interface TodoCounts {
  bankPending: number;      // khoản tiền vào chờ đối soát
  needBankCheck: number;    // phụ huynh báo đã chuyển > 24 giờ mà chưa thấy tiền
  draftInvoices: number;    // phiếu nháp chưa gửi
  pendingConsent: number;   // yêu cầu xác nhận phụ huynh đang chờ
  classReports: number;     // báo cáo cộng đồng của các lớp mình
  ungraded: number;         // bài tự luận / bài nộp chưa chấm
}
export interface TodoItem { key: string; label: string; count: number; href: string; urgent: boolean }

export function buildTodoItems(c: TodoCounts): TodoItem[] {
  const all: TodoItem[] = [
    { key: "bank", label: "Khoản tiền vào cần đối soát", count: c.bankPending, href: "/lop-cua-toi/hoc-phi?tab=doi-soat", urgent: true },
    { key: "check", label: "Phụ huynh báo đã chuyển hơn 24 giờ, chưa thấy tiền — kiểm sao kê", count: c.needBankCheck, href: "/lop-cua-toi/hoc-phi", urgent: true },
    { key: "consent", label: "Yêu cầu xác nhận của phụ huynh đang chờ", count: c.pendingConsent, href: "/lop-cua-toi", urgent: true },
    { key: "reports", label: "Báo cáo cộng đồng trong lớp của bạn", count: c.classReports, href: "/lop-cua-toi/kiem-duyet", urgent: false },
    { key: "ungraded", label: "Bài tự luận / bài nộp chưa chấm", count: c.ungraded, href: "/lop-cua-toi", urgent: false },
    { key: "draft", label: "Phiếu học phí nháp chưa gửi", count: c.draftInvoices, href: "/lop-cua-toi/hoc-phi", urgent: false },
  ];
  // Chỉ hiện việc có thật; việc khẩn đứng trước, cùng nhóm thì nhiều trước.
  return all.filter(i => i.count > 0).sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.count - a.count);
}

export const CLASS_STATUS_LABEL: Record<string, string> = { open: "Đang nhận học viên", closed: "Đã đóng", paused: "Tạm ngừng" };
