// Thu hồi phiên bằng User.sessionsValidAfter: chặn cả ĐỌC (trang server + API GET) lẫn ghi; mốc cùng giây; reset-password thu hồi push; xác minh email cấp lại cookie.
import { encrypt } from "@/lib/session";
import { revocationMark, commitMark, iatForMark, isRevokedByMark } from "@/lib/sessionVerify";
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, wipe, check, section, done, BASE } from "./h";
import { hashResetToken } from "@/lib/passwordReset";

const nowS = () => Math.floor(Date.now() / 1000);
const ck = (t: string) => ({ cookie: `midnight_session=${t}` });
const tokFor = (id: string, iat: number) => encrypt({ userId: id, role: "student" }, { iat });
const tutTok = (id: string, iat: number) => encrypt({ userId: id, role: "admin", adminRole: "teacher" }, { iat });
// Trang server của gia sư (getSession trong layout/page): không phiên → chuyển /dang-nhap.
// Next đã bắt đầu stream nên chuyển hướng có thể đến dạng 200 + NEXT_REDIRECT trong thân thay vì 307: coi cả hai là "bị chuyển /dang-nhap".
const page = async (t: string | null) => {
  const r = await fetch(BASE + "/lop-cua-toi/cai-dat", { headers: t ? ck(t) : {}, redirect: "manual" });
  const body = await r.text();
  return { status: r.status, toLogin: (r.headers.get("location") ?? "").includes("/dang-nhap") || body.includes("NEXT_REDIRECT;replace;/dang-nhap") };
};
const mark = (id: string, m: Date | null) => prisma.user.update({ where: { id }, data: { sessionsValidAfter: m } });

