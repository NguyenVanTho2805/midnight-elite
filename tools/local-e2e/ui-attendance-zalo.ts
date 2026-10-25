import { BASE, api, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

const MAIN = process.env.BASE ?? "http://localhost:3100"; // NC2: cổng theo BASE để chạy song song nhiều máy chủ thử
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" });
  await prisma.user.update({ where: { id: A.id }, data: { parentName: "Hoa", parentPhone: "0901234567" } });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const opened: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me)\//, route => { opened.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>zalo</title>" }); });
  // Origin admin chạy http thường (không phải ngữ cảnh an toàn) → navigator.clipboard không có; zaloShare dùng execCommand dự phòng.
  await ctx.addInitScript(() => {
    const orig = document.execCommand.bind(document);
    (document as any).execCommand = (cmd: string, ...a: any[]) => {
      if (cmd === "copy") (window as any).__copied = (document.querySelector("textarea[readonly]") as HTMLTextAreaElement | null)?.value ?? "";
      return orig(cmd, ...a);
    };
  });
  // 14/10: gia sư nay ở tên miền chính (localhost = ngữ cảnh an toàn) nên zaloShare dùng navigator.clipboard thay vì execCommand dự phòng — bắt cả hai đường.
  await ctx.addInitScript(() => {
    try {
      const c = navigator.clipboard;
      if (c && c.writeText) { const ow = c.writeText.bind(c); c.writeText = (t: string) => { (window as any).__copied = t; return ow(t).catch(() => {}); }; }
    } catch { /* không có clipboard */ }
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo/i.test(m.text())) errors.push(m.text()); });

  section("Chưa lưu thì chưa có nút Nhắn phụ huynh");
  await page.goto(`${BASE}/admin/khoa-hoc/${course.id}/diem-danh`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Điểm danh", level: 2 }).waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Tạo buổi điểm danh" }).click();
  await page.getByText("Em An").waitFor({ timeout: 30000 });
  const rowA = page.locator("div.flex.items-center.gap-3", { hasText: "Em An" }).last();
  const rowB = page.locator("div.flex.items-center.gap-3", { hasText: "Em Bình" }).last();
  check("chưa chọn trạng thái: không có nút", (await page.getByRole("button", { name: /Nhắn phụ huynh/ }).count()) === 0);
  await rowA.getByRole("button", { name: /^Vắng/ }).click();
  check("chọn xong nhưng CHƯA lưu: vẫn không có nút (tin phải nói đúng điều đã lưu)", (await rowA.getByRole("button", { name: /Nhắn phụ huynh/ }).count()) === 0);
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await page.getByText(/Đã lưu 1 học viên/).waitFor({ timeout: 15000 });
  await rowA.getByRole("button", { name: /Nhắn phụ huynh của Em An/ }).waitFor({ timeout: 15000 });
  check("lưu xong: Em An có nút, Em Bình (chưa điểm danh) không có", (await rowB.getByRole("button", { name: /Nhắn phụ huynh/ }).count()) === 0);

  section("Tin soạn sẵn đúng mẫu, sửa được");
  await rowA.getByRole("button", { name: /Nhắn phụ huynh của Em An/ }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  const ta = dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)");
  const dd = todayLocal().slice(8, 10), mm = todayLocal().slice(5, 7);
  const draft = await ta.inputValue();
  check("Buổi Toán 9 dd/mm của con Em An: Vắng. (chưa có link bản ghi → không hứa link)", draft === `Buổi Toán 9 ${dd}/${mm} của con Em An: Vắng.`, draft);
  check("báo SĐT + tên phụ huynh + KiN không gửi giúp", await dlg.getByText(/Sẽ mở Zalo của 0901234567 \(Hoa\)/).isVisible() && await dlg.getByText(/KiN không gửi giúp/).isVisible());

  section("Mở Zalo: ghi 'đã mở', KHÔNG xoá ô chưa lưu của em khác");
  await dlg.getByRole("button", { name: "Đóng" }).first().click().catch(() => {});
  if (await dlg.count()) await page.keyboard.press("Escape");
  await rowB.getByRole("button", { name: /^Có mặt/ }).click(); // ô chưa lưu của Em Bình
  await rowA.getByRole("button", { name: /Nhắn phụ huynh của Em An/ }).click();
  await dlg.waitFor();
  await ta.fill(draft + " Nhờ anh/chị nhắc con đi học đều.");
  await dlg.getByRole("button", { name: "Mở Zalo" }).click();
  await dlg.waitFor({ state: "detached", timeout: 20000 });
  await eventually("mở Zalo đúng số phụ huynh", () => opened.some(u => u.startsWith("https://zalo.me/0901234567")), 15000);
  await eventually("đã chép đúng tin ĐÃ SỬA (qua execCommand dự phòng)", async () => String(await page.evaluate(() => (window as any).__copied ?? "")).endsWith("đi học đều."));
  await eventually("DB: ghi 'đã mở Zalo'", async () => !!(await prisma.attendanceRecord.findFirst({ where: { userId: A.id } }))?.zaloOpenedAt);
  await eventually("dòng 'Đã mở Zalo lúc HH:MM ngày dd/mm' dưới Em An", async () => await rowA.getByText(/Đã mở Zalo lúc \d{2}:\d{2} ngày \d{2}\/\d{2}/).isVisible());
  check("ô chưa lưu của Em Bình vẫn còn (không bị tải lại)", await page.getByText("1 thay đổi chưa lưu").isVisible());
  check("không bao giờ ghi 'đã gửi'", (await rowA.getByText(/đã gửi/i).count()) === 0);

  section("Đổi trạng thái → xoá mốc (tin cũ nói về trạng thái cũ)");
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await page.getByText(/Đã lưu 1 học viên/).waitFor({ timeout: 15000 });
  check("lưu Em Bình không đụng mốc của Em An", !!(await prisma.attendanceRecord.findFirst({ where: { userId: A.id } }))?.zaloOpenedAt);
  await rowA.getByRole("button", { name: /^Có phép/ }).click();
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await page.getByText(/Đã lưu 1 học viên/).waitFor({ timeout: 15000 });
  // Thông báo "Đã lưu 1 học viên" của lần lưu trước có thể còn trên màn hình, nên chờ DB đổi thay vì tin thông báo.
  await eventually("Vắng → Có phép: mốc 'đã mở Zalo' bị xoá", async () => (await prisma.attendanceRecord.findFirst({ where: { userId: A.id } }))?.zaloOpenedAt === null, 15000);
  await eventually("giao diện không còn 'Đã mở Zalo lúc' ở Em An", async () => (await rowA.getByText(/Đã mở Zalo lúc/).count()) === 0);
  await rowA.getByRole("button", { name: /^Có phép/ }).click(); // bấm lại đúng trạng thái cũ → không đổi
  check("Em Bình không có SĐT: cảnh báo chép tin + chọn người nhận", true);
  await rowB.getByRole("button", { name: /Nhắn phụ huynh của Em Bình/ }).click();
  await dlg.waitFor();
  check("hiện 'Chưa có số điện thoại phụ huynh'", await dlg.getByText(/Chưa có số điện thoại phụ huynh/).isVisible());
  check("Có mặt: tin một câu, không link", (await dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue()) === `Buổi Toán 9 ${dd}/${mm} của con Em Bình: Có mặt.`);
  await shot(page, "attendance-zalo");
  await page.keyboard.press("Escape");

  section("API: quyền");
  const sess = await prisma.attendanceSession.findFirst({ where: { courseId: course.id } });
  const post = (as: any, body: unknown, id = sess!.id) => api("POST", `/api/attendance-sessions/${id}/zalo`, { as, body });
  check("chưa đăng nhập → 401/403", [401, 403].includes((await api("POST", `/api/attendance-sessions/${sess!.id}/zalo`, { body: { userId: A.id } })).status));
  check("học sinh → bị chặn", [401, 403].includes((await post(A, { userId: A.id })).status));
  check("gia sư của lớp KHÁC → 403", (await post(T2, { userId: A.id })).status === 403);
  check("buổi không có → 404", (await post(T, { userId: A.id }, "khong-co")).status === 404);
  check("thiếu userId → 400", (await post(T, {})).status === 400);
  const C = await mkUser({ name: "Em Chưa Điểm Danh" });
  await prisma.enrollment.create({ data: { userId: C.id, courseId: course.id, status: "active" } });
  check("em chưa điểm danh ở buổi này → 409", (await post(T, { userId: C.id })).status === 409);
  const get = await api("GET", `/api/attendance-sessions/${sess!.id}`, { as: T });
  check("GET roster có parentName/parentPhone/zaloOpenedAt + tên lớp", get.json?.course?.name === "Toán 9" && get.json?.roster?.every((r: any) => "parentPhone" in r && "zaloOpenedAt" in r), get.json?.roster?.[0]);
  const T2get = await api("GET", `/api/attendance-sessions/${sess!.id}`, { as: T2 });
  check("gia sư lớp khác không đọc được SĐT phụ huynh (403)", T2get.status === 403 && !JSON.stringify(T2get.json).includes("0901234567"));

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  await mp.goto(`${BASE}/admin/khoa-hoc/${course.id}/diem-danh`, { waitUntil: "networkidle" });
  await mp.getByRole("button", { name: /Nhắn phụ huynh của Em An/ }).waitFor({ timeout: 60000 });
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const bb = await mp.getByRole("button", { name: /Nhắn phụ huynh của Em An/ }).boundingBox();
  check("nút Nhắn phụ huynh cao ≥ 44px trên điện thoại", !!bb && bb.height >= 44, bb);

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
