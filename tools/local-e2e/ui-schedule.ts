import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, vnMinutesOfDay, dayOfWeekOfKey, hmOf, instantOf, dueReminderKinds } from "@/lib/classSessions";

const MAIN = process.env.BASE ?? "http://localhost:3100"; // NC2: cổng theo BASE để chạy song song nhiều máy chủ thử

async function slot(courseId: string, min: number, joinUrl: string | null = null) {
  const t = new Date(Date.now() + min * 60_000);
  const dateKey = vnDateKeyOf(t), m = vnMinutesOfDay(t);
  const sched = await prisma.classSchedule.create({ data: { courseId, dayOfWeek: dayOfWeekOfKey(dateKey), startTime: hmOf(m), endTime: hmOf(Math.min(m + 60, 1439)), joinUrl } });
  return { sched, dateKey, startAt: instantOf(dateKey, m) };
}

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const stuA = await mkUser({ name: "Em An" }), stuB = await mkUser({ name: "Em Bình" });
  await prisma.user.update({ where: { id: stuA.id }, data: { parentPhone: "0901234567" } });
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  for (const u of [stuA, stuB]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  const near = await slot(course.id, 45, "https://meet.google.com/abc-defg-hij");
  await prisma.classAbsence.create({ data: { courseId: course.id, scheduleId: near.sched.id, dateKey: near.dateKey, startAt: near.startAt, studentId: stuB.id, reportedBy: "parent", leadMinutes: 40, reason: "Con bị sốt", status: "pending" } });
  const hasH1 = dueReminderKinds(near.startAt, new Date()).includes("h1");
  await launch();

  const ctx = await ctxFor(tutor);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: MAIN }).catch(() => {});
  const popups: string[] = [];
  // Không ra mạng thật: ghi lại địa chỉ Zalo được mở rồi trả trang rỗng.
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me)\//, route => { popups.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>zalo</title>" }); });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo/i.test(m.text())) errors.push(m.text()); });

  section("TT-203: chế độ gọn mặc định");
  await page.goto(`${MAIN}/lop-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(e => console.log("goto:", String(e).slice(0, 80)));
  await page.waitForURL(/\/lop-cua-toi\/lich/, { timeout: 120000 });
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "Module của gia sư" });
  await nav.waitFor();
  const links = (await nav.getByRole("link").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim());
  check("thanh module chỉ có Lịch + Học phí (+ nút Khác)", links.some(l => l.startsWith("Lịch")) && links.some(l => l.startsWith("Học phí")) && !links.some(l => l.startsWith("Hộp việc") || l.startsWith("Lớp") || l.startsWith("Bài KT") || l.startsWith("Thư viện")) && (await nav.getByRole("button", { name: "Khác" }).count()) === 1, links);
  await nav.getByRole("button", { name: "Khác" }).click();
  const khac = page.getByRole("dialog", { name: "Các mục khác" });
  await khac.waitFor();
  check("có lối 'Thêm module' trong bảng Khác", (await khac.getByRole("link", { name: "Thêm module" }).getAttribute("href")) === "/lop-cua-toi/cai-dat#module");
  await page.keyboard.press("Escape");
  await khac.waitFor({ state: "hidden" });
  check("Lịch là mục đang chọn (aria-current)", (await nav.getByRole("link", { name: /^Lịch/ }).first().getAttribute("aria-current")) === "page");
  const lichBadge = nav.locator("a", { hasText: "Lịch" }).locator(".kin-badge-dem");
  await lichBadge.waitFor({ timeout: 10000 });
  const nDue = hasH1 ? 4 : 2; // tin tới hạn của em An (phụ huynh+học sinh); em Bình đã báo nghỉ nên không có
  check(`Hộp việc tắt: việc hiện thành số đỏ trên Lịch (= 1 báo nghỉ + ${nDue} tin nhắc)`, (await lichBadge.innerText()) === String(1 + nDue) && (await lichBadge.getAttribute("aria-label")) === `${1 + nDue} việc cần xử lý`, await lichBadge.innerText());

  section("Lịch: buổi + chấm báo nghỉ + nhắc lịch");
  await page.getByRole("heading", { name: "Lịch", exact: true }).waitFor();
  await page.getByText("Toán 9").first().waitFor({ timeout: 15000 });
  check("buổi hôm nay hiện kèm 'Hôm nay'", await page.getByText("Hôm nay", { exact: true }).first().isVisible());
  check("chấm kèm chữ: '1 báo nghỉ sát giờ' và tin nhắc chờ gửi", await page.getByText("1 báo nghỉ sát giờ").isVisible() && await page.getByText(`${nDue} tin nhắc chờ gửi`).isVisible());
  await shot(page, "sched-collapsed");
  const card = page.getByRole("button", { name: /Toán 9/ }).first();
  check("thẻ buổi thu gọn: aria-expanded=false", (await card.getAttribute("aria-expanded")) === "false");
  await card.click();
  check("mở thẻ: aria-expanded=true", (await card.getAttribute("aria-expanded")) === "true");
  check("hiện link vào lớp", await page.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" }).isVisible());
  check("hiện hạn báo nghỉ giữ buổi bù", await page.getByText(/Hạn báo nghỉ giữ buổi bù/).isVisible());

  section("TT-202: xử lý báo nghỉ sát giờ bằng một nút");
  check("hiện Em Bình, 'báo trước', lý do", await page.getByText("Em Bình").first().isVisible() && await page.getByText(/báo trước 40 phút/).isVisible() && await page.getByText(/Con bị sốt/).isVisible());
  const btnFree = page.getByRole("button", { name: "Không tính phí, giữ 1 buổi bù" });
  const btnCharge = page.getByRole("button", { name: "Tính phí buổi này" });
  check("đúng 2 nút, nút chính là 'Không tính phí, giữ 1 buổi bù'", await btnFree.isVisible() && await btnCharge.isVisible());
  await btnFree.click();
  await page.getByText("Đã ghi nhận nghỉ có báo và giữ 1 buổi bù.").waitFor({ timeout: 15000 });
  await page.getByText(/Đã ghi nhận con nghỉ buổi/).waitFor({ timeout: 5000 });
  const msgText = await page.locator("p.whitespace-pre-line").first().innerText();
  check("hiện sẵn tin gửi phụ huynh đúng mẫu", msgText.includes("Buổi này không tính phí và con còn 1 buổi bù") && msgText.includes("Cô Lan sẽ hẹn giờ bù"), msgText);
  check("nút xử lý biến mất, hiện nhãn trạng thái", (await page.getByRole("button", { name: "Tính phí buổi này" }).count()) === 0 && await page.getByText("Không tính phí — đã giữ 1 buổi bù").isVisible());
  await eventually("DB: excused_free + 1 buổi bù + điểm danh Có phép", async () => {
    const a = await prisma.classAbsence.findFirst({ where: { studentId: stuB.id } });
    const rec = await prisma.attendanceRecord.findFirst({ where: { userId: stuB.id } });
    return a?.status === "excused_free" && (await prisma.makeupCredit.count({ where: { absenceId: a.id } })) === 1 && rec?.status === "excused";
  });
  await eventually("chấm báo nghỉ biến mất khỏi buổi", async () => (await page.getByText("1 báo nghỉ sát giờ").count()) === 0);
  await shot(page, "sched-resolved");

  section("TT-201: soạn tin nhắc, sửa được, mở Zalo");
  await page.getByRole("button", { name: "Soạn & mở Zalo" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  const ta = dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)");
  const draft = await ta.inputValue();
  check("tin soạn sẵn đúng mẫu + có link lớp", draft.startsWith("KiN nhắc lịch: con Em An có buổi Toán 9") || draft.startsWith("Còn 1 giờ nữa là buổi Toán 9 của Em An"), draft);
  check("báo rõ KiN không gửi giúp", await dlg.getByText(/KiN không gửi giúp/).isVisible());
  await ta.fill(draft + "\nCảm ơn anh/chị.");
  await shot(page, "sched-compose");
  await dlg.getByRole("button", { name: "Mở Zalo" }).click();
  await dlg.waitFor({ state: "detached", timeout: 15000 });
  await eventually("đã chép đúng tin ĐÃ SỬA vào bộ nhớ tạm", async () => (await page.evaluate(() => navigator.clipboard.readText()).catch(() => "")).endsWith("Cảm ơn anh/chị."));
  await eventually("đã mở cửa sổ Zalo đúng số phụ huynh", () => popups.some(u => u.startsWith("https://zalo.me/0901234567")));
  await eventually("DB: ghi 'đã mở Zalo' (1 dòng)", async () => (await prisma.classReminderLog.count({ where: { studentId: stuA.id } })) === 1);
  await eventually("trên thẻ: 'Đã mở Zalo lúc …', không có chữ 'đã gửi'", async () => (await page.getByText(/Đã mở Zalo lúc \d\d:\d\d/).count()) >= 1 && (await page.getByText(/đã gửi/i).count()) === 0);
  await eventually("nhãn nút đổi thành 'Mở lại Zalo'", async () => (await page.getByRole("button", { name: "Mở lại Zalo" }).count()) === 1);
  await eventually("số đỏ trên Lịch giảm", async () => (await lichBadge.innerText().catch(() => "")) === String(nDue - 1));

  section("TT-203: bật module ở Cài đặt");
  await nav.getByRole("button", { name: "Khác" }).click();
  await page.getByRole("dialog", { name: "Các mục khác" }).getByRole("link", { name: "Cài đặt", exact: true }).click();
  await page.getByRole("heading", { name: "Module hiển thị" }).waitFor({ timeout: 30000 });
  check("Lịch và Học phí: luôn bật, không tắt được", await page.getByRole("switch", { name: /Lịch/ }).isDisabled() && await page.getByRole("switch", { name: /Học phí/ }).isDisabled() && await page.getByRole("switch", { name: /Lịch/ }).isChecked());
  check("4 module còn lại đang tắt", (await Promise.all(["Hộp việc", "Lớp", "Bài KT", "Thư viện"].map(n => page.getByRole("switch", { name: new RegExp(`^${n}`) }).isChecked()))).every(v => v === false));
  await page.getByRole("switch", { name: /^Hộp việc/ }).check();
  await page.getByText("Đã bật module — xem ở thanh bên.").waitFor({ timeout: 10000 });
  await page.getByRole("switch", { name: /^Lớp/ }).check();
  await eventually("DB: modules = [hop-viec, lop]", async () => JSON.stringify(((await prisma.user.findUnique({ where: { id: tutor.id }, select: { preferences: true } }))?.preferences as any)?.modules) === JSON.stringify(["hop-viec", "lop"]));
  await eventually("thanh bên có 4 module đúng thứ tự: Hộp việc, Lịch, Lớp, Học phí", async () => {
    const t = (await nav.getByRole("link").allInnerTexts()).map(x => x.replace(/\s+/g, " ").trim());
    const order = ["Hộp việc", "Lịch", "Lớp", "Học phí"].map(l => t.findIndex(x => x.startsWith(l)));
    return order.every(i => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]);
  });
  await shot(page, "sched-settings");
  await nav.getByRole("link", { name: /^Hộp việc/ }).click();
  await page.getByRole("listbox", { name: "Hộp việc" }).waitFor({ timeout: 60000 });
  await page.waitForURL(u => u.pathname === "/lop-cua-toi", { timeout: 60000 }).catch(() => {}); // NC2-004
  check("Hộp việc bật: mở Hộp việc (danh sách + khung đọc), không còn chuyển về Lịch", page.url().endsWith("/lop-cua-toi"));
  check("badge của Hộp việc (không còn badge ở Lịch)", (await nav.locator("a", { hasText: "Hộp việc" }).locator(".kin-badge-dem").count()) === 1 && (await nav.locator("a", { hasText: "Lịch" }).locator(".kin-badge-dem").count()) === 0);
  check("Hộp việc chỉ còn việc thật: báo nghỉ đã xử lý nên không còn dòng đó; tin nhắc còn lại = nDue − 1 (một tin đã mở Zalo)", await page.getByRole("option", { name: /báo nghỉ sát giờ/ }).count() === 0 && await page.getByRole("option", { name: new RegExp(`^${nDue - 1} tin nhắc lịch đã tới hạn`) }).isVisible(), await page.getByRole("option").allInnerTexts());

  section("Lưu theo tài khoản, không theo máy");
  const ctx2 = await ctxFor(tutor);
  const p2 = await ctx2.newPage();
  await p2.goto(`${MAIN}/lop-cua-toi/lich`, { waitUntil: "networkidle" });
  const nav2 = p2.getByRole("navigation", { name: "Module của gia sư" });
  await nav2.waitFor({ timeout: 60000 });
  check("máy khác (trình duyệt sạch) vẫn thấy Hộp việc + Lớp", (await nav2.getByRole("link").allInnerTexts()).some(t => t.includes("Hộp việc")) && (await nav2.getByRole("link").allInnerTexts()).some(t => t.includes("Lớp")));
  await page.goto(`${MAIN}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle" });
  await page.getByRole("switch", { name: /^Hộp việc/ }).uncheck();
  await page.getByText(/Đã ẩn module khỏi thanh bên/).waitFor({ timeout: 10000 });
  await eventually("tắt Hộp việc: thanh bên ẩn, dữ liệu không mất", async () => (await nav.getByRole("link").allInnerTexts()).every(t => !t.includes("Hộp việc")) && (await prisma.classAbsence.count()) === 1);

  section("Điện thoại: thanh module ở đáy");
  const mctx = await ctxFor(tutor, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${MAIN}/lop-cua-toi/lich`, { waitUntil: "networkidle" });
  const bar = mp.getByRole("navigation", { name: "Module của gia sư" });
  await bar.waitFor({ timeout: 60000 });
  const box = await bar.boundingBox();
  check("thanh module nằm sát đáy, cao 60px", !!box && Math.abs(box.y + box.height - 800) < 2 && Math.round(box.height) === 60, box);
  check("mọi nút đủ 44px", (await bar.getByRole("link").evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44 && e.getBoundingClientRect().width >= 44))));
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await shot(mp, "sched-mobile");

  section("Quyền");
  const sctx = await ctxFor(stuA);
  const sp = await sctx.newPage();
  await sp.goto(`${MAIN}/lop-cua-toi/lich`, { waitUntil: "networkidle" });
  await sp.waitForURL(u => !u.pathname.includes("/lop-cua-toi/lich"), { timeout: 60000 }).catch(() => {}); // NC2-004
  check("học viên mở trang Lịch gia sư → bị chuyển đi", !sp.url().includes("/lop-cua-toi/lich"), sp.url());
  const gctx = await ctxFor(null);
  const gp = await gctx.newPage();
  await gp.goto(`${MAIN}/lop-cua-toi/lich`, { waitUntil: "networkidle" });
  await gp.waitForURL(/\/dang-nhap/, { timeout: 60000 }).catch(() => {}); // NC2-004
  check("khách → trang đăng nhập", gp.url().includes("/dang-nhap"), gp.url());

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
