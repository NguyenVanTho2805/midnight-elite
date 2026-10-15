// Quên mật khẩu (15/10/2026): API thật + Postgres thật. Thư ghi vào EMAIL_SINK_DIR (không gửi đi). Quy tắc thuần: t-password-reset-lib.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkSuper, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { hashResetToken, RESET_TTL_MS } from "@/lib/passwordReset";

const SINK = process.env.EMAIL_SINK_DIR;
const SECRET = process.env.SESSION_SECRET;
if (!SINK || !SECRET) { console.error("Cần EMAIL_SINK_DIR và SESSION_SECRET (xem env.example.sh) và server dev chạy với cùng biến."); process.exit(2); }

type Mail = { to: string; subject: string; text: string; html: string };
const mails = (to: string): Mail[] => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to);
const resetMails = (to: string) => mails(to).filter(m => /Đặt lại mật khẩu/.test(m.subject));
const tokenIn = (m?: Mail) => m?.text.match(/dat-lai-mat-khau\?token=([0-9a-f]{64})/)?.[1] ?? "";

// Bộ đếm giới hạn nằm trong bộ nhớ server dev nên SỐNG QUA các lần chạy test: mỗi lần dùng IP riêng (và email mới do mkUser đánh số).
let ipSeq = Math.floor(Math.random() * 40) * 250;
const nextIp = () => `10.88.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
async function call(method: "GET" | "POST", path: string, body?: unknown, ip = nextIp()) {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), redirect: "manual" });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
}
const forgot = (email: unknown, ip?: string) => call("POST", "/api/auth/forgot-password", { email }, ip);
const reset = (token: unknown, password: unknown, ip?: string) => call("POST", "/api/auth/reset-password", { token, password }, ip);
const login = (identifier: string, password: string) => call("POST", "/api/auth/login", { identifier, password });
const hasSession = (r: { headers: Headers }) => (r.headers.get("set-cookie") ?? "").includes("midnight_session=");
const age = (userId: string, ms: number) => prisma.passwordResetToken.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() + RESET_TTL_MS - ms) } }); // giả lập đã gửi cách đây `ms`

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();

  section("Xin link: kiểm tra đầu vào");
  check("email sai dạng → 400", (await forgot("khong-phai-email")).status === 400);
  check("thiếu email → 400", (await call("POST", "/api/auth/forgot-password", {})).status === 400);
  check("email không phải chuỗi → 400", (await forgot(12345)).status === 400);
  check("thân không phải JSON → 400 (không 500)", (await call("POST", "/api/auth/forgot-password", "xx")).status === 400);
  check("chưa có thư nào được ghi", readdirSync(SINK).length === 0);

  section("Email lạ: phản hồi y hệt email thật, không gửi thư, không ghi gì, và cũng phải chờ");
  const ghost = `khong-co-${Date.now().toString(36)}@test.local`;
  const t0 = Date.now();
  const g = await forgot(ghost);
  const dt = Date.now() - t0;
  check("200 + { success: true, resendAfterSec: 60 }", g.status === 200 && g.json?.success === true && g.json?.resendAfterSec === 60, g);
  check("không gửi thư", mails(ghost).length === 0);
  check("không ghi link nào vào cơ sở dữ liệu", (await prisma.passwordResetToken.count()) === 0);
  check(`không trả lời nhanh bất thường (≥ 700 ms, đo ${dt} ms): thời gian không tố email có tài khoản`, dt >= 700, dt);

  section("Email có tài khoản: gửi thư, chỉ lưu BĂM của link");
  const S = await mkUser({ name: "Minh Anh" });
  const t1 = Date.now();
  const r1 = await forgot(S.email);
  const dt1 = Date.now() - t1;
  check("200 + cùng dạng phản hồi với email lạ", r1.status === 200 && r1.json?.success === true && r1.json?.resendAfterSec === 60, r1);
  const m1 = resetMails(S.email);
  check("có đúng 1 thư 'Đặt lại mật khẩu', gửi tới đúng email", m1.length === 1 && m1[0].to === S.email, m1.map(m => m.subject));
  const tok1 = tokenIn(m1[0]);
  check("thư có link /dat-lai-mat-khau?token=<64 hex> (cả bản chữ và bản HTML)", tok1.length === 64 && m1[0].html.includes(`token=${tok1}`));
  check("thư nêu 30 phút + cách xử lý khi không phải mình xin", /30 phút/.test(m1[0].text) && /bỏ qua/.test(m1[0].text));
  const rows = await prisma.passwordResetToken.findMany({ where: { userId: S.id } });
  check("đúng 1 bản ghi; cột token KHÔNG phải link trong thư mà là BĂM của nó", rows.length === 1 && rows[0].token !== tok1 && rows[0].token === hashResetToken(tok1, SECRET), rows[0]?.token);
  check("hạn ≈ +30 phút", Math.abs(rows[0].expiresAt.getTime() - (Date.now() + RESET_TTL_MS)) < 30_000);
  void dt1;

  section("Xin lại quá sớm: chờ 60 giây, không gửi thêm, link cũ vẫn sống");
  const r2 = await forgot(S.email);
  check("200 cùng dạng phản hồi, resendAfterSec ≤ 60", r2.status === 200 && r2.json?.success === true && r2.json?.resendAfterSec <= 60 && r2.json?.resendAfterSec >= 1, r2.json);
  check("không gửi thêm thư", resetMails(S.email).length === 1);
  check("link cũ vẫn là link đang sống (không bị đổi)", (await prisma.passwordResetToken.findMany({ where: { userId: S.id } }))[0]?.token === rows[0].token);

  section("Sau 60 giây: gửi link MỚI, link cũ chết ngay");
  await age(S.id, 61_000);
  const r3 = await forgot(S.email);
  const m3 = resetMails(S.email);
  const tok2 = tokenIn(m3.at(-1));
  check("gửi thư thứ 2 với link khác", r3.status === 200 && m3.length === 2 && tok2.length === 64 && tok2 !== tok1);
  check("vẫn chỉ 1 bản ghi (mỗi tài khoản một link)", (await prisma.passwordResetToken.count({ where: { userId: S.id } })) === 1);
  const old = await reset(tok1, "MatKhauMoi#1");
  check("link CŨ không dùng được nữa → 400 invalid", old.status === 400 && old.json?.code === "invalid", old.json);

  section("Giới hạn: 3 lần/30 phút cho mỗi email, 10 lần/10 phút cho mỗi máy");
  const r4 = await forgot(S.email);
  check("lần thứ 4 trong 30 phút → 429 + Retry-After", r4.status === 429 && r4.json?.code === "wait" && !!r4.headers.get("retry-after"), r4);
  check("đã bị chặn thì không gửi thêm thư", resetMails(S.email).length === 2);
  const ghost2 = Array.from({ length: 4 }, (_, i) => `ghost-${i}-${Date.now().toString(36)}@test.local`);
  const ipFix = nextIp();
  const burst: number[] = [];
  for (let i = 0; i < 11; i++) burst.push((await forgot(i < 4 ? ghost2[i] : `g${i}-${Date.now().toString(36)}@test.local`, ipFix)).status);
  check("11 lần liên tiếp từ cùng một máy → lần thứ 11 bị 429", burst.slice(0, 10).every(s => s === 200) && burst[10] === 429, burst);

  section("Đặt lại: kiểm tra đầu vào");
  const U = await mkUser({ name: "Bạn Quên" });
  await forgot(U.email);
  const tokU = tokenIn(resetMails(U.email)[0]);
  check("link sai dạng → 400 invalid", (await reset("abc", "MatKhauMoi#1")).status === 400);
  check("link đúng dạng nhưng không có thật → 400 invalid", (await reset("0".repeat(64), "MatKhauMoi#1")).json?.code === "invalid");
  check("thiếu link → 400", (await call("POST", "/api/auth/reset-password", { password: "MatKhauMoi#1" })).status === 400);
  check("mật khẩu ngắn (7 ký tự) → 400, nêu 8 ký tự", (await reset(tokU, "1234567")).json?.error?.includes("8 ký tự") === true);
  check("mật khẩu quá dài (1025) → 400", (await reset(tokU, "a".repeat(1025))).status === 400);
  check("thân không phải JSON → 400 (không 500)", (await call("POST", "/api/auth/reset-password", "xx")).status === 400);
  check("link bản ghi CŨ lưu thô (trước 15/10) không dùng được: chỉ so theo băm", await (async () => {
    const raw = "ab".repeat(32);
    await prisma.passwordResetToken.create({ data: { token: raw, userId: S.id, expiresAt: new Date(Date.now() + 600_000) } });
    const r = await reset(raw, "MatKhauMoi#1");
    await prisma.passwordResetToken.deleteMany({ where: { token: raw } });
    return r.status === 400 && r.json?.code === "invalid";
  })());
  check("sau các lần thử sai, mật khẩu cũ vẫn dùng được (chưa ai đổi được gì)", (await login(U.email, "Passw0rd!")).status === 200);
  check("GET kiểm link: link đúng → valid", (await call("GET", `/api/auth/reset-password?token=${tokU}`)).json?.valid === true);
  const gbad = await call("GET", `/api/auth/reset-password?token=${"1".repeat(64)}`);
  check("GET kiểm link: link lạ → valid:false + lý do invalid", gbad.json?.valid === false && gbad.json?.reason === "invalid");

  section("Link hết hạn");
  await prisma.passwordResetToken.updateMany({ where: { userId: U.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const ex = await reset(tokU, "MatKhauMoi#1");
  check("đặt lại bằng link quá hạn → 400 expired, nêu 'hết hạn'", ex.status === 400 && ex.json?.code === "expired" && /hết hạn/.test(ex.json?.error), ex.json);
  check("GET kiểm link quá hạn → valid:false, reason expired", (await call("GET", `/api/auth/reset-password?token=${tokU}`)).json?.reason === "expired");
  check("mật khẩu chưa bị đổi", (await login(U.email, "Passw0rd!")).status === 200);
  check("xin link mới sau khi hết hạn được ngay (không bị chờ 60 giây)", (await (async () => { await forgot(U.email); return resetMails(U.email).length === 2; })()));

  section("Đặt lại thành công (học viên): mật khẩu đổi, đăng nhập luôn, link dùng một lần");
  const tokU2 = tokenIn(resetMails(U.email).at(-1));
  const ok = await reset(tokU2, "MatKhauMoi#2026");
  check("200 + success + role student + next = Việc của tôi", ok.status === 200 && ok.json?.success === true && ok.json?.role === "student" && ok.json?.next === "/student/viec-cua-toi", ok.json);
  check("cấp phiên đăng nhập (cookie)", hasSession(ok));
  check("mật khẩu CŨ không đăng nhập được nữa", (await login(U.email, "Passw0rd!")).status === 401);
  check("mật khẩu MỚI đăng nhập được", (await login(U.email, "MatKhauMoi#2026")).status === 200);
  check("mọi link của tài khoản đã bị xoá", (await prisma.passwordResetToken.count({ where: { userId: U.id } })) === 0);
  const again = await reset(tokU2, "KhacNua#2026");
  check("dùng LẠI link vừa xong → 400 invalid, mật khẩu không đổi tiếp", again.status === 400 && again.json?.code === "invalid" && (await login(U.email, "MatKhauMoi#2026")).status === 200);
  const notice = mails(U.email).filter(m => /vừa được đổi/.test(m.subject));
  check("có thư BÁO 'mật khẩu vừa được đổi' (nếu không phải mình thì biết ngay) kèm link xin đặt lại", notice.length === 1 && /quen-mat-khau/.test(notice[0].text));

  section("Đặt lại xong thì bộ đếm đăng nhập sai của tài khoản được xoá (người quên mật khẩu thường đã gõ sai nhiều lần)");
  const G = await mkUser({ name: "Gõ sai nhiều lần" });
  for (let i = 0; i < 5; i++) await login(G.email, "SaiMatKhau#" + i); // đủ 5 lần sai → các lần sau bị làm chậm 1,5 giây (src/lib/loginThrottle.ts)
  const g0 = Date.now();
  const slowWrong = await login(G.email, "SaiMatKhau#6");
  const slowMs = Date.now() - g0;
  check(`trước khi đặt lại: lần thử kế tiếp bị làm chậm (≥ 1,4 giây, đo ${slowMs} ms) và vẫn là 401`, slowWrong.status === 401 && slowMs >= 1400, slowMs);
  await forgot(G.email);
  const rT = await reset(tokenIn(resetMails(G.email)[0]), "MatKhauMoi#2026");
  const g1 = Date.now();
  const fastLogin = await login(G.email, "MatKhauMoi#2026");
  const fastMs = Date.now() - g1;
  check(`sau khi đặt lại: đăng nhập bằng mật khẩu mới vào luôn, không bị làm chậm (< 1,3 giây, đo ${fastMs} ms)`, rT.status === 200 && fastLogin.status === 200 && fastMs < 1300, { rT: rT.status, fastMs });

  section("Email chưa xác thực: mở được link trong hộp thư = chứng minh hộp thư → coi như đã xác thực");
  const N = await mkUser({ name: "Chưa xác thực", emailVerified: false });
  await forgot(N.email);
  await reset(tokenIn(resetMails(N.email)[0]), "MatKhauMoi#2026");
  check("emailVerified chuyển thành true", (await prisma.user.findUnique({ where: { id: N.id }, select: { emailVerified: true } }))?.emailVerified === true);

  section("Gia sư và quản trị: vào đúng trang của vai (trước đây gia sư bị đưa nhầm)");
  const T = await mkTutor("Cô Lan");
  await forgot(T.email);
  const rt = await reset(tokenIn(resetMails(T.email)[0]), "MatKhauMoi#2026");
  check("gia sư: role admin + adminRole teacher + next = /lop-cua-toi", rt.json?.role === "admin" && rt.json?.adminRole === "teacher" && rt.json?.next === "/lop-cua-toi", rt.json);
  const A = await mkSuper("Admin TSIX");
  await forgot(A.email);
  const ra = await reset(tokenIn(resetMails(A.email)[0]), "MatKhauMoi#2026");
  check("quản trị cấp 1: next = /admin, có phiên", ra.json?.next === "/admin" && hasSession(ra), ra.json);

  section("Tài khoản bị khoá: không gửi thư, không lộ gì");
  const B = await mkUser({ name: "Bị khoá" });
  await prisma.user.update({ where: { id: B.id }, data: { banned: true } });
  const rb = await forgot(B.email);
  check("200 cùng dạng phản hồi; không thư, không ghi link", rb.status === 200 && rb.json?.success === true && mails(B.email).length === 0 && (await prisma.passwordResetToken.count({ where: { userId: B.id } })) === 0, rb);
  await prisma.passwordResetToken.create({ data: { token: hashResetToken("c".repeat(64), SECRET), userId: B.id, expiresAt: new Date(Date.now() + 600_000) } });
  const rbr = await reset("c".repeat(64), "MatKhauMoi#2026");
  check("dù có link hợp lệ, tài khoản khoá không đổi được mật khẩu / không được cấp phiên → 403", rbr.status === 403 && !hasSession(rbr), rbr);

  await done();
})();
