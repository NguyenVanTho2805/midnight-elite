// MD-14 + MD-16 + MD-09 trên trình duyệt thật: bài có 2 link Azota hiện 2 nút đúng href, hạn hiện giờ VN dễ đọc, /xem-tai-lieu từ chối địa chỉ lạ.
// Cần máy chủ thử + dữ liệu giả: bài này tự dựng dữ liệu riêng (wipe) rồi chụp ảnh 390 và 1280 vào scratchpad/shots.
import { mkTutor, mkUser, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Em An" });
  const c = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: c.id, status: "active" } });
  const sec = await prisma.section.create({ data: { id: "s-ui", title: "Phần 1", courseId: c.id, order: 0 } });
  const ch = await prisma.chapter.create({ data: { id: "ch-ui", title: "Chương 1", sectionId: sec.id, order: 0 } });
  const day = addDaysKey(vnDateKeyOf(new Date()), 3), [y, m, d] = day.split("-");
  const mk = (id: string, type: string, azotaUrl: string, order: number) => prisma.lesson.create({ data: { id, code: id, title: `Bài ${id}`, type, chapterId: ch.id, order, isFree: false, isLocked: false, azotaUrl, azotaDeadline: `${day}T20:00`, documents: "[]" } });
  await mk("quiz2", "quiz", JSON.stringify(["https://azota.vn/a1", "https://azota.vn/a2"]), 0);
  await mk("rec2", "record", JSON.stringify(["https://azota.vn/b1", "https://azota.vn/b2"]), 1);
  await mk("quiz1", "quiz", "https://azota.vn/c1", 2);
  await mk("quizbad", "quiz", JSON.stringify(["javascript:alert(1)"]), 3);

  await launch();
  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    const ctx = await ctxFor(S, { width: w, height: h });
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", e => errs.push(String(e)));
    section(`${w}px · bài kiểm tra Azota (type quiz) có 2 link`);
    await page.goto(`${BASE}/student/bai-giang/quiz2`, { waitUntil: "networkidle" });
    await page.getByText("Làm bài 1 trên Azota").waitFor({ timeout: 30000 });
    const hrefs = await page.locator('a:has-text("trên Azota")').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href));
    check("2 nút, href đúng từng link (không phải chuỗi JSON)", hrefs.join("|") === "https://azota.vn/a1|https://azota.vn/a2", hrefs);
    check("hạn hiện 'Hạn nộp: dd/mm/yyyy 20:00' đúng giờ VN", (await page.locator("body").innerText()).includes(`Hạn nộp: ${d}/${m}/${y} 20:00`));
    check("không có chữ thô 'T20:00' của chuỗi datetime-local", !(await page.locator("body").innerText()).includes(`${day}T20:00`));
    check(`${w}px: không tràn ngang`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await shot(page, `baomat-quiz-${w}`);

    section(`${w}px · tab Bài tập của bài video có 2 link`);
    await page.goto(`${BASE}/student/bai-giang/rec2`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Bài tập/ }).first().click({ timeout: 30000 });
    await page.getByText("Làm bài 2 trên Azota").waitFor({ timeout: 30000 });
    const h2 = await page.locator('a:has-text("Làm bài")').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href));
    check("tab Bài tập: 2 nút đúng href", h2.join("|") === "https://azota.vn/b1|https://azota.vn/b2", h2);
    await shot(page, `baomat-baitap-${w}`);

    section(`${w}px · 1 link và link độc`);
    await page.goto(`${BASE}/student/bai-giang/quiz1`, { waitUntil: "networkidle" });
    await page.getByText("Làm bài trên Azota", { exact: true }).waitFor({ timeout: 30000 });
    check("1 link: một nút, chữ không đánh số", (await page.locator('a:has-text("trên Azota")').count()) === 1);
    await page.goto(`${BASE}/student/bai-giang/quizbad`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Bài quizbad" }).waitFor({ timeout: 30000 }); await page.waitForTimeout(1500); // link không hợp lệ: không dựng bảng/nút Azota, chỉ hiện câu giải thích
    check("CA PHÁ: link javascript: không thành nút (không có nút 'Làm bài…' nào, không bảng Azota, không thẻ a nào mang href javascript:)", (await page.locator('a[href^="javascript:"]').count()) === 0 && (await page.getByRole("region", { name: "Bài Azota" }).count()) === 0 && (await page.locator('a:has-text("trên Azota")').count()) === 0);
    check("link không hợp lệ: CÓ câu giải thích trung thực \"Link bài Azota không hợp lệ, hãy báo gia sư.\" (không để trang trống)", (await page.getByText("Link bài Azota không hợp lệ, hãy báo gia sư.").count()) === 1);

    section(`${w}px · /xem-tai-lieu`);
    await page.goto(`${BASE}/xem-tai-lieu?url=${encodeURIComponent("javascript:alert(1)")}&name=x`, { waitUntil: "networkidle" });
    check("địa chỉ độc: thông báo tiếng Việt, không có iframe, không có nút Tải xuống", (await page.locator('div[role="alert"].text-center').innerText()).includes("Không mở được tài liệu này") && (await page.locator("iframe").count()) === 0 && (await page.getByText("Tải xuống").count()) === 0);
    await shot(page, `baomat-xem-tu-choi-${w}`);
    await page.goto(`${BASE}/xem-tai-lieu?url=${encodeURIComponent("https://evil.example/a.docx")}&name=x`, { waitUntil: "networkidle" });
    check("host lạ .docx: không iframe (không gọi Office Viewer)", (await page.locator("iframe").count()) === 0);
    await page.goto(`${BASE}/xem-tai-lieu?url=${encodeURIComponent("https://docs.google.com/document/d/ABC/edit")}&name=Doc`, { waitUntil: "domcontentloaded" });
    check("link Google Docs hợp lệ: có iframe /preview", (await page.locator('iframe[src*="docs.google.com/document/d/ABC/preview"]').count()) === 1);
    check(`${w}px: không có lỗi JS trang`, errs.length === 0, errs);
    await ctx.close();
  }
  await closeAll();
  done();
})();
