// NC2: lưới tuần Lịch dạy không bao giờ cắt chữ: nhiều buổi trùng giờ, tên lớp dài, buổi huỷ (1440/1280/1024 = lưới, 390 = thẻ).
import { mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, weekRangeOf, addDaysKey, dayOfWeekOfKey } from "@/lib/classSessions";

const MAIN = process.env.BASE ?? "http://localhost:3100";
const LONG = ["Văn 8 — thử lịch tuần (dữ liệu giả)", "Sinh 8 (thử NC2-010/011)", "Toán 9 (rà soát hằng tuần)", "Văn 8", "Toán 7"];

async function add(ownerId: string, name: string, dateKey: string, start: string, end: string, cancel = false) {
  const c = await mkCourse(ownerId, { name });
  const sch = await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: dayOfWeekOfKey(dateKey), startTime: start, endTime: end } });
  if (cancel) await prisma.classSessionChange.create({ data: { courseId: c.id, scheduleId: sch.id, dateKey, kind: "cancel", changedBy: ownerId } });
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const mon = weekRangeOf(vnDateKeyOf(new Date())).from;
  const wed = addDaysKey(mon, 2), fri = addDaysKey(mon, 4);
  for (let i = 0; i < 5; i++) await add(tutor.id, LONG[i], mon, "18:00", "19:00", i === 0); // 5 buổi cùng 18:00 -> chip
  for (let i = 0; i < 4; i++) await add(tutor.id, LONG[i], wed, "18:00", "19:00"); // 4 buổi cùng 18:00 -> hiện hết
  await add(tutor.id, "Văn 8 — thử lịch tuần (dữ liệu giả)", fri, "09:00", "10:00", true); // buổi 1 giờ, tên dài, đã huỷ
  await add(tutor.id, "Sinh 8 (thử NC2-010/011)", fri, "09:30", "10:30");
  await launch();

  const measure = (page: import("playwright").Page) => page.evaluate(() => {
    const bad: string[] = []; const rects: { n: string; r: DOMRect }[] = [];
    const blocks = [...document.querySelectorAll<HTMLElement>("[data-lich-block]")];
    for (const b of blocks) {
      const r = b.getBoundingClientRect(); const n = (b.getAttribute("aria-label") ?? "").slice(0, 30);
      if (b.scrollHeight > b.clientHeight + 1) bad.push(`${n}: cao ${b.scrollHeight}>${b.clientHeight}`);
      if (b.scrollWidth > b.clientWidth + 1) bad.push(`${n}: rộng ${b.scrollWidth}>${b.clientWidth}`);
      if (r.width < 110) bad.push(`${n}: bề rộng ${Math.round(r.width)}`);
      for (const c of b.children) { const cr = c.getBoundingClientRect(); if (cr.bottom > r.bottom + 1 || cr.right > r.right + 1) bad.push(`${n}: con tràn`); }
      if (!b.closest("[data-lich-popover]")) rects.push({ n, r });
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r, c = rects[j].r;
      if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) bad.push(`chồng: ${rects[i].n} / ${rects[j].n}`);
    }
    const sc = document.querySelector<HTMLElement>("[data-lich-scroll]");
    return { n: blocks.length, bad, minW: Math.round(Math.min(...rects.map(x => x.r.width), 9999)), minH: Math.round(Math.min(...rects.map(x => x.r.height), 9999)), scroll: sc ? `${sc.scrollWidth}/${sc.clientWidth}` : "-", pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });

  for (const w of [1440, 1280, 1024, 390]) {
    section(`${w}px`);
    const ctx = await ctxFor(tutor, { width: w, height: 1000 });
    const page = await ctx.newPage();
    await page.goto(`${MAIN}/lop-cua-toi/lich`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.getByRole("heading", { name: "Lịch dạy", exact: true }).waitFor({ timeout: 120000 });
    await page.waitForLoadState("networkidle");
    if (w >= 1024) {
      await page.locator("[data-lich-block]").first().waitFor({ timeout: 30000 });
      const m = await measure(page);
      console.log("  đo:", JSON.stringify(m));
      check(`${w}: không khối nào bị cắt/tràn/chồng`, m.bad.length === 0 && m.n >= 9, m.bad.slice(0, 5));
      check(`${w}: khối nhỏ nhất rộng >= 110px và cao >= 3 dòng`, m.minW >= 110 && m.minH >= 70, [m.minW, m.minH]);
      check(`${w}: trang không tràn ngang`, m.pageOverflow <= 0, m.pageOverflow);
      check(`${w}: 4 buổi trùng giờ hiện đủ, 5 buổi gộp chip '+2 buổi'`, (await page.locator("[data-lich-more]").count()) === 1 && (await page.locator("[data-lich-more]").innerText()).trim() === "+2 buổi");
      await page.locator("[data-lich-more]").click();
      const pm = await measure(page);
      check(`${w}: popover liệt kê đủ chữ, không cắt`, (await page.locator("[data-lich-popover] [data-lich-block]").count()) === 2 && pm.bad.length === 0, pm.bad.slice(0, 5));
      check(`${w}: buổi huỷ có chữ 'Đã huỷ'`, (await page.getByText("Đã huỷ", { exact: true }).count()) >= 1);
      await page.locator("[data-lich-more]").click();
    } else {
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cut: [...document.querySelectorAll<HTMLElement>("button[aria-controls^='chi-tiet-']")].filter(b => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1).length,
        n: document.querySelectorAll("button[aria-controls^='chi-tiet-']").length }));
      console.log("  đo:", JSON.stringify(m));
      check("390: danh sách thẻ, không tràn ngang, thẻ không bị cắt", m.over <= 0 && m.cut === 0 && m.n >= 9, m);
    }
    await shot(page, `lich-fit-${w}`);
    await ctx.close();
  }
  await done();
})();
