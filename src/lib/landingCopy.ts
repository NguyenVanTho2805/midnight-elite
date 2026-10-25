// KH-01 — chữ cho khối "Dành cho gia sư" ở trang chủ công khai. Tách ra để test được (số mục, chữ cấm, đường dẫn).
// Quy tắc chữ (D17 + quy tắc KiN): chỉ nói điều KiN làm được HÔM NAY; không "đúng luật", "miễn thuế", "đã xác minh", không hứa giá/miễn phí,
// không số liệu; số liệu do gia sư tự nhập là "ghi trên KiN". KiN không giữ tiền, không tự gửi tin Zalo.
export const TUTOR_PAINS: { title: string; desc: string }[] = [
  { title: "Cộng tay từng buổi để tính học phí", desc: "Bạn nhập số buổi của tháng và học phí từng lớp, KiN tính phiếu cho từng học sinh. Bạn xem lại, sửa nếu cần rồi mới gửi." },
  { title: "Gõ lại số tài khoản và số tiền cho từng phụ huynh", desc: "Mỗi phiếu có mã QR chuyển khoản đúng số tiền và đúng nội dung, nên phụ huynh quét là xong." },
  { title: "Tra tin nhắn để biết ai nghỉ buổi nào", desc: "Mỗi buổi được điểm danh và lưu lại: có mặt, đi trễ, nghỉ có phép, vắng. Cần xem lại thì mở ra, không phải lục tin nhắn." },
  { title: "Nhầm lịch khi dạy nhiều lớp", desc: "Một lịch tuần cho mọi lớp. Dời hoặc huỷ buổi ngay trên lịch." },
  { title: "Không biết tháng này thu được bao nhiêu", desc: "Trang doanh thu cho thấy đã thu, còn phải thu, theo tháng và theo lớp, và xuất được ra tệp CSV." },
  { title: "Phụ huynh hỏi con học thế nào mà không nhớ hết", desc: "Phụ huynh xem Sổ của con: chuyên cần, buổi sắp tới và báo cáo tháng mà bạn đã duyệt." },
];

export const TUTOR_STEPS: { title: string; desc: string }[] = [
  { title: "Tạo tài khoản gia sư", desc: "Điền họ tên, số điện thoại Zalo, giới thiệu và môn dạy. Hồ sơ được quản trị KiN xem trước khi hiện ở trang Tìm gia sư." },
  { title: "Tạo lớp, thêm học sinh, điểm danh", desc: "Mỗi lớp có lịch riêng. Điểm danh từng buổi ngay trên điện thoại." },
  { title: "Lập phiếu học phí và gửi cho phụ huynh", desc: "KiN mở Zalo với tin đã soạn sẵn để bạn bấm gửi. Khoản đã thu được ghi vào phiếu và hiện ở trang doanh thu." },
];

export const TUTOR_FAQ: { q: string; a: string }[] = [
  { q: "KiN là gì?", a: "KiN là nơi gia sư dạy thêm quản lý lớp, lịch, điểm danh, học phí và báo cáo cho phụ huynh, và là nơi phụ huynh, học sinh tìm gia sư." },
  { q: "Ai dùng được KiN?", a: "Gia sư tạo tài khoản gia sư. Phụ huynh xem Sổ của con bằng đường dẫn riêng do gia sư gửi. Học sinh có thể học và làm bài trên tài khoản học sinh." },
  { q: "KiN có giữ tiền học phí của tôi không?", a: "Không. Phụ huynh chuyển thẳng vào tài khoản ngân hàng của gia sư. KiN không giữ tiền và không cắt phần trăm trên khoản học phí." },
  { q: "KiN có tự gạch nợ không?", a: "Chỉ khi bạn nối SePay và khoản chuyển khớp mã phiếu, đúng số tiền thì KiN ghi vào phiếu. Khoản lệch hoặc không có mã thì chờ bạn xem. Không nối SePay thì bạn ghi tay khoản đã thu." },
  { q: "KiN có gửi tin Zalo thay tôi không?", a: "Không. KiN mở Zalo với tin soạn sẵn, bạn là người bấm gửi. Vì vậy KiN không biết tin đã đến phụ huynh hay chưa." },
  { q: "Phụ huynh có cần tài khoản không?", a: "Không bắt buộc. Gia sư gửi đường dẫn riêng, phụ huynh mở ra xem phiếu và Sổ của con. Mỗi đường dẫn chỉ cho xem một học sinh." },
  { q: "Ai xem được dữ liệu của học sinh?", a: "Gia sư chỉ thấy học sinh trong lớp của mình. Phụ huynh chỉ thấy con mình. Điểm bài thi có phần tự luận chưa được công bố thì chưa hiện." },
  { q: "Dùng trên điện thoại được không?", a: "Được. KiN chạy trên trình duyệt của điện thoại và máy tính, không cần cài ứng dụng." },
  { q: "Tôi có lấy dữ liệu ra khỏi KiN được không?", a: "Được với những phần đã có nút xuất, ví dụ doanh thu đã thu xuất ra tệp CSV." },
  { q: "KiN có phải phần mềm kế toán hay khai thuế không?", a: "Không. Số liệu trên KiN là bản ghi do gia sư nhập và do các khoản chuyển khoản khớp phiếu. KiN không xác minh và không thay cho sổ sách hay tư vấn thuế của bạn." },
];

export const TUTOR_CTA = { signup: "/dang-ky?vai=gia-su", login: "/dang-nhap", find: "/giang-vien" } as const;
