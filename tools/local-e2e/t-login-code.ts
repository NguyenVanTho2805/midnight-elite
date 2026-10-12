// Đăng nhập bằng mã 6 số qua email (TK-170): API thật + Postgres thật. Thư được ghi vào EMAIL_SINK_DIR (không gửi đi).
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkSuper, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/loginCode";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }

type Mail = { to: string; subject: string; text: string; html: string };
const mails = (to: string): Mail[] =>
  readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to);
const codeOf = (to: string) => mails(to).at(-1)?.text.match(/của bạn: (\d{6})/)?.[1] ?? "";
const wrongCode = (real: string) => (real === "000000" ? "000001" : "000000");

// Bộ nhớ giới hạn/ghost nằm trong tiến trình server dev nên SỐNG QUA các lần chạy test: mỗi lần chạy dùng email + IP riêng.
const RUN = Date.now().toString(36);
let ipSeq = Math.floor(Math.random() * 40) * 250;
const nextIp = () => `10.77.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`; // mỗi lời gọi một IP riêng để không vướng giới hạn theo IP
async function post(path: string, body: unknown, ip = nextIp()) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body), redirect: "manual" });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
}
const reqCode = (email: string, ip?: string) => post("/api/auth/code/request", { email }, ip);
const verify = (email: string, code: string, ip?: string) => post("/api/auth/code/verify", { email, code }, ip);
const hasSession = (r: { headers: Headers }) => (r.headers.get("set-cookie") ?? "").includes("midnight_session=");
const age = (email: string, ms: number) => prisma.loginCode.update({ where: { email }, data: { sentAt: new Date(Date.now() - ms), expiresAt: new Date(Date.now() - ms + 600_000) } });

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();

  section("Xin mã: kiểm tra đầu vào");
  const bad = await reqCode("khong-phai-email");
  check("email sai dạng → 400", bad.status === 400, bad);
  check("thiếu email → 400", (await post("/api/auth/code/request", {})).status === 400);
  check("thân không phải JSON → 400 (không 500)", (await fetch(BASE + "/api/auth/code/request", { method: "POST", headers: { "x-forwarded-for": nextIp() }, body: "xx" })).status === 400);
  check("chưa có thư nào được ghi", readdirSync(SINK).length === 0);

  section("Xin mã cho tài khoản thật");
  const U = await mkUser({ name: "Nguyễn Minh Anh" });
  const r1 = await reqCode(`  ${U.email.toUpperCase()} `);
  check("200 sent, nhắc: gửi lại sau 60 giây, sống 10 phút", r1.status === 200 && r1.json.sent === true && r1.json.resendAfterSec === 60 && r1.json.expiresInSec === 600, r1);
  const m1 = mails(U.email);
  check("đúng 1 thư gửi tới email đã chuẩn hoá (chữ thường)", m1.length === 1, m1.length);
  const code1 = codeOf(U.email);
  check("thư có mã 6 số, tiêu đề chứa mã", /^\d{6}$/.test(code1) && m1[0].subject.includes(code1), m1[0]?.subject);
  check("thư nói rõ sống 10 phút + chỉ dùng một lần, gọi đúng tên", m1[0].text.includes("10 phút") && m1[0].text.includes("một lần") && m1[0].text.includes("Nguyễn Minh Anh"));
  check("thư HTML dùng màu KiN (navy), không còn xanh cũ #0068FF", m1[0].html.includes("#1e3a8a") && !m1[0].html.includes("#0068FF"));
  const row = await prisma.loginCode.findUnique({ where: { email: U.email } });
  check("DB lưu BĂM (64 hex), không lưu mã gốc", !!row && /^[0-9a-f]{64}$/.test(row.codeHash) && !JSON.stringify(row).includes(code1), row);
  check("băm = HMAC(email:mã) bằng khoá bí mật của server", row?.codeHash === hashCode(U.email, code1, process.env.SESSION_SECRET!));
  check("hết hạn sau ~10 phút", !!row && Math.abs(row.expiresAt.getTime() - row.sentAt.getTime() - 600_000) < 2000);

  section("Gửi lại: phải chờ 60 giây");
  const r2 = await reqCode(U.email);
  check("xin lại ngay → 429 wait kèm số giây còn lại + Retry-After", r2.status === 429 && r2.json.code === "wait" && r2.json.retryAfterSec > 0 && r2.json.retryAfterSec <= 60 && !!r2.headers.get("retry-after"), r2);
  check("không gửi thêm thư", mails(U.email).length === 1);
  await age(U.email, 61_000);
  const r3 = await reqCode(U.email);
  check("sau 61 giây → gửi được", r3.status === 200 && mails(U.email).length === 2, r3);
  const code2 = codeOf(U.email);
  check("mã mới GHI ĐÈ mã cũ: chỉ còn 1 dòng cho email", (await prisma.loginCode.count({ where: { email: U.email } })) === 1);
  check("mã cũ không còn dùng được (nếu khác mã mới)", code1 === code2 || (await verify(U.email, code1)).status === 401);

  section("Nhập sai / nhập đúng");
  const fmt = await verify(U.email, "12ab");
  check("mã không đủ 6 số → 400 format (không tính lần thử)", fmt.status === 400 && fmt.json.code === "format", fmt);
  const w1 = await verify(U.email, wrongCode(code2));
  // Lưu ý: bước thử mã CŨ ở trên đã tốn 1 lần (nhập sai mã nào cũng tính), nên đây là lần sai thứ 2.
