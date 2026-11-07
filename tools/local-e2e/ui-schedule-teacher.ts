// TUT-dong-giang — ô "Người dạy" của khung giờ (WeekScheduleEditor + LichKhung), 1280 và 390, trình duyệt thật + DB đọc bằng Prisma.
//   S1  chủ lớp: nhãn "Dạy: …" trên lưới, ô chọn Người dạy (Chủ lớp + giáo viên đang dạy, không người đã gỡ), đổi sang đồng giảng → DB teacherId; về Chủ lớp → null; thêm khung mới có chọn người dạy.
//   S2  đồng giảng: KHÔNG có ô chọn, chỉ nhãn chỉ-đọc ("bạn" / "giáo viên khác" / "chủ lớp", không tên người khác); sửa được khung của mình, khung người khác chỉ xem + nút Tắt trong danh sách tắt; khung mới = của mình (DB).
//   S3  bộ môn: không nút Thêm khung, mọi khung chỉ xem, mọi nút Tắt trong danh sách tắt, không ô chọn.
//   S4  wizard Tạo lớp không truyền ô người dạy.
// Bẻ X thì ca Y đỏ: bỏ điều kiện `teacher?.mode === "select"` quanh ô <select> (BlockPanel) → S1 "ô chọn" + S2 "không ô chọn" đỏ; bỏ `canEdit` ở LichKhung → S2 "khung người khác chỉ xem" + S3 đỏ.
import { BASE, mkTutor, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "node:fs";

const GOTO = { waitUntil: "domcontentloaded" as const, timeout: 120000 };

(async () => {
  await wipe();
  const O = await mkTutor("Cô Chủ Lớp"), C = await mkTutor("Cô Đồng Giảng"), S = await mkTutor("Thầy Bộ Môn"), X = await mkTutor("Cô Đã Gỡ");
  const K = await mkCourse(O.id, { name: "Toán 9 thử" });
  const ct = (userId: string, role: string, status = "active") => prisma.courseTeacher.create({ data: { courseId: K.id, userId, role, status, subjects: [], invitedBy: O.id, respondedAt: new Date() } });
  await ct(C.id, "co_teacher"); await ct(S.id, "subject_teacher"); await ct(X.id, "co_teacher", "removed");
  const sch = (dayOfWeek: number, startTime: string, endTime: string, teacherId: string | null) => prisma.classSchedule.create({ data: { courseId: K.id, dayOfWeek, startTime, endTime, teacherId } });
  const bO = await sch(1, "18:00", "19:30", null);       // Thứ Hai: chủ lớp
  const bC = await sch(2, "18:00", "19:30", C.id);       // Thứ Ba: đồng giảng
  const bS = await sch(3, "18:00", "19:30", S.id);       // Thứ Tư: bộ môn
  const bX = await sch(4, "18:00", "19:30", X.id);       // Thứ Năm: giáo viên ĐÃ RỜI lớp (phá cố ý: ô chọn không được âm thầm đổi người dạy)
  const url = `/lop-cua-toi/quan-lop/${K.id}/lich-hoc`;

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|negative time stamp/i.test(m.text())) errors.push(`${p.url().replace(BASE, "")} :: ${m.text().slice(0, 160)}`); });
  };
  const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const small = (p: Page, root: string) => p.evaluate((sel) => [...document.querySelectorAll(`${sel} button:not([disabled]), ${sel} select:not([disabled])`)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(e => (e.textContent ?? "").trim().slice(0, 30)), root);
  const open = async (p: Page, id: string, day: number) => {
    const narrowView = (await p.locator("[data-week-editor]").getAttribute("data-mode")) === "day";
    if (narrowView) await p.locator(`[data-pick-day="${day}"]`).click();
    await p.locator(`[data-block-id="${id}"]`).click();
    await p.locator("[data-block-panel]").waitFor({ timeout: 30000 });
  };
  // dispatchEvent: chỉ báo Next dev (góc dưới) che nút ở 390px
  const closePanel = async (p: Page) => { await p.locator("[data-block-panel]").getByRole("button", { name: /^(Đóng|Bỏ)$/ }).dispatchEvent("click"); await p.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 15000 }); };
  const row = (id: string) => prisma.classSchedule.findUnique({ where: { id } });
  const ready = async (p: Page) => { await p.goto(`${BASE}${url}`, GOTO); await p.locator("[data-week-editor]").waitFor({ timeout: 120000 }); await p.locator("[data-rule-list] li").first().waitFor({ timeout: 60000 }); await p.waitForTimeout(800); };

  for (const [w, h] of [[1280, 900], [390, 844], [320, 700]] as const) {
    const tag = `${w}px`;
    // ───────── S1: chủ lớp ─────────
    section(`S1. Chủ lớp (${tag})`);
    const po = await (await ctxFor(O, { width: w, height: h })).newPage(); watch(po);
    await ready(po);
    await eventually(`${tag} lưới hiện nhãn người dạy "Dạy: chủ lớp" và tên đồng giảng`, async () => {
      if (w < 640) { await po.locator(`[data-pick-day="1"]`).click(); }
      const a = (await po.locator(`[data-block-id="${bO.id}"] [data-teacher-label]`).allInnerTexts()).join();
      if (w < 640) { await po.locator(`[data-pick-day="2"]`).click(); }
      const b = (await po.locator(`[data-block-id="${bC.id}"] [data-teacher-label]`).allInnerTexts()).join();
      return a.includes("chủ lớp") && b.includes("Cô Đồng Giảng");
    }, 30000);
    await shot(po, `schedule-teacher-owner-${w}`);
    // Khối của giáo viên đã rời lớp: nhãn + ô chọn thống nhất, Lưu không âm thầm đổi người dạy.
    if (w < 640) await po.locator(`[data-pick-day="4"]`).click();
    const lx = (await po.locator(`[data-block-id="${bX.id}"] [data-teacher-label]`).allInnerTexts()).join();
    check(`${tag} khối của người đã rời lớp: nhãn "Dạy: giáo viên đã rời lớp"`, lx.includes("giáo viên đã rời lớp"), lx);
    check(`${tag} nhãn "Dạy: …" không tràn khối/ngang`, await noOverflow(po) && await po.locator(`[data-block-id="${bX.id}"] [data-teacher-label]`).evaluate(e => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).textOverflow === "ellipsis"));
    await open(po, bX.id, 4);
    const selX = po.locator("[data-block-panel] [data-teacher-select]");
    const optsX = await selX.locator("option").allInnerTexts();
    check(`${tag} ô chọn có "Giáo viên đã rời lớp" và đang chọn nó (không rơi về Chủ lớp)`, optsX.includes("Giáo viên đã rời lớp") && (await selX.evaluate(e => (e as HTMLSelectElement).selectedOptions[0]?.text)) === "Giáo viên đã rời lớp", optsX);
    check(`${tag} ô chọn người đã rời không tràn ngang, ≥ 44px`, await noOverflow(po) && (await small(po, "[data-block-panel]")).length === 0, await small(po, "[data-block-panel]"));
    await po.locator("[data-block-panel] input[maxlength]").fill("Ghi chú thử");
    await po.locator("[data-block-panel]").getByRole("button", { name: "Lưu", exact: true }).click();
    await po.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 30000 });
    await eventually(`${tag} Lưu giữ nguyên teacherId của người đã rời (và ghi chú đã lưu)`, async () => { const r = await row(bX.id); return r?.teacherId === X.id && r?.note === "Ghi chú thử"; }, 30000);
    await prisma.classSchedule.update({ where: { id: bX.id }, data: { note: null } });
    await open(po, bO.id, 1);
    const sel = po.locator("[data-block-panel] [data-teacher-select]");
    const opts = await sel.locator("option").allInnerTexts();
    check(`${tag} chủ lớp: ô chọn Người dạy, mặc định "Chủ lớp", có Cô Đồng Giảng + Thầy Bộ Môn, KHÔNG có người đã gỡ`, await sel.isVisible() && opts[0] === "Chủ lớp" && opts.includes("Cô Đồng Giảng") && opts.includes("Thầy Bộ Môn") && !opts.includes("Cô Đã Gỡ"), opts);
    check(`${tag} ô chọn + nút trong hộp ≥ 44px, không tràn ngang`, (await small(po, "[data-block-panel]")).length === 0 && await noOverflow(po), await small(po, "[data-block-panel]"));
    await sel.selectOption({ label: "Cô Đồng Giảng" });
    await po.locator("[data-block-panel]").getByRole("button", { name: "Lưu", exact: true }).click();
    await po.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 30000 });
    await eventually(`${tag} chủ lớp đổi người dạy → DB teacherId = đồng giảng`, async () => (await row(bO.id))?.teacherId === C.id, 30000);
    await open(po, bO.id, 1);
    await po.locator("[data-block-panel] [data-teacher-select]").selectOption({ label: "Chủ lớp" });
    await po.locator("[data-block-panel]").getByRole("button", { name: "Lưu", exact: true }).click();
    await po.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 30000 });
    await eventually(`${tag} chọn lại Chủ lớp → DB teacherId = null`, async () => (await row(bO.id))?.teacherId === null, 30000);
    // khung mới giao cho bộ môn
    await po.locator("[data-add-block]").click();
    await po.locator("[data-block-panel] [data-teacher-select]").selectOption({ label: "Thầy Bộ Môn" });
    await po.locator("[data-block-panel]").getByRole("button", { name: "Lưu khung giờ" }).click();
    await po.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 30000 });
    await eventually(`${tag} khung mới giao cho Thầy Bộ Môn → DB teacherId = bộ môn`, async () => (await prisma.classSchedule.count({ where: { courseId: K.id, teacherId: S.id } })) === 2, 30000);
    await po.context().close();
    await prisma.classSchedule.deleteMany({ where: { courseId: K.id, id: { notIn: [bO.id, bC.id, bS.id, bX.id] } } });

    // ───────── S2: đồng giảng ─────────
    section(`S2. Đồng giảng (${tag})`);
    const pc = await (await ctxFor(C, { width: w, height: h })).newPage(); watch(pc);
    await ready(pc);
    await shot(pc, `schedule-teacher-co-${w}`);
    await open(pc, bC.id, 2);
    check(`${tag} đồng giảng: KHÔNG có ô chọn người dạy; chỉ nhãn "Người dạy: bạn" cho khung của mình`, await pc.locator("[data-teacher-select]").count() === 0 && (await pc.locator("[data-teacher-text]").innerText()).includes("bạn"));
    check(`${tag} khung của mình sửa được (có nút Lưu)`, await pc.locator("[data-block-panel]").getByRole("button", { name: "Lưu", exact: true }).isVisible());
    await closePanel(pc);
    await open(pc, bO.id, 1);
    const tO = await pc.locator("[data-teacher-text]").innerText();
    check(`${tag} khung chủ lớp: nhãn "chủ lớp", chỉ xem (không Lưu, ô giờ tắt)`, tO.includes("chủ lớp") && await pc.locator("[data-block-panel]").getByRole("button", { name: "Lưu", exact: true }).count() === 0 && await pc.locator("[data-block-panel] select").first().isDisabled(), tO);
    await closePanel(pc);
    await open(pc, bS.id, 3);
    const tS = await pc.locator("[data-teacher-text]").innerText();
    check(`${tag} khung người khác: nhãn "giáo viên khác", không lộ tên "Thầy Bộ Môn", chỉ xem`, tS.includes("giáo viên khác") && !(await pc.locator("body").innerText()).includes("Thầy Bộ Môn") && await pc.locator("[data-block-panel]").getByRole("button", { name: "Lưu", exact: true }).count() === 0, tS);
    await closePanel(pc);
    const off = await pc.locator("[data-rule-list] button").evaluateAll(bs => bs.map(b => (b as HTMLButtonElement).disabled));
    check(`${tag} danh sách khung: nút Tắt chỉ bật ở khung của mình (1 bật, 3 tắt)`, off.filter(d => !d).length === 1 && off.filter(d => d).length === 3, off);
    await pc.locator("[data-add-block]").click();
    await pc.locator("[data-block-panel]").waitFor({ timeout: 30000 });
    check(`${tag} khung mới: nhãn "Người dạy: bạn", không ô chọn`, (await pc.locator("[data-teacher-text]").innerText()).includes("bạn") && await pc.locator("[data-teacher-select]").count() === 0);
    await pc.locator("[data-block-panel]").getByRole("button", { name: "Lưu khung giờ" }).click();
    await pc.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 30000 });
    await eventually(`${tag} khung đồng giảng thêm → DB teacherId = chính họ`, async () => (await prisma.classSchedule.count({ where: { courseId: K.id, teacherId: C.id } })) === 2, 30000);
    check(`${tag} không tràn ngang`, await noOverflow(pc));
    await pc.context().close();
    await prisma.classSchedule.deleteMany({ where: { courseId: K.id, id: { notIn: [bO.id, bC.id, bS.id, bX.id] } } });

    // ───────── S3: bộ môn ─────────
    section(`S3. Giáo viên bộ môn (${tag})`);
    const ps = await (await ctxFor(S, { width: w, height: h })).newPage(); watch(ps);
    await ready(ps);
    await shot(ps, `schedule-teacher-subject-${w}`);
    check(`${tag} bộ môn: không có nút "Thêm khung giờ"`, await ps.locator("[data-add-block]").count() === 0);
    await open(ps, bS.id, 3);
    check(`${tag} kể cả khung của mình: chỉ xem (không Lưu), không ô chọn`, await ps.locator("[data-block-panel]").getByRole("button", { name: "Lưu", exact: true }).count() === 0 && await ps.locator("[data-teacher-select]").count() === 0);
    await closePanel(ps);
    const off2 = await ps.locator("[data-rule-list] button").evaluateAll(bs => bs.map(b => (b as HTMLButtonElement).disabled));
    check(`${tag} danh sách khung: mọi nút Tắt đều tắt (${off2.length} nút)`, off2.length === 4 && off2.every(Boolean), off2);
    check(`${tag} không tràn ngang`, await noOverflow(ps));
    await ps.context().close();
  }

  // ───────── S4: wizard ─────────
  section("S4. Wizard Tạo lớp");
  const tao = readFileSync("src/components/tutor/TaoLop.tsx", "utf8");
  check("TaoLop không truyền ô người dạy (chưa có đồng giảng)", !/<WeekScheduleEditor[^>]*\bteacher=/.test(tao));

  check("không lỗi JS / console trong cả bài", errors.filter(e => !/script tag while rendering React component/.test(e)).length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
