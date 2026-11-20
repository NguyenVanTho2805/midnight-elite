// HP-BO (17/11/2026) — giao diện với cờ mặc định production (HOC_PHI, LICH, HOP_VIEC… đều tắt), trên trình duyệt thật 1280 + 390:
//  - Tạo lớp: không còn khối "Học phí" / "Cách tính học phí", không có ô "Vào ngay"; tạo lớp xong lớp không có đơn giá.
//  - Thanh bên gia sư có "Lịch" (lối tới trang buổi: điểm danh, Đã dạy xong, dời / huỷ); trang buổi không còn chữ về học phí.
//  - Khách mở link mời /student/nhap-ma-lop?code=… → sang đăng nhập GIỮ mã; nút "Tạo tài khoản KiN" mang theo redirect.
// Bỏ qua khi tiến trình chạy bài đặt NEXT_PUBLIC_KIN_MO_HOC_PHI=1 hoặc NEXT_PUBLIC_KIN_MO_LICH=1 (máy chủ dev phải chạy cùng cờ).
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";

(async () => {
  if (process.env.NEXT_PUBLIC_KIN_MO_HOC_PHI === "1" || process.env.NEXT_PUBLIC_KIN_MO_LICH === "1") { console.log("(máy đang bật HOC_PHI/LICH: bỏ qua bài này)"); done(); return; }
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" });
  const C = await mkCourse(T.id, { name: "Lý 10" });
  const past = addDaysKey(vnDateKeyOf(new Date()), -1);
  await prisma.classSchedule.create({ data: { courseId: C.id, dayOfWeek: dayOfWeekOfKey(past), startTime: "19:00", endTime: "20:30" } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  await launch();

  section("Tạo lớp: không hỏi học phí, không 'Vào ngay'");
  const p = await (await ctxFor(T)).newPage();
  await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  check("bước 1 không có 'Học phí' / 'Cách tính học phí' / ô Đơn giá", (await p.getByText(/Cách tính học phí|Có học phí/).count()) === 0 && (await p.locator("#tl-hp, #tl-phi").count()) === 0 && (await p.getByLabel(/Đơn giá/).count()) === 0);
  await shot(p, "hp-tat-tao-lop-b1-1280");
  await p.getByLabel(/Tên lớp/).fill("Hoá 11 thử");
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await p.locator("[data-one-off]").click();
  await p.getByRole("button", { name: "Vẫn tạo không lịch" }).click();
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("bước 3: có 'Cô duyệt', 'Chỉ mã mời'; KHÔNG có 'Vào ngay'", await p.locator("[data-policy=approve]").isVisible() && await p.locator("[data-policy=invite_only]").isVisible() && (await p.locator("[data-policy=open]").count()) === 0);
  await p.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await p.waitForURL(/\/lop-cua-toi\/quan-lop\/hoa-11-thu/, { timeout: 90000 });
  const made = await prisma.course.findFirst({ where: { ownerId: T.id, name: "Hoá 11 thử" } });
  check("DB: lớp tạo xong, cách vào lớp 'approve', không đơn giá, không dấu Miễn phí", made?.joinPolicy === "approve" && made?.feeMode === "monthly_sessions" && !made?.tag && (await prisma.courseFeeRate.count({ where: { courseId: made?.id } })) === 0, made);

  section("Thanh bên có Lịch → trang buổi");
  check("thanh bên gia sư có liên kết 'Lịch' → /lop-cua-toi/lich", (await p.locator('a[href="/lop-cua-toi/lich"]').count()) > 0);
  await p.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  check("mở /lop-cua-toi/lich không bị chuyển hướng", new URL(p.url()).pathname === "/lop-cua-toi/lich", p.url());
  await p.goto(`${BASE}/lop-cua-toi/buoi/${C.id}/${past}`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("button", { name: "Đã dạy xong" }).waitFor({ timeout: 90000 });
  check("trang buổi: có 'Đã dạy xong'; không có chữ 'học phí'", (await p.locator("body").innerText()).toLowerCase().includes("học phí") === false);
  await shot(p, "hp-tat-trang-buoi-1280");
  await p.getByRole("button", { name: "Đã dạy xong" }).click();
  await eventually("bấm Đã dạy xong → buổi đã chốt, 0 khoản phí", async () => (await prisma.attendanceSession.findFirst({ where: { courseId: C.id } }))?.state === "closed" && (await prisma.feeCharge.count()) === 0);

  section("390px: tạo lớp không tràn");
  const m = await (await ctxFor(T, { width: 390, height: 844 })).newPage();
  await m.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await m.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  check("390: không tràn ngang", await m.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"));
  await shot(m, "hp-tat-tao-lop-390");

  section("Khách mở link mời → đăng nhập giữ mã");
  const g = await (await ctxFor(null)).newPage();
  await g.goto(`${BASE}/student/nhap-ma-lop?code=ABC123`, { waitUntil: "networkidle", timeout: 120000 });
  await g.waitForURL(/\/dang-nhap/, { timeout: 60000 });
  check("redirect giữ ?code=ABC123", decodeURIComponent(g.url()).includes("/student/nhap-ma-lop?code=ABC123"), g.url());
  const href = await g.getByRole("link", { name: "Tạo tài khoản KiN" }).getAttribute("href");
  check("nút 'Tạo tài khoản KiN' mang theo redirect có mã", !!href && decodeURIComponent(href).includes("redirect=/student/nhap-ma-lop?code=ABC123"), href);

  await closeAll();
  done();
})().catch(async e => { console.error(e); await closeAll(); process.exit(1); });
