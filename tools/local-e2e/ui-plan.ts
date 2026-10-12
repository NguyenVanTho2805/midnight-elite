import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop"] } } });
  const toan = await mkCourse(T.id, { name: "Toán 9" }), ly = await mkCourse(T.id, { name: "Lý 9" });

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  page.on("dialog", d => void d.accept());

  section("Danh sách và tạo kế hoạch");
  await page.goto(`${BASE}/lop-cua-toi/ke-hoach-buoi?courseId=${ly.id}&date=2026-09-24`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Kế hoạch buổi" }).waitFor({ timeout: 90000 });
  check("giải thích hai bản: bản gia sư và phiếu học sinh (không đáp án)", await page.getByText(/bản gia sư/).first().isVisible() && await page.getByText(/không có đáp án/).isVisible());
  check("mở từ Lịch (?courseId&date): điền sẵn lớp Lý 9 và ngày 24/09", (await page.locator("label", { hasText: /^Lớp/ }).locator("select").inputValue()) === ly.id && (await page.getByLabel(/Ngày dạy/).inputValue()) === "2026-09-24");
  check("chưa có kế hoạch: thông báo rỗng", await page.getByText("Chưa có kế hoạch nào.").isVisible());
  await page.locator("label", { hasText: /^Lớp/ }).locator("select").selectOption(toan.id);
  await page.getByLabel(/Tên buổi/).fill("Hàm số bậc nhất");
  await page.getByRole("button", { name: "Tạo và soạn" }).click();
  await page.waitForURL(/\/lop-cua-toi\/ke-hoach-buoi\/[^/]+$/, { timeout: 30000 });
  await page.getByRole("heading", { name: "Hàm số bậc nhất" }).waitFor({ timeout: 60000 });
  const planId = page.url().split("/").pop()!;

  section("Soạn 4 hoạt động");
  check("đủ 4 hoạt động đúng tên + thứ tự", (await page.getByRole("heading", { level: 2 }).allInnerTexts()).filter(t => /^\d\./.test(t)).join("|") === "1. Mở đầu|2. Hình thành kiến thức|3. Luyện tập|4. Vận dụng");
  check("tiến độ: đã soạn 0/4", await page.getByText(/đã soạn 0\/4 hoạt động/).isVisible());
  check("nút Lưu khoá khi chưa sửa; thanh trạng thái 'Đã lưu'", await page.getByRole("button", { name: "Lưu kế hoạch" }).isDisabled() && await page.getByRole("status").filter({ hasText: "Đã lưu" }).isVisible());
  await page.getByLabel(/Mục tiêu buổi học/).fill("Vẽ được đồ thị y = ax + b");
  await page.getByRole("textbox", { name: "Số phút — Mở đầu", exact: true }).fill("5");
  await page.getByRole("textbox", { name: "Ghi chú của gia sư — Mở đầu", exact: true }).fill("GHI_CHU_MO_DAU_BI_MAT");
  await page.getByRole("textbox", { name: "Số phút — Hình thành kiến thức", exact: true }).fill("20");
  await page.getByRole("textbox", { name: "Ghi chú của gia sư — Hình thành kiến thức", exact: true }).fill("Gợi mở bằng ví dụ taxi");
  await page.getByRole("button", { name: "Thêm câu hỏi — Hình thành kiến thức" }).click();
  await page.getByRole("textbox", { name: "Câu hỏi 1 — Hình thành kiến thức", exact: true }).fill("Khi x tăng 1, y tăng bao nhiêu?");
  await page.getByRole("textbox", { name: "Đáp án câu 1 — Hình thành kiến thức", exact: true }).fill("DAP_AN_BI_MAT_1");
  await page.getByRole("button", { name: "Thêm câu hỏi — Hình thành kiến thức" }).click();
  await page.getByRole("textbox", { name: "Câu hỏi 2 — Hình thành kiến thức", exact: true }).fill("Hệ số a cho biết điều gì?");
  await page.getByRole("textbox", { name: "Sản phẩm — Hình thành kiến thức", exact: true }).fill("Bảng giá trị");
  await page.getByRole("button", { name: "Thêm câu hỏi — Luyện tập" }).click();
  await page.getByRole("textbox", { name: "Câu hỏi 1 — Luyện tập", exact: true }).fill("Vẽ đồ thị y = 2x + 1");
  await page.getByRole("textbox", { name: "Đáp án câu 1 — Luyện tập", exact: true }).fill("DAP_AN_BI_MAT_3");
  await page.getByRole("textbox", { name: "Số phút — Luyện tập", exact: true }).fill("999");
  check("số phút bị kẹp tối đa 180", (await page.getByRole("textbox", { name: "Số phút — Luyện tập", exact: true }).inputValue()) === "180");
  await page.getByRole("textbox", { name: "Số phút — Luyện tập", exact: true }).fill("20");
  await page.getByRole("textbox", { name: "Số phút — Vận dụng", exact: true }).fill("1a5");
  check("chữ không phải số bị bỏ ('1a5' → 15)", (await page.getByRole("textbox", { name: "Số phút — Vận dụng", exact: true }).inputValue()) === "15");
  await page.getByRole("textbox", { name: "Ghi chú của gia sư — Vận dụng", exact: true }).fill("GHI_CHU_VAN_DUNG_BI_MAT");
  check("có thay đổi chưa lưu + nút Lưu mở", await page.getByRole("status").filter({ hasText: "Có thay đổi chưa lưu" }).isVisible() && !(await page.getByRole("button", { name: "Lưu kế hoạch" }).isDisabled()));
  check("tiến độ tính cả hoạt động chỉ có ghi chú: 4/4, tổng 60 phút", await page.getByText(/đã soạn 4\/4 hoạt động · 60 phút/).isVisible());
  await page.getByRole("button", { name: "Lưu kế hoạch" }).click();
  await eventually("lưu thành công → 'Đã lưu'", async () => await page.getByRole("status").filter({ hasText: /^Đã lưu$/ }).isVisible());
  const row = await prisma.sessionPlan.findUnique({ where: { id: planId } });
  check("DB: 2 câu hỏi dẫn đường + đáp án + ghi chú + sản phẩm được lưu", (row?.activities as any[])[1].questions.length === 2 && (row?.activities as any[])[1].questions[0].answer === "DAP_AN_BI_MAT_1" && (row?.activities as any[])[1].product === "Bảng giá trị" && (row?.activities as any[])[0].teacherNotes === "GHI_CHU_MO_DAU_BI_MAT");
  await page.getByRole("button", { name: "Xoá câu hỏi 2 — Hình thành kiến thức" }).click();
  check("xoá câu hỏi 2 → còn 1 ô câu hỏi", (await page.getByRole("textbox", { name: /^Câu hỏi \d — Hình thành kiến thức$/ }).count()) === 1);
  await page.getByRole("button", { name: "Thêm câu hỏi — Hình thành kiến thức" }).click();
  await page.getByRole("textbox", { name: "Câu hỏi 2 — Hình thành kiến thức", exact: true }).fill("Hệ số a cho biết điều gì?");
  await page.getByLabel(/Mục tiêu buổi học/).fill("Vẽ được đồ thị y = ax + b và đọc hệ số"); // thay đổi CHƯA lưu

  section("Bản gia sư: đủ mọi thứ");
  await page.getByRole("tab", { name: "Bản gia sư" }).click();
  const tv = page.getByRole("article", { name: "Bản gia sư" });
  await tv.waitFor();
  const tvText = await tv.innerText();
  check("có mục tiêu, ghi chú gia sư, đáp án, sản phẩm, số phút", tvText.includes("Vẽ được đồ thị y = ax + b") && tvText.includes("GHI_CHU_MO_DAU_BI_MAT") && tvText.includes("Đáp án: DAP_AN_BI_MAT_1") && tvText.includes("Đáp án: DAP_AN_BI_MAT_3") && tvText.includes("Sản phẩm: Bảng giá trị") && tvText.includes("(20 phút)"), tvText);
  check("báo bản xem trước theo nội dung chưa lưu", await page.getByText(/chưa lưu/).first().isVisible());

  section("Phiếu học sinh: KHÔNG đáp án, KHÔNG ghi chú gia sư");
  await page.getByRole("tab", { name: "Phiếu học sinh" }).click();
  const sv = page.getByRole("article", { name: "Phiếu học sinh" });
  await sv.waitFor();
  const svText = await sv.innerText();
  check("không chứa đáp án nào", !/DAP_AN_BI_MAT|Đáp án/.test(svText), svText);
  check("không chứa ghi chú của gia sư (cả hoạt động chỉ có ghi chú)", !/GHI_CHU|taxi|Gia sư:/.test(svText), svText);
  check("có câu hỏi dẫn đường đánh số liên tục 1–3 và sản phẩm của em", /1\. Khi x tăng 1/.test(svText) && /2\. Hệ số a cho biết/.test(svText) && /3\. Vẽ đồ thị y = 2x \+ 1/.test(svText) && svText.includes("Sản phẩm của em: Bảng giá trị") && svText.includes("Hôm nay mình học để: Vẽ được đồ thị"));
  check("không lộ số phút; hoạt động chỉ có ghi chú (Mở đầu, Vận dụng) không hiện", !/phút/.test(svText) && !svText.includes("Mở đầu") && !svText.includes("Vận dụng"));
  await page.getByRole("button", { name: "Sao chép dạng chữ" }).click();
  await eventually("sao chép phiếu dạng chữ: cũng không đáp án / ghi chú", async () => { const c = await page.evaluate(() => navigator.clipboard.readText()).catch(() => ""); return c.startsWith("PHIẾU HỌC SINH — Hàm số bậc nhất") && !/DAP_AN|GHI_CHU/.test(c); });
  await page.getByRole("tab", { name: "Bản gia sư" }).click();
  await page.getByRole("button", { name: "Sao chép dạng chữ" }).click();
  await eventually("sao chép bản gia sư có đáp án", async () => (await page.evaluate(() => navigator.clipboard.readText()).catch(() => "")).includes("Đáp án: DAP_AN_BI_MAT_1"));

  section("In: chỉ phần phiếu, không thanh điều hướng");
  await page.getByRole("tab", { name: "Phiếu học sinh" }).click();
  await page.emulateMedia({ media: "print" });
  const vis = await page.evaluate(`(() => {
    var v = function (el) { return !!el && getComputedStyle(el).visibility !== "hidden"; };
    return { sheet: v(document.querySelector(".kin-print h2")), nav: v(document.querySelector("nav")), heading: v(document.querySelector("h1")) };
  })()`) as { sheet: boolean; nav: boolean; heading: boolean };
  check("khi in: phiếu hiện, thanh điều hướng và tiêu đề trang ẩn", vis.sheet && !vis.nav && !vis.heading, vis);
  await page.emulateMedia({ media: "screen" });

  section("Lưu rồi mở lại");
  await page.getByRole("tab", { name: "Soạn" }).click();
  await page.getByRole("button", { name: "Lưu kế hoạch" }).click();
  await eventually("đã lưu bản sửa", async () => (await prisma.sessionPlan.findUnique({ where: { id: planId } }))?.activities && ((await prisma.sessionPlan.findUnique({ where: { id: planId } }))!.activities as any[])[1].questions[1].q === "Hệ số a cho biết điều gì?");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Hàm số bậc nhất" }).waitFor({ timeout: 60000 });
  check("mở lại: nội dung còn nguyên", (await page.getByRole("textbox", { name: "Câu hỏi 1 — Hình thành kiến thức", exact: true }).inputValue()) === "Khi x tăng 1, y tăng bao nhiêu?" && (await page.getByRole("textbox", { name: "Đáp án câu 1 — Luyện tập", exact: true }).inputValue()) === "DAP_AN_BI_MAT_3");

  section("Hai tab cùng sửa");
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/lop-cua-toi/ke-hoach-buoi/${planId}`, { waitUntil: "networkidle", timeout: 120000 });
  await p2.getByLabel(/Mục tiêu buổi học/).waitFor({ timeout: 60000 });
  await p2.getByLabel(/Mục tiêu buổi học/).fill("Bản sửa ở tab 2");
  await p2.getByRole("button", { name: "Lưu kế hoạch" }).click();
  await eventually("tab 2 lưu được", async () => (await prisma.sessionPlan.findUnique({ where: { id: planId } }))?.goal === "Bản sửa ở tab 2");
  await page.getByLabel(/Mục tiêu buổi học/).fill("Bản sửa ở tab 1 (cũ)");
  await page.getByRole("button", { name: "Lưu kế hoạch" }).click();
  await page.getByRole("alert").filter({ hasText: "vừa được sửa ở nơi khác" }).waitFor({ timeout: 15000 });
  check("tab 1 (mốc cũ) bị báo xung đột, KHÔNG ghi đè", (await prisma.sessionPlan.findUnique({ where: { id: planId } }))?.goal === "Bản sửa ở tab 2");
  await page.getByRole("button", { name: "Tải lại" }).click();
  await eventually("tải lại → thấy bản của tab 2", async () => (await page.getByLabel(/Mục tiêu buổi học/).inputValue()) === "Bản sửa ở tab 2");

  section("Danh sách sau khi soạn + lối tắt");
  await page.goto(`${BASE}/lop-cua-toi/ke-hoach-buoi`, { waitUntil: "networkidle" });
  const li = page.getByRole("link", { name: /Hàm số bậc nhất/ });
  await li.waitFor({ timeout: 60000 });
  check("danh sách: lớp, 'đã soạn 4/4 hoạt động', 60 phút", /Toán 9/.test(await li.innerText()) && /đã soạn 4\/4 hoạt động/.test(await li.innerText()) && /60 phút/.test(await li.innerText()), await li.innerText());
  await page.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: /Lối tắt/ }).getByRole("link", { name: "Kế hoạch buổi" }).waitFor({ timeout: 60000 });
  check("Tổng quan có lối tắt 'Kế hoạch buổi'", true);

  section("Xoá + học sinh không vào được");
  await page.goto(`${BASE}/lop-cua-toi/ke-hoach-buoi/${planId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Xoá kế hoạch" }).click();
  await page.waitForURL(/\/lop-cua-toi\/ke-hoach-buoi$/, { timeout: 30000 });
  check("xoá → về danh sách, kế hoạch mất", (await prisma.sessionPlan.count({ where: { id: planId } })) === 0);
  const S = await mkUser({ name: "Học sinh" });
  const sp = await (await ctxFor(S)).newPage();
  await sp.goto(`${BASE}/lop-cua-toi/ke-hoach-buoi`, { waitUntil: "networkidle", timeout: 90000 });
  check("học sinh bị chuyển đi khỏi trang kế hoạch", !sp.url().includes("/ke-hoach-buoi"), sp.url());
  const lost = await ctx.newPage();
  await lost.goto(`${BASE}/lop-cua-toi/ke-hoach-buoi/${planId}`, { waitUntil: "networkidle" });
  check("mở kế hoạch đã xoá → thông báo, không treo", await lost.getByRole("alert").filter({ hasText: /Không mở được kế hoạch này/ }).isVisible());

  section("Lịch → soạn kế hoạch buổi (liên kết)");
  await prisma.classSchedule.create({ data: { courseId: toan.id, dayOfWeek: (new Date(Date.now() + 86400_000 + 7 * 3600_000)).getUTCDay(), startTime: "19:00", endTime: "20:30", active: true } });
  const lp = await ctx.newPage();
  await lp.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await lp.getByRole("button", { name: /Toán 9/ }).first().click();
  const lk = lp.getByRole("link", { name: "Soạn kế hoạch buổi này" });
  await lk.waitFor({ timeout: 30000 });
  check("liên kết mang đúng lớp + ngày của buổi", /\/lop-cua-toi\/ke-hoach-buoi\?courseId=.+&date=\d{4}-\d{2}-\d{2}$/.test((await lk.getAttribute("href")) ?? ""), await lk.getAttribute("href"));

  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 800 });
  const m1 = await mctx.newPage();
  await m1.goto(`${BASE}/lop-cua-toi/ke-hoach-buoi`, { waitUntil: "networkidle", timeout: 120000 });
  await m1.getByRole("button", { name: "Tạo và soạn" }).click();
  await m1.waitForURL(/\/ke-hoach-buoi\/[^/]+$/, { timeout: 30000 });
  await m1.getByRole("tab", { name: "Soạn" }).waitFor({ timeout: 60000 });
  check("trình soạn không tràn ngang", await m1.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const tb = await m1.getByRole("button", { name: "Lưu kế hoạch" }).boundingBox();
  check("nút Lưu cao ≥ 44px, nằm trong màn hình", !!tb && tb.height >= 44 && tb.x >= 0 && tb.x + tb.width <= 390, tb);
  await shot(m1, "plan-mobile");
  await m1.getByRole("tab", { name: "Phiếu học sinh" }).click();
  check("phiếu học sinh không tràn ngang", await m1.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
