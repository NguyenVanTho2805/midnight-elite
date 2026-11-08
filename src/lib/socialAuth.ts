// Phần DÙNG CHUNG của "Tiếp tục với Google / Facebook" cho HỌC SINH (08/11/2026): cookie trạng thái chống CSRF, quyết định đăng nhập THUẦN theo nhà cung cấp,
// và bước ghi DB + chọn người dùng. Chi tiết từng nhà (URL, id_token / Graph API) nằm ở googleAuth.ts và facebookAuth.ts.
//
// Luật quyết định (decideSocialSignIn):
//   chung     : bị khoá/ẩn → từ chối; gia sư / quản trị / người có đơn gia sư → KHÔNG vào bằng mạng xã hội ("đăng nhập bằng mật khẩu", chống chiếm quyền).
//   google    : Google có cờ email_verified (đã kiểm trước khi tới đây) → email trùng học sinh cũ thì vào và gắn googleSub.
//               Nếu tài khoản cũ CHƯA xác minh email (ai cũng đăng ký được bằng email của người khác) thì coi là chiếm trước: lúc liên kết ĐỔI mật khẩu sang băm ngẫu nhiên,
//               xoá VerifyToken, gỡ facebookId (kẻ chiếm trước không giữ lối vào nào). Tài khoản đã xác minh thì giữ nguyên mọi thứ.
//   facebook  : Facebook KHÔNG có cờ đó và có thể không trả email → KHÔNG tự liên kết theo email. Chỉ vào được khi facebookId đã khớp; email đã có tài khoản mà chưa liên kết
//               → "email-exists"; không có email → "no-email"; email mới → tạo học sinh với emailVerified=FALSE + VerifyToken + thư xác minh như /api/auth/register
//               (Facebook không chứng minh người đó sở hữu hộp thư, nên không đặt true).
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupBonusOps } from "@/lib/wallet";
import { requestSignupCode } from "@/lib/loginCodeServer";

export type Provider = "google" | "facebook";
export const COOKIE_NAME: Record<Provider, string> = { google: "kin_google", facebook: "kin_facebook" };
export const COOKIE_PATH: Record<Provider, string> = { google: "/api/auth/google", facebook: "/api/auth/facebook" };
export const STATE_TTL_SEC = 10 * 60;
type Env = Record<string, string | undefined>;

const b64url = (b: Buffer) => b.toString("base64url");
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface FlowState { state: string; nonce: string; verifier: string; redirect: string | null }
const key = (env: Env) => { if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET chưa được cấu hình"); return new TextEncoder().encode(env.SESSION_SECRET); };
const aud = (p: Provider) => `kin-${p}-flow`;

/** Cookie ngắn hạn (10 phút): state (+ nonce, code_verifier cho Google) + trang định vào. Ký bằng SESSION_SECRET; mỗi nhà một `aud` nên cookie nhà này không dùng được cho nhà kia. */
export async function signFlow(p: Provider, s: FlowState, env: Env = process.env): Promise<string> {
  return new SignJWT({ ...s, redirect: s.redirect ?? "" }).setProtectedHeader({ alg: "HS256" }).setAudience(aud(p)).setIssuedAt().setExpirationTime(`${STATE_TTL_SEC}s`).sign(key(env));
}
export async function readFlow(p: Provider, token: string | undefined, env: Env = process.env): Promise<FlowState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(env), { algorithms: ["HS256"], audience: aud(p) });
    const { state, nonce, verifier, redirect } = payload as Record<string, unknown>;
    if (typeof state !== "string" || typeof nonce !== "string" || typeof verifier !== "string") return null;
    return { state, nonce, verifier, redirect: typeof redirect === "string" && redirect ? redirect : null };
  } catch { return null; }
}

export interface ExistingUser {
  id: string; role: string; adminRole: string | null; banned: boolean; deletedAt: Date | null;
  tutorAppliedAt: Date | null; tutorVerified: boolean;
  /** Mã người dùng của CHÍNH nhà cung cấp đang đăng nhập (googleSub hoặc facebookId) trên tài khoản này; null = chưa liên kết. */
  linkedId: string | null;
  /** Email đã được chứng minh sở hữu chưa (thư xác minh / đặt lại mật khẩu / Google). false = có thể do người khác đăng ký trước bằng email này. */
  emailVerified: boolean;
}
export type DenyReason = "banned" | "password-only" | "sub-mismatch" | "email-exists" | "no-email";
export type Decision =
  | { kind: "create" }
  | { kind: "login"; userId: string; link: boolean; /** tài khoản cũ chưa xác minh email được nối vào → phải cắt mọi lối vào cũ */ reclaim: boolean }
  | { kind: "deny"; reason: DenyReason };

