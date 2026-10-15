// Mốc phiên thật (Figma 33:2): API + JWT thật. Gia sư / học sinh 30 ngày gia hạn khi dùng; quản trị 12 giờ không gia hạn.
import { SignJWT } from "jose";
import { BASE, mkSuper, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const H = 3_600_000, D = 24 * H;
const nowS = () => Math.floor(Date.now() / 1000);

const forge = (u: { id: string; role: string; adminRole?: string | null }, iatAgoMs: number, expInMs = 30 * D) =>
  new SignJWT({ userId: u.id, role: u.role, ...(u.adminRole ? { adminRole: u.adminRole } : {}) })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt(nowS() - Math.floor(iatAgoMs / 1000)).setExpirationTime(nowS() + Math.floor(expInMs / 1000)).sign(SECRET);
const claims = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()) as { iat: number; exp: number; role: string; adminRole?: string };
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").match(/midnight_session=([^;]+)/)?.[1] ?? "";
const expiresOf = (res: Response) => { const m = (res.headers.get("set-cookie") ?? "").match(/[Ee]xpires=([^;]+)/); return m ? new Date(m[1]).getTime() : NaN; };
let ipSeq = 0;
const ip = () => `10.88.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
const login = (email: string) => fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip() }, body: JSON.stringify({ email, password: "Passw0rd!" }) });
const me = (token: string | null) => fetch(BASE + "/api/auth/me", { headers: token ? { cookie: `midnight_session=${token}` } : {} });
const near = (a: number, b: number, tolMs = 5 * 60_000) => Math.abs(a - b) <= tolMs;

(async () => {
  await wipe();
  const S = await mkUser({ name: "Em An" }), T = await mkTutor("Cô Lan"), SA = await mkSuper("Quản trị 1");
  const AC = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });

  section("Đăng nhập cấp cookie đúng mốc");
  for (const [name, u, ms, label] of [["học sinh", S, 30 * D, "30 ngày"], ["gia sư", T, 30 * D, "30 ngày"], ["quản trị cấp 1", SA, 12 * H, "12 giờ"], ["quản trị nội dung", AC, 12 * H, "12 giờ"]] as const) {
    const r = await login(u.email);
    const tok = cookieOf(r), c = tok ? claims(tok) : null;
    check(`${name}: đăng nhập 200 và có cookie`, r.status === 200 && !!tok, r.status);
    check(`${name}: cookie hết hạn sau ${label}`, near(expiresOf(r), Date.now() + ms), new Date(expiresOf(r)).toISOString());
    check(`${name}: JWT exp − iat = ${label}`, !!c && Math.abs((c.exp - c.iat) * 1000 - ms) < 2000, c);
    check(`${name}: cookie HttpOnly + SameSite=Lax + Path=/`, /HttpOnly/i.test(r.headers.get("set-cookie") ?? "") && /SameSite=lax/i.test(r.headers.get("set-cookie") ?? "") && /Path=\//.test(r.headers.get("set-cookie") ?? ""));
  }

  section("Gia hạn khi dùng — học sinh / gia sư");
  const fresh = await forge(S, 2 * H);
  const rFresh = await me(fresh);
  check("phiên mới (2 giờ) → /me trả người dùng, KHÔNG cấp lại cookie", (await rFresh.json())?.id === S.id && cookieOf(rFresh) === "");
  const old = await forge(S, 3 * D);
  const rOld = await me(old), newTok = cookieOf(rOld);
  check("phiên 3 ngày tuổi → /me gia hạn: cấp cookie mới", (await rOld.json())?.id === S.id && !!newTok && newTok !== old);
  const nc = newTok ? claims(newTok) : null;
  check("cookie mới: iat = bây giờ, hết hạn lại sau 30 ngày", !!nc && Math.abs(nc.iat - nowS()) < 10 && Math.abs((nc.exp - nc.iat) * 1000 - 30 * D) < 2000 && near(expiresOf(rOld), Date.now() + 30 * D));
  check("vai không bị đổi khi gia hạn", nc?.role === "student" && !nc?.adminRole);
  const tOld = await forge(T, 6 * D, 24 * D);
  const rT = await me(tOld), tTok = cookieOf(rT);
  check("gia sư 6 ngày tuổi (token kiểu cũ còn 24 ngày) → gia hạn 30 ngày, giữ adminRole=teacher", !!tTok && claims(tTok).adminRole === "teacher" && Math.abs((claims(tTok).exp - claims(tTok).iat) * 1000 - 30 * D) < 2000);
  const near30 = await forge(S, 29 * D, 1 * D);
  const rN = await me(near30);
  check("phiên 29 ngày tuổi (còn 1 ngày) vẫn gia hạn được — dùng đều thì không bao giờ hết", !!cookieOf(rN) && (await rN.json())?.id === S.id);

  section("Hết hạn thật sự");
  const dead = await forge(S, 31 * D, 1 * D);
  const rDead = await me(dead);
  check("phiên 31 ngày tuổi → coi như chưa đăng nhập (null), không gia hạn", (await rDead.json()) === null && cookieOf(rDead) === "");
  const expired = await new SignJWT({ userId: S.id, role: "student" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(nowS() - 40 * 86400).setExpirationTime(nowS() - 10 * 86400).sign(SECRET);
  check("token hết hạn exp → null", (await (await me(expired)).json()) === null);
  check("cookie rác → null (không 500)", (await (await me("khong.phai.jwt")).json()) === null);
  const wrongKey = await new SignJWT({ userId: S.id, role: "student" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(new TextEncoder().encode("khoa-khac-khoa-khac-khoa-khac-1234"));
  check("token ký bằng khoá khác → null", (await (await me(wrongKey)).json()) === null);

  section("Quản trị 12 giờ — KHÔNG gia hạn");
  const adm5 = await forge(SA, 5 * H, 12 * H);
  const rA5 = await me(adm5);
  check("quản trị 5 giờ tuổi: vẫn vào được, và KHÔNG được gia hạn (không cấp cookie mới)", (await rA5.json())?.id === SA.id && cookieOf(rA5) === "");
  const adm11 = await forge(AC, 11 * H, 12 * H);
  check("quản trị nội dung 11 giờ: còn vào được, vẫn không gia hạn", (await (async () => { const r = await me(adm11); return (await r.json())?.id === AC.id && cookieOf(r) === ""; })()));
  const adm13 = await forge(SA, 13 * H, 24 * D); // token kiểu cũ: exp còn rất xa nhưng đã quá 12 giờ
  const rA13 = await me(adm13);
  check("quản trị 13 giờ tuổi (token cũ exp còn 24 ngày) → BỊ TỪ CHỐI (null)", (await rA13.json()) === null && cookieOf(rA13) === "");
  const apiOld = await fetch(BASE + "/api/admin/reviews?status=all", { headers: { cookie: `midnight_session=${adm13}` } });
  check("API quản trị với token quản trị quá 12 giờ → 401/403", apiOld.status === 401 || apiOld.status === 403, apiOld.status);
  const apiOk = await fetch(BASE + "/api/admin/reviews?status=all", { headers: { cookie: `midnight_session=${adm5}` } });
  check("API quản trị với token 5 giờ → 200", apiOk.status === 200, apiOk.status);
  const tOld13 = await forge(T, 13 * H);
  check("gia sư 13 giờ tuổi vẫn vào được (mốc quản trị KHÔNG áp cho gia sư)", (await (await me(tOld13)).json())?.id === T.id);

  section("Tài khoản bị khoá không được gia hạn");
  await prisma.user.update({ where: { id: S.id }, data: { banned: true } });
  const bannedOld = await forge(S, 3 * D);
  const rB = await me(bannedOld);
  check("học sinh bị khoá, phiên 3 ngày → /me không cấp cookie mới", cookieOf(rB) === "", cookieOf(rB).slice(0, 12));
  check("/me không lộ trường nội bộ 'banned'", !("banned" in ((await (await me(await forge(T, 3 * D))).json()) ?? {})));
  await prisma.user.update({ where: { id: S.id }, data: { banned: false } });

  section("Không đăng nhập");
  check("không cookie → null", (await (await me(null)).json()) === null);
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
