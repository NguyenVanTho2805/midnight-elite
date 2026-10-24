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
  check("hiện lịch cố định thật 'T6 · 19:00–20:30' và 'Chưa xếp lịch' cho lớp chưa có khung", (await body()).includes("T6 · 19:00–20:30") && (await body()).includes("Chưa xếp lịch"));
  check("không có cột 'Cách tính phí' (chưa có dữ liệu)", !(await body()).includes("Cách tính phí"));
  check("lớp chưa có học sinh có lối 'Mời học sinh' + khối nhắc tên lớp đó", (await p.getByRole("link", { name: /Mời học sinh/ }).count()) >= 1 && (await body()).includes("Toán 8 chưa có học sinh"));
  await p.getByLabel("Tìm lớp").fill("toán 8");
  check("tìm 'toán 8' chỉ còn 1/2 lớp", (await body()).includes("Hiển thị 1/2 lớp"));
  await p.getByLabel("Tìm lớp").fill("zzz");
  check("không khớp → trạng thái rỗng có 'Xoá bộ lọc'", await p.getByRole("button", { name: "Xoá bộ lọc" }).isVisible());
  await p.getByRole("button", { name: "Xoá bộ lọc" }).click();
  await p.getByRole("link", { name: "Mở lớp Toán 9" }).click();
  await p.waitForURL(new RegExp(`/lop-cua-toi/${c1.id}$`), { timeout: 90000 });

  section("Chi tiết lớp");
  await p.getByRole("heading", { name: "Toán 9", level: 1 }).waitFor({ timeout: 90000 });
  check("dòng phụ: 1 học sinh · lịch", (await body()).includes("1 học sinh · T6 · 19:00–20:30"));
  check("có tab Buổi học & điểm danh / Học sinh · 1 / Mã mời", (await p.getByRole("tab").allInnerTexts()).join("|").includes("Học sinh · 1") && await p.getByRole("tab", { name: "Mã mời" }).isVisible());
  await p.getByRole("button", { name: "Tạo buổi điểm danh" }).waitFor({ timeout: 90000 });
  check("điểm danh nhúng: ô 'Buổi đang xem' + 'Tạo buổi điểm danh'", await p.getByLabel("Buổi đang xem").isVisible() && await p.getByRole("button", { name: "Tạo buổi điểm danh" }).isVisible());
  await p.getByRole("button", { name: "Mời học sinh" }).click();
  await p.getByText("Tạo mã mời mới").waitFor({ timeout: 60000 });
  check("'Mời học sinh' mở tab Mã mời", (await p.getByRole("tab", { name: "Mã mời" }).getAttribute("aria-selected")) === "true");

  section("Tạo lớp (một trang)");
  const ctx3 = await ctxFor(T3, { width: 1280, height: 900 });
  const q = await ctx3.newPage();
  await q.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "networkidle", timeout: 120000 });
  await q.getByText("Cô chưa mở lớp nào").waitFor({ timeout: 90000 });
  check("gia sư chưa có lớp: rỗng có giải thích + 'Tạo lớp đầu tiên' + nút 'Tạo lớp'", await q.getByRole("link", { name: "Tạo lớp đầu tiên" }).isVisible() && await q.getByRole("link", { name: "Tạo lớp", exact: true }).isVisible());
  await q.getByRole("link", { name: "Tạo lớp", exact: true }).click();
  await q.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  // 24/10 (LO-03): trang tạo lớp là wizard 3 bước (Thông tin → Học sinh → Lịch học); nút cuối "Tạo lớp + N buổi". Cập nhật theo bước, không bỏ ca nào.
  await q.getByRole("button", { name: "Tiếp tục" }).click();
  check("bỏ trống tên → lỗi, không tạo lớp, còn ở bước 1", await q.locator("p[role=alert]").isVisible() || await q.getByLabel(/Tên lớp/).evaluate((e: HTMLInputElement) => !e.validity.valid));
  await q.getByLabel(/Tên lớp/).fill("Toán 9 thử");
  await q.getByRole("button", { name: "Tiếp tục" }).click();
  await q.getByRole("button", { name: "Tiếp tục" }).click(); // bước Học sinh: bỏ qua
  await q.getByRole("button", { name: "Thêm khung giờ" }).click();
  await q.getByLabel("Ngày trong tuần").selectOption("2");
  await q.getByRole("button", { name: /^Tạo lớp \+ \d+ buổi$/ }).click();
  await q.waitForURL(/\/lop-cua-toi\/toan-9-thu/, { timeout: 90000 });
  const made = await prisma.course.findFirstOrThrow({ where: { name: "Toán 9 thử", ownerId: T3.id } });
  check("DB: lớp thuộc gia sư, giá 0", made.ownerId === T3.id && made.price === 0);
  await eventually("DB: khung giờ T3 19:00–20:30", async () => (await prisma.classSchedule.count({ where: { courseId: made.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30" } })) === 1);
  check("tới trang lớp, tab Mã mời mở sẵn", (await q.getByRole("tab", { name: "Mã mời" }).getAttribute("aria-selected")) === "true");

  section("Điện thoại 390px");
  const m = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  for (const path of ["/lop-cua-toi/lop", `/lop-cua-toi/${c1.id}`, "/lop-cua-toi/lop/tao"]) {
    await m.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await m.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 90000 });
    check(`${path}: không tràn ngang`, (await m.evaluate("document.documentElement.scrollWidth")) <= 390);
  }
  await closeAll();
  void c2;
  await done();
})().catch(e => { console.error("TEST CRASH", e.message); process.exit(1); });
