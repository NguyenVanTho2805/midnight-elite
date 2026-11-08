// "Tiếp tục với Google" — phần THUẦN (không DB, không mạng): quyết định đăng nhập, kiểm id_token, cookie trạng thái, URL PKCE, bật/tắt theo biến môi trường.
import { SignJWT } from "jose";
import { check, section, done } from "./h";
import {
  GOOGLE_NOTICES, buildAuthUrl, googleEnabled, googleEndpoints, googleRedirectUri, pkceChallenge, profileFromIdToken, randomToken,
  readFlowState, signFlowState,
} from "@/lib/googleAuth";
import { decideSocialSignIn, type ExistingUser } from "@/lib/socialAuth";

const env = { SESSION_SECRET: "test-secret-test-secret-test-secret-123456" };
const U = (o: Partial<ExistingUser> = {}): ExistingUser => ({ id: "u1", role: "student", adminRole: null, banned: false, deletedAt: null, tutorAppliedAt: null, tutorVerified: false, linkedId: null, ...o });
const CID = "cid.apps.googleusercontent.com", NONCE = "n-123";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (c: Record<string, unknown>) => `${b64({ alg: "RS256" })}.${b64(c)}.sig`;
const base = { iss: "https://accounts.google.com", aud: CID, exp: Math.floor(Date.now() / 1000) + 600, nonce: NONCE, sub: "sub-1", email: "Em.Hoa@Gmail.com", email_verified: true, name: "  Em Hoa " };

