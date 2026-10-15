// Mốc sống của phiên đăng nhập (Figma "Bản đồ đường vào" 33:2). Thuần, không đụng cookie/DB — để test từng quy tắc.
//
//   Gia sư, học sinh : 30 ngày, GIA HẠN mỗi lần dùng (nhưng tối đa một lần mỗi 24 giờ — không ghi lại cookie ở mọi yêu cầu).
//   Quản trị         : 12 giờ, KHÔNG gia hạn tự động. Máy bỏ quên 12 giờ thì hết đường; muốn tiếp phải đăng nhập lại bằng mã.
//
// "Quản trị" = role "admin" mà adminRole KHÁC "teacher". Gia sư cũng là role "admin" (adminRole "teacher") nên đi theo mốc 30 ngày.
// Vai lạ / thiếu adminRole của role admin → coi là quản trị (mốc ngắn): lỗi nghiêng về phía an toàn.
export const HOUR_MS = 60 * 60_000;
export const DAY_MS = 24 * HOUR_MS;
export const USER_SESSION_MS = 30 * DAY_MS;
export const ADMIN_SESSION_MS = 12 * HOUR_MS;
export const RENEW_AFTER_MS = DAY_MS;

export interface SessionLike { role: string; adminRole?: string | null; iat?: number }

export const isAdminSession = (s: SessionLike): boolean => s.role === "admin" && s.adminRole !== "teacher";

export const sessionLifetimeMs = (s: SessionLike): number => (isAdminSession(s) ? ADMIN_SESSION_MS : USER_SESSION_MS);

/** Nhãn cho thông báo / log: "12 giờ" hoặc "30 ngày". */
export const sessionLifetimeLabel = (s: SessionLike): string => (isAdminSession(s) ? "12 giờ" : "30 ngày");

/**
 * Phiên đã quá tuổi tối đa theo VAI hiện tại chưa. Dùng khi đọc token: token cũ (cấp khi mọi vai còn 7 ngày) của quản trị
 * quá 12 giờ bị từ chối dù `exp` còn xa. `iat` tính bằng giây (chuẩn JWT).
 */
export function isPastMaxAge(s: SessionLike, nowMs: number): boolean {
  if (typeof s.iat !== "number") return true; // không có mốc cấp → không chứng minh được tuổi → bỏ
  return nowMs - s.iat * 1000 >= sessionLifetimeMs(s);
}

/** Có nên cấp lại cookie (kéo dài thêm 30 ngày) không: chỉ gia sư/học sinh, và đã qua 24 giờ kể từ lần cấp gần nhất. */
export function shouldRenew(s: SessionLike, nowMs: number): boolean {
  if (isAdminSession(s) || typeof s.iat !== "number") return false;
  const age = nowMs - s.iat * 1000;
  return age >= RENEW_AFTER_MS && age < USER_SESSION_MS;
}
