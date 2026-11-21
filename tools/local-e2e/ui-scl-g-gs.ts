// SCL-G-GS (21/11/2026) — màn gia sư theo bản chốt (docs/kin/thiet-ke/scl/QUYET-DINH-GIAO-DIEN.md §2.2, §3.4; khung Figma 731:2, 733:2, 730:2) trên trình duyệt thật:
//  1280 trang lớp: thanh bên có "Hộp việc" (số việc) + "Lớp của bạn" (chấm màu, sĩ số, lớp đang mở sáng); MỘT nút chính "+ Giao bài"; tab Bài học / Học sinh / Điểm là liên kết
//    (không aria-pressed); khối "Cần bạn xử lý" là hàng bấm được; hàng bài có "Video 42 phút" · "Nộp 2/3" · trạng thái có chữ + hình; lớp một phần ẩn tầng Phần;
//    ngăn "Sửa bài" LUÔN MỞ (vùng có tên), mở sẵn bài mới nhất; link YouTube có dòng nhắc Không công khai + xem trước; tài liệu "Gỡ" có hỏi lại; tự lưu "Đã tự lưu lúc HH:MM".
//  1280 Hộp việc: gom theo lớp (Bài chờ chấm / Điểm chờ duyệt / Xin vào lớp / Buổi tới chưa có video); một nút chính.
//  390: thanh dưới đúng 3 mục Hộp việc / Lớp / Tôi; Hộp việc duyệt điểm, chấm một bài, nhận học sinh ngay tại chỗ (POST + 303 về Hộp việc); không tràn ngang.
// Chạy (máy chủ dev đang chạy): source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-scl-g-gs.ts   (SHOTS_DIR=… để chụp ảnh)
// Ca phá cố ý: (1) bỏ `inline={desktop}` ở TabChuongBai → ca "ngăn luôn mở" đỏ; (2) đổi "Nộp" trong lopViec.nopText → ca cột Nộp đỏ;
// (3) bỏ mục "lop-m" khỏi items của TutorShell → ca "thanh dưới 3 mục" đỏ.
// Rà soát (SCL-G-GS sửa): (4) bỏ `flushAuto` khỏi closePanel → ca "gõ rồi bấm Đóng ngay ⇒ DB có chữ mới" đỏ; (5) trả lại `if (autoBusy) return` (bỏ chờ lượt) → ca "tự lưu đua" đỏ;
// (6) bỏ `...activeIn(ids)` + lọc cặp ở lopViecServer → ca "học sinh đã rời lớp không được đếm" đỏ.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import type { Page } from "playwright";

const SHOTS = process.env.SHOTS_DIR;
const snap = async (pg: Page, name: string) => { if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const overflowX = (pg: Page) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Số nút / liên kết ĐANG HIỆN có nền nút chính (--kin-nhan-nen) trong vùng nội dung (không tính thanh bên / thanh dưới / hộp thoại). */
const primaries = (pg: Page) => pg.evaluate(() => {
  const probe = document.createElement("div"); probe.style.background = "var(--kin-nhan-nen)"; document.body.appendChild(probe);
  const navy = getComputedStyle(probe).backgroundColor; probe.remove();
  return [...document.querySelectorAll<HTMLElement>("a, button")].filter(e => e.getClientRects().length > 0 && !e.closest("nav, [role=dialog]") && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).backgroundColor === navy)
    .map(e => (e.innerText || e.getAttribute("aria-label") || "").trim());
});
const statusOk = (pg: Page, scope: string) => pg.locator(`${scope} [data-kin-status]:visible`).evaluateAll(els => els.map(e => ({ t: (e as HTMLElement).innerText.trim(), svg: !!e.querySelector("svg") })));

