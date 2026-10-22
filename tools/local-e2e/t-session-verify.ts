// NC2-033 — route GHI đối chiếu DB (vai, khoá, xoá) qua getSession()/requirePermission()/requireSession() ở MỘT chỗ; route ĐỌC giữ nguyên; verify-email từ chối tài khoản bị khoá.
import { encrypt } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { api, mkSuper, mkTutor, mkUser, wipe, check, section, done, BASE, type TUser } from "./h";

const H = 3_600_000;
const nowS = () => Math.floor(Date.now() / 1000);
const msg = (r: { json: any }) => String(r.json?.error ?? "");
// Token ký đúng khoá, vai theo ý (không theo DB) — mô phỏng cookie cũ còn sống sau khi DB đã đổi.
const staleTok = async (u: TUser, role: "student" | "admin", adminRole?: TUser["adminRole"]) => encrypt({ userId: u.id, role, adminRole }, { iat: nowS() - 1 * 3600 });
const withTok = (token: string) => ({ cookie: `midnight_session=${token}` });
const setCookieOf = (h: Headers) => h.get("set-cookie") ?? "";

// ba kiểu cổng: requirePermission (duyệt gia sư), requireSession (tạo yêu cầu phụ huynh), getSession trực tiếp (đổi mật khẩu)
const perm = (headers: Record<string, string>) => api("POST", "/api/admin/tutor-applications/khong-co-nguoi-nay/approve", { headers, body: {} });
const sess = (headers: Record<string, string>) => api("POST", "/api/parent-consents", { headers, body: {} });
const direct = (headers: Record<string, string>) => api("POST", "/api/auth/change-password", { headers, body: {} });

