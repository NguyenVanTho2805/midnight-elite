// Chủ đề màu + chế độ sáng/tối thật sự có tác dụng (15/10/2026). Trình duyệt thật.
// Thọ báo: "phần chủ đề màu hiện chọn các chủ đề và chế độ sáng tối chưa hoạt động". Hai nguyên nhân gốc đã sửa:
//   1. Khung học viên + quản trị bị khoá chế độ SÁNG (data-vung="sang") → chọn "Tối" không đổi gì;
//   2. thẻ xem trước đọc màu của chủ đề ĐANG BẬT nên Navy / Cổ vịt / Mận cùng một màu; nhiều chỗ dùng màu Navy cố định
//      (--kin-th-navy) nên đổi chủ đề chỉ đổi được một phần giao diện.
// Test này kiểm: xem trước đúng màu từng chủ đề, chọn chủ đề/chế độ đổi thật (màu nhấn, nền, chữ), lưu theo tài khoản,
// tối ở học viên / gia sư / quản trị không có chữ khó đọc hay mảng nền trắng, khách chưa đăng nhập vẫn sáng như thiết kế.
import { readFileSync } from "node:fs";
import { BASE, mkUser, mkTutor, mkSuper, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import type { Page } from "./ui";

const THEMES = ["navy", "co-vit", "man", "ca-phe", "muc"] as const;
const LABEL: Record<(typeof THEMES)[number], string> = { "navy": "Navy", "co-vit": "Cổ vịt", "man": "Mận", "ca-phe": "Cà phê", "muc": "Mực" };

// Đo trong trình duyệt: chữ có độ tương phản < 3:1 với nền thật phía sau + mảng nền gần trắng (> 4000px²) trong chế độ tối.
// (Chuỗi, không phải hàm: tsx chèn __name vào hàm truyền cho page.evaluate làm vỡ.)
const AUDIT = `(() => {
  const parse = s => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const bgOf = el => {
    const st = []; let img = false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== "none") { img = true; break; }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { st.push(c); if (c.a >= 1) break; }
    }
    let base = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (base.a < 1) base = over(base, { r: 255, g: 255, b: 255, a: 1 });
    for (let i = st.length - 1; i >= 0; i--) base = over(st[i], base);
    return { c: base, img };
  };
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false; } return true; };
  const low = [], light = [], seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode; const txt = (t.textContent || "").trim(); if (!txt || !/[\\p{L}\\p{N}]/u.test(txt)) continue;
    const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (el.closest("script,style,noscript,svg") || !vis(el)) continue;
    const cs = getComputedStyle(el); const bg = bgOf(el); if (bg.img) continue;
    let fg = parse(cs.color); if (!fg) continue; fg = over(fg, bg.c);
    const L1 = lum(fg), L2 = lum(bg.c); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 3) low.push({ t: txt.slice(0, 40), cls: String(el.className).slice(0, 50), ratio: Math.round(ratio * 100) / 100 });
  }
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect(); if (r.width * r.height < 4000 || !vis(el)) continue;
    if (el.closest("svg,img,video,canvas,iframe,[data-vung=phong-thi]")) continue;
    const cs = getComputedStyle(el); const c = parse(cs.backgroundColor);
    if (c && c.a > 0.9 && lum(c) > 0.55 && !(cs.backgroundImage && cs.backgroundImage !== "none")) light.push({ cls: String(el.className).slice(0, 60), bg: cs.backgroundColor });
  }
  return { low, light };
})()`;

type Audit = { low: { t: string; cls: string; ratio: number }[]; light: { cls: string; bg: string }[] };
const audit = (p: Page) => p.evaluate(AUDIT) as Promise<Audit>;
const rootVar = (p: Page, name: string) => p.evaluate(`getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(name)}).trim()`) as Promise<string>;
const attr = (p: Page, name: string) => p.evaluate(`document.documentElement.getAttribute(${JSON.stringify(name)})`) as Promise<string | null>;
const bodyBg = (p: Page) => p.evaluate(`getComputedStyle(document.body).backgroundColor`) as Promise<string>;
const cssColor = (p: Page, sel: string) => p.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? getComputedStyle(e).color : null; })()`) as Promise<string | null>;
const luminanceOf = (rgb: string) => { const m = rgb.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0]; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };

(async () => {
  await wipe();
  const S = await mkUser({ name: "Minh Anh" });
  const T = await mkTutor("Cô Lan");
  const A = await mkSuper("Admin TSIX");
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); };
  const noFonts = async (c: Awaited<ReturnType<typeof ctxFor>>) => { await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); };

  // ───────────────────────────── Nguồn: không còn khoá sáng ở khung đăng nhập, không còn Navy cố định ngoài chỗ được phép
  section("Mã nguồn: khung học viên / quản trị không khoá sáng; Navy cố định chỉ còn ở phòng thi, logo, định nghĩa token");
  const read = (p: string) => readFileSync(p, "utf8");
  check("(student)/layout.tsx không còn data-vung=\"sang\"", !read("src/app/(student)/layout.tsx").includes('data-vung="sang"'));
  check("(admin)/layout.tsx không còn data-vung=\"sang\"", !read("src/app/(admin)/layout.tsx").includes('data-vung="sang"'));
  const site = read("src/app/kin-site.css");
  check("khoá sáng của khách chỉ có tác dụng khi chưa đăng nhập (:not([data-kin-vo]))", /:root:not\(\[data-kin-vo\]\) \[data-vung="sang"\] \{/.test(site) && !/^\[data-vung="sang"\] \{/m.test(site));
  check("color-scheme theo chế độ (ô chọn / thanh cuộn gốc của trình duyệt cũng tối)", site.includes(':root[data-che-do="toi"] { color-scheme: dark; }'));

  // ───────────────────────────── Trang Chủ đề màu: xem trước, chọn, lưu
  section("Trang Chủ đề màu: mỗi thẻ xem trước hiện ĐÚNG màu của chủ đề đó");
  const ctx = await ctxFor(S, { width: 1280, height: 800 }); await noFonts(ctx);
  const p = await ctx.newPage(); watch(p);
  await p.goto(`${BASE}/cai-dat/chu-de`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Chủ đề giao diện" }).waitFor({ timeout: 90000 });
  // 23/10/2026 (đợt dựng nền): Figma là nền sáng, nên mặc định là Sáng (không còn "Theo máy"); "Theo máy" vẫn chọn được ở dưới.
  check("mặc định: Navy + Sáng đang được chọn", (await p.getByRole("button", { name: /Navy/ }).getAttribute("aria-pressed")) === "true" && (await p.getByRole("button", { name: "Sáng", exact: true }).getAttribute("aria-pressed")) === "true" && (await p.getByRole("button", { name: "Theo máy" }).getAttribute("aria-pressed")) === "false");
  check("có đủ 5 thẻ chủ đề và 3 nút chế độ", (await p.locator("[data-chu-de-xem]").count()) === 5 && (await p.getByRole("button", { name: /^(Theo máy|Sáng|Tối)$/ }).count()) === 3);

  const swatch = async (t: string) => p.evaluate(`getComputedStyle(document.querySelector('[data-chu-de-xem="${t}"] > div')).backgroundColor`) as Promise<string>;
  const want: Record<string, string> = {};
  for (const t of THEMES) {
    await p.evaluate(`document.documentElement.setAttribute("data-chu-de", ${JSON.stringify(t)})`); // chỉ để ĐỌC màu gốc của chủ đề t
    want[t] = (await p.evaluate(`(() => { const d = document.createElement("div"); d.style.background = getComputedStyle(document.documentElement).getPropertyValue("--kin-nhan-nen"); document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })()`)) as string;
  }
  await p.evaluate(`document.documentElement.setAttribute("data-chu-de", "navy")`);
  const got: Record<string, string> = {};
  for (const t of THEMES) got[t] = await swatch(t);
  check("màu ô xem trước của từng thẻ = màu nhấn của chính chủ đề đó (--kin-nhan-nen)", THEMES.every(t => got[t] === want[t]), { got, want });
  check("5 ô xem trước có 5 màu KHÁC NHAU (lỗi cũ: Navy / Cổ vịt / Mận cùng một màu)", new Set(Object.values(got)).size === 5, got);
  await shot(p, "theme-xem-truoc-sang");

  section("Chọn chủ đề: màu nhấn của cả khung đổi theo (không chỉ vài chỗ)");
  const accentOf = async () => ({ nhan: await rootVar(p, "--kin-nhan-nen"), diem: await rootVar(p, "--kin-nhan-diem"), wordmark: await cssColor(p, ".kin-chu-logo"), railOn: await cssColor(p, '#kin-rail [aria-current="page"]') });
  const seenAccent = new Map<string, Awaited<ReturnType<typeof accentOf>>>();
  for (const t of THEMES) {
    await p.getByRole("button", { name: new RegExp(LABEL[t]) }).click();
    await eventually(`chọn ${LABEL[t]}: <html data-chu-de="${t}">, nút aria-pressed, lưu máy`, async () =>
      (await attr(p, "data-chu-de")) === t && (await p.getByRole("button", { name: new RegExp(LABEL[t]) }).getAttribute("aria-pressed")) === "true" &&
      (await p.evaluate(`localStorage.getItem("kin.chu-de")`)) === t);
    seenAccent.set(t, await accentOf());
  }
  const wordmarks = THEMES.map(t => seenAccent.get(t)!.wordmark);
  check("chữ KiN cạnh logo đổi màu theo chủ đề (5 chủ đề → 5 màu)", new Set(wordmarks).size === 5, wordmarks);
  const rails = THEMES.map(t => seenAccent.get(t)!.railOn);
  check("mục đang chọn trên thanh bên đổi màu theo chủ đề (không còn Navy cố định)", rails.every(Boolean) && new Set(rails).size === 5, rails);
  check("--kin-nhan-diem (chữ / viền nhấn) khác nhau theo chủ đề", new Set(THEMES.map(t => seenAccent.get(t)!.diem)).size === 5);
  await eventually("lưu lên TÀI KHOẢN: preferences.theme = muc", async () => {
    const r = await p.evaluate(`fetch("/api/users/me/preferences").then(r => r.json())`) as { preferences?: { theme?: string } };
    return r.preferences?.theme === "muc";
  });

  section("Chế độ Tối: nền, chữ, thanh bên, thẻ đều tối; Sáng thì trắng; Theo máy theo cài đặt máy");
  await p.getByRole("button", { name: LABEL.navy }).first().click();
  await p.getByRole("button", { name: "Sáng", exact: true }).click();
  await eventually("Sáng: <html data-che-do=\"sang\">", async () => (await attr(p, "data-che-do")) === "sang");
  check("Sáng: nền trang trắng, chữ đậm", luminanceOf(await bodyBg(p)) > 0.95 && luminanceOf((await cssColor(p, "h1")) ?? "rgb(255,255,255)") < 0.2);
  await p.getByRole("button", { name: "Tối", exact: true }).click();
  await eventually("Tối: <html data-che-do=\"toi\"> + lưu máy + aria-pressed", async () =>
    (await attr(p, "data-che-do")) === "toi" && (await p.getByRole("button", { name: "Tối", exact: true }).getAttribute("aria-pressed")) === "true" && (await p.evaluate(`localStorage.getItem("kin.che-do")`)) === "toi");
  check("Tối: nền trang tối (body), chữ tiêu đề sáng", luminanceOf(await bodyBg(p)) < 0.1 && luminanceOf((await cssColor(p, "h1")) ?? "rgb(0,0,0)") > 0.8);
  const surfaces = await p.evaluate(`(() => { const bg = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; }; return { wrap: bg("h1")?.length ? getComputedStyle(document.querySelector("h1").closest("[style*=min-height]") ?? document.body).backgroundColor : null, rail: bg("#kin-rail"), top: bg("header") }; })()`) as { wrap: string | null; rail: string | null; top: string | null };
  check("Tối: khung nội dung và thanh bên không còn trắng", [surfaces.wrap, surfaces.rail].every(c => !c || luminanceOf(c) < 0.25), surfaces);
  const sel = await p.evaluate(`getComputedStyle(document.documentElement).colorScheme`) as string;
  check("Tối: color-scheme = dark (điều khiển gốc của trình duyệt tối theo)", sel.includes("dark"), sel);
  await shot(p, "theme-toi-chu-de");
  await p.getByRole("button", { name: "Theo máy" }).click();
  await eventually("Theo máy: bỏ data-che-do", async () => (await attr(p, "data-che-do")) === null);
  await p.emulateMedia({ colorScheme: "dark" });
  check("Theo máy + máy đang tối → nền tối", luminanceOf(await bodyBg(p)) < 0.1);
  await p.emulateMedia({ colorScheme: "light" });
  check("Theo máy + máy đang sáng → nền sáng", luminanceOf(await bodyBg(p)) > 0.95);

  section("Lưu theo TÀI KHOẢN: xoá dữ liệu máy rồi tải lại vẫn ra đúng chủ đề + chế độ đã chọn");
  await p.getByRole("button", { name: LABEL["co-vit"] }).click();
  await p.getByRole("button", { name: "Tối", exact: true }).click();
  await eventually("tài khoản đã nhận co-vit + toi", async () => {
    const r = await p.evaluate(`fetch("/api/users/me/preferences").then(r => r.json())`) as { preferences?: { theme?: string; mode?: string } };
    return r.preferences?.theme === "co-vit" && r.preferences?.mode === "toi";
  });
  await p.evaluate(`localStorage.clear()`);
  await p.reload({ waitUntil: "networkidle" });
  await eventually("tải lại (máy trống): kéo từ tài khoản về → co-vit + toi", async () => (await attr(p, "data-chu-de")) === "co-vit" && (await attr(p, "data-che-do")) === "toi");
  check("nút trên trang cập nhật theo tài khoản (Cổ vịt + Tối đang chọn)", (await p.getByRole("button", { name: /Cổ vịt/ }).getAttribute("aria-pressed")) === "true" && (await p.getByRole("button", { name: "Tối", exact: true }).getAttribute("aria-pressed")) === "true");

  // ───────────────────────────── Tối ở từng khu: không chữ khó đọc, không mảng nền trắng
  section("Học viên, chế độ Tối × 5 chủ đề: không chữ khó đọc, không mảng nền trắng");
  const studentPaths = ["/student/viec-cua-toi", "/student/lich-hoc", "/student/vi", "/student/hoc-phi", "/student/ho-so", "/cai-dat/chu-de"];
  for (const t of THEMES) {
    const c = await ctxFor(S, { width: 1280, height: 800 }); await noFonts(c);
    await c.addInitScript(`try { localStorage.setItem("kin.chu-de", ${JSON.stringify(t)}); localStorage.setItem("kin.che-do", "toi"); } catch (e) {}`);
    const bad: unknown[] = [];
    for (const path of studentPaths.slice(0, t === "navy" ? studentPaths.length : 2)) {
      const pg = await c.newPage(); watch(pg);
      await pg.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
      await pg.locator("#kin-rail").waitFor({ timeout: 90000 });
      await pg.waitForTimeout(1500);
      const r = await audit(pg);
      if (r.low.length || r.light.length) bad.push({ path, low: r.low.slice(0, 3), light: r.light.slice(0, 3) });
      if (t === "navy" && path === "/student/viec-cua-toi") await shot(pg, "theme-toi-hoc-vien");
      await pg.close();
    }
    check(`${LABEL[t]} · Tối: ${t === "navy" ? studentPaths.length : 2} trang học viên sạch`, bad.length === 0, bad);
    await c.close();
  }

  section("Gia sư, chế độ Tối");
  const ct = await ctxFor(T, { width: 1280, height: 800 }); await noFonts(ct);
  await ct.addInitScript(`try { localStorage.setItem("kin.chu-de", "man"); localStorage.setItem("kin.che-do", "toi"); } catch (e) {}`);
  const badT: unknown[] = [];
  for (const path of ["/lop-cua-toi/lich", "/lop-cua-toi/lop", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/doanh-thu", "/lop-cua-toi/bai-dang", "/lop-cua-toi/cai-dat", "/lop-cua-toi/ho-so"]) {
    const pg = await ct.newPage(); watch(pg);
    await pg.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
    await pg.locator("#kin-rail").waitFor({ timeout: 90000 });
    await pg.waitForTimeout(1500);
    const r = await audit(pg);
    if (r.low.length || r.light.length) badT.push({ path, low: r.low.slice(0, 3), light: r.light.slice(0, 3) });
    if (path === "/lop-cua-toi/lich") await shot(pg, "theme-toi-gia-su");
    await pg.close();
  }
  check("7 trang gia sư (Mận · Tối) sạch: không chữ khó đọc, không mảng nền trắng", badT.length === 0, badT);
  await ct.close();

  section("Quản trị, chế độ Tối (trước đây khung quản trị bị khoá sáng)");
  const ca = await ctxFor(A, { width: 1280, height: 800 }); await noFonts(ca);
  await ca.addInitScript(`try { localStorage.setItem("kin.chu-de", "ca-phe"); localStorage.setItem("kin.che-do", "toi"); } catch (e) {}`);
  const badA: unknown[] = [];
  for (const path of ["/admin", "/admin/kiem-duyet", "/admin/khoa-hoc", "/admin/hoc-sinh", "/admin/thi-thu", "/admin/tin-tuc", "/admin/cong-dong", "/admin/quan-tri-vien", "/admin/doanh-thu"]) {
    const pg = await ca.newPage(); watch(pg);
    await pg.goto(`${ADMIN}${path}`, { waitUntil: "load", timeout: 120000 });
    await pg.locator("#kin-rail").waitFor({ timeout: 90000 }).catch(() => {});
    await pg.waitForTimeout(2000);
    const r = await audit(pg);
    // dấu "|" ngăn cách trong thanh đường dẫn là trang trí, không tính
    const low = r.low.filter(x => x.t !== "|");
    if (low.length || r.light.length) badA.push({ path, low: low.slice(0, 3), light: r.light.slice(0, 3) });
    if (path === "/admin/khoa-hoc") await shot(pg, "theme-toi-quan-tri");
    await pg.close();
  }
  check("9 trang quản trị (Cà phê · Tối) sạch: không chữ khó đọc, không mảng nền trắng", badA.length === 0, badA);
  await ca.close();

  section("Sáng / Tối / Theo máy đúng ở MỌI vai + không nháy nền sáng khi đã chọn Tối (23/10/2026)");
  // Vai × trang: học viên /student/hoc-tap, gia sư /lop-cua-toi, quản trị /admin. Mỗi vai thử 4 tổ hợp lựa chọn đã lưu × cài đặt máy.
  // Dùng tài khoản MỚI: S/T/A ở trên đã lưu chủ đề lên tài khoản (mục trước), AccountThemeSync sẽ kéo về và đè lựa chọn của máy.
  const S2 = await mkUser({ name: "Học viên thử chế độ" }), T2 = await mkTutor("Cô Thử Chế Độ"), A2 = await mkSuper("Quản trị thử chế độ");
  const roles: [string, any, string, string][] = [
    ["học viên", S2, "/student/hoc-tap", BASE],
    ["gia sư", T2, "/lop-cua-toi", BASE],
    ["quản trị", A2, "/admin", ADMIN],
  ];
  const cases: [string, string, "dark" | "light", "dark" | "light"][] = [
    // [mode lưu, nhãn, máy, nền mong đợi]
    ["sang", "Sáng", "dark", "light"],
    ["toi", "Tối", "light", "dark"],
    ["auto", "Theo máy (máy tối)", "dark", "dark"],
    ["auto", "Theo máy (máy sáng)", "light", "light"],
  ];
  for (const [role, who, path, base] of roles) {
    for (const [mode, label, machine, want] of cases) {
      const c = await ctxFor(who, { width: 1280, height: 800 }); await noFonts(c);
      await c.addInitScript(`try { localStorage.setItem("kin.che-do", ${JSON.stringify(mode)}); } catch (e) {}`);
      const pg = await c.newPage(); watch(pg);
      await pg.emulateMedia({ colorScheme: machine });
      await pg.goto(`${base}${path}`, { waitUntil: "load", timeout: 240000 });
      await pg.waitForTimeout(1500);
      const lum = luminanceOf(await bodyBg(pg));
      check(`${role} ${path}: ${label} → nền ${want === "dark" ? "tối" : "sáng"}`, want === "dark" ? lum < 0.1 : lum > 0.95, lum);
      await pg.close(); await c.close();
    }
  }
  // Chống nháy: chặn mã JS của trang (không hydrate được, ThemeApplier không chạy) — chỉ còn tập lệnh chèn sẵn trong HTML. Đã chọn Tối / Theo máy (tối)
  // mà khung hình đầu vẫn sáng = nháy. Phải tối ngay từ HTML.
  for (const [mode, label] of [["toi", "Tối"], ["auto", "Theo máy (máy tối)"]] as const) {
    const c = await ctxFor(S2, { width: 1280, height: 800 }); await noFonts(c);
    await c.route(/\/_next\/static\/.*\.js/, r => r.abort());
    await c.addInitScript(`try { localStorage.setItem("kin.che-do", ${JSON.stringify(mode)}); } catch (e) {}`);
    const pg = await c.newPage();
    await pg.emulateMedia({ colorScheme: "dark" });
    await pg.goto(`${BASE}/student/hoc-tap`, { waitUntil: "domcontentloaded", timeout: 240000 });
    const early = await pg.evaluate(`document.documentElement.getAttribute("data-che-do")`) as string | null;
    check(`chống nháy: đã chọn ${label}, chưa chạy mã trang vẫn ${mode === "toi" ? 'data-che-do="toi"' : "không còn data-che-do"} + nền tối`,
      (mode === "toi" ? early === "toi" : early === null) && luminanceOf(await bodyBg(pg)) < 0.1, { early, bg: await bodyBg(pg) });
    await pg.close(); await c.close();
  }
  { // người chưa chọn gì: vẫn SÁNG dù máy tối (mặc định Figma)
    const c = await ctxFor(S2, { width: 1280, height: 800 }); await noFonts(c);
    const pg = await c.newPage(); await pg.emulateMedia({ colorScheme: "dark" });
    await pg.goto(`${BASE}/student/hoc-tap`, { waitUntil: "load", timeout: 240000 }); await pg.waitForTimeout(1200);
    check("chưa chọn gì + máy tối → vẫn sáng (mặc định nền sáng)", luminanceOf(await bodyBg(pg)) > 0.95);
    await pg.close(); await c.close();
  }

  section("Khách chưa đăng nhập: vẫn sáng như thiết kế, chữ vẫn đọc được dù máy đã lưu chế độ tối");
  const cg = await ctxFor(null, { width: 1280, height: 800 }); await noFonts(cg);
  await cg.addInitScript(`try { localStorage.setItem("kin.chu-de", "co-vit"); localStorage.setItem("kin.che-do", "toi"); } catch (e) {}`);
  const badG: unknown[] = [];
  for (const path of ["/", "/khoa-hoc", "/thi-thu", "/cong-dong", "/diem-chuan", "/dang-nhap"]) {
    const pg = await cg.newPage(); watch(pg);
    await pg.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
    await pg.waitForTimeout(2000);
    const zoneBg = await pg.evaluate(`(() => { const z = document.querySelector('[data-vung="sang"]'); return z ? getComputedStyle(z).backgroundColor : null; })()`) as string | null;
    const r = await audit(pg);
    if (!zoneBg || luminanceOf(zoneBg) < 0.9 || r.low.length) badG.push({ path, zoneBg, low: r.low.slice(0, 3) });
    await pg.close();
  }
  check("6 trang công khai: vùng sáng giữ nền trắng + không chữ khó đọc (kể cả chữ không đặt màu riêng)", badG.length === 0, badG);
  await cg.close();

  check("không lỗi JavaScript trên trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
