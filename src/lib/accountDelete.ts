// ADM-xoa-tk — xoá tài khoản = ẨN DANH HOÁ (không xoá hàng User, không cascade): mọi ghi danh, điểm danh, phiếu thu, ví, bút toán Coin GIỮ NGUYÊN
// làm bằng chứng; chỉ gỡ thông tin định danh. Email gốc được giải phóng để đăng ký lại. Không đổi số tiền / ví / phiếu.
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const ANON_NAME = "Tài khoản đã xóa";
export const anonEmail = (id: string) => `deleted+${id}@invalid`;
export const isAnonEmail = (email: string | null | undefined) => typeof email === "string" && email.startsWith("deleted+");
/** Điều kiện where: loại các tài khoản đã ẩn danh khỏi danh sách quản trị. */
export const NOT_ANONYMIZED = { NOT: { email: { startsWith: "deleted+" } } } as const;

export type AccountKind = "student" | "tutor";

/** Dữ liệu `user.update`: gỡ định danh, khoá đăng nhập, giữ role/studentId. Thuần (chỉ randomBytes cho mật khẩu không đăng nhập được). */
export function buildAnonymizedUserData(id: string, kind: AccountKind, now: Date = new Date()): Prisma.UserUncheckedUpdateManyInput {
  return {
    deletedAt: now,
    banned: true,
    email: anonEmail(id),
    name: ANON_NAME,
    password: randomBytes(32).toString("hex"), // không phải băm bcrypt → không khớp mật khẩu nào
    phone: null, phoneE164: null, phoneVerifiedAt: null, dateOfBirth: null,
    parentPhone: null, parentName: null, school: null, highSchool: null, city: null,
    avatarBase64: null, facebookUrl: null, zaloPhone: null, bio: null,
    preferences: Prisma.DbNull,
    subjects: [],
    ...(kind === "tutor" ? { tutorVerified: false, profileLockedAt: now, profileLockReason: "Tài khoản đã xóa" } : {}),
  };
}

export type BlockerCounts = {
  activeEnrollments: number;   // học sinh: Enrollment active của chính em
  ownedCoursesActive: number;  // gia sư: lớp còn học viên active hoặc còn mở
  openInvoices: number;        // phiếu draft|sent|parent_reported|partial
  uninvoicedFees: number;      // FeeCharge amount>0 chưa vào phiếu
  activePackages: number;      // gói buổi đang dùng
  pendingTopups: number;       // CoinTopupRequest pending
  pendingProOrders: number;    // ProOrder pending
  walletBalance: number;       // Wallet.balance
  approvedTopups: number;      // CoinTopupRequest approved (tiền thật đã nạp)
  activeSubscriptions: number; // gia sư: TutorSubscription active
};
export type Blocker = { code: string; error: string; status: 409; extra?: Record<string, number> };

export const OPEN_INVOICE_STATUSES = ["draft", "sent", "parent_reported", "partial"] as const;

