// Trang "Học sinh" của gia sư (Figma 299:113083): /lop-cua-toi/hoc-sinh. Quyền theo chủ lớp, không lộ học sinh người khác,
// tab Đang học / Đã nghỉ, tìm + lọc lớp, trạng thái tải/lỗi/rỗng, 390px, mục thanh bên.
import { api, BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), O = await mkTutor("Cô Khác"), E = await mkTutor("Cô Chưa Có Lớp");
  for (const u of [T, O, E]) await prisma.user.update({ where: { id: u.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T.id, { name: "Văn 8" }), cO = await mkCourse(O.id, { name: "Lý 9 của người khác" });
  const A = await mkUser({ name: "Trần Gia Bảo" }), B = await mkUser({ name: "Đỗ Hà" }), N = await mkUser({ name: "Em Đã Nghỉ" }), W = await mkUser({ name: "Em Chờ Phụ Huynh" }), X = await mkUser({ name: "Em Của Cô Khác" });
  await prisma.user.update({ where: { id: A.id }, data: { phone: "0900000482", school: "THCS Thử Nghiệm" } });
  const en = (u: { id: string }, courseId: string, status: string) => prisma.enrollment.create({ data: { userId: u.id, courseId, status } });
  await en(A, c1.id, "active"); await en(B, c1.id, "active"); await en(B, c2.id, "active"); await en(N, c2.id, "suspended"); await en(W, c1.id, "pending_consent"); await en(X, cO.id, "active");

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };

  section("Quyền: API chỉ cho gia sư, chỉ trả học sinh của lớp mình");
  check("chưa đăng nhập → 401", (await api("GET", "/api/tutor/hoc-sinh")).status === 401);
  check("học sinh → 403", (await api("GET", "/api/tutor/hoc-sinh", { as: A })).status === 403);
  const j = (await api("GET", "/api/tutor/hoc-sinh", { as: T })).json;
  const names = (j.students as { name: string }[]).map(s => s.name).sort();
  check("gia sư Lan thấy 4 dòng của mình (An, Hà ×2 lớp, Nghỉ), KHÔNG thấy em của cô khác, KHÔNG thấy em chờ phụ huynh", names.join("|") === ["Em Đã Nghỉ", "Trần Gia Bảo", "Đỗ Hà", "Đỗ Hà"].sort().join("|"), names);
  const keys = new Set(Object.keys(j.students[0]));
  check("chỉ các trường trang lớp đã hiện (không thêm trường mới về trẻ em)", [...keys].every(k => ["key", "userId", "name", "email", "phone", "school", "courseId", "courseName", "enrolledAt", "status"].includes(k)), [...keys]);
  check("cô Khác chỉ thấy em của mình", ((await api("GET", "/api/tutor/hoc-sinh", { as: O })).json.students as { name: string }[]).map(s => s.name).join() === "Em Của Cô Khác");

  section("Gia sư Lan, máy tính 1280px");
  const pg = await (await ctxFor(T, { width: 1280, height: 800 })).newPage(); watch(pg);
  await pg.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Học sinh", level: 1 }).waitFor({ timeout: 90000 });
  const rail = pg.getByRole("navigation", { name: "Module của gia sư" });
  await pg.getByRole("list", { name: "Danh sách học sinh" }).waitFor({ timeout: 60000 });
  check("mục 'Học sinh' trên thanh bên đang sáng (aria-current) và là mục duy nhất sáng", await rail.getByRole("link", { name: /^Học sinh/ }).getAttribute("aria-current") === "page" && await rail.locator("[aria-current=page]").count() === 1);
  check("dòng phụ: 2 học sinh đang học (Bảo, Hà — Hà ở hai lớp vẫn tính một em)", await pg.getByText(/^2 học sinh đang học/).isVisible());
  check("tab 'Đang học · 2' và 'Đã nghỉ · 1'", await pg.getByRole("tab", { name: "Đang học · 2" }).isVisible() && await pg.getByRole("tab", { name: "Đã nghỉ · 1" }).isVisible());
  const rows = pg.locator("[data-hoc-sinh]");
  check("tab Đang học: 3 dòng (Bảo; Hà × 2 lớp); không có em đã nghỉ / chờ / của cô khác", await rows.count() === 3 && await pg.getByText("Em Đã Nghỉ").count() === 0 && await pg.getByText("Em Chờ Phụ Huynh").count() === 0 && await pg.getByText("Em Của Cô Khác").count() === 0);
  check("dòng Bảo: lớp Toán 9, trường, SĐT là liên kết tel:", await rows.filter({ hasText: "Trần Gia Bảo" }).getByText("Toán 9").isVisible() && await rows.filter({ hasText: "Trần Gia Bảo" }).getByText("THCS Thử Nghiệm").isVisible() && await pg.getByRole("link", { name: "0900000482" }).getAttribute("href") === "tel:0900000482");
  check("'Mở lớp' dẫn tới trang lớp của chính cô", await rows.filter({ hasText: "Trần Gia Bảo" }).getByRole("link", { name: /Mở lớp/ }).getAttribute("href") === `/lop-cua-toi/${c1.id}`);
  check("'Thêm học sinh' → wizard /lop-cua-toi/hoc-sinh/them (23/10: tạo hồ sơ có hộp đồng ý; lối mã mời vẫn ở trang Lớp), 'Nhập danh sách' → /lop-cua-toi/hoc-sinh/nhap", await pg.getByRole("link", { name: "Thêm học sinh" }).getAttribute("href") === "/lop-cua-toi/hoc-sinh/them" && await pg.getByRole("link", { name: "Nhập danh sách" }).getAttribute("href") === "/lop-cua-toi/hoc-sinh/nhap");
  await shot(pg, "tutor-students");
  await pg.getByRole("combobox", { name: "Lớp" }).selectOption(c2.id);
  check("lọc lớp Văn 8: còn đúng 1 dòng (Hà)", await rows.count() === 1 && await rows.first().getByText("Đỗ Hà").isVisible());
  await pg.getByRole("combobox", { name: "Lớp" }).selectOption("");
  await pg.getByLabel("Tìm học sinh").fill("gia bảo");
  check("tìm 'gia bảo': 1 dòng", await rows.count() === 1);
  await pg.getByLabel("Tìm học sinh").fill("không có ai tên này");
  check("không khớp → nói rõ + nút 'Bỏ lọc' đưa danh sách về như cũ", await pg.getByText("Không có em nào khớp").isVisible());
  await pg.getByRole("button", { name: "Bỏ lọc" }).click();
  check("sau 'Bỏ lọc' lại đủ 3 dòng", await rows.count() === 3);
  await pg.getByRole("tab", { name: "Đã nghỉ · 1" }).click();
  check("tab Đã nghỉ: đúng 1 dòng 'Em Đã Nghỉ'", await rows.count() === 1 && await rows.first().getByText("Em Đã Nghỉ").isVisible());

  section("Lỗi tải có 'Thử lại'");
  const pe = await (await ctxFor(T, { width: 1280, height: 800 })).newPage(); watch(pe);
  let fail = true;
  await pe.route("**/api/tutor/hoc-sinh", r => fail ? r.fulfill({ status: 500, body: "{}" }) : r.continue());
  await pe.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await pe.getByText("Không tải được danh sách học sinh.").waitFor({ timeout: 60000 });
  fail = false;
  await pe.getByRole("button", { name: "Thử lại" }).click();
  await pe.locator("[data-hoc-sinh]").first().waitFor({ timeout: 60000 });
  check("bấm Thử lại → danh sách hiện, dải lỗi biến mất", await pe.getByText("Không tải được danh sách học sinh.").count() === 0);

  section("Rỗng: gia sư chưa có học sinh");
  const pz = await (await ctxFor(E, { width: 1280, height: 800 })).newPage(); watch(pz);
  await pz.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await pz.getByText("Chưa có học sinh nào trong lớp của bạn").waitFor({ timeout: 90000 });
  check("rỗng có lời giải thích + nút 'Mở danh sách lớp' → /lop-cua-toi/lop", await pz.getByRole("link", { name: "Mở danh sách lớp" }).getAttribute("href") === "/lop-cua-toi/lop");

  section("Học sinh mở trang này → về /lop-cua-toi (không thấy dữ liệu)");
  const ps = await (await ctxFor(A, { width: 1280, height: 800 })).newPage();
  await ps.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  check("không ở lại /lop-cua-toi/hoc-sinh và không có danh sách", new URL(ps.url()).pathname !== "/lop-cua-toi/hoc-sinh" && await ps.locator("[data-hoc-sinh]").count() === 0, ps.url());

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(mp);
  await mp.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator("[data-hoc-sinh]").first().waitFor({ timeout: 90000 });
  check("không tràn ngang", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  const small = await mp.evaluate(`[...document.querySelectorAll('main a, main button, main select, main input, a[href*="hoc-sinh"], [role=tab]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && !e.closest('nav') && !e.closest('[data-hoc-sinh] a[href^="tel:"]')).map(e => e.textContent.trim().slice(0,30) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
  check("nút, ô nhập, tab cao ≥ 44px", small.length === 0, small);
  await shot(mp, "tutor-students-mobile");
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
