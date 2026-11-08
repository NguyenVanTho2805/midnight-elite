// "Tiếp tục với Facebook" — phần THUẦN: luật quyết định dùng chung (provider google|facebook), đọc Graph /me, URL, bật/tắt, cookie không dùng chéo nhà.
import { check, section, done } from "./h";
import { decideSocialSignIn, readFlow, signFlow, SOCIAL_NOTICES, type ExistingUser, type Provider } from "@/lib/socialAuth";
import { buildFacebookAuthUrl, facebookEnabled, facebookEndpoints, facebookRedirectUri, profileFromGraph } from "@/lib/facebookAuth";

const env = { SESSION_SECRET: "test-secret-test-secret-test-secret-123456" };
const U = (o: Partial<ExistingUser> = {}): ExistingUser => ({ id: "u1", role: "student", adminRole: null, banned: false, deletedAt: null, tutorAppliedAt: null, tutorVerified: false, linkedId: null, ...o });
const dec = (provider: Provider, email: string | null, bySub: ExistingUser | null, byEmail: ExistingUser | null) => decideSocialSignIn({ provider, id: "fb1", email, bySub, byEmail });
const reason = (d: ReturnType<typeof dec>) => (d.kind === "deny" ? d.reason : d.kind);

(async () => {
  section("Facebook: email mới tạo; email đã có KHÔNG tự liên kết");
  check("email chưa có → tạo học sinh", dec("facebook", "a@b.c", null, null).kind === "create");
  check("email trùng HỌC SINH cũ, chưa liên kết → 'email-exists' (không vào, không gắn)", reason(dec("facebook", "a@b.c", null, U())) === "email-exists");
  check("email trùng học sinh đã gắn Google → vẫn 'email-exists'", reason(dec("facebook", "a@b.c", null, U({ linkedId: null }))) === "email-exists");
  check("email trùng gia sư → 'password-only' (không lộ khác biệt nào hơn mức cần)", reason(dec("facebook", "a@b.c", null, U({ role: "admin", adminRole: "teacher" }))) === "password-only");
  check("email trùng quản trị → 'password-only'", reason(dec("facebook", "a@b.c", null, U({ role: "admin", adminRole: "admin_super" }))) === "password-only");
  check("email trùng người bị khoá → 'banned'", reason(dec("facebook", "a@b.c", null, U({ banned: true }))) === "banned");
  check("KHÔNG có email, chưa liên kết → 'no-email'", reason(dec("facebook", null, null, null)) === "no-email");
  const again = dec("facebook", null, U({ linkedId: "fb1" }), null);
  check("facebookId đã khớp → vào được, kể cả khi lần này Facebook không trả email", again.kind === "login" && again.link === false, again);
  check("facebookId khớp nhưng email Facebook đã đổi sang email người khác → vẫn vào đúng tài khoản đã liên kết", dec("facebook", "khac@b.c", U({ linkedId: "fb1" }), U({ id: "u2" })).kind === "login");
  check("facebookId khớp nhưng tài khoản bị khoá → 'banned'", reason(dec("facebook", "a@b.c", U({ linkedId: "fb1", banned: true }), null)) === "banned");
  check("facebookId khớp nhưng tài khoản đã thành gia sư → 'password-only'", reason(dec("facebook", "a@b.c", U({ linkedId: "fb1", role: "admin", adminRole: "teacher" }), null)) === "password-only");
  check("facebookId khớp nhưng có đơn gia sư → 'password-only'", reason(dec("facebook", "a@b.c", U({ linkedId: "fb1", tutorAppliedAt: new Date() }), null)) === "password-only");
  check("tài khoản đã ẩn (deletedAt) → 'banned'", reason(dec("facebook", "a@b.c", null, U({ deletedAt: new Date() }))) === "banned");

  section("Google (cùng hàm): vẫn như cũ");
  const g1 = dec("google", "a@b.c", null, U());
  check("Google + email trùng học sinh → vào + gắn", g1.kind === "login" && g1.link === true);
  check("Google + email trùng học sinh đã gắn Google khác → 'sub-mismatch'", reason(dec("google", "a@b.c", null, U({ linkedId: "x" }))) === "sub-mismatch");
  check("Google + gia sư → 'password-only'", reason(dec("google", "a@b.c", null, U({ role: "admin", adminRole: "teacher" }))) === "password-only");
  check("Google không có email, chưa liên kết → 'no-email'", reason(dec("google", null, null, null)) === "no-email");

  section("profileFromGraph");
  const p = profileFromGraph({ id: "123", name: " Lê Văn An ", email: " AN@Gmail.com " });
  check("id, tên cắt khoảng trắng, email chữ thường", p?.id === "123" && p.name === "Lê Văn An" && p.email === "an@gmail.com", p);
  check("không có email → email=null (không bịa)", profileFromGraph({ id: "1", name: "A" })?.email === null);
  check("email không có @ → null", profileFromGraph({ id: "1", name: "A", email: "x" })?.email === null);
  check("thiếu id / không phải object → null", profileFromGraph({ name: "A" }) === null && profileFromGraph(null) === null && profileFromGraph("x") === null && profileFromGraph({ id: 5 }) === null);
  check("id là số (không phải chuỗi) bị từ chối — Graph luôn trả chuỗi", profileFromGraph({ id: 123 }) === null);

  section("URL Facebook, redirect URI, bật/tắt");
  const u = new URL(buildFacebookAuthUrl({ appId: "APP", redirectUri: "https://x.test/api/auth/facebook/callback", state: "S", authUrl: "https://www.facebook.com/v19.0/dialog/oauth" }));
  check("có state, response_type=code, scope email,public_profile; không lộ secret", u.searchParams.get("state") === "S" && u.searchParams.get("response_type") === "code" && u.searchParams.get("scope") === "email,public_profile" && !u.toString().includes("secret"));
  check("redirect URI suy từ x-forwarded-*", facebookRedirectUri(new Request("http://localhost/x", { headers: { "x-forwarded-host": "midnightelite-edu.com", "x-forwarded-proto": "https" } }), {}) === "https://midnightelite-edu.com/api/auth/facebook/callback");
  check("thiếu một trong hai biến → tắt", !facebookEnabled({}) && !facebookEnabled({ FACEBOOK_APP_ID: "a" }) && !facebookEnabled({ FACEBOOK_APP_SECRET: "b" }) && !facebookEnabled({ FACEBOOK_APP_ID: " ", FACEBOOK_APP_SECRET: "b" }));
  check("đủ hai biến → bật", facebookEnabled({ FACEBOOK_APP_ID: "a", FACEBOOK_APP_SECRET: "b" }));
  const ov = { FACEBOOK_AUTH_URL: "http://f/auth", FACEBOOK_TOKEN_URL: "http://f/token", FACEBOOK_GRAPH_URL: "http://f/me" };
  check("ngoài production đổi được", facebookEndpoints({ ...ov, NODE_ENV: "test" }).me === "http://f/me");
  const prod = facebookEndpoints({ ...ov, NODE_ENV: "production" });
  check("production luôn là địa chỉ Facebook thật", prod.auth.startsWith("https://www.facebook.com/") && prod.token.startsWith("https://graph.facebook.com/") && prod.me.startsWith("https://graph.facebook.com/"), prod);

  section("Cookie trạng thái không dùng chéo nhà");
  const st = { state: "s", nonce: "-", verifier: "-", redirect: null };
  const tf = await signFlow("facebook", st, env);
  check("cookie Facebook đọc lại đúng", (await readFlow("facebook", tf, env))?.state === "s");
  check("cookie Facebook KHÔNG đọc được như cookie Google (và ngược lại)", (await readFlow("google", tf, env)) === null && (await readFlow("facebook", await signFlow("google", st, env), env)) === null);

  section("Thông báo");
  const t = SOCIAL_NOTICES;
  check("'email-exists' nói đăng nhập bằng mật khẩu hoặc Google; 'no-email' nói rõ lý do", /mật khẩu hoặc Google/.test(t["email-exists"].body) && /email/i.test(t["no-email"].title));
  check("không thông báo nào chứa '@' hay số tiền", !Object.values(t).some(n => /@|\d+\s*(đ|xu|VND)/i.test(n.title + n.body)));
  await done();
})();
