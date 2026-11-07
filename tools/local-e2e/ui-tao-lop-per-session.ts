// HOCPHI-THEO-BUOI (TUT-001, mục 5.1 + 3.6) — TRÌNH DUYỆT thật: lớp MỚI mặc định "Theo buổi"; Theo giờ / Theo khoá nằm trong mục gập "Cách tính khác"; cách cũ không còn trong lựa chọn;
// lớp Miễn phí ẩn mục cách tính; hai đường cũ (quan-lop?tao=1, quan-lop/tao-moi) chuyển tới /lop-cua-toi/lop/tao; chữ ở trang buổi theo kiểu phí; 390px không tràn, nút >= 44px.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-tao-lop-per-session.ts
import { BASE, mkTutor, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";

/** Phần tử bấm cao < 44px (loại thanh bên, cổng Next, toast, nút 'Mở rộng thanh bên'). */
const SMALL = `[...document.querySelectorAll('main a, main button, main select, main input, main summary, [role=tab]')].filter(e => {
  const r = e.getBoundingClientRect();
  return e.offsetParent && r.height < 43.5 && e.type !== 'checkbox' && e.type !== 'radio' && !e.closest('nav') && !e.closest('label') && !e.closest('nextjs-portal') && !e.closest('[data-kin-toast]') && e.getAttribute('aria-label') !== 'Mở rộng thanh bên';
}).map(e => (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height))`;

// TUT-lich-keo-tha: bước Lịch học nay BẮT BUỘC. Bài này kiểm học phí, không kiểm lịch → đi bằng lối thoát duy nhất "Lớp này học buổi lẻ" (qua KinConfirm), rồi Tiếp tục.
async function skipSchedule(p: import("./ui").Page) {
  await p.locator("[data-one-off]").click();
  await p.getByRole("button", { name: "Vẫn tạo không lịch" }).click();
  await p.getByRole("button", { name: "Tiếp tục" }).click();
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };
  const stepOf = (p: any) => p.locator("[data-wizard-step][aria-current=step]").getAttribute("data-wizard-step");

  section("1280px: mặc định Theo buổi");
  const p = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(p);
  await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  check("'Theo buổi' đã chọn sẵn, có nhãn mặc định", await p.getByLabel(/^Theo buổi/).isChecked() && await p.getByText("· mặc định").first().isVisible());
  check("có ô 'Đơn giá (đ / buổi)' ngay dưới", await p.getByLabel(/^Đơn giá \(đ \/ buổi\)/).isVisible());
  check("KHÔNG còn cách cũ 'Theo số buổi trong tháng' trong lựa chọn", (await p.getByText(/Theo số buổi trong tháng/).count()) === 0);
  check("'Theo giờ' / 'Theo khoá' nằm trong mục gập, đang gập", (await p.locator("[data-fee-other]").getAttribute("open")) === null && !(await p.getByLabel(/^Theo giờ/).isVisible()) && !(await p.getByLabel(/^Theo khoá/).isVisible()));
  await p.getByLabel(/Tên lớp/).fill("Toán 9 theo buổi");
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("không nhập đơn giá → ở lại bước 1, báo lỗi đơn giá", await stepOf(p) === "1" && await p.locator("p[role=alert]").first().isVisible());
  await p.getByLabel(/^Đơn giá/).fill("150000");
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await skipSchedule(p);
  check("sang bước 3 'Cách vào lớp'", await stepOf(p) === "3");
  await p.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await p.waitForURL(/\/lop-cua-toi\/toan-9-theo-buoi/, { timeout: 90000 });
  const made = await prisma.course.findFirstOrThrow({ where: { ownerId: T.id, name: "Toán 9 theo buổi" } });
  const rate = await prisma.courseFeeRate.findFirst({ where: { courseId: made.id } });
  check("DB: feeMode per_session + đúng một CourseFeeRate 150.000", made.feeMode === "per_session" && rate?.rate === 150000 && rate?.mode === "per_session", { m: made.feeMode, r: rate });

  section("Cách tính khác mở được; lớp Miễn phí ẩn mục cách tính");
  await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  await p.locator("[data-fee-other] summary").click();
  check("mở mục gập → thấy Theo giờ và Theo khoá", await p.getByLabel(/^Theo giờ/).isVisible() && await p.getByLabel(/^Theo khoá/).isVisible());
  await p.getByLabel(/^Theo khoá/).check();
  check("chọn Theo khoá → ô đơn giá đổi sang 'đ / khoá'", await p.getByLabel(/^Đơn giá \(đ \/ khoá\)/).isVisible());
  await p.getByRole("radio", { name: /^Miễn phí/ }).check();
  check("Miễn phí: ẩn cả mục cách tính, ô đơn giá; hiện câu 'Lớp miễn phí không có học phí'",
    await p.locator("[data-fee-free-note]").isVisible() && (await p.getByRole("heading", { name: "Cách tính học phí" }).count()) === 0 && (await p.getByLabel(/^Đơn giá/).count()) === 0);
  await p.getByLabel(/Tên lớp/).fill("Lớp miễn phí UI");
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await skipSchedule(p);
  check("Miễn phí đi thẳng qua bước 1 không cần đơn giá", await stepOf(p) === "3");
  await p.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await p.waitForURL(/\/lop-cua-toi\/lop-mien-phi-ui/, { timeout: 90000 });
  const free = await prisma.course.findFirstOrThrow({ where: { ownerId: T.id, name: "Lớp miễn phí UI" } });
  check("DB: lớp miễn phí không có CourseFeeRate và không có FeeCharge", (await prisma.courseFeeRate.count({ where: { courseId: free.id } })) === 0 && (await prisma.feeCharge.count({ where: { courseId: free.id } })) === 0, free.feeMode);

  section("Một cửa tạo lớp: hai đường cũ chuyển hướng");
  for (const from of ["/lop-cua-toi/quan-lop?tao=1", "/lop-cua-toi/quan-lop/tao-moi"]) {
    const q = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(q);
    await q.goto(`${BASE}${from}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await q.waitForURL(/\/lop-cua-toi\/lop\/tao$/, { timeout: 90000 });
    check(`${from} → /lop-cua-toi/lop/tao`, await q.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 }).then(() => true).catch(() => false));
    await q.close();
  }
  const ql = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(ql);
  await ql.goto(`${BASE}/lop-cua-toi/quan-lop`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await ql.waitForURL(/\/lop-cua-toi\/lop$/, { timeout: 90000 });
  check("A4b: /lop-cua-toi/quan-lop (không ?tao=1) chuyển về danh sách Lớp /lop-cua-toi/lop; quan-lop/[id] vẫn giữ", new URL(ql.url()).pathname === "/lop-cua-toi/lop");

  section("Chữ ở trang buổi theo kiểu phí");
  const today = vnDateKeyOf(new Date());
  const old = await mkCourse(T.id, { name: "Lớp cũ UI" }); // mkCourse: cột feeMode mặc định = monthly_sessions (lớp cũ)
  for (const c of [made, old]) await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: dayOfWeekOfKey(today), startTime: "00:05", endTime: "00:35" } });
  const b = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(b);
  await b.goto(`${BASE}/lop-cua-toi/buoi/${made.id}/${today}`, { waitUntil: "networkidle", timeout: 120000 });
  await b.getByRole("button", { name: "Đã dạy xong" }).waitFor({ timeout: 90000 });
  check("lớp theo buổi: câu nói học phí được tính lúc bấm Đã dạy xong", await b.getByText(/học phí của buổi được tính cho em có mặt hoặc đi muộn/).isVisible() && (await b.getByText("Việc này không tạo hay sửa học phí").count()) === 0);
  await b.goto(`${BASE}/lop-cua-toi/buoi/${old.id}/${today}`, { waitUntil: "networkidle", timeout: 120000 });
  await b.getByRole("button", { name: "Đã dạy xong" }).waitFor({ timeout: 90000 });
  check("lớp cũ: giữ câu cũ 'Việc này không tạo hay sửa học phí'", await b.getByText("Việc này không tạo hay sửa học phí").isVisible());

  section("Điện thoại 390px");
  const m = await (await ctxFor(T, { width: 390, height: 844 })).newPage(); watch(m);
  await m.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await m.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  await m.locator("[data-fee-other] summary").click();
  const small = await m.evaluate(SMALL) as string[];
  check("390px: không tràn ngang, nút / ô / tóm tắt >= 44px", (await m.evaluate("document.documentElement.scrollWidth")) as number <= 390 && small.length === 0, small);
  check("390px: thẻ chọn Theo buổi và ô đơn giá cao >= 44px", (await m.getByLabel(/^Theo buổi/).evaluate((e: HTMLElement) => e.closest("label")!.getBoundingClientRect().height)) >= 43.5 && (await m.getByLabel(/^Đơn giá/).evaluate((e: HTMLElement) => e.parentElement!.getBoundingClientRect().height)) >= 43.5 /* ô bọc ngoài KinInput mới là vùng chạm; thẻ <input> bên trong cao 42 */);
  await shot(m, "tao-lop-per-session-mobile");
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  void eventually;
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
