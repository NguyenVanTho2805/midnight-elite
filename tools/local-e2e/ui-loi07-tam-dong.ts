// LOI-07 (11/11/2026, nợ P3 của LOI-01) — trình duyệt thật. Chạy với máy chủ dev KHÔNG đặt NEXT_PUBLIC_KIN_MO_TIN_TUC (phần nào đang mở thì ca của phần đó tự bỏ qua).
//  C1. Gia sư và quản trị bị chuyển ra khỏi phần đang ẩn (bài tin tức cũ) → trang đầu theo vai (Hộp việc / /admin ở tên miền admin) có MỘT dòng nhắc
//      "Phần này đang tạm đóng." [data-paused-notice] (cùng component với học sinh / khách — ca của hai vai đó ở ui-loi-cong-dong-lop), không nói tên phần; 307 + no-store giữ nguyên.
//  C2. Màn sửa trang chủ (/admin/trang-chu): ô đường dẫn tự nhập trỏ vào phần đang tạm đóng ⇒ câu "Lưu ý: …" [data-field-warn] ngay dưới ô, nối aria-describedby,
//      KHÔNG viền đỏ / aria-invalid, nút Lưu vẫn bấm được và lưu thật (CSDL có đường đó); đổi sang đường đang mở ⇒ câu nhắc biến mất. 390: không tràn ngang.
// Ca phá cố ý (đã chạy, rồi hoàn lại): HomeEditor bỏ `warn={hiddenHrefWarning(...)}` ở nút CTA ⇒ ca "Lưu ý" đỏ; hostRouting bỏ `search: paused` ⇒ hai ca C1 đỏ.
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";
import { BASE, mkTutor, mkSuper, wipe, check, section, done, cookieFor } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN, type Page } from "./ui";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const SA = await mkSuper("Quản trị Hà");
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 300)}`); }); };

  if (featureOn("TIN_TUC")) console.log("  (máy đang bật TIN_TUC: bỏ qua phần C1)");
  else {
    section("C1 · gia sư: bài tin tức cũ → Hộp việc + dòng nhắc");
    {
      const r = await fetch(`${BASE}/tin-tuc/bai-cu`, { redirect: "manual", headers: { cookie: await cookieFor(T) } });
      const loc = new URL(r.headers.get("location") ?? "/", BASE);
      check("307 (không 308) + no-store, Location = /lop-cua-toi?tam-dong=TIN_TUC", r.status === 307 && /no-store/.test(r.headers.get("cache-control") ?? "") && loc.pathname === "/lop-cua-toi" && loc.search === "?tam-dong=TIN_TUC", [r.status, loc.href]);
      for (const w of [1280, 390]) {
        const c = await ctxFor(T, { width: w, height: 844 }); const p = await c.newPage(); watch(p);
        await p.goto(`${BASE}/tin-tuc/bai-cu`, { waitUntil: "domcontentloaded", timeout: 240000 });
        await p.waitForURL(u => u.pathname === "/lop-cua-toi", { timeout: 120000 });
        const note = p.locator('[data-paused-notice="TIN_TUC"]');
        await note.waitFor({ timeout: 60000 }).catch(() => {});
        const t = await note.innerText().catch(() => "");
        check(`${w}: gia sư thấy 'Phần này đang tạm đóng.' (không tên phần), nút 'Đã hiểu' ≥ 44px; không tràn ngang`, /Phần này đang tạm đóng\./.test(t) && !/Tin tức/i.test(t) && ((await note.getByRole("button", { name: "Đã hiểu" }).boundingBox())?.height ?? 0) >= 44 && await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean, t);
        if (w === 390) await shot(p, "loi07-tam-dong-gia-su-390");
        await note.getByRole("button", { name: "Đã hiểu" }).click();
        await p.waitForTimeout(400);
        check(`${w}: 'Đã hiểu' → dòng nhắc tắt, địa chỉ còn /lop-cua-toi không dấu`, (await p.locator("[data-paused-notice]").count()) === 0 && new URL(p.url()).pathname === "/lop-cua-toi" && !new URL(p.url()).search.includes("tam-dong"), p.url());
        await c.close();
      }
    }
    section("C1 · quản trị: bài tin tức cũ ở tên miền chính → /admin ở tên miền admin + dòng nhắc");
    {
      const c = await ctxFor(SA, { width: 1600, height: 1000, rail: "mac-dinh" }); const p = await c.newPage(); watch(p);
      await p.goto(`${BASE}/tin-tuc/bai-cu`, { waitUntil: "domcontentloaded", timeout: 240000 }).catch(() => {});
      await p.waitForURL(u => u.hostname.startsWith("admin.") && u.pathname === "/admin", { timeout: 120000 }).catch(() => {});
      const note = p.locator('[data-paused-notice="TIN_TUC"]');
      await note.waitFor({ timeout: 60000 }).catch(() => {});
      check("quản trị ở admin…/admin, thấy 'Phần này đang tạm đóng.'", new URL(p.url()).hostname.startsWith("admin.") && new URL(p.url()).pathname === "/admin" && await note.isVisible(), p.url());
      await c.close();
    }
  }

  section("C2 · /admin/trang-chu: liên kết tự nhập trỏ vào phần đang tạm đóng ⇒ cảnh báo, KHÔNG chặn lưu");
  const HIDDEN = featureOn("TIN_TUC") ? (featureOn("CONG_DONG") ? null : "/cong-dong") : "/tin-tuc";
  if (!HIDDEN) console.log("  (máy đang bật cả TIN_TUC lẫn CONG_DONG: bỏ qua phần C2)");
  for (const w of HIDDEN ? [1600, 390] : []) {
    const c = await ctxFor(SA, { width: w, height: 1000, rail: "mac-dinh" }); const p = await c.newPage(); watch(p);
    await p.goto(`${ADMIN}/admin/trang-chu`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.locator("[data-home-state=ready]").waitFor({ timeout: 120000 });
    if (w === 390) { const tab = p.getByRole("tab", { name: "Sửa" }); if (await tab.count()) await tab.click(); }
    const f = p.locator("#f-cta-secondary-href");
    await f.scrollIntoViewIfNeeded();
    await f.fill(HIDDEN!);
    const warn = p.locator('[data-field-warn="cta.secondary.href"]');
    await warn.waitFor({ timeout: 15000 }).catch(() => {});
    const wt = await warn.innerText().catch(() => "");
    check(`${w}: gõ '${HIDDEN}' ⇒ 'Lưu ý: … tạm đóng … Vẫn lưu được' ngay dưới ô, nối aria-describedby; ô KHÔNG aria-invalid, không có lỗi chặn`,
      /^Lưu ý:/.test(wt.trim()) && /tạm đóng/.test(wt) && /Vẫn lưu được/.test(wt) && ((await f.getAttribute("aria-describedby")) ?? "").includes("f-cta-secondary-href-canh-bao") && (await f.getAttribute("aria-invalid")) === null && (await p.locator('[data-field-error="cta.secondary.href"]').count()) === 0, wt);
    if (w === 390) {
      check("390: không tràn ngang khi có câu nhắc", await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
      await shot(p, "loi07-trang-chu-canh-bao-390");
    } else {
      const save = p.locator("[data-save]");
      check("1600: nút Lưu vẫn bấm được", await save.isEnabled());
      await save.click();
      await p.getByText("Trang chủ cập nhật trong vài giây.").waitFor({ timeout: 30000 }).catch(() => {});
      const row = await prisma.siteContent.findUnique({ where: { key: "home" } });
      check(`1600: lưu được thật — CSDL cta.secondary.href = '${HIDDEN}' (cảnh báo không chặn)`, (row?.data as { cta?: { secondary?: { href?: string } } } | null)?.cta?.secondary?.href === HIDDEN, (row?.data as any)?.cta);
      await f.fill("/khoa-hoc");
      await p.waitForTimeout(300);
      check("1600: đổi sang '/khoa-hoc' (đang mở) ⇒ câu nhắc biến mất", (await warn.count()) === 0);
    }
    await c.close();
  }

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
