// Ba màn "Lớp" của gia sư (Figma 299:112349 / 299:112581 / 299:112849): bảng lớp + lọc, chi tiết lớp (tab, điểm danh nhúng, mã mời), tạo lớp một trang. 1280 và 390px.
import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { BASE } from "./h";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T3 = await mkTutor("Cô Mới");
  const A = await mkUser({ name: "Em An" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T.id, { name: "Toán 8" });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: c1.id, status: "active" } });
  await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: 5, startTime: "19:00", endTime: "20:30" } });
  await launch();

  section("Bảng lớp (1280)");
  const ctx = await ctxFor(T, { width: 1280, height: 900 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Lớp học", level: 1 }).waitFor({ timeout: 90000 });
  await p.getByRole("list", { name: "Danh sách lớp" }).waitFor({ timeout: 60000 });
  const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
  // LOI-02: "Chưa xếp lịch" chỉ hiện khi cờ lịch bật (NEXT_PUBLIC_KIN_MO_LICH=1); lớp CÓ lịch thì luôn hiện.
  const lichOn = process.env.NEXT_PUBLIC_KIN_MO_LICH === "1";
  check(`hiện lịch cố định thật 'T6 · 19:00–20:30'; 'Chưa xếp lịch' ${lichOn ? "có" : "KHÔNG có (cờ lịch tắt)"} ở lớp chưa có khung`, (await body()).includes("T6 · 19:00–20:30") && (await body()).includes("Chưa xếp lịch") === lichOn);
  check("không có cột 'Cách tính phí' (chưa có dữ liệu)", !(await body()).includes("Cách tính phí"));
  check("lớp chưa có học sinh có lối 'Mời học sinh' + khối nhắc tên lớp đó", (await p.getByRole("link", { name: /Mời học sinh/ }).count()) >= 1 && (await body()).includes("Toán 8 chưa có học sinh"));
  await p.getByLabel("Tìm lớp").fill("toán 8");
  check("tìm 'toán 8' chỉ còn 1/2 lớp", (await body()).includes("Hiển thị 1/2 lớp"));
  await p.getByLabel("Tìm lớp").fill("zzz");
  check("không khớp → trạng thái rỗng có 'Xoá bộ lọc'", await p.getByRole("button", { name: "Xoá bộ lọc" }).isVisible());
  await p.getByRole("button", { name: "Xoá bộ lọc" }).click();
  await p.getByRole("link", { name: "Mở lớp Toán 9" }).click();
  await p.waitForURL(u => u.pathname === `/lop-cua-toi/quan-lop/${c1.id}` && u.search === "", { timeout: 90000 }); // LOI-02: mở lớp vào tab Bài học (gốc lớp)

  section("Chi tiết lớp");
  await p.getByRole("heading", { name: "Toán 9", level: 1 }).waitFor({ timeout: 90000 });
  // GS-LOP-GON → LOI-02: đầu lớp một lần + MỘT dải 4 tab (điều hướng, không role=tab); Mã mời là mục con của Học sinh (?muc=ma-moi).
  check("dòng phụ: 1 học sinh", (await body()).includes("1 học sinh"));
  const strip = p.getByRole("navigation", { name: /^Trang của/ });
  check("dải tab: Bài học · Học sinh · Điểm danh · Cài đặt; Bài học sáng", (await strip.getByRole("link").allInnerTexts()).join("|") === "Bài học|Học sinh|Điểm danh|Cài đặt" && (await strip.locator("[aria-current=page]").innerText()) === "Bài học");
  await strip.getByRole("link", { name: "Điểm danh", exact: true }).click();
  await p.waitForURL(/\/quan-lop\/[^/]+\/diem-danh/, { timeout: 90000 });
  await p.getByRole("button", { name: "Tạo buổi điểm danh" }).waitFor({ timeout: 90000 });
  check("tab Điểm danh: ô 'Buổi đang xem' + 'Tạo buổi điểm danh'", await p.getByLabel("Buổi đang xem").isVisible() && await p.getByRole("button", { name: "Tạo buổi điểm danh" }).isVisible());
  await p.getByRole("navigation", { name: /^Trang của/ }).getByRole("link", { name: "Học sinh", exact: true }).click();
  await p.waitForURL(/\/quan-lop\/[^/]+\/hoc-vien/, { timeout: 90000 });
  await p.getByRole("navigation", { name: "Mục của Học sinh" }).getByRole("link", { name: "Mã mời", exact: true }).click();
  await p.waitForURL(/muc=ma-moi/, { timeout: 90000 });
  await p.getByText("Tạo mã mời mới").waitFor({ timeout: 60000 });
  check("mục 'Mã mời' (trong Học sinh) mở được mã mời", (await p.getByRole("navigation", { name: "Mục của Học sinh" }).locator("[aria-current=page]").innerText()).trim() === "Mã mời");

  section("A4c: 320px giữ lối mời (mục Mã mời của Học sinh còn bấm được)");
  const n320 = await (await ctxFor(T, { width: 320, height: 640 })).newPage();
  await n320.goto(`${BASE}/lop-cua-toi/quan-lop/${c1.id}/hoc-vien`, { waitUntil: "networkidle", timeout: 120000 });
  const inv = n320.getByRole("navigation", { name: "Mục của Học sinh" }).getByRole("link", { name: "Mã mời", exact: true });
  await inv.waitFor({ timeout: 90000 });
  check("320px: không tràn ngang; mục 'Mã mời' còn, cao ≥ 44px", (await n320.evaluate("document.documentElement.scrollWidth")) <= 320 && await inv.isVisible() && ((await inv.boundingBox())?.height ?? 0) >= 44);
  await inv.click();
  await n320.waitForURL(/muc=ma-moi/, { timeout: 90000 });
  check("320px: 'Mã mời' mở mục Mã mời", (await n320.getByRole("navigation", { name: "Mục của Học sinh" }).locator("[aria-current=page]").innerText()).trim() === "Mã mời");
  section("Tạo lớp (một trang)");
  const ctx3 = await ctxFor(T3, { width: 1280, height: 900 });
  const q = await ctx3.newPage();
  await q.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "networkidle", timeout: 120000 });
  await q.getByText("Cô chưa mở lớp nào").waitFor({ timeout: 90000 });
  check("gia sư chưa có lớp: rỗng có giải thích + 'Tạo lớp đầu tiên' + nút 'Tạo lớp'", await q.getByRole("link", { name: "Tạo lớp đầu tiên" }).isVisible() && await q.getByRole("link", { name: "Tạo lớp", exact: true }).isVisible());
  await q.getByRole("link", { name: "Tạo lớp", exact: true }).click();
  await q.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  // 24/10 (LO-03): trang tạo lớp là wizard 3 bước (BU-01: Thông tin → Lịch học → Cách vào lớp); nút cuối "Tạo lớp + N buổi". Cập nhật theo bước, không bỏ ca nào.
  await q.getByRole("button", { name: "Tiếp tục" }).click();
  check("bỏ trống tên → lỗi, không tạo lớp, còn ở bước 1", await q.locator("p[role=alert]").isVisible() || await q.getByLabel(/Tên lớp/).evaluate((e: HTMLInputElement) => !e.validity.valid));
  await q.getByLabel(/Tên lớp/).fill("Toán 9 thử");
  await q.getByLabel(/^Đơn giá/).fill("120000"); // học phí theo buổi (mặc định) bắt buộc có đơn giá
  await q.getByRole("button", { name: "Tiếp tục" }).click();   // BU-01: bước 2 = Lịch học
  await q.getByRole("button", { name: "Thêm khung giờ" }).click();
  // TUT-lich-keo-tha: khung giờ đặt bằng panel của lưới (mặc định 19:00–20:30 là giờ do cô chọn ở đây).
  await q.locator("[data-block-panel] select").first().selectOption("2");
  await q.locator("#sched-s").selectOption("1140"); await q.locator("#sched-e").selectOption("1230");
  await q.getByRole("button", { name: "Lưu khung giờ" }).click();
  await q.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 10000 });
  await q.getByRole("button", { name: "Tiếp tục" }).click();   // BU-01: bước 3 = Cách vào lớp (mặc định Cô duyệt)
  await q.getByRole("button", { name: /^Tạo lớp \+ \d+ buổi$/ }).click();
  await q.waitForURL(/\/lop-cua-toi\/quan-lop\/toan-9-thu/, { timeout: 90000 });
  const made = await prisma.course.findFirstOrThrow({ where: { name: "Toán 9 thử", ownerId: T3.id } });
  check("DB: lớp thuộc gia sư, giá 0", made.ownerId === T3.id && made.price === 0);
  await eventually("DB: khung giờ T3 19:00–20:30", async () => (await prisma.classSchedule.count({ where: { courseId: made.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30" } })) === 1);
  await q.getByRole("navigation", { name: "Mục của Học sinh" }).waitFor({ timeout: 90000 });
  check("tới trang lớp, mục Mã mời (trong tab Học sinh) mở sẵn", /muc=ma-moi/.test(q.url()) && (await q.getByRole("navigation", { name: "Mục của Học sinh" }).locator("[aria-current=page]").innerText()).trim() === "Mã mời");

  section("Điện thoại 390px");
  const m = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  for (const path of ["/lop-cua-toi/lop", `/lop-cua-toi/quan-lop/${c1.id}`, "/lop-cua-toi/lop/tao"]) {
    await m.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await m.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 90000 });
    check(`${path}: không tràn ngang`, (await m.evaluate("document.documentElement.scrollWidth")) <= 390);
  }
  await closeAll();
  void c2;
  await done();
})().catch(e => { console.error("TEST CRASH", e.message); process.exit(1); });
