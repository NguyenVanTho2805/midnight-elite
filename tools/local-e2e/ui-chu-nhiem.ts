// SCL-B (21/11/2026, Q1–Q2) — Chủ nhiệm (quản trị cấp 1) đứng lớp ngay trong vỏ gia sư: thấy MỌI lớp nhóm theo gia sư phụ trách, mở lớp của gia sư khác như chủ lớp,
// sửa giáo trình được; nhóm "Quản lý" trỏ sang trang quản người ở tên miền admin. Gia sư thường chỉ thấy lớp mình, lớp người khác 403; học sinh không vào trang lớp gia sư.
// Chạy (máy chủ dev KHÔNG cờ): source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-chu-nhiem.ts
// Ca phá cố ý: (1) bỏ `|| isCenterAdmin(s)` trong tutorGate.tutorShellKind → các ca "vỏ gia sư / CHỦ NHIỆM" đỏ; (2) bỏ `allowAdmin: true` ở quan-lop/[id]/layout.tsx
// → ca "mở lớp của gia sư khác" đỏ; (3) trả `if (acc.role === "admin") return forbidden` vào loadClassHead → ca "Bạn không có quyền" đỏ.
import { api, BASE, mkTutor, mkUser, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { ADMIN_HOST } from "@/lib/hostRouting";

const GOTO = { waitUntil: "domcontentloaded" as const, timeout: 120000 };
const RAIL = "Module của gia sư";

(async () => {
  await wipe();
  const SA = await mkSuper("Chủ nhiệm Thọ");
  const TA = await mkTutor("Cô An"), TB = await mkTutor("Thầy Bảo");
  const S = await mkUser({ name: "Em Chi" });
  const cA = await mkCourse(TA.id, { name: "Toán 9 của An" }), cB = await mkCourse(TB.id, { name: "Lý 10 của Bảo" }), cX = await mkCourse(null, { name: "Lớp chưa chủ" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: cB.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: `cn-sec-${Date.now()}`, title: "Phần 1", order: 1, courseId: cB.id } });
  const ch = await prisma.chapter.create({ data: { id: `cn-ch-${Date.now()}`, title: "Chương 1", order: 1, sectionId: sec.id } });
  const les = await prisma.lesson.create({ data: { id: `cn-les-${Date.now()}`, code: "B1", title: "Bài 1", type: "document", order: 1, chapterId: ch.id, isLocked: false, isFree: false, documents: "[]" } });

  section("API danh sách lớp");
  const la = await api("GET", "/api/tutor/lop", { as: SA });
  const ids = (j: { rows?: { id: string }[] }) => (j.rows ?? []).map(r => r.id).sort().join();
  check("Chủ nhiệm: MỌI lớp (cả lớp chưa chủ), scope all, mỗi dòng có gia sư phụ trách", la.status === 200 && la.json.scope === "all" && ids(la.json) === [cA.id, cB.id, cX.id].sort().join()
    && la.json.rows.find((r: { id: string }) => r.id === cB.id)?.owner?.name === "Thầy Bảo" && la.json.rows.find((r: { id: string }) => r.id === cX.id)?.owner?.id === null, la.json);
  const lt = await api("GET", "/api/tutor/lop", { as: TA });
  check("gia sư A: chỉ lớp mình, không scope all, không lộ gia sư phụ trách", lt.status === 200 && ids(lt.json) === cA.id && lt.json.scope === undefined && lt.json.rows[0].owner === undefined, lt.json);
  check("học sinh: 403", (await api("GET", "/api/tutor/lop", { as: S })).status === 403);

  section("API giáo trình (gỡ chốt 403 với Chủ nhiệm)");
  check("Chủ nhiệm GET giáo trình lớp của Thầy Bảo → 200", (await api("GET", `/api/tutor/lop/${cB.id}/giao-trinh`, { as: SA })).status === 200);
  const add = await api("POST", `/api/tutor/lop/${cB.id}/giao-trinh/muc`, { as: SA, body: { lessonId: les.id, url: "https://www.youtube.com/watch?v=abcdefghijk" } });
  check("Chủ nhiệm thêm YouTube vào bài lớp Thầy Bảo → 201, cột ghi", add.status === 201 && (await prisma.lesson.findUniqueOrThrow({ where: { id: les.id } })).videoUrl === "https://www.youtube.com/watch?v=abcdefghijk", add.json);
  check("gia sư A mở / sửa giáo trình lớp Thầy Bảo → 403", (await api("GET", `/api/tutor/lop/${cB.id}/giao-trinh`, { as: TA })).status === 403
    && (await api("POST", `/api/tutor/lop/${cB.id}/giao-trinh/muc`, { as: TA, body: { lessonId: les.id, url: "https://www.youtube.com/watch?v=zzzzzzzzzzz" } })).status === 403);
  check("học sinh GET giáo trình → 403", (await api("GET", `/api/tutor/lop/${cB.id}/giao-trinh`, { as: S })).status === 403);

  await launch();
  const errors: string[] = [];
  const watch = (p: import("playwright").Page) => {
    p.on("pageerror", e => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]|negative time stamp/i.test(m.text())) errors.push(m.text()); });
  };

  section("Chủ nhiệm trong vỏ gia sư (1280)");
  const cs = await ctxFor(SA, { width: 1280, height: 900 });
  const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${BASE}/lop-cua-toi`, GOTO);
  await ps.waitForURL(u => u.pathname === "/lop-cua-toi/lop", { timeout: 90000 }).catch(() => {});
  await ps.getByRole("heading", { name: "Lớp học", level: 1 }).waitFor({ timeout: 90000 });
  const rail = ps.getByRole("navigation", { name: RAIL });
  check("/lop-cua-toi → /lop-cua-toi/lop, vỏ gia sư, không băng xem thử", new URL(ps.url()).pathname === "/lop-cua-toi/lop" && await rail.count() === 1 && await ps.locator("[data-admin-preview]").count() === 0, ps.url());
  check("nhãn vai 'CHỦ NHIỆM'", await rail.getByText("CHỦ NHIỆM").count() > 0);
  await ps.locator("[data-owner-group]").first().waitFor({ timeout: 60000 });
  const groups = await ps.locator("[data-owner-group] h2").allInnerTexts();
  check("lớp nhóm theo gia sư phụ trách (An, Bảo, rồi lớp chưa chủ)", groups.length === 3 && groups[0].startsWith("Cô An") && groups[1].startsWith("Thầy Bảo") && groups[2].startsWith("Chưa có gia sư phụ trách"), groups);
  check("không có nút 'Tạo lớp' (trang tạo lớp của gia sư không mở cho vai này)", await ps.getByRole("link", { name: "Tạo lớp" }).count() === 0);
  const manage = await rail.locator(`a[href^="https://${ADMIN_HOST}/admin/"]`).evaluateAll(els => els.map(e => `${(e.textContent ?? "").trim()}|${e.getAttribute("href")}`));
  check("nhóm 'Quản lý': Gia sư · Học sinh · Hàng chờ duyệt sang tên miền admin", ["gia-su", "hoc-sinh", "kiem-duyet"].every(k => manage.some(m => m.endsWith(`/admin/${k}`))), manage);
  check("không có module riêng của gia sư (Hộp việc / Lịch / Học phí / Học sinh của gia sư)", await rail.locator('a[href="/lop-cua-toi/lich"], a[href="/lop-cua-toi/hoc-phi"], a[href="/lop-cua-toi/hoc-sinh"]').count() === 0);
  await shot(ps, "chu-nhiem-lop");

  await ps.goto(`${BASE}/lop-cua-toi/quan-lop/${cB.id}`, GOTO);
  await ps.getByRole("heading", { name: "Lý 10 của Bảo" }).first().waitFor({ timeout: 90000 });
  await ps.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  check("mở lớp của gia sư khác: đầu lớp + tab của chủ lớp, không 'Bạn không có quyền'", new URL(ps.url()).pathname.startsWith(`/lop-cua-toi/quan-lop/${cB.id}`) && await ps.getByText("Bạn không có quyền với lớp này").count() === 0, ps.url());
  await shot(ps, "chu-nhiem-lop-cua-bao");
  await ps.goto(`${BASE}/lop-cua-toi/${cB.id}`, GOTO);
  await ps.waitForURL(u => u.pathname.startsWith(`/lop-cua-toi/quan-lop/${cB.id}`), { timeout: 60000 }).catch(() => {});
  check("trang lớp cũ /lop-cua-toi/<lớp> → dải tab quan-lop", new URL(ps.url()).pathname.startsWith(`/lop-cua-toi/quan-lop/${cB.id}`), ps.url());
  await cs.close();

  section("Điện thoại 390: không tràn ngang");
  const cm = await ctxFor(SA, { width: 390, height: 844 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}/lop-cua-toi/lop`, GOTO);
  await pm.locator("[data-owner-group]").first().waitFor({ timeout: 90000 });
  check("390px không tràn ngang", await pm.evaluate(() => document.documentElement.scrollWidth <= 390));
  await shot(pm, "chu-nhiem-lop-390");
  await cm.close();

  section("Gia sư A / học sinh");
  const ct = await ctxFor(TA, { width: 1280, height: 900 });
  const pt = await ct.newPage(); watch(pt);
  await pt.goto(`${BASE}/lop-cua-toi/quan-lop/${cB.id}`, GOTO);
  await pt.getByText("Bạn không có quyền với lớp này").first().waitFor({ timeout: 90000 }).catch(() => {});
  check("gia sư A mở lớp Thầy Bảo → 'Bạn không có quyền với lớp này', không tên lớp", await pt.getByText("Bạn không có quyền với lớp này").count() > 0 && await pt.getByText("Lý 10 của Bảo").count() === 0);
  check("gia sư A vẫn là vỏ 'GIA SƯ'", await pt.getByRole("navigation", { name: RAIL }).getByText("GIA SƯ").count() > 0);
  await ct.close();
  const cst = await ctxFor(S, { width: 1280, height: 900 });
  const pst = await cst.newPage(); watch(pst);
  await pst.goto(`${BASE}/lop-cua-toi/quan-lop/${cB.id}`, GOTO);
  await pst.waitForURL(u => !u.pathname.startsWith("/lop-cua-toi/quan-lop"), { timeout: 90000 }).catch(() => {});
  check("học sinh không vào trang lớp của gia sư (bị đưa đi)", !new URL(pst.url()).pathname.startsWith("/lop-cua-toi/quan-lop"), pst.url());
  check("học sinh không thấy thanh module gia sư", await pst.getByRole("navigation", { name: RAIL }).count() === 0);
  await cst.close();

  section("Không lỗi trình duyệt");
  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
