// Khung web công khai theo Figma KiN: thanh trên, trang chủ, chân trang, /phu-huynh.
// Kiểm cả cấu trúc lẫn số đo thật (màu nền hero, chiều cao nút, tương phản chữ nhỏ trên nền navy, không tràn ngang).
import { BASE, mkUser, mkTutor, mkCourse, mkSuper, wipe, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";

// Tương phản WCAG giữa màu chữ (có thể có alpha) và nền đã phối.
type RGBA = [number, number, number, number];
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
const lum = ([r, g, b]: RGBA) => { const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (fg: RGBA, bg: RGBA) => { const f = over(fg, bg); const [x, y] = [lum(f), lum(bg)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  await wipe();
  const U = await mkUser({ name: "Nguyễn Minh Anh" });
  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration/i.test(m.text())) errors.push(m.text()); }); };

  section("Trang chủ — khách, 1440px");
  const gctx = await ctxFor(null, { width: 1440, height: 900 });
  const p = await gctx.newPage(); watch(p);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
  await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 });
  check("h1 đúng bản Figma", /Học live mỗi tối,\s*cùng gia sư thật/.test(await p.getByRole("heading", { level: 1 }).innerText()));
  check("không còn câu 'Mua 1 lần, học trọn đời' (KiN thu theo tháng)", !(await p.locator("body").innerText()).includes("Mua 1 lần"));
  const nav = p.getByRole("navigation", { name: "Điều hướng chính" });
  const navHrefs = await nav.getByRole("link").evaluateAll(els => els.map(e => [e.textContent, e.getAttribute("href")]));
  check("thanh trên có đúng 4 mục: Lớp học, Thi thử, Cộng đồng, Tin tức", JSON.stringify(navHrefs) === JSON.stringify([["Lớp học", "/khoa-hoc"], ["Thi thử", "/thi-thu"], ["Cộng đồng", "/cong-dong"], ["Tin tức", "/tin-tuc"]]), navHrefs);
  const login = p.locator("header").getByRole("link", { name: "Đăng nhập", exact: true });
  const reg = p.locator("header").getByRole("link", { name: "Đăng ký", exact: true });
  check("nút Đăng nhập → /dang-nhap, Đăng ký → /dang-ky", (await login.getAttribute("href")) === "/dang-nhap" && (await reg.getAttribute("href")) === "/dang-ky");
  const rb = await reg.boundingBox(), lb = await login.boundingBox();
  check("hai nút trên thanh cao ≥ 44px (chạm được)", !!rb && !!lb && rb.height >= 44 && lb.height >= 44, [rb?.height, lb?.height]);
  check("nút Đăng ký nền navy #1e3a8a, chữ trắng", await reg.evaluate(e => { const s = getComputedStyle(e); return s.backgroundColor === "rgb(30, 58, 138)" && s.color === "rgb(255, 255, 255)"; }));
  check("logo K là SVG nội tuyến + chữ KiN", await p.locator("header svg").first().isVisible() && (await p.locator("header").innerText()).includes("KiN"));
  check("thanh trên dính khi cuộn (sticky)", await p.locator("header").first().evaluate(e => getComputedStyle(e).position === "sticky"));

  const hero = p.locator("section").first();
  check("hero nền navy #1e3a8a", await hero.evaluate(e => getComputedStyle(e).backgroundColor === "rgb(30, 58, 138)"));
  const cta1 = hero.getByRole("link", { name: "Xem lớp học" }), cta2 = hero.getByRole("link", { name: "Thi thử miễn phí" });
  check("hai nút hero: Xem lớp học → /khoa-hoc, Thi thử miễn phí → /thi-thu, cao 48px", (await cta1.getAttribute("href")) === "/khoa-hoc" && (await cta2.getAttribute("href")) === "/thi-thu" && (await cta1.boundingBox())?.height === 48);
  const tiles = await hero.getByRole("link").filter({ hasText: /ĐGNL HSA|ĐGNL HCM|Tốt nghiệp THPT|TSA Bách Khoa/ }).count();
  check("4 ô kỳ thi đang mở", tiles === 4, tiles);
  const stats0 = await hero.locator("dl dd").allInnerTexts();
  check("cơ sở dữ liệu chưa có lớp / đề / gia sư → KHÔNG hiện số liệu nào (không còn 1.200+ · 10.000+ · 6 bịa)", stats0.length === 0 && await hero.locator("dl").count() === 0, stats0);
  const tut = await mkTutor("Cô Lan"), course = await mkCourse(tut.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: U.id, courseId: course.id, status: "active" } });
  await prisma.exam.create({ data: { id: "ex-home", code: "ex-home", title: "Đề thử", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", ownerId: tut.id } });
  await p.reload({ waitUntil: "networkidle" });
  const stats1 = await hero.locator("dl dd").allInnerTexts(), labels1 = await hero.locator("dl dt").allInnerTexts();
  check("có dữ liệu thật → hiện đúng số đếm: 1 học sinh đang học · 1 đề thi thử · 1 gia sư", JSON.stringify(stats1) === JSON.stringify(["1", "1", "1"]) && JSON.stringify(labels1) === JSON.stringify(["Học sinh đang học", "Đề thi thử", "Gia sư"]), [stats1, labels1]);
  await prisma.exam.update({ where: { id: "ex-home" }, data: { active: false } });
  await p.reload({ waitUntil: "networkidle" });
  check("đề bị tắt thì không được đếm: số 'Đề thi thử' biến mất, hai số còn lại giữ nguyên", JSON.stringify(await hero.locator("dl dd").allInnerTexts()) === JSON.stringify(["1", "1"]));
  const box = await hero.locator("h1").boundingBox();
  check("khối hero rộng 1280px, chữ bắt đầu ở x=80 (Figma 151:3)", !!box && Math.abs(box.x - 80) <= 1, box?.x);

  section("Tương phản chữ nhỏ trên nền navy ≥ 4,5:1 (Figma gốc trượt)");
  const navy: RGBA = [30, 58, 138, 1];
  // Trình duyệt trả màu có alpha dưới dạng oklab()/color-mix(); nhờ canvas đổi về RGBA cho chắc.
  const colorOf = (loc: any): Promise<RGBA> => loc.evaluate((e: Element) => {
    const g = document.createElement("canvas").getContext("2d")!; g.canvas.width = g.canvas.height = 1;
    g.fillStyle = getComputedStyle(e).color; g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
  });
  const samples: [string, any, RGBA][] = [
    ["nhãn ĐANG MỞ LUYỆN THI", hero.getByText("ĐANG MỞ LUYỆN THI"), navy],
    ["đoạn mô tả hero", hero.getByText(/Không phải video quay sẵn/), navy],
    ["mô tả ô kỳ thi", hero.getByText("ĐH Quốc gia Hà Nội"), over([255, 255, 255, 0.08], navy)],
    ["nhãn số liệu", hero.getByText("Học sinh đang học"), over([255, 255, 255, 0.06], navy)],
  ];
  for (const [name, loc, bg] of samples) { const r = ratio(await colorOf(loc), bg); check(`${name}: ${r.toFixed(2)}:1`, r >= 4.5, r); }
  const ctaP = p.getByText(/Kết quả thật sau 30 ngày/);
  const rc = ratio(await colorOf(ctaP), navy); check(`đoạn mô tả khung CTA: ${rc.toFixed(2)}:1`, rc >= 4.5, rc);

  section("Mục 'Học ở đây thì được gì?', CTA, chân trang");
  const why = await p.getByRole("heading", { level: 3 }).allInnerTexts();
  check("4 thẻ lợi ích đúng chữ Figma", JSON.stringify(why) === JSON.stringify(["Học trực tiếp LIVE", "Theo dõi tiến độ realtime", "Trợ giảng riêng 1-1", "Hỏi bài không giới hạn"]), why);
  const grid = await p.locator("article").first().boundingBox();
  check("thẻ lợi ích đầu tiên cách mép trái 260px (lưới 920px, Figma 152:6)", !!grid && Math.abs(grid.x - 260) <= 1, grid?.x);
  check("khung CTA 760px: nút Tạo tài khoản → /dang-ky", (await p.getByRole("link", { name: /Tạo tài khoản miễn phí/ }).getAttribute("href")) === "/dang-ky");
  const foot = p.locator("footer");
  const footLinks = await foot.getByRole("link").evaluateAll(els => els.map(e => [e.textContent?.trim(), e.getAttribute("href")]));
  const want = [["Thi thử ĐGNL miễn phí", "/thi-thu"], ["Bảng xếp hạng", "/bang-xep-hang"], ["Tra cứu điểm chuẩn", "/diem-chuan"], ["Tin tức tuyển sinh", "/tin-tuc"], ["Danh sách gia sư", "/giang-vien"], ["Dành cho học sinh", "/dang-ky"], ["Dành cho gia sư", "/dang-ky?vai=gia-su"], ["Dành cho phụ huynh", "/phu-huynh"], ["Chính sách bảo mật", "/chinh-sach"]];
  check("chân trang có đủ 3 cột Figma + liên kết đúng", want.every(([t, h]) => footLinks.some(l => l[0] === t && l[1] === h)), footLinks);
  check("chân trang giữ hotline 0384 409 051", (await foot.innerText()).includes("0384 409 051"));
  check("không tràn ngang ở 1440px", await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(p, "kin-site-home-1440");

  section("Mọi liên kết ở thanh trên và chân trang đều mở được (không 404/500)");
  const hrefs = [...new Set([...navHrefs.map(n => n[1] as string), ...want.map(w => w[1]), "/dang-nhap", "/dang-ky"])];
  for (const h of hrefs) {
    const r = await fetch(`${BASE}${h}`, { redirect: "manual", signal: AbortSignal.timeout(240000) });
    check(`${h} → ${r.status}`, r.status < 400, r.status);
  }

  section("Khoá chế độ sáng: máy đặt chế độ tối thì thanh trên + chân trang không đổi sang tối");
  const dctx = await ctxFor(null, { width: 1440, height: 900 });
  const dp = await dctx.newPage(); watch(dp);
  await dp.emulateMedia({ colorScheme: "dark" });
  await dp.goto(`${BASE}/khoa-hoc`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await dp.locator("header").waitFor();
  const hb = await dp.locator("header").evaluate(e => getComputedStyle(e).backgroundColor);
  const fb = await dp.locator("footer").evaluate(e => getComputedStyle(e).backgroundColor);
  check("thanh trên nền trắng khi máy ở chế độ tối", hb === "rgb(255, 255, 255)", hb);
  check("chân trang nền trắng khi máy ở chế độ tối", fb === "rgb(255, 255, 255)", fb);
  check("chữ liên kết thanh trên vẫn tối (đọc được trên nền trắng)", await dp.locator("header nav a").first().evaluate(e => { const c = getComputedStyle(e).color.match(/\d+/g)!.map(Number); return c[0] < 100 && c[1] < 100; }));

  section("Đã đăng nhập: thanh trên có menu tài khoản, không còn nút Đăng ký");
  const uctx = await ctxFor(U, { width: 1440, height: 900 });
  const up = await uctx.newPage(); watch(up);
  await up.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
  const acc = up.locator("header").getByRole("button", { name: /Anh/ });
  await acc.waitFor({ timeout: 90000 });
  check("không có Đăng nhập / Đăng ký khi đã vào", await up.locator("header").getByRole("link", { name: /^(Đăng nhập|Đăng ký)$/ }).count() === 0);
  await acc.click();
  const items = await up.getByRole("menuitem").allInnerTexts();
  check("menu tài khoản: 4 mục + Đăng xuất", ["Thông tin cá nhân", "Khoá học của tôi", "Lịch học", "Lớp đang theo dõi", "Đăng xuất"].every(t => items.map(i => i.trim()).includes(t)), items);
  check("nút tài khoản cao ≥ 44px", ((await acc.boundingBox())?.height ?? 0) >= 44);
  await up.keyboard.press("Escape");

  section("Điện thoại 390px");
  const mctx = await ctxFor(null, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
  await mp.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 });
  check("không tràn ngang", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  check("thanh trên chỉ còn logo + nút menu (mục điều hướng ẩn)", !(await nav.isVisible().catch(() => false)) || !(await mp.getByRole("navigation", { name: "Điều hướng chính" }).isVisible()));
  const burger = mp.getByRole("button", { name: "Mở menu" });
  const bb = await burger.boundingBox();
  check("nút menu ≥ 44×44", !!bb && bb.width >= 44 && bb.height >= 44, bb);
  await burger.click();
  const mlinks = mp.locator("header").getByRole("link");
  const names = await mlinks.allInnerTexts();
  check("mở menu thấy 4 mục + Đăng nhập + Đăng ký", ["Lớp học", "Thi thử", "Cộng đồng", "Tin tức", "Đăng nhập", "Đăng ký"].every(t => names.includes(t)), names);
  const heights = await mlinks.evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent && e.textContent !== "KiN").map(e => (e as HTMLElement).getBoundingClientRect().height));
  check("mọi mục trong menu cao ≥ 44px", heights.length >= 6 && heights.every(h => h >= 43.5), heights);
  await shot(mp, "kin-site-home-390-menu");
  check("sau khi mở menu vẫn không tràn ngang", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);

  section("/phu-huynh");
  const pp = await gctx.newPage(); watch(pp);
  await pp.goto(`${BASE}/phu-huynh`, { waitUntil: "networkidle", timeout: 240000 });
  check("có tiêu đề và câu giải thích không cần tài khoản", await pp.getByRole("heading", { name: "Phụ huynh thì không cần đăng nhập" }).isVisible() && (await pp.locator("main").innerText()).includes("không tài khoản, không mật khẩu"));

  section("Trang đăng nhập / đăng ký / quên & đặt lại mật khẩu: cùng ngôn ngữ KiN, còn chạy được");
  const legacyBlue = (pg: any) => pg.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll("main *").forEach(el => {
      const cs = getComputedStyle(el);
      for (const k of ["color", "backgroundColor", "borderTopColor", "borderBottomColor", "outlineColor"] as const)
        if (cs[k] === "rgb(0, 104, 255)") bad.push(`${el.tagName}.${k}`);
      if (el instanceof SVGElement && getComputedStyle(el).stroke === "rgb(0, 104, 255)") bad.push("svg.stroke");
    });
    return bad;
  });
  for (const path of ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau"]) {
    const ap = await gctx.newPage(); watch(ap);
    await ap.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 240000 });
    await ap.locator("main svg").first().waitFor({ timeout: 90000 });
    check(`${path}: có logo K + câu giới thiệu của Figma`, await ap.locator("main svg").first().isVisible() && (await ap.locator("main").innerText()).includes("Lớp học của bạn, gọn trong một chỗ"));
    const bad = await legacyBlue(ap);
    check(`${path}: không còn xanh cũ #0068FF trong nội dung trang`, bad.length === 0, bad.slice(0, 4));
    check(`${path}: không tràn ngang ở 1440px`, await ap.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
    await ap.close();
  }
  const rp = await gctx.newPage(); watch(rp);
  await rp.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 240000 });
  const student = rp.getByRole("button", { name: /Học viên/ }), tutor = rp.getByRole("button", { name: /Gia sư/ });
  await tutor.click();
  const navyBorder = (loc: any) => loc.evaluate((e: Element) => getComputedStyle(e).borderTopColor);
  check("chọn vai trò Gia sư: viền chuyển sang navy, ô kia về xám", (await navyBorder(tutor)) === "rgb(30, 58, 138)" && (await navyBorder(student)) !== "rgb(30, 58, 138)");
  check("hiện cảnh báo hồ sơ gia sư chờ duyệt", await rp.getByText(/chờ admin duyệt/).isVisible());
  await student.click();
  await rp.getByRole("button", { name: /Tiếp theo/ }).click();
  // viền đổi màu có transition 0,15s nên đợi tới khi ổn định
  const nameInput = rp.getByPlaceholder("Nguyễn Văn A");
  const borderOf = () => nameInput.evaluate(e => getComputedStyle(e).borderTopColor);
  await eventually("bỏ trống rồi bấm Tiếp theo: ô lỗi viền đỏ #dc2626", async () => (await borderOf()) === "rgb(220, 38, 38)");
  await nameInput.fill("Nguyễn Minh Anh");
  await eventually("nhập đúng: viền xanh lá trạng thái #059669", async () => (await borderOf()) === "rgb(5, 150, 105)");
  const lp = await gctx.newPage(); watch(lp);
  await lp.goto(`${BASE}/dang-nhap?cach=ma`, { waitUntil: "networkidle", timeout: 240000 });
  // Đăng nhập có hai tab (Mật khẩu là mặc định, Mã một lần mở bằng ?cach=ma); test riêng: ui-login-password và ui-login-code. Ở đây chỉ giữ kiểm tra chung của khung web công khai.
  await lp.getByRole("button", { name: "Gửi mã đăng nhập" }).click();
  check("đăng nhập bỏ trống: báo 'Vui lòng nhập số điện thoại hoặc email' (môi trường test có SMS)", await lp.getByText("Vui lòng nhập số điện thoại hoặc email").isVisible());
  await lp.getByLabel("Email").evaluate(e => (e as HTMLElement).blur());
  await eventually("ô nhập có viền #8b95a5 (đạt 3:1)", async () => (await lp.getByLabel("Email").evaluate(e => getComputedStyle(e).borderTopColor)) === "rgb(139, 149, 165)");
  const mctx2 = await ctxFor(null, { width: 390, height: 844 });
  for (const path of ["/dang-nhap", "/dang-ky", "/quen-mat-khau"]) {
    const mp2 = await mctx2.newPage(); watch(mp2);
    await mp2.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 240000 });
    await mp2.locator("main svg").first().waitFor({ timeout: 90000 });
    check(`${path}: điện thoại 390px không tràn ngang`, await mp2.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
    await mp2.close();
  }

  section("Các trang cũ (khách / học viên / quản trị) đã đổi màu viết cứng sang token KiN");
  const T0 = await mkTutor("Cô Lan"); const S0 = await mkUser({ name: "Học viên mẫu" }); const A0 = await mkSuper("Quản trị mẫu");
  void T0;
  const legacyScan = (pg: any) => pg.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll("body *").forEach(el => {
      if (el.closest("[data-mau-du-lieu]")) return; // ô chọn màu nhãn: mã màu là DỮ LIỆU lưu vào cơ sở dữ liệu, không phải kiểu dáng
      const cs = getComputedStyle(el);
      for (const k of ["color", "backgroundColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor"] as const)
        if (cs[k] === "rgb(0, 104, 255)") bad.push(`${el.tagName}.${(el.className && String(el.className).slice(0, 30)) || ""}.${k}`);
    });
    return bad;
  });
  const groups: [string, any, string[]][] = [
    ["khách", null, ["/khoa-hoc", "/thi-thu", "/tin-tuc", "/bang-xep-hang", "/cong-dong", "/giang-vien", "/diem-chuan", "/chinh-sach"]],
    ["học viên", S0, ["/student/hoc-tap", "/student/lich-hoc", "/student/ho-so"]],
    ["quản trị", A0, ["/admin", "/admin/hoc-sinh", "/admin/khoa-hoc", "/admin/thi-thu"]],
  ];
  for (const [label, who, paths] of groups) {
    const gc = await ctxFor(who, { width: 1280, height: 900 });
    await gc.setExtraHTTPHeaders({ "x-forwarded-for": `10.66.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
    for (const path of paths) {
      const gp2 = await gc.newPage(); watch(gp2);
      await gp2.emulateMedia({ colorScheme: "dark" });
      const base = label === "quản trị" ? ADMIN : BASE;
      await gp2.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 240000 });
      await gp2.waitForTimeout(1200);
      const bad = await legacyScan(gp2);
      check(`[${label}] ${path}: không còn xanh cũ #0068FF trong chữ/nền/viền`, bad.length === 0, bad.slice(0, 5));
      // Đo bằng một phần tử thử trong khu sáng: tránh so chuỗi "#fff" / "#ffffff" (CSS đã rút gọn mã màu).
      const bg = await gp2.evaluate(`(() => { const host = document.querySelector('[data-vung="sang"]'); const d = document.createElement('div'); d.style.background = 'var(--kin-nen-trang)'; host.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })()`);
      check(`[${label}] ${path}: máy ở chế độ tối nhưng khu này vẫn sáng (nền trắng)`, bg === "rgb(255, 255, 255)", bg);
      await gp2.close();
    }
    await gc.close();
  }

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
