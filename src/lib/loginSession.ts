// Bước chung sau khi đã xác thực xong một người (mật khẩu hoặc mã 6 số): kiểm tài khoản bị khoá, tạo phiên, trả thông tin người dùng.
import { NextResponse } from "next/server";
import { createSession, type SessionPayload } from "@/lib/session";
import { hostAcceptsLogin, mainLoginUrl } from "@/lib/hostRouting";
import { tutorApplicationStatus } from "@/lib/tutorProfile";

export interface SignInUser {
  id: string;
  name: string;
  email: string;
  role: string;
  adminRole: string | null;
  phone: string | null;
  school: string | null;
  emailVerified: boolean;
  banned: boolean;
  /** BU-00 bước 5: ba cột của đơn gia sư (bản ghi Prisma đầy đủ có sẵn) — để trả `tutorPending` và chọn trang đầu đúng cho gia sư chờ duyệt. */
  tutorAppliedAt?: Date | null;
  tutorVerified?: boolean;
  tutorRejectedAt?: Date | null;
}

/** Cùng một cách tính với /api/auth/me: "vẫn là học viên nhưng có đơn gia sư đang chờ" (bị từ chối không tính — họ vẫn mở được trang chờ duyệt để đọc lý do,
 *  nhưng cờ này chỉ nói "đang chờ"). */
export function tutorPendingOf(u: Pick<SignInUser, "role" | "adminRole" | "tutorAppliedAt" | "tutorVerified" | "tutorRejectedAt">): boolean {
  if (u.role !== "student" || u.adminRole) return false;
  return tutorApplicationStatus({ tutorAppliedAt: u.tutorAppliedAt ?? null, tutorVerified: u.tutorVerified ?? false, tutorRejectedAt: u.tutorRejectedAt ?? null }) === "pending";
}

export async function signInResponse(user: SignInUser, req?: Request): Promise<NextResponse> {
  if (user.banned) {
    return NextResponse.json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ." }, { status: 403 });
  }

  // Cửa quản trị (admin.midnightelite-edu.com) chỉ nhận quản trị cấp 1 / cấp nội dung. Học viên / gia sư đăng nhập nhầm cửa này sẽ chỉ có một phiên vô dụng
  // (cookie không dùng chung giữa hai tên miền) rồi bị đẩy qua lại / ra trang trắng — nên từ chối rõ ràng, không cấp phiên, và chỉ đường sang tên miền chính.
  const host = req?.headers.get("host") ?? "";
  if (req && !hostAcceptsLogin(host, user.role, user.adminRole)) {
    return NextResponse.json({
      error: "Đây là cửa đăng nhập dành cho quản trị KiN. Tài khoản học viên / gia sư vui lòng đăng nhập tại midnightelite-edu.com.",
      code: "wrong-host",
      loginUrl: mainLoginUrl(host, new URL(req.url).protocol),
    }, { status: 403 });
  }

  const payload: SessionPayload = {
    userId: user.id,
    role:   user.role as "student" | "admin",
  };
  if (user.adminRole) payload.adminRole = user.adminRole as SessionPayload["adminRole"];

  await createSession(payload);

  return NextResponse.json({
    id:            user.id,
    name:          user.name,
    email:         user.email,
    role:          user.role,
    adminRole:     user.adminRole,
    phone:         user.phone,
    school:        user.school,
    emailVerified: user.emailVerified,
    // BU-00 bước 5: AuthContext dùng để chọn trang đầu (gia sư chờ duyệt → /lop-cua-toi/cho-duyet) và vỏ ngay sau đăng nhập, không chờ /api/auth/me.
    tutorPending:  tutorPendingOf(user),
  });
}
