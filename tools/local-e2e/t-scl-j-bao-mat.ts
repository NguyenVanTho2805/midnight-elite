// SCL-J Bảo mật phụ — API thật + Postgres thật (cần máy chủ dev):
//   1. Tiêu đề chống nhúng iframe (X-Frame-Options: SAMEORIGIN), không còn x-powered-by.
//   2. Chống dò mật khẩu bền: sai 5 lần cùng email + máy → lần 6 bị chặn (kể cả mật khẩu đúng), máy khác vẫn vào; bộ đếm nằm trong bảng
//      login_failures (không phải bộ nhớ tiến trình); hết 15 phút thì mở.
//   3. Chi tiết lớp và danh sách lớp công khai không trả ownerId / adminName cho khách, học sinh; chủ lớp vẫn thấy.
import { BASE, api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const PW = "Passw0rd!";
let seq = Math.floor(Math.random() * 200);
const nextIp = () => `10.77.${Math.floor(++seq / 250)}.${seq % 250}`;
async function login(identifier: string, password: string, ip: string) {
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ identifier, password }) });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, headers: res.headers, session: (res.headers.get("set-cookie") ?? "").includes("midnight_session=") };
}

(async () => {
  await wipe();

  section("Tiêu đề chống nhúng iframe + không lộ x-powered-by");
  for (const path of ["/", "/dang-nhap", "/api/courses/khong-co"]) {
    const r = await fetch(BASE + path, { redirect: "manual" });
    check(`${path}: X-Frame-Options = SAMEORIGIN`, r.headers.get("x-frame-options") === "SAMEORIGIN", [r.status, r.headers.get("x-frame-options")]);
    check(`${path}: không có x-powered-by`, r.headers.get("x-powered-by") === null, r.headers.get("x-powered-by"));
  }
  const sw = await fetch(BASE + "/sw.js");
  check("/sw.js vẫn giữ CSP riêng (luật chung không đè)", sw.headers.get("content-security-policy") === "default-src 'self'; script-src 'self'", sw.headers.get("content-security-policy"));

  section("Chống dò mật khẩu theo email + máy (Postgres)");
  const U = await mkUser({ name: "Bị dò mật khẩu" });
  const A = nextIp(), B = nextIp();
  for (let i = 1; i <= 5; i++) { const r = await login(U.email, `sai-${i}`, A); check(`sai lần ${i} → 401`, r.status === 401, r); }
  check("5 lần sai đã ghi vào bảng login_failures (bền qua khởi động lại)", (await prisma.loginFailure.count({ where: { ip: A, accountKey: U.email } })) === 5);
  const sixth = await login(U.email, PW, A);
  check("lần 6 (kể cả mật khẩu đúng) → 429 mã 'wait', không cấp phiên", sixth.status === 429 && sixth.json?.code === "wait" && !sixth.session, sixth);
  check("Retry-After khớp retryAfterSec, ≤ 15 phút", Number(sixth.headers.get("retry-after")) === sixth.json?.retryAfterSec && sixth.json.retryAfterSec > 800 && sixth.json.retryAfterSec <= 900, sixth.json);
  check("câu báo nêu số phút, không lộ tên/email", /Thử lại sau \d+ phút/.test(sixth.json?.error ?? "") && !(sixth.json?.error ?? "").includes(U.email), sixth.json);
  check("bị chặn thì không ghi thêm lần sai", (await prisma.loginFailure.count({ where: { ip: A } })) === 5);

  // Giả lập 15 phút trôi qua: lùi mốc của các lần sai (như t-password-reset lùi hạn link).
  await prisma.loginFailure.updateMany({ where: { ip: A }, data: { at: new Date(Date.now() - 15 * 60_000 - 1000) } });
  const reopened = await login(U.email, PW, A);
  check("hết 15 phút → máy đó đăng nhập lại được", reopened.status === 200 && reopened.session, reopened);

  const V = await mkUser({ name: "Bị gõ sai hộ" });
  const C = nextIp(); // máy dò mới: giới hạn tốc độ 10 lần/phút (bộ nhớ) không chặn trước
  for (let i = 1; i <= 5; i++) await login(V.email, `sai-${i}`, C);
  const other = await login(V.email, PW, B);
  check("cùng email ở máy KHÁC → vẫn vào (kẻ dò không khoá được người thật)", other.status === 200 && other.session, other);
  check("đăng nhập đúng xoá bộ đếm của tài khoản (cleared) → máy dò cũng được thử lại", (await prisma.loginFailure.count({ where: { accountKey: V.email, cleared: false } })) === 0 && (await login(V.email, "sai-nua", C)).status === 401);

  section("Chi tiết lớp công khai: không lộ ownerId / adminName");
  const T = await mkTutor("Cô chủ lớp");
  const S = await mkUser({ name: "Học sinh khác" });
  const c = await mkCourse(T.id, { name: "Lớp công khai thử" });
  await prisma.course.update({ where: { id: c.id }, data: { status: true } });
  const guest = await api("GET", `/api/courses/${c.id}`);
  check("khách: 200, có tên lớp", guest.status === 200 && guest.json?.name === "Lớp công khai thử", guest.status);
  check("khách: không có ownerId, adminName", guest.json && !("ownerId" in guest.json) && !("adminName" in guest.json), guest.json && Object.keys(guest.json));
  const stu = await api("GET", `/api/courses/${c.id}`, { as: S });
  check("học sinh chưa vào lớp: không có ownerId, adminName", stu.status === 200 && !("ownerId" in stu.json) && !("adminName" in stu.json), stu.json && Object.keys(stu.json));
  const owner = await api("GET", `/api/courses/${c.id}`, { as: T });
  check("chủ lớp: vẫn thấy ownerId (màn soạn lớp cần)", owner.status === 200 && owner.json?.ownerId === T.id, owner.json?.ownerId);

  section("Danh sách lớp công khai GET /api/courses: không lộ ownerId / adminName");
  const pick = (r: { json?: unknown }) => (Array.isArray(r.json) ? r.json : []).find((x: { id?: string }) => x.id === c.id) as Record<string, unknown> | undefined;
  const gl = pick(await api("GET", "/api/courses"));
  check("khách: danh sách có lớp, không có ownerId, adminName", !!gl && !("ownerId" in gl) && !("adminName" in gl), gl && Object.keys(gl));
  const sl = pick(await api("GET", "/api/courses", { as: S }));
  check("học sinh: danh sách không có ownerId, adminName", !!sl && !("ownerId" in sl) && !("adminName" in sl), sl && Object.keys(sl));
  const ol = pick(await api("GET", "/api/courses?all=1", { as: T }));
  check("chủ lớp (?all=1): vẫn thấy ownerId, adminName", !!ol && ol.ownerId === T.id && "adminName" in ol, ol && Object.keys(ol));

  await done();
})();
