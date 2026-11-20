// TUT-dong-giang (giao diện, đợt 2) — 1280 và 390.
//   H1  giáo trình: chủ lớp có ô "Giao cho" ở mỗi nhóm (chọn bộ môn → DB chapter.teacherId; "Chủ lớp / không giao" → null);
//       đồng giảng chỉ thấy nhãn "Giao cho giáo viên khác" (không tên); bộ môn: nhóm của mình mở, nhóm khác bị khoá bằng chữ "Nhóm của giáo viên khác" và nút tắt.
//   H2  điểm danh buổi đã chốt: đồng giảng / bộ môn thấy "Buổi đã chốt: chỉ chủ lớp sửa được.", mọi nút điểm danh + ghi chú + Lưu tắt, KHÔNG "Đề nghị chủ lớp chốt";
//       chủ lớp vẫn sửa được; buổi chưa chốt mình dạy → có nút đề nghị; buổi người khác dạy → không có; 409 SESSION_CLOSED_OWNER_ONLY lọt qua → báo bằng chữ.
// Bẻ X thì ca Y đỏ: bỏ `disabled={locked}` ở nút trạng thái (DiemDanh RosterRowView) → H2 "nút điểm danh tắt"; bỏ `disabled={khoa}` ở fieldset nhóm (GiaoTrinh) → H1 "nhóm khác bị khoá".
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, kinSelect, kinSelectOptions, kinValue } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, addDaysKey } from "@/lib/classSessions";

const GOTO = { waitUntil: "domcontentloaded" as const, timeout: 120000 };