/** Thứ tự cố định, dừng ở lỗi đầu tiên. null = xoá được. */
export function pickBlocker(c: BlockerCounts): Blocker | null {
  if (c.activeEnrollments > 0) return { code: "active_enrollments", status: 409, extra: { count: c.activeEnrollments }, error: `Học sinh còn ${c.activeEnrollments} lớp đang học. Thu hồi lớp trước khi xóa tài khoản.` };
  if (c.ownedCoursesActive > 0) return { code: "owned_courses_active", status: 409, extra: { count: c.ownedCoursesActive }, error: `Gia sư còn ${c.ownedCoursesActive} lớp đang mở hoặc còn học viên. Đóng lớp và thu hồi học viên trước khi xóa tài khoản.` };
  if (c.openInvoices > 0) return { code: "open_invoices", status: 409, extra: { count: c.openInvoices }, error: `Còn ${c.openInvoices} phiếu học phí chưa tất toán. Tất toán hoặc huỷ phiếu trước khi xóa tài khoản.` };
  if (c.uninvoicedFees > 0) return { code: "uninvoiced_fees", status: 409, extra: { count: c.uninvoicedFees }, error: `Còn ${c.uninvoicedFees} khoản học phí chưa vào phiếu. Lập phiếu hoặc xử lý các khoản này trước khi xóa tài khoản.` };
  if (c.activePackages > 0) return { code: "active_packages", status: 409, extra: { count: c.activePackages }, error: `Còn ${c.activePackages} gói buổi đang dùng. Hủy hoặc dùng hết gói trước khi xóa tài khoản.` };
  if (c.pendingTopups + c.pendingProOrders > 0) return { code: "pending_money", status: 409, extra: { topups: c.pendingTopups, proOrders: c.pendingProOrders }, error: `Còn ${c.pendingTopups} yêu cầu nạp Coin và ${c.pendingProOrders} đơn gói Pro đang chờ xử lý. Xử lý xong rồi mới xóa tài khoản.` };
  if (c.walletBalance > 0 && c.approvedTopups > 0) return { code: "wallet_from_money", status: 409, extra: { approvedTopups: c.approvedTopups }, error: "Ví còn Coin từ tiền thật đã nạp. Cần xử lý số dư (hoàn hoặc dùng hết) bên ngoài hệ thống trước khi xóa tài khoản." };
  if (c.activeSubscriptions > 0) return { code: "active_subscription", status: 409, extra: { count: c.activeSubscriptions }, error: `Gia sư còn ${c.activeSubscriptions} gói VIP đang hiệu lực. Chờ hết hạn hoặc huỷ gói trước khi xóa tài khoản.` };
  return null;
}

/** Đọc DB (chỉ ĐỌC các bảng tiền). */
export async function countBlockers(userId: string, kind: AccountKind): Promise<BlockerCounts> {
  const isTutor = kind === "tutor";
  const [activeEnrollments, ownedCoursesActive, openInvoices, uninvoicedFees, activePackages, pendingTopups, pendingProOrders, wallet, approvedTopups, activeSubscriptions] = await Promise.all([
    isTutor ? Promise.resolve(0) : prisma.enrollment.count({ where: { userId, status: "active" } }),
    isTutor ? prisma.course.count({ where: { ownerId: userId, OR: [{ enrollments: { some: { status: "active" } } }, { status: true, classStatus: { not: "closed" } }] } }) : Promise.resolve(0),
    prisma.tuitionInvoice.count({ where: { OR: [{ studentId: userId }, { tutorId: userId }], status: { in: [...OPEN_INVOICE_STATUSES] } } }),
    prisma.feeCharge.count({ where: { OR: [{ studentId: userId }, { tutorId: userId }], amount: { gt: 0 }, invoiceId: null } }),
    prisma.sessionPackage.count({ where: { studentId: userId, status: "active" } }),
    prisma.coinTopupRequest.count({ where: { userId, status: "pending" } }),
    prisma.proOrder.count({ where: { userId, status: "pending" } }),
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.coinTopupRequest.count({ where: { userId, status: "approved" } }),
    isTutor ? prisma.tutorSubscription.count({ where: { userId, status: "active" } }) : Promise.resolve(0),
  ]);
  return { activeEnrollments, ownedCoursesActive, openInvoices, uninvoicedFees, activePackages, pendingTopups, pendingProOrders, walletBalance: wallet?.balance ?? 0, approvedTopups, activeSubscriptions };
}

/** Ẩn danh hoá trong MỘT giao dịch. false = tài khoản đã ẩn danh (hai người xoá cùng lúc) → không làm gì. */
export async function anonymizeUser(userId: string, kind: AccountKind): Promise<boolean> {
  return prisma.$transaction(async tx => {
    const r = await tx.user.updateMany({ where: { id: userId, ...NOT_ANONYMIZED }, data: buildAnonymizedUserData(userId, kind) });
    if (r.count === 0) return false;
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.verifyToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    if (kind === "tutor") await tx.tutorPayoutAccount.deleteMany({ where: { userId } });
    return true;
  });
}
