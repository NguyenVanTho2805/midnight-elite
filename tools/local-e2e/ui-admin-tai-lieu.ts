// BU-08 nợ (c) — đóng đường tải tệp không ký ở tab Chương bài cũ: ngăn Tài liệu KHÔNG có input[type=file], có dòng hướng dẫn dán link; bài tập: không nút đính kèm tệp.
// Kiểm cả /admin/khoa-hoc/{id} (quản trị) và /lop-cua-toi/quan-lop/{id} (gia sư, qua bí danh). (Tên spec: ui-khoa-hoc-tai-lieu — đặt ui-admin-tai-lieu theo quy ước ui-admin-*.)
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-admin-tai-lieu.ts
import { mkSuper, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
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
  const DOC_URL = "https://drive.google.com/file/d/ABC123TLIEU/view?usp=sharing";

  async function openLessonPanel(pg: any, url: string) {
    await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await pg.getByRole("button", { name: /Danh sách chương bài/ }).first().click({ timeout: 60000 }).catch(() => {});
    await pg.getByRole("button", { name: /\+ Thêm bài học/ }).first().click({ timeout: 60000 });
    await pg.getByText("Tài liệu đính kèm").first().waitFor({ timeout: 60000 });
  }
  const docInputs = (pg: any) => pg.locator('input[type="file"]').evaluateAll((els: Element[]) => els.map(e => e.getAttribute("accept") ?? ""));
  const isDocAccept = (a: string) => /pdf|docx?|xlsx?|pptx?|txt/i.test(a) && !/jpg|png|webp|image/i.test(a);

  section("Quản trị: /admin/khoa-hoc/{id} — mở ngăn Thêm bài học");
  const ctx = await ctxFor(SA, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  await openLessonPanel(pg, `${ADMIN}/admin/khoa-hoc/${course.id}`);
  check("ngăn Tài liệu đính kèm ĐÃ MỞ (không xanh rỗng)", await pg.getByText("Tài liệu đính kèm").first().isVisible());
  const files = await docInputs(pg);
  check("không input[type=file] nhận tài liệu (pdf/doc/xls/ppt/txt) trong ngăn", !files.some(isDocAccept), files);
  check("không còn chữ 'Chọn hoặc kéo-thả file từ máy tính' / 'Đính kèm hoặc kéo-thả file đề bài'", !/Chọn hoặc kéo-thả file từ máy tính|Đính kèm hoặc kéo-thả file đề bài/.test(await pg.innerText("body")));
  const hint = pg.locator("[data-tai-lieu-dong]");
  check("có dòng hướng dẫn 'Hiện chỉ dán link Drive' (BẮT BUỘC có)", (await hint.count()) >= 1 && /Hiện chỉ dán link Drive/.test(await hint.first().innerText()));
  await shot(pg, "admin-tai-lieu-1280");
  // dán link rồi lưu thành công
  await pg.getByPlaceholder(/Tên tài liệu/).fill("File lý thuyết");
  await pg.getByPlaceholder(/paste link Google Drive/i).fill(DOC_URL);
  await pg.locator("button.disabled\\:opacity-40", { hasText: "+ Thêm link" }).click(); // nút của ngăn Tài liệu (3 nút còn lại là của ô link video/zoom/azota)
  check("dán link → tài liệu hiện trong danh sách của ngăn", await pg.getByText("File lý thuyết").first().isVisible());
  await pg.getByPlaceholder(/Buổi 1: Hệ phương trình/).fill("Bài có tài liệu");
  await pg.locator("aside, [role=dialog], [data-drawer]").getByRole("button", { name: /^Lưu$/ }).first().click().catch(async () => { await pg.getByRole("button", { name: /^Lưu$/ }).last().click(); });
  await pg.getByRole("button", { name: /Lưu thay đổi/ }).first().click({ timeout: 4000 }).catch(() => {}); // có trang cần bấm thêm "Lưu thay đổi", có trang Lưu ngăn là đủ
  let saved = false;
  for (let k = 0; k < 40 && !saved; k++) { await new Promise(r => setTimeout(r, 500)); saved = !!(await prisma.lesson.findFirst({ where: { title: "Bài có tài liệu" } }))?.documents?.includes("ABC123TLIEU"); }
  check("lưu thành công: bài học trong DB có tài liệu là link đã dán", saved, await prisma.lesson.findMany({ select: { title: true, documents: true } }));
  await ctx.close();

  section("Gia sư: /lop-cua-toi/quan-lop/{id} (cùng tệp qua bí danh) — mở ngăn Thêm bài học");
  const ct = await ctxFor(T, { width: 1280, height: 900 });
  const pt = await ct.newPage(); watch(pt);
  await openLessonPanel(pt, `${BASE}/lop-cua-toi/quan-lop/${course.id}`);
  const files2 = await docInputs(pt);
  check("gia sư: ngăn mở được, KHÔNG input[type=file] nhận tài liệu, có dòng hướng dẫn dán link", !files2.some(isDocAccept) && (await pt.locator("[data-tai-lieu-dong]").count()) >= 1, files2);
  await ct.close();

  section("Bài tập: không nút đính kèm tệp đề bài");
  const lesson = await prisma.lesson.findFirst({ where: { title: "Bài có tài liệu" } });
  const ca = await ctxFor(SA, { width: 1280, height: 900 });
  const pa = await ca.newPage(); watch(pa);
  await pa.goto(`${ADMIN}/admin/khoa-hoc/${course.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pa.getByRole("button", { name: /Danh sách chương bài/ }).first().click({ timeout: 60000 }).catch(() => {});
  // nút sửa của hàng bài học là nút biểu tượng có title="Sửa" (không có aria-label — có sẵn ở khoa-hoc/[id]/page.tsx, ghi trong phiếu)
  const edit = pa.locator('main button[title="Sửa"]');
  await edit.first().waitFor({ timeout: 60000 }).catch(() => {});
  check("có bài học để mở lại (đã lưu ở bước trên)", !!lesson && (await edit.count()) >= 1);
  if (lesson) {
    await edit.first().click();
    await pa.getByText("Tài liệu đính kèm").first().waitFor({ timeout: 60000 });
    await pa.getByRole("button", { name: /Thêm bài tập|\+ Bài tập|Tạo bài tập/ }).first().click({ timeout: 8000 }).catch(() => {});
    const fileInputs = await docInputs(pa);
    check("trong ngăn sửa bài (có phần bài tập): không input[type=file] nhận tài liệu/đề bài", !fileInputs.some(isDocAccept), fileInputs);
    check("không còn nút 'Chọn tệp'/'Đính kèm tệp' nào trong ngăn", !/Chọn tệp|Đính kèm tệp|Tải tệp từ máy/i.test(await pa.innerText("body")));
  }
  await ca.close();

  section("390px");
  const cm = await ctxFor(SA, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await openLessonPanel(pm, `${ADMIN}/admin/khoa-hoc/${course.id}`);
  check("390: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  check("390: không input[type=file] nhận tài liệu", !(await docInputs(pm)).some(isDocAccept));
  await shot(pm, "admin-tai-lieu-390");
  await cm.close();

  check("không lỗi console/pageerror lạ", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
