// Nhóm ĐO — 5 màn × 3 vai × 390/1280: không tràn ngang, không lỗi console, ảnh chụp; vùng bấm Hôm nay ≥ 44px; nút điểm danh ≥ 48px ở 390.
import { test, chay, ok, W, moTrang, khongTranNgang, bangBuoi } from "./lib.mjs";

const N = "Đo";
const VAI = { chu: "toan", gv_toan: "toan", gv_anh: "anh" };

for (const [vai, mon] of Object.entries(VAI)) {
  for (const kich of [W.dt, W.mt]) {
    test(N, `${vai} · 5 màn không tràn ngang, không lỗi console (${kich.width})`, async (t) => {
      const b = (await bangBuoi(await t.api("chu")))(mon, mon === "toan" ? "2026-11-24" : "2026-11-23");
      const man = {
        "hom-nay": "/quan-ly",
        "hoc-sinh": "/quan-ly/hoc-sinh",
        "buoi-hoc": "/quan-ly/buoi-hoc?thang=2026-11",
        "diem-danh": `/quan-ly/diem-danh/${b.id}`,
        "ma-tran": `/quan-ly/diem-danh/thang?mon=${mon}&thang=2026-11`,
      };
      const { page } = await t.trang(vai, kich);
      const loi = [];
      for (const [ten, u] of Object.entries(man)) {
        const r = await moTrang(page, u);
        if (r && r.status() >= 400) loi.push(`${u} HTTP ${r.status()}`);
        try { await khongTranNgang(page, u); } catch (e) { loi.push(e.message); }
        await t.chup(page, `${vai}-${ten}-${kich.width}`);
      }
      ok(!loi.length, loi.join("; "));
    });
  }
}

test(N, "Hôm nay (chủ, 390): mọi nút/liên kết trong nội dung cao ≥ 44px", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  await moTrang(page, "/quan-ly");
  const nho = await page.locator("main a, main button").evaluateAll((els) => els
    .filter((e) => e.offsetParent && !e.closest(".sr-only") && !e.classList.contains("sr-only"))
    .map((e) => ({ t: (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30), h: Math.round(e.getBoundingClientRect().height) }))
    .filter((x) => x.h < 44));
  ok(!nho.length, `${nho.length} phần tử bấm < 44px: ${nho.slice(0, 6).map((x) => `"${x.t}" ${x.h}px`).join(", ")}`);
});

test(N, "Điểm danh (chủ, 390): mọi nút Có/Phép/Vắng ≥ 48px, hàng không tràn", async (t) => {
  const b = (await bangBuoi(await t.api("chu")))("anh", "2026-11-26");
  const { page } = await t.trang("chu", W.dt);
  await moTrang(page, `/quan-ly/diem-danh/${b.id}`);
  const h = await page.locator('tbody [role="group"] button').evaluateAll((bs) => bs.map((x) => x.getBoundingClientRect()).map((r) => [Math.round(r.height), Math.round(r.right)]));
  ok(h.length > 0, "Không có nút điểm danh");
  const sai = h.filter(([hh, phai]) => hh < 48 || phai > 390);
  ok(!sai.length, `${sai.length}/${h.length} nút < 48px hoặc tràn phải: ${JSON.stringify(sai.slice(0, 3))}`);
});

await chay(N);