check("sai tiếp → 401, còn 3 lần", w1.status === 401 && w1.json.code === "wrong" && w1.json.attemptsLeft === 3 && !hasSession(w1), w1);
  const w2 = await verify(U.email, wrongCode(code2));
  check("sai tiếp → còn 2 lần", w2.json.attemptsLeft === 2);
  const ok = await verify(`  ${U.email.toUpperCase()}`, ` ${code2.slice(0, 3)} ${code2.slice(3)} `);
  check("đúng mã (email hoa + mã có khoảng trắng) → 200 + cookie phiên + thông tin người dùng", ok.status === 200 && hasSession(ok) && ok.json.email === U.email && ok.json.role === "student" && ok.json.name === "Nguyễn Minh Anh", ok);
  check("cookie phiên HttpOnly + SameSite=Lax", /midnight_session=[^;]+;.*HttpOnly/i.test(ok.headers.get("set-cookie") ?? "") && /samesite=lax/i.test(ok.headers.get("set-cookie") ?? ""), ok.headers.get("set-cookie"));
  const me = await fetch(BASE + "/api/auth/me", { headers: { cookie: (ok.headers.get("set-cookie") ?? "").split(";")[0] } });
  check("phiên dùng được: /api/auth/me trả đúng người", me.status === 200 && (await me.json()).email === U.email);
  check("mã đã dùng bị XOÁ khỏi DB (dùng một lần)", (await prisma.loginCode.count({ where: { email: U.email } })) === 0);
  const again = await verify(U.email, code2);
  check("dùng lại đúng mã đó → 401 expired, không có phiên", again.status === 401 && again.json.code === "expired" && !hasSession(again), again);

  section("Sai 5 lần thì khoá 15 phút");
  const L = await mkUser({ name: "Lê Khánh Vy" });
  await reqCode(L.email);
  const lc = codeOf(L.email);
  const seq: number[] = [];
  for (let i = 0; i < 4; i++) seq.push((await verify(L.email, wrongCode(lc))).json.attemptsLeft);
  check("4 lần sai đầu: còn 4, 3, 2, 1", JSON.stringify(seq) === "[4,3,2,1]", seq);
  const w5 = await verify(L.email, wrongCode(lc));
  check("lần sai thứ 5 → 429 locked (~15 phút)", w5.status === 429 && w5.json.code === "locked" && w5.json.retryAfterSec >= 899 && w5.json.retryAfterSec <= 900 && !hasSession(w5), w5);
  const dbl = await prisma.loginCode.findUnique({ where: { email: L.email } });
  check("DB ghi mốc khoá ~15 phút và 5 lần sai", !!dbl?.lockedUntil && dbl.attempts === 5 && Math.abs(dbl.lockedUntil.getTime() - Date.now() - 900_000) < 5000, dbl);
  const lockedOk = await verify(L.email, lc);
  check("ĐANG KHOÁ thì ngay cả mã ĐÚNG cũng bị từ chối", lockedOk.status === 429 && lockedOk.json.code === "locked" && !hasSession(lockedOk), lockedOk);
  const lockedReq = await reqCode(L.email);
  check("đang khoá: xin mã mới cũng bị từ chối, không gửi thư", lockedReq.status === 429 && lockedReq.json.code === "locked" && mails(L.email).length === 1, lockedReq);
  check("thông báo khoá nói số phút", /15 phút/.test(lockedReq.json.error), lockedReq.json);
  await prisma.loginCode.update({ where: { email: L.email }, data: { lockedUntil: new Date(Date.now() - 1000), sentAt: new Date(Date.now() - 16 * 60_000) } });
  const afterLock = await reqCode(L.email);
  check("hết khoá → xin mã mới được", afterLock.status === 200 && mails(L.email).length === 2, afterLock);
  const afterRow = await prisma.loginCode.findUnique({ where: { email: L.email } });
  check("sau khi hết khoá: lần sai và mốc khoá được đặt lại", afterRow?.attempts === 0 && afterRow.lockedUntil === null, afterRow);
  const okAfter = await verify(L.email, codeOf(L.email));
  check("đăng nhập được bằng mã mới sau khi hết khoá", okAfter.status === 200 && hasSession(okAfter), okAfter);

  section("Không lách giới hạn bằng cách xin mã liên tục");
  const C = await mkUser({ name: "Phạm Quốc Huy" });
  await reqCode(C.email);
  await verify(C.email, wrongCode(codeOf(C.email))); await verify(C.email, wrongCode(codeOf(C.email))); await verify(C.email, wrongCode(codeOf(C.email)));
  await age(C.email, 61_000);
  await reqCode(C.email);
  const carried = await prisma.loginCode.findUnique({ where: { email: C.email } });
  check("sai 3 lần rồi xin mã mới: vẫn nhớ 3 lần sai", carried?.attempts === 3, carried);
  const c1 = await verify(C.email, wrongCode(codeOf(C.email)));
  check("chỉ còn 1 lần thử sau đó", c1.json.attemptsLeft === 1, c1.json);

  section("Mã hết hạn");
  const E = await mkUser({ name: "Vũ Minh Quân" });
  await reqCode(E.email);
  const ec = codeOf(E.email);
  await prisma.loginCode.update({ where: { email: E.email }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const exp = await verify(E.email, ec);
  check("mã đúng nhưng quá 10 phút → 401 expired, không có phiên", exp.status === 401 && exp.json.code === "expired" && !hasSession(exp), exp);
  check("chưa xin mã mà nhập → 401 expired", (await verify((await mkUser({ name: "Chưa xin" })).email, "123456")).json.code === "expired");

  section("Email KHÔNG có tài khoản: phản hồi giống hệt, không lộ");
  const ghostEmail = `nguoi.la.${RUN}@khong-co.test`;
  const gReq = await reqCode(ghostEmail);
  check("xin mã → 200 cùng dạng {sent, resendAfterSec, expiresInSec}", gReq.status === 200 && JSON.stringify(Object.keys(gReq.json).sort()) === JSON.stringify(Object.keys(r1.json).sort()) && gReq.json.resendAfterSec === 60 && gReq.json.expiresInSec === 600, gReq);
  check("KHÔNG gửi thư và KHÔNG tạo dòng trong DB", mails(ghostEmail).length === 0 && (await prisma.loginCode.count({ where: { email: ghostEmail } })) === 0);
  const gWait = await reqCode(ghostEmail);
  check("xin lại ngay → 429 wait y như tài khoản thật", gWait.status === 429 && gWait.json.code === "wait" && Object.keys(gWait.json).sort().join() === Object.keys(r2.json).sort().join(), gWait);
  const gSeq: number[] = [];
  for (let i = 0; i < 4; i++) { const g = await verify(ghostEmail, "123456"); check(`email lạ sai lần ${i + 1} → 401 wrong như thật`, g.status === 401 && g.json.code === "wrong", g); gSeq.push(g.json.attemptsLeft); }
  check("email lạ cũng đếm: còn 4, 3, 2, 1", JSON.stringify(gSeq) === "[4,3,2,1]", gSeq);
  const g5 = await verify(ghostEmail, "123456");
  check("email lạ sai lần 5 → 429 locked y như thật", g5.status === 429 && g5.json.code === "locked" && g5.json.retryAfterSec >= 899, g5);
  check("email lạ chưa xin mã mà nhập → cùng dạng 'expired' như tài khoản thật", (await verify(`khac.nua.${RUN}@khong-co.test`, "123456")).json.code === "expired");

  section("Tài khoản bị khoá (banned): thư vẫn gửi, vào thì bị từ chối");
  const B = await mkUser({ name: "Bị khoá" });
  await prisma.user.update({ where: { id: B.id }, data: { banned: true } });
  const bReq = await reqCode(B.email);
  check("xin mã vẫn 200 (không lộ trạng thái khoá)", bReq.status === 200 && mails(B.email).length === 1, bReq);
  const bOk = await verify(B.email, codeOf(B.email));
  check("đúng mã nhưng bị khoá → 403, KHÔNG có phiên", bOk.status === 403 && /bị khóa/.test(bOk.json.error) && !hasSession(bOk), bOk);

  section("Vai trò: gia sư / quản trị nhận đúng vai trò trong phiên");
  const T = await mkTutor("Cô Lan"); const A = await mkSuper("Quản trị");
  for (const [u, role, adminRole] of [[T, "admin", "teacher"], [A, "admin", "admin_super"]] as const) {
    await reqCode(u.email);
    const v = await verify(u.email, codeOf(u.email));
    check(`${adminRole}: role=${role}, adminRole=${adminRole}`, v.status === 200 && v.json.role === role && v.json.adminRole === adminRole, v.json);
  }

  section("Chạy song song");
  const R = await mkUser({ name: "Đua mã" });
  await reqCode(R.email);
  const rc = codeOf(R.email);
  const par = await Promise.all(Array.from({ length: 6 }, () => verify(R.email, rc)));
  const wins = par.filter(p => p.status === 200).length;
  check("6 yêu cầu cùng mã ĐÚNG cùng lúc: đúng 1 cái vào được (mã dùng một lần thật sự)", wins === 1, par.map(p => p.status));
  const S = await mkUser({ name: "Đoán mã" });
  await reqCode(S.email);
  const sc = codeOf(S.email);
  const burst = await Promise.all(Array.from({ length: 25 }, (_, i) => verify(S.email, String(100000 + i))));
  const used = (await prisma.loginCode.findUnique({ where: { email: S.email } }))?.attempts ?? -1;
  check("25 lần đoán song song: DB chỉ ghi ≤ 5 lần thử (không vượt giới hạn)", used >= 1 && used <= 5, used);
  check("phần lớn bị chặn ngay (locked/expired), không có cái nào vào được", burst.every(b => b.status !== 200) && burst.filter(b => b.status === 401 && b.json.code === "wrong").length <= 5, burst.map(b => b.status));
  check("sau đợt đoán, mã đúng cũng bị từ chối vì đã khoá", (await verify(S.email, sc)).status === 429);

  section("Giới hạn theo IP / theo email");
  const sameIp = `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await reqCode(`ip${i}.${RUN}@khong-co.test`, sameIp)).status);
  check("cùng một IP xin quá 10 lần/10 phút → bị 429 từ lần 11", codes.slice(0, 10).every(c => c === 200) && codes.slice(10).every(c => c === 429), codes);
  const spam = await mkUser({ name: "Bị dội thư" });
  const spamRes: number[] = [];
  for (let i = 0; i < 8; i++) { spamRes.push((await reqCode(spam.email)).status); await prisma.loginCode.updateMany({ where: { email: spam.email }, data: { sentAt: new Date(Date.now() - 61_000) } }); }
  check("đổi IP liên tục vẫn bị chặn theo email (tối đa 6 yêu cầu/10 phút)", spamRes.slice(0, 6).every(c => c === 200) && spamRes.slice(6).every(c => c === 429), spamRes);

  section("Không làm hỏng đăng nhập bằng mật khẩu (lối phụ)");
  const P = await mkUser({ name: "Có mật khẩu" });
  const pw = await post("/api/auth/login", { email: P.email, password: "Passw0rd!" });
  check("mật khẩu đúng → 200 + phiên", pw.status === 200 && hasSession(pw) && pw.json.email === P.email, pw);
  check("mật khẩu sai → 401, thông báo cũ", (await post("/api/auth/login", { email: P.email, password: "sai" })).status === 401);
  await prisma.user.update({ where: { id: P.id }, data: { banned: true } });
  const pwBan = await post("/api/auth/login", { email: P.email, password: "Passw0rd!" });
  check("bị khoá + đúng mật khẩu → 403 như trước", pwBan.status === 403 && !hasSession(pwBan), pwBan);

  await done();
})();