(async () => {
  section("decideSocialSignIn — email mới / học sinh cũ / gia sư / khoá");
  check("không có ai → tạo học sinh mới", decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: null, byEmail: null }).kind === "create");
  const d1 = decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: null, byEmail: U() });
  check("học sinh cũ (theo email, chưa có googleSub) → vào + gắn sub", d1.kind === "login" && d1.link === true, d1);
  const d2 = decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: U({ linkedId: "s" }), byEmail: null });
  check("khớp theo sub → vào, không gắn lại", d2.kind === "login" && d2.link === false, d2);
  check("học sinh bị khoá → từ chối 'banned'", JSON.stringify(decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: null, byEmail: U({ banned: true }) })) === '{"kind":"deny","reason":"banned"}');
  check("học sinh đã ẩn (deletedAt) → 'banned'", (decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: null, byEmail: U({ deletedAt: new Date() }) }) as { reason?: string }).reason === "banned");
  check("khoá thắng cả khi là gia sư", (decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: null, byEmail: U({ banned: true, role: "admin", adminRole: "teacher" }) }) as { reason?: string }).reason === "banned");
  for (const [label, u] of [
    ["gia sư (role admin + teacher)", U({ role: "admin", adminRole: "teacher" })],
    ["quản trị super", U({ role: "admin", adminRole: "admin_super" })],
    ["quản trị nội dung", U({ role: "admin", adminRole: "admin_content" })],
    ["role admin không adminRole", U({ role: "admin" })],
    ["học sinh có đơn gia sư chờ duyệt", U({ tutorAppliedAt: new Date() })],
    ["học sinh có tutorVerified", U({ tutorVerified: true })],
  ] as const) check(`${label} → 'password-only', không vào bằng Google`, (decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: null, byEmail: u }) as { reason?: string }).reason === "password-only");
  check("gia sư có googleSub trùng (bySub) cũng bị chặn", (decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: U({ role: "admin", adminRole: "teacher", linkedId: "s" }), byEmail: null }) as { reason?: string }).reason === "password-only");
  check("email đã gắn Google KHÁC → 'sub-mismatch'", (decideSocialSignIn({ provider: "google", id: "s", email: "a@b.c", bySub: null, byEmail: U({ linkedId: "khac" }) }) as { reason?: string }).reason === "sub-mismatch");

  section("profileFromIdToken — email_verified, iss, aud, exp, nonce");
  const ok = profileFromIdToken(jwt(base), { clientId: CID, nonce: NONCE });
  check("hợp lệ → email chuẩn hoá thường, tên cắt khoảng trắng, có sub", ok.ok && ok.profile.email === "em.hoa@gmail.com" && ok.profile.name === "Em Hoa" && ok.profile.sub === "sub-1", ok);
  const bad = (c: Record<string, unknown>) => profileFromIdToken(jwt({ ...base, ...c }), { clientId: CID, nonce: NONCE });
  const r = (x: ReturnType<typeof bad>) => (x.ok ? "ok" : x.reason);
  check("email_verified=false → 'unverified'", r(bad({ email_verified: false })) === "unverified");
  check("thiếu email_verified → 'unverified'", r(bad({ email_verified: undefined })) === "unverified");
  check("email_verified chuỗi 'true' (một số bản trả vậy) → nhận", r(bad({ email_verified: "true" })) === "ok");
  check("email_verified chuỗi 'false' → 'unverified'", r(bad({ email_verified: "false" })) === "unverified");
  check("iss lạ → invalid", r(bad({ iss: "https://evil.example" })) === "invalid");
  check("iss 'accounts.google.com' (không https) → nhận", r(bad({ iss: "accounts.google.com" })) === "ok");
  check("aud là client khác → invalid", r(bad({ aud: "khac" })) === "invalid");
  check("aud là mảng có client → nhận", r(bad({ aud: ["x", CID] })) === "ok");
  check("hết hạn → invalid", r(bad({ exp: Math.floor(Date.now() / 1000) - 5 })) === "invalid");
  check("nonce sai → invalid", r(bad({ nonce: "khac" })) === "invalid");
  check("thiếu nonce → invalid", r(bad({ nonce: undefined })) === "invalid");
  check("thiếu sub → invalid", r(bad({ sub: undefined })) === "invalid");
  check("email không có @ → invalid", r(bad({ email: "abc" })) === "invalid");
  check("id_token rác / undefined → invalid", r(profileFromIdToken("rac", { clientId: CID, nonce: NONCE })) === "invalid" && r(profileFromIdToken(undefined, { clientId: CID, nonce: NONCE })) === "invalid");
  check("không có tên → lấy phần trước @", (() => { const x = bad({ name: undefined }); return x.ok && x.profile.name === "em.hoa"; })());

  section("Cookie trạng thái: ký, hết hạn, giả mạo");
  const st = { state: randomToken(), nonce: randomToken(), verifier: randomToken(48), redirect: "/student/nhap-ma-lop" };
  const tok = await signFlowState(st, env);
  check("đọc lại đúng state/nonce/verifier/redirect", JSON.stringify(await readFlowState(tok, env)) === JSON.stringify(st));
  check("redirect rỗng → null", (await readFlowState(await signFlowState({ ...st, redirect: null }, env), env))?.redirect === null);
  check("khác SESSION_SECRET → null", (await readFlowState(tok, { SESSION_SECRET: "khac-khac-khac-khac-khac-khac-khac-1" })) === null);
  check("sửa một ký tự → null", (await readFlowState(tok.slice(0, -2) + (tok.endsWith("A") ? "B" : "A") + tok.slice(-1), env)) === null);
  check("không có cookie → null", (await readFlowState(undefined, env)) === null && (await readFlowState("", env)) === null);
  const other = await new SignJWT({ userId: "x", role: "admin" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(env.SESSION_SECRET));
  check("token phiên đăng nhập thường KHÔNG dùng được làm cookie trạng thái", (await readFlowState(other, env)) === null);
  const old = await new SignJWT({ ...st, redirect: "" }).setProtectedHeader({ alg: "HS256" }).setAudience("kin-google-flow").setIssuedAt(Math.floor(Date.now() / 1000) - 1200).setExpirationTime(Math.floor(Date.now() / 1000) - 600).sign(new TextEncoder().encode(env.SESSION_SECRET));
  check("quá 10 phút → null", (await readFlowState(old, env)) === null);

  section("URL Google: PKCE S256, scope tối thiểu, redirect URI");
  const u = new URL(buildAuthUrl({ clientId: CID, redirectUri: "https://x.test/api/auth/google/callback", state: "S", nonce: "N", verifier: "V", authUrl: "https://accounts.google.com/o/oauth2/v2/auth" }));
  check("code_challenge = SHA256(verifier) base64url, method S256", u.searchParams.get("code_challenge") === pkceChallenge("V") && u.searchParams.get("code_challenge_method") === "S256");
  check("scope chỉ 'openid email profile', response_type=code, có state + nonce", u.searchParams.get("scope") === "openid email profile" && u.searchParams.get("response_type") === "code" && u.searchParams.get("state") === "S" && u.searchParams.get("nonce") === "N");
  check("verifier KHÔNG nằm trong URL", !u.toString().includes("verifier") && !u.toString().includes("=V&") );
  check("redirect URI suy từ x-forwarded-host/proto", googleRedirectUri(new Request("http://localhost:3000/x", { headers: { "x-forwarded-host": "midnightelite-edu.com", "x-forwarded-proto": "https" } }), {}) === "https://midnightelite-edu.com/api/auth/google/callback");
  check("GOOGLE_REDIRECT_URI ép được", googleRedirectUri(new Request("http://a/x"), { GOOGLE_REDIRECT_URI: "https://m.test/cb" }) === "https://m.test/cb");

  section("Bật/tắt theo biến môi trường; production không cho đổi địa chỉ Google");
  check("thiếu cả hai → tắt", !googleEnabled({}));
  check("chỉ có ID → tắt", !googleEnabled({ GOOGLE_CLIENT_ID: "a" }));
  check("chỉ có SECRET → tắt", !googleEnabled({ GOOGLE_CLIENT_SECRET: "b" }));
  check("rỗng / toàn khoảng trắng → tắt", !googleEnabled({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "b" }) && !googleEnabled({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }));
  check("có cả hai → bật", googleEnabled({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" }));
  const ov = { GOOGLE_AUTH_URL: "http://fake/auth", GOOGLE_TOKEN_URL: "http://fake/token" };
  check("ngoài production: đổi được (cho test)", googleEndpoints({ ...ov, NODE_ENV: "development" }).token === "http://fake/token");
  const prod = googleEndpoints({ ...ov, NODE_ENV: "production" });
  check("production: bỏ qua đổi, luôn địa chỉ Google thật", prod.auth.startsWith("https://accounts.google.com/") && prod.token === "https://oauth2.googleapis.com/token", prod);

  section("Thông báo lỗi: không tên / email / số tiền");
  const all = Object.values(GOOGLE_NOTICES).map(n => n.title + " " + n.body).join(" ");
  check("mọi mã có câu chữ; không '@', không 'đ'/'xu' kèm số", Object.keys(GOOGLE_NOTICES).length >= 7 && !/@/.test(all) && !/\d+\s*(đ|xu|VND)/i.test(all));
  check("gia sư/quản trị được báo 'đăng nhập bằng mật khẩu'", /đăng nhập bằng mật khẩu/i.test(GOOGLE_NOTICES["password-only"].title));
  await done();
})();
