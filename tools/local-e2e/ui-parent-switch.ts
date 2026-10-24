import { mkUser, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { mkCourse, mkTutor } from "./h";

const tok = (n: number) => n.toString(16).padStart(32, "0");
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const c = await mkCourse(T.id, { name: "Toán 9" });
  const names = ["Bé Gia Bảo", "Bé Đỗ Hà"];
  const p = await mkUser({ name: "Chị Hoa" });
  for (let i = 0; i < 2; i++) {
    const s = await mkUser({ name: names[i] });
    await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active" } });
    await prisma.parentLink.create({ data: { parentId: p.id, studentId: s.id, status: "verified", verifiedAt: new Date(), portalToken: tok(i + 1) } });
  }
  await launch();
  const errors: string[] = [];
  for (const [label, w] of [["máy tính", 1280], ["điện thoại 390px", 390]] as const) {
    section(`PH-05 chuyển giữa các con — ${label}`);
    const ctx = await ctxFor(null, { width: w, height: 900 });
    const page = await ctx.newPage();
    page.on("pageerror", x => errors.push(String(x)));
    const B = process.env.BASE;
    await page.goto(`${B}/so-cua-con/${tok(1)}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.getByRole("heading", { name: /Sổ của con: Bé Gia Bảo/ }).waitFor({ timeout: 90000 });
    check("mới mở một em: chưa có thanh chuyển", (await page.getByTestId("child-switcher").count()) === 0);
    await page.goto(`${B}/so-cua-con/${tok(2)}`, { waitUntil: "networkidle", timeout: 120000 });
    const sw = page.getByTestId("child-switcher");
    await sw.waitFor({ timeout: 30000 });
    check("mở em thứ hai: thấy cả hai em", (await sw.getByRole("link").count()) === 2);
    check("em đang xem đánh dấu aria-current", (await sw.locator("a[aria-current=page]").innerText()).includes("Bé Đỗ Hà"));
    const html = await (await page.request.get(`${B}/so-cua-con/${tok(2)}`)).text();
    check("máy chủ KHÔNG trả token / tên em kia (không gộp dữ liệu giữa các em)", !html.includes(tok(1)) && !html.includes("Bé Gia Bảo"));
    for (const l of await sw.getByRole("link").all()) { const b = await l.boundingBox(); check("liên kết chuyển cao ≥ 44px", !!b && b.height >= 44, b); }
    check("không tràn ngang", (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) as boolean);
    await shot(page, `parent-switch-${w}`);
    await sw.getByRole("link", { name: /Bé Gia Bảo/ }).click();
    await page.getByRole("heading", { name: /Sổ của con: Bé Gia Bảo/ }).waitFor({ timeout: 90000 });
    check("bấm chuyển sang em kia", page.url().endsWith(`/so-cua-con/${tok(1)}`));
    await page.getByRole("button", { name: /Xoá danh sách khỏi máy này/ }).click();
    await page.waitForFunction(() => !document.querySelector("[data-testid=child-switcher]"));
    check("xoá danh sách → thanh chuyển biến mất", (await page.getByTestId("child-switcher").count()) === 0);
    await ctx.close();
  }
  check("không lỗi trang", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
