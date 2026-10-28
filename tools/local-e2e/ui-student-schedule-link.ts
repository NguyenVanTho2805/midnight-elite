// Giao diện: lịch của học sinh nối với lớp em đang học (trình duyệt thật). Dữ liệu API xem t-student-schedule-link.ts.
//   • /student/lich-hoc: buổi dạy bù / buổi lẻ hiện cùng buổi theo lịch tuần, kèm "Online" / "Offline · địa chỉ" và nút "Mở link học online" (tab ngoài, có noopener);
//     buổi học trực tiếp không có nút link; "Vào lớp học" vẫn đi trang lớp.
//   • /student/hoc-tap?course=…: trang lớp có khối "Buổi học sắp tới" của CHÍNH lớp đó (cùng nguồn với Lịch), người chưa vào lớp không thấy và không lộ link.
//   • /student/viec-cua-toi: thẻ "Buổi học tiếp theo" có hình thức + nút link online.
//   • /so-cua-con/<mã>: phụ huynh thấy buổi thêm (chỉ đọc, không có nút Báo nghỉ, không có link học online); buổi theo lịch tuần vẫn có Báo nghỉ.
//   • 390px không tràn ngang; không lỗi JS.
import { BASE, api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { mondayOf } from "@/lib/studentWeek";
import { generatePortalToken } from "@/lib/parentPortal";
import { launch, ctxFor, closeAll, type Page } from "./ui";

(async () => {
  await wipe();
  const today = vnDateKeyOf(new Date());
  const at = (n: number) => addDaysKey(today, n);
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Học sinh Đang Học" }), OUT = await mkUser({ name: "Người Ngoài Lớp" });
  const C1 = await mkCourse(T.id, { name: "Toán 9" });
  const CLASS_URL = "https://meet.example.com/chung-lop-c1", RULE_URL = "https://meet.example.com/khung-gio", MK_URL = "https://meet.example.com/bu-rieng";
  await prisma.course.update({ where: { id: C1.id }, data: { classJoinUrl: CLASS_URL } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C1.id } });
  await prisma.classSchedule.create({ data: { courseId: C1.id, dayOfWeek: dayOfWeekOfKey(at(1)), startTime: "19:00", endTime: "20:30", mode: "online", joinUrl: RULE_URL } });
  const post = (body: object) => api("POST", `/api/courses/${C1.id}/sessions`, { as: T, body });
  const mk = await post({ dateKey: at(2), startTime: "16:00", endTime: "17:00", kind: "makeup", mode: "online", joinUrl: MK_URL });
  const ex = await post({ dateKey: at(3), startTime: "09:00", endTime: "10:30", kind: "extra", mode: "offline", location: "12 Nguyễn Trãi" });
  const parent = await mkUser({ name: "Phụ Huynh" }), tok = generatePortalToken();
  await prisma.parentLink.create({ data: { parentId: parent.id, studentId: S.id, status: "verified", verifiedAt: new Date(), portalToken: tok } });

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  section("Chuẩn bị");
  check("gia sư thêm được buổi dạy bù và buổi lẻ", mk.status === 201 && ex.status === 201, [mk.json, ex.json]);

  section("Lịch học (máy tính 1280px)");
  const ctx = await ctxFor(S, { width: 1280, height: 900 });
  const p = await ctx.newPage(); watch(p);
  await p.goto(`${BASE}/student/lich-hoc`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await p.locator("[data-week-item]").first().waitFor({ timeout: 90000 });
  // Chuyển tới tuần chứa ngày `k` (buổi "ngày mai / ngày kia" có thể rơi sang tuần sau của Lịch).
  const weekOf = async (k: string) => {
    await p.getByRole("button", { name: "Về tuần này" }).click();
    const n = (Date.parse(mondayOf(k)) - Date.parse(mondayOf(today))) / (7 * 86400_000);
    for (let i = 0; i < n; i++) await p.getByRole("button", { name: "Tuần sau" }).click();
  };
  const row = (text: string) => p.locator("[data-week-item=class]").filter({ hasText: text });

  await weekOf(at(2));
  const bu = row("Dạy bù").first();
  await bu.waitFor({ timeout: 30000 });
  const buText = await bu.innerText();
  check("buổi dạy bù hiện trên Lịch: tên lớp, '16:00–17:00', 'Dạy bù', 'Online'", /Toán 9/.test(buText) && buText.includes("16:00–17:00") && buText.includes("Dạy bù") && /Online/.test(buText), buText);
  const buJoin = bu.locator("[data-week-join]");
  check("nút 'Mở link học online' mở link RIÊNG buổi ở tab ngoài, có noopener", (await buJoin.count()) === 1 && (await buJoin.getAttribute("href")) === MK_URL && (await buJoin.getAttribute("target")) === "_blank" && /noopener/.test((await buJoin.getAttribute("rel")) ?? ""));
  check("'Vào lớp học' vẫn đi trang lớp trong ứng dụng", (await bu.getByRole("link", { name: "Vào lớp học" }).getAttribute("href")) === `/student/hoc-tap?course=${C1.id}`);

  await weekOf(at(3));
  const le = row("Buổi lẻ").first();
  await le.waitFor({ timeout: 30000 });
  const leText = await le.innerText();
  check("buổi lẻ học trực tiếp: 'Offline · 12 Nguyễn Trãi' và KHÔNG có nút link online (dù lớp có link chung)", leText.includes("Offline · 12 Nguyễn Trãi") && (await le.locator("[data-week-join]").count()) === 0, leText);

  await weekOf(at(1));
  const wk = row("Toán 9").filter({ hasNotText: "Dạy bù" }).first();
  await wk.waitFor({ timeout: 30000 });
  check("buổi theo lịch tuần: link CỦA KHUNG GIỜ, 'Online'", (await wk.locator("[data-week-join]").getAttribute("href")) === RULE_URL && (await wk.innerText()).includes("Online"));

  section("Trang lớp của học sinh");
  await p.goto(`${BASE}/student/hoc-tap?course=${C1.id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  const box = p.locator("[data-course-sessions]");
  await box.waitFor({ timeout: 90000 });
  await p.locator("[data-course-session]").first().waitFor({ timeout: 30000 });
  const rows = p.locator("[data-course-session]");
  const rowTexts = await rows.allInnerTexts();
  check("khối 'Buổi học sắp tới' của lớp có đủ 3 buổi: theo lịch tuần, dạy bù, buổi lẻ", (await rows.count()) >= 3 && rowTexts.some(t => t.includes("Dạy bù")) && rowTexts.some(t => t.includes("Buổi lẻ")), rowTexts);
  const buRow = rows.filter({ hasText: "Dạy bù" });
  check("buổi dạy bù ở trang lớp: có giờ, 'Online', nút link học online đúng link", (await buRow.innerText()).includes("16:00–17:00") && (await buRow.innerText()).includes("Online") && (await buRow.locator("[data-course-session-join]").getAttribute("href")) === MK_URL);
  check("buổi lẻ trực tiếp ở trang lớp: có địa chỉ, không nút link online", (await rows.filter({ hasText: "Buổi lẻ" }).innerText()).includes("Offline · 12 Nguyễn Trãi") && (await rows.filter({ hasText: "Buổi lẻ" }).locator("[data-course-session-join]").count()) === 0);
  check("có lối 'Xem cả lịch học' → /student/lich-hoc", (await box.getByRole("link", { name: "Xem cả lịch học" }).getAttribute("href")) === "/student/lich-hoc");

  const octx = await ctxFor(OUT, { width: 1280, height: 900 });
  const po = await octx.newPage(); watch(po);
  await po.goto(`${BASE}/student/hoc-tap?course=${C1.id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await po.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 });
  await po.getByText("Bạn chưa vào lớp này").waitFor({ timeout: 60000 });
  const html = await po.content();
  check("người CHƯA vào lớp: không có khối buổi học và HTML không chứa link học online nào", (await po.locator("[data-course-sessions]").count()) === 0 && !html.includes("meet.example.com"));

  section("Việc của tôi: thẻ 'Buổi học tiếp theo'");
  await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 240000 });
  const card = p.locator("[data-next-session]").first();
  await card.waitFor({ timeout: 90000 });
  const cardText = await card.innerText();
  check("thẻ có giờ buổi gần nhất, 'Online' và nút 'Mở link học online' (link khung giờ)", cardText.includes("19:00–20:30") && cardText.includes("Online") && (await card.getByRole("link", { name: "Mở link học online" }).getAttribute("href")) === RULE_URL, cardText);
  check("'Vào lớp học' vẫn có và là nút chính", (await card.getByRole("link", { name: "Vào lớp học" }).count()) === 1);

  section("Cổng phụ huynh 'Sổ của con'");
  const pctx = await ctxFor(null, { width: 1280, height: 900 });
  const pp = await pctx.newPage(); watch(pp);
  await pp.goto(`${BASE}/so-cua-con/${tok}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  const extra = pp.locator("[data-extra-session]");
  await extra.first().waitFor({ timeout: 90000 });
  const exTexts = await extra.allInnerTexts();
  check("hai buổi thêm hiện cho phụ huynh: dạy bù (Online) và buổi lẻ (Offline · địa chỉ)", exTexts.length === 2 && exTexts.some(t => t.includes("Dạy bù") && t.includes("Online")) && exTexts.some(t => t.includes("Buổi lẻ") && t.includes("Offline · 12 Nguyễn Trãi")), exTexts);
  check("buổi thêm chỉ để xem: không có nút Báo nghỉ trong từng dòng, có lời nhắn nhắn gia sư", (await extra.getByRole("button").count()) === 0 && exTexts.every(t => t.includes("nhắn gia sư")));
  check("buổi theo lịch tuần vẫn có nút 'Báo nghỉ'", (await pp.getByRole("button", { name: "Báo nghỉ" }).count()) >= 1);
  // Lưu ý: dữ liệu trang vẫn chứa `joinUrl` của buổi theo lịch tuần (có từ 12/10, giao diện không dùng) — chờ Thọ quyết có giữ không; phần buổi thêm không mang link.
  check("giao diện phụ huynh không có liên kết học online nào (không nút, không <a>)", (await pp.locator('a[href*="meet.example.com"]').count()) === 0 && !(await extra.allInnerTexts()).join(" ").includes("meet.example.com"));

  section("Điện thoại 390px: không tràn ngang");
  const mctx = await ctxFor(S, { width: 390, height: 844 });
  const pm = await mctx.newPage(); watch(pm);
  for (const [name, url, ready] of [["Lịch học", `${BASE}/student/lich-hoc`, "[data-week-item]"], ["Trang lớp", `${BASE}/student/hoc-tap?course=${C1.id}`, "[data-course-session]"], ["Việc của tôi", `${BASE}/student/viec-cua-toi`, "[data-next-session]"]] as const) {
    await pm.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
    await pm.locator(ready).first().waitFor({ timeout: 90000 });
    check(`${name}: 390px không tràn ngang`, await noOverflow(pm));
  }
  const pmp = await (await ctxFor(null, { width: 390, height: 844 })).newPage(); watch(pmp);
  await pmp.goto(`${BASE}/so-cua-con/${tok}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await pmp.locator("[data-extra-session]").first().waitFor({ timeout: 90000 });
  check("Sổ của con: 390px không tràn ngang", await noOverflow(pmp));

  check("không có lỗi JS / console.error trong cả phiên", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
