import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { isPastMaxAge, sessionLifetimeMs, shouldRenew } from "@/lib/sessionPolicy";

// Cookie giữ tên cũ "midnight_session" để không đăng xuất mọi người khi đổi mốc (Figma 33:2 gọi là kin_s; đổi tên là việc riêng).
const COOKIE_NAME = "midnight_session";

export interface SessionPayload {
  userId:    string;
  role:      "student" | "admin";
  adminRole?: "admin_super" | "admin_content" | "teacher";
  /** Giây (chuẩn JWT). Chỉ có khi đọc từ token; không ghi vào token qua trường này. */
  iat?:      number;
  exp?:      number;
}

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET chưa được cấu hình");
  return new TextEncoder().encode(secret);
}

// Chỉ ba trường định danh vào token; iat/exp do jose đặt theo mốc của vai (xem sessionPolicy.ts).
function claims(p: SessionPayload): SessionPayload {
  const c: SessionPayload = { userId: p.userId, role: p.role };
  if (p.adminRole) c.adminRole = p.adminRole;
  return c;
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  const c = claims(payload);
  return new SignJWT({ ...c })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + sessionLifetimeMs(c)) / 1000))
    .sign(getKey());
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    const p = payload as unknown as SessionPayload;
    // Token cũ của quản trị (cấp khi mọi vai còn 7 ngày) quá 12 giờ thì bỏ, dù exp còn xa.
    if (isPastMaxAge(p, Date.now())) return null;
    return p;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const c          = claims(payload);
  const token      = await encrypt(c);
  const expiresAt  = new Date(Date.now() + sessionLifetimeMs(c));
  const store      = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires:  expiresAt,
    path:     "/",
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decrypt(token);
}

/**
 * Gia hạn phiên gia sư/học sinh thêm 30 ngày (tối đa một lần mỗi 24 giờ). Quản trị KHÔNG bao giờ được gia hạn.
 * Chỉ gọi được ở nơi ghi được cookie (route handler / server action). Trả true nếu đã cấp lại cookie.
 */
export async function renewSessionIfDue(session: SessionPayload): Promise<boolean> {
  if (!shouldRenew(session, Date.now())) return false;
  await createSession(session);
  return true;
}
