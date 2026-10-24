// Menu tài khoản ở dải trên của vỏ (14/10/2026): hồ sơ / cài đặt / đăng xuất, dùng được cả khi đã THU thanh bên. Trình duyệt thật.
import { BASE, mkTutor, mkUser, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";

(async () => {
  await wipe();
  const S = await mkUser({ name: "Minh Anh" });
  const T = await mkTutor("Cô Lan");

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(m.text()); }); };
  const btn = (p: any, name: string) => p.getByRole("button", { name: `Tài khoản của ${name}` });
  const menu = (p: any) => p.getByRole("menu", { name: "Tài khoản" });
  const active = (p: any) => p.evaluate(`document.activeElement?.textContent?.trim() ?? ""`) as Promise<string>;

  // ───────────────────────────── Học viên
  const ctx = await ctxFor(S, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await btn(pg, "Minh Anh").waitFor({ timeout: 90000 });

  section("Học viên: nút avatar ở dải trên");
  const b = btn(pg, "Minh Anh");
  check("nút có aria-haspopup=menu, aria-expanded=false, cao ≥44px", await b.getAttribute("aria-haspopup") === "menu" && await b.getAttribute("aria-expanded") === "false" && ((await b.boundingBox())?.height ?? 0) >= 44);
  check("hiện chữ cái đầu 'M' và tên 'Minh Anh' (máy tính)", (await b.innerText()).includes("M") && (await b.innerText()).includes("Minh Anh"));
  check("menu chưa mở", await menu(pg).count() === 0);

  section("Mở menu, bàn phím, đóng");
  await b.click();
  await menu(pg).waitFor({ timeout: 10000 });
  check("mở: aria-expanded=true, có đúng 4 mục: Hồ sơ, Học phí, Chủ đề màu, Đăng xuất", await b.getAttribute("aria-expanded") === "true" && (await menu(pg).getByRole("menuitem").allInnerTexts()).join("|") === "Hồ sơ|Học phí|Chủ đề màu|Đăng xuất");
  check("đầu menu hiện tên + email", await menu(pg).getByText("Minh Anh").isVisible() && await menu(pg).getByText(S.email).isVisible());
  check("tiêu điểm vào mục đầu 'Hồ sơ'", (await active(pg)) === "Hồ sơ");
  await pg.keyboard.press("ArrowDown");
  check("↓ → 'Học phí'", (await active(pg)) === "Học phí");
  await pg.keyboard.press("End");
  check("End → 'Đăng xuất'", (await active(pg)) === "Đăng xuất");
  await pg.keyboard.press("ArrowDown");
  check("↓ ở mục cuối → quay vòng về 'Hồ sơ'", (await active(pg)) === "Hồ sơ");
  await pg.keyboard.press("ArrowUp");
  check("↑ ở mục đầu → quay vòng về 'Đăng xuất'", (await active(pg)) === "Đăng xuất");
  await pg.keyboard.press("Home");
  check("Home → 'Hồ sơ'", (await active(pg)) === "Hồ sơ");
  const heights = await menu(pg).getByRole("menuitem").evaluateAll((els: any[]) => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("mọi mục cao ≥44px (chạm được)", heights.every((h: number) => h >= 44), heights);
  const roving = await menu(pg).getByRole("menuitem").evaluateAll((els: any[]) => els.map(e => e.tabIndex).join(","));
  check("các mục không nằm trong thứ tự Tab (tiêu điểm chỉ di chuyển bằng mũi tên)", roving === "-1,-1,-1,-1", roving);
  await shot(pg, "account-menu-1-open");
  await pg.keyboard.press("Escape");
  await eventually("Esc → đóng và trả tiêu điểm về nút avatar", async () => (await menu(pg).count()) === 0 && await pg.evaluate(`document.activeElement?.hasAttribute("data-account-menu") ?? false`));
  await b.click(); await menu(pg).waitFor({ timeout: 10000 });
  await pg.mouse.click(640, 500);
  await eventually("bấm ra ngoài → đóng", async () => (await menu(pg).count()) === 0);
  await b.click(); await menu(pg).waitFor({ timeout: 10000 });
  // Chờ tiêu điểm vào mục đầu (rAF) rồi mới bấm Tab: máy dev chậm sau khi đổi vỏ làm Tab đến trước khi tiêu điểm vào menu.
  await eventually("tiêu điểm đã vào menu", async () => (await active(pg)) === "Hồ sơ");
  await pg.keyboard.press("Tab");
  await eventually("Tab → đóng (không giữ tiêu điểm trong menu)", async () => (await menu(pg).count()) === 0);

  section("Chọn mục → đi đúng trang, menu đóng");
  await b.click(); await menu(pg).getByRole("menuitem", { name: "Hồ sơ" }).click();
  await pg.waitForURL(/\/student\/ho-so/, { timeout: 90000 });
  check("'Hồ sơ' → /student/ho-so, menu đã đóng", /\/student\/ho-so/.test(pg.url()) && (await menu(pg).count()) === 0, pg.url());

  section("Vẫn dùng được khi đã THU thanh bên");
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("button", { name: "Thu gọn thanh bên" }).click();
  await eventually("thanh bên đã thu", async () => (await pg.evaluate(`document.documentElement.getAttribute("data-kin-rail")`)) === "thu");
  await btn(pg, "Minh Anh").click();
  await menu(pg).getByRole("menuitem", { name: "Học phí" }).click();
  await pg.waitForURL(/\/student\/hoc-phi/, { timeout: 90000 });
  check("thanh bên đang thu mà vẫn vào được 'Học phí' qua menu tài khoản", /\/student\/hoc-phi/.test(pg.url()) && (await pg.evaluate(`document.documentElement.getAttribute("data-kin-rail")`)) === "thu");
  await pg.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await btn(pg, "Minh Anh").waitFor({ timeout: 60000 });
  check("menu cũng có ở trang khách (/thu-vien) khi nằm trong vỏ", await btn(pg, "Minh Anh").isVisible());
  await pg.evaluate(`localStorage.removeItem("kin.thanh-ben")`);
  await pg.getByRole("button", { name: /^Mở thanh bên/ }).click().catch(() => {});

  section("Đăng xuất");
  await btn(pg, "Minh Anh").click();
  await menu(pg).getByRole("menuitem", { name: "Đăng xuất" }).click();
  await eventually("đăng xuất → về trang chủ của khách (Navbar khách), phiên đã mất", async () => new URL(pg.url()).pathname === "/" && await pg.getByRole("navigation", { name: "Điều hướng chính" }).isVisible());
  check("/api/auth/me không còn trả người dùng", !((await pg.evaluate(async () => (await fetch("/api/auth/me")).json())) as any)?.id);
  await ctx.close();

  // ───────────────────────────── Gia sư
  section("Gia sư");
  const ctxT = await ctxFor(T, { width: 1280, height: 800 });
  const pt = await ctxT.newPage(); watch(pt);
  await pt.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await btn(pt, "Cô Lan").waitFor({ timeout: 90000 });
  await btn(pt, "Cô Lan").click();
  check("menu gia sư: Cài đặt, Hồ sơ gia sư, Đăng xuất", (await menu(pt).getByRole("menuitem").allInnerTexts()).join("|") === "Cài đặt|Hồ sơ gia sư|Đăng xuất");
  await menu(pt).getByRole("menuitem", { name: "Cài đặt" }).click();
  await pt.waitForURL(/\/lop-cua-toi\/cai-dat/, { timeout: 90000 });
  check("'Cài đặt' → /lop-cua-toi/cai-dat", /\/lop-cua-toi\/cai-dat/.test(pt.url()));
  await ctxT.close();

  // ───────────────────────────── Điện thoại
  section("Điện thoại 390px");
  const ctxM = await ctxFor(S, { width: 390, height: 844 });
  const pm = await ctxM.newPage(); watch(pm);
  await pm.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await btn(pm, "Minh Anh").waitFor({ timeout: 90000 });
  const bb = await btn(pm, "Minh Anh").boundingBox();
  check("nút avatar cao ≥44px, rộng ≥44px, nằm gọn trong màn hình", !!bb && bb.height >= 44 && bb.width >= 44 && bb.x + bb.width <= 390, bb);
  // Figma 299:116497: nút tài khoản là TÊN + mũi tên (không còn vòng chữ cái đầu); tên cắt bớt (truncate) nên không tràn.
  check("trên điện thoại nút hiện tên + mũi tên, không còn vòng chữ cái đầu", (await btn(pm, "Minh Anh").innerText()).includes("Minh Anh") && (await btn(pm, "Minh Anh").locator("svg").count()) === 1);
  check("dải trên không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await btn(pm, "Minh Anh").click();
  await menu(pm).waitFor({ timeout: 10000 });
  const mb = await menu(pm).boundingBox();
  check("menu nằm gọn trong màn hình 390px", !!mb && mb.x >= 0 && mb.x + mb.width <= 390, mb);
  await shot(pm, "account-menu-2-mobile");
  await ctxM.close();

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
