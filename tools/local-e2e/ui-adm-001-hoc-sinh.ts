// ADM-001 (01/11/2026): /admin/hoc-sinh phản ánh trạng thái "ẩn" thay cho xoá cứng (đặc tả docs/kin/phong-ban/dac-ta/ADM-001.md mục 5.1).
// Kiểm: chip "Đã ẩn · N" (gọi ?includeHidden=1), panel có "Ẩn học sinh" (không còn "Xóa học sinh"), xác nhận hai bước trong panel,
// 409 còn lớp đang học → toast đúng chữ máy chủ và panel KHÔNG đóng, ẩn thành công → hàng rời danh sách và chip tăng,
// bản ẩn → huy hiệu "Đã ẩn" + nút "Khôi phục học sinh" + khối Khoá học vô hiệu, 390px không tràn. Chụp 1280 + 390.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-adm-001-hoc-sinh.ts  (cần cột User.deletedAt đã push + Next dev khởi động lại)
import { mkSuper, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const T = await mkTutor("Cô Lan");
  const course = await mkCourse(T.id, { name: "Toán 9 của cô Lan" });
  // AN: không có lớp → ẩn được. BINH: còn lớp đang học → 409. CHI: đã ẩn sẵn (gieo qua SQL để không phụ thuộc Prisma client đã generate cột mới).
  const AN = await mkUser({ name: "Em An Khong Lop" });
  const BINH = await mkUser({ name: "Em Binh Dang Hoc" });
  const CHI = await mkUser({ name: "Em Chi Da An" });
  await prisma.enrollment.create({ data: { userId: BINH.id, courseId: course.id, status: "active" } });
  let seededHidden = false;
  try {
    await prisma.$executeRawUnsafe(`update "User" set "deletedAt" = now(), "banned" = true where "id" = $1`, CHI.id);
    seededHidden = true;
  } catch (e) {
    console.log("  (bỏ qua ca bản ẩn gieo sẵn: cột deletedAt chưa có trong DB thử —", String(e).slice(0, 120), ")");
  }

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };

  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  const listReqs: string[] = [];
  pg.on("request", r => { if (/\/api\/admin\/students(\?|$)/.test(r.url()) && r.method() === "GET") listReqs.push(r.url()); });

  section("Mở trang: chip 'Đã ẩn', hai dòng tổng không đếm bản ẩn");
  await pg.goto(`${ADMIN}/admin/hoc-sinh`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForURL(/\/admin\/hoc-sinh/, { timeout: 60000 });
  await pg.getByRole("heading", { name: "Hồ sơ học sinh" }).waitFor({ timeout: 90000 });
  const row = (name: string) => pg.locator("div.grid.grid-cols-12").filter({ hasText: name });
  await row("Em An Khong Lop").waitFor({ timeout: 60000 });
  const visibleN = seededHidden ? 2 : 3;
  const hiddenN = seededHidden ? 1 : 0;
  check("danh sách gọi ?includeHidden=1", listReqs.some(u => /includeHidden=1/.test(u)), listReqs);
  const chipDaAn = pg.getByRole("button", { name: /^Đã ẩn · \d+$/ });
  check(`có chip 'Đã ẩn · ${hiddenN}'`, (await chipDaAn.innerText()).trim() === `Đã ẩn · ${hiddenN}`, await chipDaAn.innerText().catch(() => "không có"));
  check(`dòng tổng trên: '${visibleN} học sinh' (không đếm bản ẩn)`, await pg.getByText(new RegExp(`^${visibleN} học sinh ·`)).isVisible());
  check(`dòng tổng dưới: '${visibleN}/${visibleN} học sinh'`, await pg.getByText(`${visibleN}/${visibleN} học sinh ·`).isVisible());
  check("bản ẩn KHÔNG nằm trong danh sách mặc định", seededHidden ? (await row("Em Chi Da An").count()) === 0 : true);
  check("không còn chữ 'Xóa học sinh' / 'Xác nhận xóa' đâu trên trang", !/Xóa học sinh|Xác nhận xóa/.test(await pg.content()));
  await shot(pg, "adm-001-hoc-sinh-1280");

  section("Panel: nút 'Ẩn học sinh' + xác nhận hai bước trong panel (không hộp thoại mới)");
  await row("Em An Khong Lop").getByRole("button", { name: "Chi tiết" }).click();
  const panelTitle = pg.getByRole("heading", { name: "Hồ sơ học sinh", level: 2 });
  await panelTitle.waitFor({ timeout: 15000 });
  const btnHide = pg.getByRole("button", { name: "Ẩn học sinh", exact: true });
  check("panel có 'Ẩn học sinh' và 'Ban học sinh', không có 'Xóa học sinh'", await btnHide.isVisible() && await pg.getByRole("button", { name: "Ban học sinh" }).isVisible() && (await pg.getByRole("button", { name: /Xóa học sinh/ }).count()) === 0);
  await btnHide.click();
  const grp = pg.getByRole("group", { name: "Ẩn học sinh" });
  check("bước 2: chữ xác nhận đúng đặc tả + hai nút Huỷ / Ẩn", await grp.getByText("Ẩn học sinh này?").isVisible() && await grp.getByText(/Dữ liệu lớp, điểm danh và bài làm được giữ lại; em không đăng nhập được nữa\./).isVisible() && await grp.getByRole("button", { name: "Huỷ" }).isVisible() && await grp.getByRole("button", { name: "Ẩn", exact: true }).isVisible());
  check("không mở window.confirm / dialog mới (vẫn trong panel)", (await pg.getByRole("dialog").count()) === 0 && await panelTitle.isVisible());
  await grp.getByRole("button", { name: "Huỷ" }).click();
  check("Huỷ → về nút 'Ẩn học sinh', DB chưa đổi", await btnHide.isVisible() && (await prisma.user.findUnique({ where: { id: AN.id } })) !== null);

  section("Ẩn thật: 200 → toast 'Đã ẩn học sinh', panel đóng, hàng rời danh sách, chip tăng");
  await btnHide.click();
  await grp.getByRole("button", { name: "Ẩn", exact: true }).click();
  await eventually("toast 'Đã ẩn học sinh' ở cấp trang", () => pg.getByText(/Đã ẩn học sinh$/).isVisible(), 20000);
  await eventually("panel đã đóng", async () => (await panelTitle.count()) === 0, 10000);
  await eventually("hàng 'Em An Khong Lop' rời danh sách mặc định", async () => (await row("Em An Khong Lop").count()) === 0, 20000);
  await eventually(`chip 'Đã ẩn · ${hiddenN + 1}'`, async () => (await chipDaAn.innerText()).trim() === `Đã ẩn · ${hiddenN + 1}`, 20000);
  const anDb = await prisma.user.findUnique({ where: { id: AN.id } }) as any;
  check("DB: bản ghi còn, deletedAt đặt, banned=true (ẩn, không xoá cứng)", anDb !== null && anDb.deletedAt != null && anDb.banned === true, anDb && { deletedAt: anDb.deletedAt, banned: anDb.banned });
  check(`dòng tổng trên giảm còn '${visibleN - 1} học sinh'`, await pg.getByText(new RegExp(`^${visibleN - 1} học sinh ·`)).isVisible());

  section("409 còn lớp đang học: toast đúng chữ máy chủ, panel KHÔNG đóng, khối Khoá học còn đó");
  await row("Em Binh Dang Hoc").getByRole("button", { name: "Chi tiết" }).click();
  await panelTitle.waitFor({ timeout: 15000 });
  await pg.getByRole("button", { name: "Ẩn học sinh", exact: true }).click();
  await grp.getByRole("button", { name: "Ẩn", exact: true }).click();
  await eventually("toast trong panel: 'Học sinh còn 1 lớp đang học. Thu hồi lớp trước khi ẩn.'", () => pg.getByText("Học sinh còn 1 lớp đang học. Thu hồi lớp trước khi ẩn.").isVisible(), 20000);
  check("panel vẫn mở; nút 'Thu hồi' của lớp vẫn bấm được", await panelTitle.isVisible() && await pg.getByRole("button", { name: "Thu hồi" }).isEnabled());
  check("hàng 'Em Binh Dang Hoc' vẫn trong danh sách", (await row("Em Binh Dang Hoc").count()) === 1);
  check("DB: Bình chưa bị ẩn", ((await prisma.user.findUnique({ where: { id: BINH.id } })) as any)?.deletedAt == null);
  await pg.getByRole("button", { name: "×" }).first().click();
  await eventually("đóng panel", async () => (await panelTitle.count()) === 0, 5000);

  section("Chip 'Đã ẩn': huy hiệu trên hàng, panel có 'Khôi phục học sinh', khối Khoá học vô hiệu");
  await chipDaAn.click();
  await eventually("danh sách ẩn có 'Em An Khong Lop' kèm huy hiệu chữ 'Đã ẩn'", async () => (await row("Em An Khong Lop").getByText("Đã ẩn", { exact: true }).count()) === 1, 15000);
  if (seededHidden) check("bản ẩn gieo sẵn 'Em Chi Da An' cũng hiện ở chip này", (await row("Em Chi Da An").count()) === 1);
  check(`dòng tổng dưới: '${hiddenN + 1}/${hiddenN + 1} học sinh đã ẩn'`, await pg.getByText(`${hiddenN + 1}/${hiddenN + 1} học sinh đã ẩn`).isVisible());
  await row("Em An Khong Lop").getByRole("button", { name: "Chi tiết" }).click();
  await panelTitle.waitFor({ timeout: 15000 });
  const btnRestore = pg.getByRole("button", { name: "Khôi phục học sinh" });
  check("panel bản ẩn: 'Khôi phục học sinh' + 'Đã ẩn lúc dd/mm/yyyy HH:mm'; không có Ẩn/Ban/Nhắc nhở", await btnRestore.isVisible() && await pg.getByText(/^Đã ẩn lúc \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/).isVisible() && (await pg.getByRole("button", { name: /^(Ẩn học sinh|Ban học sinh|Nhắc nhở học tập)$/ }).count()) === 0);
  check("khối Khoá học: nút Kích hoạt disabled + chữ 'Khôi phục để ghi danh lại'", await pg.getByRole("button", { name: "Kích hoạt" }).first().isDisabled() && await pg.getByText("Khôi phục để ghi danh lại").isVisible());

  section("Khôi phục: 200 → toast đúng chữ, hàng về danh sách mặc định, DB banned=false");
  await btnRestore.click();
  await eventually("toast 'Đã khôi phục. Tài khoản mở khoá; nếu trước đó em bị khoá, hãy khoá lại.'", () => pg.getByText("Đã khôi phục. Tài khoản mở khoá; nếu trước đó em bị khoá, hãy khoá lại.").isVisible(), 20000);
  await eventually("panel chuyển về bản đang hiện (có lại 'Ẩn học sinh')", () => pg.getByRole("button", { name: "Ẩn học sinh", exact: true }).isVisible(), 20000);
  const anBack = await prisma.user.findUnique({ where: { id: AN.id } }) as any;
  check("DB: deletedAt=null, banned=false", anBack?.deletedAt == null && anBack?.banned === false, anBack && { deletedAt: anBack.deletedAt, banned: anBack.banned });
  await pg.getByRole("button", { name: "×" }).first().click();
  await eventually(`chip về 'Đã ẩn · ${hiddenN}'`, async () => (await chipDaAn.innerText()).trim() === `Đã ẩn · ${hiddenN}`, 20000);
  if (!seededHidden) {
    check("rỗng: 'Chưa có học sinh nào bị ẩn' khi chip Đã ẩn không có ai", await pg.getByText("Chưa có học sinh nào bị ẩn").isVisible());
  }
  await pg.getByRole("button", { name: "Tất cả" }).click();
  await eventually("'Em An Khong Lop' về lại danh sách mặc định", async () => (await row("Em An Khong Lop").count()) === 1, 15000);
  await ctx.close();

  section("390px: không tràn ngang, chip 'Đã ẩn' và panel dùng được");
  const cm = await ctxFor(SA, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/hoc-sinh`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.waitForURL(/\/admin\/hoc-sinh/, { timeout: 60000 });
  await pm.getByRole("heading", { name: "Hồ sơ học sinh" }).waitFor({ timeout: 90000 });
  await pm.locator("div.grid.grid-cols-12").filter({ hasText: "Em Binh Dang Hoc" }).waitFor({ timeout: 60000 });
  const over = await pm.evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`) as number;
  check("không tràn ngang (scrollWidth ≤ clientWidth)", over <= 0, over);
  const chipM = pm.getByRole("button", { name: /^Đã ẩn · \d+$/ });
  check("chip 'Đã ẩn' hiện ở 390px", await chipM.isVisible());
  await pm.locator("div.grid.grid-cols-12").filter({ hasText: "Em Binh Dang Hoc" }).getByRole("button", { name: "Chi tiết" }).click();
  await pm.getByRole("button", { name: "Ẩn học sinh", exact: true }).waitFor({ timeout: 15000 });
  const hb = await pm.getByRole("button", { name: "Ẩn học sinh", exact: true }).boundingBox();
  check("nút 'Ẩn học sinh' nằm trong màn 390px", !!hb && hb.x >= 0 && hb.x + hb.width <= 390, hb);
  await shot(pm, "adm-001-hoc-sinh-390");
  await cm.close();

  check("không lỗi JS trong console", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
