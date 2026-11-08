// "Tiếp tục với Facebook" — API thật + Postgres thật + FACEBOOK GIẢ (cổng 3198: /token, /me). Server dev cần FACEBOOK_APP_ID=test-app-id FACEBOOK_APP_SECRET=test-app-secret
// FACEBOOK_AUTH_URL=http://localhost:3198/auth FACEBOOK_TOKEN_URL=http://localhost:3198/token FACEBOOK_GRAPH_URL=http://localhost:3198/me (xem env.example.sh).
import http from "node:http";
import { readdirSync, mkdirSync } from "node:fs";
import { BASE, mkUser, mkTutor, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/loginCode";

const APP = "test-app-id", SECRET = "test-app-secret", PORT = 3198;
const RUN = Math.floor(Math.random() * 900000) + 100000;
let n = 0;
const emailOf = () => `fb${RUN}-${++n}@test.local`;

type Scn = { me: Record<string, unknown> | null; tokenFail?: boolean; meFail?: boolean };
const scenarios = new Map<string, Scn>(); // code → hồ sơ
const tokens = new Map<string, Scn>();    // access_token → hồ sơ
const seen: { secret?: string; appId?: string; code?: string; auth?: string; method?: string; querySecret?: boolean }[] = [];
const fake = http.createServer((req, res) => {
  const u = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const json = (code: number, o: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/token") {
    // P2-b: bí mật ứng dụng chỉ được nằm trong THÂN POST; GET / bí mật trong query bị từ chối (như một proxy ghi nhật ký URL sẽ thấy).
    if (req.method !== "POST" || u.searchParams.has("client_secret")) { seen.push({ method: req.method, querySecret: u.searchParams.has("client_secret") }); return json(405, { error: { message: "POST only" } }); }
    let body = ""; req.on("data", d => body += d); req.on("end", () => {
      const p = new URLSearchParams(body);
      const code = p.get("code") ?? "";
      seen.push({ secret: p.get("client_secret") ?? "", appId: p.get("client_id") ?? "", code, method: "POST", querySecret: false });
      const s = scenarios.get(code);
      if (!s || s.tokenFail) return json(400, { error: { message: "bad code" } });
      scenarios.delete(code);
      const at = `at-${code}`; tokens.set(at, s);
      return json(200, { access_token: at, token_type: "bearer" });
    });
    return;
  }
  if (u.pathname === "/me") {
    const at = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    seen.push({ auth: at });
    const s = tokens.get(at);
    if (!s || s.meFail) return json(401, { error: "bad token" });
    return json(200, s.me);
  }
  res.writeHead(404); res.end();
});

const cookieHdr = (r: Response, name: string) => r.headers.getSetCookie().find(c => c.startsWith(name + "="));
const hasSession = (r: Response) => !!cookieHdr(r, "midnight_session");
let ipSeq = 100 + Math.floor(Math.random() * 100);
const ip = () => `10.88.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
async function start(query = "") {
  const r = await fetch(`${BASE}/api/auth/facebook/start${query}`, { redirect: "manual", headers: { "x-forwarded-for": ip() } });
  const loc = r.headers.get("location") ?? ""; const u = loc ? new URL(loc) : null;
  const sc = cookieHdr(r, "kin_facebook");
  return { r, loc, u, setCookie: sc ?? "", cookie: sc?.split(";")[0] ?? "", state: u?.searchParams.get("state") ?? "" };
}
async function flow(me: Record<string, unknown> | null, o: { query?: string; state?: string; noCookie?: boolean; tokenFail?: boolean; meFail?: boolean } = {}) {
  const s = await start(o.query);
  const code = `fcode-${RUN}-${++n}`;
  scenarios.set(code, { me, tokenFail: o.tokenFail, meFail: o.meFail });
  const headers: Record<string, string> = { "x-forwarded-for": ip() };
  if (!o.noCookie) headers.cookie = s.cookie;
  const r = await fetch(`${BASE}/api/auth/facebook/callback?code=${code}&state=${encodeURIComponent(o.state ?? s.state)}`, { redirect: "manual", headers });
  return { r, s, loc: r.headers.get("location") ?? "", code };
}
const path = (loc: string) => { try { const u = new URL(loc); return u.pathname + u.search; } catch { return loc; } };
const mails = () => { try { return readdirSync(process.env.EMAIL_SINK_DIR!).length; } catch { return 0; } };
const fbId = () => `fbid-${RUN}-${++n}`;

(async () => {
  await new Promise<void>(r => fake.listen(PORT, r));
  await wipe();
  try { mkdirSync(process.env.EMAIL_SINK_DIR!, { recursive: true }); } catch { /* */ }

  section("Bắt đầu: state ký trong cookie httpOnly ngắn hạn");
  const s0 = await start("?redirect=/student/nhap-ma-lop");
  check("303 sang Facebook giả với client_id, state, scope email", s0.r.status === 303 && s0.u?.origin === `http://localhost:${PORT}` && s0.u?.searchParams.get("client_id") === APP && s0.state.length >= 30 && /email/.test(s0.u?.searchParams.get("scope") ?? ""), s0.loc);
  check("cookie kin_facebook: HttpOnly, SameSite=Lax, Path hẹp, Max-Age ≤ 600", /HttpOnly/i.test(s0.setCookie) && /SameSite=lax/i.test(s0.setCookie) && /Path=\/api\/auth\/facebook/i.test(s0.setCookie) && Number(/Max-Age=(\d+)/i.exec(s0.setCookie)?.[1]) <= 600, s0.setCookie);
  check("không lộ app secret trong URL", !s0.loc.includes(SECRET));

  section("Email MỚI: tạo học sinh CHƯA xác minh email (Facebook không chứng minh hộp thư), VerifyToken + thư xác minh, ví + xu");
  const m0 = mails(); const e1 = emailOf(); const id1 = fbId();
  const a = await flow({ id: id1, name: "Trần Thị Mai", email: e1 });
  check("303 vào 'Việc của tôi' + cookie phiên HttpOnly", a.r.status === 303 && path(a.loc) === "/student/viec-cua-toi" && hasSession(a.r) && /HttpOnly/i.test(cookieHdr(a.r, "midnight_session")!), [a.r.status, a.loc]);
  check("cookie trạng thái bị xoá (Max-Age=0)", /Max-Age=0/i.test(cookieHdr(a.r, "kin_facebook") ?? ""));
  const u1 = await prisma.user.findUnique({ where: { email: e1 }, include: { wallet: true } });
  check("student, emailVerified=FALSE, facebookId gắn, không googleSub, tên từ Facebook", u1?.role === "student" && u1.emailVerified === false && u1.facebookId === id1 && !u1.googleSub && u1.name === "Trần Thị Mai", u1);
  check("không thu thêm SĐT/trường/ảnh/ngày sinh", !u1?.phone && !u1?.school && !u1?.avatarBase64 && !u1?.dateOfBirth);
  check("ví + đúng 1 dòng xu khởi đầu", !!u1?.wallet && u1.wallet.balance > 0 && (await prisma.coinTransaction.count({ where: { userId: u1.id } })) === 1);
  check("có đúng 1 VerifyToken và 1 thư xác minh (đường của register)", (await prisma.verifyToken.count({ where: { userId: u1!.id } })) === 1 && mails() === m0 + 1, [mails(), m0]);
  check("mật khẩu = băm ngẫu nhiên", /^\$2[aby]\$/.test(u1!.password));
  const sess = cookieHdr(a.r, "midnight_session")!.split(";")[0];
  const me = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie: sess } })).json().catch(() => null);
  check("phiên dùng được (/api/auth/me)", me?.email === e1 && me?.emailVerified === false, me);
  check("đổi mã bằng POST, client_secret chỉ trong thân (không trong query/URL); mọi yêu cầu /token đều như vậy", seen.filter(x => x.method !== undefined).every(x => x.method === "POST" && x.querySecret === false) && seen.some(x => x.method === "POST"), seen.filter(x => x.method !== "POST" && x.method !== undefined));
  check("máy chủ gửi Facebook đúng client_secret; /me dùng Bearer token", seen.some(x => x.secret === SECRET && x.appId === APP && x.code === a.code) && seen.some(x => x.auth === `at-${a.code}`));
  const fp = await fetch(`${BASE}/api/auth/forgot-password`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: e1 }) });
  check("'Quên mật khẩu' vẫn dùng được", fp.status === 200 && (await prisma.passwordResetToken.count({ where: { userId: u1!.id } })) === 1);

  section("Lần sau: khớp theo facebookId, kể cả khi lần này không trả email");
  const b = await flow({ id: id1, name: "Trần Thị Mai" });
  check("vào lại đúng tài khoản dù Facebook không trả email", b.r.status === 303 && hasSession(b.r) && path(b.loc) === "/student/viec-cua-toi", b.loc);
  const b2 = await flow({ id: id1, name: "Mai", email: emailOf() });
  check("Facebook đổi email → vẫn đúng tài khoản cũ, không tạo người mới", hasSession(b2.r) && (await prisma.user.count()) === 1);
  check("vẫn 1 ví, 1 dòng xu", (await prisma.coinTransaction.count({ where: { userId: u1!.id } })) === 1);

  section("Email ĐÃ CÓ tài khoản: KHÔNG tự liên kết");
  const old = await mkUser({ name: "Em Cũ", emailVerified: false });
  const c = await flow({ id: fbId(), name: "Kẻ giả danh", email: old.email });
  const uo = await prisma.user.findUnique({ where: { id: old.id } });
  check("→ /dang-nhap?facebook=email-exists, không phiên", !hasSession(c.r) && path(c.loc) === "/dang-nhap?facebook=email-exists", c.loc);
  check("tài khoản cũ KHÔNG bị gắn facebookId, KHÔNG bị đặt emailVerified, tên giữ nguyên", uo?.facebookId === null && uo.emailVerified === false && uo.name === "Em Cũ", uo);
  section("CA PHÁ: Facebook-rồi-Google — kẻ tấn công tạo tài khoản bằng Facebook với email nạn nhân, nạn nhân vào bằng Google");
  const vEmail = emailOf(); const atkFb = fbId();
  const atkRun = await flow({ id: atkFb, name: "Kẻ tấn công", email: vEmail });
  const atkRow = await prisma.user.findUnique({ where: { email: vEmail } });
  check("kẻ tấn công tạo được tài khoản bằng Facebook nhưng emailVerified=false (không được coi là chủ hộp thư)", hasSession(atkRun.r) && atkRow?.emailVerified === false && atkRow.facebookId === atkFb, atkRow);
  const attackerSess = cookieHdr(atkRun.r, "midnight_session")!.split(";")[0];
  // Google (nạn nhân thật, email_verified) liên kết vào cùng email: dùng đúng luật của resolveSocialUser, không cần máy chủ Google giả.
  const { resolveSocialUser } = await import("@/lib/socialAuth");
  const gv = await resolveSocialUser("google", { id: `g-victim-${RUN}`, email: vEmail, name: "Nạn nhân" });
  const afterG = await prisma.user.findUnique({ where: { email: vEmail } });
  check("Google liên kết được, nhưng facebookId của kẻ tấn công BỊ GỠ", gv.ok && afterG?.googleSub === `g-victim-${RUN}` && afterG.facebookId === null && afterG.emailVerified === true, afterG);
  const again = await flow({ id: atkFb, name: "Kẻ tấn công", email: vEmail });
  check("kẻ tấn công đăng nhập lại bằng Facebook cũ → không phiên (không còn facebookId; email đã có chủ)", !hasSession(again.r) && path(again.loc) === "/dang-nhap?facebook=email-exists", again.loc);
  check("VerifyToken của tài khoản bị xoá khi nối Google", (await prisma.verifyToken.count({ where: { userId: afterG!.id } })) === 0);
  void attackerSess; // phiên JWT đã cấp trước đó KHÔNG thu hồi được (không có cột thu hồi phiên) — giới hạn đã ghi trong mô tả PR

  section("Facebook-rồi-Google trên tài khoản đã xác minh: facebookId của chủ thật được giữ");
  const okU = await mkUser({ name: "Chủ thật", emailVerified: true });
  await prisma.user.update({ where: { id: okU.id }, data: { facebookId: `fb-real-${RUN}` } });
  const gk = await resolveSocialUser("google", { id: `g-real-${RUN}`, email: okU.email, name: "Chủ thật" });
  const okAfter = await prisma.user.findUnique({ where: { id: okU.id } });
  check("giữ facebookId của chủ thật, gắn thêm googleSub", gk.ok && okAfter?.facebookId === `fb-real-${RUN}` && okAfter.googleSub === `g-real-${RUN}`, okAfter);

  const g = await mkUser({ name: "Em Có Google" });
  await prisma.user.update({ where: { id: g.id }, data: { googleSub: `g-${RUN}` } });
  check("học sinh đã gắn Google cũng không bị Facebook chiếm", !hasSession((await flow({ id: fbId(), name: "X", email: g.email })).r));

  section("CA PHÁ (P1-1): kẻ có Facebook tạo tài khoản bằng email nạn nhân; nạn nhân bấm link xác minh email → facebookId BỊ GỠ");
  const v2 = emailOf(); const atkFb2 = fbId();
  const atk2 = await flow({ id: atkFb2, name: "Kẻ tấn công 2", email: v2 });
  const atk2Row = await prisma.user.findUnique({ where: { email: v2 } });
  const vt = await prisma.verifyToken.findFirst({ where: { userId: atk2Row!.id } });
  check("tiền đề: tài khoản do Facebook tạo có facebookId, emailVerified=false, có VerifyToken", hasSession(atk2.r) && atk2Row?.facebookId === atkFb2 && atk2Row.emailVerified === false && !!vt);
  const ve = await fetch(`${BASE}/api/auth/verify-email?token=${vt!.token}`);
  const v2Row = await prisma.user.findUnique({ where: { id: atk2Row!.id } });
  check("xác minh thành công: emailVerified=true và facebookId = null", ve.status === 200 && v2Row?.emailVerified === true && v2Row.facebookId === null, [ve.status, v2Row]);
  check("token xác minh đã bị xoá", (await prisma.verifyToken.count({ where: { userId: atk2Row!.id } })) === 0);
  const atk2Again = await flow({ id: atkFb2, name: "Kẻ tấn công 2", email: v2 });
  check("kẻ tấn công đăng nhập lại bằng Facebook cũ → KHÔNG phiên (email-exists)", !hasSession(atk2Again.r) && path(atk2Again.loc) === "/dang-nhap?facebook=email-exists", atk2Again.loc);

  section("CA PHÁ (P1, đường thứ ba): kẻ có Facebook tạo tài khoản bằng email nạn nhân; nạn nhân xác minh bằng MÃ 6 SỐ → facebookId BỊ GỠ");
  const v3 = emailOf(); const atkFb3 = fbId();
  const atk3 = await flow({ id: atkFb3, name: "Kẻ tấn công 3", email: v3 });
  const atk3Row = await prisma.user.findUnique({ where: { email: v3 } });
  check("tiền đề: có facebookId, emailVerified=false", hasSession(atk3.r) && atk3Row?.facebookId === atkFb3 && atk3Row.emailVerified === false);
  const CODE6 = "483920";
  await prisma.loginCode.deleteMany({ where: { email: `verify:${v3}` } });
  await prisma.loginCode.create({ data: { email: `verify:${v3}`, codeHash: hashCode(`verify:${v3}`, CODE6, process.env.SESSION_SECRET!), expiresAt: new Date(Date.now() + 600_000) } });
  const cf = await fetch(`${BASE}/api/auth/email-verify/confirm`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: v3, code: CODE6 }) });
  const v3Row = await prisma.user.findUnique({ where: { id: atk3Row!.id } });
  check("mã 6 số đúng: 200, emailVerified=true và facebookId = null, googleSub = null", cf.status === 200 && v3Row?.emailVerified === true && v3Row.facebookId === null && v3Row.googleSub === null, [cf.status, v3Row]);
  const atk3Again = await flow({ id: atkFb3, name: "Kẻ tấn công 3", email: v3 });
  check("kẻ tấn công đăng nhập lại bằng Facebook cũ → KHÔNG phiên (email-exists)", !hasSession(atk3Again.r) && path(atk3Again.loc) === "/dang-nhap?facebook=email-exists", atk3Again.loc);
  const real = await mkUser({ name: "Chủ thật đã xác minh" });
  await prisma.user.update({ where: { id: real.id }, data: { facebookId: `fb-real3-${RUN}`, emailVerified: true } });
  await prisma.loginCode.create({ data: { email: `verify:${real.email}`, codeHash: hashCode(`verify:${real.email}`, CODE6, process.env.SESSION_SECRET!), expiresAt: new Date(Date.now() + 600_000) } });
  await fetch(`${BASE}/api/auth/email-verify/confirm`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: real.email, code: CODE6 }) });
  check("tài khoản ĐÃ xác minh từ trước: mã 6 số không gỡ facebookId của chủ thật (điều kiện emailVerified:false)", (await prisma.user.findUnique({ where: { id: real.id } }))?.facebookId === `fb-real3-${RUN}`);

  section("Gia sư / quản trị / đơn gia sư / khoá");
  const T = await mkTutor("Cô Lan"), A = await mkSuper("Quản trị"), P = await mkUser({ name: "Chờ duyệt" }), B = await mkUser({ name: "Bị khoá" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date() } });
  await prisma.user.update({ where: { id: B.id }, data: { banned: true } });
  for (const [label, who, want] of [["gia sư", T, "email-exists"], ["quản trị", A, "email-exists"], ["học sinh có đơn gia sư", P, "email-exists"], ["học sinh bị khoá", B, "email-exists"]] as const) {
    const x = await flow({ id: fbId(), name: "X", email: who.email });
    const after = await prisma.user.findUnique({ where: { id: who.id } });
    check(`${label}: email trùng, chưa liên kết → bị từ chối, không phiên, không gắn facebookId`, !hasSession(x.r) && path(x.loc).startsWith("/dang-nhap?facebook=") && after?.facebookId === null && want.length > 0, x.loc);
  }
  const lt = await mkUser({ name: "Từng là học sinh, đã liên kết Facebook" }); const ltId = fbId();
  await prisma.user.update({ where: { id: lt.id }, data: { facebookId: ltId } });
  await prisma.user.update({ where: { id: lt.id }, data: { role: "admin", adminRole: "teacher", tutorVerified: true } });
  const l1 = await flow({ id: ltId, name: "X" });
  check("đã liên kết Facebook nhưng nay là gia sư → 'password-only'", !hasSession(l1.r) && path(l1.loc) === "/dang-nhap?facebook=password-only", l1.loc);
  await prisma.user.update({ where: { id: lt.id }, data: { role: "student", adminRole: null, tutorVerified: false, banned: true } });
  const l2 = await flow({ id: ltId, name: "X" });
  check("đã liên kết Facebook nhưng nay bị khoá → 'banned'", !hasSession(l2.r) && path(l2.loc) === "/dang-nhap?facebook=banned", l2.loc);

  section("Không có email");
  const ne = await flow({ id: fbId(), name: "Không email" });
  check("→ 'no-email', không tạo tài khoản, không phiên", !hasSession(ne.r) && path(ne.loc) === "/dang-nhap?facebook=no-email" && (await prisma.user.count({ where: { name: "Không email" } })) === 0, ne.loc);
  const ne2 = await flow({ id: fbId(), name: "Email rỗng", email: "" });
  check("email chuỗi rỗng cũng coi là không có", path(ne2.loc) === "/dang-nhap?facebook=no-email");

  section("CSRF và lỗi từ Facebook");
  const cs = emailOf();
  const x1 = await flow({ id: fbId(), name: "S", email: cs }, { state: "state-gia-mao" });
  check("state sai → 'failed', KHÔNG đổi mã, không tạo", !hasSession(x1.r) && path(x1.loc) === "/dang-nhap?facebook=failed" && !seen.some(t => t.code === x1.code) && (await prisma.user.count({ where: { email: cs } })) === 0);
  const x2 = await flow({ id: fbId(), name: "S", email: cs }, { noCookie: true });
  check("không có cookie trạng thái → 'failed', không đổi mã", !hasSession(x2.r) && !seen.some(t => t.code === x2.code) && (await prisma.user.count({ where: { email: cs } })) === 0);
  const o = await start();
  const x3 = await fetch(`${BASE}/api/auth/facebook/callback?code=zzz&state=${o.state}`, { redirect: "manual", headers: { cookie: o.cookie.replace(/.$/, c => (c === "A" ? "B" : "A")), "x-forwarded-for": ip() } });
  check("cookie bị sửa chữ ký → 'failed'", !hasSession(x3) && path(x3.headers.get("location") ?? "") === "/dang-nhap?facebook=failed");
  const gck = await (await fetch(`${BASE}/api/auth/google/start`, { redirect: "manual", headers: { "x-forwarded-for": ip() } })).headers.getSetCookie().find(c => c.startsWith("kin_google="));
  if (gck) {
    const x4 = await fetch(`${BASE}/api/auth/facebook/callback?code=zzz&state=${o.state}`, { redirect: "manual", headers: { cookie: `kin_facebook=${gck.split(";")[0].slice("kin_google=".length)}`, "x-forwarded-for": ip() } });
    check("cookie của Google đem sang Facebook → 'failed'", !hasSession(x4) && path(x4.headers.get("location") ?? "") === "/dang-nhap?facebook=failed");
  }
  const x5 = await fetch(`${BASE}/api/auth/facebook/callback?error=access_denied&state=${o.state}`, { redirect: "manual", headers: { cookie: o.cookie, "x-forwarded-for": ip() } });
  check("bấm Hủy ở Facebook → 'cancelled'", !hasSession(x5) && path(x5.headers.get("location") ?? "") === "/dang-nhap?facebook=cancelled");
  const x6 = await fetch(`${BASE}/api/auth/facebook/callback`, { redirect: "manual", headers: { "x-forwarded-for": ip() } });
  check("gọi thẳng callback không tham số → 'failed'", !hasSession(x6) && path(x6.headers.get("location") ?? "") === "/dang-nhap?facebook=failed");
  const t1 = await flow({ id: fbId(), name: "T", email: emailOf() }, { tokenFail: true });
  check("Facebook /token lỗi → 'failed'", !hasSession(t1.r) && path(t1.loc) === "/dang-nhap?facebook=failed");
  const t2 = await flow({ id: fbId(), name: "T", email: emailOf() }, { meFail: true });
  check("Graph /me lỗi → 'failed'", !hasSession(t2.r) && path(t2.loc) === "/dang-nhap?facebook=failed");
  const t3 = await flow({ name: "Thiếu id", email: emailOf() });
  check("Graph không có id → 'failed', không tạo", !hasSession(t3.r) && path(t3.loc) === "/dang-nhap?facebook=failed");

  section("Chuyển hướng an toàn; cửa quản trị; bật/tắt");
  const r1 = await flow({ id: fbId(), name: "R", email: emailOf() }, { query: "?redirect=/student/nhap-ma-lop" });
  check("đường nội bộ giữ", path(r1.loc) === "/student/nhap-ma-lop", r1.loc);
  const r2 = await flow({ id: fbId(), name: "R", email: emailOf() }, { query: "?redirect=//evil.example/x" });
  const r3 = await flow({ id: fbId(), name: "R", email: emailOf() }, { query: "?redirect=https://evil.example" });
  check("//evil.example và https://evil.example bị bỏ → trang mặc định", path(r2.loc) === "/student/viec-cua-toi" && path(r3.loc) === "/student/viec-cua-toi" && !r2.loc.includes("evil") && !r3.loc.includes("evil"), [r2.loc, r3.loc]);
  const ah = await new Promise<{ loc: string; cookie: string }>(res => http.get(`${BASE}/api/auth/facebook/start`, { headers: { host: "admin.midnightelite-edu.com", "x-forwarded-for": ip() } }, r => { res({ loc: String(r.headers.location ?? ""), cookie: String(r.headers["set-cookie"] ?? "") }); r.resume(); }));
  check("cửa quản trị không nhận Facebook, không cookie", path(ah.loc) === "/dang-nhap?facebook=wrong-host" && !ah.cookie.includes("kin_facebook"), ah);
  const en = await (await fetch(`${BASE}/api/auth/facebook/enabled`)).json();
  check("/enabled trả {facebook:true}, không lộ giá trị", JSON.stringify(en) === '{"facebook":true}');

  section("Song song cùng email mới: một tài khoản, một ví");
  const rc = emailOf(); const rid = fbId();
  const pr = await Promise.all([0, 1, 2].map(() => flow({ id: rid, name: "Đua", email: rc })));
  check("không lượt nào 500; có phiên", pr.every(x => x.r.status === 303) && pr.some(x => hasSession(x.r)), pr.map(x => x.loc));
  const ru = await prisma.user.findMany({ where: { email: rc }, include: { wallet: true } });
  check("đúng 1 User, 1 ví, 1 dòng xu", ru.length === 1 && !!ru[0].wallet && (await prisma.coinTransaction.count({ where: { userId: ru[0].id } })) === 1, ru.length);

  fake.close();
  await done();
})();
