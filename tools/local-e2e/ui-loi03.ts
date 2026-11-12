// LOI-03 mục 6.3 — lớp của học sinh, trình duyệt thật, 1600 và 390 (ảnh: scratchpad/shots/loi03-*.png):
//   thư viện lớp /student/hoc-tap (thẻ, ảnh bìa / ô chữ, nhãn chữ, vòng %, "Học tiếp →" đúng bài ĐANG XEM DỞ, lọc 3 nút + đếm, không "Lịch học"/"Học phí" trên thẻ, 1 lớp vẫn ở thư viện)
//   → bấm tên lớp → trang lớp (h1 tên lớp, tab Nội dung mặc định, "Nội dung lớp: 2 chương · 6 bài", "01"/"02", Mở rộng tất cả / Thu gọn tất cả, gập/mở chương,
//     dòng bài "1 tài liệu · Có bài tập · Học Hôm nay · 19:30"; 390: thẻ tiến độ TRÊN dải tab; Tổng quan có "Phiếu học phí của bạn →" không số tiền)
//   → bấm bài → tab Bài tập: vùng thả là khối đầu tiên của thẻ bài tập (ngay sau tiêu đề), cao ≥ 200px; kho chưa bật ⇒ "Kho tệp chưa bật", không vùng thả, trang còn nguyên
//   → /student/viec-cua-toi: [data-hom-nay] có bài 19:30 (không bài NHÁP), tài liệu mở tab mới, "Sắp tới" có "Ngày mai · 00:30"; em không có bài hẹn ⇒ không có [data-hom-nay];
//     /api/student/hom-nay trả 500 ⇒ ErrorStrip + Thử lại. /lop-cua-toi (học sinh) = thư viện; /lop-cua-toi/<X> ⇒ /student/hoc-tap?course=<X> (307).
//   390: không cuộn ngang ở mọi màn; nút / hàng trong các khối LOI-03 cao ≥ 44px.
//   Rà soát lượt 1: cảnh báo [data-nop-tep-canh-bao] TRÊN nút Nộp bài; gia sư chủ lớp / quản trị mở /lop-cua-toi/<X> vẫn như cũ (quan-lop / trang lớp), không sang /student/hoc-tap.
//   Vòng test 2: có bài hẹn hôm nay mà chưa có buổi học ⇒ /student/viec-cua-toi không "3 ngày tới chưa có buổi học", trang lớp không "chưa có buổi học nào trong 90 ngày tới".
//   Thẻ tiến độ: "Hỏi gia sư trong lớp →" [data-hoi-trong-lop] → /cong-dong?scope=<lớp> chỉ cho học sinh đang học lớp (≥ 44px ở 390); không ghi danh / khách: không có.
// LOI-07 (nợ P3 LOI-03): (1) phiếu "Hôm nay có lớp" còn đang tải ⇒ cột "Buổi học tiếp theo" là khung xương, KHÔNG chớp "3 ngày tới chưa có buổi học";
//   (2) bài hẹn 4 tháng nữa (ngoài khung 90 ngày) KHÔNG làm ẩn khối "Buổi học sắp tới"; (3) không giấu lỗi: /api/schedule 500 ⇒ khối lịch hiện dải lỗi + Thử lại,
//   /api/student/hom-nay 500 / 403 ⇒ cột buổi học vẫn hiện (không bị ẩn theo phiếu); (4) 1600: thẻ tiến độ và cột phải không hở quá khoảng cách lưới (≤ 40px).
//   Ca phá cố ý (đã chạy, rồi hoàn lại): ViecCuaToi `useState<boolean | null>(null)` → `useState(false)` ⇒ ca (1) đỏ; LopCuaToi dùng lại `vnDateKeyOf(at) >= todayKey` (không cận trên)
//   ⇒ ca (2) đỏ; bỏ `lg:grid-rows-[auto_1fr]` ⇒ ca (4) đỏ (đo được khoảng hở > 40px).
// Dữ liệu tự tạo (wipe() trên DB riêng của worktree). Ngày giờ "hôm nay" theo giờ VN lúc chạy (instantOf) — chạy sát 00:00 VN có thể đỏ giả, chạy lại.
// Ảnh bìa: địa chỉ https giả, trình duyệt được chặn route trả về một ảnh PNG 1×1 (không ra mạng ngoài). Kho tệp: chặn danh-sach trả enabled:true / false để kiểm trình bày
// độc lập với cấu hình kho của máy.
import { BASE, mkTutor, mkSuper, mkUser, mkCourse, wipe, check, section, done, api, eventually } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";
import { addDaysKey, instantOf, vnDateKeyOf } from "@/lib/classSessions";
import { legacyClassTarget } from "@/lib/tutorClassRoutes";

