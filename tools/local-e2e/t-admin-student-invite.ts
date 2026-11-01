// Học sinh do QUẢN TRỊ thêm (POST /api/admin/students): thư đặt mật khẩu phải dùng được, và "Quên mật khẩu" sau đó phải gửi thư (01/11/2026).
//
// Hai lỗi cũ nối nhau, đều ra đúng chuỗi người dùng kể ("đăng nhập báo sai", "quên mật khẩu không có thư", "đăng ký lại không được"):
//   1. Route này lưu token đặt mật khẩu NGUYÊN VĂN, còn /api/auth/reset-password tra bằng BẢN BĂM HMAC (từ 15/10) → link trong thư luôn "không hợp lệ".
//      Học sinh được thêm không có mật khẩu nào dùng được (mật khẩu ban đầu là chuỗi ngẫu nhiên không ai biết).
//   2. Hạn của link này là 24 giờ, mà planRequest suy "giờ gửi = hạn − 30 phút" → giờ gửi nằm ở TƯƠNG LAI → coi là "vừa gửi, chờ 60 giây" gần 24 giờ:
//      bấm "Quên mật khẩu" trả "đã gửi" (kèm đếm ngược hàng nghìn phút) nhưng KHÔNG gửi thư nào. Cả những dòng cũ đang nằm sẵn trên production cũng dính.
// Đăng ký lại với email đó thì 409 "Email này đã được đăng ký" — không còn lối nào vào.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { BASE, mkSuper, mkUser, wipe, api, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }
type Mail = { to: string; subject: string; text: string };
const tokensTo = (to: string) => readdirSync(SINK).sort()
  .map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail)
  .filter(m => m.to === to).map(m => m.text.match(/token=([0-9a-f]{64})/)?.[1] ?? "").filter(Boolean);
let ip = Math.floor(Math.random() * 200);
const fresh = () => ({ "x-forwarded-for": `10.66.${Math.floor(Math.random() * 250)}.${++ip % 250}` }); // mỗi lần một "máy": không vướng giới hạn theo IP
const forgot = (email: string) => api("POST", "/api/auth/forgot-password", { body: { email }, headers: fresh() });
const valid = async (token: string) => (await api("GET", `/api/auth/reset-password?token=${token}`, { headers: fresh() })).json;

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  const admin = await mkSuper("Quản trị");
  const stamp = Date.now();

  section("1. Quản trị thêm học sinh → link trong thư dùng được");
  const e1 = `uyen.${stamp}@example.com`;
  const r1 = await api("POST", "/api/admin/students", { as: admin, body: { name: "Phương Uyên", email: e1 } });
  check("thêm học sinh: 200", r1.status === 200, r1);
  await eventually("thư đặt mật khẩu tới hộp thư", () => tokensTo(e1).length === 1, 20000);
  const t1 = tokensTo(e1)[0] ?? "";
  check("thư có link 64 ký tự", t1.length === 64);
  const v1 = await valid(t1);
  check("link trong thư HỢP LỆ (bản cũ: lưu nguyên văn nên tra bằng bản băm không thấy)", v1?.valid === true, v1);
  const set = await api("POST", "/api/auth/reset-password", { body: { token: t1, password: "matkhau2026x" }, headers: fresh() });
  check("đặt mật khẩu bằng link: 200", set.status === 200, set);
  const login = await api("POST", "/api/auth/login", { body: { identifier: e1.toUpperCase(), password: "matkhau2026x" }, headers: fresh() });
  check("đăng nhập bằng mật khẩu vừa đặt: 200", login.status === 200, login);
  check("link chỉ dùng một lần: dùng lại → không hợp lệ", (await valid(t1))?.valid === false);

  section("2. Quên mật khẩu ngay sau khi quản trị thêm → vẫn gửi thư mới");
  const e2 = `hs2.${stamp}@example.com`;
  await api("POST", "/api/admin/students", { as: admin, body: { name: "Học sinh Hai", email: e2 } });
  await eventually("thư chào mừng tới", () => tokensTo(e2).length === 1, 20000);
  const f2 = await forgot(e2);
  check("xin link: 200", f2.status === 200, f2);
  check("đếm ngược gửi lại ≤ 60 giây (bản cũ: ~84.660 giây = gần 24 giờ)", typeof f2.json?.resendAfterSec === "number" && f2.json.resendAfterSec <= 60, f2.json);
  await eventually("MỘT thư mới được gửi (bản cũ: im lặng, không thư nào)", () => tokensTo(e2).length === 2, 20000);
  const [old2, new2] = tokensTo(e2);
  check("thư mới mang link khác và link mới dùng được", !!new2 && new2 !== old2 && (await valid(new2))?.valid === true);

  section("3. Dòng CŨ đang nằm trên production (token nguyên văn, hạn 24 giờ) → Quên mật khẩu vẫn gửi thư thay thế");
  const S3 = await mkUser({ name: "Học sinh Ba" });
  const plain = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({ data: { token: plain, userId: S3.id, expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  check("dòng cũ có sẵn: link nguyên văn KHÔNG hợp lệ (đúng như production)", (await valid(plain))?.valid === false);
  const f3 = await forgot(S3.email);
  check("xin link: 200, đếm ngược ≤ 60 giây", f3.status === 200 && f3.json?.resendAfterSec <= 60, f3.json);
  await eventually("thư mới được gửi", () => tokensTo(S3.email).length === 1, 20000);
  check("dòng cũ bị thay (chỉ còn đúng 1 link, là link mới)", (await prisma.passwordResetToken.count({ where: { userId: S3.id } })) === 1 && (await valid(tokensTo(S3.email)[0]))?.valid === true);

  section("4. Không phá luật cũ: hai lần xin liên tiếp → lần hai phải CHỜ, không gửi thêm");
  const S4 = await mkUser({ name: "Học sinh Bốn" });
  const a = await forgot(S4.email);
  await eventually("lần một: có thư", () => tokensTo(S4.email).length === 1, 20000);
  const b = await forgot(S4.email);
  check("cả hai trả 200", a.status === 200 && b.status === 200);
  check("lần hai: đếm ngược trong khoảng 1..60 giây (đang chờ)", b.json?.resendAfterSec >= 1 && b.json?.resendAfterSec <= 60, b.json);
  await new Promise(r => setTimeout(r, 2500));
  check("lần hai KHÔNG gửi thêm thư (vẫn 1 thư, link cũ còn sống)", tokensTo(S4.email).length === 1 && (await valid(tokensTo(S4.email)[0]))?.valid === true);

  void BASE;
  await done();
})().catch(e => { console.error(e); process.exit(1); });
