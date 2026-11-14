// DG-GIAO-LOP (14/11/2026) — quản trị trung tâm (admin_super / admin_content) giao một lớp cho gia sư khác làm CHỦ LỚP (Course.ownerId).
// TIỀN: chỉ ĐẾM, không đổi gì. Lớp còn phiếu học phí chưa tất toán hoặc khoản phí chưa vào phiếu của gia sư cũ ⇒ CHẶN (409), vì phiếu / khoản phí
// gắn tutorId của gia sư cũ: đổi chủ lớp giữa chừng làm tiền một lớp nằm ở hai người. Không di chuyển, không sửa bất kỳ dòng tiền nào.
// Cách đếm theo countBlockers (src/lib/accountDelete.ts): phiếu draft | sent | parent_reported | partial; FeeCharge amount > 0 và invoiceId null.
// TuitionInvoice không có courseId (một phiếu = gia sư × học sinh × tháng, gom mọi lớp) ⇒ đếm phiếu mở của gia sư cũ với học sinh từng ghi danh lớp này (chặn rộng, an toàn).
import { prisma } from "@/lib/prisma";
import { isAnonEmail, OPEN_INVOICE_STATUSES } from "@/lib/accountDelete";

export interface OwnerMoneyCounts { openInvoices: number; uninvoicedFees: number }
export type AssignBlocker = { code: "open_invoices" | "uninvoiced_fees"; status: 409; error: string; count: number };

/** Thuần. null = giao được. Thứ tự cố định: phiếu mở trước, khoản chưa vào phiếu sau. */
export function pickOwnerBlocker(c: OwnerMoneyCounts): AssignBlocker | null {
  if (c.openInvoices > 0) return { code: "open_invoices", status: 409, count: c.openInvoices, error: `Lớp còn ${c.openInvoices} phiếu học phí chưa tất toán của gia sư hiện tại. Tất toán hoặc huỷ các phiếu này trước khi giao lớp.` };
  if (c.uninvoicedFees > 0) return { code: "uninvoiced_fees", status: 409, count: c.uninvoicedFees, error: `Lớp còn ${c.uninvoicedFees} khoản học phí chưa vào phiếu của gia sư hiện tại. Lập phiếu hoặc xử lý các khoản này trước khi giao lớp.` };
  return null;
}

/** Gia sư hợp lệ để làm chủ lớp: tài khoản quản trị vai giáo viên, đã duyệt hồ sơ, không khoá, chưa xoá / ẩn danh. Thuần. */
export function isAssignableTutor(u: { role: string; adminRole: string | null; tutorVerified: boolean; banned: boolean; deletedAt: Date | null; email: string } | null): boolean {
  return !!u && u.role === "admin" && u.adminRole === "teacher" && u.tutorVerified === true && u.banned === false && u.deletedAt === null && !isAnonEmail(u.email);
}

export const ASSIGNABLE_TUTOR_WHERE = { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, deletedAt: null, NOT: { email: { startsWith: "deleted+" } } } as const;

/** Đọc DB — chỉ ĐỌC bảng tiền. */
export async function countOwnerMoney(courseId: string, oldOwnerId: string, db: Pick<typeof prisma, "enrollment" | "tuitionInvoice" | "feeCharge"> = prisma): Promise<OwnerMoneyCounts> {
  const students = await db.enrollment.findMany({ where: { courseId }, select: { userId: true } });
  const ids = students.map(s => s.userId);
  const [openInvoices, uninvoicedFees] = await Promise.all([
    ids.length ? db.tuitionInvoice.count({ where: { tutorId: oldOwnerId, studentId: { in: ids }, status: { in: [...OPEN_INVOICE_STATUSES] } } }) : Promise.resolve(0),
    db.feeCharge.count({ where: { courseId, tutorId: oldOwnerId, amount: { gt: 0 }, invoiceId: null } }),
  ]);
  return { openInvoices, uninvoicedFees };
}

export type AssignResult =
  | { ok: true; fromOwnerId: string | null; removedCoTeacher: boolean }
  | { ok: false; status: 400 | 404 | 409; code: string; error: string; count?: number };

/** Giao lớp. Đếm tiền TRONG giao dịch cùng lúc đổi chủ (đổi chủ có điều kiện ownerId cũ ⇒ hai quản trị bấm cùng lúc: người sau nhận 409). */
export async function assignCourseOwner(courseId: string, tutorId: string): Promise<AssignResult> {
  const [course, tutor] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, ownerId: true } }),
    prisma.user.findUnique({ where: { id: tutorId }, select: { role: true, adminRole: true, tutorVerified: true, banned: true, deletedAt: true, email: true } }),
  ]);
  if (!course) return { ok: false, status: 404, code: "no_course", error: "Không tìm thấy lớp" };
  if (!isAssignableTutor(tutor)) return { ok: false, status: 400, code: "not_tutor", error: "Chỉ giao được cho gia sư đã duyệt hồ sơ, tài khoản đang hoạt động" };
  if (course.ownerId === tutorId) return { ok: false, status: 400, code: "same_owner", error: "Gia sư này đang là chủ lớp" };
  const from = course.ownerId;
  class Stop extends Error { constructor(public r: AssignResult) { super("stop"); } }
  try {
    return await prisma.$transaction(async tx => {
      if (from) {
        const b = pickOwnerBlocker(await countOwnerMoney(courseId, from, tx));
        if (b) throw new Stop({ ok: false, status: 409, code: b.code, error: b.error, count: b.count });
      }
      const upd = await tx.course.updateMany({ where: { id: courseId, ownerId: from }, data: { ownerId: tutorId } });
      if (upd.count === 0) throw new Stop({ ok: false, status: 409, code: "changed", error: "Chủ lớp vừa được đổi bởi người khác. Tải lại trang rồi thử lại." });
      // Gia sư mới đang là đồng giảng / giáo viên bộ môn của chính lớp này ⇒ gỡ hàng đó (chủ lớp không đồng thời là đồng giảng).
      const del = await tx.courseTeacher.deleteMany({ where: { courseId, userId: tutorId } });
      return { ok: true as const, fromOwnerId: from, removedCoTeacher: del.count > 0 };
    });
  } catch (e) {
    if (e instanceof Stop) return e.r;
    throw e;
  }
}
