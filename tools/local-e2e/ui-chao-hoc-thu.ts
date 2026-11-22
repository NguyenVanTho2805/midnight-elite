// SCL đợt 5 — trang chào /chao/<mã> ở 390 và 1280: chào theo tên, lớp + lịch, Zalo học thử CHỈ với mã hợp lệ, không tràn, nút ≥ 44px; đặt mật khẩu ⇒ vào vỏ học sinh;
// mở lớp ⇒ đồng hồ 14 ngày bắt đầu + băng nhắc; hết hạn ⇒ thẻ lớp mờ + thẻ khoá. Next 16 giữ trang ẩn trong DOM ⇒ locator :visible.
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-chao-hoc-thu.ts
import { prisma } from "@/lib/prisma";
import { BASE, api, mkTutor, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";

const KEY = process.env.KIN_INTAKE_KEY ?? "";
const D = 86_400_000;
const intake = (gmail: string, hoTen: string) => api("POST", "/api/intake/bca", { headers: { "x-kin-intake-key": KEY }, body: { loai: "hocthu", hoTen, sdt: "0911222333", gmail, khoi: "12", mon: ["Toán", "Sử", "Anh"], reqId: gmail } });
const mkC = (id: string, ownerId: string, name: string) => prisma.course.create({ data: { id, adminId: Math.floor(Math.random() * 1e9), name, adminName: name, shortTitle: name, category: "toan", instructor: "Anh Thanh", teacherAvatar: "", openDate: "2026-11-01", types: [], bg: "", price: 0, createdAt: new Date().toISOString(), ownerId, classStatus: "open", joinPolicy: "invite_only" } });

async function layoutOk(p: Page, w: number) {
  check(`${w}px: không tràn ngang`, await p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), await p.evaluate("[document.documentElement.scrollWidth, innerWidth]"));
  const small = await p.evaluate(`[...document.querySelectorAll('main a[class*="kin-btn"], main button, main a[data-chao-zalo], main [data-chao-dat]')].filter(e => e.offsetParent).map(e => [e.textContent.trim().slice(0,30), Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44)`);
  check(`${w}px: nút trong trang ≥ 44px`, (small as unknown[]).length === 0, small);
}

