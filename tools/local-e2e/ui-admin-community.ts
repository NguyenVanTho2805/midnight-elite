import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN, kinSelect, kinSelectOptions } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị");
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" });
  const toan = await mkCourse(T.id, { name: "Toán 9" }), ly = await mkCourse(T.id, { name: "Lý 9" });
  const mk = (content: string, courseId: string | null, authorId = A.id, extra: Record<string, unknown> = {}) => prisma.thread.create({ data: { content, authorId, courseId, category: "hoi-dap", ...extra } });
  const tChung = await mk("BAI_CHUNG: cách học nhanh", null);
  const tToan = await mk("BAI_TOAN: giải phương trình bậc hai", toan.id);
  const tToan2 = await mk("BAI_TOAN_2: hệ phương trình", toan.id, B.id, { isPinned: true });
  const tLy = await mk("BAI_LY: định luật Ôm", ly.id);
  const rep = (threadId: string, reporterId: string, reason: string) => prisma.threadReport.create({ data: { threadId, reporterId, reason } });
  await rep(tChung.id, B.id, "Quảng cáo trong bài chung");
  await rep(tToan.id, B.id, "Nội dung lạc đề lớp Toán");
  await rep(tLy.id, A.id, "Spam lớp Lý");

  await launch();
  const ctx = await ctxFor(SA);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  section("Kiểm duyệt cộng đồng: nhãn lớp");
  await page.goto(`${ADMIN}/admin/cong-dong`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("heading", { name: "Kiểm duyệt cộng đồng" }).waitFor({ timeout: 90000 });
  await page.getByText("BAI_CHUNG: cách học nhanh").waitFor({ timeout: 30000 });
  const card = (t: string) => page.locator("div.rounded-xl", { hasText: t }).filter({ has: page.getByRole("button", { name: /Xoá/ }) }).last();
  check("mặc định: thấy cả 4 bài (chung + hai lớp)", (await page.getByText(/BAI_(CHUNG|TOAN|TOAN_2|LY):/).count()) === 4);
  check("mỗi bài có nhãn: bài chung 'Cộng đồng chung', bài lớp 'Lớp: <tên>'", /Cộng đồng chung/.test(await card("BAI_CHUNG").innerText()) && /Lớp: Toán 9/.test(await card("BAI_TOAN:").innerText()) && /Lớp: Lý 9/.test(await card("BAI_LY").innerText()));
  const sel = page.getByLabel("Lọc theo lớp");
  const optTexts = await kinSelectOptions(sel);
  check("bộ lọc có: Tất cả / Chỉ cộng đồng chung / từng lớp (kể cả lớp chưa có bài)", optTexts.includes("Tất cả (chung + mọi lớp)") && optTexts.includes("Chỉ cộng đồng chung") && optTexts.includes("Toán 9") && optTexts.includes("Lý 9"), optTexts);

  section("Lọc theo lớp (ở máy chủ)");
  await kinSelect(sel, { label: "Toán 9" });
  await eventually("chỉ còn 2 bài của lớp Toán 9", async () => (await page.getByText(/BAI_(CHUNG|TOAN|TOAN_2|LY):/).count()) === 2 && (await page.getByText("BAI_TOAN:").count()) === 1 && (await page.getByText("BAI_TOAN_2:").count()) === 1);
  check("không lẫn bài chung và bài lớp Lý", (await page.getByText("BAI_CHUNG").count()) === 0 && (await page.getByText("BAI_LY").count()) === 0);
  check("bài ghim của lớp vẫn nằm mục 'Bài ghim'", await page.getByRole("heading", { name: /Bài ghim \(1\)/ }).isVisible());
  await kinSelect(sel, "null");
  await eventually("'Chỉ cộng đồng chung' → đúng 1 bài chung", async () => (await page.getByText(/BAI_(CHUNG|TOAN|TOAN_2|LY):/).count()) === 1 && (await page.getByText("BAI_CHUNG").count()) === 1);
  await kinSelect(sel, { label: "Lý 9" });
  await eventually("lớp Lý 9 → 1 bài", async () => (await page.getByText("BAI_LY").count()) === 1 && (await page.getByText(/BAI_(CHUNG|TOAN)/).count()) === 0);
  await kinSelect(sel, "all");
  await eventually("quay về Tất cả → đủ 4 bài", async () => (await page.getByText(/BAI_(CHUNG|TOAN|TOAN_2|LY):/).count()) === 4);
  await kinSelect(sel, { label: "Toán 9" });
  await page.getByPlaceholder(/Tìm nội dung/).fill("bậc hai");
  await eventually("lọc lớp kết hợp tìm chữ + chuyên mục", async () => (await page.getByText(/BAI_(CHUNG|TOAN|TOAN_2|LY):/).count()) === 1 && (await page.getByText("BAI_TOAN:").count()) === 1);
  await page.getByPlaceholder(/Tìm nội dung/).fill("");
  await kinSelect(sel, "all");
  await shot(page, "admin-community-scope");

  // BU-08: trang /admin/cong-dong/bao-cao (nhãn lớp + BỘ LỌC theo lớp) được thay bằng hàng chờ một cửa; báo cáo BÀI VIẾT là loại ?loai=bai-viet (đường cũ → 308 ?loai=tra-loi).
  // Bộ lọc theo lớp của trang cũ không còn (đặc tả BU-08 mục 5.4); nhãn lớp nằm ở cột "nơi" của dòng, lý do báo cáo nằm trong panel bên.
  section("Báo cáo bài viết: hàng chờ một cửa (BU-08)");
  const rp = await ctx.newPage();
  rp.on("pageerror", e => errors.push(String(e)));
  await rp.goto(`${ADMIN}/admin/kiem-duyet?loai=bai-viet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await rp.locator("[data-queue-table]").waitFor({ timeout: 120000 });
  const rrows = rp.locator("[data-queue-table] tbody tr");
  await rrows.filter({ hasText: "BAI_CHUNG" }).first().waitFor({ timeout: 60000 });
  check("3 báo cáo bài viết; mỗi dòng có nhãn lớp / 'Cộng đồng chung'", (await rrows.count()) === 3 && /Cộng đồng chung/.test(await rrows.filter({ hasText: "BAI_CHUNG" }).innerText()) && /Toán 9/.test(await rrows.filter({ hasText: "BAI_TOAN" }).innerText()) && /Lý 9/.test(await rrows.filter({ hasText: "BAI_LY" }).innerText()));
  const rpanel = rp.locator("aside[data-side-panel]");
  await rrows.filter({ hasText: "BAI_TOAN" }).locator("[data-row-open]").click();
  await rpanel.waitFor({ timeout: 30000 });
  const ptxt = await rpanel.innerText();
  check("panel hiện lý do báo cáo, nội dung bài và lớp", ptxt.includes("Nội dung lạc đề lớp Toán") && ptxt.includes("BAI_TOAN") && ptxt.includes("Toán 9"), ptxt.slice(0, 200));
  await rpanel.getByRole("button", { name: "Giữ bài lại" }).click(); // báo cáo bị bác (decision rejected): bài ở lại, báo cáo không còn chờ
  await eventually("xử lý báo cáo → hàng chờ còn 2 dòng", async () => (await rrows.count()) === 2, 30000);
  check("DB: báo cáo Toán 9 đã xử lý, hai báo cáo kia còn chờ", (await prisma.threadReport.count({ where: { status: "pending" } })) === 2);
  check("bài bị báo cáo vẫn còn (Giữ bài lại không gỡ)", !!(await prisma.thread.findUnique({ where: { id: tToan.id } })) && !(await prisma.thread.findUnique({ where: { id: tToan.id }, select: { deletedAt: true } }))?.deletedAt);

  section("Gia sư vẫn chỉ thấy báo cáo của lớp mình (không đổi quyền)");
  const T2 = await mkTutor("Thầy Khác");
  const other = await mkCourse(T2.id, { name: "Hoá 9" });
  const tHoa = await mk("BAI_HOA: axit", other.id);
  await rep(tHoa.id, B.id, "Báo cáo lớp Hoá");
  const r1 = await api("GET", "/api/admin/thread-reports", { as: T });
  check("Cô Lan thấy báo cáo lớp Lý của mình, không thấy lớp Hoá của thầy khác", r1.json.some((r: any) => r.thread.course?.name === "Lý 9") && !r1.json.some((r: any) => r.thread.course?.name === "Hoá 9"), r1.json?.map((r: any) => r.thread.course?.name));

  section("Điện thoại 390px");
  const mp = await (await ctxFor(SA, { width: 390, height: 800 })).newPage();
  await mp.goto(`${ADMIN}/admin/kiem-duyet?loai=bai-viet`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mp.locator("[data-queue-cards], [data-queue-table]").first().waitFor({ timeout: 90000 });
  check("báo cáo: không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const mp2 = await (await ctxFor(SA, { width: 390, height: 800 })).newPage();
  await mp2.goto(`${ADMIN}/admin/cong-dong`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mp2.getByRole("heading", { name: "Kiểm duyệt cộng đồng" }).waitFor({ timeout: 60000 });
  check("kiểm duyệt: không tràn ngang", await mp2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
