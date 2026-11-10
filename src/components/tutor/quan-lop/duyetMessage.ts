// Thông báo sau khi duyệt / từ chối yêu cầu vào lớp (máy chủ chuyển về ?duyet=, ?n=). Mã lạ → null. Cắt NGUYÊN VĂN từ LopChiTiet.tsx (BU-01) để cả LopChiTiet
// (đồng giảng / quản trị xem) và tab Học sinh của lớp gia sư dùng chung một bản chữ.
export function duyetMessage(code: string | null, n: number | null): { tone: "ok" | "err"; text: string } | null {
  switch (code) {
    case "ok": return { tone: "ok", text: n && n > 1 ? `Đã duyệt ${n} bạn, các bạn đã vào lớp.` : "Đã duyệt, bạn ấy đã vào lớp." };
    case "tuchoi": return { tone: "ok", text: "Đã từ chối." };
    case "day": return { tone: "err", text: "Lớp đã đầy — chưa duyệt được, yêu cầu vẫn đang chờ." };
    case "goi": return { tone: "err", text: "Gói hiện tại chưa cho thêm học sinh — yêu cầu vẫn đang chờ." };
    case "mot-phan": return { tone: "err", text: `Đã duyệt ${n ?? 0} bạn, còn lại chờ vì lớp đã đầy.` };
    case "dong": return { tone: "err", text: "Lớp đang đóng, chưa duyệt thêm được" };
    case "da-nghi": return { tone: "err", text: n && n > 0 ? `Đã duyệt ${n} bạn. Có học sinh đang tạm dừng ở lớp nên chưa duyệt được — hãy mở lại ở mục Học sinh rồi duyệt.` : "Học sinh này đang tạm dừng ở lớp. Hãy mở lại ở mục Học sinh rồi duyệt." };
    case "khong-phai-hs": return { tone: "err", text: "Tài khoản này đã chuyển thành gia sư nên đơn được huỷ." };
    case "da-xu-ly": return { tone: "ok", text: "Yêu cầu này đã được xử lý." };
    case "loi-ghi-chu": return { tone: "err", text: "Lời nhắn quá dài (tối đa 200 ký tự), chưa từ chối." };
    default: return null;
  }
}
