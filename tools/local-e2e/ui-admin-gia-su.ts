// BU-08 — Con người → Gia sư (chỉ đọc): không nút Duyệt/Từ chối kể cả đơn đang chờ; đường cũ /admin/ho-so-gia-su → Hàng chờ (308).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-gia-su.ts
import { mkUser, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN, adminGet } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const pend = await mkUser({ name: "Gia sư đang chờ", emailVerified: true });
  const okU = await mkUser({ name: "Gia sư đã duyệt", emailVerified: true });
  const now = new Date();
  await prisma.user.update({ where: { id: pend.id }, data: { tutorAppliedAt: now, subjects: ["Toán"], city: "Hà Nội" } });
  await prisma.user.update({ where: { id: okU.id }, data: { tutorAppliedAt: now, tutorVerifiedAt: now, tutorVerified: true, subjects: ["Lý"], city: "Huế" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);

  section("Lịch sử gia sư 1280");
  await pg.goto(`${ADMIN}/admin/gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.locator("[data-gia-su-table]").waitFor({ timeout: 120000 });
  check("mặc định lọc 'Đã duyệt': thấy gia sư đã duyệt, dải 'Đang lọc'", await pg.getByRole("rowheader", { name: "Gia sư đã duyệt" }).count() === 1 && /Đang lọc: Đã duyệt/.test(await pg.locator("[data-dang-loc]").innerText()));
  check("cột đầu 'Gia sư' (định danh)", (await pg.locator("[data-gia-su-table] thead th").first().innerText()).trim().toLowerCase() === "gia sư");
  await pg.getByRole("tab", { name: "Đang chờ" }).click().catch(async () => { await pg.getByText("Đang chờ", { exact: true }).first().click(); });
  await pg.getByRole("rowheader", { name: "Gia sư đang chờ" }).waitFor({ timeout: 60000 });
  check("đơn đang chờ: KHÔNG nút 'Duyệt' / 'Từ chối' ở bất kỳ đâu trên trang", await pg.getByRole("button", { name: /^(Duyệt|Từ chối)/ }).count() === 0);
  const row = pg.locator("[data-gia-su-table] tbody tr").filter({ hasText: "Gia sư đang chờ" });
  check("hàng đang chờ có liên kết 'Mở trong Hàng chờ' → ?loai=gia-su; ≤ 2 nút", await row.getByRole("link", { name: "Mở trong Hàng chờ" }).getAttribute("href") === "/admin/kiem-duyet?loai=gia-su" && await row.locator("button, a[href]").count() <= 2);
  await row.locator("[data-row-open]").click();
  await pg.locator("aside[data-side-panel]").waitFor({ timeout: 30000 });
  check("panel chi tiết: aside, không role=dialog, không email/số điện thoại", await pg.locator("[role=dialog]").count() === 0 && !/@test\.local/.test(await pg.locator("aside[data-side-panel]").innerText()));
  await pg.keyboard.press("Escape");
  await shot(pg, "admin-gia-su-1280");

  section("Đường cũ → 308 → Hàng chờ");
  const res = await adminGet(pg, `${ADMIN}/admin/ho-so-gia-su`);
  check("GET /admin/ho-so-gia-su → 308, Location ?loai=gia-su", res.status() === 308 && /\/admin\/kiem-duyet\?loai=gia-su/.test(res.headers()["location"] ?? ""), [res.status(), res.headers()["location"]]);
  await pg.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "domcontentloaded" });
  await pg.waitForURL(/\/admin\/kiem-duyet\?loai=gia-su/, { timeout: 60000 });
  check("mở đường cũ trong trình duyệt → tới hàng chờ lọc gia sư", /loai=gia-su/.test(pg.url()));
  const old2 = await adminGet(pg, `${ADMIN}/admin/cong-dong/bao-cao`);
  check("GET /admin/cong-dong/bao-cao → 308 ?loai=tra-loi", old2.status() === 308 && /loai=tra-loi/.test(old2.headers()["location"] ?? ""), old2.status());
  await ctx.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.locator("[data-gia-su-table]").waitFor({ timeout: 120000 });
  check("390: không tràn trang (bảng cuộn trong khung của nó)", await pm.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await shot(pm, "admin-gia-su-390");
  await cm.close();

  check("không lỗi console/pageerror lạ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
