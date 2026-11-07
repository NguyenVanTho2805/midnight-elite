// TUT-dong-giang (giao diện) — đồng giảng ở màn hình, 1280 và 390. Theo mẫu ui-tutor-pending / ui-tutor-students.
//   G1  chủ lớp: tab "Giáo viên" (rỗng → mời bằng email → thấy "Chờ nhận lời"), email sai báo lỗi, gửi xong hiện câu chung, gỡ qua KinConfirm có chữ "giữ nguyên"
//   G2  trang lời mời /lop-cua-toi/dong-giang: Nhận lời → lớp hiện ở nhóm "Lớp tôi đồng giảng" cả Hộp việc lẫn danh sách Lớp; Từ chối; rỗng
//   G3  trong lớp (co_teacher): không tab Mã mời/Học phí, không nút Thêm học sinh/Cài đặt lớp, có huy hiệu vai, tab Giáo viên chỉ đọc + "Rời lớp này";
//       quét main không có "@"/số điện thoại học viên; trang buổi có "Đề nghị chủ lớp chốt", không "Đã dạy xong", không chữ học phí
//   G4  người lạ mở lớp → 404; ba trạng thái: chặn mạng (lỗi + Thử lại hoạt động), dữ liệu rỗng
//   G5  390px: không tràn ngang, nút trong khối đồng giảng ≥ 44px; mọi href không phải /admin/; thanh bên chỉ 1 mục sáng
// Bẻ X thì ca Y đỏ: bỏ `limited` ở DiemDanhPanel → G3 "Nhắn phụ huynh"; bỏ `mgr &&` ở tab Học phí → G3 "không tab Học phí"; đổi INVITE_SENT_TEXT → G1 "câu chung".
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";

const GOTO = { waitUntil: "domcontentloaded" as const, timeout: 120000 };
const RAIL = "Module của gia sư";
// Vỏ gia sư không có <main>: nội dung là mọi khối sau thanh trên (khối đầu) của cột phải.
const CONTENT = ".kin-chu-than > .flex-1 > :nth-child(n+2)";

