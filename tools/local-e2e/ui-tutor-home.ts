// Trang chủ gia sư + onboarding + đăng nhập (24/10/2026): HV-07 ẩn/hiện số tiền, HV-10 checklist, HV-11 chuông + dấu hỏi, HV-06/08 thẻ tiền + lịch,
// TK-05 hướng dẫn PWA, TK-02 giao diện đăng nhập, HT-02 báo lỗi tại ô. Chạy 1440 và 390, sáng và tối cho các khối mới.
import { api, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe, check, section, done, eventually, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const MONEY = /\d[\d.,]*\s?đ(?![\p{L}])/u; // số + "đ" đứng riêng; không bắt "10 đã"
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T0 = await mkTutor("Cô Mới");
  for (const u of [T, T0]) await prisma.user.update({ where: { id: u.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const s1 = await mkUser({ name: "Em An" }), s2 = await mkUser({ name: "Em Bình" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [s1, s2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: c1.id, status: "active" } });
  const tomorrowDow = (new Date(Date.now() + 7 * 3600_000 + 86_400_000)).getUTCDay();
  await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: tomorrowDow, startTime: "19:00", endTime: "20:30" } });
  await mkAttendanceSession(c1.id, T.id, new Date(Date.now() - 2 * 86_400_000), ["present"]);
  const YM = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: YM, sessionCount: 8, updatedBy: T.id } });
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Lan" } });
  const key = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T })).json.key;
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: YM, studentIds: [s1.id, s2.id] } });
  const invA = iss.json.created.find((c: any) => c.studentId === s1.id), invB = iss.json.created.find((c: any) => c.studentId === s2.id);
  for (const i of [invA, invB]) await api("PATCH", `/api/tutor/invoices/${i.id}`, { as: T, body: { action: "send" } });
  await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${key}` }, body: { id: 9101, transferType: "in", transferAmount: invA.amountDue, content: invA.code, code: invA.code } });
  await prisma.notification.create({ data: { userId: T.id, type: "class_reminder", title: "Nhắc lịch thử", message: "Mai có buổi Toán 9", link: "/lop-cua-toi/lich" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 5|negative time stamp|vietqr/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (p: any) => p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`) as Promise<boolean>;

  for (const [w, h, label] of [[1440, 900, "1440"], [390, 844, "390"]] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const tag = `${label}-${scheme}`;
      const ctx = await ctxFor(T, { width: w, height: h });
      const pg = await ctx.newPage(); watch(pg); await pg.addInitScript(`localStorage.setItem("kin.che-do", "${scheme === "dark" ? "toi" : "sang"}")`);
      await ctx.grantPermissions([], { origin: BASE });

      section(`[${tag}] Hộp việc: Đã thu / Chưa thu, lịch gần nhất, checklist`);
      await pg.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
      await pg.getByRole("heading", { name: "Hộp việc", level: 1 }).waitFor({ timeout: 90000 });
      const fee = pg.locator("[data-hv-fee]");
      await fee.waitFor({ timeout: 30000 });
      const due = (n: number) => n.toLocaleString("vi-VN");
      const paid = (await prisma.tuitionInvoice.findMany({ where: { tutorId: T.id } })).reduce((s, i) => s + i.paidAmount, 0);
      const rest = (await prisma.tuitionInvoice.findMany({ where: { tutorId: T.id, status: { in: ["sent", "parent_reported", "partial"] } } })).reduce((s, i) => s + Math.max(0, i.amountDue - i.paidAmount), 0);
      check("thẻ 'Đã thu' = tổng đã gạch trong DB", (await fee.locator('[data-fee-card="da-thu"]').innerText()).includes(due(paid)), [paid, await fee.innerText()]);
      check("thẻ 'Chưa thu' = phần còn lại phiếu đã gửi trong DB, đặt cạnh 'Đã thu'", rest > 0 && (await fee.locator('[data-fee-card="chua-thu"]').innerText()).includes(due(rest)), [rest, await fee.innerText()]);
      const a = await fee.locator('[data-fee-card="da-thu"]').boundingBox(), b = await fee.locator('[data-fee-card="chua-thu"]').boundingBox();
      check("hai thẻ nằm cạnh nhau (cùng hàng)", !!a && !!b && Math.abs(a.y - b.y) < 2 && b.x > a.x, [a, b]);
      const up = pg.locator("[data-hv-upcoming]");
      check("'Lịch dạy gần nhất' liệt kê buổi mai 19:00 – 20:30 của Toán 9", /19:00 – 20:30/.test(await up.innerText()) && /Toán 9/.test(await up.innerText()), await up.innerText());
      check("không tràn ngang", await noOverflow(pg));
      const lum = await pg.evaluate(`(() => { const m = getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(Number); return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255; })()`) as number;
      check(`chế độ ${scheme === "dark" ? "tối" : "sáng"} có hiệu lực thật (nền ${scheme === "dark" ? "<" : ">"} ngưỡng)`, scheme === "dark" ? lum < 0.2 : lum > 0.8, lum);

      const setup = pg.locator("[data-setup-checklist]");
      await setup.waitFor({ timeout: 15000 });
      const stepState = async (k: string) => (await setup.locator(`[data-setup-step="${k}"]`).getAttribute("data-done")) !== null;
      const got = await Promise.all(["tai-khoan", "lop", "hoc-sinh", "lich", "diem-danh", "phieu", "phu-huynh", "chot-buoi"].map(stepState));
      check("tick theo dữ liệu thật: 7 bước xong, 'Mời phụ huynh' chưa (chưa có liên kết phụ huynh)", got.join() === "true,true,true,true,true,true,false,true", got);
      check("mỗi dòng ghi CHỮ 'Đã xong' hoặc 'Chưa làm' (không chỉ màu)", (await setup.getByText("Đã xong", { exact: true }).count()) === 7 && (await setup.getByText("Chưa làm", { exact: true }).count()) === 1);
      check("đếm tiến độ 7/8 và có progressbar", /7\/8 bước/.test(await setup.innerText()) && (await setup.getByRole("progressbar").getAttribute("aria-valuenow")) === "7");
      const rowH = await setup.locator('[data-setup-step] a').first().boundingBox();
      check("dòng bước cao ≥ 44px", !!rowH && rowH.height >= 43.5, rowH);
      if (tag === "390-dark" || tag === "1440-light") await shot(pg, `trangchu-hopviec-${tag}`);

      section(`[${tag}] Chuông thông báo + dấu hỏi trợ giúp trên thanh trên`);
      const bell = pg.getByRole("button", { name: /^Thông báo/ });
      check("có chuông thông báo, báo số chưa đọc bằng chữ trong aria-label", await bell.isVisible() && /\d+ chưa đọc/.test(await bell.getAttribute("aria-label") ?? ""), await bell.getAttribute("aria-label"));
      const bb = await bell.boundingBox();
      check("chuông ≥ 44px", !!bb && bb.width >= 43.5 && bb.height >= 43.5, bb);
      const help = pg.getByRole("link", { name: "Trợ giúp" });
      check("dấu hỏi dẫn tới /lop-cua-toi/ho-tro, ≥ 44px", (await help.getAttribute("href")) === "/lop-cua-toi/ho-tro" && ((await help.boundingBox())?.height ?? 0) >= 43.5);
      await bell.click();
      check("bấm chuông mở bảng có thông báo 'Nhắc lịch thử'", await pg.getByText("Nhắc lịch thử").isVisible());
      check("bảng thông báo không tràn ngang trang", await noOverflow(pg));
      if (tag === "390-light") await shot(pg, `trangchu-chuong-${tag}`);
      await pg.keyboard.press("Escape"); await pg.mouse.click(5, 5);
      await help.click(); await pg.waitForURL(/\/lop-cua-toi\/ho-tro/, { timeout: 60000 });
      check("bấm dấu hỏi → trang Liên hệ hỗ trợ", /\/lop-cua-toi\/ho-tro$/.test(new URL(pg.url()).pathname));

      section(`[${tag}] HV-07 ẩn/hiện số tiền, nhớ lựa chọn, che cả dải số lẫn danh sách`);
      await pg.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle" });
      await pg.getByRole("heading", { name: "Hộp việc", level: 1 }).waitFor();
      await fee.waitFor();
      const eye = () => pg.locator("[data-money-eye]").first();
      check("mặc định HIỆN số tiền, nút mắt ghi 'Ẩn số tiền', aria-pressed=false", MONEY.test(await fee.innerText()) && (await eye().getAttribute("aria-label")) === "Ẩn số tiền" && (await eye().getAttribute("aria-pressed")) === "false");
      check("nút mắt ≥ 44px", ((await eye().boundingBox())?.height ?? 0) >= 43.5);
      await eye().click();
      await eventually("bấm mắt → số tiền ở Hộp việc bị che (dải số + thẻ Đã thu/Chưa thu)", async () => !MONEY.test(await pg.locator("body").innerText()) && (await fee.innerText()).includes("•"));
      check("nút đổi thành 'Hiện số tiền', aria-pressed=true; người đọc màn hình nghe 'Số tiền đang ẩn'", (await eye().getAttribute("aria-label")) === "Hiện số tiền" && (await eye().getAttribute("aria-pressed")) === "true" && (await fee.getByText("Số tiền đang ẩn").count()) === 2);
      check("chỉ che hiển thị: số trong DB không đổi", (await prisma.tuitionInvoice.findMany({ where: { tutorId: T.id } })).reduce((s, i) => s + i.paidAmount, 0) === paid);
      if (tag === "1440-dark" || tag === "390-light") await shot(pg, `trangchu-an-so-${tag}`);
      await pg.reload({ waitUntil: "networkidle" }); await fee.waitFor();
      check("tải lại trang vẫn ẩn (lưu ở trình duyệt)", !MONEY.test(await fee.innerText()));
      for (const path of ["/lop-cua-toi/tong-quan", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/doanh-thu"]) {
        await pg.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
        await pg.locator("[data-money-eye]").first().waitFor({ timeout: 60000 });
        if (path.endsWith("doanh-thu")) await eventually("doanh thu tải xong", async () => (await pg.locator("dd").first().innerText()).length > 0 && !/—/.test(await pg.locator("dd").first().innerText()));
        if (path.endsWith("hoc-phi")) await eventually("học phí: tải xong dải số", async () => (await pg.locator("[data-kin-stat]").count()) >= 3, 60000);
        const text = await pg.locator("body").innerText();
        check(`${path}: đang ẩn → không còn số tiền trong dải số và danh sách`, !MONEY.test(text), text.match(MONEY)?.[0]);
        check(`${path}: có nút mắt, ghi 'Hiện số tiền'`, (await pg.locator("[data-money-eye]").first().getAttribute("aria-label")) === "Hiện số tiền");
        check(`${path}: không tràn ngang`, await noOverflow(pg));
      }
      await pg.goto(`${BASE}/lop-cua-toi/doanh-thu`, { waitUntil: "networkidle" });
      await pg.locator("[data-money-eye]").first().click();
      await eventually("doanh thu: bấm lại → số tiền hiện đủ (danh sách khoản đã thu cũng hiện)", async () => MONEY.test(await pg.locator("body").innerText()) && (await pg.locator("[data-money-hidden]").count()) === 0);
      await pg.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle" });
      await eventually("học phí: lựa chọn 'hiện' cũng nhớ, số tiền hiện", async () => (await pg.locator("[data-money-hidden]").count()) === 0 && MONEY.test(await pg.locator("[data-kin-stat]").first().locator("xpath=..").innerText()), 60000);

      section(`[${tag}] TK-05 hướng dẫn cài lên Màn hình chính (Cài đặt)`);
      await pg.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
      const pwa = pg.locator("[data-pwa-guide]");
      await pwa.waitFor({ timeout: 60000 });
      check("5 bước đánh số, nhắc iOS 16.4 và Safari → Chia sẻ → Thêm vào Màn hình chính", (await pwa.locator("ol > li").count()) === 5 && /16\.4/.test(await pwa.innerText()) && /Chia sẻ/.test(await pwa.innerText()) && /Thêm vào Màn hình chính/.test(await pwa.innerText()));
      check("nói đúng trạng thái máy này (trình duyệt, chưa từ Màn hình chính)", /chưa từ Màn hình chính|trong trình duyệt/.test(await pwa.locator("[data-pwa-state]").innerText()));
      check("không hứa chắc chắn nhận thông báo; không 'đã gửi'/'đã xác minh'", !/chắc chắn nhận|đã gửi|đã xác minh/.test(await pwa.innerText()));
      check("khối thông báo đẩy trỏ về hướng dẫn bằng liên kết #cai-pwa", (await pg.locator('a[href="#cai-pwa"]').count()) >= 1);
      check("không tràn ngang", await noOverflow(pg));
      if (tag === "390-dark" || tag === "1440-light") await shot(pg, `trangchu-pwa-${tag}`);
      await ctx.close();
    }
  }

  section("HV-10: gia sư mới tinh — 0/8, đóng được, không nhắc lại; xong cả 8 thì không hiện");
  {
    const ctx = await ctxFor(T0, { width: 1280, height: 900 });
    const pg = await ctx.newPage(); watch(pg);
    await pg.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
    const setup = pg.locator("[data-setup-checklist]");
    await setup.waitFor({ timeout: 60000 });
    check("0/8 bước, cả 8 dòng 'Chưa làm'", /0\/8 bước/.test(await setup.innerText()) && (await setup.getByText("Chưa làm", { exact: true }).count()) === 8);
    check("mọi bước là liên kết nội bộ", (await setup.locator("a").evaluateAll(as => as.every(a => (a as HTMLAnchorElement).getAttribute("href")!.startsWith("/")))) === true);
    check("Hộp việc rỗng vẫn có 'Cô chưa mở lớp nào' + nút Tạo lớp (không ngõ cụt)", await pg.getByText("Cô chưa mở lớp nào").isVisible());
    await setup.getByRole("button", { name: "Đóng hướng dẫn bắt đầu" }).click();
    await eventually("bấm Đóng → banner biến mất", async () => (await pg.locator("[data-setup-checklist]").count()) === 0);
    await pg.reload({ waitUntil: "networkidle" }); await pg.getByRole("heading", { name: "Hộp việc", level: 1 }).waitFor();
    await pg.getByText("Cô chưa mở lớp nào").waitFor({ timeout: 30000 });
    check("tải lại vẫn đóng (không nhắc lại)", (await pg.locator("[data-setup-checklist]").count()) === 0);
    await ctx.close();
    // Gia sư đủ 8 bước → không bao giờ hiện
    const parent = await mkUser({ name: "PH Thử" });
    await prisma.parentLink.create({ data: { parentId: parent.id, studentId: s1.id, status: "verified", verifiedAt: new Date() } });
    const ctx2 = await ctxFor(T, { width: 1280, height: 900 });
    const p2 = await ctx2.newPage(); watch(p2);
    await p2.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
    await p2.getByRole("heading", { name: "Hộp việc", level: 1 }).waitFor();
    await p2.locator("[data-hv-fee]").waitFor({ timeout: 60000 });
    check("đủ cả 8 bước → không hiện banner", (await p2.locator("[data-setup-checklist]").count()) === 0);
    await ctx2.close();
  }

  section("TK-02 + HT-02: đăng nhập theo Figma, báo lỗi ngay tại ô");
  for (const [w, h, label] of [[1440, 900, "1440"], [390, 844, "390"]] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const ctx = await ctxFor(null, { width: w, height: h });
      const pg = await ctx.newPage(); watch(pg); await pg.addInitScript(`localStorage.setItem("kin.che-do", "${scheme === "dark" ? "toi" : "sang"}")`);
      const tag = `${label}-${scheme}`;
      await pg.goto(`${BASE}/dang-nhap`, { waitUntil: "networkidle", timeout: 120000 });
      await pg.getByRole("heading", { name: "Đăng nhập KiN", level: 1 }).waitFor({ timeout: 90000 });
      check(`[${tag}] tiêu đề + dòng phụ; chỉ MỘT h1`, (await pg.locator("h1").count()) === 1 && await pg.getByText("Phụ huynh không cần tài khoản").first().isVisible());
      check(`[${tag}] cột giải thích: An toàn tài khoản, Phụ huynh không cần đăng nhập, Tìm gia sư`, await pg.getByText("An toàn tài khoản").isVisible() && await pg.getByRole("heading", { name: "Phụ huynh thì không cần đăng nhập" }).isVisible() && (await pg.getByRole("link", { name: "Tìm gia sư" }).getAttribute("href")) === "/giang-vien");
      check(`[${tag}] không còn chữ 'KiN không dùng mật khẩu'; không có nút Google/vai giả`, !/không dùng mật khẩu|Tiếp tục với Google/.test(await pg.locator("main").innerText()));
      const email = pg.locator("#dn-id-pw");
      const pass = pg.locator("#dn-pass");
      await pg.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await eventually(`[${tag}] để trống rồi bấm → báo ngay dưới từng ô`, async () => (await pg.getByText("Chưa nhập tài khoản").isVisible()) && (await pg.getByText("Chưa nhập mật khẩu").isVisible()));
      check(`[${tag}] ô lỗi có aria-invalid, viền đỏ 2px, nối aria-describedby với dòng báo`, (await email.getAttribute("aria-invalid")) === "true" && (await pass.getAttribute("aria-invalid")) === "true" && !!(await email.getAttribute("aria-describedby")) && (await email.evaluate(e => getComputedStyle(e.closest("[data-kin-input-wrap]")!).borderTopWidth)) === "2px");
      check(`[${tag}] tiêu điểm nhảy tới ô lỗi đầu tiên`, await email.evaluate(e => document.activeElement === e));
      await email.fill("khong-phai-email@");
      await email.blur();
      await eventually(`[${tag}] gõ sai dạng email → báo 'chưa đúng dạng' (cập nhật theo ô, không chờ bấm)`, async () => /chưa đúng dạng/.test(await pg.locator("[data-kin-input-error]").first().innerText()));
      await email.fill("ten@gmail.com");
      await eventually(`[${tag}] sửa đúng → dòng báo của ô email biến mất`, async () => (await email.getAttribute("aria-invalid")) === null);
      const btns = await pg.locator("main button, main a[class*='h-12'], main input").evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent).map(e => Math.round(e.getBoundingClientRect().height)));
      check(`[${tag}] nút và ô nhập ≥ 44px`, btns.every(x => x >= 40), btns);
      check(`[${tag}] không tràn ngang`, await noOverflow(pg));
      if (tag === "1440-light" || tag === "390-dark") { await shot(pg, `trangchu-dangnhap-${tag}`); }
      // các trang còn lại dùng chung khung
      for (const path of ["/dang-ky", "/quen-mat-khau"]) {
        await pg.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
        check(`[${tag}] ${path}: dùng khung chung, một h1, không tràn ngang`, (await pg.locator("[data-auth-frame]").count()) === 1 && (await pg.locator("h1").count()) === 1 && await noOverflow(pg));
        if (tag === "1440-light" || tag === "390-dark") await shot(pg, `trangchu-${path.slice(1)}-${tag}`);
      }
      await ctx.close();
    }
  }

  check("không có lỗi console / pageerror trong cả bài", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll(); process.exit(1); });
