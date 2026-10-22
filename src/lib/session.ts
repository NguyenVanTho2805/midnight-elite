import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { METHOD_HEADER, isWriteMethod, reconcileSession, type DbAuthState, type DenyReason } from "@/lib/sessionVerify";
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

/** `iat` (giây): chỉ dùng khi đồng bộ vai của phiên đang sống — giữ mốc đăng nhập thật, không kéo dài phiên. Mặc định = bây giờ. */
export interface IssueOptions { iat?: number }

export async function encrypt(payload: SessionPayload, opts: IssueOptions = {}): Promise<string> {
  const c = claims(payload);
  const issuedMs = typeof opts.iat === "number" ? opts.iat * 1000 : Date.now();
  return new SignJWT({ ...c })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(issuedMs / 1000))
    .setExpirationTime(Math.floor((issuedMs + sessionLifetimeMs(c)) / 1000))
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

export async function createSession(payload: SessionPayload, opts: IssueOptions = {}) {
  const c          = claims(payload);
  const token      = await encrypt(c, opts);
  const issuedMs   = typeof opts.iat === "number" ? opts.iat * 1000 : Date.now();
  const expiresAt  = new Date(issuedMs + sessionLifetimeMs(c));
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

// NC2-033: yêu cầu GHI (POST/PUT/PATCH/DELETE) được đối chiếu với DB MỘT lần (cache theo yêu cầu): bị xoá/bị khoá → từ chối + xoá cookie;
// vai DB lệch token → dùng vai DB. Yêu cầu đọc giữ nguyên hành vi cũ (chỉ tin token, /api/auth/me tự đồng bộ).
// React cache() KHÔNG khử trùng trong route handler (đã đo: 3 lần gọi = 3 truy vấn), nên nhớ theo đối tượng headers() của chính yêu cầu.
const authStateMemo = new WeakMap<object, Map<string, Promise<DbAuthState | null>>>();

async function loadAuthState(req: object, userId: string): Promise<DbAuthState | null> {
  let perReq = authStateMemo.get(req);
  if (!perReq) { perReq = new Map(); authStateMemo.set(req, perReq); }
  let p = perReq.get(userId);
  if (!p) {
    p = import("@/lib/prisma").then(({ prisma }) => prisma.user.findUnique({ where: { id: userId }, select: { role: true, adminRole: true, banned: true } }));
    perReq.set(userId, p);
  }
  return p;
}

export interface CheckedSession { session: SessionPayload | null; denied?: DenyReason }

export async function getSessionChecked(): Promise<CheckedSession> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return { session: null };
  const session = await decrypt(token);
  if (!session) return { session: null };
  const reqHeaders = await headers();
  if (!isWriteMethod(reqHeaders.get(METHOD_HEADER))) return { session };
  const verdict = reconcileSession(session, await loadAuthState(reqHeaders, session.userId), Date.now());
  if (verdict.ok) return { session: verdict.session };
  try { store.delete(COOKIE_NAME); } catch { /* ngữ cảnh không ghi được cookie: vẫn từ chối */ }
  return { session: null, denied: verdict.reason };
}

export async function getSession(): Promise<SessionPayload | null> {
  return (await getSessionChecked()).session;
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