export function decideSocialSignIn(o: { provider: Provider; id: string; email: string | null; bySub: ExistingUser | null; byEmail: ExistingUser | null }): Decision {
  if (!o.email && !o.bySub) return { kind: "deny", reason: "no-email" };
  const u = o.bySub ?? o.byEmail;
  if (!u) return { kind: "create" };
  if (u.banned || u.deletedAt) return { kind: "deny", reason: "banned" };
  if (u.role !== "student" || u.adminRole || u.tutorAppliedAt || u.tutorVerified) return { kind: "deny", reason: "password-only" };
  if (o.bySub) return { kind: "login", userId: u.id, link: false, reclaim: false };           // đã liên kết đúng nhà này: vào, không cần email
  if (o.provider === "facebook") return { kind: "deny", reason: "email-exists" }; // Facebook: không tự nhận theo email
  if (u.linkedId && u.linkedId !== o.id) return { kind: "deny", reason: "sub-mismatch" };
  return { kind: "login", userId: u.id, link: !u.linkedId, reclaim: !u.linkedId && !u.emailVerified };
}

export interface SocialProfile { id: string; email: string | null; name: string }
const FIELD = { google: "googleSub", facebook: "facebookId" } as const;
const sel = { id: true, role: true, adminRole: true, banned: true, deletedAt: true, tutorAppliedAt: true, tutorVerified: true, emailVerified: true, googleSub: true, facebookId: true } as const;
type Row = { id: string; role: string; adminRole: string | null; banned: boolean; deletedAt: Date | null; tutorAppliedAt: Date | null; tutorVerified: boolean; emailVerified: boolean; googleSub: string | null; facebookId: string | null };
const toExisting = (p: Provider, r: Row | null): ExistingUser | null => (r ? { ...r, linkedId: r[FIELD[p]] } : null);

/** Mọi thứ kẻ chiếm trước có thể đã điền vào tài khoản (tự khai + số đã xác minh bằng SMS → nếu để lại, hắn vẫn đăng nhập được bằng mã SMS). Chỉ ĐẶT về trạng thái trống như tài khoản mới. */
const RECLAIM_WIPE = { phone: null, phoneE164: null, phoneVerifiedAt: null, parentPhone: null, parentName: null, school: null, highSchool: null, city: null, zaloPhone: null, facebookUrl: null, avatarBase64: null, dateOfBirth: null, selfConsentAt: null } as const;

export type Resolved = { ok: true; userId: string; role: string; adminRole: string | null } | { ok: false; reason: DenyReason | "failed" };

/** Tìm / tạo / liên kết người dùng cho một lượt đăng nhập mạng xã hội đã được nhà cung cấp xác nhận. Tạo mới = học sinh; Google: emailVerified=true, KHÔNG VerifyToken, KHÔNG thư; Facebook: emailVerified=false + VerifyToken + thư xác minh (như register);
 *  ví + xu khởi đầu cùng giao dịch (signupBonusOps, như /api/auth/register). Không thu gì ngoài tên + email + mã nhà cung cấp. */
