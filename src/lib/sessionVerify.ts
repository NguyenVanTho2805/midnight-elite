// NC2-033 — đối chiếu phiên (token) với DB cho các yêu cầu GHI. Phần thuần: không cookie, không DB, để test từng quy tắc.
// Nơi duy nhất dùng: getSession() trong src/lib/session.ts (mọi route đi qua đó, kể cả requirePermission / requireSession).
import { isAdminSession, isPastMaxAge } from "@/lib/sessionPolicy";

/** Tiêu đề do src/proxy.ts đặt (và GHI ĐÈ giá trị client gửi) = phương thức HTTP thật của yêu cầu. */
export const METHOD_HEADER = "x-kin-method";

/** Chỉ GET/HEAD/OPTIONS được bỏ qua việc đối chiếu. Thiếu tiêu đề hoặc lạ → coi là GHI (lỗi nghiêng về phía an toàn). */
export function isWriteMethod(method: string | null | undefined): boolean {
  const m = (method ?? "").toUpperCase();
  return !(m === "GET" || m === "HEAD" || m === "OPTIONS");
}

export interface TokenSession { userId: string; role: "student" | "admin"; adminRole?: "admin_super" | "admin_content" | "teacher"; iat?: number; exp?: number }
export interface DbAuthState { role: string; adminRole: string | null; banned: boolean }
export type DenyReason = "gone" | "banned" | "expired";
export type Verdict = { ok: true; session: TokenSession } | { ok: false; reason: DenyReason };

/**
 * DB là nguồn sự thật cho vai. Người bị xoá → "gone"; bị khoá → "banned"; vai DB lệch token → dùng vai DB
 * (hạ quyền có hiệu lực ngay ở route ghi). Giữ NGUYÊN iat/exp của token (không kéo dài phiên); nếu DB đặt người này
 * vào vai quản trị mà phiên đã quá 12 giờ kể từ lần đăng nhập thật → "expired" (cùng quy tắc với /api/auth/me, NC2-029c).
 */
export function reconcileSession(token: TokenSession, db: DbAuthState | null, nowMs: number): Verdict {
  if (!db) return { ok: false, reason: "gone" };
  if (db.banned) return { ok: false, reason: "banned" };
  const role: TokenSession["role"] = db.role === "admin" ? "admin" : "student";
  const adminRole = db.adminRole === "admin_super" || db.adminRole === "admin_content" || db.adminRole === "teacher" ? db.adminRole : undefined;
  if (token.role === role && (token.adminRole ?? undefined) === adminRole) return { ok: true, session: token };
  const synced: TokenSession = { ...token, role };
  if (adminRole) synced.adminRole = adminRole; else delete synced.adminRole;
  if (isAdminSession(synced) && isPastMaxAge(synced, nowMs)) return { ok: false, reason: "expired" };
  return { ok: true, session: synced };
}
