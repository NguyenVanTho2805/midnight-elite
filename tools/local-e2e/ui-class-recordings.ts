// MD-02 / MD-07 / MD-17 / MD-11 — trình duyệt thật, 390px và 1280px: gia sư dán bản ghi bằng form (gắn buổi), thấy bảng ai đã xem; học sinh thấy bản ghi trong
// tab "Tài liệu & bản ghi" của Lớp của tôi; không tràn ngang, nút ≥ 44px, liên kết ngoài mở tab mới có rel an toàn. Ảnh chụp ra scratchpad/shots/recordings-*.png.
import { BASE, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll, shot, type Page } from "./ui";

const YT = "https://youtu.be/dQw4w9WgXcQ";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Minh Anh" }), S2 = await mkUser({ name: "Bảo Ngọc" });
  const C = await mkCourse(T.id, { name: "Toán 9 bản ghi" });
  await prisma.course.update({ where: { id: C.id }, data: { status: true } });
  for (const u of [S, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });
  const ses = await mkAttendanceSession(C.id, T.id, new Date("2026-10-16T00:00:00Z"));
  await mkAttendanceSession(C.id, T.id, new Date("2026-10-23T00:00:00Z"));
  const sec = await prisma.section.create({ data: { id: "s-u", title: "Phần 1", order: 1, courseId: C.id } });
  const ch = await prisma.chapter.create({ data: { id: "c-u", title: "Chương 1", order: 1, sectionId: sec.id } });
  const L = await prisma.lesson.create({ data: { id: "l-u", code: "u1", title: "Định lý Vi-ét", type: "record", order: 1, chapterId: ch.id, isLocked: false, videoUrl: YT,
    documents: JSON.stringify([{ name: "dinh-ly-vi-et.pdf", url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view" }]) } as never });
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: L.id, completed: true, watchedSeconds: 300 } });

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|ERR_/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 6000)}`); }); };
  const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  for (const [label, w, h] of [["390", 390, 844], ["1280", 1280, 900]] as const) {
    section(`Gia sư — trang Bản ghi ở ${label}px`);
    const tctx = await ctxFor(T, { width: w, height: h });
    const tp = await tctx.newPage(); watch(tp);
    await tp.goto(`${BASE}/lop-cua-toi/${C.id}/ban-ghi?buoi=${ses.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await tp.getByRole("heading", { level: 1, name: "Bản ghi của lớp" }).waitFor({ timeout: 120000 });
    await tp.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {}); // đợi nạp xong mã trang (dev biên dịch lần đầu) trước khi gõ
    check("buổi 16/10 từ ?buoi= được chọn sẵn trong ô 'Gắn vào buổi'", (await tp.locator("#rec-session").inputValue()) === ses.id);
    check("có chữ cam kết bản quyền và ô tick", (await tp.getByText(/Tôi là người tạo ra nội dung này/).count()) >= 1 && (await tp.locator('input[name="pledge"]').count()) === 1);
    check("không tràn ngang", (await overflow(tp)) <= 0, await overflow(tp));
    const submit = tp.getByRole("button", { name: "Lưu bản ghi" });
    check("nút Lưu bản ghi cao ≥ 44px", ((await submit.boundingBox())?.height ?? 0) >= 44);
    await shot(tp, `recordings-tutor-${label}-truoc`);

    // link xấu → báo lỗi tiếng Việt, không mất trang
    await tp.fill("#rec-title", `Bản ghi ${label}`); await tp.fill("#rec-url", "https://evil.example/x"); await tp.check('input[name="pledge"]');
    await Promise.all([tp.waitForURL(/ban-ghi\?loi=/), submit.click()]);
    check("link lạ → thông báo lỗi có chữ", (await tp.getByRole("alert").filter({ hasText: "YouTube" }).count()) === 1);
    // link đúng → lưu, hiện trong buổi
    await tp.fill("#rec-title", `Bản ghi ${label}`); await tp.fill("#rec-url", YT); await tp.selectOption("#rec-session", ses.id); await tp.check('input[name="pledge"]');
    await Promise.all([tp.waitForURL(/ban-ghi\?ok=1/), tp.getByRole("button", { name: "Lưu bản ghi" }).click()]);
    check("lưu xong: thông báo + bản ghi nằm dưới 'Buổi 16/10/2026'", (await tp.getByText("Đã lưu bản ghi vào lớp.").count()) === 1 && (await tp.locator(`[data-session-block="${ses.id}"] [data-recording-row]`, { hasText: `Bản ghi ${label}` }).count()) === 1);
    const open = tp.locator(`[data-recording-row]`, { hasText: `Bản ghi ${label}` }).getByRole("link", { name: "Mở" }).first();
    check("nút Mở: tab mới, rel noopener noreferrer, cao ≥ 44px", (await open.getAttribute("target")) === "_blank" && /noopener/.test((await open.getAttribute("rel")) ?? "") && ((await open.boundingBox())?.height ?? 0) >= 44);
    check("bảng ai đã xem: có tên Minh Anh 'Đã xem xong' và Bảo Ngọc 'Chưa xem'", (await tp.locator('[data-watch-student]', { hasText: "Minh Anh" }).getByText("Đã xem xong").count()) === 1 && (await tp.locator('[data-watch-student]', { hasText: "Bảo Ngọc" }).getByText("Chưa xem").count()) === 1);
    check("lưu xong vẫn không tràn ngang", (await overflow(tp)) <= 0, await overflow(tp));
    await shot(tp, `recordings-tutor-${label}`);
    // gỡ
    const nBefore = await prisma.classRecording.count();
    await tp.locator(`[data-recording-row]`, { hasText: `Bản ghi ${label}` }).getByRole("button", { name: "Gỡ" }).first().click();
    await tp.getByRole("button", { name: "Gỡ", exact: true }).last().click();
    await tp.waitForURL(/da-go=1/, { timeout: 30000 });
    check("gỡ có hộp xác nhận KiN rồi mới xoá", (await prisma.classRecording.count()) === nBefore - 1);
    await tctx.close();
    // lưu lại 1 bản để học sinh thấy
    await prisma.classRecording.create({ data: { courseId: C.id, sessionId: ses.id, title: `Bản ghi cho học sinh ${label}`, url: YT, kind: "youtube", createdBy: T.id } });

    section(`Học sinh — tab Tài liệu & bản ghi ở ${label}px`);
    const sctx = await ctxFor(S, { width: w, height: h });
    const sp = await sctx.newPage(); watch(sp);
    await sp.goto(`${BASE}/student/hoc-tap?course=${C.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await sp.getByRole("tab", { name: /Tài liệu & bản ghi/ }).click({ timeout: 120000 });
    await sp.locator("[data-materials-tab]").waitFor({ timeout: 60000 });
    await sp.locator("[data-recording-row]").first().waitFor({ timeout: 60000 });
    const body = await sp.locator("[data-materials-tab]").innerText();
    check("thấy bản ghi theo buổi: 'Buổi 16/10/2026' + nguồn YouTube + 'có thể cần quyền truy cập'", /Buổi 16\/10\/2026/.test(body) && /YouTube/.test(body) && /có thể cần quyền truy cập/.test(body), body.slice(0, 400));
    check("có tài liệu đính kèm bài (dinh-ly-vi-et.pdf)", /dinh-ly-vi-et\.pdf/.test(body));
    check("chữ trung thực: KiN chỉ lưu link, không biết đã mở chưa", /KiN chỉ lưu liên kết/.test(body) && /không biết bạn đã mở/.test(body));
    check("không có số giả: không 'lượt xem', không 'Thiết bị 1/2'", !/lượt xem|Thiết bị 1\/2/.test(await sp.locator("body").innerText()));
    const sopen = sp.locator("[data-recording-row] a").first();
    check("Mở ↗: tab mới, rel an toàn, cao ≥ 44px", (await sopen.getAttribute("target")) === "_blank" && /noopener/.test((await sopen.getAttribute("rel")) ?? "") && ((await sopen.boundingBox())?.height ?? 0) >= 44);
    check("không tràn ngang", (await overflow(sp)) <= 0, await overflow(sp));
    await shot(sp, `recordings-student-${label}`);
    await sctx.close();
  }

  section("Học sinh CHƯA ghi danh không thấy bản ghi trên trang lớp");
  const X = await mkUser({ name: "Người Lạ" });
  const xctx = await ctxFor(X); const xp = await xctx.newPage();
  await xp.goto(`${BASE}/student/hoc-tap?course=${C.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await xp.waitForTimeout(4000);
  check("không có dòng bản ghi nào, không có link YouTube trong trang", (await xp.locator("[data-recording-row]").count()) === 0 && !(await xp.content()).includes("youtu.be"));
  await xctx.close();

  check("không lỗi JS / console.error", errors.length === 0, errors.slice(0, 5).map(e => e.replace(/\\n/g, " | ")));
  await closeAll();
  done();
})();
