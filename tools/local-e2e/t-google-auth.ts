// "Tiếp tục với Google" — API thật + Postgres thật + GOOGLE GIẢ (máy chủ http cục bộ cổng 3199, không gọi mạng ngoài).
// Server dev phải chạy với: GOOGLE_CLIENT_ID=test-client-id GOOGLE_CLIENT_SECRET=test-client-secret GOOGLE_AUTH_URL=http://localhost:3199/auth GOOGLE_TOKEN_URL=http://localhost:3199/token (xem env.example.sh).
import http from "node:http";
import { createHash } from "node:crypto";
import { readdirSync, mkdirSync } from "node:fs";
import { BASE, mkUser, mkTutor, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { resolveSocialUser } from "@/lib/socialAuth";

const CID = "test-client-id", SECRET = "test-client-secret", PORT = 3199;
const RUN = Math.floor(Math.random() * 900000) + 100000;
let n = 0;
const emailOf = () => `gg${RUN}-${++n}@test.local`;

// ── Google giả: /token đổi "code" lấy id_token do test soạn sẵn; ghi lại những gì máy chủ gửi để kiểm PKCE + client_secret.
type Scn = { claims?: Record<string, unknown>; fail?: boolean };
const scenarios = new Map<string, Scn>();
const seenToken: { code?: string; verifier?: string; secret?: string; clientId?: string; redirectUri?: string }[] = [];
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fake = http.createServer((req, res) => {
  if (req.url === "/token" && req.method === "POST") {
    let body = ""; req.on("data", d => body += d); req.on("end", () => {
      const p = new URLSearchParams(body);
      seenToken.push({ code: p.get("code") ?? "", verifier: p.get("code_verifier") ?? "", secret: p.get("client_secret") ?? "", clientId: p.get("client_id") ?? "", redirectUri: p.get("redirect_uri") ?? "" });
      const s = scenarios.get(p.get("code") ?? "");
      if (!s || s.fail) { res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"invalid_grant"}'); return; }
      scenarios.delete(p.get("code") ?? ""); // mã dùng một lần như Google thật
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ access_token: "x", id_token: `${b64({ alg: "RS256" })}.${b64(s.claims)}.sig` }));
    });
  } else { res.writeHead(404); res.end(); }
});

