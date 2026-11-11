// HOME-01: trang chủ mở được khi đã đăng nhập (học sinh, gia sư, quản trị, phụ huynh), nút "Vào trang của tôi", lối "Trang chủ KiN",
// khối gia sư đã bỏ, khối "Tìm gia sư" mới, nội dung đọc từ bảng site_content (có dữ liệu hỏng thì về mặc định). 1600px và 390px.
import { BASE, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, shot, closeAll } from "./ui";

import { FEATURES as KIN_FEATURES, featureOn as kinFeatureOn } from "@/lib/features";

// LOI-01 (11/11/2026): bài này khẳng định ĐỦ menu / khối trang chủ của các phần mà LOI-01 mặc định ẨN (Lịch, Cộng đồng, Tin tức, Thư viện, Tìm gia sư, Tiếng Anh, Xếp hạng, Coin, Điểm chuẩn).
// Chạy với NEXT_PUBLIC_KIN_MO_<TÊN>=1 (bật hết) cho CẢ máy chủ dev lẫn bài (cùng env.sh) mới có nghĩa; cờ đang tắt thì bỏ qua có thông báo thay vì đỏ vì thiếu mục đang bị ẩn có chủ đích.
// Hành vi KHI ẨN do bài của LOI-01 phủ: t-features-lib, ui-links-everywhere, ui-role-everything, ui-tutor-shell, ui-student-shell, ui-coin-an, ui-loi-cong-dong-lop.
const KIN_OFF = KIN_FEATURES.filter(k => !kinFeatureOn(k));
if (KIN_OFF.length) {
  console.log(`\n(BỎ QUA cả bài: LOI-01 đang ẨN ${KIN_OFF.join(", ")}. Chạy với NEXT_PUBLIC_KIN_MO_<TÊN>=1 cho cả máy chủ dev và bài để kiểm đủ menu/khối.)\n0 pass / 0 fail`);
  process.exit(0);
}

