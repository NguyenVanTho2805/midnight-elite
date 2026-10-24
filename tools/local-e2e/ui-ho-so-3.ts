// Lát 3 bằng trình duyệt thật: điểm từng buổi (BU-11) trong màn điểm danh + Sổ của con của phụ huynh; gia đình (HS-12); danh sách chờ (LO-14).
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-ho-so-3.ts
import { randomBytes } from "node:crypto";
import { api, BASE, mkCourse, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const course = await mkCourse(T.id, { name: "Toán 9", capacity: 2 });
  const S1 = await mkUser({ name: "Em Đủ Đồng Ý" }), S2 = await mkUser({ name: "Em Thiếu Đồng Ý" });
  for (const u of [S1, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  const sess = await prisma.attendanceSession.create({ data: { courseId: course.id, date: new Date(Date.UTC(2026, 9, 20)), createdBy: T.id } });
  const p1 = (await api("POST", "/api/tutor/ho-so", { as: T, body: { name: S1.name, ageGroup: "16plus", userId: S1.id, consent: { self: true, scopes: ["basic", "scores"] } } })).json.id as string;
  const p2 = (await api("POST", "/api/tutor/ho-so", { as: T, body: { name: S2.name, ageGroup: "16plus", userId: S2.id, consent: { self: true, scopes: ["basic"] } } })).json.id as string;
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };
  await launch();
  const pg = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(pg);

  section("Điểm từng buổi trong màn điểm danh (BU-11)");
  await pg.goto(`${BASE}/admin/khoa-hoc/${course.id}/diem-danh?date=2026-10-20`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-diem-buoi]").waitFor({ timeout: 90000 });
  await pg.locator("[data-diem-row]").first().waitFor({ timeout: 30000 });
  const rowOk = pg.locator("[data-diem-row]", { hasText: S1.name }), rowNo = pg.locator("[data-diem-row]", { hasText: S2.name });
  check("mục nói rõ: chỉ gia sư và phụ huynh của đúng em đó xem; học sinh không thấy", await pg.locator("[data-diem-buoi]").getByText(/học sinh không thấy/).isVisible());
  check("em đủ đồng ý: có ô Điểm và BTVN %", await rowOk.getByLabel(`Điểm của ${S1.name}`).isVisible() && await rowOk.getByLabel(/Phần trăm hoàn thành BTVN/).isVisible());
  check("em thiếu đồng ý: KHÔNG có ô nhập, ghi 'Thiếu đồng ý ghi điểm' + liên kết sang hồ sơ để xác nhận", await rowNo.getByLabel(`Điểm của ${S2.name}`).count() === 0 && await rowNo.getByText("Thiếu đồng ý ghi điểm").isVisible() && await rowNo.getByRole("link", { name: "Mở hồ sơ để xác nhận" }).getAttribute("href") === `/lop-cua-toi/hoc-sinh/${p2}`);
  const save = pg.getByRole("button", { name: "Lưu điểm buổi" });
  check("chưa sửa gì → nút Lưu khoá", await save.isDisabled());
  await rowOk.getByLabel(`Điểm của ${S1.name}`).fill("11");
  check("điểm 11 → báo ngay quy tắc, Lưu vẫn khoá", await rowOk.getByText(/Điểm 0 đến 10/).isVisible() && await save.isDisabled());
  await rowOk.getByLabel(`Điểm của ${S1.name}`).fill("8,5");
  await rowOk.getByLabel(/Phần trăm hoàn thành BTVN/).fill("90");
  await save.click();
  await pg.getByText("Đã lưu điểm cho 1 em.").waitFor({ timeout: 30000 });
  check("lưu → DB có 8,5 điểm và 90%", await (async () => { const r = await prisma.sessionStudentScore.findFirst({ where: { userId: S1.id } }); return r?.score === 8.5 && r?.homeworkPct === 90; })());
  await rowOk.getByText("Hoàn thành BTVN 90%").waitFor({ timeout: 30000 });
  check("sau lưu hiện chip chữ 'Hoàn thành BTVN 90%' và giữ giá trị 8,5", await rowOk.getByLabel(`Điểm của ${S1.name}`).inputValue() === "8,5");
  await shot(pg, "ho-so-diem-buoi");

  section("Phụ huynh thấy điểm của ĐÚNG em đó (Sổ của con)");
  const par = await mkUser({ name: "Phụ huynh" }); const token = randomBytes(16).toString("hex");
  await prisma.parentLink.create({ data: { parentId: par.id, studentId: S1.id, status: "verified", verifiedAt: new Date(), portalToken: token } });
  const pp = await (await ctxFor(null, { width: 390, height: 800 })).newPage(); watch(pp);
  await pp.goto(`${BASE}/so-cua-con/${token}`, { waitUntil: "networkidle", timeout: 120000 });
  await pp.locator("[data-session-scores]").waitFor({ timeout: 90000 });
  const txt = await pp.locator("[data-session-scores]").innerText();
  check("mục 'Điểm từng buổi': lớp, ngày 20/10, Điểm 8,5/10, Hoàn thành BTVN 90%", txt.includes("Toán 9") && txt.includes("20/10") && txt.includes("Điểm 8,5/10") && txt.includes("Hoàn thành BTVN 90%"), txt);
  check("390px: không tràn ngang", await pp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);

  section("Gia đình (HS-12): tạo ngay trong hồ sơ, gắn cần đồng ý 'anh chị em'");
  const sib1 = (await api("POST", "/api/tutor/ho-so", { as: T, body: { name: "Bé Anh Chị", ageGroup: "u7", consent: { guardian: true, scopes: ["basic"] } } })).json.id as string;
  const sib2 = (await api("POST", "/api/tutor/ho-so", { as: T, body: { name: "Bé Em Út", ageGroup: "u7", consent: { guardian: true, scopes: ["basic", "family"] } } })).json.id as string;
  await pg.goto(`${BASE}/lop-cua-toi/hoc-sinh/${sib1}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-family]").waitFor({ timeout: 90000 });
  check("nói rõ: chung liên hệ, KiN không gộp phiếu học phí", await pg.locator("[data-family]").getByText(/không gộp phiếu học phí theo gia đình/).isVisible());
  await pg.locator("[data-new-family]").click();
  await pg.getByLabel("Tên gia đình").fill("Gia đình Thử");
  await pg.getByLabel("Tên phụ huynh", { exact: true }).last().fill("Chị Mai");
  await pg.getByLabel("Số Zalo phụ huynh").fill("0912345678");
  await pg.getByRole("button", { name: "Tạo gia đình" }).click();
  await pg.getByLabel("Gia đình", { exact: true }).selectOption({ label: "Gia đình Thử" });
  await pg.getByRole("button", { name: "Lưu thay đổi" }).click();
  await pg.getByText(/Cần xác nhận đồng ý trước khi lưu thay đổi này/).waitFor({ timeout: 30000 });
  check("gắn vào gia đình mà chưa có phạm vi 'anh chị em' → hiện hộp đồng ý (phạm vi bắt buộc, không tích sẵn), chưa lưu", await pg.locator("[data-consent-box]").isVisible() && await pg.locator("[data-consent-scope=family]").isChecked() && await pg.locator("[data-consent-scope=family]").isDisabled() && await pg.locator("[data-consent-party]:checked").count() === 0 && (await prisma.studentProfile.findUnique({ where: { id: sib1 } }))?.familyId === null);
  await pg.locator("[data-consent-party=guardian]").check();
  await pg.getByRole("button", { name: "Lưu lại kèm xác nhận" }).click();
  await pg.locator("[data-family-info]").waitFor({ timeout: 30000 });
  check("sau khi xác nhận: gắn gia đình, hiện liên hệ chung của gia đình", (await prisma.studentProfile.findUnique({ where: { id: sib1 } }))?.familyId !== null && (await pg.locator("[data-family-info]").innerText()).includes("Chị Mai, 0912345678"));
  const fid = (await prisma.studentProfile.findUnique({ where: { id: sib1 } }))!.familyId!;
  await prisma.studentProfile.update({ where: { id: sib2 }, data: { familyId: fid } });
  await pg.reload({ waitUntil: "networkidle" });
  await pg.locator("[data-family-info]").waitFor({ timeout: 60000 });
  check("hiện tên em cùng nhà (Bé Em Út có phạm vi family)", (await pg.locator("[data-family-info]").innerText()).includes("Bé Em Út"));

  section("Danh sách chờ xếp lớp (LO-14)");
  const w1 = (await api("POST", "/api/tutor/ho-so", { as: T, body: { name: "Bé Chờ Một", ageGroup: "u7", status: "waitlist", courseId: course.id, consent: { guardian: true, scopes: ["basic"] } } })).json.id as string;
  await new Promise(r => setTimeout(r, 40));
  await api("POST", "/api/tutor/ho-so", { as: T, body: { name: "Bé Chờ Hai", ageGroup: "u7", status: "waitlist", courseId: course.id, consent: { guardian: true, scopes: ["basic"] } } });
  await pg.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("tab", { name: /^Chờ xếp lớp · 2$/ }).click();
  const rows = pg.locator("[data-ho-so]");
  check("danh sách chờ theo thứ tự vào chờ, ghi 'Chờ thứ 1/2'", await rows.count() === 2 && (await rows.nth(0).innerText()).includes("Bé Chờ Một") && (await rows.nth(0).innerText()).includes("Chờ thứ 1") && (await rows.nth(1).innerText()).includes("Chờ thứ 2"));
  await rows.nth(0).getByRole("link", { name: /Mở hồ sơ/ }).click();
  await pg.locator("[data-place]").waitFor({ timeout: 60000 });
  check("lớp Toán 9 sức chứa 2, đang có 2 em đang học → cảnh báo đã đủ chỗ nhưng vẫn cho xếp", await pg.getByText(/đã đủ chỗ \(2\/2\)/).isVisible() && await pg.locator("[data-place]").isEnabled());
  await pg.locator("[data-place]").click();
  await pg.getByText("Đã xếp em vào lớp.").waitFor({ timeout: 30000 });
  check("xếp vào lớp → Hoạt động, hết nằm trong danh sách chờ", (await prisma.studentProfile.findUnique({ where: { id: w1 } }))?.status === "active" && (await prisma.studentProfile.findUnique({ where: { id: w1 } }))?.waitlistedAt === null);

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(mp);
  for (const path of [`/admin/khoa-hoc/${course.id}/diem-danh?date=2026-10-20`, `/lop-cua-toi/hoc-sinh/${sib1}`, `/lop-cua-toi/hoc-sinh/${p1}`]) {
    await mp.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await mp.locator("h1, h2").first().waitFor({ timeout: 90000 });
    await mp.waitForTimeout(800);
    const over = await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean;
    const small = await mp.evaluate(`[...document.querySelectorAll('main a, main button, main select, main input:not([type=checkbox]):not([type=radio]):not([type=date]), [data-diem-buoi] *')].filter(e => ['A','BUTTON','SELECT','INPUT'].includes(e.tagName) && e.offsetParent && e.getBoundingClientRect().height < 43.5 && !e.closest('nav')).map(e => (e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,30) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`390px ${path.replace(/c[0-9a-f]{24}/g, ":id").slice(0, 50)}: không tràn ngang, nút / ô ≥ 44px`, over && small.length === 0, small);
  }
  check("không lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
