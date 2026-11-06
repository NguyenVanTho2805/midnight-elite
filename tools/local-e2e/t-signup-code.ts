// 07/11/2026 — xác thực email lúc ĐĂNG KÝ bằng mã 6 số (học sinh /api/auth/register, gia sư /api/auth/register-tutor, băng vàng /api/auth/resend-verification).
// API thật + Postgres thật; thư ghi vào EMAIL_SINK_DIR (KHÔNG gửi Gmail thật). Kẻ tấn công: dò email, đoán mã (tuần tự và song song), dùng mã của email khác / mã đăng nhập,
// mã hết hạn, dùng lại mã, gửi lại hàng loạt (IP và email), link cũ vẫn dùng được.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, cookieFor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/loginCode";
import { SPAM_HINT, NOT_SPAM_HINT } from "@/lib/verifyCodeCopy";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }
const SECRET = process.env.SESSION_SECRET!;

type Mail = { to: string; subject: string; text: string; html: string };
const mails = (to: string): Mail[] => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to);
const codeOf = (to: string) => mails(to).at(-1)?.subject.match(/^(\d{6}) /)?.[1] ?? "";
const linkOf = (to: string) => mails(to).at(-1)?.text.match(/xac-thuc-email\?token=([0-9a-f]+)/)?.[1] ?? "";
const wrongCode = (real: string) => (real === "000000" ? "000001" : "000000");
const vk = (e: string) => `verify:${e}`;

