// ADM — Xoá tài khoản (học sinh + gia sư) và Chuyển học sinh thành gia sư, ngay trong panel (không hộp thoại mới).
// Kiểm: admin_super thấy cả hai nút; xoá cần gõ XOA (sai chữ → nút khoá); chuyển thành gia sư thật (HS có 1 ghi danh → role admin/teacher, ghi danh còn);
// xoá TK thật (email "deleted+…"); gia sư còn lớp → 409 nguyên văn, vẫn trong danh sách; admin_content không thấy "Xoá tài khoản"; 390px không tràn, nút ≥ 44px.
// Thêm vòng 2: ô lý do xoá, tick 18 tuổi (panel + khối email), khối chuyển gia sư theo email ở /admin/gia-su.
// CA PHÁ CỐ Ý: email không tồn tại -> "Không tìm thấy học sinh phù hợp"; chưa tick 18 -> nút khoá; không lộ email người khác trên trang.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-adm-xoa-tk.ts  (cần API xoa-tai-khoan / len-gia-su của adm-code)
import { mkSuper, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN, kinSelect, kinSelectOptions } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CT = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const OWNER = await mkTutor("Cô Chủ Lớp");
  const course = await mkCourse(OWNER.id, { name: "Toán 9 của cô Chủ Lớp" });
  const HS_XOA = await mkUser({ name: "Em Xoa Khong Lop" });
  const HS_LEN = await mkUser({ name: "Em Len Gia Su" });
  await prisma.enrollment.create({ data: { userId: HS_LEN.id, courseId: course.id, status: "active" } });
  const now = new Date();
  const mkApproved = async (name: string) => {
    const u = await mkUser({ name, role: "admin", adminRole: "teacher", tutorVerified: true, emailVerified: true });
    await prisma.user.update({ where: { id: u.id }, data: { tutorAppliedAt: now, tutorVerifiedAt: now, subjects: ["Toán"], city: "Hà Nội" } });
    return u;
  };
  const GS_XOA = await mkApproved("Gia su Xoa Duoc");
  const GS_LOP = await mkApproved("Gia su Con Lop");
  await mkCourse(GS_LOP.id, { name: "Lớp của gia sư còn lớp" });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);

  section("Học sinh: panel có cả 'Chuyển thành gia sư' và 'Xoá tài khoản' (admin_super)");
  await pg.goto(`${ADMIN}/admin/hoc-sinh`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForURL(/\/admin\/hoc-sinh/, { timeout: 60000 });
  await pg.getByRole("heading", { name: "Hồ sơ học sinh" }).waitFor({ timeout: 90000 });
  const row = (name: string) => pg.locator("div.grid.grid-cols-12").filter({ hasText: name });
  await row("Em Xoa Khong Lop").waitFor({ timeout: 60000 });
  await row("Em Xoa Khong Lop").getByRole("button", { name: "Chi tiết" }).click();
  const btnDel = pg.getByRole("button", { name: "Xoá tài khoản", exact: true });
  await btnDel.waitFor({ timeout: 15000 });
  check("thấy cả hai nút", await btnDel.isVisible() && await pg.getByRole("button", { name: "Chuyển thành gia sư", exact: true }).isVisible());
  await btnDel.click();
  const grp = pg.getByRole("group", { name: "Xoá tài khoản" });
  const final = grp.getByRole("button", { name: "Xoá vĩnh viễn" });
  check("bước 2: nêu rõ không hoàn tác + giữ bằng chứng + email dùng lại được", await grp.getByText(/Không hoàn tác được/).isVisible() && await grp.getByText(/phiếu thu được giữ lại làm bằng chứng/).isVisible() && await grp.getByText(/dùng lại được/).isVisible());
  check("chưa gõ gì → nút 'Xoá vĩnh viễn' khoá", await final.isDisabled());
  const sel = grp.locator("[data-xoa-ly-do]");
  check("có ô 'Lý do (không bắt buộc)' đủ 5 mã + trống", await grp.getByText("Lý do (không bắt buộc)").isVisible() && (await kinSelectOptions(sel)).length === 6);
  await kinSelect(sel, "duplicate");
  await grp.locator("[data-xoa-input]").fill("xoo");
  check("gõ sai chữ → vẫn khoá", await final.isDisabled());
  const nb = await final.boundingBox();
  check("nút ≥ 44px cao", !!nb && nb.height >= 43.5, nb);
  check("không có dialog/confirm mới", (await pg.getByRole("dialog").count()) === 0);
  await shot(pg, "adm-xoa-tk-hs-1280");
  await grp.locator("[data-xoa-input]").fill("xoa");
  check("gõ 'xoa' (không phân biệt hoa thường) → mở khoá", await final.isEnabled());
  await final.click();
  await eventually("hàng biến khỏi danh sách", async () => (await row("Em Xoa Khong Lop").count()) === 0, 30000);
  await eventually("toast 'Đã xoá tài khoản'", () => pg.getByText(/Đã xoá tài khoản/).isVisible(), 15000);
  const x = await prisma.user.findUnique({ where: { id: HS_XOA.id } });
  check("DB: email bắt đầu 'deleted+'", !!x && x.email.startsWith("deleted+"), x?.email);

  section("Học sinh: chuyển thành gia sư (có 1 ghi danh active)");
  await row("Em Len Gia Su").getByRole("button", { name: "Chi tiết" }).click();
  await pg.getByRole("button", { name: "Chuyển thành gia sư", exact: true }).click();
  const g2 = pg.getByRole("group", { name: "Chuyển thành gia sư" });
  check("cảnh báo hệ quả + nhấn mạnh 1 lớp", await g2.getByText(/Lớp em đang học vẫn được giữ\. Sau khi chuyển, tài khoản này không còn vào được phần học sinh và cần đăng nhập lại\./).isVisible() && await g2.getByText(/đang có 1 lớp/).isVisible());
  const go = g2.getByRole("button", { name: "Chuyển thành gia sư" });
  check("chưa nhập môn → nút khoá", await go.isDisabled());
  await g2.locator("[data-len-mon]").fill("Toán, Lý");
  check("chưa tick 18 tuổi → nút khoá (danh sách không có ngày sinh)", await go.isDisabled());
  await g2.locator("[data-xac-minh-18]").check();
  check("tick xong → mở khoá", await go.isEnabled());
  await go.click();
  await eventually("hàng biến khỏi danh sách học sinh", async () => (await row("Em Len Gia Su").count()) === 0, 30000);
  const l = await prisma.user.findUnique({ where: { id: HS_LEN.id } });
  const enr = await prisma.enrollment.count({ where: { userId: HS_LEN.id } });
  check("DB: role admin / adminRole teacher, ghi danh còn", l?.role === "admin" && l?.adminRole === "teacher" && enr === 1, { role: l?.role, adminRole: l?.adminRole, enr });
  await ctx.close();

  section("Gia sư: xoá TK (tab Đã duyệt)");
  const cg = await ctxFor(SA, { width: 1280, height: 900 });
  const pgs = await cg.newPage(); watch(pgs);
  await pgs.goto(`${ADMIN}/admin/gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pgs.locator("[data-gia-su-table]").waitFor({ timeout: 120000 });
  const trow = (n: string) => pgs.locator("[data-gia-su-table] tbody tr").filter({ hasText: n });
  check("hàng bảng vẫn ≤ 2 nút (không thêm nút xoá vào hàng)", await trow("Gia su Xoa Duoc").locator("button, a[href]").count() <= 2 && (await trow("Gia su Xoa Duoc").getByRole("button", { name: /Xoá tài khoản/ }).count()) === 0);
  // gia sư còn lớp → 409
  await trow("Gia su Con Lop").locator("[data-row-open]").click();
  await pgs.getByRole("button", { name: "Xoá tài khoản", exact: true }).click();
  await pgs.getByRole("group", { name: "Xoá tài khoản" }).locator("[data-xoa-input]").fill("XOA");
  await pgs.getByRole("button", { name: "Xoá vĩnh viễn" }).click();
  await pgs.locator("[data-xoa-loi]").waitFor({ timeout: 30000 });
  const msg = (await pgs.locator("[data-xoa-loi]").innerText()).trim();
  check("409: hiện lỗi nguyên văn của máy chủ (không rỗng)", msg.length > 5, msg);
  check("gia sư còn lớp vẫn trong danh sách + DB chưa đổi", (await trow("Gia su Con Lop").count()) === 1 && !(await prisma.user.findUnique({ where: { id: GS_LOP.id } }))!.email.startsWith("deleted+"));
  await pgs.getByRole("button", { name: "Đóng panel" }).click();
  // gia sư không lớp → xoá được
  await trow("Gia su Xoa Duoc").locator("[data-row-open]").click();
  await shot(pgs, "adm-xoa-tk-gs-1280");
  await pgs.getByRole("button", { name: "Xoá tài khoản", exact: true }).click();
  await pgs.getByRole("group", { name: "Xoá tài khoản" }).locator("[data-xoa-input]").fill("XOA");
  await pgs.getByRole("button", { name: "Xoá vĩnh viễn" }).click();
  await eventually("gia sư biến khỏi danh sách", async () => (await trow("Gia su Xoa Duoc").count()) === 0, 30000);
  await eventually("thông báo đã xoá", () => pgs.locator("[data-thong-bao]").isVisible(), 10000);
  const gx = await prisma.user.findUnique({ where: { id: GS_XOA.id } });
  check("DB: email bắt đầu 'deleted+'", !!gx && gx.email.startsWith("deleted+"), gx?.email);
  await cg.close();

  section("Khối chuyển gia sư theo email (admin_super)");
  const HS_EMAIL = await mkUser({ name: "Em Tim Theo Email" });
  const PROBE = (await prisma.user.findUnique({ where: { id: HS_EMAIL.id } }))!.email;
  const ce = await ctxFor(SA, { width: 1280, height: 900 });
  const pe = await ce.newPage(); watch(pe);
  await pe.goto(`${ADMIN}/admin/gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const blk = pe.locator("[data-len-email]");
  await blk.waitFor({ timeout: 120000 });
  await blk.locator("[data-len-email-input]").fill("khong-co-ai@example.invalid");
  await blk.getByRole("button", { name: "Tìm", exact: true }).click();
  await blk.locator("[data-len-email-khong-thay]").waitFor({ timeout: 30000 });
  check("email lạ → 'Không tìm thấy học sinh phù hợp'", await blk.getByText("Không tìm thấy học sinh phù hợp").isVisible());
  await blk.locator("[data-len-email-input]").fill(PROBE);
  await blk.getByRole("button", { name: "Tìm", exact: true }).click();
  await blk.locator("[data-len-email-ket-qua]").waitFor({ timeout: 30000 });
  check("kết quả chỉ tên rút gọn + số lớp, không hiện email", await blk.getByText(/đang học 0 lớp/).isVisible() && (await blk.locator("[data-len-email-ket-qua]").innerText()).indexOf(PROBE) < 0);
  const tiep = blk.getByRole("button", { name: "Tiếp tục" });
  await blk.locator("[data-len-email-mon]").fill("Toán");
  const t18 = blk.locator("[data-xac-minh-18]");
  if (await t18.count()) { check("chưa tick 18 → 'Tiếp tục' khoá", await tiep.isDisabled()); await t18.check(); }
  await tiep.click();
  const cf = blk.getByRole("group", { name: "Xác nhận chuyển thành gia sư" });
  check("bước 2 ngay trong khối, nêu hệ quả, không dialog", await cf.getByText(/không còn vào được phần học sinh/).isVisible() && (await pe.getByRole("dialog").count()) === 0);
  await shot(pe, "adm-xoa-tk-email-1280");
  await cf.getByRole("button", { name: "Xác nhận chuyển" }).click();
  await eventually("thông báo đã chuyển", () => pe.locator("[data-thong-bao]").isVisible(), 30000);
  const he = await prisma.user.findUnique({ where: { id: HS_EMAIL.id } });
  check("DB: HS thành gia sư (role admin / teacher)", he?.role === "admin" && he?.adminRole === "teacher", { role: he?.role, adminRole: he?.adminRole });
  await ce.close();

  section("admin_content: không thấy 'Xoá tài khoản'");
  const cc = await ctxFor(CT, { width: 1280, height: 900 });
  const pc = await cc.newPage(); watch(pc);
  await pc.goto(`${ADMIN}/admin/gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pc.locator("[data-gia-su-table]").waitFor({ timeout: 120000 });
  await pc.locator("[data-row-open]").first().click();
  await pc.locator("aside[data-side-panel]").waitFor({ timeout: 30000 });
  check("panel gia sư của admin_content không có 'Xoá tài khoản'", (await pc.getByRole("button", { name: "Xoá tài khoản" }).count()) === 0);
  check("admin_content vẫn thấy khối chuyển gia sư theo email", await pc.locator("[data-len-email]").isVisible());
  await cc.close();

  section("390px");
  const cm = await ctxFor(SA, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/gia-su`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.locator("[data-gia-su-table]").waitFor({ timeout: 120000 });
  await pm.locator("[data-row-open]").first().click();
  const bm = pm.getByRole("button", { name: "Xoá tài khoản", exact: true });
  await bm.waitFor({ timeout: 30000 });
  await bm.click();
  const fm = pm.getByRole("button", { name: "Xoá vĩnh viễn" });
  await fm.waitFor();
  const b = await fm.boundingBox();
  check("nút 'Xoá vĩnh viễn' trong màn 390 và ≥ 44px", !!b && b.x >= 0 && b.x + b.width <= 390 && b.height >= 43.5, b);
  const eb = await pm.locator("[data-len-email-input]").boundingBox();
  check("390: ô email trong màn, cao ≥ 44px", !!eb && eb.x >= 0 && eb.x + eb.width <= 390 && eb.height >= 43.5, eb);
  check("390: không tràn ngang", (await pm.evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`) as number) <= 0);
  await shot(pm, "adm-xoa-tk-390");
  await cm.close();

  check("không lỗi JS trong console", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