(async () => {
  await wipe();
  const sup = await mkSuper("Quản trị 1");
  const supTok = await staleTok(sup, "admin", "admin_super");

  section("Đối chứng: tài khoản bình thường vẫn dùng được");
  const p0 = await perm(withTok(supTok)), s0 = await sess(withTok(supTok)), d0 = await direct(withTok(supTok));
  check("quản trị thật: duyệt gia sư không bị chặn quyền (404 không có người)", p0.status === 404, p0.status);
  check("requireSession + getSession trực tiếp: không 401/403 ở người thường", ![401, 403].includes(s0.status) && ![401, 403].includes(d0.status), [s0.status, d0.status]);
  const stu = await mkUser({ name: "Em An" });
  const stuTok = await staleTok(stu, "student");
  check("học sinh thật gọi route quản trị → 403 (quyền như cũ)", (await perm(withTok(stuTok))).status === 403);
  check("không cookie → 401 (cả ba kiểu cổng)", (await perm({})).status === 401 && (await sess({})).status === 401 && (await direct({})).status === 401);

  section("Hạ quyền có hiệu lực NGAY ở route ghi (không chờ /api/auth/me)");
  const ex = await mkUser({ name: "Từng là quản trị", role: "admin", adminRole: "admin_super" });
  const exTok = await staleTok(ex, "admin", "admin_super");
  check("trước khi gỡ vai: duyệt gia sư → 404 (có quyền)", (await perm(withTok(exTok))).status === 404);
  await prisma.user.update({ where: { id: ex.id }, data: { role: "student", adminRole: null } });
  const exR = await perm(withTok(exTok));
  check("DB đã gỡ vai, cookie cũ vẫn tự khai admin_super → 403", exR.status === 403, exR.status);
  const ad2 = await mkUser({ name: "Quản trị bị hạ", role: "admin", adminRole: "admin_super" });
  const ad2Tok = await staleTok(ad2, "admin", "admin_super");
  await prisma.user.update({ where: { id: ad2.id }, data: { adminRole: "teacher" } });
  check("admin_super → teacher: mất quyền MANAGE_TUTORS → 403", (await perm(withTok(ad2Tok))).status === 403);
  const tut = await mkTutor("Cô Lan");
  const tutTok = await staleTok(tut, "admin", "teacher");
  await prisma.user.update({ where: { id: tut.id }, data: { role: "student", adminRole: null } });
  const tr = await api("POST", "/api/admin/tutor-applications/khong-co/approve", { headers: withTok(tutTok), body: {} });
  check("gia sư bị gỡ vai → mất quyền gia sư ở route ghi (403)", tr.status === 403, tr.status);

  section("Tiêu đề x-kin-method do client gửi không lách được");
  const sp = await perm({ ...withTok(exTok), "x-kin-method": "GET" });
  check("POST khai 'x-kin-method: GET' vẫn bị đối chiếu → 403", sp.status === 403, sp.status);

  section("Tài khoản bị khoá giữ cookie cũ → bị chặn ở route ghi");
  const bn = await mkUser({ name: "Em bị khoá" });
  const bnTok = await staleTok(bn, "student");
  check("trước khi khoá: route ghi dùng được", ![401, 403].includes((await sess(withTok(bnTok))).status));
  await prisma.user.update({ where: { id: bn.id }, data: { banned: true } });
  for (const [name, fn] of [["requireSession", sess], ["getSession trực tiếp", direct]] as const) {
    const r = await fn(withTok(bnTok));
    check(`${name}: bị khoá → 401/403`, r.status === 401 || r.status === 403, r.status);
  }
  const rb = await sess(withTok(bnTok));
  check("requireSession: bị khoá → 403 đúng mã, có chữ 'bị khóa'", rb.status === 403 && /bị khóa/.test(msg(rb)), { s: rb.status, m: msg(rb) });
  check("bị khoá → xoá cookie phiên (Set-Cookie hết hạn)", /midnight_session=;/.test(setCookieOf(rb.headers)) || /midnight_session=[^;]*;[^]*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(setCookieOf(rb.headers)), setCookieOf(rb.headers));
  const bq = await mkUser({ name: "Quản trị bị khoá", role: "admin", adminRole: "admin_super" });
  const bqTok = await staleTok(bq, "admin", "admin_super");
  await prisma.user.update({ where: { id: bq.id }, data: { banned: true } });
  const bqR = await perm(withTok(bqTok));
  check("quản trị bị khoá → 403 (không 404 = không qua cổng quyền)", bqR.status === 403 && /bị khóa/.test(msg(bqR)), { s: bqR.status });

  section("Tài khoản bị xoá → 401");
  const gone = await mkUser({ name: "Sắp bị xoá" });
  const goneTok = await staleTok(gone, "student");
  await prisma.user.delete({ where: { id: gone.id } });
  check("người dùng không còn trong DB: requireSession → 401", (await sess(withTok(goneTok))).status === 401);
  check("getSession trực tiếp → 401", (await direct(withTok(goneTok))).status === 401);

  section("Nâng vai theo DB không lách mốc 12 giờ của quản trị");
  const late = await mkUser({ name: "Mới lên quản trị", role: "admin", adminRole: "admin_super" });
  const lateTok = await encrypt({ userId: late.id, role: "student" }, { iat: nowS() - 13 * 3600 });
  check("token student 13 giờ, DB là admin_super → 401 (phải đăng nhập lại)", (await perm(withTok(lateTok))).status === 401);
  const soon = await mkUser({ name: "Quản trị mới", role: "admin", adminRole: "admin_super" });
  const soonTok = await encrypt({ userId: soon.id, role: "student" }, { iat: nowS() - 2 * 3600 });
  check("token student 2 giờ, DB là admin_super → qua cổng quyền (404 không có người)", (await perm(withTok(soonTok))).status === 404);

  section("Yêu cầu ĐỌC giữ nguyên hành vi (chỉ đối chiếu route ghi — phạm vi nêu trong báo cáo)");
  const rd = await api("GET", "/api/admin/kiem-duyet", { headers: withTok(exTok) });
  check("GET với cookie admin đã bị gỡ vai: vẫn như cũ (token), không bị đối chiếu", rd.status !== 401 && rd.status !== 500, rd.status);
  const me = await fetch(BASE + "/api/auth/me", { headers: withTok(exTok) });
  check("/api/auth/me vẫn đồng bộ vai như NC2-029c (hạ về student)", (await me.json())?.role === "student");

  section("verify-email từ chối tài khoản bị khoá");
  const vb = await mkUser({ name: "Chưa xác thực, bị khoá", emailVerified: false });
  await prisma.user.update({ where: { id: vb.id }, data: { banned: true } });
  await prisma.verifyToken.create({ data: { token: "tok-banned-033", userId: vb.id, expiresAt: new Date(Date.now() + H) } });
  const ve = await fetch(BASE + "/api/auth/verify-email?token=tok-banned-033");
  const vj = await ve.json();
  check("verify-email → 403, có chữ 'bị khóa'", ve.status === 403 && /bị khóa/.test(String(vj.error)), { s: ve.status, vj });
  check("không cấp cookie phiên", !/midnight_session=[^;]+/.test(ve.headers.get("set-cookie") ?? "") || /midnight_session=;/.test(ve.headers.get("set-cookie") ?? ""));
  const after = await prisma.user.findUnique({ where: { id: vb.id }, select: { emailVerified: true } });
  check("không đổi emailVerified của tài khoản bị khoá", after?.emailVerified === false);
  const vok = await mkUser({ name: "Chưa xác thực, bình thường", emailVerified: false });
  await prisma.verifyToken.create({ data: { token: "tok-ok-033", userId: vok.id, expiresAt: new Date(Date.now() + H) } });
  const vo = await fetch(BASE + "/api/auth/verify-email?token=tok-ok-033");
  check("người bình thường vẫn xác thực được (200 + cookie)", vo.status === 200 && /midnight_session=[^;]+/.test(vo.headers.get("set-cookie") ?? ""), vo.status);

  done();
})();
