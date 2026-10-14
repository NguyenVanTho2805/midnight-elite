// Đăng nhập bằng TÀI KHOẢN + MẬT KHẨU (đường chính từ 14/10/2026): API thật + Postgres thật.
// Phủ: email / số di động đã xác minh; không lộ tài khoản (cùng câu, cùng thời gian); chặn dò theo máy; chỉ làm chậm theo tài khoản
// (mật khẩu đúng luôn vào được); tài khoản khoá; dữ liệu xấu. Lưu ý: ĐOẠN CHẶN THEO MÁY phải chờ qua một phút thật (giới hạn 10 lần/phút
// chặn trước), nên bài này chạy khoảng 2 phút.
import bcrypt from "bcryptjs";
import { BASE, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

// Bộ đếm nằm trong tiến trình server dev, SỐNG QUA các lần chạy → mỗi lần chạy dùng IP + tài khoản riêng.
const RUN = Math.floor(Math.random() * 90_000_000) + 10_000_000;
let ipSeq = Math.floor(Math.random() * 40) * 250;
const nextIp = () => `10.99.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
async function login(body: unknown, ip: string = nextIp()) {
  const t0 = Date.now();
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers, ms: Date.now() - t0 };
}
const cookieOf = (r: { headers: Headers }) => r.headers.get("set-cookie") ?? "";
const hasSession = (r: { headers: Headers }) => cookieOf(r).includes("midnight_session=");
const PW = "Passw0rd!";
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const phoneOf = (n: number) => `09${String(RUN + n).slice(-8)}`;

(async () => {
  await wipe();
  const U = await mkUser({ name: "Nguyễn Minh Anh" });
  const T = await mkUser({ name: "Cô Lan", role: "admin" });
  await prisma.user.update({ where: { id: T.id }, data: { adminRole: "teacher", tutorVerified: true } });

  section("Email + mật khẩu đúng");
  const a = await login({ identifier: U.email, password: PW });
  check("200 + cookie phiên midnight_session (HttpOnly)", a.status === 200 && hasSession(a) && /HttpOnly/i.test(cookieOf(a)), a);
  check("trả thông tin người dùng, KHÔNG có mật khẩu/băm", a.json.id === U.id && a.json.email === U.email && a.json.role === "student" && !("password" in a.json) && !/\$2[aby]\$/.test(a.text), a.json);
  const b = await login({ identifier: `  ${U.email.toUpperCase()}  `, password: PW });
  check("email viết hoa + khoảng trắng hai đầu vẫn vào được", b.status === 200 && hasSession(b), b);
  const c = await login({ email: U.email, password: PW });
  check("tên cũ `email` trong thân vẫn dùng được", c.status === 200 && hasSession(c), c);
  const d = await login({ identifier: T.email, password: PW });
  check("gia sư vào được, trả đúng vai", d.status === 200 && d.json.role === "admin" && d.json.adminRole === "teacher", d);

  section("Sai mật khẩu / sai tài khoản: cùng một câu, không lộ ai có tài khoản");
  const w1 = await login({ identifier: U.email, password: "sai-mat-khau" });
  const w2 = await login({ identifier: `khong.co.${RUN}@test.local`, password: "sai-mat-khau" });
  check("sai mật khẩu → 401, không cookie", w1.status === 401 && !hasSession(w1), w1);
  check("email không tồn tại → 401, không cookie", w2.status === 401 && !hasSession(w2), w2);
  check("hai trường hợp trả CÙNG nội dung 'Email hoặc mật khẩu không đúng'", w1.text === w2.text && w1.json.error === "Email hoặc mật khẩu không đúng", [w1.text, w2.text]);

  section("Cùng thời gian phản hồi (email lạ cũng chạy bcrypt)");
  const K = await mkUser({ name: "Băm độ khó 10" });
  await prisma.user.update({ where: { id: K.id }, data: { password: await bcrypt.hash(PW, 10) } }); // giống băm thật ở production (độ khó 10)
  await login({ identifier: `warm.${RUN}@test.local`, password: "x" }); // khởi động băm giả (lần đầu tính một lần)
  const known: number[] = [], unknown: number[] = [];
  for (let i = 0; i < 5; i++) {
    known.push((await login({ identifier: K.email, password: `sai-${i}` })).ms);
    unknown.push((await login({ identifier: `la.${RUN}.${i}@test.local`, password: `sai-${i}` })).ms);
  }
  const mk = median(known), mu = median(unknown);
  check(`thời gian trung vị: tài khoản có thật ${mk}ms ≈ email lạ ${mu}ms (chênh không quá 1,7 lần — bản cũ: email lạ trả lời gần như tức thì)`, mu / mk > 0.6 && mu / mk < 1.7 && mu > 15, { known, unknown });

  section("Số điện thoại làm tài khoản: chỉ số ĐÃ XÁC MINH");
  const P = await mkUser({ name: "Có số xác minh" });
  await prisma.user.update({ where: { id: P.id }, data: { phone: phoneOf(1), phoneE164: `+84${phoneOf(1).slice(1)}`, phoneVerifiedAt: new Date() } });
  const Q = await mkUser({ name: "Số tự khai" });
  await prisma.user.update({ where: { id: Q.id }, data: { phone: phoneOf(2), phoneE164: `+84${phoneOf(2).slice(1)}` } }); // chưa xác minh
  for (const [raw, why] of [[phoneOf(1), "dạng thường"], [`${phoneOf(1).slice(0, 4)} ${phoneOf(1).slice(4, 7)} ${phoneOf(1).slice(7)}`, "có dấu cách"], [`+84${phoneOf(1).slice(1)}`, "+84"]] as const) {
    const r = await login({ identifier: raw, password: PW });
    check(`số đã xác minh (${why}) + mật khẩu đúng → vào được đúng người`, r.status === 200 && r.json.id === P.id && hasSession(r), r);
  }
  const pw = await login({ identifier: phoneOf(1), password: "sai" });
  check("số đã xác minh + sai mật khẩu → 401 'Số điện thoại hoặc mật khẩu không đúng'", pw.status === 401 && pw.json.error === "Số điện thoại hoặc mật khẩu không đúng", pw);
  const qn = await login({ identifier: phoneOf(2), password: PW });
  check("số CHƯA xác minh dù mật khẩu đúng → 401 như số lạ (không ai 'chiếm trước' số bằng cách ghi vào hồ sơ mình)", qn.status === 401 && !hasSession(qn) && qn.json.error === "Số điện thoại hoặc mật khẩu không đúng", qn);
  const ln = await login({ identifier: phoneOf(3), password: PW });
  check("số hoàn toàn lạ → 401 cùng câu", ln.status === 401 && ln.text === qn.text, ln);
  const bad = await login({ identifier: "0201234567", password: PW });
  check("số bàn (không phải di động) → 400 có câu hướng dẫn", bad.status === 400 && /email hoặc số điện thoại/.test(bad.json.error), bad);

  section("Tài khoản bị khoá");
  const B = await mkUser({ name: "Bị khoá" });
  await prisma.user.update({ where: { id: B.id }, data: { banned: true } });
  const bn = await login({ identifier: B.email, password: PW });
  check("đúng mật khẩu nhưng bị khoá → 403, không cookie", bn.status === 403 && !hasSession(bn) && /bị khóa/.test(bn.json.error), bn);
  const bw = await login({ identifier: B.email, password: "sai" });
  check("bị khoá + sai mật khẩu → vẫn 401 (không lộ tình trạng khoá cho người không biết mật khẩu)", bw.status === 401, bw);

  section("Dữ liệu xấu → 400, không 500");
  for (const [name, body] of [
    ["thân không phải JSON", "xx{"], ["thân rỗng", ""], ["mảng", []], ["thiếu mật khẩu", { identifier: U.email }], ["mật khẩu rỗng", { identifier: U.email, password: "" }],
    ["thiếu tài khoản", { password: PW }], ["mật khẩu là object (NoSQL kiểu)", { identifier: U.email, password: { $ne: "" } }], ["tài khoản là object", { identifier: { $ne: "" }, password: PW }],
    ["mật khẩu 2000 ký tự", { identifier: U.email, password: "p".repeat(2000) }], ["tài khoản 300 ký tự", { identifier: "a".repeat(300) + "@b.vn", password: PW }],
  ] as const) {
    const r = await login(body);
    check(`${name} → 400`, r.status === 400 && !hasSession(r), r);
  }

  section("Chỉ LÀM CHẬM theo tài khoản: mật khẩu đúng luôn vào được");
  const S = await mkUser({ name: "Bị gõ sai nhiều" });
  const fast: number[] = [];
  for (let i = 0; i < 5; i++) { const r = await login({ identifier: S.email, password: `sai-${i}` }); fast.push(r.ms); check(`sai lần ${i + 1} (từ máy khác nhau) → 401`, r.status === 401, r); }
  const slow = await login({ identifier: S.email, password: PW });
  check("sau 5 lần sai: lần đúng mật khẩu VẪN VÀO ĐƯỢC (không khoá được người thật bằng cách gõ sai hộ họ)", slow.status === 200 && hasSession(slow), slow);
  check(`…nhưng phải chờ thêm ~1,5 giây (${slow.ms}ms)`, slow.ms >= 1400, slow.ms);
  const after = await login({ identifier: S.email, password: "sai-nua" });
  check("đăng nhập đúng xoá bộ đếm của tài khoản → lần sai kế tiếp không còn bị chờ", after.status === 401 && after.ms < 1200, after.ms);

  section("Chặn dò theo MÁY (mất khoảng 2 phút vì giới hạn 10 lần/phút chặn trước)");
  const IP = nextIp(), OTHER = nextIp();
  for (let i = 0; i < 10; i++) { const r = await login({ identifier: `do.${RUN}.${i}@test.local`, password: "x" }, IP); if (r.status !== 401) check(`lần ${i + 1} sai phải là 401`, false, r); }
  const burst = await login({ identifier: U.email, password: PW }, IP);
  check("lần thứ 11 trong một phút → 429 (giới hạn tốc độ 10 lần/phút), kể cả mật khẩu đúng", burst.status === 429 && !hasSession(burst), burst);
  console.log("  … chờ 62 giây cho cửa sổ 1 phút trôi qua");
  await new Promise(r => setTimeout(r, 62_000));
  for (let i = 10; i < 20; i++) { const r = await login({ identifier: `do.${RUN}.${i}@test.local`, password: "x" }, IP); if (r.status !== 401) check(`lần ${i + 1} sai phải là 401`, false, r); }
  // Lô thứ hai vừa dùng hết 10 lần của phút MỚI, nên phải qua thêm một phút nữa thì yêu cầu kế tiếp mới tới được bộ đếm "20 lần sai".
  console.log("  … chờ thêm 62 giây (lô thứ hai đã dùng hết 10 lần của phút mới)");
  await new Promise(r => setTimeout(r, 62_000));
  const blocked = await login({ identifier: U.email, password: PW }, IP);
  check("sai đủ 20 lần → máy đó bị chặn: 429 mã 'wait', KỂ CẢ mật khẩu đúng", blocked.status === 429 && blocked.json.code === "wait" && !hasSession(blocked), blocked);
  check("có Retry-After (giây, ≤ 15 phút) khớp retryAfterSec", Number(blocked.headers.get("retry-after")) === blocked.json.retryAfterSec && blocked.json.retryAfterSec > 0 && blocked.json.retryAfterSec <= 900, [blocked.headers.get("retry-after"), blocked.json]);
  check("câu báo nêu số phút và mời đăng nhập bằng mã một lần", /Thử lại sau \d+ phút/.test(blocked.json.error) && /mã một lần/.test(blocked.json.error), blocked.json);
  const free = await login({ identifier: U.email, password: PW }, OTHER);
  check("máy khác vẫn đăng nhập bình thường", free.status === 200 && hasSession(free), free);

  await done();
})();
