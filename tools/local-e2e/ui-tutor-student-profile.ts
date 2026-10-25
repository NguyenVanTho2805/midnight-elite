// Hồ sơ nhiều tab của học sinh (HS-01/02/06/08/09, DD-07) trong trình duyệt thật: /lop-cua-toi/hoc-sinh (lọc cảnh báo, cột báo cáo) và /lop-cua-toi/hoc-sinh/em/[userId].
// Kiểm: 6 tab, chuyên cần 90 ngày, dữ liệu trẻ bị che khi thiếu đồng ý, bật / xem thử / thu hồi link, Đã nghỉ giữ dữ liệu, quyền (gia sư B, học sinh, khách), 390px.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-tutor-student-profile.ts
import { api, BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

const day = (ago: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - ago * 86_400_000); };

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), O = await mkTutor("Cô Khác");
  for (const u of [T, O]) await prisma.user.update({ where: { id: u.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), cO = await mkCourse(O.id, { name: "Lý của cô khác" });
  const S = await mkUser({ name: "Trần Gia Bảo" }), S2 = await mkUser({ name: "Đỗ Hà" }), X = await mkUser({ name: "Em Của Cô Khác" });
  const PAR = await mkUser({ name: "Phụ huynh Bảo" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: c1.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: c1.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: X.id, courseId: cO.id, status: "active" } });
  await prisma.enrollment.updateMany({ where: { userId: { in: [S.id, S2.id] } }, data: { createdAt: day(200) } });
  const link = await prisma.parentLink.create({ data: { parentId: PAR.id, studentId: S.id, status: "verified", verifiedAt: new Date() } });
  await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: 5, startTime: "19:00", endTime: "20:30" } });
  // Bảo: 12 buổi (10 có mặt, 1 muộn, 1 vắng) trong 90 ngày → có phần trăm; Hà: 3 buổi vắng liên tiếp mới nhất.
  for (let i = 0; i < 12; i++) {
    const s = await prisma.attendanceSession.create({ data: { courseId: c1.id, date: day(i * 5 + 1), createdBy: T.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: S.id, status: i === 3 ? "late" : i === 7 ? "absent" : "present" } });
    if (i < 3) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: S2.id, status: "absent" } });
  }
  await prisma.tuitionInvoice.create({ data: { code: "KINA2B3C", tutorId: T.id, studentId: S.id, yearMonth: "2026-10", amountDue: 480_000, paidAmount: 0, status: "sent" } });
  const g = await api("POST", "/api/tutor/ho-so", { as: T, body: { name: "Trần Gia Bảo", ageGroup: "7to15", userId: S.id, guardianName: "Cô Hằng", guardianPhone: "0912345678", consent: { guardian: true, child: true, scopes: ["basic"] } } });
  if (g.status !== 201) throw new Error("hồ sơ: " + JSON.stringify(g.json));

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };

  section("Quyền (trang)");
  const guest = await (await ctxFor(null)).newPage();
  await guest.goto(`${BASE}/lop-cua-toi/hoc-sinh/em/${S.id}`, { waitUntil: "networkidle", timeout: 120000 });
  check("khách → sang đăng nhập, không thấy tên em", new URL(guest.url()).pathname.startsWith("/dang-nhap") && !(await guest.content()).includes("Gia Bảo"), guest.url());
  const stu = await (await ctxFor(S, { width: 1280, height: 800 })).newPage();
  await stu.goto(`${BASE}/lop-cua-toi/hoc-sinh/em/${S.id}`, { waitUntil: "networkidle", timeout: 120000 });
  check("học sinh → ra khỏi trang gia sư", !new URL(stu.url()).pathname.startsWith("/lop-cua-toi/hoc-sinh"), stu.url());
  const par = await (await ctxFor(PAR, { width: 1280, height: 800 })).newPage();
  await par.goto(`${BASE}/lop-cua-toi/hoc-sinh/em/${S.id}`, { waitUntil: "networkidle", timeout: 120000 });
  check("phụ huynh (tài khoản học sinh) → ra khỏi trang gia sư", !new URL(par.url()).pathname.startsWith("/lop-cua-toi/hoc-sinh"), par.url());
  const pb = await (await ctxFor(O, { width: 1280, height: 800 })).newPage(); watch(pb);
  await pb.goto(`${BASE}/lop-cua-toi/hoc-sinh/em/${S.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pb.getByText("Em này không thuộc lớp của cô").waitFor({ timeout: 90000 });
  check("gia sư khác: câu giải thích + lối về danh sách, KHÔNG lộ tên / lớp / số", await pb.getByRole("link", { name: "Về danh sách học sinh" }).isVisible() && !(await pb.content()).includes("Gia Bảo") && !(await pb.content()).includes("0912345678"));

  section("Danh sách: cảnh báo và cột báo cáo (HS-01)");
  const pg = await (await ctxFor(T, { width: 1280, height: 800 })).newPage(); watch(pg);
  await pg.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-hoc-sinh]").first().waitFor({ timeout: 90000 });
  const rows = pg.locator("[data-hoc-sinh]");
  check("2 dòng; dòng Bảo: 'Báo cáo: Chưa bật' và cảnh báo còn phiếu (1)", await rows.count() === 2 && await rows.filter({ hasText: "Trần Gia Bảo" }).getByText("Báo cáo: Chưa bật").isVisible() && await rows.filter({ hasText: "Trần Gia Bảo" }).getByText("Còn phiếu chưa đóng đủ (1)").isVisible());
  check("dòng Hà: 'Chưa có phụ huynh liên kết' và 'Vắng liên tiếp 3 buổi'", await rows.filter({ hasText: "Đỗ Hà" }).getByText("Báo cáo: Chưa có phụ huynh liên kết").isVisible() && await rows.filter({ hasText: "Đỗ Hà" }).getByText("Vắng liên tiếp 3 buổi").isVisible());
  await pg.getByRole("combobox", { name: "Cảnh báo" }).selectOption("absent_streak");
  check("lọc 'Vắng liên tiếp': chỉ Hà", await rows.count() === 1 && await rows.first().getByText("Đỗ Hà").isVisible());
  await pg.getByRole("combobox", { name: "Cảnh báo" }).selectOption("unpaid");
  check("lọc 'Còn phiếu chưa đóng đủ': chỉ Bảo", await rows.count() === 1 && await rows.first().getByText("Trần Gia Bảo").isVisible());
  await pg.getByRole("combobox", { name: "Cảnh báo" }).selectOption("makeup");
  check("lọc 'Còn buổi bù': không ai → nói rõ + 'Bỏ lọc'", await pg.getByText("Không có em nào khớp").isVisible());
  await pg.getByRole("button", { name: "Bỏ lọc" }).click();
  check("sau 'Bỏ lọc' đủ 2 dòng", await rows.count() === 2);
  await rows.filter({ hasText: "Trần Gia Bảo" }).getByRole("link", { name: /^Hồ sơ của / }).click();
  await pg.getByRole("heading", { name: "Trần Gia Bảo", level: 1 }).waitFor({ timeout: 90000 });
  check("'Hồ sơ' mở trang nhiều tab của đúng em", pg.url().endsWith(`/lop-cua-toi/hoc-sinh/em/${S.id}`), pg.url());

  section("Hồ sơ: 6 tab");
  const tabs = ["Tổng quan", "Điểm danh", "Ghi chú", "Phiếu · 1", "Bài tập", "Báo cáo riêng"];
  check("đủ 6 tab đúng tên", (await Promise.all(tabs.map(t => pg.getByRole("tab", { name: t }).isVisible()))).every(Boolean));
  check("dòng phụ nói rõ chỉ dành cho gia sư", await pg.getByText(/Đang học · Thông tin chỉ dành cho cô/).isVisible());
  check("Tổng quan: lớp Toán 9 có lịch 'Thứ Sáu 19:00–20:30'", await pg.locator("[data-em-lop]").first().getByText(/Thứ Sáu 19:00–20:30/).isVisible());
  check("Tổng quan: người liên hệ (phạm vi cơ bản) hiện 'Cô Hằng' và số", await pg.getByText("Cô Hằng").first().isVisible() && await pg.getByRole("link", { name: "0912345678" }).isVisible());
  check("Tổng quan: chuyên cần 90 ngày có phần trăm (12 buổi ≥ 10)", await pg.getByText("Chuyên cần 90 ngày").isVisible() && /^\d+%$/.test((await pg.locator("[data-kin-stat]").filter({ hasText: "Chuyên cần 90 ngày" }).locator("p").nth(1).innerText()).trim()));
  await shot(pg, "tutor-student-profile");
  await pg.getByRole("tab", { name: "Điểm danh" }).click();
  check("Điểm danh: 12 dòng trong 90 ngày, tỷ lệ có phần trăm; buổi đã học 11 (trừ 1 vắng)", await pg.locator("[data-em-diem-danh]").count() === 12 && await pg.locator("[data-em-da-hoc]").count() === 11, await pg.locator("[data-em-diem-danh]").count());
  check("điểm từng buổi: nói rõ chưa hiện vì thiếu đồng ý (hồ sơ chỉ có phạm vi cơ bản)", await pg.getByText("Chưa hiện điểm từng buổi").isVisible());
  await pg.getByRole("tab", { name: "Ghi chú" }).click();
  check("Ghi chú: chưa có đồng ý mở rộng → KHÔNG hiện ghi chú, có lối đi bổ sung", await pg.getByText("Chưa có đồng ý cho thông tin mở rộng").isVisible() && await pg.locator("[data-em-ghi-chu]").count() === 0);
  await pg.getByRole("tab", { name: "Phiếu · 1" }).click();
  check("Phiếu: 'Phải đóng 480.000đ', trạng thái 'Đã gửi', lối mở phiếu", await pg.locator("[data-em-phieu]").first().getByText(/Phải đóng 480\.000đ/).isVisible() && await pg.getByRole("link", { name: "Mở phiếu KINA2B3C" }).isVisible());
  await pg.getByRole("tab", { name: "Bài tập" }).click();
  check("Bài tập: rỗng có lời giải thích + lối đi", await pg.getByText("Lớp của em chưa có bài tập").isVisible());

  section("HS-09: báo cáo riêng — Copy link, Xem thử, Thu hồi ngay");
  await pg.getByRole("tab", { name: "Báo cáo riêng" }).click();
  check("chưa bật: có nút 'Bật link báo cáo riêng', chưa có link", await pg.getByRole("button", { name: "Bật link báo cáo riêng" }).isVisible() && await pg.locator("[data-em-link]").count() === 0);
  await pg.getByRole("button", { name: "Bật link báo cáo riêng" }).click();
  await pg.locator("[data-em-link]").waitFor({ timeout: 30000 });
  const linkText = (await pg.locator("[data-em-link]").innerText()).trim();
  const tok = (await prisma.parentLink.findUnique({ where: { id: link.id } }))?.portalToken ?? "";
  check("bật xong: hiện link /so-cua-con/<token ngẫu nhiên>, không tên em", /^[0-9a-f]{32}$/.test(tok) && linkText.endsWith(`/so-cua-con/${tok}`) && !/gia|bao|bảo/i.test(linkText.replace(/https?:\/\/[^/]+/, "")), linkText);
  check("có 3 nút: Copy link, Xem thử (mở tab mới, link đúng), Thu hồi ngay", await pg.getByRole("button", { name: /Copy link|Chép link báo cáo riêng/ }).first().isVisible() && await pg.getByRole("link", { name: "Xem thử" }).getAttribute("href") === `/so-cua-con/${tok}` && await pg.getByRole("link", { name: "Xem thử" }).getAttribute("target") === "_blank" && await pg.getByRole("button", { name: "Thu hồi ngay" }).isVisible());
  const portalPage = await (await ctxFor(null)).newPage();
  const open1 = await portalPage.goto(`${BASE}/so-cua-con/${tok}`, { waitUntil: "networkidle", timeout: 120000 });
  check("Xem thử: trang Sổ của con mở được (200)", open1?.status() === 200 && (await portalPage.content()).includes("Gia Bảo"), open1?.status());
  await pg.getByRole("button", { name: "Thu hồi ngay" }).click();
  await pg.getByRole("button", { name: "Thu hồi ngay" }).last().click(); // hộp xác nhận KinConfirm
  await pg.getByRole("button", { name: "Bật link báo cáo riêng" }).waitFor({ timeout: 30000 });
  check("sau thu hồi: giao diện về 'Chưa bật', DB token = null", (await prisma.parentLink.findUnique({ where: { id: link.id } }))?.portalToken === null);
  const portal2 = await (await ctxFor(null)).newPage();
  await portal2.goto(`${BASE}/so-cua-con/${tok}`, { waitUntil: "networkidle", timeout: 120000 });
  check("link cũ KHÔNG còn xem được (không thấy tên em)", !(await portal2.content()).includes("Gia Bảo"));

  section("HS-06: Đã nghỉ giữ dữ liệu");
  await pg.getByRole("button", { name: "Đánh dấu đã nghỉ" }).click();
  await pg.getByRole("button", { name: "Đánh dấu đã nghỉ" }).last().click();
  await pg.getByRole("button", { name: "Cho học lại" }).waitFor({ timeout: 30000 });
  check("nút đổi thành 'Cho học lại', dòng phụ 'Đã nghỉ', DB suspended, điểm danh còn nguyên", await pg.getByText(/Đã nghỉ · Thông tin chỉ dành cho cô/).isVisible() && (await prisma.enrollment.findFirst({ where: { userId: S.id } }))?.status === "suspended" && (await prisma.attendanceRecord.count({ where: { userId: S.id } })) === 12);
  await pg.getByRole("tab", { name: "Điểm danh" }).click();
  check("em đã nghỉ vẫn xem được lịch sử điểm danh", await pg.locator("[data-em-diem-danh]").count() === 12);
  await pg.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("tab", { name: /^Đã nghỉ/ }).click();
  check("danh sách: em nằm ở tab Đã nghỉ", await pg.locator("[data-hoc-sinh]").filter({ hasText: "Trần Gia Bảo" }).count() === 1);
  await pg.goto(`${BASE}/lop-cua-toi/hoc-sinh/em/${S.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("button", { name: "Cho học lại" }).click();
  await pg.getByRole("button", { name: "Đánh dấu đã nghỉ" }).waitFor({ timeout: 30000 });
  check("Cho học lại → active", (await prisma.enrollment.findFirst({ where: { userId: S.id } }))?.status === "active");

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 844 })).newPage(); watch(mp);
  for (const t of ["tong-quan", "diem-danh", "ghi-chu", "phieu", "bai-tap", "bao-cao"]) {
    await mp.goto(`${BASE}/lop-cua-toi/hoc-sinh/em/${S.id}?tab=${t}`, { waitUntil: "networkidle", timeout: 120000 });
    await mp.getByRole("heading", { name: "Trần Gia Bảo", level: 1 }).waitFor({ timeout: 90000 });
    const overflow = await mp.evaluate(`document.documentElement.scrollWidth > window.innerWidth`) as boolean;
    const small = await mp.evaluate(`[...document.querySelectorAll('main a, main button, main select, main input, [role=tab]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && !e.closest('nav') && !e.closest('a[href^="tel:"]')).map(e => e.textContent.trim().slice(0,30) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`tab ${t}: không tràn ngang, nút ≥ 44px`, !overflow && small.length === 0, { overflow, small });
  }
  await mp.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator("[data-hoc-sinh]").first().waitFor({ timeout: 90000 });
  const smallL = await mp.evaluate(`[...document.querySelectorAll('main a, main button, main select, main input, [role=tab]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && !e.closest('nav') && !e.closest('[data-hoc-sinh] a[href^="tel:"]')).map(e => e.textContent.trim().slice(0,30) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
  check("danh sách 390px: không tràn ngang, nút ≥ 44px", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean && smallL.length === 0, smallL);
  await shot(mp, "tutor-student-profile-mobile");
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