(async () => {
  await wipe();
  const O = await mkTutor("Cô Chủ Lớp"), C = await mkTutor("Cô Đồng Giảng"), X = await mkTutor("Thầy Được Mời"), L = await mkTutor("Cô Người Lạ"), S = await mkTutor("Thầy Bộ Môn");
  const K1 = await mkCourse(O.id, { name: "Toán 9 thử" }), K2 = await mkCourse(O.id, { name: "Lý 8 thử" });
  const hs = await mkUser({ name: "Em Học Sinh Thử" });
  await prisma.user.update({ where: { id: hs.id }, data: { phone: "0912345678", school: "THCS Thử Nghiệm" } });
  await prisma.enrollment.create({ data: { userId: hs.id, courseId: K1.id, status: "active" } });
  const yesterday = vnDateKeyOf(new Date(Date.now() - 86_400_000));
  const ses = await prisma.attendanceSession.create({ data: { courseId: K1.id, date: new Date(`${yesterday}T00:00:00Z`), createdBy: O.id, taughtBy: C.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: ses.id, userId: hs.id, status: "present" } });
  const ct = (courseId: string, userId: string, role: string, status: string) => prisma.courseTeacher.create({ data: { courseId, userId, role, status, subjects: [], invitedBy: O.id, respondedAt: status === "active" ? new Date() : null } });
  const cCt = await ct(K1.id, C.id, "co_teacher", "active");
  const xCt = await ct(K2.id, X.id, "co_teacher", "invited");

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|negative time stamp/i.test(m.text())) errors.push(`${p.viewportSize()?.width}px ${p.url().replace(BASE, "")} :: ${m.text().slice(0, 160)}`); });
  };
  const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  /** Nút/ liên kết nhìn thấy trong `root` thấp hơn 44px (bỏ liên kết trong dòng chữ). */
  const small = (p: Page, root: string) => p.evaluate((sel) => [...document.querySelectorAll(`${sel} button, ${sel} a`)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !e.closest("p"); }).map(e => (e.textContent ?? "").trim().slice(0, 30)), root);
  const adminHrefs = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".kin-chu-than > .flex-1 > :nth-child(n+2) a[href^='/admin']")].map(a => a.getAttribute("href")));
  const mainText = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".kin-chu-than > .flex-1 > :nth-child(n+2)")].map(e => (e as HTMLElement).innerText).join("\n"));

  // ───────────────────────────── G1: chủ lớp ─────────────────────────────
  section("G1. Chủ lớp: tab Giáo viên (1280)");
  await prisma.courseTeacher.deleteMany({ where: { courseId: K1.id } }); // bắt đầu từ lớp trống giáo viên
  const po = await (await ctxFor(O, { width: 1280, height: 900 })).newPage(); watch(po);
  const resp = await po.goto(`${BASE}/lop-cua-toi/${K1.id}?tab=giao-vien`, GOTO);
  check("chủ lớp mở được lớp (200)", resp?.status() === 200, resp?.status());
  await po.getByText("Lớp này chỉ có cô dạy").waitFor({ timeout: 90000 });
  check("rỗng: câu giải thích + nút 'Mời giáo viên'", await po.getByText("Mời giáo viên nếu có người cùng dạy.").isVisible() && await po.getByRole("button", { name: "Mời giáo viên" }).first().isVisible());
  check("chủ lớp thấy đủ tab: Mã mời, Học phí, Giáo viên", await po.getByRole("tab", { name: "Mã mời" }).isVisible() && await po.getByRole("tab", { name: "Học phí" }).isVisible() && await po.getByRole("tab", { name: "Giáo viên" }).getAttribute("aria-selected") === "true");
  await po.getByRole("button", { name: "Mời giáo viên" }).first().click();
  const dlg = po.getByRole("dialog", { name: "Mời giáo viên cùng dạy" });
  await dlg.waitFor({ timeout: 20000 });
  await dlg.getByLabel("Email của giáo viên").fill("khong-phai-email");
  await dlg.getByRole("button", { name: "Gửi lời mời" }).click();
  check("email sai định dạng → báo lỗi, không gọi mạng", await dlg.getByRole("alert").filter({ hasText: "Email chưa đúng dạng" }).isVisible());
  check("hai lựa chọn vai có mô tả một dòng", await dlg.getByText("Soạn mọi bài, dạy buổi được giao").isVisible() && await dlg.getByText("Chỉ nhóm bài được giao").isVisible());
  await dlg.getByLabel("Email của giáo viên").fill(`  ${C.email.toUpperCase()}  `);
  await dlg.getByLabel("Môn phụ trách (không bắt buộc)").fill("Toán, Lý");
  check("hộp thoại mời: nút ≥ 44px ở 1280", (await small(po, "[role=dialog]")).length === 0, await small(po, "[role=dialog]"));
  await dlg.getByRole("button", { name: "Gửi lời mời" }).click();
  await po.locator("[data-moi-dg-xong]").waitFor({ timeout: 60000 });
  check("gửi xong: đúng câu chung, không báo email có tồn tại hay không", (await po.locator("[data-moi-dg-xong]").innerText()).trim() === "Nếu email đúng của một gia sư đã duyệt, lời mời đã được gửi.");
  check("DB: tạo đúng 1 lời mời cho Cô Đồng Giảng (invited, vai co_teacher)", await prisma.courseTeacher.count({ where: { courseId: K1.id, userId: C.id, status: "invited", role: "co_teacher" } }) === 1);
  await dlg.getByRole("button", { name: "Xong" }).click();
  const rowInv = po.locator("[data-gv-row=invited]");
  await rowInv.waitFor({ timeout: 30000 });
  check("danh sách có dòng 'Chờ nhận lời' (chỉ email đã nhập, chưa có tên)", await rowInv.getByText("Chờ nhận lời").isVisible() && (await rowInv.innerText()).toLowerCase().includes(C.email.toLowerCase()) && !(await rowInv.innerText()).includes("Cô Đồng Giảng"));
  await shot(po, "dong-giang-chu-1280");
  // G1b: gỡ qua KinConfirm
  await prisma.courseTeacher.updateMany({ where: { courseId: K1.id, userId: C.id }, data: { status: "active", respondedAt: new Date() } });
  await po.reload(GOTO);
  const rowAct = po.locator("[data-gv-row=active]");
  await rowAct.waitFor({ timeout: 90000 });
  check("sau khi nhận lời: dòng có tên, huy hiệu 'Đồng giảng', trạng thái 'Đang dạy', nút Đổi vai + Gỡ", await rowAct.getByText("Cô Đồng Giảng").isVisible() && await rowAct.locator("[data-role-badge=co_teacher]").isVisible() && await rowAct.getByText("Đang dạy").isVisible() && await rowAct.getByRole("button", { name: /Đổi vai/ }).isVisible() && await rowAct.getByRole("button", { name: /^Gỡ/ }).isVisible());
  await rowAct.getByRole("button", { name: /^Gỡ/ }).click();
  const cf = po.getByRole("alertdialog").or(po.getByRole("dialog")).filter({ hasText: "Gỡ" }).last();
  await cf.waitFor({ timeout: 30000 });
  check("hộp xác nhận gỡ nói rõ: buổi và điểm danh đã có được giữ nguyên", (await cf.innerText()).includes("Buổi và điểm danh đã có được giữ nguyên"));
  await cf.getByRole("button", { name: "Giữ lại" }).click();
  check("bấm 'Giữ lại' → vẫn còn giáo viên (không gỡ)", await prisma.courseTeacher.count({ where: { courseId: K1.id, userId: C.id, status: "active" } }) === 1);
  await rowAct.getByRole("button", { name: /^Gỡ/ }).click();
  await cf.waitFor({ timeout: 30000 });
  await cf.getByRole("button", { name: "Gỡ khỏi lớp" }).click();
  await po.locator("[data-gv-row=active]").waitFor({ state: "detached", timeout: 60000 });
  check("xác nhận gỡ → trạng thái removed; buổi + điểm danh cũ còn nguyên", await prisma.courseTeacher.count({ where: { courseId: K1.id, userId: C.id, status: "removed" } }) === 1 && await prisma.attendanceSession.count({ where: { id: ses.id } }) === 1 && await prisma.attendanceRecord.count({ where: { sessionId: ses.id } }) === 1);
  await prisma.courseTeacher.updateMany({ where: { courseId: K1.id, userId: C.id }, data: { status: "active", removedAt: null, removedBy: null } }); // trả lại cho G3
  await ct(K1.id, S.id, "subject_teacher", "active");

  // ───────────────────────────── G2: lời mời ─────────────────────────────
  section("G2. Trang lời mời (1280) → nhóm 'Lớp tôi đồng giảng'");
  const px = await (await ctxFor(X, { width: 1280, height: 900 })).newPage(); watch(px);
  await px.goto(`${BASE}/lop-cua-toi`, GOTO);
  await px.getByText("Bạn có 1 lời mời đồng giảng").waitFor({ timeout: 90000 });
  check("Hộp việc: thẻ 'Bạn có 1 lời mời đồng giảng' + nút dẫn tới /lop-cua-toi/dong-giang", await px.getByRole("link", { name: "Xem lời mời" }).getAttribute("href") === "/lop-cua-toi/dong-giang");
  check("Hộp việc: chưa nhận lời thì CHƯA có nhóm 'Lớp tôi đồng giảng'", await px.getByRole("heading", { name: "Lớp tôi đồng giảng" }).count() === 0);
  await px.getByRole("link", { name: "Xem lời mời" }).click();
  await px.waitForURL(/\/lop-cua-toi\/dong-giang$/, { timeout: 60000 });
  const card = px.locator(`[data-loi-moi="${xCt.id}"]`);
  await card.waitFor({ timeout: 60000 });
  const ctext = await card.innerText();
  check("thẻ lời mời: tên lớp, vai, 3 gạch đầu dòng quyền; KHÔNG tên chủ lớp", ctext.includes("Lý 8 thử") && ctext.includes("Đồng giảng") && ctext.includes("Không được xem tiền và liên hệ phụ huynh") && ctext.includes("Không được xoá lớp") && !ctext.includes("Cô Chủ Lớp"));
  check("hai nút Nhận lời / Từ chối ≥ 44px", (await small(px, `[data-loi-moi="${xCt.id}"]`)).length === 0, await small(px, `[data-loi-moi="${xCt.id}"]`));
  await shot(px, "dong-giang-loi-moi-1280");
  await card.getByRole("button", { name: "Nhận lời" }).click();
  await px.locator("[data-dg-note=ok]").waitFor({ timeout: 60000 });
  await px.getByText(/Đã nhận lời dạy lớp «Lý 8 thử»/).waitFor({ timeout: 60000 });
  await px.getByText("Bạn chưa có lời mời nào").waitFor({ timeout: 60000 }).catch(() => {});   // danh sách tải lại sau khi nhận: chờ, không đọc ngay (từng đỏ ngẫu nhiên do chạy đua)
  check("nhận lời → DB active; thẻ biến mất; trang nói 'Đã nhận lời'", await prisma.courseTeacher.count({ where: { id: xCt.id, status: "active" } }) === 1 && await card.count() === 0 && await px.getByText(/Đã nhận lời dạy lớp «Lý 8 thử»/).isVisible());
  check("hết lời mời → câu rỗng 'Bạn chưa có lời mời nào'", await px.getByText("Bạn chưa có lời mời nào").isVisible());
  await px.goto(`${BASE}/lop-cua-toi`, GOTO);
  await px.getByRole("heading", { name: "Lớp tôi đồng giảng" }).waitFor({ timeout: 90000 });
  const hang = px.locator(`[data-dong-giang-hang="${K2.id}"]`);
  check("Hộp việc: nhóm 'Lớp tôi đồng giảng' có dòng lớp + huy hiệu 'Đồng giảng' + dòng buổi chưa điểm danh", await hang.getByText("Lý 8 thử").isVisible() && await hang.locator("[data-role-badge=co_teacher]").isVisible() && /buổi chờ điểm danh|buổi chưa điểm danh/.test(await hang.innerText()));
  check("thẻ lời mời đã hết ở Hộp việc", await px.getByText(/lời mời đồng giảng/).count() === 0);
  await shot(px, "dong-giang-hop-viec-1280");
  await px.goto(`${BASE}/lop-cua-toi/lop`, GOTO);
  await px.getByRole("heading", { name: "Lớp tôi đồng giảng" }).waitFor({ timeout: 90000 });
  check("danh sách Lớp: nhóm 'Lớp tôi đồng giảng' có lớp Lý 8; liên kết → /lop-cua-toi/<id>", await px.locator(`[data-dong-giang-hang="${K2.id}"]`).getByRole("link", { name: "Lý 8 thử", exact: true }).getAttribute("href") === `/lop-cua-toi/${K2.id}`);
  const rail = px.getByRole("navigation", { name: RAIL });
  check("thanh bên ở trang Lớp: đúng 1 mục sáng", await px.locator("[aria-current=page]:visible").count() === 1 && await rail.locator("[aria-current=page]:visible").count() === 1, [await px.locator("[aria-current=page]:visible").count(), await rail.locator("[aria-current=page]:visible").count(), await px.locator("[aria-current=page]:visible").evaluateAll(e => e.map(x => x.outerHTML.slice(0, 120)))]);
  // Từ chối: dựng một lời mời mới
  const K3 = await mkCourse(O.id, { name: "Hoá 9 thử" });
  const dCt = await ct(K3.id, X.id, "subject_teacher", "invited");
  await px.goto(`${BASE}/lop-cua-toi/dong-giang`, GOTO);
  const card3 = px.locator(`[data-loi-moi="${dCt.id}"]`);
  await card3.waitFor({ timeout: 60000 });
  check("lời mời bộ môn nói đúng vai", (await card3.innerText()).includes("Giáo viên bộ môn"));
  await card3.getByRole("button", { name: "Từ chối" }).click();
  await px.locator("[data-dg-note=ok]").waitFor({ timeout: 60000 });
  check("từ chối → DB declined, lớp KHÔNG vào nhóm đồng giảng", await prisma.courseTeacher.count({ where: { id: dCt.id, status: "declined" } }) === 1);
  // trả lời hai lần (tab cũ): 409 → chữ "Lời mời đã được xử lý"
  const dCt2 = await ct((await mkCourse(O.id, { name: "Sinh 9 thử" })).id, X.id, "co_teacher", "invited");
  await px.reload(GOTO);
  await px.locator(`[data-loi-moi="${dCt2.id}"]`).waitFor({ timeout: 60000 });
  await prisma.courseTeacher.update({ where: { id: dCt2.id }, data: { status: "declined" } });
  await px.locator(`[data-loi-moi="${dCt2.id}"]`).getByRole("button", { name: "Nhận lời" }).click();
  await px.locator("[data-dg-note=err]").waitFor({ timeout: 60000 });
  check("lời mời đã xử lý ở nơi khác → báo 'Lời mời đã được xử lý' (không lộ mã lỗi)", (await px.locator("[data-dg-note=err]").innerText()).includes("Lời mời đã được xử lý") && !/ALREADY|409/.test(await px.locator("[data-dg-note=err]").innerText()));

  // ───────────────────────────── G3: trong lớp (đồng giảng) ─────────────────────────────
  section("G3. Đồng giảng ở trong lớp (1280)");
  const pc = await (await ctxFor(C, { width: 1280, height: 900 })).newPage(); watch(pc);
  const rc = await pc.goto(`${BASE}/lop-cua-toi/${K1.id}`, GOTO);
  check("đồng giảng mở được lớp (200, không 404)", rc?.status() === 200, rc?.status());
  await pc.getByRole("tab", { name: "Giáo viên" }).waitFor({ timeout: 90000 });
  check("huy hiệu vai 'Đồng giảng' + dòng 'Lớp bạn đồng giảng' ở đầu trang", await pc.locator("[data-dong-giang-dau]").getByText("Đồng giảng").first().isVisible() && await pc.getByText("Lớp bạn đồng giảng").isVisible());
  check("KHÔNG có tab Mã mời / Học phí / Cộng đồng lớp", await pc.getByRole("tab", { name: "Mã mời" }).count() === 0 && await pc.getByRole("tab", { name: "Học phí" }).count() === 0 && await pc.getByRole("tab", { name: "Cộng đồng lớp" }).count() === 0);
  check("KHÔNG có nút Thêm học sinh / Mời học sinh / Cài đặt lớp", await pc.getByRole("button", { name: /Thêm học sinh|Mời học sinh/ }).count() === 0 && await pc.getByRole("link", { name: "Cài đặt lớp" }).count() === 0);
  check("còn Giáo trình + Bản ghi của lớp", await pc.getByRole("link", { name: "Giáo trình" }).first().isVisible() && await pc.getByRole("link", { name: "Bản ghi của lớp" }).isVisible());
  await pc.getByText("Chưa có buổi điểm danh cho ngày này.").or(pc.locator("[data-dd-bar]")).waitFor({ timeout: 90000 }); // điểm danh đã tải xong
  const t1 = await mainText(pc);
  check("nội dung KHÔNG có '@' (email) và KHÔNG có số điện thoại 10 số", !t1.includes("@") && !/\b0\d{9}\b/.test(t1), t1.match(/\S*@\S*|\b0\d{9}\b/)?.[0]);
  check("không có nút 'Nhắn phụ huynh' / 'Nhắn nhóm Zalo lớp' / 'Tải CSV' / ô cho phụ huynh xem", await pc.getByRole("button", { name: /Nhắn phụ huynh|Nhắn nhóm Zalo/ }).count() === 0 && await pc.getByRole("link", { name: /Tải CSV|Tải Excel/ }).count() === 0 && await pc.getByText("Cho phụ huynh của em này xem").count() === 0);
  check("không có chữ 'học phí' / 'Học phí' trong nội dung lớp", !/học phí/i.test(t1));
  await pc.getByRole("tab", { name: /^Học sinh/ }).click();
  const t2 = await mainText(pc);
  check("tab Học sinh: có tên em, không 'Hồ sơ', không Danh bạ, không '@'/SĐT", t2.includes("Em Học Sinh Thử") && !t2.includes("Hồ sơ") && !t2.includes("Danh bạ") && !t2.includes("@") && !/\b0\d{9}\b/.test(t2), t2.slice(0, 400));
  await pc.getByRole("tab", { name: "Giáo viên" }).click();
  await pc.locator("[data-tab-giao-vien]").getByText("Đang dạy").first().waitFor({ timeout: 60000 });
  const t3 = await pc.locator("[data-tab-giao-vien]").innerText();
  check("tab Giáo viên (đồng giảng): chỉ đọc — có tên + vai, KHÔNG nút Mời/Đổi vai/Gỡ, KHÔNG email, CÓ 'Rời lớp này'", t3.includes("Cô Đồng Giảng") && t3.includes("Thầy Bộ Môn") && t3.includes("Giáo viên bộ môn") && !t3.includes("@") && await pc.getByRole("button", { name: /Mời giáo viên|Đổi vai|^Gỡ/ }).count() === 0 && await pc.getByRole("button", { name: "Rời lớp này" }).isVisible());
  check("không có lời mời chờ / tên chủ lớp trong tab Giáo viên của đồng giảng", !t3.includes("Chờ nhận lời") && !t3.includes("Cô Chủ Lớp"));
  check("mọi liên kết trong nội dung không đi /admin/", (await adminHrefs(pc)).length === 0, await adminHrefs(pc));
  await shot(pc, "dong-giang-trong-lop-1280");
  const pb = await (await ctxFor(C, { width: 1280, height: 900 })).newPage(); watch(pb);
  const rb = await pb.goto(`${BASE}/lop-cua-toi/buoi/${K1.id}/${yesterday}`, GOTO);
  check("trang buổi mở được với đồng giảng (200)", rb?.status() === 200, rb?.status());
  await pb.locator("[data-bu-close]").waitFor({ timeout: 90000 });
  await pb.locator("[data-dd-bar]").waitFor({ timeout: 90000 }); // danh sách điểm danh đã tải xong (chữ ở thanh dưới cũng được quét)
  const tb = await mainText(pb);
  check("trang buổi: có 'Đề nghị chủ lớp chốt', KHÔNG 'Đã dạy xong', KHÔNG 'Mở lại buổi'", await pb.getByRole("button", { name: "Đề nghị chủ lớp chốt" }).isVisible() && await pb.getByRole("button", { name: "Đã dạy xong" }).count() === 0 && await pb.getByRole("button", { name: "Mở lại buổi" }).count() === 0);
  check("trang buổi: không chữ học phí, không Chia sẻ báo cáo (Zalo), không '@'/SĐT", !/học phí/i.test(tb) && await pb.getByRole("button", { name: "Chia sẻ báo cáo buổi" }).count() === 0 && !tb.includes("@") && !/\b0\d{9}\b/.test(tb), tb.match(/.{20}học phí.{20}/i)?.[0]);
  await pb.getByRole("button", { name: "Đề nghị chủ lớp chốt" }).click();
  await pb.getByRole("button", { name: "Đã báo chủ lớp" }).waitFor({ timeout: 60000 });
  check("bấm đề nghị → nút đổi 'Đã báo chủ lớp' và vô hiệu; chủ lớp nhận đúng 1 thông báo", await pb.getByRole("button", { name: "Đã báo chủ lớp" }).isDisabled() && await prisma.notification.count({ where: { userId: O.id, type: "session_close_request" } }) === 1);
  check("thông báo không chứa tên người", !(await prisma.notification.findMany({ where: { userId: O.id, type: "session_close_request" } })).some(n => /Cô Đồng Giảng|Em Học Sinh/.test(`${n.title} ${n.message}`)));
  await shot(pb, "dong-giang-buoi-1280");
  // Rời lớp (đồng giảng thứ hai, bộ môn S)
  const ps = await (await ctxFor(S, { width: 1280, height: 900 })).newPage(); watch(ps);
  await ps.goto(`${BASE}/lop-cua-toi/${K1.id}?tab=giao-vien`, GOTO);
  await ps.getByRole("button", { name: "Rời lớp này" }).waitFor({ timeout: 90000 });
  check("bộ môn chưa được giao gì: chỉ thấy số học sinh, không thấy tên em", (await mainText(ps)).includes("Học sinh · 1") && !(await mainText(ps)).includes("Em Học Sinh Thử"));
  await ps.getByRole("button", { name: "Rời lớp này" }).click();
  const cfl = ps.getByRole("alertdialog").or(ps.getByRole("dialog")).filter({ hasText: "Rời lớp này?" }).last();
  await cfl.waitFor({ timeout: 30000 });
  await cfl.getByRole("button", { name: "Rời lớp" }).click();
  await ps.waitForURL(/\/lop-cua-toi\/lop$/, { timeout: 60000 });
  check("rời lớp → removed, quay về danh sách Lớp, lớp không còn trong nhóm đồng giảng", await prisma.courseTeacher.count({ where: { courseId: K1.id, userId: S.id, status: "removed" } }) === 1);
  const rs = await ps.goto(`${BASE}/lop-cua-toi/${K1.id}`, GOTO);
  check("sau khi rời: mở lại lớp → 404 (không lộ lớp)", rs?.status() === 404, rs?.status());

  // ───────────────────────────── G4: người lạ + ba trạng thái ─────────────────────────────
  section("G4. Người lạ + lỗi/rỗng");
  const pl = await (await ctxFor(L, { width: 1280, height: 900 })).newPage(); watch(pl);
  const rl = await pl.goto(`${BASE}/lop-cua-toi/${K1.id}`, GOTO);
  check("gia sư lạ mở lớp của người khác → 404", rl?.status() === 404, rl?.status());
  const rl2 = await pl.goto(`${BASE}/lop-cua-toi/dong-giang`, GOTO);
  await pl.getByText("Bạn chưa có lời mời nào").waitFor({ timeout: 60000 });
  check("gia sư không có lời mời: trang rỗng nói rõ + nút về danh sách Lớp (200)", rl2?.status() === 200 && await pl.getByRole("link", { name: "Về danh sách lớp" }).getAttribute("href") === "/lop-cua-toi/lop");
  // lỗi tải + Thử lại: tab Giáo viên của chủ lớp
  const pe = await (await ctxFor(O, { width: 1280, height: 900 })).newPage(); watch(pe);
  let fail = true;
  await pe.route("**/api/tutor/lop/*/giao-vien", r => (fail && r.request().method() === "GET" ? r.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : r.continue()));
  await pe.goto(`${BASE}/lop-cua-toi/${K1.id}?tab=giao-vien`, GOTO);
  await pe.getByText("Không tải được danh sách giáo viên.").waitFor({ timeout: 90000 });
  check("lỗi tải tab Giáo viên: có dải báo + 'Thử lại'", await pe.getByRole("button", { name: "Thử lại" }).isVisible());
  fail = false;
  await pe.getByRole("button", { name: "Thử lại" }).click();
  await pe.locator("[data-gv-row]").first().waitFor({ timeout: 60000 });
  check("bấm 'Thử lại' → danh sách hiện lại", await pe.getByText("Không tải được danh sách giáo viên.").count() === 0);
  // đang tải: chặn mạng giữ lại → khung xương
  const pk = await (await ctxFor(O, { width: 1280, height: 900 })).newPage(); watch(pk);
  let release: () => void = () => {};
  const gate = new Promise<void>(r => { release = r; });
  await pk.route("**/api/tutor/lop/*/giao-vien", async r => { await gate; await r.continue(); });
  await pk.goto(`${BASE}/lop-cua-toi/${K1.id}?tab=giao-vien`, GOTO);
  await pk.getByLabel("Đang tải giáo viên của lớp").waitFor({ timeout: 90000 });
  check("đang tải: khung xương có nhãn 'Đang tải giáo viên của lớp'", true);
  release();
  // lỗi nhóm đồng giảng ở Lớp
  const pn = await (await ctxFor(C, { width: 1280, height: 900 })).newPage(); watch(pn);
  let fail2 = true;
  await pn.route("**/api/tutor/dong-giang", r => (fail2 ? r.abort() : r.continue()));
  await pn.goto(`${BASE}/lop-cua-toi/lop`, GOTO);
  await pn.getByText("Không tải được nhóm Lớp tôi đồng giảng.").waitFor({ timeout: 90000 });
  fail2 = false;
  await pn.getByRole("button", { name: "Thử lại" }).last().click();
  await pn.getByRole("heading", { name: "Lớp tôi đồng giảng" }).waitFor({ timeout: 60000 });
  check("lỗi nhóm đồng giảng ở trang Lớp → Thử lại hoạt động", true);

  // ───────────────────────────── G5: 390px ─────────────────────────────
  section("G5. Điện thoại 390px");
  for (const [who, name, url, root] of [
    [O, "chủ · tab Giáo viên", `/lop-cua-toi/${K1.id}?tab=giao-vien`, "[data-tab-giao-vien]"],
    [C, "đồng giảng · trong lớp", `/lop-cua-toi/${K1.id}`, CONTENT],
    [C, "đồng giảng · tab Giáo viên", `/lop-cua-toi/${K1.id}?tab=giao-vien`, "[data-tab-giao-vien]"],
    [C, "đồng giảng · trang buổi", `/lop-cua-toi/buoi/${K1.id}/${yesterday}`, "[data-bu-close]"],
    [C, "đồng giảng · danh sách Lớp", `/lop-cua-toi/lop`, "[data-dong-giang-nhom]"],
    [C, "đồng giảng · Hộp việc", `/lop-cua-toi`, "[data-dong-giang-nhom]"],
  ] as const) {
    const m = await (await ctxFor(who, { width: 390, height: 844 })).newPage(); watch(m);
    await m.goto(`${BASE}${url}`, GOTO);
    await m.locator(root).first().waitFor({ timeout: 90000 });
    await m.waitForTimeout(800);
    check(`390px · ${name}: không tràn ngang`, await noOverflow(m));
    if (root !== CONTENT) { const s = await small(m, root); check(`390px · ${name}: nút/liên kết trong khối ≥ 44px`, s.length === 0, s); }
    if (name === "chủ · tab Giáo viên") await shot(m, "dong-giang-chu-390");
    if (name === "đồng giảng · trang buổi") await shot(m, "dong-giang-buoi-390");
    await m.context().close();
  }
  const mi = await (await ctxFor(O, { width: 390, height: 844 })).newPage(); watch(mi);
  await mi.goto(`${BASE}/lop-cua-toi/${K1.id}?tab=giao-vien`, GOTO);
  await mi.getByRole("button", { name: "Mời giáo viên" }).first().waitFor({ timeout: 90000 });
  await mi.getByRole("button", { name: "Mời giáo viên" }).first().click();
  await mi.getByRole("dialog", { name: "Mời giáo viên cùng dạy" }).waitFor({ timeout: 20000 });
  check("390px · hộp thoại mời: không tràn ngang, nút ≥ 44px", await noOverflow(mi) && (await small(mi, "[role=dialog]")).length === 0, await small(mi, "[role=dialog]"));
  await shot(mi, "dong-giang-moi-390");

  // Trang 404 của Next (notFound() ở dev) tự in "script tag while rendering React component" — lỗi có sẵn của khung 404, không do màn này; bỏ riêng dòng đó.
  const real = errors.filter(e => !/script tag while rendering React component/.test(e));
  check("không lỗi JS / console trong cả bài", real.length === 0, real.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
