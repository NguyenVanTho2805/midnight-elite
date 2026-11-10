// Wizard tạo lớp 3 bước (LO-03) + Thêm học sinh trong chi tiết lớp (LO-09) + tổng hợp link báo cáo cả lớp (LO-13), trình duyệt thật.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-tao-lop-wizard.ts
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), O = await mkTutor("Cô Khác");
  for (const u of [T, O]) await prisma.user.update({ where: { id: u.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const old = await mkCourse(T.id, { name: "Lớp cũ của cô Lan" }), cO = await mkCourse(O.id, { name: "Lớp của cô khác" });
  const A = await mkUser({ name: "Em An Cũ" }), B = await mkUser({ name: "Em Bình Cũ" }), X = await mkUser({ name: "Em Của Cô Khác" }), PAR = await mkUser({ name: "Phụ huynh An" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: old.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: X.id, courseId: cO.id, status: "active" } });
  const link = await prisma.parentLink.create({ data: { parentId: PAR.id, studentId: A.id, status: "verified", verifiedAt: new Date() } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };

  section("Wizard 3 bước");
  const p = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(p);
  await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  const stepOf = async () => p.locator("[data-wizard-step][aria-current=step]").getAttribute("data-wizard-step");
  check("3 bước hiện đủ; đang ở bước 1 'Thông tin', có 'Cách tính học phí'", await p.locator("[data-wizard-step]").count() === 3 && await stepOf() === "1" && await p.getByText("Cách tính học phí").first().isVisible());
  check("bước 1 chưa có nút tạo lớp (chỉ 'Tiếp tục')", await p.getByRole("button", { name: /^Tạo lớp/ }).count() === 0 && await p.getByRole("button", { name: "Tiếp tục" }).isVisible());
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("tên trống → ở lại bước 1, có lỗi", await stepOf() === "1" && await p.locator("p[role=alert]").filter({ hasText: "tên lớp" }).isVisible());
  await p.getByLabel(/Tên lớp/).fill("Toán 9 wizard");
  // HOCPHI-THEO-BUOI: mặc định "Theo buổi"; "Theo giờ" nằm trong mục gập "Cách tính khác" nên phải mở trước.
  check("mặc định là Theo buổi, 'Theo giờ' chưa hiện (đang gập)", await p.getByLabel(/^Theo buổi/).isChecked() && !(await p.getByLabel(/^Theo giờ/).isVisible()));
  await p.locator("[data-fee-other] summary").click();
  await p.getByLabel(/^Theo giờ/).check();
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("theo giờ mà thiếu đơn giá → lỗi, ở lại bước 1 (học phí kiểu mới được kiểm)", await stepOf() === "1" && await p.locator("p[role=alert]").isVisible());
  await p.getByLabel(/^Đơn giá/).fill("150000");
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("sang bước 2 'Lịch học' (BU-01: Thông tin → Lịch học → Cách vào lớp)", await stepOf() === "2" && await p.getByRole("button", { name: "Thêm khung giờ" }).isVisible());
  // TUT-lich-keo-tha: bước Lịch học BẮT BUỘC. 0 khung → "Tiếp tục" bị chặn (trước đây đi tiếp được, nút cuối ghi 'Tạo lớp' 0 buổi).
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("bước 2: chưa có khung giờ → 'Tiếp tục' bị chặn, ở lại bước 2, báo 'ít nhất một khung giờ'", await stepOf() === "2" && await p.locator("p[role=alert]").filter({ hasText: "ít nhất một khung giờ" }).isVisible());
  check("lối thoát duy nhất là liên kết chữ 'Lớp này học buổi lẻ, không lặp hằng tuần'", await p.locator("[data-one-off]").isVisible() && (await p.locator("[data-one-off]").innerText()).includes("Lớp này học buổi lẻ"));
  check("bước 2 hiện nhãn 'Bắt buộc' và câu rỗng 'Lớp chưa có lịch học'", await p.locator("[data-wizard-schedule]").getByText("Bắt buộc").isVisible() && await p.locator("[data-empty-hint]").isVisible());
  await p.getByRole("button", { name: "Thêm khung giờ" }).click();
  await p.locator("[data-block-panel] select").first().selectOption("2");
  await p.locator("#sched-s").selectOption("1140"); await p.locator("#sched-e").selectOption("1230");
  await p.getByRole("button", { name: "Lưu khung giờ" }).click();
  await p.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 10000 });
  await p.getByLabel("Buổi đầu từ ngày").fill("2026-10-26");
  await p.getByLabel("Xem trước số tuần").selectOption("4");
  check("thứ Ba × 4 tuần từ 26/10 → có câu giải thích 4 buổi ra từ lịch tuần; tóm tắt 'Thứ Ba 19:00–20:30'", await p.getByText(/có 4 buổi\. Buổi học sinh ra từ lịch tuần/).isVisible() && (await p.locator("[data-wizard-slot]").first().innerText()).includes("Thứ Ba 19:00–20:30"));
  await p.getByRole("button", { name: "Thêm khung giờ" }).click();
  await p.locator("[data-block-panel] select").first().selectOption("2");
  await p.locator("#sched-s").selectOption("1140"); await p.locator("#sched-e").selectOption("1230");
  await p.getByRole("button", { name: "Lưu khung giờ" }).click();
  await p.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 10000 });
  check("thêm khung thứ hai (cùng giờ, cùng ngày) → có 2 khung trong tóm tắt", await p.locator("[data-wizard-slot]").count() === 2);
  const lopTruoc = await prisma.course.count({ where: { ownerId: T.id } });
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("hai khung TRÙNG CHÍNH XÁC → 'Tiếp tục' báo lỗi 'trùng nhau', ở lại bước 2, KHÔNG tạo lớp", await stepOf() === "2" && await p.locator("p[role=alert]").filter({ hasText: "trùng" }).isVisible() && await prisma.course.count({ where: { ownerId: T.id } }) === lopTruoc);
  await p.locator("[data-block-id]").nth(1).click();
  await p.getByRole("button", { name: "Bỏ khung giờ này" }).click();
  check("bỏ khung thứ hai bằng panel (cục bộ, chưa gọi máy chủ) → còn 1 khung", await p.locator("[data-wizard-slot]").count() === 1);
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("bước 3: nút 'Tạo lớp + 4 buổi'", await stepOf() === "3" && await p.getByRole("button", { name: /^Tạo lớp \+ \d+ buổi$/ }).isVisible());
  // Em đã học lớp khác của cô nằm trong mục gập ở bước 3.
  await p.locator("[data-wizard-students] summary").click();
  check("mục gập có chọn em đã học lớp khác", await p.getByText("Chọn em đã học một lớp khác của cô").isVisible());
  const rows = p.locator("[data-picker-row]");
  await rows.first().waitFor({ timeout: 30000 });
  check("danh sách chỉ có em của cô Lan (An, Bình); KHÔNG có em của cô khác", await rows.count() === 2 && await p.getByText("Em Của Cô Khác").count() === 0);
  await p.getByLabel("Tìm trong học sinh của cô").fill("an cũ");
  check("tìm 'an cũ' → 1 em", await rows.count() === 1);
  await p.getByLabel("Tìm trong học sinh của cô").fill("");
  await rows.filter({ hasText: "Em An Cũ" }).getByRole("checkbox").check();
  await rows.filter({ hasText: "Em Bình Cũ" }).getByRole("checkbox").check();
  check("đã chọn 2 em", await p.getByText("Đã chọn 2 em.").isVisible());
  await shot(p, "tao-lop-wizard");
  await p.getByRole("button", { name: "Quay lại" }).click();
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await p.locator("[data-wizard-students] summary").click();
  check("Quay lại rồi Tiếp tục → lựa chọn 2 em còn nguyên (giữ trong wizard)", await rows.filter({ hasText: "Em An Cũ" }).getByRole("checkbox").isChecked());
  await p.getByRole("button", { name: "Tạo lớp + 4 buổi" }).click();
  await p.waitForURL(/\/lop-cua-toi\/quan-lop\/toan-9-wizard/, { timeout: 90000 });
  const made = await prisma.course.findFirstOrThrow({ where: { ownerId: T.id, name: "Toán 9 wizard" } });
  const rate = await prisma.courseFeeRate.findFirst({ where: { courseId: made.id } });
  check("DB: lớp của cô Lan, học phí theo giờ 150.000 (đơn giá lưu ở CourseFeeRate, một buổi 90 phút)", made.ownerId === T.id && made.feeMode === "per_hour" && rate?.rate === 150000 && rate?.sessionMinutes === 90, { m: made.feeMode, r: rate });
  await eventually("DB: khung giờ T3 19:00–20:30 (đúng 1 khung)", async () => (await prisma.classSchedule.count({ where: { courseId: made.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30" } })) === 1);
  await eventually("DB: 2 em ghi danh vào lớp mới (active)", async () => (await prisma.enrollment.count({ where: { courseId: made.id, status: "active", userId: { in: [A.id, B.id] } } })) === 2);
  check("tới trang lớp, mục Mã mời (tab Học sinh) mở sẵn + thông báo 'Đã thêm 2 học sinh'", /muc=ma-moi/.test(p.url()) && (await p.getByRole("navigation", { name: "Mục của Học sinh" }).locator("[aria-current=page]").innerText()).trim() === "Mã mời" && await p.getByText("Đã thêm 2 học sinh vào lớp").isVisible());
  check("em của cô khác KHÔNG bị ghi danh", await prisma.enrollment.count({ where: { courseId: made.id, userId: X.id } }) === 0);

  section("Lối thoát 'Lớp này học buổi lẻ': KinConfirm → tạo lớp KHÔNG khung (scheduleCount=0)");
  const o = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(o);
  let nativeDialogs = 0; o.on("dialog", d => { nativeDialogs++; void d.dismiss(); });
  await o.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await o.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  await o.getByLabel(/Tên lớp/).fill("Lớp buổi lẻ");
  await o.getByRole("radio", { name: /^Miễn phí/ }).check();
  await o.getByRole("button", { name: "Tiếp tục" }).click();
  await o.locator("[data-one-off]").click();
  const dlg = o.getByRole("dialog").filter({ hasText: "Tạo lớp không có lịch cố định?" });
  await dlg.waitFor({ timeout: 10000 });
  check("KinConfirm nêu hệ quả: 'KiN sẽ nhắc cô ở Hộp việc cho tới khi cô đặt lịch'; không window.confirm", (await dlg.innerText()).includes("KiN sẽ nhắc cô ở Hộp việc") && nativeDialogs === 0);
  await dlg.getByRole("button", { name: "Quay lại" }).click();
  await o.getByRole("button", { name: "Tiếp tục" }).click();
  check("bấm 'Quay lại' trong hộp → chưa chọn gì, 'Tiếp tục' vẫn bị chặn ở bước 2", await o.locator("[data-wizard-step][aria-current=step]").getAttribute("data-wizard-step") === "2");
  await o.locator("[data-one-off]").click();
  await o.getByRole("button", { name: "Vẫn tạo không lịch" }).click();
  check("chọn 'Vẫn tạo không lịch' → tóm tắt nói lớp buổi lẻ, liên kết thoát biến mất", (await o.locator("[data-wizard-summary]").innerText()).includes("buổi lẻ") && await o.locator("[data-one-off]").count() === 0);
  await o.getByRole("button", { name: "Tiếp tục" }).click();
  await o.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await o.waitForURL(/\/lop-cua-toi\/quan-lop\/lop-buoi-le/, { timeout: 90000 });
  const le = await prisma.course.findFirstOrThrow({ where: { ownerId: T.id, name: "Lớp buổi lẻ" } });
  check("DB: lớp buổi lẻ được tạo, 0 khung giờ", (await prisma.classSchedule.count({ where: { courseId: le.id } })) === 0);
  await o.goto(`${BASE}/lop-cua-toi/quan-lop/${le.id}/giao-trinh`, { waitUntil: "networkidle", timeout: 120000 });
  await o.locator("[data-gt-chua-co-lich]").waitFor({ timeout: 90000 });
  check("GS-LOP-GON: đầu Giáo trình nhắc 'Lớp chưa có lịch học' + liên kết 'Đặt lịch học' → tab Lịch học", await o.locator("[data-gt-chua-co-lich]").isVisible() && (await o.getByRole("link", { name: "Đặt lịch học" }).getAttribute("href")) === `/lop-cua-toi/quan-lop/${le.id}/lich-hoc`);

  section("LO-09: nút 'Thêm học sinh' trong chi tiết lớp");
  const cNew = await mkCourse(T.id, { name: "Lớp trống" });
  const q = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(q);
  await q.goto(`${BASE}/lop-cua-toi/quan-lop/${cNew.id}/hoc-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await q.getByRole("navigation", { name: "Mục của Học sinh" }).getByRole("link", { name: "Thêm học sinh", exact: true }).click();
  await q.waitForURL(/muc=them/, { timeout: 90000 });
  check("GS-LOP-GON: bấm → mục 'Thêm học sinh' (tab Học sinh) mở khung chọn em", await q.locator("[data-lop-them]").isVisible());
  await q.locator("[data-picker-row]").first().waitFor({ timeout: 30000 });
  check("danh sách em có thể thêm: An, Bình (đã học lớp của cô), không có em cô khác", await q.locator("[data-picker-row]").count() === 2 && await q.getByText("Em Của Cô Khác").count() === 0, await q.locator("[data-picker-row]").count());
  await q.locator("[data-picker-row]").filter({ hasText: "Em Bình Cũ" }).getByRole("checkbox").check();
  await q.getByRole("button", { name: "Thêm 1 em vào lớp" }).click();
  await eventually("DB: Bình vào lớp trống", async () => (await prisma.enrollment.count({ where: { courseId: cNew.id, userId: B.id, status: "active" } })) === 1);
  await q.getByText("Đã thêm 1 em vào lớp.").waitFor({ timeout: 30000 });
  await q.getByRole("link", { name: "Xem danh bạ lớp" }).click();
  await q.waitForURL(url => url.pathname.endsWith("/hoc-vien") && !url.search.includes("muc="), { timeout: 90000 });
  await eventually("sau khi thêm: Bình hiện trong danh bạ lớp", async () => q.locator("text=Em Bình Cũ >> visible=true").first().isVisible());

  section("LO-13: tổng hợp link báo cáo của cả lớp");
  const r = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(r);
  await r.goto(`${BASE}/lop-cua-toi/quan-lop/${old.id}/hoc-vien`, { waitUntil: "networkidle", timeout: 120000 }); // GS-LOP-GON: khối link báo cáo nằm ở danh bạ của tab Học sinh
  const brows = r.locator("[data-lop-bao-cao]");
  await brows.first().waitFor({ timeout: 30000 });
  check("2 em; An có phụ huynh liên kết (có nút 'Bật link'), Bình chưa có phụ huynh (nói rõ, không có nút bật)", await brows.count() === 2 && await brows.filter({ hasText: "Em An Cũ" }).getByText("Chưa bật").isVisible() && await brows.filter({ hasText: "Em An Cũ" }).getByRole("button", { name: /^Bật link báo cáo của/ }).isVisible()
    && await brows.filter({ hasText: "Em Bình Cũ" }).getByText("Chưa có phụ huynh liên kết").isVisible() && await brows.filter({ hasText: "Em Bình Cũ" }).getByRole("button", { name: /^Bật link/ }).count() === 0);
  await brows.filter({ hasText: "Em An Cũ" }).getByRole("checkbox").check();
  await r.getByRole("button", { name: "Bật link cho 1 em đã chọn" }).click();
  await r.getByText("Đã bật 1 link báo cáo riêng.").waitFor({ timeout: 30000 });
  const tok = (await prisma.parentLink.findUnique({ where: { id: link.id } }))?.portalToken ?? "";
  check("bật xong: token ngẫu nhiên 32 hex trong DB; dòng An có Copy link, Xem thử (đúng đường dẫn), Thu hồi ngay", /^[0-9a-f]{32}$/.test(tok) && await brows.filter({ hasText: "Em An Cũ" }).getByRole("link", { name: /^Xem thử báo cáo của/ }).getAttribute("href") === `/so-cua-con/${tok}` && await brows.filter({ hasText: "Em An Cũ" }).getByRole("button", { name: /^Thu hồi link báo cáo của/ }).isVisible());
  await brows.filter({ hasText: "Em An Cũ" }).getByRole("button", { name: /^Thu hồi link báo cáo của/ }).click();
  await r.getByRole("button", { name: "Thu hồi ngay" }).last().click();
  await eventually("sau thu hồi: DB token = null", async () => (await prisma.parentLink.findUnique({ where: { id: link.id } }))?.portalToken === null);

  section("Điện thoại 390px");
  const m = await (await ctxFor(T, { width: 390, height: 844 })).newPage(); watch(m);
  for (const path of ["/lop-cua-toi/lop/tao", `/lop-cua-toi/quan-lop/${old.id}/hoc-vien`]) {
    await m.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await m.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 90000 });
    if (path.includes("tao")) { await m.getByLabel(/Tên lớp/).fill("Lớp thử 390"); await m.getByLabel(/^Đơn giá/).fill("120000"); await m.getByRole("button", { name: "Tiếp tục" }).click();
      await m.locator("[data-week-editor]").waitFor({ timeout: 30000 });
      const sm2 = await m.evaluate(`[...document.querySelectorAll('[data-wizard-schedule] button:not([data-block-id]), [data-wizard-schedule] select')].filter(e => e.offsetParent && (e.getBoundingClientRect().height < 43.5 || e.getBoundingClientRect().width < 43.5)).map(e => e.textContent.trim().slice(0,20))`) as string[];
      check("390px bước 2 (Lịch học): không tràn ngang, nút/ô chọn ngày ≥ 44px", (await m.evaluate("document.documentElement.scrollWidth")) as number <= 390 && sm2.length === 0, sm2);
      await m.locator("[data-one-off]").click(); await m.getByRole("button", { name: "Vẫn tạo không lịch" }).click(); await m.getByRole("button", { name: "Tiếp tục" }).click(); await m.locator("[data-wizard-students] summary").click(); await m.locator("[data-picker-row]").first().waitFor({ timeout: 30000 }); }
    else await m.locator("[data-lop-bao-cao]").first().waitFor({ timeout: 30000 });
    const small = await m.evaluate(`[...document.querySelectorAll('main a, main button, main select, main input, [role=tab]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && e.type !== 'checkbox' && !e.closest('nav') && !e.closest('label')).map(e => e.textContent.trim().slice(0,30) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`${path}: không tràn ngang, nút ≥ 44px`, (await m.evaluate("document.documentElement.scrollWidth")) as number <= 390 && small.length === 0, small);
  }
  await shot(m, "tao-lop-wizard-mobile");
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
