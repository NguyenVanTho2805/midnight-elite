import { wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";

(async () => {
  await wipe();
  await launch();
  const errors: string[] = [];
  for (const [label, w] of [["máy tính", 1280], ["điện thoại 390px", 390]] as const) {
    section(`Trang chủ khối gia sư — ${label}`);
    const ctx = await ctxFor(null, { width: w, height: 900 });
    const page = await ctx.newPage();
    page.on("pageerror", x => errors.push(String(x)));
    await page.goto(`${process.env.BASE}/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Việc giấy tờ tăng theo số lớp" }).waitFor({ timeout: 90000 });
    check("6 nỗi đau", (await page.locator("#h-gia-su").locator("xpath=ancestor::section//ul/li").count()) === 6);
    check("3 bước", (await page.locator("ol > li", { hasText: /^Bước/ }).count()) === 3);
    check("10 câu hỏi", (await page.locator("#cau-hoi details").count()) === 10);
    const first = page.locator("#cau-hoi details").first();
    check("FAQ đóng sẵn", !(await first.evaluate(e => (e as HTMLDetailsElement).open)));
    await first.locator("summary").click();
    check("bấm mở được câu hỏi", await first.evaluate(e => (e as HTMLDetailsElement).open));
    const cta = page.getByRole("link", { name: "Tạo tài khoản gia sư" });
    check("nút tạo tài khoản → /dang-ky?vai=gia-su", (await cta.getAttribute("href")) === "/dang-ky?vai=gia-su");
    check("không tràn ngang", (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) as boolean);
    const small = await page.evaluate(() => [...document.querySelectorAll("#cau-hoi summary, #h-gia-su ~ * a")].filter(el => el.getBoundingClientRect().height < 44).length);
    check("dòng câu hỏi cao ≥ 44px", small === 0, small);
    await shot(page, `landing-tutor-${w}`);
    await ctx.close();
  }
  check("không lỗi trang", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