const RUN = Date.now().toString(36);
let ipSeq = Math.floor(Math.random() * 40) * 250;
const nextIp = () => `10.88.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
async function post(path: string, body: unknown, o: { ip?: string; cookie?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp() };
  if (o.cookie) headers.cookie = o.cookie;
  const res = await fetch(BASE + path, { method: "POST", headers, body: o.raw ?? JSON.stringify(body), redirect: "manual" });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
}
const regStudent = (email: string) => post("/api/auth/register", { name: "Minh Anh", email, password: "MatKhau#2026", phone: "0901234567", school: "THPT X", city: "Hà Nội" });
const regTutor = (email: string) => post("/api/auth/register-tutor", { name: "Cô Lan", email, password: "MatKhau#2026", phone: "0912345678", bio: "Cử nhân Toán, ba năm dạy ôn ĐGNL cho lớp 12, hay dùng đề thật.", subjects: ["Toán"] });
const reqCode = (email: string, ip?: string) => post("/api/auth/email-verify/request", { email }, { ip });
const confirm = (email: string, code: string, ip?: string) => post("/api/auth/email-verify/confirm", { email, code }, { ip });
const hasSession = (r: { headers: Headers }) => (r.headers.get("set-cookie") ?? "").includes("midnight_session=");
const age = (email: string, ms: number) => prisma.loginCode.update({ where: { email: vk(email) }, data: { sentAt: new Date(Date.now() - ms) } });
const verified = async (email: string) => (await prisma.user.findUnique({ where: { email } }))?.emailVerified;

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();

  section("Đăng ký học sinh: thư có MÃ 6 số + link dự phòng + dòng nhắc Spam");
  const S = `hs-${RUN}@test.local`;
  const r1 = await regStudent(S);
  check("register 200, emailSent true, chưa xác thực", r1.status === 200 && r1.json.emailSent === true && r1.json.emailVerified === false, r1);
  const m1 = mails(S);
  check("đúng 1 thư tới email", m1.length === 1, m1.length);
  const c1 = codeOf(S);
  check("tiêu đề chứa mã 6 số; thân (chữ + HTML) chứa mã", /^\d{6}$/.test(c1) && m1[0].text.includes(c1) && m1[0].html.includes(c1), m1[0]?.subject);
  check("thư có dòng nhắc 'Không thấy mã? ... Hộp thư rác / Spam / Quảng cáo' (chữ + HTML)", m1[0].text.includes(SPAM_HINT) && m1[0].html.includes(SPAM_HINT) && SPAM_HINT.includes("Hộp thư rác") && SPAM_HINT.includes("Spam") && SPAM_HINT.includes("Quảng cáo"));
  check("thư có gợi ý bấm 'Không phải thư rác'", m1[0].text.includes("Không phải thư rác") && m1[0].html.includes(NOT_SPAM_HINT.replace(/"/g, '"')));
  check("thư vẫn có link dự phòng /xac-thuc-email?token=", linkOf(S).length === 64 && m1[0].html.includes("xac-thuc-email?token="));
  check("thư nói rõ sống 10 phút + một lần", m1[0].text.includes("10 phút") && m1[0].text.includes("một lần"));
  const row = await prisma.loginCode.findUnique({ where: { email: vk(S) } });
  check("DB lưu BĂM 64 hex (không mã gốc), khoá 'verify:<email>'", !!row && /^[0-9a-f]{64}$/.test(row.codeHash) && !JSON.stringify(row).includes(c1), row);
  check("băm = HMAC(khoá verify:email : mã) bằng SESSION_SECRET", row?.codeHash === hashCode(vk(S), c1, SECRET));
  check("hết hạn đúng ~10 phút", !!row && Math.abs(row.expiresAt.getTime() - row.sentAt.getTime() - 600_000) < 2000);
  check("KHÔNG đụng bảng cũ: không có dòng LoginCode theo khoá email trần", (await prisma.loginCode.findUnique({ where: { email: S } })) === null);

  section("Định dạng đầu vào");
  check("email sai dạng → 400", (await confirm("khong-phai-email", "123456")).status === 400);
  check("mã 5 số → 400 format", (await confirm(S, "12345")).json?.code === "format");
  check("mã có chữ → 400", (await confirm(S, "12ab56")).status === 400);
  check("mã không phải chuỗi → 400", (await post("/api/auth/email-verify/confirm", { email: S, code: 123456 })).status === 400);
  check("thân không phải JSON → 400 (không 500)", (await post("/api/auth/email-verify/confirm", null, { raw: "xx" })).status === 400);
  check("request: email sai dạng → 400", (await reqCode("abc")).status === 400);
  check("vẫn chưa xác thực sau các lần sai định dạng", (await verified(S)) === false);

  section("Đăng ký lần 2 cùng email: 409, mã đang sống KHÔNG bị đổi, không thêm thư");
  const dup = await regStudent(S.toUpperCase());
  check("409 'đã được đăng ký'", dup.status === 409, dup);
  check("không gửi thêm thư", mails(S).length === 1);
  check("mã cũ vẫn là mã đang sống", (await prisma.loginCode.findUnique({ where: { email: vk(S) } }))?.codeHash === row?.codeHash);
  const par = await Promise.all([regStudent(`song-${RUN}@test.local`), regStudent(`song-${RUN}@test.local`)]);
  check("hai đăng ký song song cùng email: đúng 1 thành công, 1 báo 409 (không 500)", par.map(p => p.status).sort().join() === "200,409", par.map(p => p.status));
  check("chỉ 1 tài khoản + 1 thư", (await prisma.user.count({ where: { email: `song-${RUN}@test.local` } })) === 1 && mails(`song-${RUN}@test.local`).length === 1);

  section("Gửi lại: chờ 60 giây, rồi mã mới, mã cũ chết");
  const w = await reqCode(S);
  check("xin lại ngay → 429 wait + Retry-After + số giây", w.status === 429 && w.json.code === "wait" && w.json.retryAfterSec > 0 && w.json.retryAfterSec <= 60 && !!w.headers.get("retry-after"), w);
  check("không thêm thư", mails(S).length === 1);
  await age(S, 61_000);
  const rs = await reqCode(S);
  check("sau 60 giây → 200 sent, resendAfterSec 60, expiresInSec 600", rs.status === 200 && rs.json.sent === true && rs.json.resendAfterSec === 60 && rs.json.expiresInSec === 600, rs);
  const c2 = codeOf(S);
  check("thư thứ 2 có mã MỚI + dòng nhắc Spam", mails(S).length === 2 && c2 !== c1 && mails(S)[1].text.includes(SPAM_HINT), { c1, c2 });
  check("link dự phòng của thư 1 và thư 2 đều tồn tại (link cũ không bị xoá)", (await prisma.verifyToken.count({ where: { user: { email: S } } })) === 2);

  section("Đoán mã: sai 5 lần thì khoá, mã ĐÚNG cũng bị từ chối trong lúc khoá");
  const bad = wrongCode(c2);
  const g1 = await confirm(S, c1 === c2 ? bad : c1);
  check("mã cũ (đã bị thay) → 401 wrong, còn 4 lần", g1.status === 401 && g1.json.code === "wrong" && g1.json.attemptsLeft === 4, g1);
  check("không có phiên khi sai", !hasSession(g1));
  for (let i = 0; i < 3; i++) await confirm(S, bad);
  const g5 = await confirm(S, bad);
  check("lần sai thứ 5 → 429 locked + Retry-After 900", g5.status === 429 && g5.json.code === "locked" && g5.json.retryAfterSec === 900 && g5.headers.get("retry-after") === "900", g5);
  const gOk = await confirm(S, c2);
  check("mã ĐÚNG khi đang khoá → 429 locked, KHÔNG phiên, KHÔNG xác thực", gOk.status === 429 && !hasSession(gOk) && (await verified(S)) === false, gOk);
  const rl = await reqCode(S);
  check("đang khoá thì xin mã mới cũng bị từ chối (không lách giới hạn 5 lần bằng cách xin mã)", rl.status === 429 && rl.json.code === "locked", rl);
  check("thông báo khoá không chứa email / tên", !/@|Minh Anh/.test(JSON.stringify(rl.json) + JSON.stringify(gOk.json)));

  section("Mã hết hạn");
  const E = `het-${RUN}@test.local`;
  await regStudent(E); const ce = codeOf(E);
  await prisma.loginCode.update({ where: { email: vk(E) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const ex = await confirm(E, ce);
  check("mã đúng nhưng quá 10 phút → 401 expired, không phiên, chưa xác thực", ex.status === 401 && ex.json.code === "expired" && !hasSession(ex) && (await verified(E)) === false, ex);
  await age(E, 61_000);
  check("xin mã mới rồi dùng được", (await reqCode(E)).status === 200);
  const ce2 = codeOf(E);
  const okE = await confirm(E, ce2);
  check("mã mới đúng → 200 + phiên + emailVerified", okE.status === 200 && okE.json.success === true && hasSession(okE) && (await verified(E)) === true, okE);
  check("mã dùng MỘT lần: dòng mã bị xoá, dùng lại → expired, không phiên", (await prisma.loginCode.findUnique({ where: { email: vk(E) } })) === null && (await confirm(E, ce2)).json?.code === "expired");
  check("link xác thực chưa dùng cũng bị xoá sau khi xác thực bằng mã", (await prisma.verifyToken.count({ where: { user: { email: E } } })) === 0);
  check("landing học sinh là đường dẫn nội bộ, tutorPending false", typeof okE.json.landing === "string" && okE.json.landing.startsWith("/") && okE.json.tutorPending === false, okE.json);

  section("Gia sư đăng ký: cùng luồng, tutorPending → trang chờ duyệt");
  const T = `gs-${RUN}@test.local`;
  const rt = await regTutor(T);
  check("register-tutor 201, emailSent true, pending", rt.status === 201 && rt.json.emailSent === true && rt.json.tutorApplication === "pending", rt);
  check("thư gia sư cũng có mã + dòng nhắc Spam", /^\d{6}$/.test(codeOf(T)) && mails(T)[0].text.includes(SPAM_HINT));
  const okT = await confirm(T, codeOf(T));
  check("đúng mã → phiên + verified + tutorPending true + landing /lop-cua-toi/cho-duyet", okT.status === 200 && hasSession(okT) && okT.json.tutorPending === true && okT.json.landing === "/lop-cua-toi/cho-duyet" && (await verified(T)) === true, okT.json);

  section("Dùng mã của EMAIL KHÁC / mã đăng nhập");
  const A = `a-${RUN}@test.local`, B = `b-${RUN}@test.local`;
  await regStudent(A); await regStudent(B);
  const cA = codeOf(A), cB = codeOf(B);
  const x = await confirm(B, cA === cB ? wrongCode(cB) : cA);
  check("mã của A dùng cho B → 401 wrong, B chưa xác thực", x.status === 401 && !hasSession(x) && (await verified(B)) === false, x);
  // Cùng một mã số, hai khoá khác nhau: nhét băm của A vào B thì vẫn không khớp.
  check("băm gắn với email: cùng mã số ra băm khác giữa hai email", hashCode(vk(A), cA, SECRET) !== hashCode(vk(B), cA, SECRET));
  // Mã ĐĂNG NHẬP của A (chưa xác thực vẫn xin được) không xác thực được email.
  await post("/api/auth/code/request", { email: A });
  const loginCodeA = mails(A).at(-1)!.text.match(/của bạn: (\d{6})/)?.[1] ?? "";
  check("có thư mã ĐĂNG NHẬP cho A", /^\d{6}$/.test(loginCodeA));
  const xl = await confirm(A, loginCodeA === cA ? wrongCode(cA) : loginCodeA);
  check("mã đăng nhập dùng làm mã xác thực email → 401, A chưa xác thực", xl.status === 401 && (await verified(A)) === false, xl);
  const lg = await post("/api/auth/code/verify", { email: A, code: cA });
  check("ngược lại: mã xác thực email KHÔNG đăng nhập được (/api/auth/code/verify) và không đánh dấu verified", lg.status !== 200 && !hasSession(lg) && (await verified(A)) === false, lg.status);
  check("mã đúng của chính A vẫn xác thực được A (không bị hai dòng lẫn nhau)", (await confirm(A, cA)).status === 200 && (await verified(A)) === true);
  const lg2 = await post("/api/auth/code/verify", { email: B, code: cB });
  check("mã xác thực của B không đăng nhập được B", lg2.status !== 200 && !hasSession(lg2));

  section("Dò email: phản hồi xin mã giống hệt cho email có / không có / đã xác thực / bị khoá");
  const P = `pend-${RUN}@test.local`; await regStudent(P); await age(P, 61_000);
  const sinkBefore = readdirSync(SINK).length;
  const V = await mkUser({ name: "Đã xác thực", emailVerified: true });
  const BN = await mkUser({ name: "Bị khoá", emailVerified: false });
  await prisma.user.update({ where: { id: BN.id }, data: { banned: true } });
  const ghostMail = `khong-co-${RUN}@test.local`;
  const rPend = await reqCode(P), rGhost = await reqCode(ghostMail), rVer = await reqCode(V.email), rBan = await reqCode(BN.email);
  const shape = (r: { status: number; json: any }) => JSON.stringify({ s: r.status, k: Object.keys(r.json ?? {}).sort(), a: r.json?.resendAfterSec, e: r.json?.expiresInSec });
  check("4 phản hồi cùng khuôn (200, sent, 60, 600)", new Set([rPend, rGhost, rVer, rBan].map(shape)).size === 1 && rPend.status === 200, [rPend, rGhost, rVer, rBan].map(shape));
  const sinkAfter = readdirSync(SINK).length;
  check("chỉ email chưa xác thực THẬT nhận thư (1 thư mới); email lạ / đã xác thực / bị khoá KHÔNG nhận gì", sinkAfter - sinkBefore === 1 && mails(ghostMail).length === 0 && mails(V.email).length === 0 && mails(BN.email).length === 0, sinkAfter - sinkBefore);
  const w2 = [await reqCode(ghostMail), await reqCode(P)];
  check("lần 2 ngay: email lạ và email thật cùng 429 wait cùng khuôn", w2[0].status === 429 && w2[1].status === 429 && w2[0].json.code === "wait" && w2[1].json.code === "wait" && Object.keys(w2[0].json).sort().join() === Object.keys(w2[1].json).sort().join(), w2.map(r => r.json));
  // Đã xin mã trước (rVer / rGhost): hai bên đều đi nhánh MÔ PHỎNG nên trả cùng "wrong, còn 4 lần"; chưa xin mã: cùng "expired".
  const cv = await confirm(V.email, "123456"), cg = await confirm(`khac-${RUN}@test.local`, "123456");
  const V2 = await mkUser({ name: "Đã xác thực 2", emailVerified: true });
  const cv2 = await confirm(V2.email, "123456"), cg2 = await confirm(`khac2-${RUN}@test.local`, "123456");
  check("đoán mã cho email đã xác thực vs email lạ: cùng khuôn (đã xin mã: wrong; chưa xin: expired), không phiên",
    cv.status === 401 && cv.json.code === "wrong" && cv.json.attemptsLeft === 4 && cv2.json.code === "expired" && cg2.json.code === "expired" && cv2.status === cg2.status && !hasSession(cv) && !hasSession(cv2), [cv.json, cv2.json, cg2.json]);
  const cb = await confirm(BN.email, "123456");
  check("tài khoản bị khoá không xác thực bằng mã để lấy phiên", cb.status === 401 && !hasSession(cb));
  const ghostLock = [];
  for (let i = 0; i < 5; i++) ghostLock.push(await confirm(ghostMail, "123456"));
  check("email lạ cũng bị khoá sau 5 lần sai (mô phỏng, giống email thật)", ghostLock.at(-1)!.status === 429 && ghostLock.at(-1)!.json.code === "locked", ghostLock.map(r => r.status));

  section("Gửi lại hàng loạt");
  const F = `flood-${RUN}@test.local`; await regStudent(F);
  const ipF = nextIp();
  const burst = [];
  for (let i = 0; i < 8; i++) burst.push(await reqCode(F, ipF));
  check("tám lần xin mã liên tiếp từ MỘT IP: không quá 1 thư mới (còn lại chờ 60 giây)", mails(F).length === 1, mails(F).length);
  const oneIp = nextIp(); let first429 = 0;
  for (let i = 0; i < 12; i++) { const r = await reqCode(`ip-${i}-${RUN}@test.local`, oneIp); if (r.status === 429 && !first429) first429 = i + 1; }
  check("một IP xin mã cho nhiều email: bị chặn 429 từ lần thứ 11", first429 === 11, first429);
  const target = `tam-${RUN}@test.local`; await regStudent(target);
  let blockedAt = 0;
  for (let i = 0; i < 9; i++) { await age(target, 61_000).catch(() => {}); const r = await reqCode(target, nextIp()); if (r.status === 429 && r.json.retryAfterSec === 600 && !blockedAt) blockedAt = i + 1; }
  check("đổi IP liên tục nhắm MỘT email: bị chặn theo email (429, 600 giây) trước lần 8", blockedAt > 0 && blockedAt <= 7, blockedAt);
  check("số thư tới email bị nhắm ≤ 7 (đăng ký + tối đa 6 lần gửi lại trong 10 phút)", mails(target).length <= 7, mails(target).length);

  section("Đoán mã song song: tối đa 5 lần so được");
  const Q = `song2-${RUN}@test.local`; await regStudent(Q); const cq = codeOf(Q);
  const guesses = await Promise.all(Array.from({ length: 25 }, (_, i) => confirm(Q, (String(200000 + i) === cq ? "299999" : String(200000 + i)), nextIp())));
  const q = await prisma.loginCode.findUnique({ where: { email: vk(Q) } });
  check("25 lần đoán song song: attempts ≤ 5, đã khoá", !!q && q.attempts <= 5 && !!q.lockedUntil, q);
  check("không lần nào tạo phiên / xác thực", guesses.every(g => !hasSession(g)) && (await verified(Q)) === false);
  check("đúng mã sau khi khoá vẫn bị từ chối", (await confirm(Q, cq)).status === 429);

  section("Mã đúng gửi song song: chỉ MỘT yêu cầu thắng");
  const Z = `dung-${RUN}@test.local`; await regStudent(Z); const cz = codeOf(Z);
  const race = await Promise.all(Array.from({ length: 6 }, () => confirm(Z, cz, nextIp())));
  check("đúng 1 yêu cầu 200 có phiên", race.filter(r => r.status === 200 && hasSession(r)).length === 1, race.map(r => r.status));

  section("Link cũ trong thư vẫn dùng được; xác thực bằng link xoá mã còn lại");
  const L = `link-${RUN}@test.local`; await regStudent(L);
  const tok = linkOf(L), cl = codeOf(L);
  const lr = await fetch(`${BASE}/api/auth/verify-email?token=${tok}`, { headers: { "x-forwarded-for": nextIp() } });
  const lj = await lr.json();
  check("GET /api/auth/verify-email?token= → success, verified", lr.status === 200 && lj.success === true && (await verified(L)) === true, lj);
  check("mã 6 số còn lại bị xoá, dùng không được nữa", (await prisma.loginCode.findUnique({ where: { email: vk(L) } })) === null && (await confirm(L, cl)).status === 401);
  const L2 = `link2-${RUN}@test.local`; await regStudent(L2); const tok1 = linkOf(L2); await age(L2, 61_000); await reqCode(L2);
  const lr2 = await fetch(`${BASE}/api/auth/verify-email?token=${tok1}`);
  check("link của thư ĐẦU vẫn dùng được sau khi đã gửi lại mã", (await lr2.json()).success === true);

  section("Băng vàng: người dùng chưa xác thực đăng nhập rồi nhận mã (resend-verification)");
  const old = await mkUser({ name: "Người cũ", emailVerified: false });
  const rv = await post("/api/auth/resend-verification", {}, { cookie: await cookieFor(old) });
  check("200 success, kèm resendAfterSec 60", rv.status === 200 && rv.json.success === true && rv.json.resendAfterSec === 60, rv);
  const co = codeOf(old.email);
  check("thư tới người cũ có mã 6 số + dòng nhắc Spam", /^\d{6}$/.test(co) && mails(old.email).at(-1)!.text.includes(SPAM_HINT));
  const rv2 = await post("/api/auth/resend-verification", {}, { cookie: await cookieFor(old) });
  check("bấm lại ngay → 429 wait (không gửi thêm thư)", rv2.status === 429 && rv2.json.code === "wait" && mails(old.email).length === 1, rv2);
  const ok2 = await confirm(old.email, co);
  check("nhập mã → verified", ok2.status === 200 && (await verified(old.email)) === true);
  const rv3 = await post("/api/auth/resend-verification", {}, { cookie: await cookieFor(old) });
  check("đã xác thực rồi → 400", rv3.status === 400);
  check("chưa đăng nhập → 401", (await post("/api/auth/resend-verification", {})).status === 401);

  section("Thông báo không lộ tên / email người khác");
  const leak = JSON.stringify([w, rs, g1, g5, ex, x, cv, cg, cv2, cg2]);
  check("không phản hồi nào chứa email / tên người dùng", !leak.includes("@test.local") && !leak.includes("Minh Anh") && !leak.includes("Cô Lan"));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
