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
export interface DbAuthState { role: string; adminRole: string | null; banned: boolean; sessionsValidAfter?: Date | null }
export type DenyReason = "gone" | "banned" | "expired" | "revoked";

/** Phiên cấp trước mốc thu hồi (User.sessionsValidAfter) là phiên cũ. Mốc null/không có → không thu hồi gì. Token thiếu iat mà có mốc → coi là cũ.
 *  So theo GIÂY (iat của JWT là giây nguyên): phiên cấp ngay sau khi đặt mốc, cùng giây, vẫn dùng được. */
export function isRevokedByMark(iat: number | undefined, mark: Date | null | undefined): boolean {
  if (!mark) return false;
  return typeof iat !== "number" || iat < Math.floor(mark.getTime() / 1000);
}
/** Mốc thu hồi cho mọi chỗ ĐẶT sessionsValidAfter: giây nguyên kế tiếp (strictly sau `now`). Cookie của kẻ chiếm cấp ở bất kỳ mili-giây nào của giây hiện tại
 *  có iat < mốc → chắc chắn bị thu hồi. Phiên hợp lệ cấp NGAY SAU đó phải mang iat = iatForMark(mốc) (createSession(..., { iat })) thì mới sống; phiên mới đăng nhập
 *  sau đó tự nhiên có iat >= mốc. Cửa sổ đổi lại: một lượt đăng nhập khác chạy trong đúng giây đó (iat < mốc) cũng bị đá — hướng sai an toàn, chỉ phải đăng nhập lại. */
export function revocationMark(nowMs: number = Date.now()): Date {
  return new Date((Math.floor(nowMs / 1000) + 1) * 1000);
}
/** Mốc cho chỗ đặt sessionsValidAfter trong/ngay trước giao dịch commit (tính SAU mọi bước chậm như bcrypt, sát câu lệnh ghi cuối). Cộng thêm 1 giây đệm so với revocationMark:
 *  cookie của kẻ chiếm cấp ở mili-giây bất kỳ từ lúc tính mốc tới lúc commit có iat <= giây(lúc tính)+1 < mốc, nên bị thu hồi dù ranh giới giây rơi vào giữa chừng.
 *  Cửa sổ còn lại chỉ khi khoảng "tính mốc → commit" dài hơn ~1 giây (một vòng tới DB). Đổi lại phiên hợp lệ khác cấp trong ~2 giây quanh đó cũng phải đăng nhập lại (hướng an toàn). */
export function commitMark(nowMs: number = Date.now()): Date {
  return revocationMark(nowMs + 1000);
}
export function iatForMark(mark: Date): number {
  return Math.floor(mark.getTime() / 1000);
}
export type Verdict = { ok: true; session: TokenSession } | { ok: false; reason: DenyReason };

/**
 * DB là nguồn sự thật cho vai. Người bị xoá → "gone"; bị khoá → "banned"; vai DB lệch token → dùng vai DB
 * (hạ quyền có hiệu lực ngay ở route ghi). Giữ NGUYÊN iat/exp của token (không kéo dài phiên); nếu DB đặt người này
 * vào vai quản trị mà phiên đã quá 12 giờ kể từ lần đăng nhập thật → "expired" (cùng quy tắc với /api/auth/me, NC2-029c).
 */
export function reconcileSession(token: TokenSession, db: DbAuthState | null, nowMs: number): Verdict {
  if (!db) return { ok: false, reason: "gone" };
  if (db.banned) return { ok: false, reason: "banned" };
  if (isRevokedByMark(token.iat, db.sessionsValidAfter)) return { ok: false, reason: "revoked" };
  const role: TokenSession["role"] = db.role === "admin" ? "admin" : "student";
  const adminRole = db.adminRole === "admin_super" || db.adminRole === "admin_content" || db.adminRole === "teacher" ? db.adminRole : undefined;
  if (token.role === role && (token.adminRole ?? undefined) === adminRole) return { ok: true, session: token };
  const synced: TokenSession = { ...token, role };
  if (adminRole) synced.adminRole = adminRole; else delete synced.adminRole;
  if (isAdminSession(synced) && isPastMaxAge(synced, nowMs)) return { ok: false, reason: "expired" };
  return { ok: true, session: synced };
}