const COVER = "https://bia-lop-loi03.example/toan9.png";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const LIMITS = { maxBytes: 10485760, maxFiles: 3, exts: ["docx", "pdf"], retentionDays: 60 };
const NOT_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth`;

(async () => {
  await wipe();
  const today = vnDateKeyOf(new Date());
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });       // 2 lớp: Toán (đang học, có bài hẹn) + Văn (xong hết)
  const S1 = await mkUser({ name: "Một Lớp" });       // 1 lớp: Văn, không bài hẹn
  const S2 = await mkUser({ name: "Hẹn Xa" });        // LOI-07: 1 lớp có bài hẹn 120 ngày nữa (ngoài khung 90 ngày)
  const X = await mkCourse(T.id, { name: "Toán 9 (LOI-03)" });
  const Y = await mkCourse(T.id, { name: "Văn 9 (LOI-03)" });
  await prisma.course.update({ where: { id: X.id }, data: { status: true, instructor: "Cô Lan", category: "Toán", bg: `url("${COVER}")` } });
  await prisma.course.update({ where: { id: Y.id }, data: { status: true, instructor: "Cô Lan", category: "Ngữ văn", bg: "linear-gradient(90deg, var(--a), var(--b))" } });
  for (const [u, c, i] of [[S, X, 0], [S, Y, 1], [S1, Y, 0]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active", createdAt: new Date(Date.now() - (5 - i) * 60_000) } });

  // Toán: 2 chương × 3 bài + 1 bài NHÁP hẹn hôm nay (không được lộ ở đâu). Bài 3 hẹn hôm nay 19:30 VN, có 1 tài liệu + 1 link Azota + 1 bài tập nộp tệp.
  await prisma.section.create({ data: { id: `sx-${X.id}`, title: "Phần 1", order: 1, courseId: X.id } });
  const chs = [`cx1-${X.id}`, `cx2-${X.id}`];
  await prisma.chapter.create({ data: { id: chs[0], title: "Căn thức", order: 1, sectionId: `sx-${X.id}` } });
  await prisma.chapter.create({ data: { id: chs[1], title: "Phương trình bậc hai", order: 2, sectionId: `sx-${X.id}` } });
  const L = (n: number) => `lx${n}-${X.id}`;
  const DOC = JSON.stringify([{ name: "Đề cương Vi-ét.pdf", url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", type: "pdf" }]);
  const lessons: [number, string, number, Record<string, unknown>][] = [
    [1, "Bài 1: Căn bậc hai", 0, {}],
    [2, "Bài 2: Hằng đẳng thức", 0, {}],
    [3, "Bài 3: Hệ thức Vi-ét", 0, { scheduledAt: instantOf(today, 19 * 60 + 30), documents: DOC, azotaUrl: "https://azota.vn/de-thi/loi03vi" }],
    [4, "Bài 4: Công thức nghiệm", 1, { scheduledAt: instantOf(today, 23 * 60 + 30) }],
    [5, "Bài 5: Nghiệm thu gọn", 1, { scheduledAt: instantOf(addDaysKey(today, 1), 30) }],
    [6, "Bài 6: Ôn tập chương", 1, { scheduledAt: instantOf(addDaysKey(today, 3), 19 * 60) }],
  ];
  for (const [n, title, ci, extra] of lessons) await prisma.lesson.create({ data: { id: L(n), code: L(n), title, type: "document", order: n, chapterId: chs[ci], ...extra } });
  await prisma.lesson.create({ data: { id: `lx-nhap-${X.id}`, code: `lx-nhap-${X.id}`, title: "NHAP-BI-MAT-LOI03", type: "document", order: 9, chapterId: chs[1], status: "draft", scheduledAt: instantOf(today, 20 * 60) } });
  const HW = await prisma.assignment.create({ data: { lessonId: L(3), title: "Bài tập Vi-ét", instructions: "Làm 5 câu trong đề cương, nộp bản Word hoặc PDF.", dueDate: new Date(Date.now() + 3 * 86_400_000) } });
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: L(1), completed: true, watchedSeconds: 300 } });
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: L(2), completed: false, watchedSeconds: 120 } }); // ĐANG XEM DỞ ⇒ "Học tiếp" phải là bài 2
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: `lx-nhap-${X.id}`, completed: true, watchedSeconds: 10 } }); // tiến độ trên bài nháp: KHÔNG được đếm

  // Văn: 1 chương, 2 bài, em đã xong cả hai ⇒ "Hoàn thành", nút "Xem lại →".
  await prisma.section.create({ data: { id: `sy-${Y.id}`, title: "Phần 1", order: 1, courseId: Y.id } });
  await prisma.chapter.create({ data: { id: `cy-${Y.id}`, title: "Văn bản", order: 1, sectionId: `sy-${Y.id}` } });
  for (const n of [1, 2]) {
    await prisma.lesson.create({ data: { id: `ly${n}-${Y.id}`, code: `ly${n}-${Y.id}`, title: `Văn bài ${n}`, type: "document", order: n, chapterId: `cy-${Y.id}` } });
    await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: `ly${n}-${Y.id}`, completed: true, watchedSeconds: 60 } });
  }

  // LOI-07: lớp chỉ có một bài Đã đăng hẹn ngày học 120 ngày nữa, không khung giờ / buổi học nào.
  const W = await mkCourse(T.id, { name: "Lý 9 hẹn xa (LOI-07)" });
  await prisma.course.update({ where: { id: W.id }, data: { status: true, instructor: "Cô Lan", category: "Vật lý" } });
  await prisma.section.create({ data: { id: `sw-${W.id}`, title: "Phần 1", order: 1, courseId: W.id } });
  await prisma.chapter.create({ data: { id: `cw-${W.id}`, title: "Cơ học", order: 1, sectionId: `sw-${W.id}` } });
  await prisma.lesson.create({ data: { id: `lw-${W.id}`, code: `lw-${W.id}`, title: "Bài hẹn xa", type: "document", order: 1, chapterId: `cw-${W.id}`, scheduledAt: instantOf(addDaysKey(today, 120), 19 * 60) } });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: W.id, status: "active" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 400)}`); });
  };
  const open = async (u: typeof S | null, w: number, path: string) => {
    const c = await ctxFor(u, { width: w, height: w <= 400 ? 844 : 1000 });
    const p = await c.newPage(); watch(p);
    await p.route(`${COVER}*`, r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
    return { c, p };
  };
  const small = (p: Page, scope: string) => p.evaluate(`[...document.querySelectorAll(${JSON.stringify(scope)})].filter(e => e.offsetParent && !e.closest('[inert]') && !e.closest('[data-kin-tab-ink]') && e.getBoundingClientRect().width > 0).map(e => [Math.round(e.getBoundingClientRect().height), (e.textContent || '').trim().slice(0, 30)]).filter(([h]) => h < 44)`) as Promise<[number, string][]>;

  for (const w of [1600, 390]) {
    // ═════════ Thư viện lớp ═════════
    section(`${w}px · thư viện lớp /student/hoc-tap`);
    const { c, p } = await open(S, w, "/student/hoc-tap");
    await p.locator("[data-class-catalog]").waitFor({ timeout: 120000 });
    await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    check("h1 'Lớp của tôi', dòng phụ 'Bạn đang học 2 lớp.'", await p.getByRole("heading", { level: 1, name: "Lớp của tôi" }).isVisible() && await p.getByText("Bạn đang học 2 lớp.").isVisible());
    const cards = p.locator("[data-class-card]");
    check("2 thẻ theo thứ tự vào lớp: Toán rồi Văn", (await cards.evaluateAll(els => els.map(e => e.getAttribute("data-class-card")))).join() === [X.id, Y.id].join());
    const cx = p.locator(`[data-class-card="${X.id}"]`), cy = p.locator(`[data-class-card="${Y.id}"]`);
    const tx = (await cx.innerText()).replace(/\s+/g, " "), ty = (await cy.innerText()).replace(/\s+/g, " ");
    check("Toán: ảnh bìa <img> https (alt rỗng), nhãn chữ 'Đang học', 'Gia sư: Cô Lan · Toán', 'Đã hoàn thành 1/6 bài' (bài nháp KHÔNG đếm)",
      (await cx.locator(`img[src="${COVER}"][alt=""]`).count()) === 1 && /Đang học/.test(tx) && /Gia sư: Cô Lan · Toán/.test(tx) && /Đã hoàn thành 1\/6 bài/.test(tx), tx);
    check("Toán: thanh tiến độ role=progressbar aria-valuenow=16; vòng % có nhãn 'Hoàn thành 16%' và chữ '16%'",
      (await cx.getByRole("progressbar").getAttribute("aria-valuenow")) === "16" && (await cx.getByRole("img", { name: /Hoàn thành 16%/ }).count()) === 1 && /16%/.test(tx));
    const ht = cx.locator("[data-hoc-tiep]");
    check("Toán: nút 'Học tiếp →' trỏ đúng bài ĐANG XEM DỞ (bài 2), không phải bài chưa học đầu tiên", (await ht.innerText()).trim() === "Học tiếp →" && (await ht.getAttribute("href")) === `/student/bai-giang/${L(2)}`, await ht.getAttribute("href"));
    check("Văn: không ảnh bìa ⇒ ô chữ tên lớp [data-lop-bia-chu]; nhãn 'Hoàn thành'; nút 'Xem lại →' về bài đầu", (await cy.locator("img").count()) === 0 && (await cy.locator("[data-lop-bia-chu]").count()) === 1 && /Hoàn thành/.test(ty) && (await cy.locator("[data-hoc-tiep]").innerText()).trim() === "Xem lại →" && (await cy.locator("[data-hoc-tiep]").getAttribute("href")) === `/student/bai-giang/ly1-${Y.id}`, ty);
    const catHtml = await p.locator("[data-class-catalog]").innerHTML();
    check("trên thẻ KHÔNG có 'Lịch học' / 'Học phí' / số tiền / 'lượt xem' / 'Đánh giá' / mã hex", !/Lịch học|Học phí|lượt xem|Đánh giá|\d\s*(đ|₫)\b/.test(await p.locator("[data-class-catalog]").innerText()) && !/href="\/student\/(lich-hoc|hoc-phi)"/.test(catHtml) && !/#[0-9a-f]{3,8}\b/i.test(catHtml));
    const fl = (k: string) => p.locator(`[data-loc-lop="${k}"]`);
    check("hàng lọc role=group 'Lọc lớp': Tất cả (2) · Đang học (1) · Hoàn thành (1), 'Tất cả' aria-pressed", (await p.getByRole("group", { name: "Lọc lớp" }).count()) === 1 && /Tất cả\s*\(2\)/.test(await fl("tat-ca").innerText()) && /Đang học\s*\(1\)/.test(await fl("dang-hoc").innerText()) && /Hoàn thành\s*\(1\)/.test(await fl("hoan-thanh").innerText()) && (await fl("tat-ca").getAttribute("aria-pressed")) === "true");
    await fl("hoan-thanh").click();
    await eventually("lọc 'Hoàn thành' → chỉ còn Văn (lọc ở trình duyệt)", async () => (await cards.count()) === 1 && (await cy.count()) === 1 && (await fl("hoan-thanh").getAttribute("aria-pressed")) === "true", 8000);
    await fl("dang-hoc").click();
    await eventually("lọc 'Đang học' → chỉ còn Toán", async () => (await cards.count()) === 1 && (await cx.count()) === 1, 8000);
    await fl("tat-ca").click();
    await eventually("'Tất cả' → lại đủ 2 thẻ", async () => (await cards.count()) === 2, 8000);
    // LOI-01: khối "Tự học" chỉ hiện khi cờ TIENG_ANH mở; mặc định ẩn.
    check(`dưới danh sách: 'Tham gia lớp khác' (Nhập mã lớp) + 'Tự học' ${featureOn("TIENG_ANH") ? "hiện" : "ẩn (cờ TIENG_ANH tắt)"}`, await p.getByRole("heading", { name: "Tham gia lớp khác" }).isVisible() && (await p.getByRole("heading", { name: "Tự học" }).isVisible()) === featureOn("TIENG_ANH") && (await p.getByRole("link", { name: "Nhập mã lớp" }).count()) === 1);
    if (w === 390) {
      check("390: không cuộn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
      const s = await small(p, "main a, main button");
      check("390: mọi nút / liên kết trong trang cao ≥ 44px (thẻ lớp, lọc, Học tiếp)", s.length === 0, s.slice(0, 5));
      const b = await ht.boundingBox(), cb = await cx.boundingBox();
      check("390: 'Học tiếp →' rộng gần hết thẻ", !!b && !!cb && b.width >= cb.width - 2 * 24, { b, cb });
    }
    await shot(p, `loi03-thu-vien-${w}`);

    // ═════════ Trang lớp ═════════
    section(`${w}px · bấm tên lớp → trang lớp`);
    await cx.getByRole("link", { name: "Toán 9 (LOI-03)", exact: true }).click();
    await p.waitForURL(u => u.pathname === "/student/hoc-tap" && u.searchParams.get("course") === X.id, { timeout: 90000 });
    await p.locator("[data-outline-chapter]").first().waitFor({ timeout: 120000 });
    check("h1 = tên lớp; dòng phụ 'Toán · Gia sư: Cô Lan'; có '← Lớp của tôi'", await p.getByRole("heading", { level: 1, name: "Toán 9 (LOI-03)" }).isVisible() && await p.getByText("Toán · Gia sư: Cô Lan").isVisible() && await p.locator("[data-all-classes]").isVisible());
    check("2 tab Tổng quan · Nội dung, mặc định Nội dung", (await p.getByRole("tab").allInnerTexts()).map(s => s.trim()).join("|") === "Tổng quan|Nội dung" && (await p.getByRole("tab", { name: "Nội dung" }).getAttribute("aria-selected")) === "true");
    check("'Nội dung lớp: 2 chương · 6 bài' (bài nháp không đếm, tên bài nháp không lộ)", (await p.locator("[data-noi-dung-tom-tat]").innerText()).trim() === "Nội dung lớp: 2 chương · 6 bài" && !(await p.content()).includes("NHAP-BI-MAT"));
    check("số thứ tự chương '01', '02'", (await p.locator("[data-chapter-no]").allInnerTexts()).join() === "01,02");
    const hero = p.locator("[data-course-hero]");
    check("thẻ tiến độ: 'Bạn đã hoàn thành 1/6 bài', nút 'Học tiếp →' → bài 2 (đang xem dở), có 'Tài liệu & bản ghi của lớp này →'", /Bạn đã hoàn thành 1\/6 bài/.test(await hero.innerText()) && (await hero.locator("[data-hoc-tiep]").getAttribute("href")) === `/student/bai-giang/${L(2)}` && (await hero.locator("[data-hoc-tiep]").innerText()).trim() === "Học tiếp →" && await p.locator("[data-thu-vien-link]").isVisible());
    const hoi = hero.locator("[data-hoi-trong-lop]");
    check("thẻ tiến độ (đang học): 'Hỏi gia sư trong lớp →' [data-hoi-trong-lop] → /cong-dong?scope=<mã lớp>, thấy được", (await hoi.count()) === 1 && await hoi.isVisible() && (await hoi.innerText()).trim() === "Hỏi gia sư trong lớp →" && (await hoi.getAttribute("href")) === `/cong-dong?scope=${encodeURIComponent(X.id)}`, await hoi.getAttribute("href"));
    if (w === 390) { const hb = await hoi.boundingBox(); check("390: 'Hỏi gia sư trong lớp →' cao ≥ 44px", !!hb && hb.height >= 44, hb); }
    const chap = (i: number) => p.locator(`[data-outline-chapter="${chs[i]}"]`);
    check("chương chứa bài kế (chương 01) mở sẵn, chương 02 thu", (await chap(0).getAttribute("aria-expanded")) === "true" && (await chap(1).getAttribute("aria-expanded")) === "false");
    await p.locator("[data-outline-open-all]").click();
    check("'Mở rộng tất cả' → cả 2 chương mở", (await p.locator("[data-outline-open-all]").innerText()).trim() === "Mở rộng tất cả" && (await chap(0).getAttribute("aria-expanded")) === "true" && (await chap(1).getAttribute("aria-expanded")) === "true");
    const meta3 = (await p.locator(`[data-outline-lesson="${L(3)}"] [data-lesson-meta]`).innerText()).trim();
    check("dòng bài 3: '1 tài liệu · Có bài tập · Học Hôm nay · 19:30'", meta3 === "1 tài liệu · Có bài tập · Học Hôm nay · 19:30", meta3);
    check("dòng bài 5: '… Học Ngày mai · 00:30'; bài không có dữ liệu thì không dòng phụ (bài 1)", /Học Ngày mai · 00:30/.test(await p.locator(`[data-outline-lesson="${L(5)}"]`).innerText()) && (await p.locator(`[data-outline-lesson="${L(1)}"] [data-lesson-meta]`).count()) === 0);
    check("nhãn chữ: bài 1 'Đã học', bài 2 'Học tiếp', bài 4 'Chưa học'", await p.locator(`[data-outline-lesson="${L(1)}"]`).getByText("Đã học").isVisible() && await p.locator(`[data-outline-lesson="${L(2)}"]`).getByText("Học tiếp").isVisible() && await p.locator(`[data-outline-lesson="${L(4)}"]`).getByText("Chưa học").isVisible());
    // Vòng test 2 (mâu thuẫn): lớp có bài hẹn hôm nay nhưng chưa có khung giờ / buổi học ⇒ KHÔNG có khối "Buổi học sắp tới" nói "chưa có buổi học nào trong 90 ngày tới".
    await eventually(`${w}: trang lớp có bài hẹn hôm nay ⇒ không có [data-course-sessions] / 'chưa có buổi học nào trong 90 ngày tới'`, async () =>
      (await p.locator("[data-course-sessions]").count()) === 0 && (await p.getByText("chưa có buổi học nào trong 90 ngày tới").count()) === 0, 30000);
    await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    check(`${w}: sau khi lịch tải xong vẫn không có 'chưa có buổi học nào trong 90 ngày tới'; dòng bài vẫn ghi 'Học Hôm nay · 19:30'`,
      (await p.getByText("chưa có buổi học nào trong 90 ngày tới").count()) === 0 && (await p.locator("[data-course-sessions]").count()) === 0 && /Học Hôm nay · 19:30/.test(await p.locator(`[data-outline-lesson="${L(3)}"]`).innerText()));
    await p.locator("[data-outline-close-all]").click();
    check("'Thu gọn tất cả' → cả 2 chương thu", (await chap(0).getAttribute("aria-expanded")) === "false" && (await chap(1).getAttribute("aria-expanded")) === "false");
    await chap(1).click();
    check("bấm chương 02 → mở (aria-expanded=true)", (await chap(1).getAttribute("aria-expanded")) === "true");
    await chap(0).click();
    if (w === 390) {
      const hb = await hero.boundingBox(), tb = await p.getByRole("tablist").boundingBox();
      check("390: thẻ tiến độ nằm TRÊN dải tab", !!hb && !!tb && hb.y + hb.height <= tb.y + 1, { hb, tb });
      check("390: không cuộn ngang (trang lớp, cây mở)", await p.evaluate(NOT_OVERFLOW) as boolean);
      const s = await small(p, "main a, main button, main [role=tab]");
      check("390: mọi nút / hàng / tab cao ≥ 44px", s.length === 0, s.slice(0, 5));
    } else {
      const hb = await hero.boundingBox(), tb = await p.getByRole("tablist").boundingBox();
      check("1600: thẻ tiến độ ở cột phải (bên phải dải tab)", !!hb && !!tb && hb.x > tb.x + tb.width - 2, { hb, tb });
    }
    await p.waitForTimeout(600); // đợi chương gập xong (KinFold có chuyển động) rồi mới chụp
    await shot(p, `loi03-lop-noi-dung-${w}`);
    await p.getByRole("tab", { name: "Tổng quan" }).click();
    const info = p.getByRole("region", { name: "Thông tin lớp" });
    await info.waitFor({ timeout: 30000 });
    const infoText = await info.innerText();
    check("Tổng quan: 'Phiếu học phí của bạn →' → /student/hoc-phi, khối không có chữ số tiền / 'đ'", (await info.getByRole("link", { name: "Phiếu học phí của bạn →" }).getAttribute("href")) === "/student/hoc-phi" && !/\d\s*(đ|₫|VND)|\bđ\b/.test(infoText), infoText);
    check("Tổng quan: có 'Tài liệu & bản ghi' (data-materials-tab) và 'Bài tập của lớp'; KHÔNG có 'Đánh giá'", await p.locator("[data-materials-tab]").isVisible() && await p.getByRole("heading", { name: "Bài tập của lớp" }).isVisible() && (await p.getByText("Đánh giá").count()) === 0);
    {
      // LOI-07 (4): cột trái (Tổng quan, cao) span 2 hàng; trước đây phần thừa chia cả vào hàng 1 ⇒ hở ~100px giữa thẻ tiến độ và cột phải.
      const asideL = p.locator("[data-lop-aside]");
      await asideL.waitFor({ timeout: 30000 });
      const hb = await hero.boundingBox(), ab = await asideL.boundingBox(), lb = await p.locator("#lop-panel").boundingBox();
      if (w === 1600) {
        const gap = !!hb && !!ab ? Math.round(ab.y - (hb.y + hb.height)) : -1;
        check(`1600: cột phải ngay dưới thẻ tiến độ — khoảng hở ${gap}px ≤ 40px (lưới gap 32px); cột trái cao hơn (điều kiện để ca có nghĩa)`, gap >= 0 && gap <= 40 && !!lb && lb.y + lb.height > ab!.y + ab!.height, { gap, hb, ab, lb });
      } else {
        check("390: cột phải (Các lớp của bạn) nằm DƯỚI nội dung tab, cùng mép trái; không cuộn ngang", !!ab && !!lb && ab.y >= lb.y + lb.height - 1 && Math.abs(ab.x - lb.x) < 4 && await p.evaluate(NOT_OVERFLOW) as boolean, { ab, lb });
      }
    }
    if (w === 390) check("390: Tổng quan không cuộn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
    await shot(p, `loi03-lop-tong-quan-${w}`);

    // ═════════ Bài → ô nộp tệp ═════════
    section(`${w}px · bấm bài → tab Bài tập: ô nộp tệp to, là khối đầu tiên của thẻ`);
    let storeOn = true;
    await p.route("**/api/media/nop-bai/danh-sach**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(storeOn ? { enabled: true, limits: LIMITS, retentionDays: 60, files: [], submission: null } : { enabled: false, reason: "Tính năng nộp tệp chưa bật.", limits: LIMITS, retentionDays: 60, files: [], submission: null }) }));
    await p.getByRole("tab", { name: "Nội dung" }).click();
    await p.locator("[data-outline-open-all]").click();
    await p.locator(`[data-outline-lesson="${L(3)}"]`).click();
    await p.waitForURL(u => u.pathname === `/student/bai-giang/${L(3)}`, { timeout: 90000 });
    await p.getByRole("heading", { level: 1, name: "Bài 3: Hệ thức Vi-ét" }).waitFor({ timeout: 120000 });
    await p.getByRole("button", { name: "Bài tập", exact: true }).first().click();
    const card = p.locator(`[data-bai-tap-the="${HW.id}"]`);
    const zone = card.locator("[data-nop-tep-vung-tha]");
    await zone.waitFor({ timeout: 60000 });
    const order = await card.evaluate(e => { const kids = [...e.children]; return { second: kids[1]?.hasAttribute("data-nop-tep") ?? false, guideAfter: (() => { const g = e.querySelector("[data-bai-tap-huong-dan]"), z = e.querySelector("[data-nop-tep]"); return !!g && !!z && !!(z.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING); })() }; });
    check("thẻ bài tập: ngay sau tiêu đề + hạn là khối nộp tệp; hướng dẫn / đề bài nằm SAU", order.second && order.guideAfter, order);
    const zb = await zone.boundingBox(), cardB = await card.boundingBox();
    check(`vùng thả là <button>, cao ≥ 200px, rộng gần hết thẻ`, (await zone.evaluate(e => e.tagName)) === "BUTTON" && !!zb && zb.height >= 200 && !!cardB && zb.width >= cardB.width - 2 * 24, { zb, cardB });
    check("chữ 'Kéo thả tệp Word hoặc PDF vào đây' + 'hoặc' + nút 'Chọn tệp' ≥ 44px; chú thích giới hạn giữ nguyên số (10 MB, 60 ngày, 3 tệp)",
      /Kéo thả tệp Word hoặc PDF vào đây/.test(await zone.innerText()) && /hoặc/.test(await zone.innerText()) && ((await card.locator("[data-nop-tep-chon]").boundingBox())?.height ?? 0) >= 44
      && /dưới 10 MB.*60 ngày.*Tối đa 3 tệp/.test(await card.locator("[data-nop-tep-chu-thich]").innerText()));
    // Rà soát lượt 1 (P2): cảnh báo thông tin cá nhân phải đọc được TRƯỚC khi chọn tệp / nộp — ngay dưới chú thích, TRÊN nút Nộp bài (thứ tự DOM + toạ độ y).
    const warn = card.locator("[data-nop-tep-canh-bao]"), nopBtn = card.locator("[data-nop-tep-nop]");
    const wb = await warn.boundingBox(), sb = await nopBtn.boundingBox();
    const warnFirst = await card.evaluate(e => { const w = e.querySelector("[data-nop-tep-canh-bao]"), b = e.querySelector("[data-nop-tep-nop]"); return !!w && !!b && !!(w.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
    check("cảnh báo 'Đừng ghi thông tin cá nhân…' [data-nop-tep-canh-bao] nằm TRÊN nút 'Nộp bài' (DOM trước, y nhỏ hơn)", (await warn.count()) === 1 && warnFirst && !!wb && !!sb && wb.y + wb.height <= sb.y + 1, { wb, sb, warnFirst });
    if (w === 390) {
      const nb = await card.locator("[data-nop-tep-nop]").boundingBox();
      check("390: nút 'Nộp bài' full-width, ≥ 44px; trang không cuộn ngang", !!nb && !!cardB && nb.height >= 44 && nb.width >= cardB.width - 2 * 40 && await p.evaluate(NOT_OVERFLOW) as boolean, { nb, cardB });
    }
    await shot(p, `loi03-nop-tep-${w}`);
    storeOn = false;
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByRole("heading", { level: 1, name: "Bài 3: Hệ thức Vi-ét" }).waitFor({ timeout: 120000 });
    await p.getByRole("button", { name: "Bài tập", exact: true }).first().click();
    const off = p.locator("[data-nop-tep-chua-bat]");
    await off.waitFor({ timeout: 60000 });
    check("kho chưa bật: tiêu đề 'Kho tệp chưa bật' + câu cũ 'Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota.' (role=status)", (await off.getAttribute("role")) === "status" && /Kho tệp chưa bật/.test(await off.innerText()) && /Tính năng nộp tệp chưa bật\. Bạn vẫn nộp được bằng link Azota\./.test(await off.innerText()));
    check("kho chưa bật: không vùng thả, không 'Nộp bài'; trang còn nguyên (tiêu đề bài, thẻ bài tập, khối Azota)", (await p.locator("[data-nop-tep-vung-tha]").count()) === 0 && (await p.locator("[data-nop-tep-nop]").count()) === 0 && await card.isVisible() && (await p.getByText(/Azota/).count()) > 0);
    await shot(p, `loi03-kho-tat-${w}`);
    await p.unroute("**/api/media/nop-bai/danh-sach**");

    // ═════════ Việc của tôi: phiếu Hôm nay có lớp ═════════
    section(`${w}px · /student/viec-cua-toi: phiếu 'Hôm nay có lớp'`);
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const hn = p.locator("[data-hom-nay]");
    await hn.waitFor({ timeout: 120000 });
    const row3 = hn.locator(`[data-hom-nay-bai="${L(3)}"]`);
    check("phiếu có tiêu đề 'Hôm nay có lớp'; hàng bài 3: giờ 19:30, tên lớp, tên bài là liên kết tới bài", await hn.getByRole("heading", { name: "Hôm nay có lớp" }).isVisible() && /19:30/.test(await row3.innerText()) && /Toán 9 \(LOI-03\)/.test(await row3.innerText()) && (await row3.getByRole("link", { name: "Bài 3: Hệ thức Vi-ét", exact: true }).getAttribute("href")) === `/student/bai-giang/${L(3)}`);
    check("hôm nay có bài 23:30 (bài 4); KHÔNG có bài NHÁP; KHÔNG có bài 5 (ngày mai) trong phần hôm nay", (await hn.locator(`[data-hom-nay-bai="${L(4)}"]`).count()) === 1 && !/NHAP-BI-MAT/.test(await p.content()) && (await hn.locator(`[data-hom-nay-bai="${L(5)}"]`).count()) === 0);
    const docA = row3.locator("[data-hom-nay-tai-lieu]");
    check("tài liệu 'Mở ↗' mở tab mới, rel noopener noreferrer", (await docA.count()) === 1 && (await docA.getAttribute("target")) === "_blank" && (await docA.getAttribute("rel")) === "noopener noreferrer");
    check("'Bài Azota ↗' (tab mới) và 'Làm bài tập' → ?tab=bai-tap", (await row3.locator("[data-hom-nay-azota]").getAttribute("target")) === "_blank" && (await row3.getByRole("link", { name: "Làm bài tập" }).getAttribute("href")) === `/student/bai-giang/${L(3)}?tab=bai-tap`);
    const up = (await hn.locator("[data-hom-nay-sap-toi]").innerText()).replace(/\s+/g, " ");
    check("'Sắp tới' có 'Ngày mai · 00:30 · Toán 9 (LOI-03) · Bài 5: Nghiệm thu gọn' và bài +3 ngày", /Ngày mai · 00:30 · Toán 9 \(LOI-03\) · Bài 5: Nghiệm thu gọn/.test(up) && /Bài 6: Ôn tập chương/.test(up), up);
    check("không có 'lượt xem', đáp án, điểm, đếm ngược trong phiếu", !/lượt xem|đáp án|lời giải|Điểm:|còn \d+ phút/i.test(await hn.innerText()));
    // Vòng test 2 (mâu thuẫn): phiếu có bài hôm nay ⇒ cột phải KHÔNG vẽ "3 ngày tới chưa có buổi học" (em chưa có khung giờ / buổi học nào); khối đề thi lên đầu cột phải.
    await eventually(`${w}: phiếu có bài ⇒ không có '3 ngày tới chưa có buổi học' (không aside 'Buổi học tiếp theo')`, async () =>
      (await p.getByText("3 ngày tới chưa có buổi học").count()) === 0 && (await p.getByRole("complementary", { name: "Buổi học tiếp theo" }).count()) === 0, 30000);
    {
      const todoH = await p.locator("#vc-todo").boundingBox(), giaoH = await p.locator("#vc-giao").boundingBox();
      if (w === 1600) check("1600: lưới không vỡ — 'Đề thi được giao' ở cột phải, ngang hàng 'Cần làm'", !!todoH && !!giaoH && giaoH.x > todoH.x + todoH.width && Math.abs(giaoH.y - todoH.y) < 40, { todoH, giaoH });
      else check("390: một cột — 'Đề thi được giao' dưới 'Cần làm', cùng mép trái", !!todoH && !!giaoH && giaoH.y > todoH.y && Math.abs(giaoH.x - todoH.x) < 4, { todoH, giaoH });
    }
    const hnBox = await hn.boundingBox(), h1Box = await p.getByRole("heading", { level: 1, name: "Việc của tôi" }).boundingBox();
    check("phiếu nằm ngay dưới tiêu đề trang, rộng hết khung nội dung", !!hnBox && !!h1Box && hnBox.y > h1Box.y && hnBox.y - (h1Box.y + h1Box.height) < 140, { hnBox, h1Box });
    if (w === 390) {
      check("390: Việc của tôi không cuộn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
      const s = await small(p, "[data-hom-nay] a, [data-hom-nay] button");
      check("390: mọi liên kết / nút trong phiếu cao ≥ 44px", s.length === 0, s.slice(0, 5));
    }
    await shot(p, `loi03-hom-nay-${w}`);
    // Bấm "Làm bài tập" → bài mở thẳng tab Bài tập.
    await p.route("**/api/media/nop-bai/danh-sach**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: true, limits: LIMITS, retentionDays: 60, files: [], submission: null }) }));
    await row3.getByRole("link", { name: "Làm bài tập" }).click();
    await p.waitForURL(u => u.pathname === `/student/bai-giang/${L(3)}` && u.searchParams.get("tab") === "bai-tap", { timeout: 90000 });
    await eventually("'Làm bài tập' (?tab=bai-tap) mở thẳng tab Bài tập: thấy thẻ bài tập + vùng thả", async () => (await p.locator(`[data-bai-tap-the="${HW.id}"] [data-nop-tep-vung-tha]`).count()) === 1, 60000);
    await c.close();
  }

  // ═════════ Phiếu: không có bài hẹn / lỗi ═════════
  section("1600 · em không có bài hẹn ⇒ không có phiếu; API lỗi ⇒ ErrorStrip + Thử lại");
  {
    const { c, p } = await open(S1, 1600, "/student/viec-cua-toi");
    await p.getByRole("heading", { level: 1, name: "Việc của tôi" }).waitFor({ timeout: 120000 });
    await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(1500);
    check("không bài hẹn: KHÔNG có [data-hom-nay] (không khung trống), không dải lỗi phiếu", (await p.locator("[data-hom-nay]").count()) === 0 && (await p.locator("[data-hom-nay-loi]").count()) === 0);
    await c.close();
    const { c: c2, p: p2 } = await open(S, 1600, "/student/viec-cua-toi");
    let fail = true;
    await p2.route("**/api/student/hom-nay", r => (fail ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Lỗi server" }) }) : r.continue()));
    await p2.reload({ waitUntil: "domcontentloaded" });
    const strip = p2.locator("[data-hom-nay-loi]");
    await strip.waitFor({ timeout: 120000 });
    check("lỗi: 'Không tải được bài hôm nay.' + nút 'Thử lại' ≥ 44px", /Không tải được bài hôm nay\./.test(await strip.innerText()) && ((await strip.getByRole("button", { name: "Thử lại" }).boundingBox())?.height ?? 0) >= 44);
    fail = false;
    await strip.getByRole("button", { name: "Thử lại" }).click();
    await p2.locator("[data-hom-nay]").waitFor({ timeout: 60000 });
    check("Thử lại → phiếu hiện, dải lỗi mất", (await p2.locator("[data-hom-nay-loi]").count()) === 0 && (await p2.locator(`[data-hom-nay-bai="${L(3)}"]`).count()) === 1);
    await c2.close();
  }

  // ═════════ LOI-07: đang tải ≠ rỗng, bài hẹn ngoài khung, không giấu lỗi ═════════
  section("LOI-07 · 1600 · Việc của tôi: phiếu còn đang tải ⇒ không chớp '3 ngày tới chưa có buổi học'");
  {
    const c = await ctxFor(S, { width: 1600, height: 1000 }); const p = await c.newPage(); watch(p);
    let release!: () => void; const gate = new Promise<void>(r => { release = r; });
    await p.route("**/api/student/hom-nay", async r => { await gate; await r.continue(); });
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.locator("#vc-todo").waitFor({ timeout: 120000 });
    await p.waitForTimeout(1500);
    check("phiếu chưa trả lời: KHÔNG có '3 ngày tới chưa có buổi học'; cột buổi học là khung xương aria-busy 'Đang tải buổi học tiếp theo'",
      (await p.getByText("3 ngày tới chưa có buổi học").count()) === 0 && (await p.locator("[data-aside-dang-tai]").getAttribute("aria-busy")) === "true" && (await p.locator("[data-aside-dang-tai]").getAttribute("aria-label")) === "Đang tải buổi học tiếp theo");
    release();
    await p.locator("[data-hom-nay]").waitFor({ timeout: 60000 });
    await eventually("phiếu có bài ⇒ khung xương biến mất, vẫn không có '3 ngày tới chưa có buổi học'", async () => (await p.locator("[data-aside-dang-tai]").count()) === 0 && (await p.getByText("3 ngày tới chưa có buổi học").count()) === 0, 20000);
    await c.close();
    // Học sinh S có việc (bài tập) nhưng phiếu trả RỖNG thật (chặn route trả today/upcoming rỗng) ⇒ cột vẫn nói "3 ngày tới chưa có buổi học".
    // (S1 không có việc nào ⇒ trang hiện "Chưa có việc nào cho bạn", không có cột buổi học — không dùng cho ca này.)
    const c1 = await ctxFor(S, { width: 1600, height: 1000 }); const p1 = await c1.newPage(); watch(p1);
    await p1.route("**/api/student/hom-nay", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ today: [], upcoming: [], todayKey: addDaysKey(today, 0) }) }));
    await p1.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await eventually("em không có bài hẹn (phiếu rỗng thật) ⇒ VẪN nói '3 ngày tới chưa có buổi học' (rỗng ≠ đang tải)", async () => (await p1.getByText("3 ngày tới chưa có buổi học").count()) === 1 && (await p1.locator("[data-aside-dang-tai]").count()) === 0, 60000);
    await c1.close();
  }
  section("LOI-07 · 1600 · không giấu lỗi: hom-nay 500 / 403 không ẩn cột buổi học; /api/schedule 500 ⇒ khối lịch báo lỗi + Thử lại");
  {
    for (const [what, status] of [["500", 500], ["403 (gia sư / quản trị xem thử)", 403]] as const) {
      const c = await ctxFor(S, { width: 1600, height: 1000 }); const p = await c.newPage(); watch(p);
      await p.route("**/api/student/hom-nay", r => r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "x" }) }));
      await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 240000 });
      await p.locator("#vc-todo").waitFor({ timeout: 120000 });
      await eventually(`hom-nay ${what}: cột 'Buổi học tiếp theo' VẪN hiện ('3 ngày tới chưa có buổi học'), không kẹt ở khung xương`, async () =>
        (await p.getByRole("complementary", { name: "Buổi học tiếp theo" }).count()) === 1 && (await p.getByText("3 ngày tới chưa có buổi học").count()) === 1 && (await p.locator("[data-aside-dang-tai]").count()) === 0, 60000);
      check(`hom-nay ${what}: ${status === 500 ? "CÓ dải lỗi 'Không tải được bài hôm nay.'" : "không dải lỗi, không phiếu (403 = không phải học sinh)"}`, status === 500 ? (await p.locator("[data-hom-nay-loi]").count()) === 1 : (await p.locator("[data-hom-nay-loi], [data-hom-nay]").count()) === 0);
      await c.close();
    }
    const c = await ctxFor(S, { width: 1600, height: 1000 }); const p = await c.newPage(); watch(p);
    let fail = true;
    await p.route("**/api/schedule**", r => (fail ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.continue()));
    await p.goto(`${BASE}/student/hoc-tap?course=${X.id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    const loi = p.locator("[data-course-sessions] [data-course-sessions-loi]");
    await loi.waitFor({ timeout: 120000 }).catch(() => {});
    check("lớp có bài hẹn hôm nay + /api/schedule 500 ⇒ khối 'Buổi học sắp tới' VẪN hiện, nói 'Không tải được lịch của lớp.' + 'Thử lại' ≥ 44px (không im lặng ẩn)",
      await loi.isVisible() && /Không tải được lịch của lớp\./.test(await loi.innerText()) && ((await loi.getByRole("button", { name: "Thử lại" }).boundingBox())?.height ?? 0) >= 44);
    fail = false;
    await loi.getByRole("button", { name: "Thử lại" }).click();
    await eventually("Thử lại khi lịch đã ổn ⇒ lịch rỗng + có bài hẹn ⇒ khối ẩn đúng như thiết kế", async () => (await p.locator("[data-course-sessions]").count()) === 0, 60000);
    await c.close();
  }
  section("LOI-07 · 1600 · bài hẹn 120 ngày nữa (ngoài khung 90 ngày) KHÔNG làm ẩn 'Buổi học sắp tới'");
  {
    const { c, p } = await open(S2, 1600, `/student/hoc-tap?course=${W.id}`);
    await p.locator("[data-course-hero]").waitFor({ timeout: 120000 });
    const blk = p.locator("[data-course-sessions]");
    await eventually("khối 'Buổi học sắp tới' hiện và nói 'chưa có buổi học nào trong 90 ngày tới'", async () => (await blk.count()) === 1 && /chưa có buổi học nào trong 90 ngày tới/.test(await blk.innerText()), 60000);
    check("dòng bài vẫn ghi ngày hẹn (bài hẹn xa không mất)", /Học /.test(await p.locator(`[data-outline-lesson="lw-${W.id}"]`).innerText().catch(() => "")) || (await p.getByText("Bài hẹn xa").count()) >= 1);
    await c.close();
  }

  // ═════════ 1 lớp vẫn ở thư viện ═════════
  section("1600 · học sinh chỉ có 1 lớp: vẫn là thư viện (Q1)");
  {
    const { c, p } = await open(S1, 1600, "/student/hoc-tap");
    await p.locator("[data-class-catalog]").waitFor({ timeout: 120000 });
    await p.waitForTimeout(2500);
    check("1 lớp: ở /student/hoc-tap không ?course=, đúng 1 thẻ", new URL(p.url()).searchParams.get("course") === null && (await p.locator("[data-class-card]").count()) === 1);
    await c.close();
  }

  // ═════════ "Hỏi gia sư trong lớp" chỉ cho học sinh đang học lớp ═════════
  section("390 · trang lớp Toán với học sinh KHÔNG ghi danh / khách: không có [data-hoi-trong-lop]");
  {
    const { c, p } = await open(S1, 390, `/student/hoc-tap?course=${X.id}`);
    const hero = p.locator("[data-course-hero]");
    await hero.waitFor({ timeout: 120000 });
    await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    check("không ghi danh: thẻ tiến độ 'Bạn chưa vào lớp này', KHÔNG có 'Hỏi gia sư trong lớp →'", /Bạn chưa vào lớp này/.test(await hero.innerText()) && (await p.locator("[data-hoi-trong-lop]").count()) === 0 && (await p.getByText("Hỏi gia sư trong lớp").count()) === 0);
    await c.close();
    const { c: c2, p: p2 } = await open(null, 390, `/student/hoc-tap?course=${X.id}`);
    await p2.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    await p2.waitForTimeout(1500);
    check("khách: (bị chuyển tới đăng nhập hoặc thấy trang) không có [data-hoi-trong-lop]", (await p2.locator("[data-hoi-trong-lop]").count()) === 0, p2.url());
    await c2.close();
  }

  // ═════════ /lop-cua-toi vai học sinh ═════════
  section("/lop-cua-toi (học sinh) = thư viện; /lop-cua-toi/<lớp> ⇒ trang lớp của học sinh");
  {
    const { c, p } = await open(S, 1600, "/lop-cua-toi");
    await p.locator("[data-class-catalog]").waitFor({ timeout: 120000 });
    check("/lop-cua-toi: URL giữ nguyên, thấy thư viện 2 thẻ, KHÔNG còn nút 'Lịch học' / 'Học phí' trên thẻ", new URL(p.url()).pathname === "/lop-cua-toi" && (await p.locator("[data-class-card]").count()) === 2 && (await p.locator('[data-class-catalog] a[href="/student/lich-hoc"], [data-class-catalog] a[href="/student/hoc-phi"]').count()) === 0);
    check("/lop-cua-toi: trong vỏ học sinh (thanh 'Module của học sinh')", (await p.getByRole("navigation", { name: "Module của học sinh" }).count()) >= 1);
    await shot(p, "loi03-lop-cua-toi-1600");
    await p.goto(`${BASE}/lop-cua-toi/${X.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForURL(u => u.pathname === "/student/hoc-tap" && u.searchParams.get("course") === X.id, { timeout: 90000 });
    await p.getByRole("heading", { level: 1, name: "Toán 9 (LOI-03)" }).waitFor({ timeout: 120000 });
    check("/lop-cua-toi/<X> → /student/hoc-tap?course=<X>, h1 tên lớp", true);
    await c.close();
    const r = await api("GET", `/lop-cua-toi/${X.id}`, { as: S });
    check("chuyển hướng là 307 thật (không 308), Location đúng", r.status === 307 && (r.headers.get("location") ?? "").endsWith(`/student/hoc-tap?course=${encodeURIComponent(X.id)}`), [r.status, r.headers.get("location")]);
    const Z = await mkCourse(T.id, { name: "Lớp người khác" });
    const r2 = await api("GET", `/lop-cua-toi/${Z.id}`, { as: S });
    check("học sinh KHÔNG ghi danh lớp đó: vẫn 404 như cũ", r2.status === 404, r2.status);
  }

  // ═════════ Hồi quy: gia sư chủ lớp / quản trị mở /lop-cua-toi/<X> KHÔNG bị đẩy sang trang học sinh ═════════
  section("/lop-cua-toi/<lớp> với gia sư chủ lớp và quản trị: đi đúng nơi như trước, không sang /student/hoc-tap");
  {
    const want = legacyClassTarget(X.id, {}); // GS-LOP-GON: chủ lớp là gia sư → /lop-cua-toi/quan-lop/<X>/giao-trinh
    const rt = await api("GET", `/lop-cua-toi/${X.id}`, { as: T });
    const loc = rt.headers.get("location") ?? "";
    check("gia sư chủ lớp: 307 → dải tab của lớp (quan-lop), KHÔNG /student/hoc-tap", rt.status === 307 && new URL(loc, BASE).pathname === want && !loc.includes("/student/hoc-tap"), [rt.status, loc, want]);
    const { c, p } = await open(T, 1280, `/lop-cua-toi/${X.id}`);
    await p.waitForURL(u => u.pathname === want, { timeout: 90000 });
    check("gia sư chủ lớp (trình duyệt): dừng ở " + want, new URL(p.url()).pathname === want, p.url());
    await c.close();
    const A = await mkSuper("Quản trị LOI-03");
    const ra = await api("GET", `/lop-cua-toi/${X.id}`, { as: A });
    check("quản trị: trang lớp như cũ (200, không chuyển hướng), KHÔNG /student/hoc-tap", ra.status === 200 && !(ra.headers.get("location") ?? "").includes("/student/hoc-tap") && ra.text.includes("Toán 9 (LOI-03)"), [ra.status, ra.headers.get("location")]);
  }

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
