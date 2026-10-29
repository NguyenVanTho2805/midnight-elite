// NC2-043 — Lịch học của học sinh: THÊM / SỬA / XOÁ việc riêng (ngoài lịch cố định của lớp), trình duyệt thật + cơ sở dữ liệu thật.
// Kiểm: form báo lỗi bằng chữ trước khi gửi; việc hiện trên lưới (nét đứt) và danh sách ngày; lưu bền qua tải lại; sửa từ cả hai nơi; thêm sang tuần khác thì nhảy tới đúng tuần;
// xoá có hộp xác nhận KiN; chỉ chủ thấy; chữ HTML hiện như chữ; lỗi máy chủ không mất dữ liệu đang gõ; lịch lớp vẫn nguyên; 390px không tràn ngang, nút ≥ 44px.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { mondayOf } from "@/lib/studentWeek";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Minh Anh" }), S2 = await mkUser({ name: "Bạn Khác" });
  const A = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const today = vnDateKeyOf(new Date());
  await prisma.classSchedule.create({ data: { courseId: A.id, dayOfWeek: dayOfWeekOfKey(today), startTime: "17:00", endTime: "18:00", note: "Học qua Meet" } });
  const nextWeekDay = addDaysKey(today, 7);

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 500)}`); }); };
  const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const rows = (uid = S.id) => prisma.studentPersonalEvent.findMany({ where: { userId: uid }, orderBy: { createdAt: "asc" } });
  const go = (p: Page, path: string) => p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 150000 });
  const openLich = async (p: Page) => { await go(p, "/student/lich-hoc"); await p.getByRole("heading", { level: 1, name: "Lịch học" }).waitFor({ timeout: 120000 }); await p.locator("[data-add-personal]").waitFor({ timeout: 60000 }); await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {}); };

  const ctx = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  await openLich(pg);
  const personalItems = () => pg.locator("[data-week-item=personal]");
  const form = pg.locator("[data-personal-form]");

  section("Mở form và kiểm tra lỗi bằng chữ (không gửi gì lên máy chủ)");
  check("có nút '+ Thêm việc riêng'; lịch lớp (buổi học 17:00) vẫn hiện như cũ", await pg.locator("[data-add-personal]").isVisible() && (await pg.locator("[data-week-item=class]").count()) >= 1);
  await pg.locator("[data-add-personal]").click();
  await form.waitFor({ timeout: 30000 });
  check("form có chữ cam kết riêng tư 'Chỉ mình bạn thấy…' và ngày mặc định là hôm nay", /Chỉ mình bạn thấy/.test(await form.innerText()) && (await pg.locator("#pe-date").inputValue()) === today);
  await form.getByRole("button", { name: "Lưu" }).click();
  check("tên rỗng → 'Chưa đặt tên cho việc riêng.' (role=alert), form vẫn mở, chưa có bản ghi", (await pg.locator("[data-personal-error]").innerText()).includes("Chưa đặt tên cho việc riêng.") && await form.isVisible() && (await rows()).length === 0);
  await pg.fill("#pe-title", "Học thêm Toán ở trung tâm"); await pg.fill("#pe-start", "19:00"); await pg.fill("#pe-end", "18:00");
  await form.getByRole("button", { name: "Lưu" }).click();
  check("giờ kết thúc trước giờ bắt đầu → báo 'Giờ kết thúc phải sau giờ bắt đầu', chưa có bản ghi", /Giờ kết thúc phải sau giờ bắt đầu/.test(await pg.locator("[data-personal-error]").innerText()) && (await rows()).length === 0);

  section("Thêm thành công, hiện trên lưới và danh sách, lưu bền");
  await pg.fill("#pe-end", "20:30"); await pg.fill("#pe-note", "Mang theo máy tính");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("form đóng, việc hiện trong danh sách ngày với tên + giờ 19:00–20:30 + ghi chú", async () => (await form.count()) === 0 && (await personalItems().count()) === 1 && /Học thêm Toán ở trung tâm/.test(await personalItems().first().innerText()) && /19:00–20:30/.test(await personalItems().first().innerText()) && /Mang theo máy tính/.test(await personalItems().first().innerText()), 30000);
  const r1 = await rows();
  check("cơ sở dữ liệu: đúng 1 bản ghi của Minh Anh, ngày hôm nay, 19:00–20:30", r1.length === 1 && r1[0].userId === S.id && r1[0].dateKey === today && r1[0].startTime === "19:00" && r1[0].endTime === "20:30" && r1[0].note === "Mang theo máy tính", r1);
  check("trên lưới tuần có ô nét đứt 'Sửa việc riêng Học thêm Toán…'", await pg.getByRole("button", { name: "Sửa việc riêng Học thêm Toán ở trung tâm" }).first().isVisible());
  check("chú thích lưới có 'Nét đứt: việc riêng của bạn (chỉ mình bạn thấy)'", await pg.getByText(/Nét đứt: việc riêng của bạn/).isVisible());
  await shot(pg, "lich-rieng-luoi");
  await pg.reload({ waitUntil: "domcontentloaded" });
  await pg.locator("[data-add-personal]").waitFor({ timeout: 90000 });
  await eventually("tải lại trang vẫn còn việc riêng (lưu bền)", async () => (await personalItems().count()) === 1, 30000);

  section("Sửa từ danh sách ngày và từ ô trên lưới");
  await personalItems().first().getByRole("button", { name: /^Sửa/ }).click();
  await form.waitFor({ timeout: 30000 });
  check("form sửa điền sẵn đủ ô (tên, giờ, ghi chú) và có tiêu đề 'Sửa việc riêng'", (await pg.locator("#pe-title").inputValue()) === "Học thêm Toán ở trung tâm" && (await pg.locator("#pe-start").inputValue()) === "19:00" && (await pg.locator("#pe-end").inputValue()) === "20:30" && (await pg.locator("#pe-note").inputValue()) === "Mang theo máy tính" && await pg.getByRole("heading", { name: "Sửa việc riêng" }).isVisible());
  await pg.fill("#pe-title", "Học thêm Toán (đổi phòng)"); await pg.fill("#pe-end", "");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("sửa xong: danh sách hiện tên mới, bỏ giờ kết thúc ('19:00'), không còn tên cũ", async () => (await form.count()) === 0 && (await personalItems().count()) === 1 && /Học thêm Toán \(đổi phòng\)/.test(await personalItems().first().innerText()) && !/20:30/.test(await personalItems().first().innerText()), 30000);
  const r2 = await rows();
  check("cơ sở dữ liệu: vẫn 1 bản ghi (sửa, không nhân đôi), endTime null", r2.length === 1 && r2[0].id === r1[0].id && r2[0].title === "Học thêm Toán (đổi phòng)" && r2[0].endTime === null, r2);
  await pg.getByRole("button", { name: "Sửa việc riêng Học thêm Toán (đổi phòng)" }).first().click();
  await form.waitFor({ timeout: 30000 });
  check("bấm ô trên lưới cũng mở form sửa, điền sẵn tên", (await pg.locator("#pe-title").inputValue()) === "Học thêm Toán (đổi phòng)");
  await form.getByRole("button", { name: "Huỷ" }).click();
  check("'Huỷ' đóng form, không đổi gì", (await form.count()) === 0 && (await rows())[0].title === "Học thêm Toán (đổi phòng)");

  section("Thêm việc ở tuần sau → trang nhảy tới đúng tuần");
  const weekLabel = () => pg.getByRole("navigation", { name: "Chuyển tuần" }).getByRole("button", { name: "Về tuần này" }).innerText();
  const label0 = await weekLabel();
  await pg.locator("[data-add-personal]").click();
  await form.waitFor({ timeout: 30000 });
  await pg.fill("#pe-title", "Tự ôn Địa tuần sau"); await pg.fill("#pe-date", nextWeekDay); await pg.fill("#pe-start", "08:15");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("lưu xong: trang chuyển sang tuần sau và hiện việc mới", async () => (await form.count()) === 0 && (await weekLabel()) !== label0 && (await personalItems().filter({ hasText: "Tự ôn Địa tuần sau" }).count()) === 1, 30000);
  const r3 = await rows();
  check("cơ sở dữ liệu: 2 bản ghi; việc tuần sau có ngày đúng, giờ 08:15, không giờ kết thúc", r3.length === 2 && r3.some(r => r.title === "Tự ôn Địa tuần sau" && r.dateKey === nextWeekDay && r.startTime === "08:15" && r.endTime === null), r3);
  check("việc tuần này KHÔNG hiện ở tuần sau (mỗi tuần chỉ đọc đúng khoảng của nó)", (await personalItems().filter({ hasText: "Học thêm Toán" }).count()) === 0);
  await pg.getByRole("navigation", { name: "Chuyển tuần" }).getByRole("button", { name: /Tuần trước/ }).click();
  await eventually("quay về tuần này: thấy việc 'Học thêm Toán…', không thấy việc tuần sau", async () => (await personalItems().filter({ hasText: "Học thêm Toán" }).count()) === 1 && (await personalItems().filter({ hasText: "Tự ôn Địa" }).count()) === 0, 30000);

  section("Chữ HTML hiện như chữ; lỗi máy chủ không mất dữ liệu đang gõ");
  await pg.locator("[data-add-personal]").click(); await form.waitFor({ timeout: 30000 });
  await pg.fill("#pe-title", "<b>đậm</b> & <script>alert(1)</script>"); await pg.fill("#pe-start", "21:00");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("tên chứa thẻ HTML hiện NGUYÊN VĂN, không có phần tử <b> / <script> trong danh sách", async () => (await personalItems().filter({ hasText: "<b>đậm</b> & <script>alert(1)</script>" }).count()) === 1 && (await pg.locator("[data-week-item=personal] b, [data-week-item=personal] script").count()) === 0, 30000);
  let failWrite = true;
  await pg.route(u => u.pathname === "/api/student/lich-rieng" && failWrite, r => (r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.continue()));
  await pg.locator("[data-add-personal]").click(); await form.waitFor({ timeout: 30000 });
  await pg.fill("#pe-title", "Việc lúc máy chủ lỗi"); await pg.fill("#pe-note", "đừng mất ghi chú này");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("máy chủ lỗi → báo lỗi bằng chữ, form VẪN MỞ và giữ nguyên tên + ghi chú đang gõ", async () => /Chưa lưu được/.test(await pg.locator("[data-personal-error]").innerText()) && (await pg.locator("#pe-title").inputValue()) === "Việc lúc máy chủ lỗi" && (await pg.locator("#pe-note").inputValue()) === "đừng mất ghi chú này", 20000);
  failWrite = false;
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("bấm Lưu lại khi máy chủ ổn → lưu được", async () => (await form.count()) === 0 && (await personalItems().filter({ hasText: "Việc lúc máy chủ lỗi" }).count()) === 1, 30000);

  section("Xoá có hộp xác nhận KiN");
  const before = (await rows()).length;
  await personalItems().filter({ hasText: "Việc lúc máy chủ lỗi" }).getByRole("button", { name: /^Xoá/ }).click();
  const dlg = pg.getByRole("dialog", { name: "Xoá việc riêng này?" });
  await dlg.waitFor({ timeout: 30000 });
  check("hộp xác nhận KiN (không phải window.confirm) nêu tên việc", /Việc lúc máy chủ lỗi/.test(await dlg.innerText()));
  await dlg.getByRole("button", { name: "Huỷ" }).click();
  check("bấm Huỷ → việc còn nguyên, bản ghi còn", (await personalItems().filter({ hasText: "Việc lúc máy chủ lỗi" }).count()) === 1 && (await rows()).length === before);
  await personalItems().filter({ hasText: "Việc lúc máy chủ lỗi" }).getByRole("button", { name: /^Xoá/ }).click();
  await pg.getByRole("dialog", { name: "Xoá việc riêng này?" }).getByRole("button", { name: "Xoá", exact: true }).click();
  await eventually("xác nhận Xoá → việc biến khỏi lịch và cơ sở dữ liệu", async () => (await personalItems().filter({ hasText: "Việc lúc máy chủ lỗi" }).count()) === 0 && (await rows()).length === before - 1, 30000);

  section("Chỉ chủ thấy");
  const c2 = await ctxFor(S2, { width: 1280, height: 900 });
  const p2 = await c2.newPage(); watch(p2);
  await openLich(p2);
  await p2.waitForTimeout(1500);
  check("học sinh khác mở Lịch học: không thấy việc nào của Minh Anh", (await p2.locator("[data-week-item=personal]").count()) === 0 && !/Học thêm Toán/.test(await p2.locator("main").innerText()));
  await c2.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
  await openLich(pm);
  const small = (p: Page) => p.evaluate(`[...document.querySelectorAll('main a, main button, main input, main textarea, main [role=tab]')].filter(e => e.offsetParent && !e.closest('[data-kin-tab-ink]') && e.getBoundingClientRect().width > 0).map(e => [Math.round(e.getBoundingClientRect().height), (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 30)]).filter(([h]) => h < 44)`) as Promise<[number, string][]>;
  check("danh sách ngày: không tràn ngang, mọi nút / liên kết cao ≥ 44px (có 'Sửa', 'Xoá', '+ Thêm việc riêng')", (await overflow(pm)) <= 0 && (await small(pm)).length === 0, [await overflow(pm), (await small(pm)).slice(0, 4)]);
  await pm.locator("[data-add-personal]").click();
  await pm.locator("[data-personal-form]").waitFor({ timeout: 30000 });
  check("form ở 390px: không tràn ngang, mọi ô và nút cao ≥ 44px", (await overflow(pm)) <= 0 && (await small(pm)).length === 0, [await overflow(pm), (await small(pm)).slice(0, 5)]);
  await shot(pm, "lich-rieng-form-390");
  await cm.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