(async () => {
  await wipe();
  section("Thuần: quy ước mốc cùng giây");
  const t0 = Date.UTC(2026, 10, 8, 5, 0, 0, 700); // 05:00:00.700
  const m = revocationMark(t0), M = iatForMark(m);
  check("mốc = giây nguyên kế tiếp, ms = 0", m.getTime() % 1000 === 0 && m.getTime() === Date.UTC(2026, 10, 8, 5, 0, 1));
  check("mốc ở đúng 05:00:00.000 vẫn là giây KẾ TIẾP (không bằng now)", revocationMark(Date.UTC(2026, 10, 8, 5, 0, 0, 0)).getTime() === Date.UTC(2026, 10, 8, 5, 0, 1));
  check("cookie kẻ chiếm cấp cùng giây trước reclaim (iat = giây hiện tại) bị thu hồi", isRevokedByMark(Math.floor(t0 / 1000), m));
  check("cookie cấp 1 giây trước cũng bị thu hồi", isRevokedByMark(Math.floor(t0 / 1000) - 1, m));
  check("phiên hợp lệ cấp ngay sau reclaim (iat = iatForMark) sống", !isRevokedByMark(M, m));
  check("phiên đăng nhập sau đó (iat > mốc) sống", !isRevokedByMark(M + 5, m));
  check("mốc null → không thu hồi", !isRevokedByMark(1, null));

  section("Khe đua lúc chiếm lại: cookie cấp giữa lúc tính mốc và commit vẫn bị thu hồi");
  // Mốc tính (commitMark) SAU bcrypt, sát commit. Kẻ chiếm đăng nhập ở mili-giây bất kỳ trong ~1 giây kế sau lúc tính (kể cả vắt qua ranh giới giây) → iat < mốc.
  let raceOk = true, firstLive = -1;
  for (const base of [Date.UTC(2026, 10, 8, 5, 0, 0, 0), Date.UTC(2026, 10, 8, 5, 0, 0, 1), Date.UTC(2026, 10, 8, 5, 0, 0, 999)]) {
    const cm = commitMark(base);
    for (let dt = 0; dt < 1000; dt += 7) {
      const iat = Math.floor((base + dt) / 1000); // cookie kẻ chiếm cấp tại base+dt (sau lúc tính mốc, trước commit)
      if (!isRevokedByMark(iat, cm)) { raceOk = false; firstLive = dt; }
    }
  }
  check("mọi cookie cấp trong 1 giây sau lúc tính mốc (qua ranh giới giây) có iat < mốc", raceOk, firstLive);
  check("đối chứng: revocationMark trần (không đệm) để lọt cookie cấp ở giây kế → lý do có commitMark", !isRevokedByMark(Math.floor((Date.UTC(2026, 10, 8, 5, 0, 0, 999) + 5) / 1000), revocationMark(Date.UTC(2026, 10, 8, 5, 0, 0, 999))));
  check("phiên hợp lệ cấp lại với iat = iatForMark(commitMark) sống", !isRevokedByMark(iatForMark(commitMark(t0)), commitMark(t0)));

  section("GET trang server + GET API với cookie cũ / mới / cột null");
  const u = await mkUser({ name: "Em An" });
  const oldTok = await tokFor(u.id, nowS() - 10);
  const tu = await mkTutor("Cô Lan");
  const tOld = await tutTok(tu.id, nowS() - 10);
  check("cột null: trang qua (không chuyển /dang-nhap)", !(await page(tOld)).toLogin);
  check("cột null: GET /api/student/viec-cua-toi trả < 400", (await api("GET", "/api/student/viec-cua-toi", { headers: ck(oldTok) })).status < 400);
  check("đối chứng: không cookie → trang chuyển /dang-nhap", (await page(null)).toLogin);
  const mk = revocationMark();
  await mark(u.id, mk); await mark(tu.id, mk);
  const rp = await page(tOld);
  check("cookie cũ: trang → chuyển /dang-nhap (không 500)", rp.toLogin && rp.status !== 500, rp);
  const ra = await api("GET", "/api/student/viec-cua-toi", { headers: ck(oldTok) });
  check("cookie cũ: GET API → 401 (không 500)", ra.status === 401, ra.status);
  const rm = await api("GET", "/api/auth/me", { headers: ck(oldTok) });
  check("cookie cũ: /api/auth/me → null", rm.json === null);
  const newTok = await tokFor(u.id, iatForMark(mk));
  const np = await page(await tutTok(tu.id, iatForMark(mk)));
  check("cookie mới (iat = mốc): trang qua", !np.toLogin && np.status !== 500, np);
  check("cookie mới: GET API không 401", (await api("GET", "/api/student/viec-cua-toi", { headers: ck(newTok) })).status < 400);
  const edge = await tokFor(u.id, iatForMark(mk) - 1);
  check("biên: iat = mốc − 1 giây → bị từ chối", (await api("GET", "/api/student/viec-cua-toi", { headers: ck(edge) })).status === 401);
  check("ghi với cookie cũ vẫn bị từ chối (không hồi quy)", (await api("POST", "/api/parent-consents", { headers: ck(oldTok), body: {} })).status === 401);

  section("reset-password thu hồi push + cấp lại cookie sống");
  const v = await mkUser({ name: "Em Bình" });
  const vOld = await tokFor(v.id, nowS() - 5);
  await prisma.pushSubscription.create({ data: { userId: v.id, endpoint: "https://push.example/ep-rev", p256dh: "x", auth: "y" } });
  const raw = "ab".repeat(32);
  await prisma.passwordResetToken.create({ data: { userId: v.id, token: hashResetToken(raw, process.env.SESSION_SECRET!), expiresAt: new Date(Date.now() + 3_600_000) } });
  const rr = await fetch(BASE + "/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: raw, password: "MatKhauMoi#1" }) });
  check("reset-password → 200", rr.status === 200, rr.status);
  const sub = await prisma.pushSubscription.findFirst({ where: { userId: v.id } });
  check("PushSubscription bị thu hồi (revokedAt)", !!sub?.revokedAt);
  const fresh = /midnight_session=([^;]+)/.exec(rr.headers.get("set-cookie") ?? "")?.[1] ?? "";
  check("cookie cũ bị từ chối ở GET API", (await api("GET", "/api/student/viec-cua-toi", { headers: ck(vOld) })).status === 401);
  check("cookie vừa cấp trong phản hồi reset sống (cùng giây)", fresh !== "" && (await api("GET", "/api/student/viec-cua-toi", { headers: ck(fresh) })).status < 400);

  section("xác minh email: đặt mốc + cấp lại cookie, không đá người vừa xác minh");
  const w = await mkUser({ name: "Em Chi", emailVerified: false });
  const wOld = await tokFor(w.id, nowS() - 3);
  await prisma.verifyToken.create({ data: { token: "tok-rev-1", userId: w.id, expiresAt: new Date(Date.now() + 3_600_000) } });
  const ve = await fetch(BASE + "/api/auth/verify-email?token=tok-rev-1");
  check("verify-email → 200", ve.status === 200, ve.status);
  const wNew = /midnight_session=([^;]+)/.exec(ve.headers.get("set-cookie") ?? "")?.[1] ?? "";
  const wRow = await prisma.user.findUnique({ where: { id: w.id }, select: { sessionsValidAfter: true, emailVerified: true } });
  check("emailVerified true + có mốc", wRow?.emailVerified === true && !!wRow.sessionsValidAfter);
  check("cookie cấp trước (kẻ đăng ký trước) bị từ chối", (await api("GET", "/api/student/viec-cua-toi", { headers: ck(wOld) })).status === 401);
  check("cookie mới trong phản hồi xác minh sống", wNew !== "" && (await api("GET", "/api/student/viec-cua-toi", { headers: ck(wNew) })).status < 400);
  const ve2 = await fetch(BASE + "/api/auth/verify-email?token=tok-rev-1");
  check("xác minh lần hai không đặt lại mốc", ve2.status !== 500 && (await prisma.user.findUnique({ where: { id: w.id }, select: { sessionsValidAfter: true } }))?.sessionsValidAfter?.getTime() === wRow!.sessionsValidAfter!.getTime());
  const x = await mkUser({ name: "Em Dũng", emailVerified: true });
  const xTok = await tokFor(x.id, nowS() - 3);
  check("tài khoản đã xác minh trước đó: không có mốc, cookie cũ sống", (await prisma.user.findUnique({ where: { id: x.id }, select: { sessionsValidAfter: true } }))?.sessionsValidAfter === null && (await api("GET", "/api/student/viec-cua-toi", { headers: ck(xTok) })).status < 400);

  section("Facebook: chủ thật xác minh email của tài khoản tạo bằng Facebook (ghi lại hành vi hiện tại)");
  const fb = await mkUser({ name: "Em Phong", emailVerified: false });
  await prisma.user.update({ where: { id: fb.id }, data: { facebookId: `fb-rev-${fb.id}` } });
  const fbOld = await tokFor(fb.id, nowS() - 3);
  await prisma.verifyToken.create({ data: { token: "tok-rev-fb", userId: fb.id, expiresAt: new Date(Date.now() + 3_600_000) } });
  const vf = await fetch(BASE + "/api/auth/verify-email?token=tok-rev-fb");
  const fbRow = await prisma.user.findUnique({ where: { id: fb.id }, select: { facebookId: true, emailVerified: true, sessionsValidAfter: true } });
  check("verify-email → 200", vf.status === 200, vf.status);
  check("hành vi hiện tại: facebookId bị gỡ, emailVerified true, có mốc", fbRow?.facebookId === null && fbRow.emailVerified === true && !!fbRow.sessionsValidAfter, fbRow);
  check("thiết bị Facebook cũ bị đá (cookie cấp trước bị từ chối)", (await api("GET", "/api/student/viec-cua-toi", { headers: ck(fbOld) })).status === 401);

  done();
})();