const cookieHdr = (r: Response, name: string) => r.headers.getSetCookie().find(c => c.startsWith(name + "="));
const hasSession = (r: Response) => !!cookieHdr(r, "midnight_session");
let ipSeq = Math.floor(Math.random() * 200);
const ip = () => `10.77.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
async function start(query = "") {
  const r = await fetch(`${BASE}/api/auth/google/start${query}`, { redirect: "manual", headers: { "x-forwarded-for": ip() } });
  const loc = r.headers.get("location") ?? "";
  const u = loc ? new URL(loc) : null;
  const cookie = cookieHdr(r, "kin_google");
  return { r, loc, u, cookie: cookie?.split(";")[0] ?? "", setCookie: cookie ?? "", state: u?.searchParams.get("state") ?? "", nonce: u?.searchParams.get("nonce") ?? "", challenge: u?.searchParams.get("code_challenge") ?? "" };
}
/** Một lượt đầy đủ: start → (Google giả) → callback. `claims` ghi đè các claim; `tamper` sửa state/cookie. */
async function flow(claims: Record<string, unknown>, o: { query?: string; state?: string; noCookie?: boolean; badToken?: boolean; host?: string } = {}) {
  const s = await start(o.query);
  const code = `code-${RUN}-${++n}`;
  scenarios.set(code, { fail: o.badToken, claims: { iss: "https://accounts.google.com", aud: CID, exp: Math.floor(Date.now() / 1000) + 600, nonce: s.nonce, sub: `sub-${RUN}-${n}`, email_verified: true, ...claims } });
  const headers: Record<string, string> = { "x-forwarded-for": ip() };
  if (!o.noCookie) headers.cookie = s.cookie;
  if (o.host) headers.host = o.host;
  const r = await fetch(`${BASE}/api/auth/google/callback?code=${code}&state=${encodeURIComponent(o.state ?? s.state)}`, { redirect: "manual", headers });
  return { r, s, loc: r.headers.get("location") ?? "", code };
}
const path = (loc: string) => { try { const u = new URL(loc); return u.pathname + u.search; } catch { return loc; } };
const mails = () => { try { return readdirSync(process.env.EMAIL_SINK_DIR!).length; } catch { return 0; } };

(async () => {
  await new Promise<void>(r => fake.listen(PORT, r));
  await wipe();
  try { mkdirSync(process.env.EMAIL_SINK_DIR!, { recursive: true }); } catch { /* */ }

  section("Bắt đầu: chuyển sang Google với PKCE + cookie httpOnly ngắn hạn");
  const s0 = await start("?redirect=/student/nhap-ma-lop");
  check("303 sang địa chỉ Google giả, có state + nonce + code_challenge S256", s0.r.status === 303 && s0.u?.origin === `http://localhost:${PORT}` && s0.state.length >= 30 && s0.nonce.length >= 30 && s0.u?.searchParams.get("code_challenge_method") === "S256", s0.loc);
  check("client_id đúng, scope tối thiểu, redirect_uri trỏ /api/auth/google/callback", s0.u?.searchParams.get("client_id") === CID && s0.u?.searchParams.get("scope") === "openid email profile" && /\/api\/auth\/google\/callback$/.test(s0.u?.searchParams.get("redirect_uri") ?? ""), s0.loc);
  check("cookie kin_google: HttpOnly, SameSite=Lax, Path hẹp, Max-Age ≤ 600", /HttpOnly/i.test(s0.setCookie) && /SameSite=lax/i.test(s0.setCookie) && /Path=\/api\/auth\/google/i.test(s0.setCookie) && Number(/Max-Age=(\d+)/i.exec(s0.setCookie)?.[1]) <= 600, s0.setCookie);
  check("không lộ client_secret trong URL", !s0.loc.includes(SECRET));
  const s1 = await start();
  check("hai lượt cho state/nonce khác nhau", s1.state !== s0.state && s1.nonce !== s0.nonce);

  section("Email MỚI: tạo học sinh, đã xác thực, không thư, ví + xu như đăng ký thường");
  const mailsBefore = mails();
  const e1 = emailOf();
  const a = await flow({ email: e1, name: "Nguyễn Thị Hoa" });
  check("303 vào 'Việc của tôi' + cookie phiên midnight_session (HttpOnly)", a.r.status === 303 && path(a.loc) === "/student/viec-cua-toi" && hasSession(a.r) && /HttpOnly/i.test(cookieHdr(a.r, "midnight_session")!), [a.r.status, a.loc]);
  check("cookie trạng thái bị xoá sau khi dùng (Max-Age=0)", /Max-Age=0/i.test(cookieHdr(a.r, "kin_google") ?? ""));
  const u1 = await prisma.user.findUnique({ where: { email: e1 }, include: { wallet: true } });
  check("User role student, emailVerified=true, có googleSub, tên từ Google", u1?.role === "student" && u1.emailVerified === true && !!u1.googleSub && u1.name === "Nguyễn Thị Hoa" && !u1.adminRole, u1);
  check("KHÔNG thu thêm dữ liệu: không SĐT/trường/ảnh/ngày sinh", !u1?.phone && !u1?.school && !u1?.avatarBase64 && !u1?.dateOfBirth && !u1?.city);
  check("có ví + đúng MỘT dòng xu khởi đầu (cùng số như /api/auth/register)", !!u1?.wallet && (await prisma.coinTransaction.count({ where: { userId: u1!.id } })) === 1 && (await prisma.coinTransaction.findFirst({ where: { userId: u1!.id } }))?.amount === u1!.wallet!.balance && u1!.wallet!.balance > 0);
  check("KHÔNG có VerifyToken", (await prisma.verifyToken.count({ where: { userId: u1!.id } })) === 0);
  check("KHÔNG gửi thư nào (thư mục thư thử không thêm tệp)", mails() === mailsBefore, [mailsBefore, mails()]);
  check("mật khẩu là băm bcrypt ngẫu nhiên (cột bắt buộc có giá trị)", /^\$2[aby]\$/.test(u1!.password));
  const me = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: cookieHdr(a.r, "midnight_session")!.split(";")[0] } });
  const meJ = await me.json().catch(() => null);
  check("phiên dùng được: /api/auth/me trả đúng người, emailVerified=true", me.status === 200 && meJ?.email === e1 && meJ?.emailVerified === true, meJ);
  const g1 = a.s.u && seenToken.at(-1);
  check("máy chủ gửi Google: đúng client_secret, code_verifier khớp code_challenge (PKCE)", g1?.secret === SECRET && g1?.clientId === CID && createHash("sha256").update(g1?.verifier ?? "").digest("base64url") === a.s.challenge, g1);

  section("Quên mật khẩu vẫn dùng được với tài khoản chỉ-Google");
  const fp = await fetch(`${BASE}/api/auth/forgot-password`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: e1 }) });
  check("200 và tạo link đặt lại (PasswordResetToken)", fp.status === 200 && (await prisma.passwordResetToken.count({ where: { userId: u1!.id } })) === 1, fp.status);
  const pw = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ identifier: e1, password: "bat-ky-mat-khau" }) });
  check("đăng nhập bằng mật khẩu đoán bừa → 401 (băm ngẫu nhiên, không ai biết)", pw.status === 401);

  section("Lần sau: khớp theo sub, không tạo trùng, không tặng xu lần hai");
  const b = await flow({ email: e1, sub: u1!.googleSub });
  check("vào lại đúng tài khoản", b.r.status === 303 && hasSession(b.r) && path(b.loc) === "/student/viec-cua-toi");
  check("vẫn 1 tài khoản, 1 ví, 1 dòng xu", (await prisma.user.count({ where: { email: e1 } })) === 1 && (await prisma.coinTransaction.count({ where: { userId: u1!.id } })) === 1);
  const e1b = emailOf();
  const bb = await flow({ email: e1b, sub: u1!.googleSub });
  check("sub đã liên kết, Google đổi email → vẫn vào đúng tài khoản cũ, không tạo người mới", hasSession(bb.r) && (await prisma.user.count({ where: { email: e1b } })) === 0);

  section("Học sinh CÓ SẴN (chưa xác thực email): vào được, đặt emailVerified=true, gắn sub");
  const old = await mkUser({ name: "Em Cũ", emailVerified: false });
  await prisma.verifyToken.create({ data: { token: `vt-${RUN}`, userId: old.id, expiresAt: new Date(Date.now() + 3600_000) } });
  const walletBefore = await prisma.wallet.count({ where: { userId: old.id } });
  const c = await flow({ email: old.email.toUpperCase(), sub: `sub-old-${RUN}` });
  const uo = await prisma.user.findUnique({ where: { id: old.id } });
  check("303 vào Việc của tôi + phiên", c.r.status === 303 && path(c.loc) === "/student/viec-cua-toi" && hasSession(c.r), c.loc);
  check("emailVerified=true, googleSub gắn, tên KHÔNG bị ghi đè", uo?.emailVerified === true && uo.googleSub === `sub-old-${RUN}` && uo.name === "Em Cũ", uo);
  check("không tạo thêm ví/xu cho tài khoản cũ", (await prisma.wallet.count({ where: { userId: old.id } })) === walletBefore && (await prisma.coinTransaction.count({ where: { userId: old.id } })) === 0);
  const c2 = await flow({ email: old.email, sub: "sub-khac" });
  check("email đã gắn Google KHÁC → từ chối 'sub-mismatch', không phiên", !hasSession(c2.r) && path(c2.loc) === "/dang-nhap?google=sub-mismatch", c2.loc);

  section("CA PHÁ: kẻ đăng ký trước bằng email nạn nhân (emailVerified=false + mật khẩu + facebookId) → nạn nhân vào bằng Google");
  const atk = await mkUser({ name: "Kẻ chiếm trước", emailVerified: false }); // mật khẩu "Passw0rd!" do kẻ đó đặt
  await prisma.user.update({ where: { id: atk.id }, data: { facebookId: `fb-atk-${RUN}`, phone: "0901234567", phoneE164: `+8490${RUN}`, phoneVerifiedAt: new Date(), parentPhone: "0911111111", parentName: "Kẻ gian", school: "Trường kẻ gian", highSchool: "THPT kẻ gian", zaloPhone: "0922222222" } });
  const atkParent = await mkUser({ name: "Phụ huynh do kẻ gian dựng" });
  await prisma.parentLink.create({ data: { parentId: atkParent.id, studentId: atk.id, status: "verified", verifiedAt: new Date(), portalToken: `ptok-${RUN}` } });
  await prisma.verifyToken.create({ data: { token: `vt-atk-${RUN}`, userId: atk.id, expiresAt: new Date(Date.now() + 3600_000) } });
  await prisma.passwordResetToken.create({ data: { token: `pr-atk-${RUN}`, userId: atk.id, expiresAt: new Date(Date.now() + 3600_000) } });
  const oldHash = (await prisma.user.findUnique({ where: { id: atk.id } }))!.password;
  const loginBefore = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: atk.email, password: "Passw0rd!" }) });
  check("trước khi nạn nhân vào: kẻ chiếm trước đăng nhập được bằng mật khẩu của hắn (xác nhận lỗ hổng có thật)", loginBefore.status === 200, loginBefore.status);
  const vic = await flow({ email: atk.email, sub: `sub-victim-${RUN}` });
  const ua = await prisma.user.findUnique({ where: { id: atk.id } });
  check("nạn nhân vào được bằng Google, emailVerified=true, googleSub gắn", hasSession(vic.r) && ua?.emailVerified === true && ua.googleSub === `sub-victim-${RUN}`, [vic.loc, ua?.emailVerified]);
  const loginAfter = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: atk.email, password: "Passw0rd!" }) });
  check("mật khẩu cũ của kẻ chiếm trước KHÔNG đăng nhập được nữa", loginAfter.status === 401 || loginAfter.status === 400 || loginAfter.status === 403, loginAfter.status);
  check("mật khẩu đã đổi sang băm bcrypt khác băm của kẻ chiếm trước", /^\$2[aby]\$/.test(ua!.password) && ua!.password !== oldHash, ua!.password);
  check("VerifyToken + PasswordResetToken cũ bị xoá", (await prisma.verifyToken.count({ where: { userId: atk.id } })) === 0 && (await prisma.passwordResetToken.count({ where: { userId: atk.id } })) === 0);
  check("facebookId của kẻ chiếm trước bị gỡ", ua?.facebookId === null, ua?.facebookId);
  check("số điện thoại (kể cả số đã xác minh SMS) + tên phụ huynh + trường kẻ chiếm trước điền bị xoá", !!ua && ua.phone === null && ua.phoneE164 === null && ua.phoneVerifiedAt === null && ua.parentPhone === null && ua.parentName === null && ua.school === null && ua.highSchool === null && ua.zaloPhone === null, ua);
  const pl = await prisma.parentLink.findFirst({ where: { studentId: atk.id } });
  check("liên kết phụ huynh do kẻ chiếm trước dựng bị thu hồi, link xem sổ không cần đăng nhập bị gỡ", pl?.status === "revoked" && pl.portalToken === null, pl);
  const sameAgain = await flow({ email: atk.email, sub: `sub-victim-${RUN}` });
  check("lần Google sau (đã liên kết) vẫn vào, mật khẩu không bị đổi lần nữa", hasSession(sameAgain.r) && (await prisma.user.findUnique({ where: { id: atk.id } }))!.password === ua!.password);

  section("Tài khoản ĐÃ xác minh email + có mật khẩu: Google vào KHÔNG đổi mật khẩu, không gỡ facebookId");
  const okAcc = await mkUser({ name: "Đã xác minh", emailVerified: true });
  await prisma.user.update({ where: { id: okAcc.id }, data: { facebookId: `fb-ok-${RUN}` } });
  const before = await prisma.user.findUnique({ where: { id: okAcc.id } });
  const okFlow = await flow({ email: okAcc.email, sub: `sub-ok-${RUN}` });
  const after = await prisma.user.findUnique({ where: { id: okAcc.id } });
  check("vào được; mật khẩu và facebookId giữ nguyên", hasSession(okFlow.r) && after?.password === before?.password && after?.facebookId === `fb-ok-${RUN}`, after);
  const loginOk = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: okAcc.email, password: "Passw0rd!" }) });
  check("mật khẩu cũ của chủ thật vẫn đăng nhập được", loginOk.status === 200, loginOk.status);

  section("Gia sư / quản trị / đơn gia sư: KHÔNG vào bằng Google");
  const T = await mkTutor("Cô Lan"), A = await mkSuper("Quản trị"), P = await mkUser({ name: "Chờ duyệt" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date() } });
  for (const [label, who] of [["gia sư", T], ["quản trị super", A], ["học sinh có đơn gia sư", P]] as const) {
    const x = await flow({ email: who.email });
    const after = await prisma.user.findUnique({ where: { id: who.id } });
    check(`${label} → /dang-nhap?google=password-only, không phiên`, !hasSession(x.r) && path(x.loc) === "/dang-nhap?google=password-only", x.loc);
    check(`${label}: không bị gắn googleSub, không đổi vai`, after?.googleSub === null && after.role === who.role);
  }
  const tw = await flow({ email: T.email, sub: `sub-t-${RUN}` });
  check("gia sư KHÔNG bị đăng nhập dù Google trả email_verified=true (chống chiếm quyền)", !hasSession(tw.r));

  section("Học sinh bị khoá / ẩn");
  const B = await mkUser({ name: "Bị khoá" });
  await prisma.user.update({ where: { id: B.id }, data: { banned: true } });
  const bx = await flow({ email: B.email });
  check("→ /dang-nhap?google=banned, không phiên", !hasSession(bx.r) && path(bx.loc) === "/dang-nhap?google=banned", bx.loc);
  const hid = await mkUser({ name: "Đã ẩn" });
  await prisma.user.update({ where: { id: hid.id }, data: { deletedAt: new Date(), banned: true } });
  check("học sinh đã ẩn cũng bị từ chối", !hasSession((await flow({ email: hid.email })).r));

  section("Google chưa xác nhận email / claim sai");
  const ev = emailOf();
  const u = await flow({ email: ev, email_verified: false });
  check("email_verified=false → 'unverified', KHÔNG tạo tài khoản, không phiên", !hasSession(u.r) && path(u.loc) === "/dang-nhap?google=unverified" && (await prisma.user.count({ where: { email: ev } })) === 0, u.loc);
  const ev2 = emailOf();
  const u2 = await flow({ email: ev2, email_verified: undefined });
  check("thiếu email_verified → không tạo tài khoản", !hasSession(u2.r) && (await prisma.user.count({ where: { email: ev2 } })) === 0);
  const wn = emailOf();
  const u3 = await flow({ email: wn, nonce: "nonce-gia" });
  check("nonce trong id_token không khớp cookie → 'failed', không tạo", !hasSession(u3.r) && path(u3.loc) === "/dang-nhap?google=failed" && (await prisma.user.count({ where: { email: wn } })) === 0);
  const wa = emailOf();
  const u4 = await flow({ email: wa, aud: "client-khac" });
  check("aud là client khác → không tạo", !hasSession(u4.r) && (await prisma.user.count({ where: { email: wa } })) === 0);
  const we = emailOf();
  const u5 = await flow({ email: we, exp: Math.floor(Date.now() / 1000) - 60 });
  check("id_token hết hạn → không tạo", !hasSession(u5.r) && (await prisma.user.count({ where: { email: we } })) === 0);
  const wi = emailOf();
  const u6 = await flow({ email: wi, iss: "https://evil.example" });
  check("iss lạ → không tạo", !hasSession(u6.r) && (await prisma.user.count({ where: { email: wi } })) === 0);

  section("CSRF: state sai / thiếu cookie / hết hạn; lỗi từ Google");
  const cs = emailOf();
  const x1 = await flow({ email: cs }, { state: "state-gia-mao" });
  check("state sai → 'failed', không đổi mã (Google giả không nhận yêu cầu /token), không tạo", !hasSession(x1.r) && path(x1.loc) === "/dang-nhap?google=failed" && (await prisma.user.count({ where: { email: cs } })) === 0 && !seenToken.some(t => t.code === x1.code));
  const x2 = await flow({ email: cs }, { noCookie: true });
  check("không có cookie trạng thái (kẻ tấn công dẫn nạn nhân bấm link có code của hắn) → 'failed'", !hasSession(x2.r) && !seenToken.some(t => t.code === x2.code) && (await prisma.user.count({ where: { email: cs } })) === 0);
  const other = await start();
  const x3 = await fetch(`${BASE}/api/auth/google/callback?code=zzz&state=${other.state}`, { redirect: "manual", headers: { cookie: other.cookie.replace(/.$/, c => (c === "A" ? "B" : "A")), "x-forwarded-for": ip() } });
  check("cookie bị sửa chữ ký → 'failed'", !hasSession(x3) && path(x3.headers.get("location") ?? "") === "/dang-nhap?google=failed");
  const x4 = await fetch(`${BASE}/api/auth/google/callback?code=zzz&state=${other.state}`, { redirect: "manual", headers: { cookie: other.cookie, "x-forwarded-for": ip() } });
  check("code lạ (Google giả trả 400) → 'failed', không phiên", !hasSession(x4) && path(x4.headers.get("location") ?? "") === "/dang-nhap?google=failed");
  const x5 = await fetch(`${BASE}/api/auth/google/callback?error=access_denied&state=${other.state}`, { redirect: "manual", headers: { cookie: other.cookie, "x-forwarded-for": ip() } });
  check("người dùng bấm Hủy ở Google → 'cancelled'", !hasSession(x5) && path(x5.headers.get("location") ?? "") === "/dang-nhap?google=cancelled");
  const x6 = await fetch(`${BASE}/api/auth/google/callback`, { redirect: "manual", headers: { "x-forwarded-for": ip() } });
  check("gọi thẳng callback không tham số → 'failed'", !hasSession(x6) && path(x6.headers.get("location") ?? "") === "/dang-nhap?google=failed");
  const wrongBody = await flow({ email: emailOf() }, { badToken: true });
  check("Google /token báo lỗi → 'failed', không phiên", !hasSession(wrongBody.r) && path(wrongBody.loc) === "/dang-nhap?google=failed");

  section("Chuyển hướng an toàn sau đăng nhập");
  const r1 = await flow({ email: emailOf() }, { query: "?redirect=/student/nhap-ma-lop" });
  check("đường nội bộ được giữ", path(r1.loc) === "/student/nhap-ma-lop", r1.loc);
  const r2 = await flow({ email: emailOf() }, { query: "?redirect=//evil.example/x" });
  check("//evil.example bị bỏ → trang mặc định", path(r2.loc) === "/student/viec-cua-toi" && !r2.loc.includes("evil"), r2.loc);
  const r3 = await flow({ email: emailOf() }, { query: "?redirect=https://evil.example" });
  check("https://evil.example bị bỏ → trang mặc định", path(r3.loc) === "/student/viec-cua-toi" && !r3.loc.includes("evil"), r3.loc);
  const r4 = await flow({ email: emailOf() }, { query: "?redirect=/%5Cevil.example" });
  check("/\\evil.example bị bỏ", !r4.loc.includes("evil"), r4.loc);

  section("Cửa quản trị không nhận Google; nút theo biến môi trường");
  const ah = await new Promise<{ loc: string; cookie: string }>(res => http.get(`${BASE}/api/auth/google/start`, { headers: { host: "admin.midnightelite-edu.com", "x-forwarded-for": ip() } }, r => { res({ loc: String(r.headers.location ?? ""), cookie: String(r.headers["set-cookie"] ?? "") }); r.resume(); }));
  check("start ở tên miền admin → /dang-nhap?google=wrong-host, không cookie trạng thái", path(ah.loc) === "/dang-nhap?google=wrong-host" && !ah.cookie.includes("kin_google"), ah);
  const en = await (await fetch(`${BASE}/api/auth/google/enabled`)).json();
  check("/enabled trả {google:true} khi có cả hai biến, không lộ giá trị", en.google === true && JSON.stringify(en) === '{"google":true}');

  section("Gọi song song cùng email mới: một tài khoản, một ví (không lỗi 500)");
  const rc = emailOf();
  const pr = await Promise.all([0, 1, 2].map(i => flow({ email: rc, sub: `sub-race-${RUN}`, name: `Đua ${i}` })));
  check("không lượt nào về trang lỗi server; có ít nhất một phiên", pr.every(x => x.r.status === 303) && pr.some(x => hasSession(x.r)), pr.map(x => x.loc));
  const ru = await prisma.user.findMany({ where: { email: rc }, include: { wallet: true } });
  check("đúng 1 User, 1 ví, 1 dòng xu", ru.length === 1 && !!ru[0].wallet && (await prisma.coinTransaction.count({ where: { userId: ru[0].id } })) === 1, ru.length);

  section("Chiếm lại có điều kiện (P2-a): hai lượt Google song song cùng email của tài khoản chưa xác minh");
  const rk = await mkUser({ name: "Kẻ chiếm trước 2", emailVerified: false });
  const subRace = `sub-reclaim-race-${RUN}`;
  const rr = await Promise.all([0, 1, 2].map(() => flow({ email: rk.email, sub: subRace })));
  check("cả ba lượt về trang đăng nhập thành công (303, có phiên), không lượt nào 500 / từ chối", rr.every(x => x.r.status === 303 && hasSession(x.r) && path(x.loc) === "/student/viec-cua-toi"), rr.map(x => x.loc));
  const rku = await prisma.user.findUnique({ where: { id: rk.id } });
  check("một tài khoản, emailVerified=true, googleSub gắn", (await prisma.user.count({ where: { email: rk.email } })) === 1 && rku?.emailVerified === true && rku.googleSub === subRace);
  const rkl = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email: rk.email, password: "Passw0rd!" }) });
  check("mật khẩu cũ của kẻ chiếm trước không còn dùng được", rkl.status !== 200, rkl.status);

  section("Chiếm lại có điều kiện (P2-a, xác định): chủ thật xác minh email GIỮA lúc đọc và lúc ghi → KHÔNG bị chiếm lại");
  const ow = await mkUser({ name: "Chủ thật", emailVerified: false });
  const ownerHash = "$2b$10$ownerownerownerownerownerOwnerOwnerOwnerOwnerOwnerOwne";
  const orig = prisma.user.findUnique.bind(prisma.user);
  let flipped = false;
  // @ts-expect-error — chèn đúng một lần: ngay sau lần đọc đầu tiên trả về tài khoản chưa xác minh, chủ thật đặt lại mật khẩu (emailVerified=true) và khai số điện thoại.
  prisma.user.findUnique = (async (args: any) => {
    const row = await orig(args);
    if (!flipped && row && (row as any).id === ow.id && (row as any).emailVerified === false) {
      flipped = true;
      await prisma.user.update({ where: { id: ow.id }, data: { emailVerified: true, password: ownerHash, phone: "0933333333" } });
    }
    return row;
  }) as any;
  let rs: Awaited<ReturnType<typeof resolveSocialUser>>;
  try { rs = await resolveSocialUser("google", { id: `sub-owner-${RUN}`, email: ow.email, name: "Chủ thật" }); } finally { prisma.user.findUnique = orig as any; }
  const owu = await prisma.user.findUnique({ where: { id: ow.id } });
  check("lượt Google vẫn thành công (đọc lại, thấy đã xác minh → liên kết thường)", flipped && rs.ok === true && owu?.googleSub === `sub-owner-${RUN}`, rs);
  check("mật khẩu và số điện thoại mà chủ thật vừa đặt KHÔNG bị xoá / đổi", owu?.password === ownerHash && owu?.phone === "0933333333", owu);

  fake.close();
  await done();
})();
