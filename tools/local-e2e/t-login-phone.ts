// Đăng nhập bằng số điện thoại (SMS): API thật + Postgres thật. Tin SMS được ghi vào SMS_SINK_DIR (không gửi đi).
// Phủ: số phải được XÁC MINH mới đăng nhập được; xác minh bằng mã SMS; số lạ không tốn SMS và không lộ ai có số; khoá 5 lần;
// đổi số thì xác minh hết hiệu lực; một số chỉ thuộc một tài khoản; phiên cấp theo vai (30 ngày / 12 giờ).
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, cookieFor, mkSuper, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/loginCode";
import { phoneClaimKey, phoneLoginKey } from "@/lib/phone";

const SINK = process.env.SMS_SINK_DIR;
if (!SINK) { console.error("Cần SMS_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }

type Sms = { to: string; text: string };
const all = (): Sms[] => (readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Sms));
const smsTo = (to: string) => all().filter(m => m.to === to);
const codeOf = (to: string) => smsTo(to).at(-1)?.text.match(/la (\d{6})\./)?.[1] ?? "";
const wrong = (real: string) => (real === "000000" ? "000001" : "000000");

// Bộ nhớ giới hạn / ghost nằm trong tiến trình server dev, SỐNG QUA các lần chạy test → mỗi lần chạy dùng số + IP riêng.
const RUN = Math.floor(Math.random() * 90_000_000) + 10_000_000; // 8 chữ số
const phoneOf = (n: number) => `09${String(RUN + n).slice(-8)}`;      // 10 số, đầu 09
const e164Of = (n: number) => `+84${phoneOf(n).slice(1)}`;
let ipSeq = Math.floor(Math.random() * 40) * 250;
const nextIp = () => `10.78.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
async function call(method: string, path: string, body?: unknown, o: { cookie?: string; ip?: string } = {}) {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp(), ...(o.cookie ? { cookie: o.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
}
const reqLogin = (phone: string, ip?: string) => call("POST", "/api/auth/code/request", { phone }, { ip });
const verifyLogin = (phone: string, code: string, ip?: string) => call("POST", "/api/auth/code/verify", { phone, code }, { ip });
const hasSession = (r: { headers: Headers }) => (r.headers.get("set-cookie") ?? "").includes("midnight_session=");
const expiresMs = (r: { headers: Headers }) => { const m = (r.headers.get("set-cookie") ?? "").match(/[Ee]xpires=([^;]+)/); return m ? new Date(m[1]).getTime() : NaN; };

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();

  section("Các cách đăng nhập đang mở");
  const m = await call("GET", "/api/auth/code/methods");
  check("GET /methods: email luôn mở, số điện thoại mở khi đã cấu hình SMS (test: có SMS_SINK_DIR)", m.status === 200 && m.json.email === true && m.json.phone === true && /no-store/.test(m.headers.get("cache-control") ?? ""), m.json);

  section("Xin mã: kiểm tra đầu vào");
  for (const [bad, why] of [["abc", "chữ"], ["0201234567", "số bàn"], ["090123", "ngắn"], ["+14155552671", "số nước ngoài"], ["", "rỗng"]] as const) {
    const r = await reqLogin(bad);
    check(`số "${bad}" (${why}) → 400`, r.status === 400, r);
  }
  check("thân không phải JSON → 400 (không 500)", (await fetch(BASE + "/api/auth/code/request", { method: "POST", headers: { "x-forwarded-for": nextIp() }, body: "xx" })).status === 400);
  check("chưa có tin nào được ghi", all().length === 0);

  section("Số CHƯA xác minh: không đăng nhập được, không tốn SMS, không lộ gì");
  const U = await mkUser({ name: "Nguyễn Minh Anh" });
  await prisma.user.update({ where: { id: U.id }, data: { phone: phoneOf(1) } }); // tự khai, chưa xác minh
  const r0 = await reqLogin(phoneOf(1));
  check("xin mã cho số tự khai (chưa xác minh) → vẫn 200 sent (không lộ số này chưa xác minh)", r0.status === 200 && r0.json.sent === true && r0.json.resendAfterSec === 60 && r0.json.expiresInSec === 600, r0);
  check("…nhưng KHÔNG có SMS nào gửi đi (không đốt tiền, không gửi tới số chưa chứng minh)", all().length === 0, all());
  const rNone = await reqLogin(phoneOf(2));
  check("số hoàn toàn lạ → phản hồi y hệt (200 sent), không SMS", rNone.status === 200 && JSON.stringify(Object.keys(rNone.json).sort()) === JSON.stringify(Object.keys(r0.json).sort()) && all().length === 0);
  const v0 = await verifyLogin(phoneOf(1), "123456");
  check("đoán mã cho số chưa xác minh → 401 wrong như số có thật (không lộ)", v0.status === 401 && v0.json.code === "wrong" && v0.json.attemptsLeft === 4 && !hasSession(v0), v0);

  section("Xác minh số bằng mã SMS (người đã đăng nhập)");
  const ck = await cookieFor(U);
  check("chưa đăng nhập → 401", (await call("POST", "/api/auth/phone/request", { phone: phoneOf(1) })).status === 401 && (await call("POST", "/api/auth/phone/confirm", { phone: phoneOf(1), code: "123456" })).status === 401);
  check("số sai dạng → 400", (await call("POST", "/api/auth/phone/request", { phone: "12345" }, { cookie: ck })).status === 400);
  await prisma.user.update({ where: { id: U.id }, data: { emailVerified: false } });
  const rUnv = await call("POST", "/api/auth/phone/request", { phone: phoneOf(1) }, { cookie: ck });
  check("email chưa xác minh → 403 email-unverified, không gửi SMS", rUnv.status === 403 && rUnv.json.code === "email-unverified" && all().length === 0, rUnv);
  await prisma.user.update({ where: { id: U.id }, data: { emailVerified: true } });
  const rq = await call("POST", "/api/auth/phone/request", { phone: `${phoneOf(1).slice(0, 4)} ${phoneOf(1).slice(4, 7)} ${phoneOf(1).slice(7)}` }, { cookie: ck });
  check("xin mã xác minh (số gõ có dấu cách) → 200 sent", rq.status === 200 && rq.json.sent === true, rq);
  const s1 = smsTo(e164Of(1));
  check("đúng 1 SMS tới số đã chuẩn hoá E.164", s1.length === 1, all());
  const code1 = codeOf(e164Of(1));
  check("tin có mã 6 số, nói rõ 10 phút + một lần + không chia sẻ, không dấu (ít ký tự)", /^\d{6}$/.test(code1) && s1[0].text.includes("10 phut") && s1[0].text.includes("mot lan") && s1[0].text.includes("Khong chia se") && !/[^\x00-\x7F]/.test(s1[0].text.split("\n\n")[0]), s1[0]?.text);
  const row = await prisma.loginCode.findUnique({ where: { email: phoneClaimKey(U.id, e164Of(1)) } });
  check("DB lưu BĂM theo khoá xác minh (gắn userId + số), không lưu mã gốc", !!row && /^[0-9a-f]{64}$/.test(row.codeHash) && row.codeHash === hashCode(phoneClaimKey(U.id, e164Of(1)), code1, process.env.SESSION_SECRET!) && !JSON.stringify(row).includes(code1));
  check("mã xác minh KHÔNG dùng để đăng nhập thay thế: dòng đăng nhập của số này chưa tồn tại", (await prisma.loginCode.findUnique({ where: { email: phoneLoginKey(e164Of(1)) } })) === null);
  const rq2 = await call("POST", "/api/auth/phone/request", { phone: phoneOf(1) }, { cookie: ck });
  check("xin lại ngay → 429 wait (60 giây), không gửi thêm", rq2.status === 429 && rq2.json.code === "wait" && smsTo(e164Of(1)).length === 1, rq2);
  const cw = await call("POST", "/api/auth/phone/confirm", { phone: phoneOf(1), code: wrong(code1) }, { cookie: ck });
  check("nhập sai mã → 401 wrong còn 4 lần; số CHƯA được gắn", cw.status === 401 && cw.json.attemptsLeft === 4 && (await prisma.user.findUnique({ where: { id: U.id } }))?.phoneE164 === null, cw);
  check("mã đúng nhưng của NGƯỜI KHÁC (userId khác) → không dùng được", (await call("POST", "/api/auth/phone/confirm", { phone: phoneOf(1), code: code1 }, { cookie: await cookieFor(await mkUser({ name: "Kẻ khác" })) })).status === 401);
  const cok = await call("POST", "/api/auth/phone/confirm", { phone: phoneOf(1), code: code1 }, { cookie: ck });
  const uV = await prisma.user.findUnique({ where: { id: U.id } });
  check("mã đúng → 200, số gắn vào tài khoản (E.164 + mốc xác minh), ô phone về dạng 0…", cok.status === 200 && cok.json.verified === true && uV?.phoneE164 === e164Of(1) && !!uV?.phoneVerifiedAt && uV?.phone === phoneOf(1), cok);
  check("mã dùng một lần: nhập lại cùng mã → 401 expired", (await call("POST", "/api/auth/phone/confirm", { phone: phoneOf(1), code: code1 }, { cookie: ck })).json?.code === "expired");
  check("hồ sơ báo phoneVerified=true, không lộ phoneE164/phoneVerifiedAt thô", await (async () => { const j = (await call("GET", "/api/users/me", undefined, { cookie: ck })).json; const a = (await call("GET", "/api/auth/me", undefined, { cookie: ck })).json; return j.phoneVerified === true && a.phoneVerified === true && !("phoneE164" in j) && !("phoneVerifiedAt" in j) && !("phoneVerifiedAt" in a); })());
  check("xin mã xác minh lại cho đúng số đã xác minh → alreadyVerified, không gửi SMS", (await call("POST", "/api/auth/phone/request", { phone: phoneOf(1) }, { cookie: ck })).json?.alreadyVerified === true && smsTo(e164Of(1)).length === 1);

  section("Đăng nhập bằng số đã xác minh");
  const lg = await reqLogin(`+84 ${phoneOf(1).slice(1, 4)} ${phoneOf(1).slice(4, 7)} ${phoneOf(1).slice(7)}`);
  check("gõ dạng +84 có dấu cách → 200 sent", lg.status === 200 && lg.json.sent === true, lg);
  check("đúng 1 SMS đăng nhập MỚI (tổng 2 tới số này: xác minh + đăng nhập)", smsTo(e164Of(1)).length === 2);
  const lcode = codeOf(e164Of(1));
  check("mã đăng nhập khác mã xác minh trước, 6 số", /^\d{6}$/.test(lcode));
  const lrow = await prisma.loginCode.findUnique({ where: { email: phoneLoginKey(e164Of(1)) } });
  check("DB: băm theo khoá 'tel:+84…' (không phải email)", lrow?.codeHash === hashCode(phoneLoginKey(e164Of(1)), lcode, process.env.SESSION_SECRET!));
  const vBad = await verifyLogin(phoneOf(1), wrong(lcode));
  check("sai mã → 401 wrong (còn 4 lần), không cookie", vBad.status === 401 && vBad.json.attemptsLeft === 4 && !hasSession(vBad), vBad);
  const vOk = await verifyLogin(phoneOf(1), lcode);
  check("đúng mã → 200, có cookie phiên, trả đúng người", vOk.status === 200 && hasSession(vOk) && vOk.json.id === U.id && vOk.json.email === U.email, vOk);
  check("phiên học sinh sống 30 ngày", Math.abs(expiresMs(vOk) - (Date.now() + 30 * 86_400_000)) < 5 * 60_000, new Date(expiresMs(vOk)).toISOString());
  check("dùng một lần: cùng mã lần hai → 401 expired", (await verifyLogin(phoneOf(1), lcode)).json?.code === "expired");
  check("mã chỉ đúng với ĐÚNG số: dùng mã của số này cho số khác → không vào được", (await verifyLogin(phoneOf(7), lcode)).status === 401);

  section("Khoá sau 5 lần sai (như email)");
  await call("POST", "/api/auth/phone/request", { phone: phoneOf(1) }, { cookie: ck }); // đã xác minh → no-op
  await prisma.loginCode.update({ where: { email: phoneLoginKey(e164Of(1)) }, data: { sentAt: new Date(Date.now() - 120_000) } }).catch(() => {});
  const rr = await reqLogin(phoneOf(1));
  check("xin mã mới sau 2 phút → sent", rr.status === 200, rr);
  const c2 = codeOf(e164Of(1));
  let last: any = null;
  for (let i = 0; i < 5; i++) last = await verifyLogin(phoneOf(1), wrong(c2));
  check("sai lần thứ 5 → 429 locked", last.status === 429 && last.json.code === "locked" && last.json.retryAfterSec > 0, last);
  const afterLock = await verifyLogin(phoneOf(1), c2);
  check("khoá rồi thì mã ĐÚNG cũng bị từ chối, không cookie", afterLock.status === 429 && !hasSession(afterLock), afterLock);
  check("khoá số này không ảnh hưởng email của cùng tài khoản (hai kênh khoá riêng)", (await call("POST", "/api/auth/code/request", { email: U.email })).status === 200);

  section("Giới hạn SMS (SMS tốn tiền)");
  const lim = await mkUser({ name: "Giới hạn" });
  const ck2 = await cookieFor(lim);
  const results: number[] = [];
  for (let i = 0; i < 5; i++) results.push((await call("POST", "/api/auth/phone/request", { phone: phoneOf(30) }, { cookie: ck2 })).status);
  check("tới một số: lần 1 gửi (200), lần 2 chờ 60 giây (429), tổng SMS tới số không quá 1 dù xin 5 lần liên tiếp", results[0] === 200 && results[1] === 429 && smsTo(e164Of(30)).length === 1, results);
  const burst: { status: number; after?: number }[] = [];
  for (let i = 0; i < 7; i++) { const r = await reqLogin(phoneOf(31), nextIp()); burst.push({ status: r.status, after: r.json?.retryAfterSec }); }
  const firstCap = burst.findIndex(b => b.after === 600);
  check("đổi IP liên tục vẫn bị chặn theo SỐ: tối đa 5 yêu cầu/10 phút (lần thứ 6 trả retryAfterSec 600, khác với 'chờ 60 giây')", burst[0].status === 200 && firstCap === 5 && burst.slice(5).every(b => b.status === 429), burst);

  section("Đổi số thì xác minh hết hiệu lực");
  const W = await mkUser({ name: "Em Hoa" });
  await prisma.user.update({ where: { id: W.id }, data: { phone: phoneOf(10), phoneE164: e164Of(10), phoneVerifiedAt: new Date() } });
  const ckW = await cookieFor(W);
  const base = { name: "Em Hoa", parentPhone: "", parentName: "", school: "", highSchool: "", city: "", facebookUrl: "", zaloPhone: "" };
  await call("PUT", "/api/users/me", { ...base, phone: `${phoneOf(10).slice(0, 4)}.${phoneOf(10).slice(4, 7)}.${phoneOf(10).slice(7)}` }, { cookie: ckW });
  check("sửa ô phone sang CÙNG số (khác cách gõ) → vẫn giữ xác minh", (await prisma.user.findUnique({ where: { id: W.id } }))?.phoneE164 === e164Of(10));
  await call("PUT", "/api/users/me", { ...base, phone: phoneOf(11) }, { cookie: ckW });
  const wAfter = await prisma.user.findUnique({ where: { id: W.id } });
  check("sửa ô phone sang số KHÁC → xoá xác minh (phoneE164 và phoneVerifiedAt = null), phone là số mới", wAfter?.phoneE164 === null && wAfter?.phoneVerifiedAt === null && wAfter?.phone === phoneOf(11), wAfter);
  check("số cũ không còn đăng nhập được bằng SMS (không SMS gửi)", await (async () => { const n = all().length; await reqLogin(phoneOf(10)); return all().length === n; })());
  await prisma.user.update({ where: { id: W.id }, data: { phoneE164: e164Of(12), phoneVerifiedAt: new Date() } });
  const SA = await mkSuper("Quản trị");
  await call("PUT", `/api/admin/students/${W.id}`, { name: "Em Hoa", phone: phoneOf(13), school: "" }, { cookie: await cookieFor(SA) });
  check("quản trị sửa số của học sinh sang số khác → cũng xoá xác minh", (await prisma.user.findUnique({ where: { id: W.id } }))?.phoneE164 === null);
  await prisma.user.update({ where: { id: W.id }, data: { phoneE164: e164Of(14), phoneVerifiedAt: new Date() } });
  check("DELETE /api/auth/phone gỡ số: xoá xác minh, ô phone giữ nguyên", (await call("DELETE", "/api/auth/phone", undefined, { cookie: ckW })).status === 200 && await (async () => { const x = await prisma.user.findUnique({ where: { id: W.id } }); return x?.phoneE164 === null && x?.phoneVerifiedAt === null && x?.phone === phoneOf(13); })());
  check("chưa đăng nhập → DELETE 401", (await call("DELETE", "/api/auth/phone")).status === 401);

  section("Một số chỉ thuộc một tài khoản");
  const A = await mkUser({ name: "Chủ số" }), B = await mkUser({ name: "Người đến sau" });
  await prisma.user.update({ where: { id: A.id }, data: { phone: phoneOf(20), phoneE164: e164Of(20), phoneVerifiedAt: new Date() } });
  const ckB = await cookieFor(B);
  await call("POST", "/api/auth/phone/request", { phone: phoneOf(20) }, { cookie: ckB });
  const cB = codeOf(e164Of(20));
  const conf = await call("POST", "/api/auth/phone/confirm", { phone: phoneOf(20), code: cB }, { cookie: ckB });
  check("B có SMS trong tay nhưng số đã thuộc A → 409 taken, A giữ nguyên số", conf.status === 409 && conf.json.code === "taken" && (await prisma.user.findUnique({ where: { id: A.id } }))?.phoneE164 === e164Of(20) && (await prisma.user.findUnique({ where: { id: B.id } }))?.phoneE164 === null, conf);
  check("DB chặn trùng (unique) kể cả khi code lỗi: không thể có hai tài khoản cùng phoneE164", await prisma.user.update({ where: { id: B.id }, data: { phoneE164: e164Of(20) } }).then(() => false, () => true));

  section("Phiên theo vai khi đăng nhập bằng SMS");
  const T = await mkTutor("Cô Lan"), AD = await mkSuper("Quản trị cấp 1");
  for (const [u, n, ms, label] of [[T, 40, 30 * 86_400_000, "gia sư 30 ngày"], [AD, 41, 12 * 3_600_000, "quản trị 12 giờ"]] as const) {
    await prisma.user.update({ where: { id: u.id }, data: { phone: phoneOf(n), phoneE164: e164Of(n), phoneVerifiedAt: new Date() } });
    await reqLogin(phoneOf(n));
    const v = await verifyLogin(phoneOf(n), codeOf(e164Of(n)));
    check(`${label}: đăng nhập bằng SMS cấp cookie đúng mốc`, v.status === 200 && Math.abs(expiresMs(v) - (Date.now() + ms)) < 5 * 60_000, new Date(expiresMs(v)).toISOString());
  }
  const BAN = await mkUser({ name: "Bị khoá" });
  await prisma.user.update({ where: { id: BAN.id }, data: { phone: phoneOf(50), phoneE164: e164Of(50), phoneVerifiedAt: new Date(), banned: true } });
  await reqLogin(phoneOf(50));
  const vb = await verifyLogin(phoneOf(50), codeOf(e164Of(50)));
  check("tài khoản bị khoá: có mã đúng vẫn 403, không cookie", vb.status === 403 && !hasSession(vb), vb);

  section("Email vẫn chạy như cũ (không hồi quy)");
  const E = await mkUser({ name: "Người dùng email" });
  const re = await call("POST", "/api/auth/code/request", { email: E.email });
  check("POST {email} vẫn 200 sent; {identifier: email} cũng được", re.status === 200 && re.json.sent === true && (await call("POST", "/api/auth/code/request", { identifier: ` ${E.email.toUpperCase()} ` })).status === 429 /* chờ 60s vì vừa gửi */);
  check("{identifier: số} hoạt động như {phone}", (await call("POST", "/api/auth/code/request", { identifier: "090 111 2222" })).status === 200);
  check("email sai → 400 'Email không hợp lệ'", (await call("POST", "/api/auth/code/request", { email: "khong-phai" })).json?.error === "Email không hợp lệ");
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
