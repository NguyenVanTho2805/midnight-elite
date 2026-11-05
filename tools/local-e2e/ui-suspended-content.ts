// Quyết định 06/11/2026 — giao diện: học sinh ĐÃ NGHỈ lớp mở bài giảng / trang Bản ghi / Lớp của tôi → thông báo giọng KiN + nút "Liên hệ gia sư".
// Chụp 1280 và 390 (SHOTS, mặc định scratchpad/shots/susp-*.png). Học sinh đang học vẫn thấy bài. Không tên gia sư / số tiền trong thông báo.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-suspended-content.ts
// CA PHÁ: đổi lại context/route.ts cho 'suspended' qua → trang bài giảng không còn thông báo → đỏ.
import { mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, closeAll, shot } from "./ui";
import { prisma } from "@/lib/prisma";
import { mkdirSync } from "node:fs";

const MSG = "Bạn đã nghỉ lớp này nên chưa xem được bài. Liên hệ gia sư nếu cần tham gia lại.";

(async () => {
  mkdirSync(process.env.SHOTS ?? "scratchpad/shots", { recursive: true });
  await wipe();
  const T = await mkTutor("Cô Lan Riêng Tư");
  const S = await mkUser({ name: "Em Đã Nghỉ" }), A = await mkUser({ name: "Em Đang Học" });
  const course = await mkCourse(T.id, { name: "Toán 9 Kín" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: course.id, status: "suspended" } });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: course.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: "s-u", title: "Phần 1", courseId: course.id, order: 0 } });
  const ch = await prisma.chapter.create({ data: { id: "ch-u", title: "Chương 1", sectionId: sec.id, order: 0 } });
  const lesson = await prisma.lesson.create({ data: { id: "l-u", code: "L1", title: "Bài Đại Số Kín", type: "record", chapterId: ch.id, order: 0, isFree: false, isLocked: true, videoUrl: "https://youtu.be/KIN-BI-MAT" } });
  await launch();

  for (const [w, h, tag] of [[1280, 900, "1280"], [390, 844, "390"]] as const) {
    section(`Học sinh đã nghỉ (${tag})`);
    const ctx = await ctxFor(S, { width: w, height: h });
    const p = await ctx.newPage();
    const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");

    await p.goto(`${BASE}/student/bai-giang/${lesson.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("[data-suspended-notice]").waitFor({ timeout: 90000 });
    check(`bài giảng: thông báo KiN đúng câu (${tag})`, (await body()).includes(MSG), (await body()).slice(0, 300));
    check(`bài giảng: nút 'Liên hệ gia sư' trỏ hồ sơ gia sư (${tag})`, (await p.getByRole("link", { name: "Liên hệ gia sư" }).getAttribute("href")) === `/mentor/${T.id}`);
    check(`bài giảng: không tên gia sư, không số tiền, không tiêu đề bài, không link video (${tag})`, !/Cô Lan Riêng Tư|KIN-BI-MAT|Bài Đại Số Kín|₫|\d{1,3}(\.\d{3})+\s*(đ|₫)/.test(await body()));
    check(`bài giảng: nút đủ lớn ≥ 44px (${tag})`, (await p.getByRole("link", { name: "Liên hệ gia sư" }).boundingBox())!.height >= 44);
    check(`bài giảng: không tràn ngang (${tag})`, (await p.evaluate("document.documentElement.scrollWidth")) <= w);
    await shot(p, `susp-bai-giang-${tag}`);

    await p.goto(`${BASE}/lop-cua-toi/${course.id}/ban-ghi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("[data-suspended-notice]").waitFor({ timeout: 90000 });
    check(`trang Bản ghi: cùng thông báo + nút liên hệ (${tag})`, (await body()).includes(MSG) && (await p.getByRole("link", { name: "Liên hệ gia sư" }).count()) === 1);
    await shot(p, `susp-ban-ghi-${tag}`);

    await p.goto(`${BASE}/student/hoc-tap?course=${course.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("[data-suspended-notice]").waitFor({ timeout: 90000 });
    check(`Lớp của tôi ?course=: thông báo, không liệt kê bài (${tag})`, (await body()).includes(MSG) && !(await body()).includes("Bài Đại Số Kín"), (await body()).slice(0, 300));
    check(`Lớp của tôi: không tràn ngang (${tag})`, (await p.evaluate("document.documentElement.scrollWidth")) <= w);
    await shot(p, `susp-hoc-tap-${tag}`);

    // Bấm nút liên hệ → tới hồ sơ gia sư công khai
    await p.getByRole("link", { name: "Liên hệ gia sư" }).click();
    await p.waitForURL(new RegExp(`/mentor/${T.id}`), { timeout: 90000 });
    check(`bấm 'Liên hệ gia sư' → mở hồ sơ gia sư (${tag})`, p.url().includes(`/mentor/${T.id}`));
    await ctx.close();
  }

  section("Học sinh đang học: vẫn thấy bài");
  const ctxA = await ctxFor(A, { width: 1280, height: 900 });
  const pa = await ctxA.newPage();
  await pa.goto(`${BASE}/student/bai-giang/${lesson.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pa.getByText("Bài Đại Số Kín").first().waitFor({ timeout: 90000 });
  check("em đang học: thấy tiêu đề bài, KHÔNG có thông báo nghỉ lớp", (await pa.locator("[data-suspended-notice]").count()) === 0);

  await closeAll();
  await done();
})();