const tok = (b: number) => b.toString(16).padStart(2, "0").repeat(16);
const NOT_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth`;

(async () => {
  await wipe();
  await prisma.siteContent.deleteMany({});
  const S = await mkUser({ name: "Minh Anh" });
  const T = await mkTutor("Cô Lan");
  const A = await mkSuper("Quản Trị");
  const course = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: course.id, status: "active" } });
  const portalTok = tok(0xa1);
  await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "Chị Hoa" })).id, studentId: S.id, status: "verified", verifiedAt: new Date(), portalToken: portalTok } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration|negative time stamp/i.test(m.text())) errors.push(m.text()); }); };
  const open = async (u: any, w: number, h = 900) => { const c = await ctxFor(u, { width: w, height: h }); const p = await c.newPage(); watch(p); await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 }); await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 }); return { c, p }; };

  section("Ba vai mở được '/' (1600px): ở lại '/', có Navbar, không có thanh bên module");
  const roles = [["học sinh", S, "Minh Anh", "/student/viec-cua-toi"], ["gia sư", T, "Cô Lan", "/lop-cua-toi"], ["quản trị cấp 1", A, "Quản Trị", "/admin"]] as const;
  for (const [name, u, short, href] of roles) {
    const { c, p } = await open(u, 1600);
    check(`${name}: URL sau khi tải là '/'`, new URL(p.url()).pathname === "/", p.url());
    check(`${name}: có h1 và thanh 'Điều hướng chính'`, await p.getByRole("heading", { level: 1 }).isVisible() && await p.getByRole("navigation", { name: "Điều hướng chính" }).isVisible());
    check(`${name}: KHÔNG có thanh bên module`, (await p.getByRole("navigation", { name: /^Module của/ }).count()) === 0);
    const go = p.locator("header").getByRole("link", { name: "Vào trang của tôi" });
    await go.waitFor({ timeout: 90000 });
    check(`${name}: nút 'Vào trang của tôi' → ${href}, cao ≥ 44px`, (await go.getAttribute("href")) === href && ((await go.boundingBox())?.height ?? 0) >= 44, await go.getAttribute("href"));
    // BU-HS-TRANG-CHU (09/11/2026): HỌC SINH có thêm mục "Lớp của tôi" (→ /student/hoc-tap) ở Navbar và khối "Lớp của tôi" trong trang; gia sư / quản trị không có cả hai.
    const lopLink = p.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Lớp của tôi", exact: true });
    if (name === "học sinh") {
      await p.locator('[data-home-block="my-class"]').waitFor({ timeout: 90000 });
      check("học sinh: Navbar có ĐÚNG 1 liên kết 'Lớp của tôi' → /student/hoc-tap, cao ≥ 44px", (await lopLink.count()) === 1 && (await lopLink.getAttribute("href")) === "/student/hoc-tap" && ((await lopLink.boundingBox())?.height ?? 0) >= 44);
      check("học sinh: trang có khối 'Lớp của tôi' (có lớp Toán 9 của em)", await p.locator('[data-home-block="my-class"]').getByText("Toán 9").first().isVisible());
    } else {
      await p.waitForTimeout(1500);
      check(`${name}: Navbar KHÔNG có 'Lớp của tôi' và trang không có khối 'Lớp của tôi'`, (await lopLink.count()) === 0 && (await p.locator('[data-home-block="my-class"]').count()) === 0);
    }
    // Mở menu tài khoản: nút nằm NGOÀI role=menu và không làm tăng số menuitem.
    await p.locator("header").getByRole("button", { name: new RegExp(short.split(" ").pop()!) }).click();
    await p.locator("header [role=menu]").waitFor({ timeout: 10000 });
    check(`${name}: nút vẫn hiện khi menu mở, nằm ngoài [role=menu]`, await go.isVisible() && (await p.locator("header [role=menu]").getByText("Vào trang của tôi").count()) === 0);
    const items = await p.locator("header [role=menu]").getByRole("menuitem").allInnerTexts();
    check(`${name}: menu tài khoản vẫn 4 mục + Đăng xuất`, items.length === 5 && items[4].trim() === "Đăng xuất", items);
    if (name === "quản trị cấp 1") {
      const tag = await go.evaluate(e => e.tagName);
      check("quản trị: là thẻ <a> thường (tải cứng sang tên miền admin), không bấm", tag === "A");
    } else {
      await p.keyboard.press("Escape");
      await go.click();
      await p.waitForURL(new RegExp(href.replace(/\//g, "\\/")), { timeout: 90000 });
      check(`${name}: bấm → ${href}`, new URL(p.url()).pathname.startsWith(href), p.url());
    }
    await c.close();
  }

  section("Điện thoại 390px: 'Vào trang của tôi' là mục đầu khối tài khoản trong menu bung");
  {
    const { c, p } = await open(S, 390, 844);
    await p.getByRole("button", { name: "Mở menu" }).click();
    const go = p.getByRole("link", { name: "Vào trang của tôi" });
    await go.waitFor({ timeout: 10000 });
    check("nút cao ≥ 44px", ((await go.boundingBox())?.height ?? 0) >= 44);
    const acct = p.locator("header").getByRole("link").filter({ hasText: /^(Vào trang của tôi|Thông tin cá nhân)$/ });
    check("đứng TRƯỚC 'Thông tin cá nhân'", (await acct.first().innerText()).trim() === "Vào trang của tôi");
    check("không tràn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
    await shot(p, "home-signed-in-390");
    await c.close();
  }

  section("Lối 'Trang chủ KiN' từ vỏ học sinh / gia sư / phụ huynh");
  for (const [name, u, short, start] of [["học sinh", S, "Minh Anh", "/student/viec-cua-toi"], ["gia sư", T, "Cô Lan", "/lop-cua-toi"]] as const) {
    const c = await ctxFor(u, { width: 1280, height: 800 }); const p = await c.newPage(); watch(p);
    await p.goto(`${BASE}${start}`, { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("button", { name: new RegExp(short) }).first().waitFor({ timeout: 90000 });
    await p.getByRole("button", { name: new RegExp(short) }).first().click();
    await p.getByRole("menuitem", { name: "Trang chủ KiN" }).click();
    await p.waitForURL((u2: URL) => u2.pathname === "/", { timeout: 90000 });
    check(`${name}: menu tài khoản → 'Trang chủ KiN' → '/'`, new URL(p.url()).pathname === "/", p.url());
    await c.close();
  }
  {
    const c = await ctxFor(null, { width: 390, height: 844 }); const p = await c.newPage(); watch(p);
    await p.goto(`${BASE}/so-cua-con/${portalTok}`, { waitUntil: "networkidle", timeout: 120000 });
    const link = p.getByRole("banner").getByRole("link", { name: "Trang chủ KiN" });
    await link.waitFor({ timeout: 90000 });
    check("phụ huynh: còn dòng 'Trang riêng cho phụ huynh' và chân trang", await p.getByRole("banner").getByText("Trang riêng cho phụ huynh").isVisible() && await p.getByRole("contentinfo").isVisible());
    check("phụ huynh: liên kết cao ≥ 44px, 390px không tràn ngang", ((await link.boundingBox())?.height ?? 0) >= 44 && await p.evaluate(NOT_OVERFLOW) as boolean);
    check("phụ huynh: liên kết có referrerpolicy=no-referrer (token cổng không đi vào Referer)", (await link.getAttribute("referrerpolicy")) === "no-referrer");
    await link.click();
    await p.waitForURL((u2: URL) => u2.pathname === "/", { timeout: 90000 });
    check("phụ huynh: bấm → '/'", new URL(p.url()).pathname === "/", p.url());
    await c.close();
  }

  section("Khách: vẫn Đăng nhập / Đăng ký, không có 'Vào trang của tôi'; không còn khối gia sư; có khối 'Tìm gia sư'");
  {
    const { c, p } = await open(null, 1600);
    check("có Đăng nhập, Đăng ký", await p.locator("header").getByRole("link", { name: "Đăng nhập", exact: true }).isVisible() && await p.locator("header").getByRole("link", { name: "Đăng ký", exact: true }).isVisible());
    check("không có 'Vào trang của tôi'", (await p.getByRole("link", { name: "Vào trang của tôi" }).count()) === 0);
    const body = await p.locator("body").innerText();
    check("không còn khối gia sư: Việc giấy tờ tăng theo số lớp, Cách hoạt động, Câu hỏi thường gặp", ["Việc giấy tờ tăng theo số lớp", "Cách hoạt động", "Câu hỏi thường gặp"].every(t => !body.includes(t)));
    check("không còn #h-gia-su, #cau-hoi, <details>", await p.locator("#h-gia-su, #cau-hoi, details").count() === 0);
    const why = p.locator("section").filter({ has: p.getByRole("heading", { level: 2, name: "Học ở đây thì được gì?" }) }).first();
    const sec = p.locator("section").filter({ has: p.getByRole("heading", { level: 2, name: "Đang tìm gia sư?" }) }).first();
    // BU-HS-LANDING mục 4: chữ "Tìm gia sư" chuyển vào khối Gia sư (đứng sau hero, TRƯỚC "Học ở đây thì được gì?"): hero → tutors → courses → exams → news → community → score → why → cta.
    check("khối 'Tìm gia sư' (trong khối Gia sư) đứng TRƯỚC mục 'Học ở đây thì được gì?' (thứ tự DOM)", await sec.evaluate((a, b) => !!(a.compareDocumentPosition(b as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await why.elementHandle()));
    const btn = sec.getByRole("link", { name: "Tìm gia sư", exact: true });
    check("nút 'Tìm gia sư' → /giang-vien, cao ≥ 44px", (await btn.getAttribute("href")) === "/giang-vien" && ((await btn.boundingBox())?.height ?? 0) >= 44);
    check("có chữ 'Phụ huynh xem Sổ của con bằng đường dẫn riêng'", await sec.getByText(/Phụ huynh xem Sổ của con bằng đường dẫn riêng/).isVisible());
    check("khối không có article / h3", await sec.locator("article, h3").count() === 0);
    const reg = sec.getByRole("link", { name: "Đăng ký gia sư" });
    check("liên kết 'Đăng ký gia sư' → /dang-ky?vai=gia-su", (await reg.getAttribute("href")) === "/dang-ky?vai=gia-su");
    check("1600px không tràn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
    await shot(p, "home-signed-in-1600");
    await reg.click();
    await p.waitForURL(/\/dang-ky/, { timeout: 90000 });
    check("bấm 'Đăng ký gia sư' → /dang-ky có vai Gia sư được chọn sẵn", await p.getByText(/Hồ sơ gia sư sẽ chờ admin duyệt/).waitFor({ timeout: 30000 }).then(() => true, () => false));
    await c.close();
    const m = await open(null, 390, 844);
    check("390px không tràn ngang", await m.p.evaluate(NOT_OVERFLOW) as boolean);
    const mb = m.p.locator("section").filter({ has: m.p.getByRole("heading", { level: 2, name: "Đang tìm gia sư?" }) }).first().getByRole("link", { name: "Tìm gia sư", exact: true });
    const [vw, bw] = [390, (await mb.boundingBox())?.width ?? 0];
    check("390px: nút 'Tìm gia sư' rộng gần hết chiều ngang (một cột)", bw >= vw - 64, bw);
    await m.c.close();
  }

  section("Nội dung sửa được: site_content");
  {
    const c = await ctxFor(null, { width: 1600, height: 900 }); const p = await c.newPage(); watch(p);
    const h1 = async () => { await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 }); return (await p.getByRole("heading", { level: 1 }).innerText()).replace(/\s+/g, " ").trim(); };
    check("(a) chưa có hàng → h1 mặc định", (await h1()) === "Học cùng gia sư thật, theo lớp và theo lịch");
    const base = {
      badge: "Thử nội dung", title: "Tiêu đề mới\ndòng hai", lead: "Đoạn dẫn mới.",
      exams: [{ label: "ĐGNL HSA", desc: "ĐH Quốc gia Hà Nội", href: "/khoa-hoc?category=%C4%90GNL%20HSA" }],
      why: { title: "Vì sao chọn KiN?", subtitle: "Phụ đề", cards: [{ icon: "star", title: "Thẻ sao", desc: "Mô tả thẻ." }, { icon: "key", title: "Thẻ khoá", desc: "Mô tả." }] },
      findTutor: { title: "Đang tìm gia sư?", desc: "Mô tả.", buttonLabel: "Tìm gia sư", buttonHref: "javascript:alert(1)", parentNote: "Ghi chú." },
      cta: { title: "CTA mới", desc: "Mô tả CTA.", primary: { label: "Đăng ký", href: "/dang-ky" }, secondary: { label: "Thi thử", href: "/thi-thu" } },
    };
    await prisma.siteContent.upsert({ where: { key: "home" }, create: { key: "home", data: base }, update: { data: base } });
    check("(b) h1 mới hiện (xuống dòng)", (await h1()) === "Tiêu đề mới dòng hai");
    check("(b) thẻ dùng icon 'star' hiện", await p.getByRole("heading", { level: 3, name: "Thẻ sao" }).isVisible());
    check("(b) href 'javascript:' bị thay bằng mặc định /giang-vien", (await p.getByRole("link", { name: "Tìm gia sư", exact: true }).getAttribute("href")) === "/giang-vien");
    check("(b) không có href javascript: nào trên trang", await p.locator('a[href^="javascript:" i]').count() === 0);
    for (const bad of ["rác", []]) {
      await prisma.siteContent.update({ where: { key: "home" }, data: { data: bad as any } });
      const r = await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 240000 });
      check(`(c) data = ${JSON.stringify(bad)} → 200 với h1 mặc định`, r?.status() === 200 && (await p.getByRole("heading", { level: 1 }).innerText()).replace(/\s+/g, " ").includes("Học cùng gia sư thật"));
    }
    await prisma.siteContent.deleteMany({});
    check("(d) xoá hàng → h1 mặc định", (await h1()) === "Học cùng gia sư thật, theo lớp và theo lịch");
    await c.close();
  }

  check("không có pageerror / lỗi console", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
