import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { landingPath } from "@/lib/landing";
import { tutorApplicationStatus } from "@/lib/tutorProfile";
import { markEmailVerifiedOp } from "@/lib/verifyEmail";
import { commitMark, iatForMark } from "@/lib/sessionVerify";
import { clearSignupCode } from "@/lib/loginCodeServer";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Thiếu token" }, { status: 400 });

  const record = await prisma.verifyToken.findUnique({
    where:   { token },
    include: { user: true },
  });

  if (!record)                          return NextResponse.json({ error: "Token không hợp lệ" }, { status: 400 });
  if (record.expiresAt < new Date())    return NextResponse.json({ error: "Token đã hết hạn" },   { status: 400 });
  // NC2-033: tài khoản bị khoá không được xác thực email để tự nhận phiên (cùng chữ với signInResponse).
  if (record.user.banned)               return NextResponse.json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ." }, { status: 403 });
  if (record.user.emailVerified)        return NextResponse.json({ already: true });

  // Xác thực email
  // false→true: gỡ liên kết Google/Facebook có từ trước (của người chưa chứng minh được hộp thư), cùng giao dịch với việc xoá token.
  const mark = commitMark(); // sát giao dịch, sau mọi bước chậm
  await prisma.$transaction([
    markEmailVerifiedOp(record.userId, mark),
    prisma.verifyToken.deleteMany({ where: { token } }),
  ]);
  await clearSignupCode(record.user.email); // mã 6 số còn lại (nếu có) vô nghĩa sau khi đã xác thực bằng link

  // Tạo session luôn (đăng nhập tự động)
  await createSession({
    userId: record.userId,
    role:   record.user.role as "student" | "admin",
    ...(record.user.adminRole
      ? { adminRole: record.user.adminRole as "admin_super" | "admin_content" }
      : {}),
  }, { iat: iatForMark(mark) }); // mốc thu hồi cũng đã đặt: cookie của chính người xác minh phải cấp lại với iat >= mốc

  // `landing`: trang đầu của vai này (cùng nguồn với đăng nhập: src/lib/landing.ts) — trang xác thực chuyển người dùng tới đó. Trước đây trang cứng /student/hoc-tap.
  // NC2-029: gia sư vừa đăng ký (chưa duyệt) — trang xác thực cần biết để không hứa "Dashboard". BU-00 bước 5: trang đầu của họ là trang chờ duyệt
  // /lop-cua-toi/cho-duyet (vỏ gia sư), không còn là khu học viên.
  const u = record.user;
  const tutorPending = u.role === "student" && !u.adminRole && tutorApplicationStatus(u) === "pending";
  return NextResponse.json({ success: true, name: u.name, landing: landingPath(u.role, u.adminRole, tutorPending), tutorPending });
}
