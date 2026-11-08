// Câu chữ thông báo của đăng nhập Google/Facebook. Tệp THUẦN (không import prisma/bcrypt) để trang đăng nhập (client) dùng được.
/** Mã lỗi đưa lên /dang-nhap?google=… hoặc ?facebook=… (không tên, email, số tiền). */
export const SOCIAL_NOTICES: Record<string, { title: string; body: string }> = {
  "password-only": { title: "Tài khoản này đăng nhập bằng mật khẩu", body: "Tài khoản gia sư và quản trị không dùng Google hay Facebook. Nhập email và mật khẩu ở form bên dưới." },
  banned:          { title: "Tài khoản đã bị khóa", body: "Vui lòng liên hệ quản trị KiN để được hỗ trợ." },
  unverified:      { title: "Google chưa xác nhận email này", body: "Hãy xác nhận email trong tài khoản Google rồi thử lại, hoặc đăng ký bằng email và mật khẩu." },
  "sub-mismatch":  { title: "Email này đã liên kết với một tài khoản Google khác", body: "Đăng nhập bằng mật khẩu, hoặc dùng đúng tài khoản Google đã liên kết." },
  "email-exists":  { title: "Email này đã có tài khoản", body: "Hãy đăng nhập bằng mật khẩu hoặc Google. KiN không tự nối tài khoản Facebook vào tài khoản có sẵn." },
  "no-email":      { title: "Facebook không cung cấp email", body: "KiN cần email để tạo tài khoản. Hãy cho phép quyền email khi đăng nhập Facebook, hoặc đăng ký bằng email và mật khẩu." },
  cancelled:       { title: "Bạn đã hủy đăng nhập", body: "Bạn có thể thử lại hoặc dùng email và mật khẩu." },
  "wrong-host":    { title: "Đây là cửa đăng nhập dành cho quản trị KiN", body: "Tài khoản học sinh vui lòng đăng nhập tại tên miền chính của KiN." },
  failed:          { title: "Không đăng nhập được", body: "Phiên đăng nhập đã hết hạn hoặc có lỗi tạm thời. Thử lại sau ít phút." },
};
