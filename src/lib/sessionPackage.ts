// HP-31 (24/10/2026) — gói buổi trả trước và sổ sử dụng: phần THUẦN (không Prisma). Test: tools/local-e2e/t-session-package-lib.ts.
//
// SỔ BUỔI, KHÔNG PHẢI SỔ TIỀN. Chủ chốt: "làm theo mô hình sổ buổi (số buổi, không chuyển tiền thật), chỉ áp lớp tạo sau, cần kế toán xem trước khi dùng thật".
//   • Một gói = N buổi cho MỘT em trong MỘT lớp kiểu mới (theo buổi / theo giờ). Mỗi buổi ĐÃ CHỐT mà em có mặt hoặc đi muộn (không dùng buổi bù) trừ 1 buổi.
//   • Số dư buổi = số buổi của gói − số lần trừ còn hiệu lực. Trả buổi (em đổi sang vắng, mở lại buổi, xoá buổi) không xoá dòng: đặt reversedAt để giữ lịch sử.
//   • unitPrice / totalPrice chỉ GHI LẠI đơn giá lúc lập (chụp), KiN không thu, không gạch nợ, KHÔNG tự bớt khoản nào trên phiếu học phí.
//     Đó là điểm CẦN KẾ TOÁN DUYỆT trước khi dùng thật (có coi buổi trong gói là đã thu không).
import { isChargeableStatus } from "@/lib/tuitionFee";

export const PACKAGE_MIN_SESSIONS = 1;
export const PACKAGE_MAX_SESSIONS = 200;
export const PACKAGE_NOTE_MAX = 300;
/** Tối đa số gói còn dùng được của một em trong một lớp (chống bấm nhầm tạo hàng loạt). */
export const PACKAGE_MAX_OPEN_PER_STUDENT = 10;

export const PACKAGE_STATUSES = ["active", "used_up", "cancelled"] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];
export const PACKAGE_STATUS_LABEL: Record<PackageStatus, string> = { active: "Còn buổi", used_up: "Đã dùng hết", cancelled: "Đã huỷ" };

/** Chữ nói thật cho gia sư (và phụ huynh nếu cần): sổ buổi để theo dõi, không phải thu tiền. */
export const PACKAGE_NOTICE = "Sổ buổi chỉ để theo dõi số buổi còn lại. KiN không thu hay chuyển tiền và chưa tự bớt khoản nào trên phiếu học phí; cách ghi nhận cần kế toán duyệt trước khi dùng thật.";
export const PACKAGE_PARENT_NOTICE = "Gia sư ghi số buổi trả trước trên KiN. Trang này chỉ trình bày số buổi, không phải hoá đơn hay xác nhận thanh toán.";

export const isPackageStatus = (v: unknown): v is PackageStatus => typeof v === "string" && (PACKAGE_STATUSES as readonly string[]).includes(v);

export type PackageInput = { studentId: string; sessions: number; note: string | null };
export function parsePackageInput(body: unknown): { ok: true; value: PackageInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.studentId !== "string" || !b.studentId.trim()) return { ok: false, error: "Chọn em cần lập gói." };
  const n = b.sessions;
  if (typeof n !== "number" || !Number.isInteger(n) || n < PACKAGE_MIN_SESSIONS || n > PACKAGE_MAX_SESSIONS) {
    return { ok: false, error: `Số buổi phải là số nguyên từ ${PACKAGE_MIN_SESSIONS} đến ${PACKAGE_MAX_SESSIONS}.` };
  }
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== "string") return { ok: false, error: "Ghi chú phải là chữ." };
    note = b.note.trim().slice(0, PACKAGE_NOTE_MAX) || null;
  }
  return { ok: true, value: { studentId: b.studentId.trim(), sessions: n, note } };
}

/** Giá ghi lại lúc lập = đơn giá một buổi × số buổi (số nguyên đồng). null nếu số liệu hỏng. Không dùng để thu tiền. */
export function snapshotTotal(unitPrice: number, sessions: number): number | null {
  if (!Number.isInteger(unitPrice) || !Number.isInteger(sessions) || unitPrice <= 0 || sessions <= 0) return null;
  const t = unitPrice * sessions;
  return Number.isSafeInteger(t) && t <= 2_000_000_000 ? t : null;
}

/** Số buổi còn lại. Không bao giờ âm (nếu dữ liệu hỏng thì kẹp về 0). */
export function balanceOf(p: { sessions: number; activeUses: number }): number {
  return Math.max(0, p.sessions - Math.max(0, p.activeUses));
}

/** Trạng thái sau khi số dư đổi. Gói đã huỷ giữ nguyên "đã huỷ" (huỷ là việc gia sư làm, không tự đảo). */
export function statusAfter(p: { status: string; sessions: number; activeUses: number }): PackageStatus {
  if (p.status === "cancelled") return "cancelled";
  return balanceOf(p) <= 0 ? "used_up" : "active";
}

/** Buổi này có trừ buổi của gói không: cùng định nghĩa "buổi tính phí" (có mặt / muộn) và buổi dùng buổi bù thì không. */
export function consumesPackage(i: { status: string; makeupUsed: boolean }): boolean {
  return isChargeableStatus(i.status) && !i.makeupUsed;
}

export interface PackageLite { id: string; status: string; sessions: number; activeUses: number; createdAt: Date | string }
export interface ExistingUse { packageId: string; reversedAt: Date | string | null }
export type UseAction =
  | { type: "none" }
  | { type: "create"; packageId: string }   // chưa có dòng trừ cho bản ghi này
  | { type: "revive"; packageId: string }   // có dòng đã trả trước đó, trừ lại
  | { type: "reverse" };                    // đang trừ mà bản ghi không còn tính

/**
 * Quyết định cho MỘT bản ghi điểm danh của buổi ĐÃ CHỐT. Chọn gói CŨ NHẤT còn buổi (createdAt tăng dần, hoà thì id).
 * Bản ghi đã trừ rồi mà vẫn tính → giữ nguyên (không trừ hai lần, không đổi gói). Gói đã huỷ / hết buổi không được chọn.
 */
export function planUse(i: { consumes: boolean; existing: ExistingUse | null; packages: readonly PackageLite[] }): UseAction {
  const live = !!i.existing && !i.existing.reversedAt;
  if (!i.consumes) return live ? { type: "reverse" } : { type: "none" };
  if (live) return { type: "none" };
  const pick = [...i.packages]
    .filter(p => p.status === "active" && balanceOf(p) > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || (a.id < b.id ? -1 : 1))[0];
  if (!pick) return { type: "none" };
  return i.existing ? { type: "revive", packageId: pick.id } : { type: "create", packageId: pick.id };
}

/** Trạng thái dòng học phí CÙNG buổi (để gia sư thấy nguy cơ tính hai lần): none = không có dòng phí; pending = chưa vào phiếu; invoiced = đã vào phiếu. */
export type ChargeLink = "none" | "pending" | "invoiced";
export const CHARGE_LINK_LABEL: Record<ChargeLink, string> = {
  none: "Không có khoản học phí cùng buổi",
  pending: "Có khoản học phí cùng buổi, chưa vào phiếu",
  invoiced: "Có khoản học phí cùng buổi, đã vào phiếu",
};
export function chargeLinkOf(c: { exists: boolean; invoiceId: string | null } | null | undefined): ChargeLink {
  if (!c || !c.exists) return "none";
  return c.invoiceId ? "invoiced" : "pending";
}
