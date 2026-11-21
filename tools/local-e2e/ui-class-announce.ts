// TB-LOP (17/11/2026) — "Thông báo lớp" trên trình duyệt thật (1280 + 390):
//  Gia sư: dải tab lớp có "Thông báo" → soạn (đếm ký tự, nút khoá khi rỗng) → Đăng (form thật, 303 ?tb=ok, dải báo) → tin hiện, link thành <a target=_blank rel=noopener>,
//          Ghim / Bỏ ghim, Gỡ hỏi lại bằng hộp xác nhận (Huỷ thì còn, Gỡ thì mất).
//  Học sinh: mở link của thông báo (…&tab=thong-bao) → tab Thông báo sáng, thấy tin; từ tab Nội dung bấm sang Thông báo; học sinh lớp khác không thấy.
//  390px không tràn ngang ở cả hai trang.
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

// Ô nội dung là ô có điều khiển (React): gõ trước khi trang hydrate thì bị xoá trắng. Gõ lại tới khi bộ đếm nhận chữ.
async function fillBody(pg: import("playwright").Page, text: string) {
  for (let i = 0; i < 40; i++) {
    await pg.getByLabel("Nội dung").fill(text);
    if ((await pg.locator("#tb-dem").innerText()).startsWith(`${text.length}/`)) return;
    await pg.waitForTimeout(250);
  }
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" }), SO = await mkUser({ name: "Em Khác" });
  const C = await mkCourse(T.id, { name: "Lý 10" });
  const C2 = await mkCourse(T.id, { name: "Hoá 11" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: SO.id, courseId: C2.id, status: "active" } });
  await launch();

  section("Gia sư: tab Thông báo, đăng tin");
  const p = await (await ctxFor(T)).newPage();
  await p.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const strip = p.getByRole("navigation", { name: /Trang của Quản lớp/ });
  await strip.waitFor({ timeout: 120000 });
  await strip.locator("[data-tab-khac]").click(); // SCL-G-GS: Thông báo nằm trong "Khác" của dải lớp
  check("dải tab lớp có 'Thông báo' (trong 'Khác')", (await strip.getByRole("link", { name: "Thông báo" }).count()) === 1);
  await strip.getByRole("link", { name: "Thông báo" }).click();
  await p.waitForURL(/\/thong-bao$/, { timeout: 90000 });
  await p.getByRole("heading", { name: "Đăng thông báo cho cả lớp" }).waitFor({ timeout: 90000 });
  check("tab Thông báo sáng (aria-current)", (await strip.locator("[aria-current=page]").innerText()).trim() === "Thông báo");
  check("chưa có tin: chữ 'Chưa có thông báo nào'", await p.getByText("Chưa có thông báo nào").isVisible());
  const btn = p.getByRole("button", { name: "Đăng thông báo" });
  check("ô rỗng → nút Đăng bị khoá", await btn.isDisabled());
  check("gợi ý ghi số học sinh nhận tin (1 em)", await p.getByText(/Gửi tới 1 học sinh đang học/).isVisible());
  const msg = "Tối thứ Sáu học online.\nLink phòng: https://meet.google.com/abc-defg-hij";
  await fillBody(p, msg);
  check("đếm ký tự cập nhật", (await p.locator("#tb-dem").innerText()).startsWith(`${msg.length}/`));
  await shot(p, "tb-gia-su-soan-1280");
  await btn.click();
  await p.waitForURL(/tb=ok/, { timeout: 90000 });
  check("dải báo 'Đã đăng thông báo'", await p.getByRole("status").filter({ hasText: "Đã đăng thông báo" }).isVisible());
  const card = p.locator("[data-thong-bao]").first();
  check("tin hiện, xuống dòng giữ nguyên", (await card.innerText()).includes("Tối thứ Sáu học online.\nLink phòng:"));
  const a = card.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" });
  check("link thành <a> mở tab mới, rel noopener", (await a.getAttribute("target")) === "_blank" && /noopener/.test((await a.getAttribute("rel")) ?? ""));
  await card.getByRole("button", { name: "Ghim" }).click();
  await p.waitForURL(/tb=ghim/, { timeout: 90000 });
  await eventually("Ghim → 'Đã ghim', nút thành 'Bỏ ghim'", async () => (await p.locator("[data-thong-bao]").first().innerText()).includes("Đã ghim") && await p.locator("[data-thong-bao]").first().getByRole("button", { name: "Bỏ ghim" }).isVisible());
  await shot(p, "tb-gia-su-ghim-1280");
  check("DB: 1 tin đã ghim; em An có 1 thông báo, em lớp khác 0", (await prisma.classAnnouncement.count({ where: { courseId: C.id, pinned: true, deletedAt: null } })) === 1
    && (await prisma.notification.count({ where: { userId: S.id, type: "class_announcement" } })) === 1 && (await prisma.notification.count({ where: { userId: SO.id } })) === 0);

  section("Học sinh: mở từ thông báo, đọc tin");
  const note = await prisma.notification.findFirst({ where: { userId: S.id, type: "class_announcement" } });
  const s = await (await ctxFor(S)).newPage();
  await s.goto(`${BASE}${note!.link}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await s.locator("[data-tb-hoc-sinh]").waitFor({ timeout: 120000 });
  check("tab 'Thông báo' đang chọn", (await s.getByRole("tab", { name: "Thông báo" }).getAttribute("aria-selected")) === "true");
  check("thấy tin + 'Đã ghim' + link bấm được", (await s.locator("[data-tb-hoc-sinh]").innerText()).includes("Tối thứ Sáu học online") && (await s.locator("[data-tb-hoc-sinh]").innerText()).includes("Đã ghim")
    && (await s.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" }).count()) === 1);
  check("học sinh không có nút Ghim / Gỡ / ô soạn", (await s.getByRole("button", { name: /Ghim|Gỡ|Đăng thông báo/ }).count()) === 0 && (await s.getByLabel("Nội dung").count()) === 0);
  await shot(s, "tb-hoc-sinh-1280");
  await s.goto(`${BASE}/student/hoc-tap?course=${encodeURIComponent(C.id)}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await s.getByRole("tab", { name: "Thông báo" }).waitFor({ timeout: 120000 });
  check("mở lớp thường → tab mặc định vẫn 'Nội dung'", (await s.getByRole("tab", { name: "Nội dung" }).getAttribute("aria-selected")) === "true");
  await s.getByRole("tab", { name: "Thông báo" }).click();
  await eventually("bấm tab Thông báo → thấy tin", async () => (await s.locator("[data-tb-hoc-sinh]").count()) === 1);
  check("bấm tab → địa chỉ ghi ?tab=thong-bao (tải lại vẫn đúng tab)", new URL(s.url()).searchParams.get("tab") === "thong-bao", s.url());
  // Rà soát P2: đang ở sẵn trang lớp (tab Nội dung), bấm thông báo trên chuông → phải sang tab Thông báo (router.push cùng trang, Content không mount lại).
  await s.getByRole("tab", { name: "Nội dung" }).click();
  await s.getByRole("button", { name: /^Thông báo/ }).first().click();
  await s.getByText("Lớp Lý 10 có thông báo mới từ gia sư. Bấm để xem.").first().click();
  await eventually("bấm thông báo khi đang ở lớp → tab Thông báo được chọn", async () => (await s.getByRole("tab", { name: "Thông báo" }).getAttribute("aria-selected")) === "true" && (await s.locator("[data-tb-hoc-sinh]").count()) === 1);
  const so = await (await ctxFor(SO)).newPage();
  await so.goto(`${BASE}/student/hoc-tap?course=${encodeURIComponent(C2.id)}&tab=thong-bao`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await so.getByText("Lớp chưa có thông báo nào").waitFor({ timeout: 120000 });
  check("em lớp Hoá: lớp mình chưa có tin, không lộ tin lớp Lý", !(await so.locator("body").innerText()).includes("Tối thứ Sáu"));

  section("Gia sư: gỡ tin có hỏi lại");
  await eventually("nút Gỡ mở khoá khi trang sẵn sàng (trước đó khoá: không gỡ được mà bỏ qua hỏi lại)", async () => await p.locator("[data-thong-bao]").first().getByRole("button", { name: "Gỡ" }).isEnabled());
  await p.locator("[data-thong-bao]").first().getByRole("button", { name: "Gỡ" }).click();
  const dlg = p.getByRole("alertdialog").or(p.getByRole("dialog"));
  await dlg.waitFor({ timeout: 30000 });
  check("hộp xác nhận 'Gỡ thông báo này?'", (await dlg.innerText()).includes("Gỡ thông báo này?"));
  await dlg.getByRole("button", { name: "Huỷ" }).click();
  check("Huỷ → tin còn", (await p.locator("[data-thong-bao]").count()) === 1 && (await prisma.classAnnouncement.count({ where: { deletedAt: null } })) === 1);
  await p.locator("[data-thong-bao]").first().getByRole("button", { name: "Gỡ" }).click();
  await dlg.getByRole("button", { name: "Gỡ thông báo" }).click();
  await p.waitForURL(/tb=xoa/, { timeout: 90000 });
  check("Gỡ → tin biến mất, DB có deletedAt", (await p.locator("[data-thong-bao]").count()) === 0 && (await prisma.classAnnouncement.count({ where: { deletedAt: { not: null } } })) === 1);
  await s.goto(`${BASE}${note!.link}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await s.getByText("Lớp chưa có thông báo nào").waitFor({ timeout: 120000 });
  check("học sinh không còn thấy tin đã gỡ", !(await s.locator("body").innerText()).includes("Tối thứ Sáu"));

  section("Còn lượt + giữ nháp khi máy chủ từ chối");
  await p.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}/thong-bao`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.locator("[data-tb-con-luot]").waitFor({ timeout: 120000 });
  check("hiện 'Còn 9/10 lượt đăng trong 24 giờ'", (await p.locator("[data-tb-con-luot]").innerText()).includes("Còn 9/10"), await p.locator("[data-tb-con-luot]").innerText());
  const draft = "Nháp dài của cô — không được mất khi bị từ chối.";
  await fillBody(p, draft);
  for (let i = 0; i < 9; i++) await prisma.classAnnouncement.create({ data: { courseId: C.id, authorId: T.id, body: `đầy ${i}`, deletedAt: new Date() } }); // hết lượt SAU khi trang đã mở
  await p.getByRole("button", { name: "Đăng thông báo" }).click();
  await p.waitForURL(/tb=nhieu/, { timeout: 90000 });
  await eventually("bị từ chối (tb=nhieu) → ô nội dung giữ nguyên chữ đã gõ", async () => (await p.getByLabel("Nội dung").inputValue()) === draft);
  check("hết lượt → báo bằng chữ, nút Đăng khoá", (await p.locator("[data-tb-con-luot]").innerText()).includes("đã đăng đủ 10 tin") && await p.getByRole("button", { name: "Đăng thông báo" }).isDisabled());
  await prisma.classAnnouncement.deleteMany({ where: { courseId: C.id, body: { startsWith: "đầy " } } });

  section("390px");
  const m = await (await ctxFor(T, { width: 390, height: 844 })).newPage();
  await m.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}/thong-bao`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await m.getByRole("heading", { name: "Đăng thông báo cho cả lớp" }).waitFor({ timeout: 120000 });
  await fillBody(m, "https://meet.google.com/" + "x".repeat(120) + " link rất dài không có khoảng trắng");
  await m.getByRole("button", { name: "Đăng thông báo" }).click();
  await m.waitForURL(/tb=ok/, { timeout: 90000 });
  check("390 gia sư: không tràn ngang (kể cả link rất dài)", await m.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"));
  const box = await m.getByRole("button", { name: "Ghim" }).first().boundingBox();
  check("390: nút Ghim cao ≥ 44px", (box?.height ?? 0) >= 44, box);
  await shot(m, "tb-gia-su-390");
  const sm = await (await ctxFor(S, { width: 390, height: 844 })).newPage();
  await sm.goto(`${BASE}${note!.link}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sm.locator("[data-tb-hoc-sinh]").waitFor({ timeout: 120000 });
  check("390 học sinh: không tràn ngang", await sm.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"));
  await shot(sm, "tb-hoc-sinh-390");

  await closeAll();
  done();
})().catch(async e => { console.error(e); await closeAll(); process.exit(1); });
