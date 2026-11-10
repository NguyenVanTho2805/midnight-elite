// Chụp màn hình BU-HS-TRANG-CHU để nhìn bằng mắt (không kiểm khẳng định): Trang chủ khách / học sinh, trang lớp, thanh bên bài giảng — 1280 và 390, khung nhìn (không fullPage) cho từng đoạn.
// Chạy: SHOTS=<thư mục> npx tsx tools/local-e2e/shoot-hs-trang-chu.ts
import { BASE, mkUser, mkTutor, mkCourse, wipe } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll, type Page } from "./ui";

const OUT = process.env.SHOTS ?? ".";
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan Hương"), S = await mkUser({ name: "Minh Anh" });
  const C = await mkCourse(T.id, { name: "Toán 9 cây chương" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const ids: string[] = [];
  for (let s = 0; s < 2; s++) {
    const sec = await prisma.section.create({ data: { id: `sx${s}`, title: s ? "Hình học" : "Đại số", order: s + 1, courseId: C.id } });
    for (let c = 0; c < 3; c++) {
      const ch = await prisma.chapter.create({ data: { id: `cx${s}${c}`, title: `Chương ${s * 3 + c + 1}: ${["Hệ phương trình", "Hàm số bậc hai", "Phương trình bậc hai", "Đường thẳng và đường tròn", "Góc và cung", "Hình khối"][s * 3 + c]}`, order: c + 1, sectionId: sec.id } });
      for (let l = 0; l < 4; l++) { const id = `lx${s}${c}${l}`; ids.push(id); await prisma.lesson.create({ data: { id, code: id, title: `Bài ${ids.length}: nội dung bài học số ${ids.length}`, type: "record", order: l + 1, chapterId: ch.id, duration: "30 phút" } }); }
    }
  }
  for (const id of ids.slice(0, 3)) await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: id, watchedSeconds: 300, completed: true } });
  for (let i = 0; i < 5; i++) await prisma.thread.create({ data: { authorId: i % 2 ? T.id : S.id, content: `Mình mới học xong chương ${i + 1}, ai có mẹo làm nhanh phần này không ạ? Cảm ơn mọi người nhiều.`, kind: "post", category: "kinh-nghiem", status: "published", createdAt: new Date(Date.now() - i * 3_600_000) } });
  await prisma.admissionFormula.create({ data: { name: "Khối A00", school: "Trường thử", year: 2026, scale: 30, inputs: [{ key: "m1", label: "Toán", max: 10, weight: 2 }, { key: "m2", label: "Lý", max: 10, weight: 1 }, { key: "m3", label: "Hoá", max: 10, weight: 1 }], multiplier: 0.75, bonuses: [], sourceUrl: "https://example.edu.vn/tb", sourceName: "example.edu.vn", verified: false, published: true } });

  await launch();
  const snap = async (p: Page, name: string, y = 0) => { await p.evaluate(`window.scrollTo(0, ${y})`); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${name}.png` }); };
  for (const [who, u] of [["khach", null], ["hs", S]] as const) {
    for (const w of [1280, 390]) {
      const c = await ctxFor(u, { width: w, height: w === 390 ? 844 : 800 }); const p = await c.newPage();
      await p.addInitScript(`window.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "[data-agentation-root]{display:none!important}"; document.head.appendChild(s); });`);
      await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
      await p.locator('[data-home-block="community"][data-home-state="ok"]').waitFor({ timeout: 60000 });
      if (u) await p.locator('[data-home-block="my-class"][data-home-state="ok"]').waitFor({ timeout: 60000 });
      await snap(p, `v-home-${who}-${w}-a`, 0);
      await snap(p, `v-home-${who}-${w}-b`, w === 390 ? 700 : 600);
      await snap(p, `v-home-${who}-${w}-c`, w === 390 ? 1900 : 1300);
      await c.close();
    }
  }
  for (const w of [1280, 390]) {
    const c = await ctxFor(S, { width: w, height: w === 390 ? 844 : 800, rail: "mac-dinh" }); const p = await c.newPage();
    await p.addInitScript(`window.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "[data-agentation-root]{display:none!important}"; document.head.appendChild(s); });`);
    await p.goto(`${BASE}/student/hoc-tap?course=${C.id}`, { waitUntil: "networkidle", timeout: 240000 });
    await p.locator("[data-outline-chapter]").first().waitFor({ timeout: 60000 });
    await snap(p, `v-lop-${w}-a`, 0);
    await p.locator("[data-outline-search]").fill("duong thang");
    await snap(p, `v-lop-${w}-tim`, w === 390 ? 250 : 0);
    await p.locator("[data-outline-search]").fill("");
    await p.locator("[data-outline-open-all]").click();
    await snap(p, `v-lop-${w}-mo-het`, w === 390 ? 250 : 0);
    await p.goto(`${BASE}/student/bai-giang/lx003`, { waitUntil: "networkidle", timeout: 240000 });
    await p.locator("[data-outline-chapter]").first().waitFor({ state: "attached", timeout: 60000 }).catch(() => {});
    await snap(p, `v-bai-giang-${w}`, 0);
    if (w === 390) { await p.getByRole("button", { name: "Danh sách bài học" }).click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/v-bai-giang-390-sheet.png` }); }
    await c.close();
  }
  await Promise.race([closeAll(), new Promise(r => setTimeout(r, 15000))]);
  process.exit(0);
})().catch(async e => { console.error("CRASH", e); process.exit(1); });
