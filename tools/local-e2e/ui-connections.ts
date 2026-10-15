import { BASE, api, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const vnTomorrowDow = () => new Date(Date.now() + 86400_000 + 7 * 3600_000).getUTCDay();

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await prisma.user.update({ where: { id: T.id }, data: { tutorVerified: true, phone: "0901234567", preferences: { modules: ["hop-viec", "lop"] } } });
  const NP = await mkTutor("Thầy Không SĐT");
  await prisma.user.update({ where: { id: NP.id }, data: { tutorVerified: true, phone: null } });
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" }), C = await mkUser({ name: "Em Chi" });
  await prisma.user.update({ where: { id: A.id }, data: { parentName: "Hoa", parentPhone: "0911111111" } });
  const toan = await mkCourse(T.id, { name: "Toán 9" }), ly = await mkCourse(T.id, { name: "Lý 9" });
  await mkCourse(NP.id, { name: "Hoá 9" });
  for (const u of [A, B, C]) await prisma.enrollment.create({ data: { userId: u.id, courseId: toan.id, status: "active" } });
  await prisma.classSchedule.create({ data: { courseId: toan.id, dayOfWeek: vnTomorrowDow(), startTime: "19:00", endTime: "20:30", active: true, joinUrl: "https://meet.example.com/toan9" } });

  await launch();
  const ctx = await ctxFor(T);
  const opened: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me|m\.me)\//, route => { opened.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>ext</title>" }); });
  await ctx.addInitScript(() => {
    const orig = document.execCommand.bind(document);
    (document as any).execCommand = (cmd: string, ...a: any[]) => { if (cmd === "copy") (window as any).__copied = (document.querySelector("textarea[readonly]") as HTMLTextAreaElement | null)?.value ?? ""; return orig(cmd, ...a); };
  });
  // 14/10: gia sư nay ở tên miền chính (localhost = ngữ cảnh an toàn) nên zaloShare dùng navigator.clipboard thay vì execCommand dự phòng — bắt cả hai đường.
  await ctx.addInitScript(() => {
    try {
      const c = navigator.clipboard;
      if (c && c.writeText) { const ow = c.writeText.bind(c); c.writeText = (t: string) => { (window as any).__copied = t; return ow(t).catch(() => {}); }; }
    } catch { /* không có clipboard */ }
  });
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|zalo|m\.me/i.test(m.text())) errors.push(m.text()); }); };
  const copied = (p: any) => p.evaluate(() => (window as any).__copied ?? "");

  section("Cài đặt → Kết nối");
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Kết nối" }).waitFor({ timeout: 90000 });
  check("Đăng nhập Zalo: ghi rõ 'chưa mở' và vì sao (không trả số điện thoại)", await page.getByText(/Đăng nhập bằng Zalo/).isVisible() && await page.getByText(/không trả về số điện thoại/).isVisible());
  check("Zalo OA: 'đang khoá', chờ pháp nhân", await page.getByText(/Zalo OA/).first().isVisible() && await page.getByText(/mở khi KiN có pháp nhân/).isVisible());
  const sw = page.getByRole("switch", { name: /Hiện số Zalo trên hồ sơ công khai/ });
  check("'Hiện số Zalo' TẮT sẵn, cảnh báo sẽ lộ số 0901234567", !(await sw.isChecked()) && await page.getByText(/số điện thoại của bạn sẽ lộ ra/).isVisible());
  const inpToan = page.getByLabel("Toán 9", { exact: true }), inpLy = page.getByLabel("Lý 9", { exact: true });
  check("mỗi lớp một ô link nhóm; nút Lưu khoá khi chưa sửa", await inpToan.isVisible() && await inpLy.isVisible() && await page.getByRole("button", { name: "Lưu" }).first().isDisabled());

  section("Link nhóm Zalo của lớp");
  await inpToan.fill("https://zalo.me/g/abc");
  await page.getByRole("button", { name: "Lưu" }).first().click();
  check("link sai dạng → báo lỗi, chưa lưu", await page.getByRole("alert").filter({ hasText: "https://zalo.me/g/" }).isVisible() && (await prisma.course.findUnique({ where: { id: toan.id } }))?.zaloGroupUrl === null);
  await inpToan.fill("http://evil.com/g/abcxyz");
  await page.getByRole("button", { name: "Lưu" }).first().click();
  check("host lạ → từ chối", await page.getByRole("alert").filter({ hasText: "https://zalo.me/g/" }).isVisible() && (await prisma.course.findUnique({ where: { id: toan.id } }))?.zaloGroupUrl === null);
  await inpToan.fill("https://zalo.me/g/toan9lop/?x=1");
  await page.getByRole("button", { name: "Lưu" }).first().click();
  await eventually("lưu link đã chuẩn hoá + báo 'Đã gắn nhóm Zalo'", async () => (await prisma.course.findUnique({ where: { id: toan.id } }))?.zaloGroupUrl === "https://zalo.me/g/toan9lop" && await page.getByText("Đã gắn nhóm Zalo cho lớp này.").isVisible());
  check("ô hiện lại bản đã chuẩn hoá", (await inpToan.inputValue()) === "https://zalo.me/g/toan9lop");

  section("Messenger + hiện số Zalo");
  const msg = page.getByLabel("Tên trang Messenger");
  await msg.fill("gia su lan");
  await page.getByRole("button", { name: "Lưu" }).last().click();
  check("tên có khoảng trắng → báo lỗi", await page.getByRole("alert").filter({ hasText: "Tên trang chỉ gồm" }).isVisible());
  await msg.fill("https://m.me/gia.su.lan");
  await page.getByRole("button", { name: "Lưu" }).last().click();
  await eventually("lưu messenger (chuẩn hoá) + hiện link m.me", async () => (await page.getByText("Link: https://m.me/gia.su.lan").isVisible()) && JSON.stringify((await prisma.user.findUnique({ where: { id: T.id } }))?.preferences).includes("gia.su.lan"));
  await sw.check();
  await eventually("bật hiện số Zalo → lưu vào tài khoản", async () => JSON.stringify((await prisma.user.findUnique({ where: { id: T.id } }))?.preferences).includes('"showZalo":true'));
  await shot(page, "connections-settings");
  const pub = await ctx.newPage(); watch(pub);
  await pub.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pub.getByRole("heading", { name: "Cô Lan" }).waitFor({ timeout: 60000 });
  check("hồ sơ công khai: số Zalo + nút Nhắn Zalo", await pub.getByText("0901234567").isVisible() && (await pub.getByRole("link", { name: "Nhắn Zalo" }).getAttribute("href")) === "https://zalo.me/0901234567");
  const mHref = (await pub.getByRole("link", { name: "Nhắn Messenger" }).getAttribute("href")) ?? "";
  check("nút Nhắn Messenger → m.me/<tên>?text=… có tin điền sẵn", mHref.startsWith("https://m.me/gia.su.lan?text=") && decodeURIComponent(mHref).includes("Chào Cô Lan"), mHref);
  await sw.uncheck();
  await eventually("tắt lại → ẩn số", async () => JSON.stringify((await prisma.user.findUnique({ where: { id: T.id } }))?.preferences).includes('"showZalo":false'));

  section("Gia sư chưa có số điện thoại: không bật được");
  const npctx = await ctxFor(NP);
  const np = await npctx.newPage(); watch(np);
  await np.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
  await np.getByRole("heading", { name: "Kết nối" }).waitFor({ timeout: 60000 });
  check("công tắc bị khoá + giải thích", await np.getByRole("switch", { name: /Hiện số Zalo/ }).isDisabled() && await np.getByText(/chưa có số điện thoại hợp lệ/).isVisible());

  section("Điểm danh: tin CHUNG vào nhóm Zalo lớp");
  const ap = await ctx.newPage(); watch(ap);
  await ap.goto(`${BASE}/admin/khoa-hoc/${toan.id}/diem-danh`, { waitUntil: "networkidle", timeout: 120000 });
  await ap.getByRole("heading", { name: "Điểm danh" }).waitFor({ timeout: 90000 });
  await ap.getByRole("button", { name: "Tạo buổi điểm danh" }).click();
  await ap.getByText("Em An").waitFor({ timeout: 30000 });
  const grpBtn = ap.getByRole("button", { name: "Nhắn nhóm Zalo lớp" });
  check("chưa điểm danh: nút bị khoá + nhắc 'lưu đủ các em'", await grpBtn.isDisabled() && await ap.getByText(/Điểm danh và lưu đủ các em/).isVisible());
  const row = (n: string) => ap.locator("div.flex.items-center.gap-3", { hasText: n }).last();
  await row("Em An").getByRole("button", { name: /^Có mặt/ }).click();
  await row("Em Bình").getByRole("button", { name: /^Vắng/ }).click();
  await row("Em Chi").getByRole("button", { name: /^Muộn/ }).click();
  check("chọn xong nhưng CHƯA lưu: vẫn khoá", await grpBtn.isDisabled());
  await ap.getByRole("button", { name: "Lưu điểm danh" }).click();
  await ap.getByText(/Đã lưu 3 học viên/).waitFor({ timeout: 15000 });
  await eventually("lưu đủ → nút mở", async () => !(await grpBtn.isDisabled()));
  check("nói rõ đã gắn nhóm Zalo của lớp", await ap.getByText("Đã gắn nhóm Zalo của lớp.").isVisible());
  await grpBtn.click();
  const dlg = ap.getByRole("dialog");
  await dlg.waitFor();
  const ta = dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)");
  const dd = todayLocal().slice(8, 10), mm = todayLocal().slice(5, 7);
  const gt = await ta.inputValue();
  check("Có mặt + Muộn = 2/3 → 'có mặt 2/3 bạn'; KHÔNG tên em nào, không từ 'vắng'", gt === `Buổi Toán 9 ${dd}/${mm}: có mặt 2/3 bạn.` && !/Em |vắng/i.test(gt), gt);
  await dlg.getByRole("button", { name: "Mở Zalo" }).click();
  await dlg.waitFor({ state: "detached", timeout: 20000 });
  await eventually("mở ĐÚNG nhóm Zalo của lớp (zalo.me/g/…), không phải chat theo SĐT", () => opened.some(u => u === "https://zalo.me/g/toan9lop"), 15000);
  check("đã chép tin nhóm", (await copied(ap)) === gt);
  await row("Em Bình").getByRole("button", { name: /^Có mặt/ }).click();
  await ap.getByRole("button", { name: "Lưu điểm danh" }).click();
  await ap.getByText(/Đã lưu 1 học viên/).waitFor({ timeout: 15000 });
  await grpBtn.click();
  await dlg.waitFor();
  check("cả lớp có mặt → 'đủ 3/3 bạn'", (await ta.inputValue()) === `Buổi Toán 9 ${dd}/${mm}: đủ 3/3 bạn.`);
  await ap.keyboard.press("Escape");
  await shot(ap, "connections-attendance");

  section("Lịch: nhắc cả lớp vào nhóm");
  const lp = await ctx.newPage(); watch(lp);
  await lp.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await lp.getByRole("heading", { name: "Lịch", exact: true }).waitFor({ timeout: 90000 });
  await lp.getByRole("button", { name: /Toán 9/ }).first().click();
  const gRem = lp.getByRole("button", { name: "Nhắc cả lớp trong nhóm Zalo" });
  await gRem.waitFor({ timeout: 30000 });
  check("buổi sắp tới có nút + báo đã gắn nhóm + 'không tên em'", await lp.getByText(/Đã gắn nhóm Zalo của lớp\./).isVisible() && await lp.getByText(/Tin chung, không tên em/).isVisible());
  await gRem.click();
  const ld = lp.getByRole("dialog");
  await ld.waitFor();
  const lt = await ld.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue();
  check("tin nhắc chung: 'cả lớp', 19:00 tối mai, link vào lớp, không tên em", /^KiN nhắc lịch: cả lớp có buổi Toán 9 lúc 19:00 tối mai, /.test(lt) && lt.includes("Link vào lớp: https://meet.example.com/toan9") && !/Em |con /.test(lt), lt);
  const before = opened.length;
  await ld.getByRole("button", { name: "Mở Zalo" }).click();
  await ld.waitFor({ state: "detached", timeout: 20000 });
  await eventually("mở đúng nhóm Zalo của lớp", () => opened.length > before && opened[opened.length - 1] === "https://zalo.me/g/toan9lop", 15000);

  section("Báo cáo tháng: tin nhóm chỉ báo 'đã gửi riêng'");
  // dựng 1 báo cáo đã duyệt cho Em An ở tháng trước
  const prev = new Date(Date.now() + 7 * 3600_000); prev.setUTCDate(1); prev.setUTCMonth(prev.getUTCMonth() - 1);
  const ym = prev.toISOString().slice(0, 7);
  const ap1 = await api("POST", `/api/tutor/monthly-reports/${A.id}/approve?yearMonth=${ym}`, { as: T, body: { items: [{ text: "Cần ôn lại phần hàm số.", kind: "tu-viet" }] } });
  check("dựng báo cáo mẫu đã duyệt cho Em An", ap1.status === 200, ap1.json);
  const bp = await ctx.newPage(); watch(bp);
  await bp.goto(`${BASE}/lop-cua-toi/bao-cao-thang`, { waitUntil: "networkidle", timeout: 120000 });
  await bp.getByRole("heading", { name: "Báo cáo tháng" }).waitFor({ timeout: 90000 });
  await bp.getByRole("button", { name: /Tháng trước/ }).click();
  await bp.getByRole("button", { name: /Em An/ }).click();
  const sendBtn = bp.getByRole("button", { name: "Gửi phụ huynh qua Zalo" });
  await sendBtn.waitFor({ timeout: 30000 });
  {
    await sendBtn.click();
    const bd = bp.getByRole("dialog");
    await bd.waitFor();
    check("mặc định 'Chat riêng' (tin có điểm)", await bd.getByRole("radio", { name: "Chat riêng với phụ huynh" }).isChecked());
    await bd.getByRole("radio", { name: /Nhóm Zalo lớp/ }).check();
    const bt = await bd.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue();
    check("tin nhóm: chỉ 'đã gửi riêng', KHÔNG tên con / điểm / điều chưa đạt", /^Báo cáo tháng \d+ đã gửi riêng cho từng anh\/chị\./.test(bt) && !/Em An|\/10|Điều chưa đạt/.test(bt), bt);
    await bd.getByRole("radio", { name: "Chat riêng với phụ huynh" }).check();
    check("quay lại chat riêng: tin đầy đủ trở lại", /Kính gửi anh\/chị Hoa/.test(await bd.getByLabel("Tin nhắn (sửa được trước khi gửi)").inputValue()));
    await bd.getByRole("radio", { name: /Nhóm Zalo lớp/ }).check();
    await bd.getByRole("button", { name: "Mở Zalo" }).click();
    await bd.waitFor({ state: "detached", timeout: 20000 });
    check("tin nhóm KHÔNG ghi 'đã mở Zalo' của báo cáo", (await prisma.monthlyReport.findFirst({ where: { studentId: A.id } }))?.zaloOpenedAt === null);
  }

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(mp);
  await mp.goto(`${BASE}/lop-cua-toi/cai-dat`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Kết nối" }).waitFor({ timeout: 60000 });
  check("Cài đặt không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const sb = await mp.getByRole("button", { name: "Lưu" }).first().boundingBox();
  check("nút Lưu cao ≥ 44px", !!sb && sb.height >= 44, sb);

  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
