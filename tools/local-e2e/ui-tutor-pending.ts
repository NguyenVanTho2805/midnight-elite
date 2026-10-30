// BU-00 bước 4–5 (31/10/2026) — vỏ gia sư CHỜ DUYỆT và siết vỏ theo vai (theo mẫu ui-journey-new-tutor / ui-tutor-shell).
//   P1  gia sư chờ duyệt (role student + tutorAppliedAt) gõ /lop-cua-toi/lop, /lop-cua-toi/bai-tap, /lop-cua-toi, /student/viec-cua-toi, /admin/thi-thu → đều về
//       /lop-cua-toi/cho-duyet; vỏ "Module của gia sư" 3 mục, nhãn "CHỜ DUYỆT", băng "Hồ sơ gia sư đang chờ duyệt", không "Khác"; trang nói trạng thái + môn + giới thiệu.
//   P2  Liên hệ hỗ trợ mở được (API cho người có đơn đang chờ); Cài đặt → /cai-dat/chu-de vẫn giữ vỏ chờ duyệt; API tạo lớp → 403.
//   P3  người bị từ chối: trang chờ duyệt hiện "Bị từ chối" + lý do, trong vỏ HỌC SINH; học sinh thường / gia sư mở trang chờ duyệt bị đưa về trang đầu của vai.
//   P4  quản trị cấp 1 ở tên miền chính mở /lop-cua-toi → vỏ học sinh có băng "Đang xem thử giao diện học sinh · Về bảng quản trị"; gia sư gõ /student/* → Hộp việc.
//   P5  390px: một cột, không tràn ngang, thanh dưới 3 mục ≥ 44px. Ảnh: tutor-pending-cho-duyet, tutor-pending-ho-tro, tutor-pending-mobile.
import { api, BASE, cookieFor, mkSuper, mkTutor, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";

const MAIN = `http://midnightelite-edu.com:${new URL(BASE).port || 3100}`; // tên miền chính "thật" (proxy đưa /admin/* sang tên miền admin rồi quay về đây)
const GOTO = { waitUntil: "domcontentloaded" as const, timeout: 120000 };
const RAIL = "Module của gia sư";

(async () => {
  await wipe();
  const P = await mkUser({ name: "Thầy Chờ Duyệt" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date("2026-10-20T03:00:00Z"), bio: "Cử nhân Toán, 5 năm luyện thi vào 10.", subjects: ["Toán", "Lý"] } });
  const R = await mkUser({ name: "Thầy Bị Từ Chối" });
  await prisma.user.update({ where: { id: R.id }, data: { tutorAppliedAt: new Date("2026-10-01T03:00:00Z"), tutorRejectedAt: new Date("2026-10-05T03:00:00Z"), tutorRejectReason: "Chưa đủ kinh nghiệm", subjects: ["Văn"] } });
  const S = await mkUser({ name: "Em Học Sinh" });
  const T = await mkTutor("Cô Lan");
  const SA = await mkSuper("Quản trị cấp 1");

  await launch();
  const errors: string[] = [];
  const devPerf = /negative time stamp/i;
  const watch = (p: Page) => {
    p.on("pageerror", e => { if (!devPerf.test(String(e))) errors.push(String(e)); });
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|negative time stamp/i.test(m.text())) errors.push(m.text()); });
  };
  const withMainCookie = async (ctx: Awaited<ReturnType<typeof ctxFor>>, u: typeof P) => {
    const [name, ...rest] = (await cookieFor(u)).split("=");
    await ctx.addCookies([{ name, value: rest.join("="), url: MAIN }]);
  };

  // ───────────────────────────── P1 ─────────────────────────────
  section("P1. Gia sư chờ duyệt: mọi lối vào đều về /lop-cua-toi/cho-duyet");
  const ctx = await ctxFor(P, { width: 1280, height: 900 });
  await withMainCookie(ctx, P);
  const pg = await ctx.newPage(); watch(pg);
  const at = () => new URL(pg.url());
  const rail = () => pg.getByRole("navigation", { name: RAIL });

  for (const path of ["/lop-cua-toi/lop", "/lop-cua-toi/bai-tap", "/lop-cua-toi", "/student/viec-cua-toi"]) {
    await pg.goto(`${BASE}${path}`, GOTO);
    await pg.waitForURL(u => u.pathname === "/lop-cua-toi/cho-duyet", { timeout: 90000 }).catch(() => {});
    check(`${path} → /lop-cua-toi/cho-duyet`, at().pathname === "/lop-cua-toi/cho-duyet", pg.url());
  }
  // /admin/thi-thu ở tên miền chính: proxy đưa sang tên miền admin (không phải gia sư) → tên miền admin đẩy học viên về trang đầu ở tên miền chính → AuthGuard → chờ duyệt.
  await pg.goto(`${MAIN}/admin/thi-thu`, GOTO);
  await pg.waitForURL(u => u.pathname === "/lop-cua-toi/cho-duyet", { timeout: 90000 }).catch(() => {});
  check("/admin/thi-thu → cuối cùng về /lop-cua-toi/cho-duyet, không ở lại tên miền admin", at().pathname === "/lop-cua-toi/cho-duyet" && !at().host.startsWith("admin."), pg.url());

  await pg.goto(`${BASE}/lop-cua-toi/cho-duyet`, GOTO);
  await pg.getByRole("heading", { name: "Hồ sơ gia sư đang chờ duyệt", level: 1 }).waitFor({ timeout: 90000 });
  await pg.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  check("vỏ 'Module của gia sư' với nhãn vai CHỜ DUYỆT", await rail().count() === 1 && await rail().locator(".kin-rail-role", { hasText: "CHỜ DUYỆT" }).count() === 1);
  const links = await rail().getByRole("link").allInnerTexts();
  const names = links.map(t => t.trim()).filter(t => t && !/^KiN/.test(t));
  check("thanh bên đúng 3 mục: Trạng thái hồ sơ, Liên hệ hỗ trợ, Cài đặt (không Hộp việc / Lịch / Lớp / Học phí)", names.length === 3 && names[0].startsWith("Trạng thái hồ sơ") && names[1].startsWith("Liên hệ hỗ trợ") && names[2].startsWith("Cài đặt"), names);
  check("không có nút 'Khác', không số đếm việc", await rail().getByRole("button", { name: /^Khác/ }).count() === 0 && await rail().locator(".kin-badge-dem").count() === 0);
  check("'Trạng thái hồ sơ' đang ở (aria-current=page), chỉ một mục", await rail().getByRole("link", { name: /^Trạng thái hồ sơ/ }).getAttribute("aria-current") === "page" && await rail().locator("[aria-current=page]:visible").count() === 1);
  const band = pg.locator("[data-tutor-pending-band]");
  check("băng 'Hồ sơ gia sư đang chờ duyệt' trên vùng nội dung, có liên kết Liên hệ hỗ trợ", await band.count() === 1 && /Hồ sơ gia sư đang chờ duyệt/.test(await band.innerText()) && await band.getByRole("link", { name: "Liên hệ hỗ trợ" }).getAttribute("href") === "/lop-cua-toi/ho-tro");
  const card = pg.locator("[data-tutor-application]");
  const cardText = await card.innerText();
  check("thẻ trạng thái có CHỮ 'Đang chờ duyệt · gửi 20/10' (tone cho)", await card.locator('[data-kin-status="cho"]').count() === 1 && /Đang chờ duyệt · gửi 20\/10/.test(cardText), cardText);
  check("môn đã khai 'Toán, Lý' và đoạn giới thiệu đã khai", /Môn đã khai/.test(cardText) && /Toán, Lý/.test(cardText) && /Cử nhân Toán/.test(cardText));
  check("nút đặc 'Liên hệ hỗ trợ' → /lop-cua-toi/ho-tro; liên kết 'Sửa hồ sơ' → /lop-cua-toi/ho-so; 'Đổi chủ đề màu' → /cai-dat/chu-de",
    await pg.getByRole("link", { name: "Liên hệ hỗ trợ" }).last().getAttribute("href") === "/lop-cua-toi/ho-tro"
    && await pg.getByRole("link", { name: "Sửa hồ sơ" }).first().getAttribute("href") === "/lop-cua-toi/ho-so"
    && await pg.getByRole("link", { name: "Đổi chủ đề màu" }).getAttribute("href") === "/cai-dat/chu-de");
  check("không lộ 'Hộp việc', không hứa 'Dashboard'", !(await pg.locator("body").innerText()).includes("Dashboard"));
  const me = await pg.evaluate(async () => (await (await fetch("/api/auth/me")).json()) as Record<string, unknown>);
  check("/api/auth/me trả tutorPending=true, không lộ ngày / lý do đơn", me.tutorPending === true && !("tutorAppliedAt" in me) && !("tutorRejectedAt" in me), Object.keys(me));
  await shot(pg, "tutor-pending-cho-duyet");

  // ───────────────────────────── P2 ─────────────────────────────
  section("P2. Liên hệ hỗ trợ, Cài đặt, API tạo lớp");
  await pg.getByRole("link", { name: "Liên hệ hỗ trợ" }).last().click({ timeout: 60000 }); // nút đặc của trang (đứng sau liên kết trong băng)
  await eventually("tới /lop-cua-toi/ho-tro (không bị đẩy về /student)", () => at().pathname === "/lop-cua-toi/ho-tro", 90000);
  await pg.getByRole("heading", { name: "Liên hệ hỗ trợ" }).first().waitFor({ timeout: 90000 });
  await pg.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  check("trang hỗ trợ tải được cho gia sư chờ duyệt (API không 403), vẫn trong vỏ chờ duyệt", await pg.getByText("Chưa tải được trang hỗ trợ").count() === 0 && await rail().locator(".kin-rail-role", { hasText: "CHỜ DUYỆT" }).count() === 1 && await pg.locator("[data-tutor-pending-band]").count() === 1);
  await shot(pg, "tutor-pending-ho-tro");
  const ht = await api("GET", "/api/tutor/ho-tro", { as: P });
  check("GET /api/tutor/ho-tro → 200 cho người có đơn đang chờ", ht.status === 200, ht.status);
  const htS = await api("GET", "/api/tutor/ho-tro", { as: S });
  check("GET /api/tutor/ho-tro → 403 cho học sinh thường (không mở rộng quá mức)", htS.status === 403, htS.status);

  await rail().getByRole("link", { name: /^Cài đặt/ }).click({ timeout: 60000 });
  await eventually("Cài đặt → /cai-dat/chu-de", () => at().pathname === "/cai-dat/chu-de", 90000);
  await pg.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  check("ở /cai-dat/chu-de vẫn vỏ chờ duyệt (3 mục, nhãn CHỜ DUYỆT), không rơi vào vỏ học sinh", await rail().locator(".kin-rail-role", { hasText: "CHỜ DUYỆT" }).count() === 1 && await pg.getByRole("navigation", { name: "Module của học sinh" }).count() === 0);

  const cr = await api("POST", "/api/courses", { as: P, body: { name: "Lớp lậu", category: "toan" } });
  check("POST /api/courses của gia sư chờ duyệt → 403", cr.status === 403, cr.status);
  check("DB: không có lớp nào được tạo", (await prisma.course.count({ where: { ownerId: P.id } })) === 0);
  await ctx.close();

  // ───────────────────────────── P3 ─────────────────────────────
  section("P3. Bị từ chối / học sinh thường / gia sư mở trang chờ duyệt");
  const cr2 = await ctxFor(R, { width: 1280, height: 900 });
  const pr = await cr2.newPage(); watch(pr);
  await pr.goto(`${BASE}/lop-cua-toi/cho-duyet`, GOTO);
  await pr.getByRole("heading", { name: "Hồ sơ gia sư chưa được duyệt", level: 1 }).waitFor({ timeout: 90000 });
  await pr.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  const rt = await pr.locator("[data-tutor-application]").innerText();
  check("bị từ chối: thẻ 'Bị từ chối' (tone loi) + lý do 'Chưa đủ kinh nghiệm'", await pr.locator('[data-kin-status="loi"]').count() === 1 && /Bị từ chối/.test(rt) && /Chưa đủ kinh nghiệm/.test(rt), rt);
  check("bị từ chối là học sinh thường: vỏ 'Module của học sinh', không băng chờ duyệt", await pr.getByRole("navigation", { name: "Module của học sinh" }).count() === 1 && await pr.locator("[data-tutor-pending-band]").count() === 0);
  await pr.goto(`${BASE}/student/viec-cua-toi`, GOTO);
  await pr.getByRole("heading", { name: "Việc của tôi" }).first().waitFor({ timeout: 90000 });
  check("bị từ chối vào /student/viec-cua-toi bình thường", new URL(pr.url()).pathname === "/student/viec-cua-toi");
  await cr2.close();

  const cs = await ctxFor(S, { width: 1280, height: 900 });
  const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${BASE}/lop-cua-toi/cho-duyet`, GOTO);
  await ps.waitForURL(u => u.pathname === "/student/viec-cua-toi", { timeout: 90000 }).catch(() => {});
  check("học sinh thường (không có đơn) mở trang chờ duyệt → Việc của tôi", new URL(ps.url()).pathname === "/student/viec-cua-toi", ps.url());
  const me2 = await ps.evaluate(async () => (await (await fetch("/api/auth/me")).json()) as Record<string, unknown>);
  check("học sinh thường: tutorPending=false", me2.tutorPending === false);
  await cs.close();

  const ct = await ctxFor(T, { width: 1280, height: 900 });
  const pt = await ct.newPage(); watch(pt);
  await pt.goto(`${BASE}/lop-cua-toi/cho-duyet`, GOTO);
  await pt.waitForURL(u => u.pathname === "/lop-cua-toi", { timeout: 90000 }).catch(() => {});
  check("gia sư đã duyệt mở trang chờ duyệt → Hộp việc /lop-cua-toi", new URL(pt.url()).pathname === "/lop-cua-toi", pt.url());
  await pt.goto(`${BASE}/student/viec-cua-toi`, GOTO);
  await pt.waitForURL(u => u.pathname === "/lop-cua-toi", { timeout: 90000 }).catch(() => {});
  check("BU-00 bước 4: gia sư gõ /student/viec-cua-toi → về Hộp việc (không còn 'xem thử' khu học sinh)", new URL(pt.url()).pathname === "/lop-cua-toi", pt.url());
  await pt.goto(`${BASE}/cai-dat/chu-de`, GOTO);
  await pt.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  check("gia sư vẫn vào /cai-dat/chu-de (trang dùng chung) trong vỏ gia sư", new URL(pt.url()).pathname === "/cai-dat/chu-de" && await pt.getByRole("navigation", { name: RAIL }).getByText("GIA SƯ").isVisible());
  await ct.close();

  // ───────────────────────────── P4 ─────────────────────────────
  section("P4. Quản trị xem thử khu học sinh có băng rõ ràng");
  const ca = await ctxFor(SA, { width: 1280, height: 900 });
  const pa = await ca.newPage(); watch(pa);
  await pa.goto(`${BASE}/lop-cua-toi`, GOTO);
  await pa.getByRole("heading", { name: "Lớp của tôi" }).waitFor({ timeout: 90000 });
  await pa.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  const pv = pa.locator("[data-admin-preview]");
  check("quản trị cấp 1 ở /lop-cua-toi: vỏ học sinh + băng 'Đang xem thử giao diện học sinh · Về bảng quản trị' (→ /admin)", await pa.getByRole("navigation", { name: "Module của học sinh" }).count() === 1 && await pv.count() === 1 && /Đang xem thử giao diện học sinh/.test(await pv.innerText()) && await pv.getByRole("link", { name: "Về bảng quản trị" }).getAttribute("href") === "/admin");
  await pa.goto(`${BASE}/student/viec-cua-toi`, GOTO);
  await pa.getByRole("heading", { name: "Việc của tôi" }).first().waitFor({ timeout: 90000 });
  check("quản trị cấp 1 vào /student/viec-cua-toi vẫn được (xem thử), cũng có băng", new URL(pa.url()).pathname === "/student/viec-cua-toi" && await pa.locator("[data-admin-preview]").count() === 1);
  await ca.close();

  // ───────────────────────────── P5 ─────────────────────────────
  section("P5. Điện thoại 390px");
  const cm = await ctxFor(P, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}/lop-cua-toi/cho-duyet`, GOTO);
  await pm.getByRole("heading", { name: "Hồ sơ gia sư đang chờ duyệt", level: 1 }).waitFor({ timeout: 90000 });
  await pm.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  const over = await pm.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("không tràn ngang ở 390px", over <= 0, over);
  const bottom = pm.getByRole("navigation", { name: RAIL }).last();
  const wid = await bottom.getByRole("link").evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent).map(e => ({ w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
  check("thanh dưới 3 mục, mỗi nút ≥ 44px", wid.length === 3 && wid.every(x => x.w >= 44 && x.h >= 44), wid);
  const btn = await pm.getByRole("link", { name: "Liên hệ hỗ trợ" }).last().boundingBox();
  check("nút 'Liên hệ hỗ trợ' cao ≥ 44px", !!btn && btn.height >= 44, btn);
  await shot(pm, "tutor-pending-mobile");
  await cm.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
