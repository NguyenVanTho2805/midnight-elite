import { mkTutor, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await launch();
  const errors: string[] = [];
  for (const [label, w] of [["máy tính", 1280], ["điện thoại 390px", 390]] as const) {
    section(`KH-02 Tìm gia sư — ${label}`);
    const ctx = await ctxFor(null, { width: w, height: 900 });
    const page = await ctx.newPage();
    page.on("pageerror", x => errors.push(String(x)));
    await page.goto(`${process.env.BASE}/giang-vien`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Tìm gia sư" }).waitFor({ timeout: 90000 });
    const card = page.getByRole("link", { name: "Xem hồ sơ Cô Lan" });
    await card.waitFor({ timeout: 60000 });
    const req = page.getByRole("link", { name: "Gửi yêu cầu cho Cô Lan" });
    check("có nút Xem hồ sơ + Gửi yêu cầu", await card.isVisible() && await req.isVisible());
    check("Gửi yêu cầu → /mentor/<id>/yeu-cau", (await req.getAttribute("href")) === `/mentor/${T.id}/yeu-cau`);
    for (const l of [card, req]) { const b = await l.boundingBox(); check("nút cao ≥ 44px", !!b && b.height >= 44, b); }
    check("không tràn ngang", (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) as boolean);
    await req.click();
    await page.getByRole("heading", { name: /Gửi yêu cầu cho Cô Lan/ }).waitFor({ timeout: 90000 });
    check("mở được biểu mẫu yêu cầu của đúng gia sư (không cần đăng nhập)", true);
    await shot(page, `tim-gia-su-${w}`);
    await ctx.close();
  }
  check("không lỗi trang", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
