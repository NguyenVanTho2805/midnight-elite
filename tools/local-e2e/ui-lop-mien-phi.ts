// Chủ phản ánh 08/11/2026: "lớp free nhưng không thấy lớp ở đâu, không biết vào đâu để lấy mã lớp".
// Hành trình gia sư: tạo lớp miễn phí (3 cách vào) → thấy lớp trong /lop-cua-toi/lop + /api/tutor/lop → thấy MÃ LỚP có sẵn (khối "Cách học sinh vào lớp"), không sinh hai mã.
// Hành trình học sinh: từ vỏ học sinh có lối tới lớp miễn phí (menu Khác + màn Lớp của tôi trống) → /khoa-hoc?gia=free thấy lớp.
import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done, api, BASE } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import type { Page } from "playwright";

async function wizard(p: Page, name: string, policyLabel: string) {
  await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByLabel(/Tên lớp/).fill(name);
  await p.getByText("Miễn phí", { exact: true }).first().click();
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await p.getByRole("button", { name: "Thêm khung giờ" }).click();
  await p.locator("[data-block-panel] select").first().selectOption("2");
  await p.locator("#sched-s").selectOption("1140"); await p.locator("#sched-e").selectOption("1230");
  await p.getByRole("button", { name: "Lưu khung giờ" }).click();
  await p.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 10000 });
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await p.getByText(policyLabel, { exact: true }).first().click();
  await p.getByRole("button", { name: /^Tạo lớp/ }).click();
  await p.waitForURL(/moi=1/, { timeout: 90000 });
}
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Em An" });
  await launch();
  const p = await (await ctxFor(T, { width: 1280, height: 900 })).newPage();

  section("Gia sư: lớp miễn phí 'Cô duyệt' (mặc định) vừa tạo");
  await wizard(p, "Free duyet", "Cô duyệt");
  const c1 = await prisma.course.findFirstOrThrow({ where: { name: "Free duyet" } });
  await p.locator("[data-class-code]").waitFor({ timeout: 60000 });
  const code1 = (await p.locator("[data-class-code]").innerText()).trim();
  check("tab Mã mời mở sẵn và thấy MÃ LỚP 8 ký tự có sẵn (không phải bấm tạo)", /^[2-9A-Z]{8}$/.test(code1), code1);
  const invs = await prisma.classInvite.findMany({ where: { courseId: c1.id } });
  check("DB: đúng 1 mã lớp (kind class, không giới hạn lượt, không hết hạn) và trùng mã đang hiện", invs.length === 1 && invs[0].code === code1 && invs[0].kind === "class" && invs[0].maxUses === null && invs[0].expiresAt === null, invs);
  check("khối nói rõ cách vào: 'Xin vào lớp' + 'Cô duyệt' + link trang lớp + nút Sao chép mã", await p.locator("[data-join-howto]").getByText(/Xin vào lớp/).isVisible() && await p.getByRole("button", { name: "Sao chép link trang lớp" }).first().isVisible() && await p.getByRole("button", { name: /^Sao chép mã/ }).first().isVisible());
  check("khối 'Cách học sinh vào lớp' chỉ hiện MỘT lần trên trang (không trùng với đầu trang)", await p.locator("[data-join-howto]").count() === 1);
  await p.reload({ waitUntil: "networkidle" });
  await p.getByRole("tab", { name: "Mã mời" }).click();
  check("tải lại: vẫn đúng mã đó, vẫn 1 mã trong DB", (await p.locator("[data-class-code]").innerText()).trim() === code1 && (await prisma.classInvite.count({ where: { courseId: c1.id } })) === 1);
  const again = await api("POST", `/api/courses/${c1.id}/invites`, { as: T, body: { ensure: true } });
  check("gọi tạo mã lớp lần nữa → cùng mã, vẫn 1 mã", again.json?.code === code1 && (await prisma.classInvite.count({ where: { courseId: c1.id } })) === 1, again);

  section("Gia sư: ở tab khác, đầu trang lớp mới tạo cũng có khối mã");
  await p.goto(`${BASE}/lop-cua-toi/${c1.id}?moi=1`, { waitUntil: "networkidle" });
  check("tab Buổi học (mở mặc định) vẫn có khối + mã ngay đầu trang", await p.locator("[data-join-howto] [data-class-code]").isVisible() && (await p.locator("[data-class-code]").innerText()).trim() === code1);

  section("Gia sư: 'Chỉ mã mời' có mã; 'Vào ngay' có link, KHÔNG có mã");
  await wizard(p, "Free chi ma", "Chỉ mã mời");
  const c2 = await prisma.course.findFirstOrThrow({ where: { name: "Free chi ma" } });
  await p.locator("[data-class-code]").waitFor({ timeout: 60000 });
  check("'Chỉ mã mời': thấy mã + câu 'Chỉ ai có mã lớp'", await p.locator("[data-join-howto]").getByText(/Chỉ ai có mã lớp/).isVisible() && (await prisma.classInvite.count({ where: { courseId: c2.id } })) === 1);
  await wizard(p, "Free vao ngay", "Vào ngay");
  const c3 = await prisma.course.findFirstOrThrow({ where: { name: "Free vao ngay" } });
  await p.locator("[data-join-howto]").first().waitFor({ timeout: 60000 });
  check("'Vào ngay': không có mã, không có nút Tạo mã lớp; có link trang lớp + câu 'Vào lớp là vào ngay'", await p.locator("[data-class-code]").count() === 0 && await p.getByRole("button", { name: "Tạo mã lớp" }).count() === 0 && await p.getByRole("button", { name: "Sao chép link trang lớp" }).first().isVisible() && await p.locator("[data-join-howto]").getByText(/Vào lớp là vào ngay/).isVisible() && (await prisma.classInvite.count({ where: { courseId: c3.id } })) === 0);

  section("Gia sư: lớp miễn phí có trong danh sách (UI + API), không bị ẩn");
  const lop = await api("GET", "/api/tutor/lop", { as: T });
  const names = (lop.json.rows as { name: string; hidden: boolean }[]).filter(r => r.name.startsWith("Free ")).map(r => `${r.name}:${r.hidden}`);
  check("/api/tutor/lop trả đủ 3 lớp miễn phí, hidden=false", names.length === 3 && names.every(x => x.endsWith(":false")), names);
  await p.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "networkidle" });
  await p.getByRole("list", { name: "Danh sách lớp" }).waitFor({ timeout: 60000 });
  const body = (await p.locator("body").innerText());
  check("/lop-cua-toi/lop liệt kê cả 3 lớp", ["Free duyet", "Free chi ma", "Free vao ngay"].every(n => body.includes(n)));

  section("Lớp cũ (tạo trước khi có mã tự sinh): nút 'Tạo mã lớp' tạo đúng một mã");
  const old = await mkCourse(T.id, { name: "Lop cu" });
  await prisma.course.update({ where: { id: old.id }, data: { joinPolicy: "invite_only", tag: "Miễn phí" } });
  await p.goto(`${BASE}/lop-cua-toi/${old.id}?tab=ma-moi`, { waitUntil: "networkidle" });
  const mk = p.getByRole("button", { name: "Tạo mã lớp" });
  await mk.waitFor({ timeout: 60000 });
  check("chưa có mã: hiện nút Tạo mã lớp (không để trống)", await mk.isVisible() && await p.locator("[data-class-code]").count() === 0);
  await mk.click();
  await p.locator("[data-class-code]").waitFor({ timeout: 60000 });
  check("bấm → hiện mã, DB 1 mã; nút biến mất", await p.getByRole("button", { name: "Tạo mã lớp" }).count() === 0 && (await prisma.classInvite.count({ where: { courseId: old.id } })) === 1);

  section("Mã đang hiện dùng được: học sinh nhập → xin vào lớp 'Cô duyệt'");
  const rd = await api("POST", `/api/invites/${code1}/redeem`, { as: S });
  check("redeem mã lớp Cô duyệt → pending (chưa vào ngay)", rd.status === 200 && rd.json?.pending === true && (await prisma.enrollment.count({ where: { userId: S.id, courseId: c1.id } })) === 0, rd.json);

  section("390px: không tràn ngang, nút ≥ 44px");
  const m = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  await m.goto(`${BASE}/lop-cua-toi/${c1.id}?tab=ma-moi&moi=1`, { waitUntil: "networkidle" });
  await m.locator("[data-class-code]").waitFor({ timeout: 60000 });
  check("trang lớp (tab Mã mời) không tràn ngang", !(await overflow(m)));
  const small = await m.locator("[data-join-howto] button").evaluateAll(bs => bs.filter(b => b.getBoundingClientRect().height < 43.5).length);
  check("mọi nút trong khối ≥ 44px", small === 0, small);

  section("Học sinh: có lối tới lớp miễn phí");
  const sctx = await ctxFor(S, { width: 1280, height: 900, rail: "mac-dinh" });
  const q = await sctx.newPage();
  await q.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle", timeout: 120000 });
  const lnk = q.locator("[data-lop-mien-phi]");
  await lnk.waitFor({ timeout: 60000 });
  check("màn Lớp của tôi (chưa có lớp) có 'Tìm lớp miễn phí' → /khoa-hoc?gia=free", (await lnk.getAttribute("href")) === "/khoa-hoc?gia=free");
  const rail = q.getByRole("navigation", { name: "Module của học sinh" });
  check("thanh bên có mục 'Lớp miễn phí' (nhóm Khám phá) cùng chỗ với Gia sư/Cộng đồng/Tin tức", await rail.getByRole("link", { name: "Lớp miễn phí", exact: true }).count() >= 1);
  await lnk.click();
  await q.waitForURL(/\/khoa-hoc\?gia=free/, { timeout: 90000 });
  await q.getByText(/Free vao ngay/).first().waitFor({ timeout: 60000 });
  const cat = (await q.locator("body").innerText());
  check("/khoa-hoc lọc Miễn phí: thấy cả lớp 'Vào ngay' lẫn 'Cô duyệt' (học sinh thấy được lớp của gia sư)", cat.includes("Free vao ngay") && cat.includes("Free duyet"));
  await q.goto(`${BASE}/khoa-hoc/${c3.id}`, { waitUntil: "networkidle" });
  check("lớp 'Vào ngay': có nút 'Vào lớp miễn phí'", await q.getByRole("button", { name: /Vào lớp miễn phí/ }).or(q.getByRole("link", { name: /Vào lớp miễn phí/ })).first().isVisible());
  await q.goto(`${BASE}/khoa-hoc/${c1.id}`, { waitUntil: "networkidle" });
  check("lớp 'Cô duyệt': có nút 'Xin vào lớp'", await q.getByRole("button", { name: /Xin vào lớp/ }).or(q.getByRole("link", { name: /Xin vào lớp/ })).first().isVisible());

  const sm = await (await ctxFor(S, { width: 390, height: 800 })).newPage();
  await sm.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle" });
  await sm.locator("[data-lop-mien-phi]").waitFor({ timeout: 60000 });
  check("390px: Lớp của tôi trống không tràn, nút ≥ 44px", !(await overflow(sm)) && (await sm.locator("[data-lop-mien-phi]").evaluate(e => e.getBoundingClientRect().height)) >= 43.5);

  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
