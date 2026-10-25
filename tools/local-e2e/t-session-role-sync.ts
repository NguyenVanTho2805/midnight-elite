// NC2-029c — /api/auth/me đồng bộ vai của phiên theo DB (gia sư vừa được duyệt không phải đăng nhập lại), không kéo dài phiên.
import { SignJWT } from "jose";
import { api, mkSuper, mkTutor, mkUser, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const H = 3_600_000, D = 24 * H;
const nowS = () => Math.floor(Date.now() / 1000);
const forge = (u: { id: string }, role: string, adminRole: string | null, iatAgoMs: number, expInMs = 30 * D, key = SECRET) =>
  new SignJWT({ userId: u.id, role, ...(adminRole ? { adminRole } : {}) })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt(nowS() - Math.floor(iatAgoMs / 1000)).setExpirationTime(nowS() + Math.floor(expInMs / 1000)).sign(key);
const claims = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()) as { userId: string; iat: number; exp: number; role: string; adminRole?: string };
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").match(/midnight_session=([^;]+)/)?.[1] ?? "";
const me = (token: string | null, qs = "", extra: Record<string, string> = {}) => fetch(BASE + "/api/auth/me" + qs, { headers: { ...(token ? { cookie: `midnight_session=${token}` } : {}), ...extra } });