(async () => {
  await wipe();
  const stamp = Date.now();
  const T = await mkTutor("Cô Lan (thử)");
  const S = await Promise.all(["Minh Anh (thử)", "Mai Chi (thử)", "Gia Bảo (thử)"].map(name => mkUser({ name })));
  const S4 = await mkUser({ name: "Thu Hà (thử)" });
  const A = await mkCourse(T.id, { name: "Toán 9 · Lớp thử A" });
  const B = await mkCourse(T.id, { name: "Vật lý 9 · Lớp thử B" });
  for (const s of S) await prisma.enrollment.create({ data: { userId: s.id, courseId: A.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S[0].id, courseId: B.id, status: "active" } });
  // A: MỘT phần, hai chương. B: hai phần (tầng Phần phải hiện).
  const secA = await prisma.section.create({ data: { id: `sec-a-${stamp}`, title: "Phần 1 (thử)", order: 1, courseId: A.id } });
  const ch1 = await prisma.chapter.create({ data: { id: `ch1-${stamp}`, title: "Chương 1 · Căn bậc hai", order: 1, sectionId: secA.id } });
  const ch2 = await prisma.chapter.create({ data: { id: `ch2-${stamp}`, title: "Chương 2 · Hệ phương trình", order: 2, sectionId: secA.id } });
  const mkLesson = (id: string, chapterId: string, title: string, o: Record<string, unknown> = {}) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "document", order: 1, chapterId, isLocked: false, isFree: false, documents: "[]", ...o } as never });
  const L1 = await mkLesson(`l1-${stamp}`, ch1.id, "Căn bậc hai và rút gọn", { videoUrl: "https://youtu.be/dQw4w9WgXcQ", duration: "42", type: "record",
    documents: JSON.stringify([{ name: "Đề cương (thử)", url: "https://drive.google.com/file/d/thu-de-cuong/view" }]) });
  const L2 = await mkLesson(`l2-${stamp}`, ch2.id, "Hệ phương trình bậc nhất", { scheduledAt: new Date(Date.now() + 2 * 86400000) });
  const asg = await prisma.assignment.create({ data: { lessonId: L2.id, title: "Bài tập buổi 5 (thử)", maxPoints: 10 } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: S[0].id, fileUrl: "https://example.com/bai-thu.pdf", kind: "link" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: S[1].id, fileUrl: "https://example.com/bai-thu-2.pdf", kind: "link", score: 8, gradedAt: new Date() } });
  await prisma.exam.create({ data: { id: `az-${stamp}`, code: `AZ${stamp}`, title: "Đề Azota tuần 1 (thử)", category: "toan", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-11-21", azotaUrl: "https://azota.vn/x", totalPoints: 10, courseId: A.id, ownerId: T.id } as never });
  await prisma.examResult.create({ data: { userId: S[2].id, examId: `az-${stamp}`, score: 7, totalPoints: 10, pendingReview: true } });
  await prisma.classJoinRequest.create({ data: { courseId: A.id, userId: S4.id } });
  // Học sinh ĐÃ RỜI lớp A còn một bài nộp chưa chấm + một điểm chờ duyệt: KHÔNG được đếm (cùng nguồn sổ điểm / cột Chờ chấm của hàng bài).
  const S5 = await mkUser({ name: "Đã Rời (thử)" });
  await prisma.enrollment.create({ data: { userId: S5.id, courseId: A.id, status: "removed" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: S5.id, fileUrl: "https://example.com/bai-roi.pdf", kind: "link" } });
  await prisma.examResult.create({ data: { userId: S5.id, examId: `az-${stamp}`, score: 5, totalPoints: 10, pendingReview: true } });
  await prisma.classSchedule.createMany({ data: [{ courseId: A.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30" }, { courseId: A.id, dayOfWeek: 4, startTime: "19:00", endTime: "20:30" }] });
  await prisma.classInvite.create({ data: { courseId: A.id, code: `KIN-T9A${stamp % 1000}`, createdBy: T.id } });
  const secB1 = await prisma.section.create({ data: { id: `sec-b1-${stamp}`, title: "Phần cơ học (thử)", order: 1, courseId: B.id } });
  await prisma.section.create({ data: { id: `sec-b2-${stamp}`, title: "Phần điện học (thử)", order: 2, courseId: B.id } });
  const chB = await prisma.chapter.create({ data: { id: `chb-${stamp}`, title: "Chương chuyển động", order: 1, sectionId: secB1.id } });
  await mkLesson(`lb-${stamp}`, chB.id, "Vận tốc (thử)");

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); };
  const classUrl = (id: string) => `${BASE}/lop-cua-toi/quan-lop/${encodeURIComponent(id)}`;

  section("1280 · trang lớp gia sư");
  const pg = await (await ctxFor(T, { width: 1280, height: 900, rail: "mac-dinh" })).newPage(); watch(pg);
  await pg.goto(classUrl(A.id), { waitUntil: "networkidle", timeout: 170000 });
  const region = pg.getByRole("region", { name: "Sửa bài học" });
  await region.waitFor({ timeout: 90000 });
  const rail = pg.locator("nav[aria-label='Module của gia sư']:visible").first();
  const inbox = rail.getByRole("link", { name: /Hộp việc/ });
  check("thanh bên: 'Hộp việc' có số việc (1 chờ chấm + 1 chờ duyệt + 1 xin vào = 3)", (await inbox.count()) === 1 && /3 việc cần xử lý/.test(await inbox.innerHTML()), await inbox.innerText().catch(() => ""));
  const classes = rail.locator("[data-rail-classes] a:has([data-cham-lop])");
  check("thanh bên: 'Lớp của bạn' liệt kê 2 lớp, có chấm màu và sĩ số", (await classes.count()) === 2 && (await rail.getByRole("group", { name: "Lớp của bạn" }).count()) === 1
    && /Toán 9 · Lớp thử A\s*3\s*, 3 học sinh/.test(await classes.filter({ hasText: "Toán 9" }).innerText()));
  check("thanh bên (rộng, mặc định): lớp đang mở là mục duy nhất đang sáng", (await rail.locator("[aria-current=page]:visible").count()) === 1 && /Toán 9/.test(await rail.locator("[aria-current=page]:visible").innerText()));
  check("không có ô lọc lớp khi ≤ 8 lớp", (await rail.locator("[data-loc-lop]").count()) === 0);
  const prim = await primaries(pg);
  check("MỘT nút chính trên màn: '+ Giao bài'", prim.length === 1 && prim[0] === "+ Giao bài", prim);
  check("câu dẫn dưới tiêu đề nói rõ nút chính làm gì", (await pg.locator("[data-cau-dan]:visible").innerText()).includes("Giao bài tập, gắn video hoặc tài liệu cho lớp"));
  const tabs = pg.locator("nav[aria-label^='Trang của']:visible a");
  check("tab trong lớp: 'Bài học / Học sinh / Điểm' đứng đầu, là liên kết, không aria-pressed", (await tabs.allInnerTexts()).slice(0, 3).join("|") === "Bài học|Học sinh|Điểm"
    && (await pg.locator("nav[aria-label^='Trang của'] [aria-pressed]").count()) === 0, await tabs.allInnerTexts());
  check("dải lớp: ĐÚNG 3 tab hiện + nút 'Khác' (Video / Thông báo / Cài đặt nằm trong)", (await tabs.allInnerTexts()).map(x => x.trim()).join("|") === "Bài học|Học sinh|Điểm"
    && (await pg.locator("nav[aria-label^='Trang của']:visible [data-tab-khac]").count()) === 1, await tabs.allInnerTexts());
  await pg.locator("nav[aria-label^='Trang của']:visible [data-tab-khac]").click();
  check("bấm 'Khác' ⇒ liệt kê Video · Thông báo · Cài đặt (liên kết)", /Video[\s\S]*Thông báo[\s\S]*Cài đặt/.test(await pg.locator("#dai-tab-khac").innerText()));
  await pg.keyboard.press("Escape");
  check("Esc đóng 'Khác'", (await pg.locator("#dai-tab-khac").count()) === 0);
  const meta = (await pg.locator("[data-dong-phu-lop]:visible").innerText()).replace(/\s+/g, " ");
  check("dòng phụ đầu lớp: tên cô · lịch học · sĩ số · mã lớp; không mã môn thô 'toan'", meta.includes("Cô Lan (thử)") && meta.includes("Thứ Ba, Thứ Năm, 19:00") && meta.includes("3 học sinh") && /Mã lớp KIN-T9A/.test(meta) && !/\btoan\b/.test(meta), meta);
  const cxl = pg.locator("[data-can-xu-ly]:visible");
  const cxlRows = cxl.locator("a[data-kin-list-row]");
  check("'Cần bạn xử lý' đầu cột trái: 3 hàng bấm được (chờ chấm / chờ duyệt / xin vào lớp), có chữ số lượng", (await cxlRows.count()) === 3
    && /Bài chờ chấm[\s\S]*1 bài/.test(await cxlRows.nth(0).innerText()) && /Điểm chờ duyệt[\s\S]*1 điểm/.test(await cxlRows.nth(1).innerText()) && /Xin vào lớp[\s\S]*1 người/.test(await cxlRows.nth(2).innerText()));
  const cxlBox = await cxl.boundingBox(), listBox = await pg.locator("[data-phan]:visible").first().boundingBox(), regBox = await region.boundingBox();
  check("hai cột: 'Cần bạn xử lý' + danh sách bên trái, ngăn sửa bên phải", !!cxlBox && !!listBox && !!regBox && cxlBox.y < listBox.y && regBox.x > listBox.x + listBox.width - 2, { cxlBox, listBox, regBox });
  check("lớp một phần: ẩn tầng Phần", (await pg.getByText("Phần 1 (thử)").filter({ visible: true }).count()) === 0 && (await pg.getByText("Chương 2 · Hệ phương trình").filter({ visible: true }).count()) >= 1);
  const row1 = pg.locator(`[data-bai="${L1.id}"]`), row2 = pg.locator(`[data-bai="${L2.id}"]`);
  check("hàng bài: 'Video 42 phút' (ghi đủ chữ) / 'Chưa có video'", (await row1.locator("[data-cot-video]").innerText()) === "Video 42 phút" && (await row2.locator("[data-cot-video]").innerText()) === "Chưa có video");
  check("hàng bài: cột 'Nộp 2/3' + 'Chờ chấm 1' (chữ + hình)", (await row2.locator("[data-cot-nop]").innerText()) === "Nộp 2/3" && /Chờ chấm 1/.test(await row2.locator("[data-kin-status]").innerText()) && (await row2.locator("[data-kin-status] svg").count()) >= 1);
  check("hàng bài: không nút 'Sửa nhanh' / 'Sao chép chương' / '+ Thêm chương' / '+ Thêm phần mới' lộ ra (vào ⋯)", (await pg.locator("[data-phan]").getByRole("button", { name: /^(Sửa nhanh|Sao chép chương|\+ Thêm chương|\+ Thêm phần mới|Sửa|Xoá)$/ }).filter({ visible: true }).count()) === 0);
  check("MỘT hàng thêm ở đầu: '+ Bài' + '+ Chương'; cuối chương chỉ '+ Thêm bài'", (await pg.locator("[data-them-bai-dau]:visible").count()) === 1 && (await pg.locator("[data-hang-them]:visible").getByRole("button", { name: "+ Chương" }).count()) === 1
    && (await pg.locator("[data-them-bai]:visible").count()) === 2);
  const rh = await Promise.all([row1, row2].map(r => r.locator("[data-kin-list-row]").boundingBox()));
  const vx = await Promise.all([row1, row2].map(r => r.locator("[data-cot-video]").boundingBox()));
  check("hàng bài gọn (≤ 96px) và cột phải thẳng hàng ở mọi hàng", rh.every(b => !!b && b.height <= 96) && !!vx[0] && !!vx[1] && Math.abs(vx[0].x - vx[1].x) < 1, { rh, vx });
  check("ngày học là chữ phụ (không viền như nút)", (await row2.locator("[data-bai-ngay]").evaluate(e => getComputedStyle(e).borderTopWidth)) === "0px");
  check("ngăn Sửa bài học tự lưu: KHÔNG có nút Lưu, có 'Đóng'", (await region.getByRole("button", { name: /^Lưu$/ }).count()) === 0 && (await region.getByRole("button", { name: "Đóng", exact: true }).count()) === 1);
  check("ngăn có ô 'Chương' (chọn chương của bài)", (await region.locator("#ls-chuong").count()) === 1 && /Chương 2 · Hệ phương trình/.test(await region.locator("#ls-chuong").innerText()));
  check("ngăn 'Sửa bài' LUÔN MỞ: vùng có tên, mở sẵn bài mới nhất (hàng đó aria-current)", (await region.getAttribute("data-ngan-bai-hoc")) === "mo" && (await pg.locator("#ls-ten").inputValue()) === L2.title && (await row2.locator("[data-kin-list-row]").getAttribute("aria-current")) === "true");
  check("ngăn không phải hộp thoại phủ nền (không aria-modal trên máy tính)", (await pg.locator("[role=dialog][aria-modal=true]:visible").count()) === 0);
  const small = await pg.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-bai-hoc] button, [data-bai-hoc] a")].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.closest("[data-o-tha]") && e.getBoundingClientRect().height < 43.5).map(e => `${e.innerText.trim().slice(0, 20)}:${Math.round(e.getBoundingClientRect().height)}`));
  check("nút trong vùng nội dung ≥ 44px", small.length === 0, small);
  const st = await statusOk(pg, "[data-bai-hoc]");
  check(`mọi trạng thái trên màn có chữ VÀ hình (${st.length})`, st.length >= 4 && st.every(x => x.t && x.svg), st);
  check("1280 không tràn ngang", await overflowX(pg) <= 0);
  await snap(pg, "gs-trang-lop-1280");

  section("1280 · ngăn sửa: YouTube, tài liệu, tự lưu");
  await row1.getByRole("button", { name: `Chi tiết bài ${L1.title}` }).click();
  await pg.locator("#ls-ten").waitFor();
  await pg.waitForFunction((t: string) => (document.querySelector("#ls-ten") as HTMLInputElement | null)?.value === t, L1.title);
  check("bấm tên bài ⇒ ngăn chuyển sang bài đó, hàng sáng", (await row1.locator("[data-kin-list-row]").getAttribute("aria-current")) === "true" && (await row2.locator("[data-kin-list-row]").getAttribute("aria-current")) === null);
  check("ô 'Link YouTube' có logo + dòng nhắc 'Không công khai'", (await pg.locator("[data-video-bai] label svg").count()) === 1 && /Không công khai là đủ/.test(await pg.locator("[data-youtube-luu-y]").innerText()));
  check("lời nhắc YouTube KHÔNG lặp: dòng nhận diện không nhắc lại 'Không công khai'", !/Không công khai/.test(await pg.locator("[data-video-bai] [role=status]").first().innerText()));
  check("ô cam kết bản quyền nằm NGOÀI viền đứt của ô thả", (await pg.locator("[data-o-tha] [data-tai-lieu-cam-ket]").count()) === 0 && (await pg.locator("[data-tai-lieu-cam-ket]").count()) === 1);
  check("dán link ⇒ xem trước có ảnh thu nhỏ + thời lượng", (await pg.locator("[data-xem-truoc-youtube] img").count()) === 1 && /Video 42 phút/.test(await pg.locator("[data-xem-truoc-youtube]").innerText()));
  check("vùng kéo-thả có nút 'Chọn tệp' thật", (await pg.locator("[data-o-tha]").count()) === 1 && (await pg.locator("[data-tai-lieu]").getByRole("button", { name: /Chọn tệp/ }).count()) >= 1);
  await pg.getByRole("button", { name: 'Gỡ "Đề cương (thử)"' }).click();
  const ask = pg.getByRole("alertdialog").or(pg.getByRole("dialog", { name: "Gỡ tài liệu này?" }));
  await ask.first().waitFor({ timeout: 10000 });
  check("'Gỡ' tài liệu có hỏi lại (tài liệu còn nguyên khi đang hỏi)", (await pg.locator("[data-tai-lieu-hang]").count()) === 1);
  await ask.first().getByRole("button", { name: "Gỡ", exact: true }).click();
  check("xác nhận ⇒ hàng tài liệu mất", (await pg.locator("[data-tai-lieu-hang]").count()) === 0);
  await pg.locator("#ls-ten").fill("Căn bậc hai và rút gọn (đã sửa)");
  await pg.locator('[data-tu-luu="xong"]').waitFor({ timeout: 30000 });
  const saved = await prisma.lesson.findUnique({ where: { id: L1.id } });
  check("tự lưu: 'Đã tự lưu lúc HH:MM' + DB đổi tên, tài liệu đã gỡ", /Đã tự lưu lúc \d{2}:\d{2}/.test(await pg.locator("[data-tu-luu]").innerText()) && saved?.title === "Căn bậc hai và rút gọn (đã sửa)" && saved?.documents === "[]", saved);
  check("hàng bài ở cột trái cập nhật tên mới", (await row1.locator("[data-bai-ten]").innerText()) === "Căn bậc hai và rút gọn (đã sửa)");
  await snap(pg, "gs-trang-lop-1280-sua");

  section("1280 · rời ngăn không mất chữ (QUYET-DINH 4.2 #7) + tự lưu không đua");
  await pg.locator("#ls-ten").fill("Gõ rồi đổi bài ngay");
  await row2.getByRole("button", { name: `Chi tiết bài ${L2.title}` }).click(); // trước 1,5 giây
  await pg.waitForFunction((t: string) => (document.querySelector("#ls-ten") as HTMLInputElement | null)?.value === t, L2.title, { timeout: 30000 });
  check("gõ rồi bấm bài khác ngay ⇒ chữ vừa gõ đã lưu trước khi đổi bài", (await prisma.lesson.findUnique({ where: { id: L1.id } }))?.title === "Gõ rồi đổi bài ngay");
  await pg.locator("#ls-ten").fill("Gõ rồi Đóng ngay");
  await region.getByRole("button", { name: "Đóng", exact: true }).click();
  await pg.locator("[data-ngan-trong]").waitFor({ timeout: 30000 });
  check("gõ rồi bấm Đóng ngay ⇒ DB có chữ mới, ngăn mới đóng", (await prisma.lesson.findUnique({ where: { id: L2.id } }))?.title === "Gõ rồi Đóng ngay");
  await row2.getByRole("button", { name: /^Chi tiết bài / }).click();
  await pg.locator("#ls-ten").waitFor();
  await pg.route("**/api/lessons/*", async r => { if (r.request().method() === "PUT") await new Promise(res => setTimeout(res, 3000)); await r.continue(); });
  await pg.locator("#ls-ten").fill("Đua lần 1");
  await pg.locator('[data-tu-luu="dang"]').waitFor({ timeout: 15000 });
  await pg.locator("#ls-ten").fill("Đua lần 2"); // sửa tiếp khi PUT trước còn chạy
  await pg.waitForFunction(() => document.querySelector("[data-tu-luu]")?.getAttribute("data-tu-luu") === "xong" && (document.querySelector("#ls-ten") as HTMLInputElement).value === "Đua lần 2", undefined, { timeout: 30000 });
  let raced = "";
  for (let k = 0; k < 20 && raced !== "Đua lần 2"; k++) { await new Promise(r => setTimeout(r, 300)); raced = (await prisma.lesson.findUnique({ where: { id: L2.id } }))?.title ?? ""; }
  check("tự lưu đua: 'Đã tự lưu' chỉ hiện khi bản CUỐI đã lên máy chủ (DB = 'Đua lần 2')", raced === "Đua lần 2", raced);
  await pg.unroute("**/api/lessons/*");

  section("1280 · lớp hai phần: tầng Phần hiện");
  await pg.goto(classUrl(B.id), { waitUntil: "networkidle", timeout: 170000 });
  await pg.getByRole("region", { name: /Sửa bài/ }).waitFor({ timeout: 90000 });
  check("lớp B (2 phần): thấy tên phần", (await pg.getByText("Phần cơ học (thử)").filter({ visible: true }).count()) === 1 && (await pg.getByText("Phần điện học (thử)").filter({ visible: true }).count()) === 1);
  check("lớp B không có việc ⇒ 'Cần bạn xử lý' nói bằng chữ", (await pg.locator("[data-can-xu-ly-trong]:visible").count()) === 1);

  section("1280 · Hộp việc gom mọi lớp");
  await pg.goto(`${BASE}/lop-cua-toi/hop-viec`, { waitUntil: "networkidle", timeout: 170000 });
  const grp = pg.locator(`[data-hop-viec-lop="${A.id}"]`);
  await grp.waitFor({ timeout: 90000 });
  const gt = await grp.locator("a[data-kin-list-row]").allInnerTexts();
  check("nhóm lớp A: Bài chờ chấm · Điểm chờ duyệt · Xin vào lớp · Buổi tới chưa có video", gt.length === 4 && /Bài chờ chấm/.test(gt[0]) && /Điểm chờ duyệt/.test(gt[1]) && /Xin vào lớp/.test(gt[2]) && /Buổi tới chưa có video/.test(gt[3]), gt);
  check("tiêu đề tóm tắt '3 việc ở 1 lớp'", (await pg.getByText("3 việc ở 1 lớp").count()) >= 1);
  check("lớp không việc ghi một dòng", /Vật lý 9 · Lớp thử B không có việc nào/.test(await pg.locator("[data-hop-viec-trong]").innerText()));
  const p2 = await primaries(pg);
  check("Hộp việc: MỘT nút chính '+ Giao bài' (cùng chỗ trang lớp)", p2.length === 1 && p2[0] === "+ Giao bài", p2);
  check("thanh bên: 'Hộp việc' sáng", /Hộp việc/.test(await pg.locator("nav[aria-label='Module của gia sư']:visible [aria-current=page]").first().innerText()));
  check("Hộp việc 1280 không tràn ngang", await overflowX(pg) <= 0);
  await snap(pg, "gs-hop-viec-1280");

  section("390 · gia sư điện thoại");
  const m = await (await ctxFor(T, { width: 390, height: 844 })).newPage(); watch(m);
  await m.goto(`${BASE}/lop-cua-toi/hop-viec`, { waitUntil: "networkidle", timeout: 170000 });
  await m.locator("[data-hop-viec-dt]").waitFor({ timeout: 90000 });
  const bar = m.locator("nav[aria-label='Module của gia sư']:visible").last();
  const barItems = (await bar.locator("a, button").allInnerTexts()).map(x => x.replace(/\d+/g, "").trim());
  check("thanh dưới đúng 3 mục: Hộp việc / Lớp / Tôi", barItems.join("|") === "Hộp việc|Lớp|Tôi", barItems);
  const dock = m.locator("[data-cham-dock] button");
  const joinRow = m.locator("[data-xin-vao]").first();
  const jb = await joinRow.boundingBox(), nb = await joinRow.getByRole("button", { name: `Nhận ${S4.name} vào lớp` }).boundingBox(), tb = await joinRow.getByRole("button", { name: `Từ chối ${S4.name}` }).boundingBox();
  check("hàng 'Xin vào lớp': 'Từ chối' + 'Nhận' ngay trên hàng, bên phải, cùng một dòng", !!jb && !!nb && !!tb && Math.abs(nb.y - tb.y) < 2 && nb.x > tb.x && nb.x > jb.x + jb.width / 2, { jb, nb, tb });
  check("học sinh đã rời lớp: không hiện ở Hộp việc điện thoại", (await m.getByText("Đã Rời (thử)").count()) === 0);
  check("nút chính điện thoại 'Chấm 1 bài đang chờ' ≥ 48px", (await dock.innerText()) === "Chấm 1 bài đang chờ" && ((await dock.boundingBox())?.height ?? 0) >= 47.5);
  check("390 Hộp việc không tràn ngang", await overflowX(m) <= 0, await overflowX(m));
  await snap(m, "gs-hop-viec-390");
  // Duyệt điểm chờ
  await m.getByRole("button", { name: `Duyệt điểm của ${S[2].name}` }).click();
  await m.waitForURL(/\/lop-cua-toi\/hop-viec\?ghi=da-duyet/, { timeout: 60000 });
  const er = await prisma.examResult.findFirst({ where: { examId: `az-${stamp}`, userId: S[2].id } });
  check("duyệt điểm tại Hộp việc ⇒ DB hết chờ duyệt, về lại Hộp việc có câu báo", er?.pendingReview === false && (await m.locator("[data-hop-viec-ghi]").count()) === 1);
  // Chấm một bài
  await m.locator("[data-hop-viec-dt] details[data-cham-hang] summary").first().click();
  await m.locator("[data-hop-viec-dt] details[data-cham-hang] input[name=score]").fill("9");
  const fsz = await m.locator("[data-hop-viec-dt] details[data-cham-hang] input[name=score]").evaluate(e => getComputedStyle(e).fontSize);
  check("ô điểm 16px trên điện thoại", fsz === "16px", fsz);
  await m.getByRole("button", { name: "Lưu điểm" }).click();
  await m.waitForURL(/\/lop-cua-toi\/hop-viec\?ghi=/, { timeout: 60000 });
  const sub = await prisma.assignmentSubmission.findFirst({ where: { assignmentId: asg.id, userId: S[0].id } });
  check("chấm bài tại Hộp việc ⇒ DB có điểm 9, về lại Hộp việc", sub?.score === 9 && /\/lop-cua-toi\/hop-viec/.test(m.url()));
  // Nhận học sinh
  await m.getByRole("button", { name: `Nhận ${S4.name} vào lớp` }).click();
  await m.waitForURL(/\/lop-cua-toi\/hop-viec/, { timeout: 60000 });
  await m.waitForLoadState("networkidle");
  const jr = await prisma.classJoinRequest.findFirst({ where: { courseId: A.id, userId: S4.id } });
  check("nhận học sinh tại Hộp việc ⇒ DB approved + học sinh vào lớp", jr?.status === "approved" && (await prisma.enrollment.count({ where: { courseId: A.id, userId: S4.id, status: "active" } })) === 1, jr);
  check("hết việc ⇒ nói bằng chữ, không còn nút dock", (await m.getByText(/Chưa có việc nào cần xử lý/).count()) === 1 && (await m.locator("[data-cham-dock]").count()) === 0);
  await snap(m, "gs-hop-viec-390-xong");
  // Trang lớp 390: không tràn, ngăn sửa vẫn là hộp thoại
  await m.goto(classUrl(A.id), { waitUntil: "networkidle", timeout: 170000 });
  await m.locator(`[data-bai="${L2.id}"]`).waitFor({ timeout: 90000 });
  check("390 trang lớp không tràn ngang", await overflowX(m) <= 0, await overflowX(m));
  check("390 trang lớp: mục 'Lớp' của thanh dưới sáng", /Lớp/.test(await m.locator("nav[aria-label='Module của gia sư']:visible").last().locator("[aria-current=page]").innerText()));
  check("390: ngăn sửa chưa mở sẵn (soạn bài không bắt buộc trên điện thoại)", (await m.locator("[role=dialog][aria-modal=true]:visible").count()) === 0);
  await snap(m, "gs-trang-lop-390");

  section("360 · không tràn ngang");
  const m3 = await (await ctxFor(T, { width: 360, height: 780 })).newPage(); watch(m3);
  for (const [url, name] of [[classUrl(A.id), "gs-trang-lop-360"], [`${BASE}/lop-cua-toi/hop-viec`, "gs-hop-viec-360"]] as const) {
    await m3.goto(url, { waitUntil: "networkidle", timeout: 170000 });
    check(`360 ${name}: không tràn ngang`, await overflowX(m3) <= 0, await overflowX(m3));
    await snap(m3, name);
  }

  check("không có lỗi trang", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll(); process.exit(1); });