(async () => {
  await wipe();
  const O = await mkTutor("Cô Chủ Lớp"), C = await mkTutor("Cô Đồng Giảng"), S = await mkTutor("Thầy Bộ Môn");
  const K = await mkCourse(O.id, { name: "Toán 9 thử" });
  const hs = await mkUser({ name: "Em Học Sinh Thử" });
  await prisma.enrollment.create({ data: { userId: hs.id, courseId: K.id, status: "active" } });
  const ct = (userId: string, role: string) => prisma.courseTeacher.create({ data: { courseId: K.id, userId, role, status: "active", subjects: [], invitedBy: O.id, respondedAt: new Date() } });
  await ct(C.id, "co_teacher"); await ct(S.id, "subject_teacher");
  const sec = await prisma.section.create({ data: { id: "sec-h", title: "Phần 1", order: 1, courseId: K.id } });
  const chA = await prisma.chapter.create({ data: { id: "chap-h-a", title: "Nhóm của thầy", order: 1, sectionId: sec.id, teacherId: S.id } });
  const chB = await prisma.chapter.create({ data: { id: "chap-h-b", title: "Nhóm của cô chủ", order: 2, sectionId: sec.id } });
  for (const [i, ch] of [chA, chB].entries()) {
    await prisma.lesson.create({ data: { id: `les-h-${i}`, code: `H${i}`, title: `Bài ${i + 1}`, type: "record", order: 1, chapterId: ch.id, isLocked: false, status: "draft" } as never });
  }
  const today = vnDateKeyOf(new Date());
  const dClosed = addDaysKey(today, -1), dOpen = addDaysKey(today, -2), dOther = addDaysKey(today, -3);
  const mkSes = async (dateKey: string, taughtBy: string, state: string | null) => {
    const s = await prisma.attendanceSession.create({ data: { courseId: K.id, date: new Date(`${dateKey}T00:00:00Z`), createdBy: O.id, taughtBy, state } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: hs.id, status: "present" } });
    return s;
  };
  await mkSes(dClosed, S.id, "closed"); await mkSes(dOpen, S.id, null); await mkSes(dOther, C.id, null);

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|negative time stamp/i.test(m.text())) errors.push(`${p.url().replace(BASE, "")} :: ${m.text().slice(0, 160)}`); });
  };
  const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const small = (p: Page, root: string) => p.evaluate((sel) => [...document.querySelectorAll(`${sel} button:not([disabled]), ${sel} select:not([disabled])`)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(e => (e.textContent ?? "").trim().slice(0, 30)), root);
  // Máy chủ (260f920c) trả: giao-vien → teachers[].userId (CHỈ chủ/admin) + self.userId; giao-trinh → groups[] = { id, title, teacherId (thật CHỈ cho chủ lớp, người khác null), assignedTo "me"|"owner"|"other" }.
  // Shim bù trường CHỈ áp cho chủ lớp; đồng giảng / bộ môn chạy thẳng không shim. Cuối bài ca "máy chủ trả đủ" đỏ nếu còn thiếu.
  const gaps = { teacherUserId: false, selfUserId: false, groupTeacherId: false, assignedTo: false };
  const shim = async (p: Page, me: string) => {
    await p.route("**/api/tutor/lop/*/giao-vien", async r => {
      if (r.request().method() !== "GET") return r.continue();
      const res = await r.fetch(); const j = await res.json();
      if (Array.isArray(j.teachers)) {
        const cts = await prisma.courseTeacher.findMany({ where: { courseId: K.id }, select: { id: true, userId: true } });
        for (const t of j.teachers) if (t.userId === undefined) { gaps.teacherUserId = true; t.userId = cts.find(c => c.id === t.id)?.userId; }
      }
      if (j.self && j.self.userId === undefined) { gaps.selfUserId = true; j.self.userId = me; }
      return r.fulfill({ response: res, json: j });
    });
    await p.route("**/api/tutor/lop/*/giao-trinh", async r => {
      if (r.request().method() !== "GET") return r.continue();
      const res = await r.fetch(); const j = await res.json();
      if (Array.isArray(j.groups)) {
        if (j.groups.some((g: { assignedTo?: string }) => g.assignedTo === undefined)) gaps.assignedTo = true;
        const chs = await prisma.chapter.findMany({ where: { section: { is: { courseId: K.id } } }, select: { id: true, teacherId: true } });
        for (const g of j.groups) if (g.teacherId === undefined) { gaps.groupTeacherId = true; g.teacherId = chs.find(c => c.id === g.id)?.teacherId ?? null; }
      }
      return r.fulfill({ response: res, json: j });
    });
  };
  // LOI-02: tab "Bài học" = gốc lớp. Chủ lớp → cây Chương · Bài (ô "Giao cho" nằm ở hàng chương); đồng giảng / bộ môn → màn Giáo trình như cũ. …/giao-trinh 307 về đây.
  const GT = `/lop-cua-toi/quan-lop/${K.id}`;

  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    const tag = `${w}px`;
    // ───────── H1: giáo trình ─────────
    section(`H1. Giáo trình "Giao cho…" (${tag})`);
    const po = await (await ctxFor(O, { width: w, height: h })).newPage(); watch(po); await shim(po, O.id);
    await po.goto(`${BASE}${GT}`, GOTO);
    const selA = po.locator(`[data-gt-giao-cho="${chA.id}"] [role="combobox"]`), selB = po.locator(`[data-gt-giao-cho="${chB.id}"] [role="combobox"]`); // LOI-06: KinSelect
    await selA.waitFor({ timeout: 90000 });
    check(`${tag} chủ lớp: mỗi nhóm có ô "Giao cho giáo viên", nhóm A đang chọn Thầy Bộ Môn`, await selB.isVisible() && (await kinValue(selA)).includes("Thầy Bộ Môn"));
    check(`${tag} chủ lớp: ô chọn chỉ liệt kê bộ môn + "Chủ lớp / không giao" (không đồng giảng)`, (await kinSelectOptions(selB)).join("|") === "Chủ lớp / không giao|Thầy Bộ Môn");
    await kinSelect(selB, { label: "Thầy Bộ Môn" });
    await po.waitForFunction(() => !document.querySelector("select[disabled]"), null, { timeout: 30000 });
    check(`${tag} chọn bộ môn → DB chapter.teacherId = bộ môn`, (await prisma.chapter.findUnique({ where: { id: chB.id } }))?.teacherId === S.id);
    await kinSelect(selB, { label: "Chủ lớp / không giao" });
    await po.waitForFunction(() => !document.querySelector("select[disabled]"), null, { timeout: 30000 });
    check(`${tag} chọn "Chủ lớp / không giao" → teacherId null`, (await prisma.chapter.findUnique({ where: { id: chB.id } }))?.teacherId === null);
    check(`${tag} chủ lớp: ô chọn ≥ 44px`, (await small(po, `[data-gt-giao-cho]`)).length === 0, await small(po, `[data-gt-giao-cho]`));
    check(`${tag} chủ lớp: không tràn ngang`, await noOverflow(po));
    if (w === 1280) await shot(po, "dong-giang-giao-cho-chu-1280"); else await shot(po, "dong-giang-giao-cho-chu-390");

    const pc = await (await ctxFor(C, { width: w, height: h })).newPage(); watch(pc);
    await pc.goto(`${BASE}${GT}`, GOTO);
    await pc.locator(`[data-gt-giao-cho="${chA.id}"]`).waitFor({ timeout: 90000 });
    check(`${tag} đồng giảng: chỉ nhãn "Giao cho giáo viên khác" (không tên đồng nghiệp), không có ô chọn`, (await pc.locator(`[data-gt-giao-cho="${chA.id}"]`).innerText()).includes("Giao cho giáo viên khác") && await pc.locator("[data-gt-giao-cho] select").count() === 0);
    check(`${tag} đồng giảng: nhãn không lộ email/số điện thoại`, !/@|\b0\d{9}\b/.test(await pc.locator("[data-gt-giao-cho]").first().innerText()));

    const ps = await (await ctxFor(S, { width: w, height: h })).newPage(); watch(ps);
    await ps.goto(`${BASE}${GT}`, GOTO);
    await ps.locator(`[data-gt-giao-cho="${chB.id}"]`).waitFor({ timeout: 90000 });
    const blockB = ps.locator(`[data-gt-nhom="${chB.id}"]`), blockA = ps.locator(`[data-gt-nhom="${chA.id}"]`);
    check(`${tag} bộ môn: nhóm của chủ lớp ghi rõ "Giao cho chủ lớp", nhóm của mình "Giao cho bạn"`, (await blockB.innerText()).includes("Giao cho chủ lớp") && (await blockA.locator("[data-gt-giao-cho]").innerText()).trim() === "Giao cho bạn");
    check(`${tag} bộ môn: nhóm khác bị khoá (mọi nút tắt)`, await blockB.evaluate(el => (el as HTMLFieldSetElement).disabled && [...el.querySelectorAll("button")].every(b => (b as HTMLButtonElement).matches(":disabled"))));
    check(`${tag} bộ môn: nhóm của mình KHÔNG khoá, có nút Đổi tên bật`, await blockA.getAttribute("data-gt-nhom-khoa") === null && await blockA.getByRole("button", { name: /Đổi tên nhóm/ }).isEnabled());
    check(`${tag} bộ môn: không có ô chọn giao việc`, await ps.locator("[data-gt-giao-cho] select, [data-gt-giao-cho] [role=\"combobox\"]").count() === 0);
    check(`${tag} bộ môn: không tràn ngang`, await noOverflow(ps));
    if (w === 1280) await shot(ps, "dong-giang-giao-cho-bo-mon-1280"); else await shot(ps, "dong-giang-giao-cho-bo-mon-390");

    // ───────── H2: điểm danh buổi đã chốt ─────────
    section(`H2. Điểm danh buổi đã chốt (${tag})`);
    const pb = await (await ctxFor(S, { width: w, height: h })).newPage(); watch(pb);
    await pb.goto(`${BASE}/lop-cua-toi/buoi/${K.id}/${dClosed}`, GOTO);
    await pb.locator("[data-dd-da-chot]").waitFor({ timeout: 90000 });
    check(`${tag} buổi chốt (bộ môn): dòng "Buổi đã chốt: chỉ chủ lớp sửa được."`, (await pb.locator("[data-dd-da-chot]").innerText()).trim() === "Buổi đã chốt: chỉ chủ lớp sửa được.");
    check(`${tag} buổi chốt (bộ môn): nút điểm danh tắt`, await pb.getByRole("button", { name: /^Có mặt hệ số/ }).first().isDisabled() && await pb.getByRole("button", { name: /^Vắng hệ số/ }).first().isDisabled());
    check(`${tag} buổi chốt (bộ môn): Tất cả có mặt + Lưu điểm danh tắt`, await pb.getByRole("button", { name: "Tất cả có mặt" }).isDisabled() && await pb.getByRole("button", { name: "Lưu điểm danh" }).isDisabled());
    await pb.getByRole("button", { name: /nhận xét riêng/i }).first().click();
    check(`${tag} buổi chốt (bộ môn): ô ghi chú tắt`, await pb.locator("textarea[id^=nx-]").first().isDisabled());
    check(`${tag} buổi chốt (bộ môn): KHÔNG có "Đề nghị chủ lớp chốt"`, await pb.getByRole("button", { name: "Đề nghị chủ lớp chốt" }).count() === 0);
    check(`${tag} buổi chốt (bộ môn): không tràn ngang`, await noOverflow(pb));
    if (w === 1280) await shot(pb, "dong-giang-buoi-chot-1280"); else await shot(pb, "dong-giang-buoi-chot-390");

    const pco = await (await ctxFor(C, { width: w, height: h })).newPage(); watch(pco);
    await pco.goto(`${BASE}/lop-cua-toi/buoi/${K.id}/${dClosed}`, GOTO);
    await pco.getByText("Chưa có buổi điểm danh cho ngày này.").or(pco.locator("[data-bu-da-chot]")).first().waitFor({ timeout: 90000 });
    check(`${tag} buổi chốt do người khác dạy (đồng giảng): không có nút điểm danh sửa được`, await pco.getByRole("button", { name: /^Có mặt hệ số/ }).filter({ hasNot: pco.locator("[disabled]") }).count() === 0);

    const po2 = await (await ctxFor(O, { width: w, height: h })).newPage(); watch(po2);
    await po2.goto(`${BASE}/lop-cua-toi/buoi/${K.id}/${dClosed}`, GOTO);
    await po2.getByRole("button", { name: /^Có mặt hệ số/ }).first().waitFor({ timeout: 90000 });
    check(`${tag} buổi chốt (CHỦ LỚP): vẫn sửa được — nút bật, không dòng khoá`, await po2.getByRole("button", { name: /^Có mặt hệ số/ }).first().isEnabled() && await po2.locator("[data-dd-da-chot]").count() === 0 && await po2.getByRole("button", { name: "Mở lại buổi" }).isVisible());

    const pm = await (await ctxFor(S, { width: w, height: h })).newPage(); watch(pm);
    await pm.goto(`${BASE}/lop-cua-toi/buoi/${K.id}/${dOpen}`, GOTO);
    await pm.getByRole("button", { name: "Đề nghị chủ lớp chốt" }).waitFor({ timeout: 90000 });
    check(`${tag} buổi CHƯA chốt mình dạy: có nút "Đề nghị chủ lớp chốt", ô điểm danh bật, không dòng khoá`, await pm.getByRole("button", { name: /^Có mặt hệ số/ }).first().isEnabled() && await pm.locator("[data-dd-da-chot]").count() === 0);
    check(`${tag} nút đề nghị ≥ 44px`, (await small(pm, "[data-bu-close]")).length === 0, await small(pm, "[data-bu-close]"));
    // 409 lọt qua → báo bằng chữ
    await pm.route("**/api/attendance-sessions/*", r => (r.request().method() === "PUT" ? r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "x", code: "SESSION_CLOSED_OWNER_ONLY" }) }) : r.continue()));
    await pm.getByRole("button", { name: /^Vắng hệ số/ }).first().click();
    await pm.getByRole("button", { name: "Lưu điểm danh" }).click();
    await pm.getByText("Buổi đã chốt: chỉ chủ lớp sửa được.").first().waitFor({ timeout: 30000 });
    check(`${tag} 409 SESSION_CLOSED_OWNER_ONLY lọt qua → báo "Buổi đã chốt: chỉ chủ lớp sửa được." (không lộ mã)`, !(await pm.locator("body").innerText()).includes("SESSION_CLOSED"));

    const pn = await (await ctxFor(S, { width: w, height: h })).newPage(); watch(pn);
    await pn.goto(`${BASE}/lop-cua-toi/buoi/${K.id}/${dOther}`, GOTO);
    await pn.getByText("Chưa có buổi điểm danh cho ngày này.").waitFor({ timeout: 90000 });
    check(`${tag} buổi người khác dạy (bộ môn): KHÔNG có nút "Đề nghị chủ lớp chốt"`, await pn.getByRole("button", { name: "Đề nghị chủ lớp chốt" }).count() === 0);
    for (const p of [pb, pm, pn]) await p.context().close();
  }

  check("MÁY CHỦ trả đủ userId (giáo viên), self.userId, groups[].teacherId và groups[].assignedTo (không cần bổ sung)", !gaps.teacherUserId && !gaps.selfUserId && !gaps.groupTeacherId && !gaps.assignedTo, gaps);
  check("không lỗi JS / console trong cả bài", errors.filter(e => !/script tag while rendering React component/.test(e)).length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
