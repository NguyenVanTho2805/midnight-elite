// SCL-G-0 (21/11/2026) — nền giao diện (docs/kin/thiet-ke/scl/QUYET-DINH-GIAO-DIEN.md §3.1–3.3, 3.6, phần I) trên trình duyệt thật:
// liên kết "Bỏ qua tới nội dung" ở vỏ học sinh / gia sư (Tab đầu tiên, Enter thì Tab kế vào nội dung chứ không vào thanh bên), ô nhập 16px trên điện thoại
// (14px trên máy tính), trang mẫu /kin-mau không tràn ngang ở 360 / 390px, thẻ trạng thái luôn có chữ + hình. Chụp ảnh vào scratchpad nếu có SHOTS_DIR.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import type { Page } from "playwright";

const SHOTS = process.env.SHOTS_DIR;
const snap = async (pg: Page, name: string) => { if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const overflowX = (pg: Page) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function skipLink(pg: Page, who: string) {
  await pg.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await pg.keyboard.press("Tab");
  const first = await pg.evaluate(() => { const a = document.activeElement as HTMLElement; return { text: a.innerText.trim(), skip: a.hasAttribute("data-kin-skip"), w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height }; });
  check(`${who}: Tab đầu tiên = "Bỏ qua tới nội dung", hiện ra khi có tiêu điểm, cao ≥ 44px`, first.skip && first.text === "Bỏ qua tới nội dung" && first.w > 40 && first.h >= 44, first);
  await pg.keyboard.press("Enter");
  check(`${who}: Enter đưa tiêu điểm tới đích nội dung đang HIỆN (không phải bản trang ẩn)`, await pg.evaluate(() => { const a = document.activeElement as HTMLElement; return a.hasAttribute("data-kin-noi-dung") && a.getClientRects().length > 0; }));
  await pg.keyboard.press("Tab");
  check(`${who}: Tab kế tiếp vào nội dung trang, không quay lại thanh bên / dải trên`, await pg.evaluate(() => { const a = document.activeElement!; return !a.closest("nav") && !a.closest("#kin-rail") && !!a.closest("main, [data-kin-noi-dung] ~ *"); }));
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan (thử)");
  const S = await mkUser({ name: "Minh Anh (thử)" });
  const A = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); };

  section("Vỏ học sinh 390 + 1280: liên kết bỏ qua");
  for (const width of [390, 1280]) {
    const pg = await (await ctxFor(S, { width, height: 820 })).newPage(); watch(pg);
    await pg.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle", timeout: 170000 });
    await skipLink(pg, `học sinh ${width}`);
    check(`học sinh ${width}: không tràn ngang`, await overflowX(pg) <= 0, await overflowX(pg));
  }

  section("Vỏ gia sư 1280: liên kết bỏ qua");
  {
    const pg = await (await ctxFor(T, { width: 1280, height: 820 })).newPage(); watch(pg);
    await pg.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "networkidle", timeout: 170000 });
    await skipLink(pg, "gia sư 1280");
  }

  section("Trang mẫu /kin-mau: ô 16px trên điện thoại, không tràn, trạng thái có chữ + hình");
  for (const width of [360, 390, 1280]) {
    const pg = await (await ctxFor(null, { width, height: 900 })).newPage(); watch(pg);
    await pg.goto(`${BASE}/kin-mau`, { waitUntil: "networkidle", timeout: 170000 });
    await pg.getByRole("heading", { name: "Bộ component KiN" }).waitFor({ timeout: 90000 });
    check(`${width}: không tràn ngang`, await overflowX(pg) <= 0, await overflowX(pg));
    const st = await pg.locator("[data-kin-status]").evaluateAll(els => els.map(e => ({ t: (e as HTMLElement).innerText.trim(), svg: !!e.querySelector("svg[data-kin-hinh][aria-hidden=true]") })));
    check(`${width}: mọi thẻ trạng thái có chữ VÀ hình (${st.length} thẻ)`, st.length >= 11 && st.every(s => s.t.length > 0 && s.svg), st.filter(s => !s.t || !s.svg));
    await snap(pg, `kin-mau-${width}`);
    await pg.locator('[data-mau="hop-chung"] button').click();
    const fs = await pg.locator('[data-mau="hop-o"]').evaluate(e => getComputedStyle(e).fontSize);
    check(`${width}: ô nhập (lớp 14px) ${width < 768 ? "lên 16px trên điện thoại" : "giữ 14px trên máy tính"}`, fs === (width < 768 ? "16px" : "14px"), fs);
    const box = await pg.getByRole("dialog").boundingBox();
    check(`${width}: hộp thoại nằm trọn trong màn`, !!box && box.x >= 0 && box.x + box.width <= width + 0.5, box);
    await snap(pg, `kin-mau-hop-${width}`);
    await pg.keyboard.press("Escape");
  }

  check("không lỗi JavaScript trên trang", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
