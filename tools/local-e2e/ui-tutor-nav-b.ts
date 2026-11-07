// Điều hướng đợt B (08/11/2026) — phần Gia sư. B3: ô "Khác" trên thanh dưới điện thoại, đo vùng chạm ≥44px ở 320 / 390px; B1: một trang chủ;
// B2: menu tài khoản chỉ việc của bản thân, bảng Khác không còn "Liên hệ hỗ trợ"; B6 GS-09: "Yêu cầu tìm gia sư" vào được dù tắt module Lớp;
// B5 GS-10: nút quay lại của Sổ điểm về Lớp (không về Doanh thu).
import { BASE, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), TL = await mkTutor("Cô Không Lớp");
  await mkCourse(T.id, { name: "Toán 9" });
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lich", "lop", "hoc-phi"] } } });
  await prisma.user.update({ where: { id: TL.id }, data: { preferences: { modules: ["hop-viec", "lich", "hoc-phi"] } } }); // tắt Lớp
  await launch();
  const RAIL = "Module của gia sư";

  for (const w of [320, 390]) {
    section(`Thanh dưới điện thoại ${w}px: 5 ô gồm Khác`);
    const ctx = await ctxFor(T, { width: w, height: 800 });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
    await p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
    const bar = p.getByRole("navigation", { name: RAIL });
    await bar.waitFor({ timeout: 90000 });
    const sizes = await p.evaluate(`[...document.querySelectorAll('nav[aria-label="${RAIL}"] a, nav[aria-label="${RAIL}"] button')].filter(e => e.offsetParent).map(e => ({ t: (e.textContent || "").trim().slice(0, 12), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))`) as { t: string; w: number; h: number }[];
    check(`${w}px: đúng 5 ô (Hộp việc, Lịch, Lớp, Học phí, Khác)`, sizes.length === 5 && /^Khác/.test(sizes[4].t), sizes);
    check(`${w}px: mỗi ô rộng và cao ≥ 44px`, sizes.every(s => s.w >= 44 && s.h >= 44), sizes);
    check(`${w}px: không tràn ngang`, await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
    const labelsCut = await p.evaluate(`[...document.querySelectorAll('nav[aria-label="${RAIL}"] span.truncate')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth).map(e => e.textContent)`) as string[];
    check(`${w}px: nhãn các ô không bị cắt`, labelsCut.length === 0, labelsCut);
    await bar.getByRole("button", { name: /^Khác/ }).click();
    const dlg = p.getByRole("dialog", { name: "Các mục khác" });
    await dlg.waitFor({ timeout: 30000 });
    const db = await dlg.boundingBox();
    check(`${w}px: bấm Khác mở bảng, nằm trong màn hình và nổi trên thanh dưới`, !!db && db.x >= 0 && db.x + db.width <= w + 1 && db.y >= 0 && db.y + db.height <= 800 - 60 + 1, db);
    check(`${w}px: mục trong bảng cao ≥ 44px`, (await dlg.evaluate(`[...document.querySelectorAll('[role=dialog] a, [role=dialog] button')].map(e => Math.round(e.getBoundingClientRect().height))`) as number[]).every(h => h >= 44));
    check(`${w}px: bảng có Cài đặt (lối tới Cài đặt trên điện thoại), không có Liên hệ hỗ trợ`, await dlg.getByRole("link", { name: "Cài đặt", exact: true }).isVisible() && await dlg.getByRole("link", { name: "Liên hệ hỗ trợ" }).count() === 0);
    if (w === 320) await shot(p, "tutor-nav-b-320");
    await ctx.close();
  }

  section("B2: menu tài khoản chỉ việc của bản thân");
  const c2 = await ctxFor(T, { width: 1280, height: 800 });
  const p2 = await c2.newPage();
  await p2.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await p2.getByRole("button", { name: /^Tài khoản của/ }).click();
  const names = (await p2.getByRole("menuitem").allInnerTexts()).map(t => t.trim()).filter(Boolean);
  check("menu tài khoản: Cài đặt, Hồ sơ gia sư, Trang chủ KiN, Đăng xuất; không 'Liên hệ hỗ trợ' / 'Tất cả mục' / 'Tổng quan'", names.includes("Cài đặt") && names.includes("Hồ sơ gia sư") && names.includes("Đăng xuất") && !names.some(n => /hỗ trợ|Tất cả mục|Tổng quan/.test(n)), names);
  check("dấu hỏi trên đỉnh vẫn còn → /lop-cua-toi/ho-tro", await p2.locator("[data-help-link]").getAttribute("href") === "/lop-cua-toi/ho-tro");
  await c2.close();

  section("B6 GS-09: tắt module Lớp vẫn có Học sinh và Yêu cầu tìm gia sư");
  const c3 = await ctxFor(TL, { width: 1280, height: 800 });
  const p3 = await c3.newPage();
  await p3.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  const rail3 = p3.getByRole("navigation", { name: RAIL });
  await rail3.waitFor({ timeout: 90000 });
  check("Lớp tắt: thanh bên không có 'Lớp' nhưng vẫn có 'Học sinh' → /lop-cua-toi/hoc-sinh", await rail3.getByRole("link", { name: /^Lớp/ }).count() === 0 && await rail3.getByRole("link", { name: /^Học sinh/ }).getAttribute("href") === "/lop-cua-toi/hoc-sinh");
  await rail3.getByRole("button", { name: /^Khác/ }).click();
  const d3 = p3.getByRole("dialog", { name: "Các mục khác" });
  check("bảng Khác nhóm Giới thiệu có 'Yêu cầu tìm gia sư' → /lop-cua-toi/yeu-cau", await d3.getByRole("link", { name: "Yêu cầu tìm gia sư" }).getAttribute("href") === "/lop-cua-toi/yeu-cau");
  await d3.getByRole("link", { name: "Yêu cầu tìm gia sư" }).click();
  await p3.waitForURL(/\/lop-cua-toi\/yeu-cau/, { timeout: 90000 });
  check("mở được trang yêu cầu (không bị đẩy về Hộp việc)", new URL(p3.url()).pathname === "/lop-cua-toi/yeu-cau", p3.url());
  await c3.close();

  section("B5 GS-10: Sổ điểm quay lại Lớp, không về Doanh thu");
  const c4 = await ctxFor(T, { width: 1280, height: 800 });
  const p4 = await c4.newPage();
  await p4.goto(`${BASE}/lop-cua-toi/so-diem`, { waitUntil: "networkidle", timeout: 120000 });
  const back = p4.getByRole("link", { name: /^← Lớp$/ });
  await back.waitFor({ timeout: 60000 });
  check("nút quay lại → /lop-cua-toi/lop", await back.getAttribute("href") === "/lop-cua-toi/lop");
  check("không còn liên kết quay về Doanh thu ở đầu trang", await p4.getByRole("link", { name: /Dạy học và doanh thu/ }).count() === 0);
  await c4.close();

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