(async () => {
  await wipe();
  const T = await mkTutor("Anh Thanh");
  await mkC("bca-toan", T.id, "BCA Midnight Class · Toán 12");
  await mkC("bca-su", T.id, "BCA Midnight Class · Sử 12");
  await prisma.classSchedule.createMany({ data: [{ courseId: "bca-toan", dayOfWeek: 2, startTime: "20:00", endTime: "21:30" }, { courseId: "bca-toan", dayOfWeek: 5, startTime: "20:00", endTime: "21:30" }] });
  const r = await intake("hs.chao@gmail.com", "Phạm Minh Châu");
  const next: string = r.json?.next ?? "";
  check("intake trả next", next.includes("/chao/"), r.json);
  const path = new URL(next).pathname;

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); };

  for (const w of [390, 1280]) {
    section(`Trang chào ${w}px`);
    const ctx = await ctxFor(null, { width: w, height: 900 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
    await p.locator("h1:visible", { hasText: "Chào Châu" }).waitFor({ timeout: 60000 });
    check("chào theo tên, không họ đầy đủ", (await p.locator("[data-chao-trang]:visible").innerText()).includes("Chào Châu") && !(await p.content()).includes("Phạm Minh Châu"));
    check("hai lớp + lịch (T3, T6)", await p.locator("[data-chao-mon]:visible").count() === 2 && (await p.locator("[data-chao-mon='bca-toan']:visible").innerText()).includes("T3 · 20:00–21:30"));
    check("khối học thử 14 ngày", (await p.locator("[data-chao-hoc-thu]:visible").innerText()).includes("14 ngày tính từ lần đầu bạn vào lớp"));
    check("nút Zalo học thử hiện", await p.locator("[data-chao-zalo]:visible").count() === 1);
    check("form đặt mật khẩu hiện", await p.locator("[data-chao-dat]:visible").count() === 1);
    await layoutOk(p, w);
    await shot(p, `ui-chao-hoc-thu-${w}`);
    await ctx.close();
  }

  section("Mã sai ⇒ không Zalo học thử (D3)");
  {
    const ctx = await ctxFor(null, { width: 390, height: 900 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/chao/${"z".repeat(43)}`, { waitUntil: "networkidle", timeout: 120000 });
    await p.locator("h1:visible", { hasText: "Link đã hết hạn" }).waitFor({ timeout: 60000 });
    check("màn hết hạn, không có link nhóm Zalo học thử", (await p.locator("a[href*='zalo.me/g/']").count()) === 0 && (await p.locator("a[href='/quen-mat-khau']:visible").count()) >= 1);
    await layoutOk(p, 390);
    await shot(p, "ui-chao-het-han-390");
    await ctx.close();
  }

  section("Đặt mật khẩu ⇒ vào vỏ học sinh; mở lớp ⇒ đồng hồ bắt đầu");
  const ctx = await ctxFor(null, { width: 390, height: 900 });
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
  await p.locator("input[name=password]:visible").fill("matkhau123");
  await p.locator("input[name=confirm]:visible").fill("matkhau124");
  await p.locator("[data-chao-dat]:visible").click();
  await p.locator("[role=alert]:visible", { hasText: "chưa giống nhau" }).waitFor({ timeout: 60000 });
  check("nhập lại sai ⇒ báo lỗi, ở lại trang chào", p.url().includes("/chao/"));
  await p.locator("input[name=password]:visible").fill("matkhau123");
  await p.locator("input[name=confirm]:visible").fill("matkhau123");
  await p.locator("[data-chao-dat]:visible").click();
  await p.waitForURL(/\/student\/viec-cua-toi/, { timeout: 90000 });
  await p.getByRole("heading", { level: 1, name: "Cần làm" }).first().waitFor({ timeout: 90000 });
  check("đã đăng nhập, ở Cần làm", new URL(p.url()).pathname === "/student/viec-cua-toi");
  const u = await prisma.user.findUnique({ where: { email: "hs.chao@gmail.com" } });
  check("chưa mở lớp ⇒ chưa tính ngày", (await prisma.enrollment.findMany({ where: { userId: u!.id } })).every(e => e.trialStartedAt === null));
  await p.goto(`${BASE}/student/hoc-tap?course=bca-toan`, { waitUntil: "networkidle", timeout: 120000 });
  await p.locator("[data-trial-bang]:visible").waitFor({ timeout: 60000 });
  check("băng 'Bắt đầu tính 14 ngày học thử từ hôm nay'", (await p.locator("[data-trial-bang]:visible").innerText()).includes("Bắt đầu tính 14 ngày"));
  const es = await prisma.enrollment.findMany({ where: { userId: u!.id } });
  check("mở lớp ⇒ MỌI ghi danh thử bắt đầu cùng mốc", es.length === 2 && !!es[0].trialStartedAt && es.every(e => e.trialStartedAt?.getTime() === es[0].trialStartedAt?.getTime()), es);
  await layoutOk(p, 390);
  await shot(p, "ui-chao-lop-bat-dau-390");

  section("Còn ≤ 3 ngày ⇒ băng nhắc sắp hết");
  await prisma.enrollment.updateMany({ where: { userId: u!.id }, data: { trialStartedAt: new Date(Date.now() - 12 * D) } });
  await p.goto(`${BASE}/student/hoc-tap?course=bca-toan`, { waitUntil: "networkidle", timeout: 120000 });
  await eventually("băng 'Học thử · còn 2 ngày' (giọng trung tính, có lối đăng ký)", async () => (await p.locator("[data-trial-bang='sap-het']:visible").count()) === 1 && (await p.locator("[data-trial-bang]:visible").innerText()).includes("còn 2 ngày"), 60000);
  await shot(p, "ui-chao-lop-sap-het-390");

  section("Hết hạn ⇒ thẻ lớp mờ + thẻ khoá");
  await prisma.enrollment.updateMany({ where: { userId: u!.id }, data: { trialStartedAt: new Date(Date.now() - 15 * D) } });
  await p.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await eventually("thư viện lớp: thẻ lớp hết hạn (mờ) vẫn hiện", async () => (await p.locator("[data-trial-het-han='1']:visible").count()) === 2, 60000);
  check("đã lật trial_expired khi mở vỏ", (await prisma.enrollment.findMany({ where: { userId: u!.id } })).every(e => e.status === "trial_expired"));
  await shot(p, "ui-chao-thu-vien-het-han-390");
  await p.goto(`${BASE}/student/hoc-tap?course=bca-toan`, { waitUntil: "networkidle", timeout: 120000 });
  await p.locator("[data-trial-khoa]:visible").waitFor({ timeout: 60000 });
  check("thẻ khoá có 'Hết thời gian học thử' + Đăng ký chính thức + Zalo anh Thanh",
    (await p.locator("[data-trial-khoa]:visible").innerText()).includes("Hết thời gian học thử") && (await p.locator("[data-dang-ky-chinh-thuc]:visible").getAttribute("href")) === "https://aodtsix-cmd.github.io/bca-midnight-class/" && (await p.locator("[data-trial-khoa] a[href='https://zalo.me/0384409051']:visible").count()) === 1);
  check("không lộ bài học trong lớp khoá", (await p.locator("[data-lesson-row]").count()) === 0);
  await layoutOk(p, 390);
  await shot(p, "ui-chao-lop-khoa-390");
  await p.setViewportSize({ width: 1280, height: 900 });
  await layoutOk(p, 1280);
  await shot(p, "ui-chao-lop-khoa-1280");
  await ctx.close();

  check("không lỗi JS trên trang", errors.length === 0, errors);
  await closeAll();
  await done();
})();
