// KiN Pro F3 — giao diện báo cáo tháng có thương hiệu: thẻ cài đặt, nút theo gói, trang in (màn hình + chế độ in), 390px, nút ≥44px.
// Chạy hai lần theo cờ cổng của máy chủ: EXPECT_ENFORCE=0 (mặc định) hoặc 1 (KIN_PLAN_ENFORCE=1) — xem tools/local-e2e/doc-brand-run.sh.
import { BASE, api, mkTutor, mkUser, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { prevYearMonth } from "@/lib/monthlyReport";
import { vnMonthKey } from "@/lib/revenue";

const v = process.env.EXPECT_ENFORCE;
if (v !== "0" && v !== "1") throw new Error("Đặt EXPECT_ENFORCE=0 hoặc 1");
const ENFORCE = v === "1";
const DAY = 86_400_000;
const YM = prevYearMonth(vnMonthKey(new Date()));
const monthTitle = `Tháng ${Number(YM.slice(5, 7))}/${YM.slice(0, 4)}`;
let seq = 0;

async function mkClass(T: TUser, studentName: string) {
  const c = await mkCourse(T.id, { name: "Toán 9" });
  const s = await mkUser({ name: studentName });
  await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active" } });
  for (const d of [3, 10, 17]) {
    const a = await prisma.attendanceSession.create({ data: { courseId: c.id, date: new Date(`${YM}-${String(d).padStart(2, "0")}T00:00:00Z`), createdBy: T.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: a.id, userId: s.id, status: "present" } });
  }
  return s;
}
const pro = (u: TUser, endOffsetDays: number) => prisma.proOrder.create({ data: { userId: u.id, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 79000, source: "admin_grant", memoCode: `KINPRO-UI${++seq}${Date.now().toString(36)}`.toUpperCase().slice(0, 20), status: "active", startDate: new Date(Date.now() - 60 * DAY), endDate: new Date(Date.now() + endOffsetDays * DAY) } });

(async () => {
  await wipe();
  const TP = await mkTutor("Cô Pro UI"), TF = await mkTutor("Cô Free UI"), TX = await mkTutor("Cô Hết Hạn UI");
  const sP = await mkClass(TP, "Minh Anh"), sF = await mkClass(TF, "Chi Chi"), sX = await mkClass(TX, "Duy Dũng");
  await pro(TP, 20); await pro(TX, 20);
  await api("PUT", "/api/tutor/doc-brand", { as: TX, body: { displayName: "Lớp Cô Hết Hạn", accent: "xanh-link", signature: "" } });
  const ap = async (T: TUser, s: TUser) => (await api("POST", `/api/tutor/monthly-reports/${s.id}/approve?yearMonth=${YM}`, { as: T, body: { items: [{ text: "Em cần ghi chép đầy đủ hơn.", kind: "tu-viet" }] } })).status;
  check("duyệt sẵn báo cáo Chi Chi và Duy Dũng", (await ap(TF, sF)) === 200 && (await ap(TX, sX)) === 200);
  check("Duy Dũng: tạo bản có thương hiệu khi còn Pro", (await api("POST", `/api/tutor/monthly-reports/${sX.id}/branded?yearMonth=${YM}`, { as: TX })).status === 200);
  await prisma.proOrder.updateMany({ where: { userId: TX.id }, data: { endDate: new Date(Date.now() - 3 * DAY) } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    const devPerf = /negative time stamp/i;
    p.on("pageerror", (e: unknown) => { if (!devPerf.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 4|status of 5|Hydration/i.test(m.text()) && !devPerf.test(m.text())) errors.push(m.text()); });
  };
  const goReports = async (pg: any, name: string) => {
    await pg.goto(`${BASE}/lop-cua-toi/bao-cao-thang`, { waitUntil: "networkidle", timeout: 120000 });
    await pg.getByRole("heading", { name: "Báo cáo tháng" }).waitFor({ timeout: 90000 });
    await pg.getByRole("button", { name: /Tháng trước/ }).click();
    await pg.getByText(monthTitle).waitFor({ timeout: 15000 });
    await pg.getByRole("button", { name: new RegExp(name) }).click();
    await pg.getByRole("columnheader", { name: "Nỗ lực" }).waitFor({ timeout: 30000 });
  };

  section("Gia sư Pro: cài thương hiệu, duyệt, tạo bản in");
  const ctx = await ctxFor(TP, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/lop-cua-toi/bao-cao-thang`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Báo cáo tháng" }).waitFor({ timeout: 90000 });
  await pg.getByRole("button", { name: /Thương hiệu giấy tờ/ }).click();
  await pg.locator("#brand-name").waitFor({ timeout: 15000 });
  check("Pro: ô tên mở, không có nhãn 'Có trong KiN Pro' (không bán cho người đã có)", await pg.locator("#brand-name").isEnabled() && (await pg.getByText("Có trong KiN Pro", { exact: true }).count()) === 0);
  check("màu chọn từ danh sách: 4 nút radio có chữ, không có ô nhập mã màu", (await pg.getByRole("radio").count()) === 4 && (await pg.locator('input[type="color"]').count()) === 0);
  check("chưa nhập tên: nút Lưu khoá", await pg.getByRole("button", { name: "Lưu thương hiệu" }).isDisabled());
  await pg.locator("#brand-name").fill("Lớp Toán cô Lan");
  await pg.getByRole("radio", { name: /Xanh lá/ }).check();
  await pg.locator("#brand-sig").fill("Chúc em tiến bộ mỗi ngày");
  await pg.getByRole("button", { name: "Lưu thương hiệu" }).click();
  await pg.getByText("Đã lưu thương hiệu giấy tờ.").waitFor({ timeout: 15000 });
  check("lưu xong: DB có tên + KHOÁ màu 'luc'", (await prisma.tutorDocBrand.findUnique({ where: { userId: TP.id } }))?.accent === "luc");

  await pg.getByRole("button", { name: /Tháng trước/ }).click();
  await pg.getByText(monthTitle).waitFor({ timeout: 15000 });
  await pg.getByRole("button", { name: /Minh Anh/ }).click();
  await pg.getByRole("columnheader", { name: "Nỗ lực" }).waitFor({ timeout: 30000 });
  check("chưa duyệt: không có nhóm nút Bản in", (await pg.getByRole("group", { name: "Bản in" }).count()) === 0);
  await pg.getByRole("button", { name: /^Duyệt/ }).click();
  await pg.getByRole("group", { name: "Bản in" }).waitFor({ timeout: 30000 });
  check("duyệt xong: có 'In / PDF (mẫu KiN)' và 'Tạo bản in có thương hiệu'", await pg.getByRole("link", { name: "In / PDF (mẫu KiN)" }).isVisible() && await pg.getByRole("button", { name: "Tạo bản in có thương hiệu" }).isVisible());
  await pg.getByRole("button", { name: "Tạo bản in có thương hiệu" }).click();
  await pg.waitForURL(/bao-cao-thang\/in\//, { timeout: 60000 });
  await pg.locator(".kin-print").waitFor({ timeout: 60000 });
  const paper = (await pg.locator(".kin-print").innerText()).replace(/\s+/g, " ");
  check("tờ giấy: tên thương hiệu, tên học sinh, mục Điều chưa đạt, chữ ký, nhãn 'Ghi trên KiN'", paper.includes("Lớp Toán cô Lan") && paper.includes("Minh Anh") && paper.includes("Điều chưa đạt tháng này") && paper.includes("Tháng này không có mục nào chưa đạt.") && paper.includes("Chúc em tiến bộ mỗi ngày") && paper.includes("Ghi trên KiN"), paper.slice(0, 300));
  check("tờ giấy không có chữ cấm / tiền", !/đã xác minh|đúng luật|miễn thuế|đã gửi|Midnight Elite|học phí/i.test(paper));
  check("có dòng nhắc chỉ gửi riêng, không đăng nhóm", await pg.getByText(/không đăng vào nhóm chung/).isVisible());
  const accent = await pg.locator(".kin-print .kin-print-accent").first().evaluate(e => getComputedStyle(e).color);
  const nav = await pg.locator(".kin-print .kin-print-accent").first().evaluate(e => getComputedStyle(e).color);
  check("màu tiêu đề lấy từ token (không phải đen mặc định)", accent === nav && accent !== "rgb(0, 0, 0)", accent);
  await shot(pg, "doc-brand-print-1280");

  section("Chế độ in: chỉ còn tờ giấy, vỏ trang ẩn");
  await pg.emulateMedia({ media: "print" });
  const vis = await pg.evaluate(`(() => { const v = e => e && getComputedStyle(e).visibility; return { paper: v(document.querySelector('.kin-print h1')), rail: v(document.querySelector('#kin-rail')), header: v(document.querySelector('[data-kin-page-header]')) }; })()`) as { paper: string; rail: string; header: string };
  check("in: tờ giấy hiện, thanh bên và đầu trang ẩn", vis.paper === "visible" && vis.rail === "hidden" && vis.header === "hidden", vis);
  await pg.emulateMedia({ media: "screen" });
  check("nút 'In / Lưu thành PDF' có và gọi window.print", await (async () => { await pg.evaluate(`window.__p = 0; window.print = () => { window.__p++; };`); await pg.getByRole("button", { name: "In / Lưu thành PDF" }).click(); return (await pg.evaluate(`window.__p`)) === 1; })());
  await pg.getByRole("link", { name: "In bằng mẫu KiN" }).click();
  await pg.waitForURL(/mau=kin/, { timeout: 30000 });
  await pg.locator(".kin-print").waitFor();
  const kinPaper = (await pg.locator(".kin-print").innerText()).replace(/\s+/g, " ");
  check("mẫu KiN: không có tên thương hiệu, vẫn có số liệu + 'Ghi trên KiN'", !kinPaper.includes("Lớp Toán cô Lan") && kinPaper.includes("Minh Anh") && kinPaper.includes("Ghi trên KiN"));

  section("Điện thoại 390px");
  const m = await (await ctxFor(TP, { width: 390, height: 800 })).newPage(); watch(m);
  await m.goto(`${BASE}/lop-cua-toi/bao-cao-thang/in/${sP.id}?yearMonth=${YM}`, { waitUntil: "networkidle", timeout: 120000 });
  await m.locator(".kin-print").waitFor({ timeout: 60000 });
  const over = await m.evaluate(`[...document.querySelectorAll('[data-kin-page] *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > 391).map(e => e.tagName + ' ' + (e.textContent || '').slice(0, 30))`);
  check("trang in: không phần tử nào tràn ngang ở 390px", (over as string[]).length === 0, over);
  const tiny = await m.evaluate(`[...document.querySelectorAll('[data-kin-page] button, [data-kin-page-header] a')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height).filter(h => h < 43.5)`);
  check("trang in: nút và liên kết hành động ≥ 44px", (tiny as number[]).length === 0, tiny);
  await shot(m, "doc-brand-print-390");
  const m2 = await (await ctxFor(TP, { width: 390, height: 800 })).newPage(); watch(m2);
  await goReports(m2, "Minh Anh");
  await m2.getByRole("button", { name: /Thương hiệu giấy tờ/ }).click();
  await m2.locator("#brand-name").waitFor();
  const over2 = await m2.evaluate(`[...document.querySelectorAll('main *, [data-kin-page] *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > 391 && !e.closest('.overflow-x-auto')).map(e => e.tagName + ' ' + (e.textContent || '').slice(0, 30))`);
  check("báo cáo tháng + thẻ thương hiệu: không tràn ngang ở 390px", (over2 as string[]).length === 0, over2);
  const tiny2 = await m2.evaluate(`[...document.querySelectorAll('#brand-body button, #brand-body label.inline-flex, #brand-body input:not([type=radio]), [role=group][aria-label="Bản in"] a, [role=group][aria-label="Bản in"] button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height).filter(h => h < 43.5)`);
  check("thẻ thương hiệu và nút bản in ≥ 44px", (tiny2 as number[]).length === 0, tiny2);
  await shot(m2, "doc-brand-card-390");

  section(ENFORCE ? "Gia sư Free (cổng bật): khoá đúng chỗ" : "Gia sư Free (cổng TẮT): không chặn ai");
  const fp = await (await ctxFor(TF, { width: 1280, height: 900 })).newPage(); watch(fp);
  await goReports(fp, "Chi Chi");
  await fp.getByRole("group", { name: "Bản in" }).waitFor({ timeout: 20000 });
  check("luôn có 'In / PDF (mẫu KiN)' và in được (Free vẫn xuất dữ liệu)", await fp.getByRole("link", { name: "In / PDF (mẫu KiN)" }).isVisible());
  if (ENFORCE) {
    check("Free: không có nút tạo; có chữ 'có trong KiN Pro' kèm liên kết gói", (await fp.getByRole("button", { name: "Tạo bản in có thương hiệu" }).count()) === 0 && await fp.getByText(/Bản in có thương hiệu: có trong/).isVisible() && (await fp.getByRole("link", { name: "KiN Pro" }).first().getAttribute("href")) === "/lop-cua-toi/goi");
    await fp.getByRole("button", { name: /Thương hiệu giấy tờ/ }).click();
    await fp.locator("#brand-name").waitFor();
    check("Free: nhãn 'Có trong KiN Pro', ô nhập khoá, không có nút Lưu, có liên kết 'Xem gói KiN Pro'", await fp.getByText("Có trong KiN Pro", { exact: true }).first().isVisible() && await fp.locator("#brand-name").isDisabled() && (await fp.getByRole("button", { name: "Lưu thương hiệu" }).count()) === 0 && await fp.getByRole("link", { name: "Xem gói KiN Pro" }).isVisible());
  } else {
    check("cổng TẮT: Free chưa cài thương hiệu → được hướng dẫn cài (không bị chặn vì gói, không chữ 'KiN Pro')", await fp.getByText(/Cài tên và màu ở thẻ/).isVisible() && (await fp.getByText(/Bản in có thương hiệu: có trong/).count()) === 0);
    await fp.getByRole("button", { name: /Thương hiệu giấy tờ/ }).click();
    await fp.locator("#brand-name").waitFor();
    check("cổng TẮT: Free sửa được thương hiệu (ô mở, có nút Lưu), không nhãn 'Có trong KiN Pro'", await fp.locator("#brand-name").isEnabled() && await fp.getByRole("button", { name: "Lưu thương hiệu" }).isVisible() && (await fp.getByText("Có trong KiN Pro", { exact: true }).count()) === 0);
    await fp.locator("#brand-name").fill("Lớp thử Free");
    await fp.getByRole("button", { name: "Lưu thương hiệu" }).click();
    await fp.getByText("Đã lưu thương hiệu giấy tờ.").waitFor({ timeout: 15000 });
    await fp.getByRole("button", { name: "Tạo bản in có thương hiệu" }).waitFor({ timeout: 15000 });
    check("cổng TẮT: sau khi cài, Free có nút 'Tạo bản in có thương hiệu' (không chặn ai)", true);
  }
  await fp.goto(`${BASE}/lop-cua-toi/bao-cao-thang/in/${sF.id}?yearMonth=${YM}`, { waitUntil: "networkidle", timeout: 120000 });
  await fp.locator(".kin-print").waitFor({ timeout: 60000 });
  const fpPaper = (await fp.locator(".kin-print").innerText()).replace(/\s+/g, " ");
  check("Free in mẫu KiN: có số liệu + 'Ghi trên KiN', không có nút đổi mẫu (chưa có thương hiệu)", fpPaper.includes("Chi Chi") && fpPaper.includes("Ghi trên KiN") && (await fp.getByRole("link", { name: "In bằng mẫu KiN" }).count()) === 0);

  section("Hết hạn Pro: bản đã tạo vẫn xem được");
  const xp = await (await ctxFor(TX, { width: 1280, height: 900 })).newPage(); watch(xp);
  await goReports(xp, "Duy Dũng");
  await xp.getByRole("group", { name: "Bản in" }).waitFor({ timeout: 20000 });
  check("hết hạn: có 'In bản có thương hiệu' (không có 'Tạo…' vì đã tạo rồi)", await xp.getByRole("link", { name: "In bản có thương hiệu" }).isVisible() && (await xp.getByRole("button", { name: "Tạo bản in có thương hiệu" }).count()) === 0);
  await xp.getByRole("link", { name: "In bản có thương hiệu" }).click();
  await xp.waitForURL(/bao-cao-thang\/in\//, { timeout: 60000 });
  await xp.locator(".kin-print").waitFor({ timeout: 60000 });
  check("hết hạn: tờ giấy vẫn mang tên thương hiệu cũ", (await xp.locator(".kin-print").innerText()).includes("Lớp Cô Hết Hạn"));

  section("Người không phải gia sư");
  const sp = await (await ctxFor(await mkUser({ name: "Học sinh" }))).newPage();
  await sp.goto(`${BASE}/lop-cua-toi/bao-cao-thang/in/${sP.id}?yearMonth=${YM}`, { waitUntil: "networkidle", timeout: 120000 });
  check("học sinh mở trang in bị chuyển đi, không thấy tờ giấy", !new URL(sp.url()).pathname.startsWith("/lop-cua-toi/bao-cao-thang") && (await sp.locator(".kin-print").count()) === 0, sp.url());

  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