export async function resolveSocialUser(provider: Provider, p: SocialProfile): Promise<Resolved> {
  const f = FIELD[provider];
  const [s, e] = await Promise.all([
    prisma.user.findUnique({ where: { [f]: p.id } as never, select: sel }),
    p.email ? prisma.user.findUnique({ where: { email: p.email }, select: sel }) : Promise.resolve(null),
  ]);
  let d = decideSocialSignIn({ provider, id: p.id, email: p.email, bySub: toExisting(provider, s as Row | null), byEmail: toExisting(provider, e as Row | null) });
  if (d.kind === "deny") return { ok: false, reason: d.reason };
  let userId: string;
  let verifyToken: string | null = null;
  if (d.kind === "create") {
    try {
      const password = await bcrypt.hash(randomBytes(32).toString("hex"), 10); // cột bắt buộc: băm chuỗi ngẫu nhiên; "Quên mật khẩu" vẫn đặt được mật khẩu mới qua email
      userId = await prisma.$transaction(async tx => {
        const u = await tx.user.create({ data: { name: p.name, email: p.email!, password, role: "student", emailVerified: provider === "google", [f]: p.id } });
        for (const op of signupBonusOps(tx, u.id)) await op;
        if (provider !== "google") {
          verifyToken = randomBytes(32).toString("hex");
          await tx.verifyToken.create({ data: { token: verifyToken, userId: u.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        }
        return u.id;
      }, { timeout: 15_000, maxWait: 10_000 });
    } catch (err) {
      if ((err as { code?: string })?.code !== "P2002") throw err;
      // Hai lượt cùng lúc: bên thua khoá duy nhất → quyết định lại một lần theo dữ liệu đã có.
      const [s2, e2] = await Promise.all([
        prisma.user.findUnique({ where: { [f]: p.id } as never, select: sel }),
        prisma.user.findUnique({ where: { email: p.email! }, select: sel }),
      ]);
      d = decideSocialSignIn({ provider, id: p.id, email: p.email, bySub: toExisting(provider, s2 as Row | null), byEmail: toExisting(provider, e2 as Row | null) });
      if (d.kind !== "login") return { ok: false, reason: d.kind === "deny" ? d.reason : "failed" };
      userId = d.userId;
    }
  } else {
    userId = d.userId;
  }
  // Google đã xác nhận hộp thư → học sinh cũ được đặt emailVerified=true. Facebook chỉ tới đây khi đã liên kết đúng facebookId hoặc vừa tạo mới (chưa xác minh).
  // Quyết định "chiếm lại" dựa trên emailVerified đọc ở bước trước; giữa hai bước chủ thật có thể đã xác minh (hoặc một lượt Google song song đã chiếm lại xong) nên
  // câu lệnh chiếm lại tự mang điều kiện emailVerified:false và kiểm số dòng. Trúng 0 dòng → đọc lại, quyết định lại (tối đa 2 lần), không đoán.
  let user: { id: string; role: string; adminRole: string | null } | null = null;
  for (let attempt = 0; attempt < 2 && !user; attempt++) {
    const link = d.kind === "create" || (d.kind === "login" && d.link);
    const reclaim = d.kind === "login" && d.reclaim;
    const data: Record<string, unknown> = { ...(provider === "google" ? { emailVerified: true } : {}), ...(link ? { [f]: p.id } : {}) };
    if (reclaim) Object.assign(data, RECLAIM_WIPE, { password: await bcrypt.hash(randomBytes(32).toString("hex"), 10), facebookId: provider === "facebook" ? p.id : null }); // chỉ Google tới được đây
    const uid = userId;
    user = await prisma.$transaction(async tx => {
      if (!reclaim) return tx.user.update({ where: { id: uid }, data, select: { id: true, role: true, adminRole: true } });
      const r = await tx.user.updateMany({ where: { id: uid, emailVerified: false }, data });
      if (r.count === 0) return null;
      await tx.verifyToken.deleteMany({ where: { userId: uid } });
      await tx.passwordResetToken.deleteMany({ where: { userId: uid } });
      // Liên kết phụ huynh do kẻ chiếm trước dựng: thu hồi (giữ bản ghi), gỡ link xem sổ không cần đăng nhập.
      await tx.parentLink.updateMany({ where: { studentId: uid, status: { not: "revoked" } }, data: { status: "revoked", portalToken: null } });
      return tx.user.findUnique({ where: { id: uid }, select: { id: true, role: true, adminRole: true } });
    });
    if (user) break;
    const [s3, e3] = await Promise.all([
      prisma.user.findUnique({ where: { [f]: p.id } as never, select: sel }),
      p.email ? prisma.user.findUnique({ where: { email: p.email }, select: sel }) : Promise.resolve(null),
    ]);
    d = decideSocialSignIn({ provider, id: p.id, email: p.email, bySub: toExisting(provider, s3 as Row | null), byEmail: toExisting(provider, e3 as Row | null) });
    if (d.kind !== "login") return { ok: false, reason: d.kind === "deny" ? d.reason : "failed" };
    userId = d.userId;
  }
  if (!user) return { ok: false, reason: "failed" };
  if (verifyToken) {
    try { await requestSignupCode(p.email!, { token: verifyToken }); } catch (err) { console.error("[social] không gửi được thư xác minh:", (err as Error).message); }
  }
  return { ok: true, userId: user.id, role: user.role, adminRole: user.adminRole };
}

export { SOCIAL_NOTICES } from "@/lib/socialNotices";
