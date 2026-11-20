// DG-GIAO-LOP — trình duyệt: khối "Gia sư chủ lớp" ở /admin/khoa-hoc/[id] tab Cài đặt (1280 + 390): hiện chủ lớp hiện tại, ô chọn KinSelect,
// "Giao lớp" → hộp xác nhận KiN → báo bằng chữ; lớp còn phiếu mở ⇒ hiện câu chặn của API; gia sư mở lớp của mình KHÔNG thấy khối này.
// Chạy: TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-admin-giao-lop.ts
import { BASE, mkSuper, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, kinSelect } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const S = await mkSuper("Quản trị Giao");
  const T1 = await mkTutor("Cô Cũ"), T2 = await mkTutor("Thầy Mới");
  const a = await mkCourse(T1.id, { name: "Lớp Giao 1280" });
  const b = await mkCourse(T1.id, { name: "Lớp Giao 390" });
  const blocked = await mkCourse(T1.id, { name: "Lớp Còn Phiếu" });
  const st = await mkUser({ name: "Em Phiếu" });
  await prisma.enrollment.create({ data: { userId: st.id, courseId: blocked.id, status: "active" } });
  await prisma.tuitionInvoice.create({ data: { code: "KINUI001", tutorId: T1.id, studentId: st.id, yearMonth: "2026-11", amountDue: 300000, status: "draft" } });
  await launch();

  for (const [vp, c] of [[{ width: 1280, height: 900 }, a], [{ width: 390, height: 844 }, b]] as const) {
    section(`Quản trị ${vp.width}px`);
    const ctx = await ctxFor(S, vp);
    const pg = await ctx.newPage();
    const errs: string[] = [];
    pg.on("pageerror", e => errs.push(String(e)));
    await pg.goto(`${BASE}/admin/khoa-hoc/${c.id}?tab=cai-dat`, { waitUntil: "domcontentloaded", timeout: 240000 });
    const box = pg.locator("[data-giao-chu-lop]");
    await box.locator("[data-chu-lop-hien-tai]").waitFor({ timeout: 120000 });
    check(`${vp.width}: hiện chủ lớp hiện tại`, (await box.locator("[data-chu-lop-hien-tai]").innerText()).includes("Cô Cũ"));
    await kinSelect(box.locator("#giao-chu-lop-chon"), { label: "Thầy Mới" });
    await box.locator("[data-giao-chu-lop-nut]").click();
    const dlg = pg.getByRole("dialog");
    await dlg.waitFor({ timeout: 30000 });
    check(`${vp.width}: hộp xác nhận KiN (không window.confirm) nêu tên gia sư mới`, (await dlg.innerText()).includes("Thầy Mới"));
    await dlg.getByRole("button", { name: "Giao lớp" }).click();
    await box.locator("[data-giao-chu-lop-msg]").waitFor({ timeout: 60000 });
    check(`${vp.width}: báo "Đã giao lớp cho Thầy Mới." bằng chữ`, (await box.locator("[data-giao-chu-lop-msg]").innerText()).includes("Đã giao lớp cho Thầy Mới"));
    await box.locator("[data-chu-lop-hien-tai]").filter({ hasText: "Thầy Mới" }).waitFor({ timeout: 30000 });
    check(`${vp.width}: DB đổi chủ`, (await prisma.course.findUnique({ where: { id: c.id } }))?.ownerId === T2.id);
    check(`${vp.width}: không tràn ngang`, await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    const small = await pg.evaluate(() => [...document.querySelectorAll("[data-giao-chu-lop] button, [data-giao-chu-lop] [role=combobox]")]
      .filter(e => (e as HTMLElement).offsetParent && e.getBoundingClientRect().height < 43.5).map(e => `${(e.textContent ?? "").trim()}:${Math.round(e.getBoundingClientRect().height)}`));
    check(`${vp.width}: nút ≥ 44px`, small.length === 0, small);
    await shot(pg, `admin-giao-lop-${vp.width}`);
    check(`${vp.width}: không lỗi JS`, errs.length === 0, errs);
    await ctx.close();
  }

  section("Lớp còn phiếu mở ⇒ chặn, hiện câu báo");
  {
    const ctx = await ctxFor(S, { width: 1280, height: 900 });
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}/admin/khoa-hoc/${blocked.id}?tab=cai-dat`, { waitUntil: "domcontentloaded", timeout: 240000 });
    const box = pg.locator("[data-giao-chu-lop]");
    await box.locator("[data-chu-lop-hien-tai]").waitFor({ timeout: 120000 });
    await kinSelect(box.locator("#giao-chu-lop-chon"), { label: "Thầy Mới" });
    await box.locator("[data-giao-chu-lop-nut]").click();
    await pg.getByRole("dialog").getByRole("button", { name: "Giao lớp" }).click();
    await box.locator("[data-giao-chu-lop-msg]").waitFor({ timeout: 60000 });
    const t = await box.locator("[data-giao-chu-lop-msg]").innerText();
    check("báo 'phiếu học phí chưa tất toán', không có số tiền, chủ lớp không đổi", t.includes("phiếu học phí chưa tất toán") && !/\d\s*đ/.test(t) && (await prisma.course.findUnique({ where: { id: blocked.id } }))?.ownerId === T1.id, t);
    await ctx.close();
  }

  section("Gia sư không thấy khối giao lớp");
  {
    const ctx = await ctxFor(T2, { width: 1280, height: 900 });
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}/lop-cua-toi/quan-lop/${a.id}?tab=cai-dat`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await pg.locator("[data-cai-dat-tab]").waitFor({ timeout: 120000 });
    check("gia sư mới mở được Cài đặt lớp vừa nhận, KHÔNG có khối Gia sư chủ lớp", (await pg.locator("[data-giao-chu-lop]").count()) === 0);
    await ctx.close();
  }

  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll(); process.exit(1); });
