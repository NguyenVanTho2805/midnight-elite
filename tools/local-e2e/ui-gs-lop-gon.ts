// GS-LOP-GON (09/11/2026) — "Lớp gọn của gia sư" chạy thật bằng trình duyệt ở 1280 và 390: thư viện lớp dạng thẻ, mở lớp vào Giáo trình, MỘT dải tab 6 mục,
// mục con ?muc= trong Học sinh / Cài đặt, không h1 / dải tab / breadcrumb quản trị trùng, ngăn kéo "Thêm bài học" có khung thả tệp (đọc cờ /api/media/config),
// "Kế hoạch buổi" đã rời thanh bên và bảng Khác. Mọi chuyển trang dùng waitForURL; thanh bên chỉ MỘT mục aria-current=page.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const RAIL = "Module của gia sư";
const TABS = ["Giáo trình", "Học sinh", "Điểm danh", "Bài tập", "Lịch học", "Cài đặt"];

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const S1 = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), P = await mkUser({ name: "Em Chờ" });
  const c1 = await mkCourse(T.id, { name: "Toán 9 — Ôn thi vào lớp 10 chuyên (nhóm sáng thứ bảy)" });
  const c2 = await mkCourse(T.id, { name: "Lý 10", classStatus: "paused" });
  const c3 = await mkCourse(T2.id, { name: "Lớp Của Thầy Khác" });
  await prisma.course.update({ where: { id: c1.id }, data: { joinPolicy: "approve", bg: "url(https://res.cloudinary.com/demo/image/upload/sample.jpg) center/cover no-repeat" } });
  for (const u of [S1, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: c1.id, status: "active" } });
  // Em chờ phụ huynh đồng ý: có trong danh bạ nhưng /api/tutor/hoc-sinh/<id> trả 403 → KHÔNG được có liên kết "Hồ sơ" (10/11/2026, lỗi tìm ra ở ui-tutor-everything).
  const W = await mkUser({ name: "Em Chờ Đồng Ý" });
  await prisma.enrollment.create({ data: { userId: W.id, courseId: c1.id, status: "pending_consent" } });
  await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: 6, startTime: "19:00", endTime: "20:30" } });
  await prisma.classJoinRequest.create({ data: { courseId: c1.id, userId: P.id, status: "pending" } });
  const sec = await prisma.section.create({ data: { id: `sec-${Date.now()}`, title: "Chương 1", order: 1, courseId: c1.id } });
  const chap = await prisma.chapter.create({ data: { id: `chap-${Date.now()}`, title: "Bài 1", order: 1, sectionId: sec.id } });
  await prisma.lesson.create({ data: { id: `les-${Date.now()}`, code: "L1", title: "Bài giảng 1", type: "record", order: 1, chapterId: chap.id, isLocked: false, isFree: true } as never });

  await launch();
  const errors: string[] = [];
  const devPerf = /negative time stamp/i;
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => { if (!devPerf.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 40|hydrat/i.test(m.text())) errors.push(m.text()); });
  };

  for (const [W, H, tag] of [[1280, 900, "1280"], [390, 844, "390"]] as const) {
    section(`Thư viện lớp · ${tag}px`);
    const ctx = await ctxFor(T, { width: W, height: H, rail: "mac-dinh" });
    const pg = await ctx.newPage(); watch(pg);
    const noOverflow = async (what: string) => check(`${tag}: ${what} — không tràn ngang`, !(await pg.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)));
    const railCurrent = () => pg.locator(`nav[aria-label="${RAIL}"] [aria-current=page]:visible`).count();
    const oneH1 = async (what: string) => check(`${tag}: ${what} — đúng MỘT h1 hiện`, (await pg.locator("h1:visible").count()) === 1, await pg.locator("h1:visible").allInnerTexts());
    const oneStrip = async (what: string) => check(`${tag}: ${what} — đúng MỘT dải tab "Trang của…"`, (await pg.locator('nav[aria-label^="Trang của"]:visible').count()) === 1);
    const base = `/lop-cua-toi/quan-lop/${c1.id}`;

    await pg.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.locator("[data-lop-the]").first().waitFor({ timeout: 120000 });
    check(`${tag}: 2 thẻ lớp của cô (không thấy lớp của người khác)`, (await pg.locator("[data-lop-the]").count()) === 2 && !(await pg.getByText("Lớp Của Thầy Khác").count()));
    check(`${tag}: thư viện là thẻ, không còn bảng`, (await pg.locator("table:visible").count()) === 0);
    const wide = W >= 1000;
    const cols = await pg.evaluate(`new Set([...document.querySelectorAll("[data-lop-the]")].map(e => Math.round(e.getBoundingClientRect().left))).size`) as number;
    check(`${tag}: ${wide ? "nhiều cột" : "1 cột (đặc tả 6.3)"}`, wide ? cols >= 2 : cols === 1, cols);
    const cardLinks = await pg.locator("[data-lop-the]").first().getByRole("link", { name: /^Mở lớp/ }).count();
    check(`${tag}: mỗi thẻ đúng MỘT liên kết "Mở lớp"`, cardLinks === 1, cardLinks);
    const smallBtn = await pg.evaluate(`[...document.querySelectorAll("[data-lop-the] a, [data-lop-the] button")].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && !/Đặt lịch/.test(e.textContent)).map(e => e.textContent.trim() + ":" + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`${tag}: nút trên thẻ ≥ 44px`, smallBtn.length === 0, smallBtn);
    check(`${tag}: thanh bên MỘT mục sáng ('Lớp')`, (await railCurrent()) === 1 && /^Lớp/.test((await pg.locator(`nav[aria-label="${RAIL}"] [aria-current=page]:visible`).first().innerText()).trim()));
    check(`${tag}: không còn mục "Kế hoạch buổi" ở thanh bên`, (await pg.locator(`nav[aria-label="${RAIL}"]`).getByText("Kế hoạch buổi").count()) === 0);
    await noOverflow("thư viện lớp");
    await shot(pg, `gs-lop-gon-thu-vien-${tag}`);

    section(`Mở lớp → Giáo trình · ${tag}px`);
    await pg.locator("[data-lop-the]", { hasText: "Toán 9" }).getByRole("link", { name: /^Mở lớp/ }).click();
    await pg.waitForURL(new RegExp(`/lop-cua-toi/quan-lop/${c1.id}`), { timeout: 120000 });
    await pg.locator('nav[aria-label^="Trang của"]').first().waitFor({ timeout: 120000 });
    await oneStrip("trang lớp"); await oneH1("trang lớp");
    const strip = pg.locator('nav[aria-label^="Trang của"]:visible');
    check(`${tag}: dải tab đúng 6 mục theo thứ tự`, JSON.stringify((await strip.getByRole("link").allInnerTexts()).map(s => s.trim())) === JSON.stringify(TABS), await strip.getByRole("link").allInnerTexts());
    check(`${tag}: mở lớp rơi vào Giáo trình (aria-current)`, (await strip.locator("[aria-current=page]").innerText()).trim() === "Giáo trình");
    check(`${tag}: h1 là tên lớp; không breadcrumb quản trị, không liên kết /admin`, (await pg.locator("h1:visible").innerText()).includes("Toán 9") && (await pg.locator('main a[href*="/admin"]').count()) === 0 && !(await pg.getByText(/Quản trị|Khoá học|Khóa học ›/).count()));
    check(`${tag}: thanh bên vẫn MỘT mục sáng ('Lớp')`, (await railCurrent()) === 1);
    await noOverflow("Giáo trình");
    await shot(pg, `gs-lop-gon-giao-trinh-${tag}`);

    section(`Sáu tab, mỗi trang một h1 + một dải · ${tag}px`);
    const tabUrl: Record<string, RegExp> = {
      "Học sinh": /\/hoc-vien/, "Điểm danh": /\/diem-danh/, "Bài tập": /tab=chuong-bai/, "Lịch học": /\/lich-hoc/, "Cài đặt": /tab=cai-dat/, "Giáo trình": /\/giao-trinh|quan-lop\/[^/?]+(\?|$)/,
    };
    for (const name of ["Học sinh", "Điểm danh", "Bài tập", "Lịch học", "Cài đặt", "Giáo trình"]) {
      await pg.locator('nav[aria-label^="Trang của"]:visible').getByRole("link", { name, exact: true }).click();
      await pg.waitForURL(tabUrl[name], { timeout: 120000 });
      await pg.waitForFunction(n => [...document.querySelectorAll('nav[aria-label^="Trang của"] [aria-current=page]')].some(e => (e as HTMLElement).innerText.trim() === n), name, { timeout: 120000 });
      await oneStrip(`tab ${name}`); await oneH1(`tab ${name}`);
      check(`${tag}: tab ${name} sáng, thanh bên vẫn MỘT mục sáng`, (await railCurrent()) === 1);
      await noOverflow(`tab ${name}`);
    }

    section(`Học sinh: mục con ?muc= · ${tag}px`);
    await pg.goto(`${BASE}${base}/hoc-vien`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.locator("text=Em An >> visible=true").first().waitFor({ timeout: 120000 });
    const mn = pg.getByRole("navigation", { name: "Mục của Học sinh" });
    check(`${tag}: 4 mục con Danh bạ · Xin vào lớp (1) · Mã mời · Thêm học sinh`, JSON.stringify((await mn.getByRole("link").allInnerTexts()).map(s => s.trim())) === JSON.stringify(["Danh bạ", "Xin vào lớp (1)", "Mã mời", "Thêm học sinh"]), await mn.getByRole("link").allInnerTexts());
    check(`${tag}: danh bạ hiện 2 em + liên kết Hồ sơ`, (await pg.locator("text=Em Bình >> visible=true").count()) > 0 && (await pg.getByRole("link", { name: /Hồ sơ/ }).locator("visible=true").count()) >= 2);
    check(`${tag}: đúng 2 liên kết Hồ sơ (em đang học) — em chờ đồng ý KHÔNG có liên kết, chỉ có nhãn "Chờ đồng ý"`,
      (await pg.locator('a[href*="/hoc-sinh/em/"]:visible').count()) === 2 && (await pg.locator("[data-cho-dong-y]:visible").count()) === 1 && (await pg.getByRole("link", { name: "Hồ sơ của Em Chờ Đồng Ý" }).count()) === 0,
      { links: await pg.locator('a[href*="/hoc-sinh/em/"]:visible').count(), nhan: await pg.locator("[data-cho-dong-y]:visible").count() });
    await shot(pg, `gs-lop-gon-hoc-sinh-${tag}`);
    await mn.getByRole("link", { name: /^Xin vào lớp/ }).click();
    await pg.waitForURL(/muc=xin-vao/, { timeout: 120000 });
    await pg.getByText("Em Chờ").first().waitFor({ timeout: 120000 });
    check(`${tag}: Xin vào lớp hiện em đang chờ`, true);
    await oneStrip("Xin vào lớp"); await oneH1("Xin vào lớp");
    await pg.getByRole("navigation", { name: "Mục của Học sinh" }).getByRole("link", { name: "Mã mời" }).click();
    await pg.waitForURL(/muc=ma-moi/, { timeout: 120000 });
    await pg.getByText("Mã mời vào lớp").first().waitFor({ timeout: 120000 });
    check(`${tag}: Mã mời — đúng một h1, một dải`, (await pg.locator("h1:visible").count()) === 1 && (await pg.locator('nav[aria-label^="Trang của"]:visible').count()) === 1);
    await noOverflow("Học sinh › Mã mời");
    await pg.getByRole("navigation", { name: "Mục của Học sinh" }).getByRole("link", { name: "Thêm học sinh" }).click();
    await pg.waitForURL(/muc=them/, { timeout: 120000 });
    await pg.locator("[data-lop-them]").waitFor({ timeout: 120000 });
    check(`${tag}: Thêm học sinh có nút ≥ 44px`, (await pg.locator("[data-lop-them] button:visible").evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 43.5))));

    section(`Cài đặt: mục con · ${tag}px`);
    await pg.goto(`${BASE}${base}?tab=cai-dat`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.getByText("Thông tin cơ bản").first().waitFor({ timeout: 120000 });
    const cn = pg.locator('nav[aria-label^="Mục của"]:visible');
    check(`${tag}: 5 mục con Thông tin · Học phí · Đồng giảng · Cộng đồng · Bản ghi`, JSON.stringify((await cn.getByRole("link").allInnerTexts()).map(s => s.trim())) === JSON.stringify(["Thông tin", "Học phí", "Đồng giảng", "Cộng đồng", "Bản ghi"]), await cn.getByRole("link").allInnerTexts());
    await cn.getByRole("link", { name: "Học phí" }).click();
    await pg.waitForURL(/muc=hoc-phi/, { timeout: 120000 });
    await pg.getByText("Học phí và đối soát").first().waitFor({ timeout: 120000 });
    check(`${tag}: Học phí chỉ chuyển chỗ hiển thị (nút "Mở Học phí" dẫn sang trang Học phí, không có nút tạo phiếu/thu tiền)`, (await pg.getByRole("link", { name: /Mở Học phí/ }).count()) === 1 && (await pg.getByRole("button", { name: /Tạo phiếu|Thanh toán|Thu tiền/ }).count()) === 0);
    await oneStrip("Cài đặt › Học phí"); await oneH1("Cài đặt › Học phí");
    await noOverflow("Cài đặt › Học phí");

    section(`Bài tập: ngăn kéo "Thêm bài học" · ${tag}px`);
    await pg.goto(`${BASE}${base}?tab=chuong-bai`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.getByText("Bài giảng 1").first().waitFor({ timeout: 120000 });
    check(`${tag}: dòng giải thích "Bài tập" có mặt`, (await pg.locator("[data-bai-tap-dan]").count()) === 1);
    await pg.getByRole("button", { name: /Thêm bài học/ }).first().click();
    await pg.getByRole("heading", { name: "Thêm bài học", level: 2 }).waitFor({ timeout: 30000 });
    await pg.locator("[data-tai-lieu-khung]").first().waitFor({ timeout: 60000 });
    await pg.waitForFunction(() => document.querySelector("[data-tai-lieu-khung]")?.getAttribute("data-tai-lieu-khung") !== "dang-kiem", undefined, { timeout: 60000 });
    const khung = await pg.locator("[data-tai-lieu-khung]").first().getAttribute("data-tai-lieu-khung");
    const cfg = await pg.evaluate(`fetch("/api/media/config", { credentials: "same-origin" }).then(r => r.json())`) as { document?: { enabled?: boolean; reason?: string } };
    check(`${tag}: khung thả phản ánh cờ document.enabled (khung="${khung}")`, cfg.document?.enabled ? khung === "san-sang" : khung === "tat");
    if (!cfg.document?.enabled) {
      const ly = await pg.locator("[data-tai-lieu-ly-do]").innerText();
      check(`${tag}: kho tắt → hiện nguyên văn lý do của máy chủ`, !!cfg.document?.reason ? ly.includes(cfg.document.reason.slice(0, 30)) : ly.length > 5, ly);
    } else {
      check(`${tag}: khung thả có nút "Chọn tệp từ máy" ≥ 44px + dòng nhắc "đăng ngay"`,
        (await pg.getByRole("button", { name: "Chọn tệp từ máy" }).evaluate(e => e.getBoundingClientRect().height >= 43.5)) && (await pg.locator("[data-tai-lieu-nhac]").innerText()).includes("hiện cho học sinh của lớp ngay khi bài được lưu"));
      check(`${tag}: không nhận video (input tệp không có video/*)`, !/\.(mp4|mov|webm|mkv|avi)\b|video\//i.test((await pg.locator('[data-tai-lieu] input[type=file]').first().getAttribute("accept")) ?? ""));
    }
    check(`${tag}: dán link vẫn dùng được`, (await pg.getByPlaceholder(/Dán link|https:\/\//).count()) > 0 || (await pg.getByText(/Dán link/).count()) > 0);
    const tiny = await pg.evaluate(`[...document.querySelectorAll("[data-tai-lieu] button, [data-tai-lieu] label")].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).length`) as number;
    check(`${tag}: nút trong khung tài liệu ≥ 44px`, tiny === 0, tiny);
    await noOverflow("ngăn kéo Thêm bài học");
    await pg.waitForTimeout(700); // ngăn kéo trượt vào 0,28s
    await pg.locator("[data-tai-lieu]").first().scrollIntoViewIfNeeded();
    await pg.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/gs-lop-gon-ngan-keo-${tag}.png` }); // ngăn kéo là khung cố định tự cuộn: chụp khung nhìn, không chụp cả trang
    await pg.getByRole("button", { name: "Đóng", exact: true }).first().click();

    section(`Khác không còn "Kế hoạch buổi" · ${tag}px`);
    await pg.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.locator("[data-lop-the]").first().waitFor({ timeout: 120000 });
    const khac = pg.locator(`nav[aria-label="${RAIL}"]`).getByRole("button", { name: /^Khác/ }).first();
    if (await khac.isVisible().catch(() => false)) {
      await khac.dispatchEvent("click"); // cờ dev "Agentation" (chỉ có ở máy dev) che nút ở 390px nên bấm bằng sự kiện
      await pg.getByRole("dialog").first().waitFor({ timeout: 30000 });
      check(`${tag}: bảng Khác không có "Kế hoạch buổi"`, (await pg.getByRole("dialog").first().getByText("Kế hoạch buổi").count()) === 0);
      await pg.keyboard.press("Escape");
    }
    await ctx.close();
  }

  section("Phân quyền + đường cũ");
  const ctx2 = await ctxFor(T, { width: 1280, height: 800, rail: "mac-dinh" });
  const pg2 = await ctx2.newPage(); watch(pg2);
  await pg2.goto(`${BASE}/lop-cua-toi/quan-lop/${c3.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg2.getByText("Bạn không có quyền với lớp này").first().waitFor({ timeout: 120000 });
  check("lớp của gia sư khác → 'Bạn không có quyền', KHÔNG lộ tên lớp / học sinh", !(await pg2.getByText("Lớp Của Thầy Khác").count()));
  await pg2.goto(`${BASE}/lop-cua-toi/${c1.id}?tab=hoc-vien`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg2.waitForURL(new RegExp(`/lop-cua-toi/quan-lop/${c1.id}`), { timeout: 120000 });
  check("đường cũ /lop-cua-toi/<id>?tab=hoc-vien đưa chủ lớp về trang lớp mới", pg2.url().includes(`/quan-lop/${c1.id}`), pg2.url());
  await ctx2.close();

  section("320px: mọi màn của lớp không tràn ngang");
  const ctx3 = await ctxFor(T, { width: 320, height: 700, rail: "mac-dinh" });
  const pg3 = await ctx3.newPage(); watch(pg3);
  for (const path of ["/lop-cua-toi/lop", `/lop-cua-toi/quan-lop/${c1.id}/giao-trinh`, `/lop-cua-toi/quan-lop/${c1.id}/hoc-vien`, `/lop-cua-toi/quan-lop/${c1.id}/hoc-vien?muc=xin-vao`, `/lop-cua-toi/quan-lop/${c1.id}/hoc-vien?muc=ma-moi`,
    `/lop-cua-toi/quan-lop/${c1.id}/hoc-vien?muc=them`, `/lop-cua-toi/quan-lop/${c1.id}/diem-danh`, `/lop-cua-toi/quan-lop/${c1.id}?tab=chuong-bai`, `/lop-cua-toi/quan-lop/${c1.id}/lich-hoc`,
    `/lop-cua-toi/quan-lop/${c1.id}?tab=cai-dat`, `/lop-cua-toi/quan-lop/${c1.id}?tab=cai-dat&muc=hoc-phi`, `/lop-cua-toi/quan-lop/${c1.id}?tab=cai-dat&muc=dong-giang`, `/lop-cua-toi/quan-lop/${c1.id}?tab=cai-dat&muc=cong-dong`]) {
    await pg3.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg3.locator("h1:visible").first().waitFor({ timeout: 120000 });
    await pg3.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 90000 });
    check(`320px ${path.replace("/lop-cua-toi/", "")}: không tràn ngang`, !(await pg3.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)));
  }
  await ctx3.close();

  check("không lỗi JS / console trong cả hai cỡ màn hình", errors.length === 0, errors.slice(0, 5));
  void c2;
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
