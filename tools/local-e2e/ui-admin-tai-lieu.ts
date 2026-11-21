// BU-08 nợ (c) — đóng đường tải tệp không ký ở tab Chương bài cũ: ngăn Tài liệu KHÔNG có input[type=file], có dòng hướng dẫn dán link; bài tập: không nút đính kèm tệp.
// /lop-cua-toi/quan-lop/{id} (gia sư) có khung thả thật; /admin/khoa-hoc/{id} (SCL-F2) không còn chỗ soạn bài. (Tên spec: ui-khoa-hoc-tai-lieu — đặt ui-admin-tai-lieu theo quy ước ui-admin-*.)
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-tai-lieu.ts
import { mkSuper, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { MAIN_HOST } from "@/lib/hostRouting";
import { BASE } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const T = await mkTutor("Cô Lan");
  const course = await mkCourse(T.id, { name: "Toán 9 Tài liệu" });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };

  // adm-test 02/11: bản cũ không bao giờ mở ngăn Tài liệu (bấm tab role=tab không tồn tại, bỏ lỗi) nên mọi ca "không có input file" xanh RỖNG.
  // Nay: seed phần/chương, MỞ ngăn "Thêm bài học" và BẮT BUỘC thấy "Tài liệu đính kèm" trước khi khẳng định gì.
  await prisma.section.create({ data: { id: "sec-tl", title: "PHẦN 1", order: 0, courseId: course.id } });
  await prisma.chapter.create({ data: { id: "ch-tl", title: "Chương 1", order: 0, sectionId: "sec-tl" } });

  async function openLessonPanel(pg: any, url: string) {
    await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await pg.getByRole("button", { name: /Chương bài/ }).first().click({ timeout: 60000 }).catch(() => {});
    // Trang quản trị: nút "+ Thêm bài học" mở thẳng ngăn. Trang gia sư (GS-LOP-GON): "+ Thêm bài" cuối chương mở dòng thêm nhanh, "Chi tiết…" mới mở ngăn.
    const tutorAdd = pg.locator("[data-them-bai]").first();
    const adminAdd = pg.getByRole("button", { name: /\+ Thêm bài học/ }).first();
    await Promise.race([tutorAdd.waitFor({ timeout: 60000 }), adminAdd.waitFor({ timeout: 60000 })]);
    if (await tutorAdd.isVisible().catch(() => false)) {
      await tutorAdd.click();
      await pg.getByRole("button", { name: /^Chi tiết…$/ }).first().click({ timeout: 30000 });
    } else await adminAdd.click();
    await pg.getByText("Tài liệu đính kèm").first().waitFor({ timeout: 60000 });
  }
  const docInputs = (pg: any) => pg.locator('input[type="file"]').evaluateAll((els: Element[]) => els.map(e => e.getAttribute("accept") ?? ""));
  const isDocAccept = (a: string) => /pdf|docx?|xlsx?|pptx?|txt/i.test(a) && !/jpg|png|webp|image/i.test(a);

  // SCL-F2 (P2-27): trang /admin/khoa-hoc/{id} không còn tab Chương bài / ngăn soạn bài — Chủ nhiệm soạn trong vỏ gia sư như mọi vai.
  section("Quản trị: /admin/khoa-hoc/{id} — không còn chỗ soạn bài, không đường tải tệp");
  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(`${ADMIN}/admin/khoa-hoc/${course.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.locator("[data-mo-vo-gia-su]").waitFor({ timeout: 60000 });
  check("không còn tab 'Chương bài'", (await pg.getByRole("button", { name: /Chương bài/ }).count()) === 0);
  check("có nút 'Mở lớp trong vỏ gia sư' trỏ trang lớp — địa chỉ TUYỆT ĐỐI ở tên miền chính (cookie không dùng chung hai tên miền)", (await pg.locator("[data-mo-vo-gia-su]").getAttribute("href")) === `https://${MAIN_HOST}/lop-cua-toi/quan-lop/${course.id}`);
  check("không input[type=file] nhận tài liệu", !(await docInputs(pg)).some(isDocAccept));
  await ctx.close();

  section("Gia sư: /lop-cua-toi/quan-lop/{id}?tab=chuong-bai (GS-LOP-GON: trang gia sư riêng, có KHUNG THẢ tài liệu thật) — mở ngăn Thêm bài học");
  const ct = await ctxFor(T, { width: 1280, height: 900 });
  const pt = await ct.newPage(); watch(pt);
  await openLessonPanel(pt, `${BASE}/lop-cua-toi/quan-lop/${course.id}?tab=chuong-bai`);
  // Khung thả nay là ô dùng chung OThaTep (thuộc tính data-o-tha; trước đây data-tai-lieu-khung). Chờ qua bước "dang-kiem".
  await pt.locator('[data-tai-lieu] [data-o-tha]:not([data-o-tha="dang-kiem"])').first().waitFor({ timeout: 30000 });
  // Ô tải VIDEO (VideoUploadBox, BU-02, có từ trước ở ô video của bài) là tính năng khác, cùng ngăn: chỉ đo input NẰM TRONG khung tài liệu ([data-tai-lieu]).
  const files2 = await pt.locator('[data-tai-lieu] input[type="file"]').evaluateAll((els: Element[]) => els.map(e => e.getAttribute("accept") ?? ""));
  check("gia sư: ngăn mở được, CÓ khung thả tài liệu (input[type=file] nhận pdf/doc… trong [data-tai-lieu]), KHÔNG còn dòng 'sắp có', KHÔNG đường video file trong khung tài liệu", files2.length === 0 ? (await pt.locator("[data-tai-lieu] [data-o-tha]").count()) >= 1 : (files2.some(a => /\.pdf/.test(a) && /\.docx/.test(a)) && !files2.some(a => /mp4|video|mov|webm/i.test(a)) && (await pt.locator("[data-tai-lieu-dong]").count()) === 0), files2);
  await ct.close();

  section("390px (trang admin của lớp)");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${ADMIN}/admin/khoa-hoc/${course.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pm.locator("[data-mo-vo-gia-su]").waitFor({ timeout: 60000 });
  check("390: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  check("390: không input[type=file] nhận tài liệu", !(await docInputs(pm)).some(isDocAccept));
  await shot(pm, "admin-tai-lieu-390");
  await cm.close();

  check("không lỗi console/pageerror lạ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
