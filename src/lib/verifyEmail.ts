// MỘT chỗ duy nhất đặt emailVerified false→true (08/11/2026). Ba đường chứng minh hộp thư đều gọi ở đây: link (verify-email), đặt lại mật khẩu (reset-password), mã 6 số (email-verify/confirm).
// Vì sao gộp: email chuyển sang "đã xác minh" nghĩa là chủ hộp thư thật vừa lộ diện → mọi liên kết Google/Facebook có từ TRƯỚC đó là của người chưa chứng minh được hộp thư
// (kẻ đăng ký trước bằng email người khác rồi bấm Google) và phải gỡ trong cùng câu lệnh. Điều kiện emailVerified:false nằm TRONG câu lệnh (không dựa vào bản đã đọc):
// tài khoản đã xác minh trước đó thì câu lệnh trúng 0 dòng và liên kết thật của chủ được giữ.
import { prisma } from "@/lib/prisma";

/** Trả PrismaPromise (lười) để đặt vào prisma.$transaction([...]) cùng việc xoá token / đổi mật khẩu. */
/** `mark` (revocationMark() của sessionVerify): cũng thu hồi MỌI cookie cấp trước (của kẻ đăng ký trước bằng email này). Điều kiện emailVerified:false nằm trong câu lệnh nên
 *  chỉ chuyển false→true mới đặt mốc. Người gọi PHẢI cấp lại cookie của chính người vừa xác minh bằng createSession(..., { iat: iatForMark(mark) }) trong cùng phản hồi. */
export function markEmailVerifiedOp(userId: string, mark: Date) {
  return prisma.user.updateMany({ where: { id: userId, emailVerified: false }, data: { emailVerified: true, googleSub: null, facebookId: null, sessionsValidAfter: mark } });
}