(async () => {
  await wipe();
  const sup = await mkSuper("Quản trị 1");

  section("Gia sư vừa được duyệt: phiên 'student' cũ tự đổi vai, không đăng nhập lại");
  const A = await mkUser({ name: "Gia sư chờ duyệt" });
  await prisma.user.update({ where: { id: A.id }, data: { tutorAppliedAt: new Date(), bio: "Dạy Toán 9 ba năm. ".repeat(12), subjects: ["Toán"], city: "Hà Nội" } });
  const oldTok = await forge(A, "student", null, 3 * H);
  const before = await me(oldTok), bj = await before.json();
  check("trước khi duyệt: vai student, không cấp cookie", bj?.role === "student" && cookieOf(before) === "");
  const ap = await api("POST", `/api/admin/tutor-applications/${A.id}/approve`, { as: sup });
  check("quản trị duyệt → 200", ap.status === 200, ap.status);
  const r1 = await me(oldTok), j1 = await r1.json(), tok1 = cookieOf(r1);
  check("/me trả vai mới: admin + teacher", j1?.role === "admin" && j1?.adminRole === "teacher", j1);
  const c1 = tok1 ? claims(tok1) : null;
  check("/me báo sessionRefreshed khi vừa đồng bộ (để trang dựng lại vỏ)", j1?.sessionRefreshed === true);
  check("Set-Cookie mang vai mới đúng userId", !!c1 && c1.role === "admin" && c1.adminRole === "teacher" && c1.userId === A.id, c1);
  check("giữ mốc iat cũ (không đổi thành bây giờ)", !!c1 && c1.iat === claims(oldTok).iat, c1);
  check("hạn = iat + 30 ngày (gia sư theo chính sách 30 ngày)", !!c1 && c1.exp - c1.iat === 30 * 86400, c1);
  const r2 = await me(tok1);
  check("dùng cookie mới: vai không đổi → KHÔNG cấp cookie nữa", (await r2.json())?.sessionRefreshed === undefined && cookieOf(r2) === "");
  const rt = await fetch(BASE + "/api/tutor/payout-account", { headers: { cookie: `midnight_session=${tok1}` } });
  check("cookie mới vào được API khung gia sư (không 401/403)", rt.status !== 401 && rt.status !== 403, rt.status);

  section("Vai không đổi → không thêm Set-Cookie");
  const S = await mkUser({ name: "Em An" });
  const rs = await me(await forge(S, "student", null, 1 * H));
  check("học sinh vai khớp DB: không cookie", cookieOf(rs) === "");
  const T = await mkTutor("Cô Lan");
  check("gia sư vai khớp DB: không cookie", cookieOf(await me(await forge(T, "admin", "teacher", 1 * H))) === "");

  section("Không bao giờ tin vai từ client");
  const rq = await me(await forge(S, "student", null, 1 * H), "?role=admin&adminRole=admin_super", { "x-role": "admin", "x-admin-role": "admin_super" });
  const jq = await rq.json();
  check("khai vai bằng query/header → bỏ qua", jq?.role === "student" && cookieOf(rq) === "", jq);
  const rf = await me(await forge(S, "admin", "admin_super", 1 * H)); // token ký đúng khoá nhưng vai KHÁC DB
  const jf = await rf.json(), cf = cookieOf(rf) ? claims(cookieOf(rf)) : null;
  check("token tự khai admin_super nhưng DB là student → hạ về student theo DB", jf?.role === "student" && cf?.role === "student" && !cf?.adminRole, { jf, cf });
  const rA = await me(await forge(S, "student", null, 1 * H));
  check("em An chỉ nhận id của chính mình, không nhận vai người khác", cookieOf(rA) === "" && (await rA.json())?.id === S.id);

  section("Chữ ký sai / hết hạn / rác → không đồng bộ");
  const wrongKey = await forge(A, "student", null, 1 * H, 30 * D, new TextEncoder().encode("khoa-khac-khoa-khac-khoa-khac-1234"));
  const expired = await forge(A, "student", null, 40 * D, -10 * D);
  for (const [n, t] of [["sai khoá", wrongKey], ["hết hạn", expired], ["rác", "khong.phai.jwt"]] as const) {
    const r = await me(t);
    check(`token ${n} → null, không cookie`, (await r.json()) === null && cookieOf(r) === "");
  }
  const noSig = (await forge(S, "admin", "admin_super", 1 * H)).split(".").slice(0, 2).join(".") + ".";
  const rn = await me(noSig);
  check("token bỏ chữ ký → null, không cookie", (await rn.json()) === null && cookieOf(rn) === "");

  section("Tài khoản bị khoá → không cấp lại gì");
  const BN = await mkUser({ name: "Bị khoá", role: "admin", adminRole: "teacher", tutorVerified: true });
  await prisma.user.update({ where: { id: BN.id }, data: { banned: true } });
  const rb = await me(await forge(BN, "student", null, 2 * H));
  check("bị khoá + vai lệch → không cookie", cookieOf(rb) === "");

  section("Hạ quyền cũng đồng bộ");
  const AD = await mkUser({ name: "Từng là quản trị", role: "student" });
  const rd = await me(await forge(AD, "admin", "admin_content", 2 * H, 10 * H));
  const cd = cookieOf(rd) ? claims(cookieOf(rd)) : null;
  check("quản trị bị gỡ vai → phiên về student ngay", (await rd.json())?.role === "student" && cd?.role === "student" && !cd?.adminRole, cd);
  check("hạ quyền không kéo dài: iat vẫn là mốc cũ", !!cd && Math.abs(cd.iat - (nowS() - 2 * 3600)) <= 2, cd);

  section("Lên quản trị: giữ iat, 12 giờ tính từ lần đăng nhập thật");
  const P = await mkUser({ name: "Mới làm quản trị", role: "admin", adminRole: "admin_content" });
  const rp = await me(await forge(P, "student", null, 3 * H));
  const cp = cookieOf(rp) ? claims(cookieOf(rp)) : null;
  check("student 3 giờ tuổi → admin_content: cookie mới có vai admin_content", cp?.role === "admin" && cp?.adminRole === "admin_content", cp);
  check("iat giữ nguyên (3 giờ trước) và hạn = iat + 12 giờ, KHÔNG phải bây giờ + 12 giờ", !!cp && Math.abs(cp.iat - (nowS() - 3 * 3600)) <= 2 && cp.exp - cp.iat === 12 * 3600, cp);
  const rold = await me(await forge(P, "student", null, 13 * H));
  check("student 13 giờ tuổi được lên quản trị → phải đăng nhập lại (null), không cấp phiên quản trị mới", (await rold.json()) === null && cookieOf(rold) === "");

  // NC2-035 — ba ca còn thiếu từ rà soát bảo mật.
  section("NC2-035: gia sư phiên 29 ngày được nâng lên quản trị → KHÔNG nhận phiên quản trị 12 giờ");
  const GT = await mkUser({ name: "Gia sư lên quản trị", role: "admin", adminRole: "admin_super" }); // DB: đã là quản trị
  const r29 = await me(await forge(GT, "admin", "teacher", 29 * D, 1 * D)); // token: gia sư, iat cách đây 29 ngày, còn hạn 1 ngày
  check("gia sư 29 ngày → admin_super: /me trả null (phải đăng nhập lại bằng mã)", (await r29.json()) === null);
  const ck29 = cookieOf(r29);
  check("…và KHÔNG cấp cookie quản trị nào (không cookie, hoặc cookie rỗng/xoá)", ck29 === "" || ck29.split(".").length !== 3 || claims(ck29).role !== "admin", ck29.slice(0, 30));
  const r29b = await me(await forge(GT, "admin", "teacher", 11 * H, 29 * D));
  const c29b = cookieOf(r29b) ? claims(cookieOf(r29b)) : null;
  check("đối chứng: gia sư mới 11 giờ lên quản trị vẫn được (còn trong 12 giờ), giữ iat", c29b?.adminRole === "admin_super" && Math.abs(c29b.iat - (nowS() - 11 * 3600)) <= 2 && c29b.exp - c29b.iat === 12 * 3600, c29b);
  const r29c = await me(await forge(GT, "admin", "teacher", 12 * H + 60_000, 29 * D));
  check("ranh giới: 12 giờ + 1 phút → null", (await r29c.json()) === null && cookieOf(r29c) === "");

  section("NC2-035: người dùng bị xoá giữa chừng khi gọi /me");
  const GONE = await mkUser({ name: "Sắp bị xoá" });
  const goneTok = await forge(GONE, "student", null, 1 * H);
  check("trước khi xoá: /me trả đúng người", (await (await me(goneTok)).json())?.id === GONE.id);
  await prisma.user.delete({ where: { id: GONE.id } });
  const rg = await me(goneTok);
  check("sau khi xoá: 200 + null (không 500), không cấp cookie", rg.status === 200 && (await rg.json()) === null && cookieOf(rg) === "", rg.status);
  const GONE2 = await mkUser({ name: "Gia sư bị xoá", role: "admin", adminRole: "teacher", tutorVerified: true });
  const gone2Tok = await forge(GONE2, "admin", "teacher", 1 * H);
  await prisma.user.delete({ where: { id: GONE2.id } });
  const rg2 = await me(gone2Tok);
  check("gia sư bị xoá: cũng 200 + null, không cookie", rg2.status === 200 && (await rg2.json()) === null && cookieOf(rg2) === "");
  const GONE3 = await mkUser({ name: "Xoá giữa lúc song song" });
  const gone3Tok = await forge(GONE3, "student", null, 1 * H);
  const racing = Promise.all([me(gone3Tok), me(gone3Tok), me(gone3Tok)]);
  await prisma.user.delete({ where: { id: GONE3.id } });
  const rr = await racing;
  check("xoá đúng lúc 3 lần /me chạy: không lần nào 5xx", rr.every(x => x.status === 200), rr.map(x => x.status));

  section("NC2-035: hai /me song song với vai lệch DB");
  const PL = await mkUser({ name: "Vừa lên quản trị", role: "admin", adminRole: "admin_content" });
  const plTok = await forge(PL, "student", null, 2 * H);
  const [pa, pb] = await Promise.all([me(plTok), me(plTok)]);
  const [ja, jb] = [await pa.json(), await pb.json()];
  const [ca, cb] = [cookieOf(pa) ? claims(cookieOf(pa)) : null, cookieOf(pb) ? claims(cookieOf(pb)) : null];
  check("cả hai 200 và cùng thấy vai admin_content", pa.status === 200 && pb.status === 200 && ja?.adminRole === "admin_content" && jb?.adminRole === "admin_content", [ja?.adminRole, jb?.adminRole]);
  check("cả hai cookie mới đúng vai, cùng userId, cùng iat gốc (không bên nào kéo dài phiên)", !!ca && !!cb && ca.role === "admin" && cb.role === "admin" && ca.adminRole === "admin_content" && cb.adminRole === "admin_content" && ca.userId === PL.id && cb.userId === PL.id && ca.iat === cb.iat && ca.iat === claims(plTok).iat && ca.exp === cb.exp, { ca, cb });
  const pc = await me(cookieOf(pa));
  check("dùng cookie của lần song song: vai khớp, không cấp thêm cookie", (await pc.json())?.adminRole === "admin_content" && cookieOf(pc) === "");
  const [d1, d2, d3] = await Promise.all([me(await forge(AD, "admin", "admin_content", 2 * H, 10 * H)), me(await forge(AD, "admin", "admin_content", 2 * H, 10 * H)), me(await forge(AD, "admin", "admin_content", 2 * H, 10 * H))]);
  check("hạ quyền song song 3 lần: đều về student, không lần nào lỗi", [d1, d2, d3].every(x => x.status === 200) && (await Promise.all([d1, d2, d3].map(x => x.json()))).every(j => j?.role === "student"));

  section("Không chuyển hướng");
  check("/me luôn 200 JSON (không 3xx)", before.status === 200 && r1.status === 200 && rold.status === 200);
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
