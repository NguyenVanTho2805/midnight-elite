// Thanh bên trái LUÔN HIỆN sau khi đăng nhập + thu vào / thò ra (14/10/2026). Trình duyệt thật.
// Phủ: nút thu/mở + bàn phím + tiêu điểm; nhớ lựa chọn (máy + tài khoản) và KHÔNG nháy khi tải lại; điện thoại không bị ảnh hưởng;
// thanh bên không còn biến mất ở các trang khách (/thu-vien, /khoa-hoc…) khi đã đăng nhập; khách vẫn thấy Navbar; phòng thi không có thanh.
import { BASE, mkTutor, mkUser, mkSuper, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

const H = 3_600_000;

(async () => {
  await wipe();
  const now = Date.now();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });
  const SA = await mkSuper("Quản trị cấp 1");
  const A = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.course.update({ where: { id: A.id }, data: { status: true } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: "s-sb", title: "P", courseId: A.id } });
  const ch = await prisma.chapter.create({ data: { id: "c-sb", title: "C", sectionId: sec.id } });
  const les = await prisma.lesson.create({ data: { id: "l-sb", code: "l-sb", title: "Bài giảng", type: "record", chapterId: ch.id, isFree: true, isLocked: false, documents: "TAI-LIEU-CONG-KHAI|https://files.example/a.pdf" } });
  for (let i = 0; i < 3; i++) await prisma.assignment.create({ data: { lessonId: les.id, title: `Bài ${i + 1}`, dueDate: new Date(now + (i + 1) * 3 * H), instructions: "Làm bài" } });
  await prisma.exam.create({ data: { id: "ex-sb", code: "ex-sb", title: "Đề thử", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId: A.id } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(m.text()); }); };
  const RAIL = { student: "Module của học sinh", tutor: "Module của gia sư", admin: "Module quản trị" };
  const rail = (p: any, name: string) => p.getByRole("navigation", { name });
  const closeBtn = (p: any) => p.getByRole("button", { name: "Thu gọn thanh bên" });
  const openBtn = (p: any) => p.getByRole("button", { name: /^Mở thanh bên/ });
  const attr = (p: any) => p.evaluate(`document.documentElement.getAttribute("data-kin-rail")`) as Promise<string | null>;
  const wrapW = (p: any) => p.evaluate(`Math.round(document.querySelector("#kin-rail")?.getBoundingClientRect().width ?? -1)`) as Promise<number>;
  const stored = (p: any) => p.evaluate(`localStorage.getItem("kin.thanh-ben")`) as Promise<string | null>;
  const accountRail = async (id: string) => ((await prisma.user.findUnique({ where: { id }, select: { preferences: true } }))?.preferences as any)?.rail ?? null;
  // 23/10/2026: "Việc của tôi" của học viên nay là TRANG DỌC (tiêu đề h1 + mục "Cần làm"…), không còn listbox / khung "Danh sách" "Chi tiết".
  // Đợi tiêu đề trang hiện và khung xương "Đang tải Việc của tôi" biến mất; "khung nội dung" = thẻ gốc chứa tiêu đề (đệm ngang nằm bên trong nó).
  const h1 = (p: any) => p.getByRole("heading", { name: "Việc của tôi", level: 1 });
  const ready = async (p: any) => { await h1(p).waitFor({ timeout: 90000 }); await p.locator('[aria-busy="true"][aria-label="Đang tải Việc của tôi"]').waitFor({ state: "detached", timeout: 90000 }).catch(() => {}); };
  const pageBox = (p: any) => h1(p).locator("xpath=ancestor::div[contains(@class,'pt-6')][1]");
  const focusIs = (p: any, sel: string) => p.evaluate(`document.activeElement?.matches(${JSON.stringify(sel)}) ?? false`) as Promise<boolean>;

  // ───────────────────────────── Học viên: thu / mở
  const ctx = await ctxFor(S, { width: 1280, height: 800 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await ready(pg);

  section("Mặc định: thanh bên LUÔN HIỆN");
  check("thanh bên hiện, rộng 79px", await rail(pg, RAIL.student).isVisible() && (await rail(pg, RAIL.student).boundingBox())?.width === 79);
  check("có nút 'Thu gọn thanh bên' (aria-expanded=true, aria-controls=kin-rail), cao 44px", await closeBtn(pg).getAttribute("aria-expanded") === "true" && await closeBtn(pg).getAttribute("aria-controls") === "kin-rail" && (await closeBtn(pg).boundingBox())?.height === 44);
  check("nút 'Mở thanh bên' ở dải trên chưa hiện", !(await openBtn(pg).isVisible()));
  check("không có data-kin-rail=thu trên <html>, chưa lưu gì ở máy", (await attr(pg)) !== "thu" && (await stored(pg)) === null);
  const listX0 = (await pageBox(pg).boundingBox())?.x ?? -1;
  check("khung nội dung của 'Việc của tôi' bắt đầu ngay sau thanh bên (x=79)", Math.round(listX0) === 79, listX0);
  const readW0 = (await pageBox(pg).boundingBox())?.width ?? 0;

  section("Thu vào (thụt)");
  await closeBtn(pg).click();
  await eventually("thanh bên ẩn hẳn, wrapper rộng 0", async () => !(await rail(pg, RAIL.student).isVisible()) && (await wrapW(pg)) === 0);
  check("<html data-kin-rail=thu> + localStorage 'thu'", (await attr(pg)) === "thu" && (await stored(pg)) === "thu");
  check("nút 'Mở thanh bên' hiện ở dải trên, aria-expanded=false, cao 44px", await openBtn(pg).isVisible() && await openBtn(pg).getAttribute("aria-expanded") === "false" && (await openBtn(pg).boundingBox())?.height === 44);
  check("tiêu điểm chuyển sang nút 'Mở thanh bên' (người dùng bàn phím không bị mất chỗ)", await focusIs(pg, "[data-rail-open]"));
  const listX1 = (await pageBox(pg).boundingBox())?.x ?? -1;
  const readW1 = (await pageBox(pg).boundingBox())?.width ?? 0;
  check("khung nội dung dịch sang mép trái (x=0), rộng thêm 79px", Math.round(listX1) === 0 && Math.round(readW1 - readW0) === 79, { listX1, grow: readW1 - readW0 });
  const trapped = await pg.evaluate(`(() => { const a = document.querySelector('#kin-rail a'); if (!a) return 'no-link'; a.focus(); return document.activeElement === a; })()`);
  check("khi thu, liên kết trong thanh KHÔNG nhận được tiêu điểm (Tab không rơi vào chỗ ẩn)", trapped === false, trapped);
  check("lưu theo TÀI KHOẢN: User.preferences.rail = 'thu'", await (async () => { for (let i = 0; i < 40; i++) { if ((await accountRail(S.id)) === "thu") return true; await new Promise(r => setTimeout(r, 200)); } return false; })());
  await shot(pg, "sidebar-1-collapsed");

  section("Tải lại: vẫn thu, KHÔNG nháy");
  const pg2 = await ctx.newPage(); watch(pg2);
  await pg2.addInitScript(`window.__rw = []; new MutationObserver(() => { const w = document.querySelector("#kin-rail"); if (w) window.__rw.push(Math.round(w.getBoundingClientRect().width)); }).observe(document, { childList: true, subtree: true });`);
  await pg2.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await ready(pg2);
  const seen = await pg2.evaluate(`window.__rw`) as number[];
  check("tải lại: vẫn thu (<html data-kin-rail=thu), thanh ẩn", (await attr(pg2)) === "thu" && !(await rail(pg2, RAIL.student).isVisible()));
  check(`không có khoảnh khắc nào thanh bên rộng > 0 trong lúc dựng trang (không nháy); đã quan sát ${seen.length} lần`, seen.length > 0 && Math.max(...seen) === 0, seen);
  await pg2.close();

  section("Mở ra (thò)");
  await openBtn(pg).click();
  await eventually("thanh bên hiện lại, rộng 79px", async () => await rail(pg, RAIL.student).isVisible() && (await wrapW(pg)) === 79);
  check("<html> không còn data-kin-rail=thu, localStorage 'mo'", (await attr(pg)) !== "thu" && (await stored(pg)) === "mo");
  check("tiêu điểm chuyển sang nút 'Thu gọn thanh bên'", await focusIs(pg, "[data-rail-close]"));
  check("nút 'Mở thanh bên' ẩn lại", !(await openBtn(pg).isVisible()));
  check("tài khoản ghi 'mo'", await (async () => { for (let i = 0; i < 40; i++) { if ((await accountRail(S.id)) === "mo") return true; await new Promise(r => setTimeout(r, 200)); } return false; })());

  section("Bàn phím: phím '[' bật/tắt, trừ khi đang gõ chữ");
  await pg.locator("body").click({ position: { x: 700, y: 400 } });
  await pg.keyboard.press("[");
  await eventually("nhấn '[' → thu", async () => (await attr(pg)) === "thu" && !(await rail(pg, RAIL.student).isVisible()));
  await pg.keyboard.press("[");
  await eventually("nhấn '[' lần nữa → mở", async () => (await attr(pg)) !== "thu" && await rail(pg, RAIL.student).isVisible());
  await pg.goto(`${BASE}/student/nhap-ma-lop`, { waitUntil: "networkidle", timeout: 120000 });
  const box = pg.locator("input").first();
  await box.waitFor({ timeout: 60000 });
  await box.focus();
  await pg.keyboard.type("[");
  check("gõ '[' trong ô nhập → thanh bên KHÔNG đổi (không nuốt ký tự)", await rail(pg, RAIL.student).isVisible() && (await attr(pg)) !== "thu");

  section("Bảng 'Khác' đóng khi thu thanh");
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pg, RAIL.student).getByRole("button", { name: /^Khác/ }).click();
  check("mở 'Khác' → hiện bảng", await pg.getByRole("dialog", { name: "Các mục khác" }).isVisible());
  await closeBtn(pg).click();
  await eventually("thu thanh → bảng 'Khác' (neo vào thanh) cũng đóng", async () => (await pg.getByRole("dialog", { name: "Các mục khác" }).count()) === 0);
  await openBtn(pg).click();

  section("Chấm đỏ 'còn việc' không bị giấu khi thu");
  await closeBtn(pg).click();
  await eventually("nút 'Mở thanh bên' báo số việc cần xử lý bằng chữ cho trình đọc màn hình", async () => /3 việc cần xử lý/.test((await openBtn(pg).getAttribute("aria-label")) ?? ""));
  check("và có chấm đỏ nhìn thấy được", await openBtn(pg).locator("[data-rail-dot]").isVisible());
  await openBtn(pg).click();

  section("Chuyển động: 450ms khi mở / mở rộng (thu lại vẫn 180ms), tắt hẳn khi người dùng chọn giảm chuyển động");
  const dur = await pg.evaluate(`getComputedStyle(document.querySelector("#kin-rail")).transitionDuration`) as string;
  check("bình thường: bề rộng đổi bằng chuyển động 0,45s (Lucian No.040; thu lại dùng 0,18s riêng)", /0\.45s|450ms/.test(dur), dur);
  const ctxRM = await ctxFor(S, { width: 1280, height: 800 });
  const prm = await ctxRM.newPage(); await prm.emulateMedia({ reducedMotion: "reduce" });
  await prm.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await ready(prm);
  const dur2 = await prm.evaluate(`getComputedStyle(document.querySelector("#kin-rail")).transitionDuration`) as string;
  check("prefers-reduced-motion: reduce → không chuyển động (0s)", /^0s(, 0s)*$/.test(dur2), dur2);
  await ctxRM.close();

  section("Máy khác (không có gì trong localStorage) lấy lựa chọn theo TÀI KHOẢN");
  await prisma.user.update({ where: { id: S.id }, data: { preferences: { rail: "thu" } } });
  const ctxB = await ctxFor(S, { width: 1280, height: 800 });
  const pb = await ctxB.newPage(); watch(pb);
  await pb.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await ready(pb);
  await eventually("tài khoản nói 'thu' → máy mới cũng thu", async () => (await attr(pb)) === "thu" && !(await rail(pb, RAIL.student).isVisible()));
  check("và nhớ vào localStorage của máy mới", (await stored(pb)) === "thu");
  await prisma.user.update({ where: { id: S.id }, data: { preferences: { rail: "mo" } } });
  await pb.reload({ waitUntil: "networkidle" });
  await eventually("tài khoản đổi sang 'mo' → lần tải sau máy đó mở lại (tài khoản là nguồn đúng)", async () => (await attr(pb)) !== "thu" && await rail(pb, RAIL.student).isVisible());
  await ctxB.close();

  // ───────────────────────────── Điện thoại
  section("Điện thoại 390px: thanh dưới LUÔN HIỆN, không có nút thu/mở (kể cả khi đã lưu 'thu')");
  await prisma.user.update({ where: { id: S.id }, data: { preferences: { rail: "thu" } } });
  const ctxM = await ctxFor(S, { width: 390, height: 844 });
  const pm = await ctxM.newPage(); watch(pm);
  await pm.addInitScript(`localStorage.setItem("kin.thanh-ben", "thu")`);
  await pm.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await ready(pm);
  check("<html> có data-kin-rail=thu nhưng thanh DƯỚI vẫn hiện, đủ 4 tab theo Figma 299:116497 (Việc của tôi, Lịch học, Lớp của tôi, Bài tập; 'Khác' chỉ có ở máy tính, điện thoại vào qua menu tài khoản 'Tất cả mục')", (await attr(pm)) === "thu" && await rail(pm, RAIL.student).isVisible() && await rail(pm, RAIL.student).getByRole("link").count() === 4 && await rail(pm, RAIL.student).getByRole("button", { name: /^Khác/ }).count() === 0);
  check("không có nút 'Thu gọn' / 'Mở thanh bên' trên điện thoại", !(await closeBtn(pm).isVisible()) && !(await openBtn(pm).isVisible()));
  check("không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await ctxM.close();
  await prisma.user.update({ where: { id: S.id }, data: { preferences: {} } });

  // ───────────────────────────── Thanh bên không biến mất ở trang khách khi đã đăng nhập
  section("Học viên bấm 'Thư viện' → thanh bên Ở LẠI (trước đây biến mất, đổi sang Navbar + Footer của khách)");
  const ctx2 = await ctxFor(S, { width: 1280, height: 800 });
  const ps = await ctx2.newPage(); watch(ps);
  await ps.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await ready(ps);
  // Figma 299:114360: thanh học sinh không còn mục Thư viện (nằm trong 'Khác'), nên vào thẳng đường dẫn.
  await ps.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await ps.waitForURL(/\/thu-vien/, { timeout: 60000 });
  await ps.getByRole("heading", { name: "Thư viện", exact: true }).waitFor({ timeout: 60000 });
  check("sang /thu-vien: thanh bên học viên vẫn hiện, 'Khác' đang chọn (Thư viện thuộc nhóm Khác)", await rail(ps, RAIL.student).isVisible() && await rail(ps, RAIL.student).getByRole("button", { name: /^Khác/ }).isVisible());
  check("không còn thanh trên của khách (Navbar) và chân trang của khách", await ps.getByRole("navigation", { name: "Điều hướng chính" }).count() === 0 && await ps.getByRole("contentinfo").count() === 0);
  check("nội dung trang vẫn đủ: có tài liệu công khai", await ps.getByText("TAI-LIEU-CONG-KHAI").isVisible());
  check("có dải trên của vỏ (logo KiN + chuông)", await ps.getByRole("button", { name: "Thông báo" }).isVisible());
  await shot(ps, "sidebar-2-thu-vien");
  for (const path of ["/khoa-hoc", "/giang-vien", "/diem-chuan", "/tin-tuc", "/ban-do"]) {
    await ps.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await rail(ps, RAIL.student).waitFor({ timeout: 60000 });
    check(`${path}: học viên đã đăng nhập thấy thanh bên, không thấy Navbar khách`, await rail(ps, RAIL.student).isVisible() && await ps.getByRole("navigation", { name: "Điều hướng chính" }).count() === 0);
  }
  await ps.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(ps, RAIL.student).waitFor({ timeout: 60000 });
  check("tải cứng /thu-vien (gõ thẳng địa chỉ) cũng ra thanh bên sau khi nhận ra người dùng", await rail(ps, RAIL.student).isVisible());
  await closeBtn(ps).click();
  await eventually("thu thanh ở trang khách cũng chạy, nút mở nằm ở dải trên", async () => (await attr(ps)) === "thu" && await openBtn(ps).isVisible());
  await openBtn(ps).click();
  await ctx2.close();

  section("Trang đăng nhập / đăng ký thì KHÔNG có thanh bên dù đã đăng nhập; phòng thi không có vỏ");
  const ctx3 = await ctxFor(S, { width: 1280, height: 800 });
  const pa = await ctx3.newPage(); watch(pa);
  await pa.goto(`${BASE}/quen-mat-khau`, { waitUntil: "networkidle", timeout: 120000 });
  check("/quen-mat-khau (mở từ thư): không thanh bên dù đã đăng nhập — trang xác thực không có vỏ", await rail(pa, RAIL.student).count() === 0 && await pa.getByRole("navigation", { name: "Điều hướng chính" }).isVisible());
  await pa.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 120000 });
  check("/dang-ky: người đã đăng nhập đi thẳng vào dashboard (không thấy trang đăng ký của khách)", /\/student\/viec-cua-toi/.test(pa.url()), pa.url());
  await pa.goto(`${BASE}/student/thi-thu/ex-sb`, { waitUntil: "networkidle", timeout: 120000 });
  await pa.waitForTimeout(1500);
  check("phòng thi: không thanh bên, không nút thu/mở (toàn màn hình, khoá cứng)", await rail(pa, RAIL.student).count() === 0 && !(await openBtn(pa).isVisible()) && !(await closeBtn(pa).isVisible()));
  await ctx3.close();

  section("Khách (chưa đăng nhập) thấy Navbar + Footer như cũ, không có thanh bên");
  const ctxG = await ctxFor(null, { width: 1280, height: 800 });
  const pgst = await ctxG.newPage(); watch(pgst);
  await pgst.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await pgst.getByRole("heading", { name: "Thư viện", exact: true }).waitFor({ timeout: 60000 });
  check("khách: có Navbar 'Điều hướng chính' + chân trang; KHÔNG có thanh bên", await pgst.getByRole("navigation", { name: "Điều hướng chính" }).isVisible() && await pgst.getByRole("contentinfo").count() > 0 && await rail(pgst, RAIL.student).count() === 0 && await rail(pgst, RAIL.tutor).count() === 0);
  await ctxG.close();

  // ───────────────────────────── Gia sư
  section("Gia sư: cùng hành vi trong vỏ gia sư và ở trang khách");
  const ctxT = await ctxFor(T, { width: 1280, height: 800 });
  const pt = await ctxT.newPage(); watch(pt);
  await pt.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pt, RAIL.tutor).waitFor({ timeout: 90000 });
  check("gia sư: thanh bên hiện + nút 'Thu gọn thanh bên'", await rail(pt, RAIL.tutor).isVisible() && await closeBtn(pt).isVisible());
  await closeBtn(pt).click();
  await eventually("thu: ẩn thanh, hiện nút mở", async () => !(await rail(pt, RAIL.tutor).isVisible()) && await openBtn(pt).isVisible() && (await attr(pt)) === "thu");
  await openBtn(pt).click();
  await rail(pt, RAIL.tutor).waitFor({ timeout: 10000 });
  await pt.goto(`${BASE}/thu-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pt, RAIL.tutor).waitFor({ timeout: 60000 });
  check("gia sư mở /thu-vien → vẫn thấy thanh bên của gia sư (Lịch, Học phí…), không có Navbar khách", await rail(pt, RAIL.tutor).getByRole("link", { name: /^Lịch/ }).isVisible() && await pt.getByRole("navigation", { name: "Điều hướng chính" }).count() === 0);
  await pt.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pt, RAIL.tutor).waitFor({ timeout: 60000 });
  check("gia sư mở /khoa-hoc → vẫn thấy thanh bên", await rail(pt, RAIL.tutor).isVisible());
  await ctxT.close();

  // ───────────────────────────── Quản trị (tên miền riêng)
  section("Quản trị (admin.midnightelite-edu.com): cùng nút thu/mở");
  const ctxA = await ctxFor(SA, { width: 1280, height: 800 });
  const pad = await ctxA.newPage(); watch(pad);
  await pad.goto(`${ADMIN}/admin/kiem-duyet`, { waitUntil: "networkidle", timeout: 120000 });
  await rail(pad, RAIL.admin).waitFor({ timeout: 90000 });
  check("quản trị: thanh bên hiện + nút 'Thu gọn thanh bên'", await rail(pad, RAIL.admin).isVisible() && await closeBtn(pad).isVisible());
  await closeBtn(pad).click();
  await eventually("thu: ẩn thanh, hiện nút mở ở dải trên", async () => !(await rail(pad, RAIL.admin).isVisible()) && await openBtn(pad).isVisible());
  check("các khung Outlook của Kiểm duyệt vẫn vừa khít màn hình (không tràn ngang)", await pad.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await openBtn(pad).click();
  await rail(pad, RAIL.admin).waitFor({ timeout: 10000 });
  await ctxA.close();

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})();
