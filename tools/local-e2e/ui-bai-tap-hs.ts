// BU-04 mục 5.5/8: "Đề thi được giao" của học sinh, xếp theo hạn. 3 đề lớp (hạn còn 1 ngày / hết hạn hôm nay / đã quá hạn) qua hạn riêng của từng học sinh
// (QuizStudentDeadline) để nhãn không phụ thuộc giờ chạy bài. Kiểm: nhãn hạn, thứ tự, 390px không tràn, học sinh ngoài lớp không thấy đề của lớp,
// đề chỉ có đường dẫn không nằm trong danh sách nhưng mở được bằng URL, bấm "Vào làm" tới đúng phòng thi (waitForURL). Chụp 1280 và 390.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { mkExam, mkFiveQuestions } from "./exam-room-fx";

const MIN = 60_000;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" });
  const X = await mkUser({ name: "Em Ngoài Lớp" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });

  // Hạn "hết hạn hôm nay": 20 phút nữa, nhưng không vượt qua nửa đêm giờ VN (kẻo thành "Còn 1 ngày").
  const vn = new Date(Date.now() + 7 * 3_600_000);
  const endOfVnDay = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 1) - 7 * 3_600_000 - 1000;
  const dueToday = new Date(Math.min(Date.now() + 20 * MIN, endOfVnDay));
  const specs: [string, string, Date][] = [
    ["bt-sau", "Đề còn một ngày", new Date(Date.now() + 24 * 3_600_000 + 30 * MIN)],
    ["bt-nay", "Đề hết hạn hôm nay", dueToday],
    ["bt-qua", "Đề đã quá hạn", new Date(Date.now() - 60 * MIN)],
  ];
  for (const [id, title, dueAt] of specs) {
    await mkExam({ id, ownerId: T.id, courseId: C.id, mode: "practice", title });
    await mkFiveQuestions(id, id);
    await prisma.quizStudentDeadline.create({ data: { examId: id, userId: S.id, dueAt, setById: T.id } });
  }
  // Đề chỉ giao bằng đường dẫn: không thuộc lớp nào, em chưa từng làm → không nằm trong danh sách.
  await mkExam({ id: "bt-link", ownerId: T.id, courseId: null, mode: "practice", title: "Đề chỉ có đường dẫn" });
  await mkFiveQuestions("bt-link", "bt-link");

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const hide = async (p: any) => p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
  const openTab = async (p: any) => {
    // B1 (08/11/2026): "Đề thi được giao" nằm ở cột phải của Việc của tôi (trang Bài tập đã chuyển hướng).
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("list", { name: "Đề thi được giao" }).waitFor({ timeout: 60000 });
    await hide(p);
  };

  section("1280px: ba đề lớp, nhãn hạn và thứ tự theo hạn");
  const c1 = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await c1.newPage(); watch(pg);
  await openTab(pg);
  check("thanh bên có nhãn vai học sinh (.kin-rail-role)", /học sinh/i.test(((await pg.locator("#kin-rail .kin-rail-role").first().textContent().catch(() => "")) ?? "").trim()));
  const rows = pg.locator("[data-de-thi-hang]");
  check("danh sách có đúng 3 đề của lớp (đề chỉ có đường dẫn KHÔNG có mặt)", await rows.count() === 3 && await pg.getByText("Đề chỉ có đường dẫn").count() === 0, await rows.count());
  const hans = await rows.evaluateAll(els => els.map(e => ({ t: (e.querySelector("p span")?.textContent ?? "").trim(), han: (e.querySelector("[data-han]")?.textContent ?? "").trim(), st: e.getAttribute("data-trang-thai") })));
  check("thứ tự: hết hạn hôm nay → còn 1 ngày → đã quá hạn", hans.map(h => h.t).join("|") === "Đề hết hạn hôm nay|Đề còn một ngày|Đề đã quá hạn", hans);
  check("nhãn hạn: 'Hết hạn hôm nay hh:mm' / 'Còn 1 ngày' / 'Đã quá hạn'", /^Hết hạn hôm nay \d\d:\d\d$/.test(hans[0].han) && hans[1].han === "Còn 1 ngày" && hans[2].han === "Đã quá hạn", hans);
  check("đề còn hạn 'Đang mở', đề quá hạn 'Đã đóng' và không có nút vào làm", hans[0].st === "dang-mo" && hans[1].st === "dang-mo" && hans[2].st === "da-dong" && await rows.nth(2).getByRole("link").count() === 0);
  const btnH = await pg.getByRole("link", { name: "Vào làm" }).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("nút 'Vào làm' cao ≥ 44px", btnH.length === 2 && btnH.every(h => h >= 44), btnH);
  check("1280 không tràn ngang", await pg.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pg, "bai-tap-hs-1280");
  await pg.getByRole("link", { name: "Vào làm" }).first().click();
  await pg.waitForURL(/\/student\/thi-thu\/bt-nay$/, { timeout: 60000 });
  check("'Vào làm' đưa tới phòng thi đúng đề (đề gần hạn nhất)", pg.url().endsWith("/student/thi-thu/bt-nay"));
  await pg.getByRole("button", { name: /Bắt đầu/ }).waitFor({ timeout: 60000 });
  await c1.close();

  section("Học sinh ngoài lớp không thấy đề của lớp");
  const cx = await ctxFor(X, { width: 1280, height: 900 });
  const px = await cx.newPage(); watch(px);
  await px.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await px.getByText("Chưa có đề nào được giao").waitFor({ timeout: 60000 });
  const xt = await px.locator("body").innerText();
  check("không thấy tên đề nào của lớp Toán 9", !xt.includes("Đề còn một ngày") && !xt.includes("Đề hết hạn hôm nay") && !xt.includes("Đề đã quá hạn"));
  await cx.close();

  section("Đề chỉ có đường dẫn: mở được bằng URL");
  const cl = await ctxFor(S, { width: 1280, height: 900 });
  const pl = await cl.newPage(); watch(pl);
  await pl.goto(`${BASE}/student/thi-thu/bt-link`, { waitUntil: "networkidle", timeout: 120000 });
  await eventually("trang cổng mở ra (không phải 'Không tìm thấy đề thi'), có tên đề", async () => (await pl.locator("body").innerText()).includes("Đề chỉ có đường dẫn") && !(await pl.locator("body").innerText()).includes("Không tìm thấy đề thi"), 60000);
  await cl.close();

  section("390px: không tràn, nút ≥ 44px");
  const cm = await ctxFor(S, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await openTab(pm);
  check("390: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  const mH = await pm.getByRole("link", { name: "Vào làm" }).evaluateAll(els => els.map(e => ({ h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })));
  check("390: 'Vào làm' cao ≥ 44px và rộng cả hàng", mH.length === 2 && mH.every(b => b.h >= 44 && b.w >= 300), mH);
  const mHan = await pm.locator("[data-han]").allInnerTexts();
  check("390: vẫn đủ ba nhãn hạn", mHan.length === 3, mHan);
  await shot(pm, "bai-tap-hs-390");
  await cm.close();

  section("Nhiều hơn 3 đề: 'Xem thêm' còn lối xem phần còn lại");
  for (const [id, title, due] of [["bt-x1", "Đề thêm một", 3], ["bt-x2", "Đề thêm hai", 4]] as const) {
    await mkExam({ id, ownerId: T.id, courseId: C.id, mode: "practice", title });
    await mkFiveQuestions(id, id);
    await prisma.quizStudentDeadline.create({ data: { examId: id, userId: S.id, dueAt: new Date(Date.now() + due * 24 * 3_600_000), setById: T.id } });
  }
  const cs = await ctxFor(S, { width: 1280, height: 900 });
  const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await ps.getByRole("list", { name: "Đề thi được giao" }).waitFor({ timeout: 60000 });
  check("5 đề được giao: mặc định hiện 3", await ps.locator("[data-de-thi-hang]").count() === 3, await ps.locator("[data-de-thi-hang]").count());
  await ps.locator("[data-assign-more]").click();
  check("'Xem thêm 2 đề' → đủ 5 đề; 'Thu gọn' → về 3", await ps.locator("[data-de-thi-hang]").count() === 5 && (await ps.locator("[data-assign-more]").innerText()).trim() === "Thu gọn");
  await cs.close();
  // B1: trang cũ chuyển hướng (thông báo cũ trong cơ sở dữ liệu còn trỏ vào).
  const cr = await ctxFor(S, { width: 1280, height: 900 });
  const pr = await cr.newPage(); watch(pr);
  await pr.goto(`${BASE}/student/bai-tap`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pr.waitForURL(/\/student\/viec-cua-toi$/, { timeout: 60000 });
  check("B1: /student/bai-tap → /student/viec-cua-toi", new URL(pr.url()).pathname === "/student/viec-cua-toi");
  await cr.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
