// LOI-05 — ảnh cho chủ bằng DỮ LIỆU THỬ (tools/local-e2e/mock-tim-gia-su.ts, 8 gia sư mock-tgs-<n>@kin.test). KHÔNG wipe, KHÔNG tạo/sửa dữ liệu.
// Cần: máy chủ dev với NEXT_PUBLIC_KIN_MO_TIM_GIA_SU=1 (sàn /giang-vien mở) và đã chạy mock-tim-gia-su.ts. Ảnh: scratchpad/shots/loi05-mock-*.png.
//   source tools/local-e2e/env.sh && NEXT_PUBLIC_KIN_MO_TIM_GIA_SU=1 npx tsx tools/local-e2e/shoot-loi05.ts
// Chụp: danh sách 1600 + 390 (toàn trang), tờ lọc 390, lọc Online ở 1600, hồ sơ người tên dài 1600 + 390, hồ sơ người không ảnh 390.
// Mỗi ảnh chỉ chụp sau khi khung chờ ([data-luoi-cho]) đã đi, luồng Next đã tráo xong (không còn div[hidden][id^="S:"]) và mọi <img> đã tải.
import { mkdirSync } from "node:fs";
import { BASE } from "./h";
import { launch, ctxFor, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";

const DIR = process.env.SHOTS ?? "scratchpad/shots";
mkdirSync(DIR, { recursive: true });
const CARD = "[data-the-gia-su]";
const rel = (u: string) => { const x = new URL(u); return x.pathname + x.search; };

async function ready(p: Page, sel: string) {
  await p.locator(sel).first().waitFor({ timeout: 90000 });
  await p.locator("[data-luoi-cho]").waitFor({ state: "detached", timeout: 60000 }).catch(() => undefined);
  await p.waitForFunction(`!document.querySelector('div[hidden][id^="S:"]')`, undefined, { timeout: 60000 }).catch(() => undefined);
  await p.waitForFunction(`Array.prototype.every.call(document.images, function (i) { return i.complete; })`, undefined, { timeout: 30000 }).catch(() => undefined);
  await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
  await p.waitForTimeout(400);
}
async function snap(p: Page, name: string, fullPage = true) {
  const path = `${DIR}/loi05-mock-${name}.png`;
  await p.screenshot({ path, fullPage });
  console.log("ảnh:", path);
}

(async () => {
  if (!featureOn("TIM_GIA_SU")) throw new Error("Cần NEXT_PUBLIC_KIN_MO_TIM_GIA_SU=1 (cho cả máy chủ dev và lệnh này).");
  const mock = await prisma.user.findMany({ where: { email: { startsWith: "mock-tgs-" } }, select: { id: true, name: true, email: true, avatarBase64: true } });
  if (mock.length !== 8) throw new Error(`cần 8 gia sư thử, thấy ${mock.length} — chạy tools/local-e2e/mock-tim-gia-su.ts trước`);
  const longest = [...mock].sort((a, b) => b.name.length - a.name.length)[0];
  const noPhoto = mock.find(m => !m.avatarBase64);
  if (!noPhoto) throw new Error("không thấy gia sư thử không ảnh");

  await launch();
  // Danh sách 1600 + 390 (toàn trang)
  for (const [label, w, h] of [["1600", 1600, 900], ["390", 390, 844]] as const) {
    const ctx = await ctxFor(null, { width: w, height: h });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/giang-vien`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(p, CARD);
    console.log(`danh sách ${label}: ${await p.locator(CARD).count()} thẻ`);
    await snap(p, `danh-sach-${label}`);

    if (w === 390) {
      // Tờ lọc 390 (chụp khung nhìn: tờ trượt là lớp cố định)
      await p.getByRole("button", { name: /^Lọc \(/ }).click();
      await p.getByRole("dialog", { name: "Lọc gia sư" }).waitFor({ timeout: 15000 });
      await p.waitForTimeout(300);
      await snap(p, "to-loc-390", false);
    } else {
      // Lọc Online ở 1600
      await p.locator("[data-hang-loc]").getByRole("button", { name: "Online", exact: true }).click();
      await p.waitForURL(u => rel(u.toString()).includes("mode=online"), { timeout: 30000 });
      await p.waitForFunction(`(function () { var s = document.querySelector("[data-san-gia-su-client] > [role=status]"); return s && /\\d+ gia sư/.test(s.textContent || ""); })()`, undefined, { timeout: 60000 });
      await ready(p, CARD);
      console.log(`lọc Online 1600: ${await p.locator(CARD).count()} thẻ`);
      await snap(p, "loc-online-1600");
    }
    await ctx.close();
  }

  // Hồ sơ người tên dài 1600 + 390; hồ sơ người không ảnh 390
  for (const [name, id, w, h] of [["ho-so-ten-dai-1600", longest.id, 1600, 900], ["ho-so-ten-dai-390", longest.id, 390, 844], ["ho-so-khong-anh-390", noPhoto.id, 390, 844]] as const) {
    const ctx = await ctxFor(null, { width: w, height: h });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/mentor/${id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(p, "[data-ho-so-dau]");
    console.log(`${name}: H1 = ${(await p.locator("[data-ho-so] h1").innerText()).trim()}`);
    await snap(p, name);
    await ctx.close();
  }
  await closeAll();
  await prisma.$disconnect?.();
})().catch(async e => { console.error("SHOOT CRASH", e); await closeAll(); process.exit(1); });
