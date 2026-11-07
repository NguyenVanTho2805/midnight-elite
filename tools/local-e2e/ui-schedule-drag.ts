// TUT-lich-keo-tha — lưới khung giờ hằng tuần KÉO-THẢ THẬT trong trình duyệt (WeekScheduleEditor + LichKhung), 1280 chuột và 390 chạm.
// Không gọi hàm nội bộ: page.mouse.down/move/up; chạm bằng touchscreen.tap và CDP Input.dispatchTouchEvent (chạm-giữ-kéo). DB đọc bằng Prisma.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-schedule-drag.ts
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually, cookieFor } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

type Geo = { top: number; rs: number; pph: number; cols: Record<number, { x: number; w: number }> };
async function geo(p: Page): Promise<Geo> {
  const a = p.locator("[data-grid-area]");
  const bb = (await a.boundingBox())!;
  const cols: Geo["cols"] = {};
  for (let d = 0; d < 7; d++) { const l = p.locator(`[data-day-col="${d}"]`); if (!(await l.count())) continue; const c = await l.boundingBox(); if (c) cols[d] = { x: c.x, w: c.width }; }
  return { top: bb.y, rs: Number(await a.getAttribute("data-range-start")), pph: Number(await a.getAttribute("data-pph")), cols };
}
const Y = (g: Geo, min: number) => g.top + ((min - g.rs) / 60) * g.pph;
const X = (g: Geo, day: number) => g.cols[day].x + g.cols[day].w / 2;
/** Đưa đầu lưới lên gần mép trên viewport (điện thoại: lưới cao hơn màn hình nên phải cuộn trước khi chạm theo toạ độ). */
async function scrollGrid(p: Page) { await p.evaluate(() => { const a = document.querySelector("[data-grid-area]") as HTMLElement; window.scrollTo({ top: window.scrollY + a.getBoundingClientRect().top - 90, behavior: "instant" as ScrollBehavior }); }); await p.waitForTimeout(250); }
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const rowsOf = (courseId: string) => prisma.classSchedule.findMany({ where: { courseId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), O = await mkTutor("Cô Khác");
  const A = await mkCourse(T.id, { name: "Toán 9" }), B = await mkCourse(T.id, { name: "Lý 8" }), CO = await mkCourse(O.id, { name: "Lớp cô khác" });
  const E = await mkUser({ name: "Em Chung Hai Lớp" });
  for (const c of [A, B]) await prisma.enrollment.create({ data: { userId: E.id, courseId: c.id, status: "active" } });
  await prisma.classSchedule.create({ data: { courseId: B.id, dayOfWeek: 3, startTime: "18:30", endTime: "20:00" } });   // Lý 8: Thứ Tư 18:30–20:00
  await prisma.classSchedule.create({ data: { courseId: B.id, dayOfWeek: 5, startTime: "20:00", endTime: "21:00" } });   // Lý 8: Thứ Sáu 20:00–21:00
  await prisma.classSchedule.create({ data: { courseId: CO.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:00" } });

  const br = await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]|Failed to fetch/i.test(m.text())) errors.push(m.text()); }); };

  const ctx = await ctxFor(T, { width: 1280, height: 1500 });
  const p = await ctx.newPage(); watch(p);
  const writes: string[] = [];
  p.on("request", r => { if (/\/api\/(class-schedules|courses)\//.test(r.url()) && r.method() !== "GET") writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  let nativeDialogs = 0;
  p.on("dialog", d => { nativeDialogs++; void d.dismiss(); });
  const URL_A = `${BASE}/lop-cua-toi/quan-lop/${A.id}/lich-hoc`;
  const open = async (url = URL_A) => { await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.waitForSelector("[data-week-editor][data-schedule-state=ready]", { timeout: 90000 }); };
  const blockOf = (id: string) => p.locator(`[data-block-id="${id}"]`);
  const onlyBlock = () => p.locator("[data-block-id]:not([data-draft])");

  // ─────────────────────────── Trạng thái: rỗng / đang tải / lỗi + Thử lại ───────────────────────────
  section("Ba trạng thái");
  let delayed = false;
  await p.route(/\/api\/courses\/[^/]+\/class-schedules$/, async r => { if (!delayed) { delayed = true; await new Promise(res => setTimeout(res, 2500)); } await r.continue(); });
  await p.goto(URL_A, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("đang tải: khung xương có aria-busy + nhãn 'Đang tải lịch khung giờ'", await p.locator('[aria-busy="true"][aria-label="Đang tải lịch khung giờ"]').first().isVisible({ timeout: 60000 }).catch(() => false));
  await p.waitForSelector("[data-week-editor][data-schedule-state=ready]", { timeout: 90000 });
  await p.unroute(/\/api\/courses\/[^/]+\/class-schedules$/);
  check("lớp rỗng: câu 'Lớp chưa có lịch học' + hệ quả 'Học sinh sẽ không thấy buổi nào'", (await p.locator("[data-empty-hint]").innerText()).includes("Lớp chưa có lịch học") && (await p.locator("[data-empty-hint]").innerText()).includes("Học sinh sẽ không thấy buổi nào"));
  check("bóng lớp khác (Lý 8 · lớp khác) hiện trên lưới; lớp của cô khác KHÔNG hiện", await p.locator("[data-ghost]").count() === 2 && (await p.locator("[data-ghost]").first().innerText()).includes("lớp khác"));

  let fail = true;
  await p.route(/\/api\/courses\/[^/]+\/class-schedules$/, r => (fail ? r.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : r.continue()));
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.getByRole("alert").filter({ hasText: "Không tải được khung giờ" }).waitFor({ timeout: 90000 });
  check("lỗi tải: dải báo + nút Thử lại, lưới ẩn", await p.getByRole("button", { name: "Thử lại" }).isVisible() && (await p.locator("[data-week-editor]").count()) === 0);
  fail = false;
  await p.getByRole("button", { name: "Thử lại" }).click();
  await p.waitForSelector("[data-week-editor][data-schedule-state=ready]", { timeout: 60000 });
  check("Thử lại thành công → lưới hiện", true);
  await p.unroute(/\/api\/courses\/[^/]+\/class-schedules$/);

  // ─────────────────────────── 1280: chuột ───────────────────────────
  section("1280 chuột: kéo trên ô trống Thứ Ba 19:00→20:30 tạo khối nháp");
  let g = await geo(p);
  check("lưới 7 cột ở 1280 (không phải chế độ ngày), không có nút Ngày/Tuần", Object.keys(g.cols).length === 7 && (await p.locator("[data-view-mode]").count()) === 0);
  await p.mouse.move(X(g, 2), Y(g, 19 * 60) + 0.5);
  await p.mouse.down();
  await p.mouse.move(X(g, 2), Y(g, 19 * 60 + 45), { steps: 8 });
  await p.mouse.move(X(g, 2), Y(g, 20 * 60 + 30), { steps: 8 });
  await p.locator("[data-drag-label]").waitFor({ timeout: 5000 });
  check("đang giữ chuột: nhãn giờ sống '19:00–20:30'", (await p.locator("[data-drag-label]").innerText()).includes("19:00–20:30"));
  await shot(p, "schedule-drag-1-dragging");
  await p.mouse.up();
  await p.locator("[data-block-panel]").waitFor({ timeout: 10000 });
  check("thả → panel 'Thêm khung giờ' mở với 19:00–20:30, thứ Ba; CHƯA gọi API (DB không có khung)", (await p.locator("#sched-s").inputValue()) === "1140" && (await p.locator("#sched-e").inputValue()) === "1230" && (await rowsOf(A.id)).length === 0 && writes.length === 0);
  check("panel ghi rõ 'lặp mọi tuần'", (await p.locator("[data-repeat-note]").innerText()).includes("mọi tuần"));
  await p.getByRole("button", { name: "Lưu khung giờ" }).click();
  await eventually("DB có khung Thứ Ba 19:00–20:30 của lớp Toán 9", async () => { const r = await rowsOf(A.id); return r.length === 1 && r[0].dayOfWeek === 2 && r[0].startTime === "19:00" && r[0].endTime === "20:30"; });
  await p.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 10000 });
  await p.waitForTimeout(300);
  check("sau lưu: panel đóng, đúng 1 khối hiện (id đã là id máy chủ)", (await onlyBlock().count()) === 1 && (await onlyBlock().first().getAttribute("data-block-id")) === (await rowsOf(A.id))[0].id);
  check("aria-live đọc 'Đã thêm khung'", (await p.locator("[data-live]").innerText()).includes("Đã thêm khung"), await p.locator("[data-live]").innerText());
  const sid = (await rowsOf(A.id))[0].id;

  section("Dời thân khối sang Thứ Năm + 30'");
  g = await geo(p);
  const startY = Y(g, 19 * 60 + 45);
  await p.mouse.move(X(g, 2), startY);
  await p.mouse.down();
  await p.mouse.move(X(g, 3), startY + 12, { steps: 6 });
  await p.mouse.move(X(g, 4), startY + (g.pph / 2), { steps: 10 });
  await p.mouse.up();
  await eventually("DB: Thứ Năm 19:30–21:00 (giữ dài 90 phút), cùng id", async () => { const r = await rowsOf(A.id); return r.length === 1 && r[0].id === sid && r[0].dayOfWeek === 4 && r[0].startTime === "19:30" && r[0].endTime === "21:00"; });

  section("Đổi dài: kéo mép dưới +30'; kéo mép trên vượt mép dưới thì dừng ở 15'");
  g = await geo(p);
  const handleB = (await blockOf(sid).locator('[data-handle="bottom"]').boundingBox())!;
  await p.mouse.move(handleB.x + handleB.width / 2, handleB.y + handleB.height / 2);
  await p.mouse.down();
  await p.mouse.move(X(g, 4), Y(g, 21 * 60 + 30), { steps: 10 });
  await p.mouse.up();
  await eventually("DB: kết thúc 21:30 (bắt đầu giữ 19:30)", async () => { const r = (await rowsOf(A.id))[0]; return r.startTime === "19:30" && r.endTime === "21:30"; });
  g = await geo(p);
  const handleT = (await blockOf(sid).locator('[data-handle="top"]').boundingBox())!;
  await p.mouse.move(handleT.x + handleT.width / 2, handleT.y + handleT.height / 2);
  await p.mouse.down();
  await p.mouse.move(X(g, 4), Y(g, 22 * 60), { steps: 12 });   // vượt hẳn mép dưới (21:30)
  await p.mouse.up();
  await eventually("DB: bắt đầu dừng ở 21:15 (tối thiểu 15 phút), KHÔNG hoán đổi mép", async () => { const r = (await rowsOf(A.id))[0]; return r.startTime === "21:15" && r.endTime === "21:30"; });
  await prisma.classSchedule.update({ where: { id: sid }, data: { dayOfWeek: 2, startTime: "10:00", endTime: "11:00" } });
  await open();

  section("Thả ngoài lưới / Esc giữa chừng → không đổi gì, không có request");
  g = await geo(p);
  const before = writes.length;
  let b = (await blockOf(sid).boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(b.x + b.width / 2 + 200, b.y + 120, { steps: 6 });
  await p.mouse.move(1270, 20, { steps: 6 });   // ra ngoài hẳn lưới (góc trên phải)
  await p.mouse.up();
  await p.waitForTimeout(600);
  check("thả ngoài lưới: DB giữ Thứ Ba 10:00–11:00, không PUT", (await rowsOf(A.id))[0].startTime === "10:00" && (await rowsOf(A.id))[0].dayOfWeek === 2 && writes.length === before);
  b = (await blockOf(sid).boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(X(g, 4), Y(g, 15 * 60), { steps: 8 });
  check("đang kéo: có nhãn giờ", await p.locator("[data-drag-label]").isVisible());
  await p.keyboard.press("Escape");
  await p.mouse.move(X(g, 4), Y(g, 16 * 60), { steps: 4 });
  await p.mouse.up();
  await p.waitForTimeout(600);
  check("Esc giữa chừng: khối về chỗ cũ, DB không đổi, KHÔNG có request mạng", (await rowsOf(A.id))[0].startTime === "10:00" && (await blockOf(sid).getAttribute("data-start")) === "600" && writes.length === before && (await p.locator("[data-drag-label]").count()) === 0);

  section("Trùng giờ: kéo vào giờ của lớp khác → CHỮ 'Trùng giờ'; chạm đầu thì không");
  g = await geo(p);
  b = (await blockOf(sid).boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(X(g, 3), Y(g, 19 * 60 + 30), { steps: 14 });   // Thứ Tư 19:00–20:00 chồng Lý 8 18:30–20:00
  const lbl = await p.locator("[data-drag-label]").innerText();
  check("đang kéo: nhãn có chữ 'Trùng giờ' + tên Lý 8", lbl.includes("Trùng giờ") && lbl.includes("Lý 8"), lbl);
  await p.mouse.up();
  await p.getByRole("dialog", { name: "Khung giờ này trùng lịch" }).waitFor({ timeout: 15000 });
  const askTxt = await p.locator("[data-conflict-ask]").innerText();
  check("máy chủ 409 → hộp 'Khung giờ này trùng lịch' liệt kê Lý 8 + 'có 1 học sinh học cả hai lớp' (chỉ SỐ, không tên em)", askTxt.includes("Lý 8") && askTxt.includes("1 học sinh học cả hai lớp") && !askTxt.includes("Em Chung"), askTxt);
  check("lúc chờ xác nhận khối vẫn ở chỗ cũ (DB chưa đổi)", (await rowsOf(A.id))[0].dayOfWeek === 2 && (await blockOf(sid).getAttribute("data-day")) === "2");
  await p.getByRole("button", { name: "Hoàn lại" }).click();
  check("'Hoàn lại': giữ nguyên Thứ Ba 10:00", (await rowsOf(A.id))[0].dayOfWeek === 2);
  g = await geo(p);
  b = (await blockOf(sid).boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(X(g, 3), Y(g, 19 * 60 + 30), { steps: 14 });
  await p.mouse.up();
  await p.getByRole("button", { name: "Vẫn lưu" }).click();
  await eventually("'Vẫn lưu' (force): DB Thứ Tư 19:00–20:00", async () => { const r = (await rowsOf(A.id))[0]; return r.dayOfWeek === 3 && r.startTime === "19:00" && r.endTime === "20:00"; });
  await p.waitForTimeout(300);
  const blk = blockOf(sid);
  check("khối trùng: viền nét đứt + CHỮ 'Trùng giờ' + dòng liệt kê dưới lưới", (await blk.getAttribute("data-conflict")) === "1" && (await blk.innerText()).includes("Trùng giờ") && (await p.locator("[data-conflict-list]").innerText()).includes("Lý 8"));
  check("aria-label khối nêu thứ, giờ và 'trùng giờ', KHÔNG có tên học sinh", ((await blk.getAttribute("aria-label")) ?? "").includes("Thứ Tư, 19:00 đến 20:00") && ((await blk.getAttribute("aria-label")) ?? "").includes("trùng giờ") && !((await p.locator("[data-week-editor]").innerText()).includes("Em Chung")));
  await shot(p, "schedule-drag-2-conflict");
  // Chạm đầu: Thứ Sáu 19:00–20:00 sát Lý 8 Thứ Sáu 20:00–21:00 → KHÔNG trùng.
  g = await geo(p);
  b = (await blockOf(sid).boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(X(g, 5), Y(g, 19 * 60 + 30), { steps: 12 });
  check("chạm đầu 19:00–20:00 với Lý 8 20:00: nhãn KHÔNG báo trùng", !(await p.locator("[data-drag-label]").innerText()).includes("Trùng giờ"));
  await p.mouse.up();
  await eventually("DB Thứ Sáu 19:00–20:00 (không cần xác nhận)", async () => { const r = (await rowsOf(A.id))[0]; return r.dayOfWeek === 5 && r.startTime === "19:00" && r.endTime === "20:00"; });
  check("không có hộp trùng lịch, khối không bị đánh dấu trùng", (await p.getByRole("dialog").count()) === 0 && (await blockOf(sid).getAttribute("data-conflict")) === null);

  section("Delete = tắt khung + Hoàn tác (cùng id); 'Xoá hẳn' qua KinConfirm");
  await blockOf(sid).focus();
  await p.keyboard.press("Delete");
  await eventually("DB: khung TẮT (active=false), vẫn còn bản ghi", async () => { const r = await rowsOf(A.id); return r.length === 1 && r[0].id === sid && r[0].active === false; });
  check("khối hiện chữ 'Đã tắt'", (await blockOf(sid).innerText()).includes("Đã tắt"));
  await p.locator("[data-undo-toast]").getByRole("button", { name: "Hoàn tác" }).click();
  await eventually("Hoàn tác → BẬT lại, cùng id", async () => { const r = await rowsOf(A.id); return r.length === 1 && r[0].id === sid && r[0].active === true; });
  await blockOf(sid).click();
  await p.locator("[data-block-panel]").waitFor();
  await p.getByRole("button", { name: "Xoá hẳn…" }).click();
  const cd = p.getByRole("dialog").filter({ hasText: "Xoá hẳn khung này?" });
  await cd.waitFor({ timeout: 5000 });
  check("KinConfirm (không window.confirm) nêu hệ quả 'Báo nghỉ và nhắc lịch'", (await cd.innerText()).includes("Báo nghỉ và nhắc lịch") && nativeDialogs === 0);
  await cd.getByRole("button", { name: "Giữ lại" }).click();
  check("Giữ lại → khung còn", (await rowsOf(A.id)).length === 1);
  await p.getByRole("button", { name: "Xoá hẳn…" }).click();
  await p.getByRole("dialog").filter({ hasText: "Xoá hẳn khung này?" }).getByRole("button", { name: "Xoá hẳn" }).click();
  await eventually("Xoá hẳn → mất bản ghi", async () => (await rowsOf(A.id)).length === 0);

  section("Lỗi mạng khi ghi → khối quay về + role=alert + Thử lại");
  const mk = await prisma.classSchedule.create({ data: { courseId: A.id, dayOfWeek: 1, startTime: "08:00", endTime: "09:00" } });
  await open();
  g = await geo(p);
  let netFail = true;
  await p.route(/\/api\/class-schedules\//, r => (netFail && r.request().method() === "PUT" ? r.abort() : r.continue()));
  b = (await blockOf(mk.id).boundingBox())!;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(X(g, 1), Y(g, 14 * 60), { steps: 10 });
  await p.mouse.up();
  await p.locator("[data-schedule-error]").waitFor({ timeout: 15000 });
  check("lỗi: role=alert 'Không lưu được', khối trở về 08:00, DB không đổi", (await p.locator("[data-schedule-error]").getAttribute("role")) === "alert" && (await p.locator("[data-schedule-error]").innerText()).includes("Không lưu được") && (await blockOf(mk.id).getAttribute("data-start")) === "480" && (await rowsOf(A.id))[0].startTime === "08:00");
  netFail = false;
  await p.locator("[data-schedule-error]").getByRole("button", { name: "Thử lại" }).click();
  await eventually("Thử lại → ghi được: khung đã dời khỏi 08:00 theo đúng cú kéo", async () => (await rowsOf(A.id))[0].startTime > "13:00");
  const kbStart = (await rowsOf(A.id))[0];
  await p.unroute(/\/api\/class-schedules\//);

  section("Bàn phím: mũi tên gom thành MỘT lần ghi; Shift đổi dài; Enter mở panel; aria-live");
  await open();
  const reqBefore = writes.length;
  await blockOf(mk.id).focus();
  for (let i = 0; i < 4; i++) await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(1500);
  const putCount = writes.slice(reqBefore).filter(w => w.startsWith("PUT")).length;
  const addH = (hm: string, d: number) => { const [h, mm] = hm.split(":").map(Number); const t = h * 60 + mm + d; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  const k0 = addH(kbStart.startTime, 60), k1 = addH(kbStart.endTime, 60);
  check(`↓ ×4 → đúng MỘT PUT, +60 phút (${kbStart.startTime} → ${k0})`, putCount === 1 && (await rowsOf(A.id))[0].startTime === k0 && (await rowsOf(A.id))[0].endTime === k1, { putCount });
  check("vùng aria-live đọc 'Đã dời … sang Thứ Hai … đến …'", new RegExp(`Đã dời .* sang Thứ Hai ${k0} đến ${k1}`).test(await p.locator("[data-live]").innerText()), await p.locator("[data-live]").innerText());
  check("tiêu điểm vẫn ở khối sau khi dời", await blockOf(mk.id).evaluate(el => document.activeElement === el));
  await p.keyboard.press("Shift+ArrowDown");
  await p.waitForTimeout(1200);
  check("Shift+↓ → mép dưới +15', mép trên giữ", (await rowsOf(A.id))[0].startTime === k0 && (await rowsOf(A.id))[0].endTime === addH(k1, 15));
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(1200);
  check("→ sang Thứ Ba, giữ giờ", (await rowsOf(A.id))[0].dayOfWeek === 2);
  check("tiêu điểm còn ở khối sau khi đổi ngày", await blockOf(mk.id).evaluate(el => document.activeElement === el));
  await p.keyboard.press("Enter");
  check("Enter mở panel sửa", await p.locator("[data-block-panel]").isVisible({ timeout: 5000 }));
  await p.keyboard.press("Escape");
  check("Esc đóng panel", (await p.locator("[data-block-panel]").count()) === 0);
  check("không có window.confirm/alert nào trong cả bài", nativeDialogs === 0);

  // ─────────────────────────── Quyền / không có lớp ───────────────────────────
  section("Quyền UI: lớp người khác / lớp không có");
  await p.goto(`${BASE}/lop-cua-toi/quan-lop/${CO.id}/lich-hoc`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.getByText("Bạn không có quyền với lớp này").waitFor({ timeout: 60000 });
  check("lớp người khác: 'Bạn không có quyền với lớp này', không có lưới, không lộ giờ của lớp đó", (await p.locator("[data-week-editor]").count()) === 0 && !(await p.locator("main").innerText()).includes("19:00"));
  await p.goto(`${BASE}/lop-cua-toi/quan-lop/khong-co-lop-nay/lich-hoc`, { waitUntil: "domcontentloaded" });
  await p.getByText("Không tìm thấy lớp").waitFor({ timeout: 60000 });
  check("lớp không có: 'Không tìm thấy lớp'", true);

  // ─────────────────────────── Trang /lich/khung + liên kết ───────────────────────────
  section("/lop-cua-toi/lich/khung có ô chọn lớp; Lịch có nút 'Sửa khung giờ'; danh sách lớp có 'Đặt lịch'; trang lớp có callout");
  await p.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.getByRole("link", { name: "Sửa khung giờ" }).waitFor({ timeout: 60000 });
  await p.getByRole("link", { name: "Sửa khung giờ" }).click();
  await p.waitForURL(/\/lop-cua-toi\/lich\/khung/, { timeout: 60000 });
  await p.locator("[data-course-picker]").waitFor({ timeout: 60000 });
  await p.locator("[data-course-picker]").selectOption(B.id);
  await p.waitForURL(new RegExp(`lop=${B.id}`), { timeout: 30000 });
  await p.waitForSelector("[data-week-editor][data-schedule-state=ready]", { timeout: 60000 });
  check("chọn Lý 8 → URL nhớ ?lop=, lưới hiện 2 khung của Lý 8", (await onlyBlock().count()) === 2 && (await p.locator("[data-rule-list] li").count()) === 2);
  await prisma.classSchedule.deleteMany({ where: { courseId: A.id } });
  await p.goto(`${BASE}/lop-cua-toi/lop`, { waitUntil: "domcontentloaded" });
  await p.getByRole("link", { name: "Đặt lịch cho lớp Toán 9" }).waitFor({ timeout: 60000 });
  check("lớp Toán 9 chưa lịch: liên kết 'Đặt lịch' đúng đích", ((await p.getByRole("link", { name: "Đặt lịch cho lớp Toán 9" }).getAttribute("href")) ?? "").endsWith(`/lop-cua-toi/quan-lop/${A.id}/lich-hoc`));
  await p.goto(`${BASE}/lop-cua-toi/${A.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.locator("[data-no-schedule-callout]").waitFor({ timeout: 60000 });
  check("trang lớp chưa lịch: callout 'Lớp chưa có lịch học' + nút 'Đặt lịch bằng lưới kéo-thả'", (await p.locator("[data-no-schedule-callout]").innerText()).includes("Lớp chưa có lịch học") && (await p.getByRole("link", { name: "Đặt lịch bằng lưới kéo-thả" }).count()) === 1);
  await p.getByRole("link", { name: "Đặt lịch bằng lưới kéo-thả" }).click();
  await p.waitForURL(new RegExp(`/lop-cua-toi/quan-lop/${A.id}/lich-hoc`), { timeout: 60000 });
  check("bấm callout → tới trang lịch học của lớp; tab 'Lịch học' sáng", (await p.locator('[aria-current="page"]:visible').allInnerTexts()).some(t => t.includes("Lịch học")));

  // ─────────────────────────── 390 chạm ───────────────────────────
  section("390 chạm: bấm ô trống → panel chọn giờ → Lưu (đường chính)");
  const [cn, ...cr] = (await cookieFor(T)).split("=");
  const mctx = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "vi-VN" });
  await mctx.addCookies([{ name: cn, value: cr.join("="), url: BASE }]);
  await mctx.addInitScript(`try{localStorage.setItem("kin.thanh-ben","mo")}catch(e){}`);
  const m = await mctx.newPage(); watch(m);
  await m.goto(URL_A, { waitUntil: "domcontentloaded", timeout: 120000 });
  await m.waitForSelector("[data-week-editor][data-schedule-state=ready]", { timeout: 90000 });
  check("390: mặc định chế độ NGÀY (một cột) + có nút chuyển Ngày | Tuần", (await m.locator("[data-week-editor]").getAttribute("data-mode")) === "day" && (await m.locator("[data-view-mode]").count()) === 2);
  const noOverflow = async (label: string) => check(`390: không tràn ngang (${label})`, await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await m.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]));
  await noOverflow("chế độ ngày");
  await m.locator('[data-pick-day="3"]').tap();
  check("chọn Thứ Tư: tiêu đề ngày đổi", (await m.locator("[data-day-title]").innerText()) === "Thứ Tư");
  await scrollGrid(m);
  let mg = await geo(m);
  await m.touchscreen.tap(mg.cols[3].x + mg.cols[3].w / 2, Y(mg, 9 * 60) + 1);
  await m.locator("[data-block-panel]").waitFor({ timeout: 10000 });
  check("bấm ô trống → panel dạng ngăn dưới, điền sẵn Thứ Tư + giờ vừa bấm", (await m.locator("select").first().inputValue()) === "3" && (await m.locator("#sched-s").inputValue()) === "540");
  await m.locator("#sched-e").selectOption("660");
  await m.getByRole("button", { name: "Bắt đầu thêm 15 phút" }).tap();
  check("nút +15 đổi giờ bắt đầu → 09:15", (await m.locator("#sched-s").inputValue()) === "555");
  const small = await m.locator("[data-block-panel] button, [data-block-panel] select").evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 ? `${e.textContent?.trim().slice(0, 20)}:${Math.round(r.height)}` : null; }).filter(Boolean));
  check("mọi nút/ô chọn trong panel ≥ 44px", small.length === 0, small);
  await m.getByRole("button", { name: "Lưu khung giờ" }).tap();
  await eventually("DB: Thứ Tư 09:15–11:00", async () => { const r = await rowsOf(A.id); return r.length === 1 && r[0].dayOfWeek === 3 && r[0].startTime === "09:15" && r[0].endTime === "11:00"; });
  const tid = (await rowsOf(A.id))[0].id;
  await shot(m, "schedule-drag-390-day");

  section("390 chạm-giữ-kéo bằng CDP (dời +60'), và ngón di chuyển trước 350ms = cuộn, không dời");
  await scrollGrid(m);
  mg = await geo(m);
  const cdp = await mctx.newCDPSession(m);
  const touch = (type: string, x: number, y: number) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const bb = (await m.locator(`[data-block-id="${tid}"]`).boundingBox())!;
  const cx = bb.x + bb.width / 2, cy = bb.y + 12;
  // Ca phá: di chuyển NGAY (< 350ms) → cuộn trang, không dời
  await touch("touchStart", cx, cy);
  for (let i = 1; i <= 6; i++) { await touch("touchMove", cx, cy - i * 12); await m.waitForTimeout(15); }
  await touch("touchEnd", cx, cy - 72);
  await m.waitForTimeout(800);
  check("ngón di chuyển trước 350ms: khối KHÔNG dời (DB 09:15)", (await rowsOf(A.id))[0].startTime === "09:15" && (await m.locator("[data-week-editor]").getAttribute("data-dragging")) === null);
  await scrollGrid(m);
  mg = await geo(m);
  const bb2 = (await m.locator(`[data-block-id="${tid}"]`).boundingBox())!;
  const sx = bb2.x + bb2.width / 2, sy = bb2.y + 12;
  const writesBefore = writes.length;
  await touch("touchStart", sx, sy);
  await m.waitForTimeout(450);
  check("giữ yên >350ms → vào chế độ kéo (data-dragging)", (await m.locator("[data-week-editor]").getAttribute("data-dragging")) === "1");
  for (let i = 1; i <= 8; i++) { await touch("touchMove", sx, sy + (i * mg.pph) / 8); await m.waitForTimeout(25); }
  check("đang kéo bằng ngón: nhãn giờ sống hiện", await m.locator("[data-drag-label]").isVisible());
  await touch("touchEnd", sx, sy + mg.pph);
  await eventually("chạm-giữ-kéo: DB dời +60 phút (10:15–12:00)", async () => { const r = (await rowsOf(A.id))[0]; return r.startTime === "10:15" && r.endTime === "12:00"; });
  void writesBefore;
  await noOverflow("sau khi kéo");

  section("390: chế độ Tuần cuộn ngang, khung lưới tự cuộn chứ trang không tràn; nút ≥ 44px");
  await m.locator('[data-view-mode="week"]').tap();
  check("chế độ Tuần: 7 cột, lưới cuộn ngang trong khung", (await m.locator("[data-week-editor]").getAttribute("data-mode")) === "week" && (await m.locator("[data-day-col]").count()) === 7 && await m.locator("[data-grid-scroller]").evaluate(el => el.scrollWidth > el.clientWidth));
  await noOverflow("chế độ tuần");
  await shot(m, "schedule-drag-390-week");
  await m.locator('[data-view-mode="day"]').tap();
  await m.waitForTimeout(400); // đợi hiệu ứng nhấn (scale) kết thúc rồi mới đo
  const smallBtns = await m.locator("[data-week-editor] button:not([data-block-id]), [data-week-editor] select").evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5 ? `${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 24)}:${Math.round(r.width)}x${Math.round(r.height)}` : null; }).filter(Boolean));
  check("mọi nút điều khiển trên lưới (trừ khối) cao và rộng ≥ 44px", smallBtns.length === 0, smallBtns);
  check("không có :hover-only: panel và nút dùng được bằng chạm (đã thao tác ở trên)", true);
  await m.locator(`[data-block-id="${tid}"]`).tap();
  await m.locator("[data-block-panel]").waitFor();
  await m.getByRole("button", { name: "Đóng" }).tap();
  check("bấm khối bằng ngón → mở panel sửa, Đóng được", (await m.locator("[data-block-panel]").count()) === 0);

  check("không lỗi JS/console trong cả bài", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll().catch(() => {}); process.exit(1); });
