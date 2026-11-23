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
// SCL-G-HS (21/11/2026): trang lớp theo bản chốt (không tab / thẻ tiến độ / cây chương; Cần làm, Buổi gần đây, Tất cả bài học; "Hỏi gia sư trong lớp" lên đầu trang)
//   và "Cần làm" bỏ phiếu "Hôm nay có lớp" + cột "Buổi học tiếp theo" ⇒ các ca của những khối đó đổi thành ca tương ứng trên màn mới (cùng ý: không lộ bài nháp,
//   không giấu lỗi, bài hẹn xa không mất, 390 không tràn / ≥ 44px). Phần thư viện lớp, trang bài, /lop-cua-toi giữ nguyên.
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
    check("Toán: ảnh bìa <img> https (alt rỗng), SCL5: không lặp nhãn 'Đang học', 'Gia sư: Cô Lan · Toán', 'Đã hoàn thành 1/6 bài' (bài nháp KHÔNG đếm)",
      (await cx.locator(`img[src="${COVER}"][alt=""]`).count()) === 1 && !/Đang học/.test(tx) && /Gia sư: Cô Lan · Toán/.test(tx) && /Đã hoàn thành 1\/6 bài/.test(tx), tx);
    check("Toán: SCL5 bỏ thanh tiến độ (một chỉ báo); vòng % có nhãn 'Hoàn thành 16%' và chữ '16%'",
      (await cx.getByRole("progressbar").count()) === 0 && (await cx.getByRole("img", { name: /Hoàn thành 16%/ }).count()) === 1 && /16%/.test(tx));
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
    // SCL F1: khối "Tự học" (Tiếng Anh) đã xoá hẳn.
    // SCL P2-13: "Nhập mã lớp" lên ĐẦU trang (khối [data-nhap-ma-dau]), mục "Tham gia lớp khác" dưới đáy đã bỏ.
    check("'Nhập mã lớp' ở đầu trang (một lối), không còn khối 'Tự học'", await p.locator("[data-nhap-ma-dau]").getByRole("link", { name: "Nhập mã lớp" }).isVisible() && (await p.getByRole("heading", { name: "Tham gia lớp khác" }).count()) === 0 && (await p.getByRole("heading", { name: "Tự học" }).count()) === 0 && (await p.getByRole("link", { name: "Nhập mã lớp" }).count()) === 1);
    if (w === 390) {
      check("390: không cuộn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
      const s = await small(p, "main a, main button");
      check("390: mọi nút / liên kết trong trang cao ≥ 44px (thẻ lớp, lọc, Học tiếp)", s.length === 0, s.slice(0, 5));
      const b = await ht.boundingBox(), cb = await cx.boundingBox();
      check("390: 'Học tiếp →' rộng gần hết thẻ", !!b && !!cb && b.width >= cb.width - 2 * 24, { b, cb });
    }
    await shot(p, `loi03-thu-vien-${w}`);

    // ═════════ Trang lớp (SCL-G-HS: bản chốt khung 1 — không tab, không thẻ tiến độ, không cây chương; Cần làm trên cùng, Buổi gần đây, Tất cả bài học) ═════════
    section(`${w}px · bấm tên lớp → trang lớp`);
    await cx.getByRole("link", { name: "Toán 9 (LOI-03)", exact: true }).click();
    await p.waitForURL(u => u.pathname === "/student/hoc-tap" && u.searchParams.get("course") === X.id, { timeout: 90000 });
    await p.locator("[data-lop-can-lam] [data-can-lam-the]").first().waitFor({ timeout: 120000 });
    check("h1 = tên lớp; đầu trang có tên cô; không tab, không thẻ tiến độ cũ", await p.getByRole("heading", { level: 1, name: "Toán 9 (LOI-03)" }).isVisible() && /Cô Lan/.test(await p.locator("[data-dau-lop]").innerText()) && (await p.getByRole("tab").count()) === 0 && (await p.locator("[data-course-hero]").count()) === 0);
    check("Cần làm: thẻ 'Bài tập Vi-ét' có nút 'Nộp bài'", await p.locator("[data-lop-can-lam] [data-can-lam-the]").filter({ hasText: "Bài tập Vi-ét" }).getByRole("button", { name: /^Nộp bài/ }).count() === 1);
    // SCL5 (D15): "Buổi gần đây" thay bằng mục lục "Các chương" [data-lop-chuong]
    const rowIds = await p.locator("[data-lop-chuong] [data-lesson-row]").evaluateAll(els => els.map(e => e.getAttribute("data-lesson-row")));
    check("Các chương: có hàng bài, chỉ bài của lớp này; tên bài nháp không lộ", rowIds.length > 0 && rowIds.every(id => (id ?? "").endsWith(`-${X.id}`)) && !(await p.content()).includes("NHAP-BI-MAT"), rowIds);
    check("'Tất cả bài học (6)' (bài nháp không đếm)", (await p.locator("[data-tat-ca-bai]").innerText()).includes("Tất cả bài học (6)"));
    const hoi = p.locator("[data-hoi-trong-lop]");
    if (!featureOn("CONG_DONG")) {
      check("đầu trang (đang học): 'Hỏi gia sư trong lớp' [data-hoi-trong-lop] → /cong-dong?scope=<mã lớp>, thấy được", (await hoi.count()) === 1 && await hoi.isVisible() && (await hoi.innerText()).trim() === "Hỏi gia sư trong lớp" && (await hoi.getAttribute("href")) === `/cong-dong?scope=${encodeURIComponent(X.id)}`, await hoi.getAttribute("href"));
      if (w === 390) { const hb = await hoi.boundingBox(); check("390: 'Hỏi gia sư trong lớp' cao ≥ 44px", !!hb && hb.height >= 44, hb); }
    }
    // DG (14/11/2026): lối "Phiếu học phí của bạn" chỉ khi cờ HOC_PHI mở; trang lớp không có chữ số tiền.
    const head = await p.locator("[data-dau-lop]").innerText();
    if (featureOn("HOC_PHI")) check("đầu trang: 'Phiếu học phí của bạn' → /student/hoc-phi, không số tiền", (await p.locator("[data-lop-hoc-phi]").getAttribute("href")) === "/student/hoc-phi" && !/\d\s*(đ|₫|VND)|\bđ\b/.test(head), head);
    else check("DG: HOC_PHI tắt → không 'Phiếu học phí của bạn', không chữ số tiền", (await p.locator("[data-lop-hoc-phi]").count()) === 0 && !/\d\s*(đ|₫|VND)|\bđ\b/.test(head), head);
    // Vòng test 2 (mâu thuẫn) giữ ý: lớp có bài hẹn hôm nay mà chưa có buổi học ⇒ không câu "chưa có buổi học nào trong 90 ngày tới".
    await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    check(`${w}: không có 'chưa có buổi học nào trong 90 ngày tới'`, (await p.getByText("chưa có buổi học nào trong 90 ngày tới").count()) === 0);
    if (w === 390) {
      check("390: không cuộn ngang (trang lớp)", await p.evaluate(NOT_OVERFLOW) as boolean);
      const s = await small(p, "main a, main button");
      check("390: mọi nút / hàng cao ≥ 44px", s.length === 0, s.slice(0, 5));
    }
    await shot(p, `loi03-lop-${w}`);

    section(`${w}px · Tất cả bài học: nhóm theo chương, bài nháp không lộ`);
    await p.locator("[data-tat-ca-bai]").click();
    await p.getByRole("heading", { level: 1, name: "Tất cả bài học" }).waitFor({ timeout: 90000 });
    const chapT = await p.locator("[data-chuong] h2").allInnerTexts();
    check("2 chương, chương mới nhất trên: 'Phương trình bậc hai', 'Căn thức'; đủ 6 bài; không bài nháp", JSON.stringify(chapT) === JSON.stringify(["Phương trình bậc hai", "Căn thức"]) && (await p.locator("[data-chuong] [data-lesson-row]").count()) === 6 && !(await p.content()).includes("NHAP-BI-MAT"), chapT);
    const meta3 = (await p.locator(`[data-lesson-row="${L(3)}"]`).innerText()).replace(/\s+/g, " ");
    check("dòng bài 3 có ngày, '1 tài liệu' và 'Bài tập'", /(Thứ \S+|Chủ nhật) \d\d\/\d\d/.test(meta3) && /1 tài liệu/.test(meta3) && /Bài tập/.test(meta3), meta3);
    if (w === 390) check("390: không cuộn ngang (Tất cả bài học)", await p.evaluate(NOT_OVERFLOW) as boolean);

    // ═════════ Bài → ô nộp tệp ═════════
    section(`${w}px · bấm bài → tab Bài tập: ô nộp tệp to, là khối đầu tiên của thẻ`);
    let storeOn = true;
    await p.route("**/api/media/nop-bai/danh-sach**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(storeOn ? { enabled: true, limits: LIMITS, retentionDays: 60, files: [], submission: null } : { enabled: false, reason: "Tính năng nộp tệp chưa bật.", limits: LIMITS, retentionDays: 60, files: [], submission: null }) }));
    await p.locator(`[data-lesson-row="${L(3)}"] a`).click();
    await p.waitForURL(u => u.pathname === `/student/bai-giang/${L(3)}`, { timeout: 90000 });
    await p.getByRole("heading", { level: 1, name: "Bài 3: Hệ thức Vi-ét" }).waitFor({ timeout: 120000 });
    await p.locator('[data-lesson-section="bai-tap"]').scrollIntoViewIfNeeded(); // DG: trang bài một cột, không còn nút tab Bài tập
    const card = p.locator(`[data-bai-tap-the="${HW.id}"]`);
    const zone = card.locator("[data-nop-tep-vung-tha]");
    await zone.waitFor({ timeout: 60000 });
    const order = await card.evaluate(e => { const kids = [...e.children]; return { second: kids[1]?.hasAttribute("data-nop-tep") ?? false, guideAfter: (() => { const g = e.querySelector("[data-bai-tap-huong-dan]"), z = e.querySelector("[data-nop-tep]"); return !!g && !!z && !!(z.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING); })() }; });
    check("thẻ bài tập: ngay sau tiêu đề + hạn là khối nộp tệp; hướng dẫn / đề bài nằm SAU", order.second && order.guideAfter, order);
    const zb = await zone.boundingBox(), cardB = await card.boundingBox();
    // SCL-D (P2-1): dưới 768px ô thả gọn (≥ 96px, chữ "Tệp Word hoặc PDF"), từ 768px mới là vùng thả lớn.
    const phone = w < 768;
    await card.locator("[data-nop-tep-quy-dinh]").click(); // SCL5: quy định nộp tệp + cảnh báo gập sau nút (vẫn nằm TRÊN Nộp bài khi mở)
    check(`vùng thả là <button>, cao ${phone ? "96–211px (gọn trên điện thoại)" : "≥ 200px"}, rộng gần hết thẻ`, (await zone.evaluate(e => e.tagName)) === "BUTTON" && !!zb && (phone ? zb.height >= 96 && zb.height <= 211 : zb.height >= 200) && !!cardB && zb.width >= cardB.width - 2 * 24, { zb, cardB });
    check("chữ ô thả (máy tính: 'Kéo thả… vào đây' + 'hoặc'; điện thoại: 'Tệp Word hoặc PDF') + nút 'Chọn tệp' ≥ 44px; chú thích giới hạn giữ nguyên số (10 MB, 60 ngày, 3 tệp)",
      (phone ? /Tệp Word hoặc PDF/.test(await zone.innerText()) : /Kéo thả tệp Word hoặc PDF vào đây/.test(await zone.innerText()) && /hoặc/.test(await zone.innerText())) && ((await card.locator("[data-nop-tep-chon]").boundingBox())?.height ?? 0) >= 44
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
    await p.locator('[data-lesson-section="bai-tap"]').scrollIntoViewIfNeeded(); // DG: trang bài một cột, không còn nút tab Bài tập
    const off = p.locator("[data-nop-tep-chua-bat]");
    await off.waitFor({ timeout: 60000 });
    check("kho chưa bật: tiêu đề 'Kho tệp chưa bật' + câu cũ 'Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota.' (role=status)", (await off.getAttribute("role")) === "status" && /Kho tệp chưa bật/.test(await off.innerText()) && /Tính năng nộp tệp chưa bật\. Bạn vẫn nộp được bằng link Azota\./.test(await off.innerText()));
    check("kho chưa bật: không vùng thả, không 'Nộp bài'; trang còn nguyên (tiêu đề bài, thẻ bài tập, khối Azota)", (await p.locator("[data-nop-tep-vung-tha]").count()) === 0 && (await p.locator("[data-nop-tep-nop]").count()) === 0 && await card.isVisible() && (await p.getByText(/Azota/).count()) > 0);
    await shot(p, `loi03-kho-tat-${w}`);
    await p.unroute("**/api/media/nop-bai/danh-sach**");

    // ═════════ Cần làm (SCL-G-HS khung 2; phiếu "Hôm nay có lớp" đã bỏ theo bản chốt) ═════════
    section(`${w}px · /student/viec-cua-toi (Cần làm): thẻ bài tập của lớp, không bài nháp`);
    await p.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.getByRole("heading", { level: 1, name: "Cần làm" }).waitFor({ timeout: 120000 });
    const vi = p.locator("[data-can-lam-the]").filter({ hasText: "Bài tập Vi-ét" });
    await vi.waitFor({ timeout: 120000 });
    check("thẻ 'Bài tập Vi-ét' ghi tên lớp 'Toán 9 (LOI-03)', có 'Nộp bài'", /Toán 9 \(LOI-03\)/.test(await vi.innerText()) && await vi.getByRole("button", { name: /^Nộp bài/ }).count() === 1);
    check("không lộ bài NHÁP", !(await p.content()).includes("NHAP-BI-MAT"));
    if (w === 390) {
      check("390: Cần làm không cuộn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
      const s = await small(p, "main a, main button");
      check("390: mọi liên kết / nút cao ≥ 44px", s.length === 0, s.slice(0, 5));
    }
    await shot(p, `loi03-can-lam-${w}`);
    await c.close();
  }

  // ═════════ LOI-07 giữ ý trên trang lớp mới: không giấu lỗi, bài hẹn ngoài khung không mất ═════════
  section("LOI-07 · 1600 · không giấu lỗi: /api/student/viec-cua-toi 500 ⇒ trang lớp báo lỗi + Thử lại; không gọi /api/schedule");
  {
    const c = await ctxFor(S, { width: 1600, height: 1000 }); const p = await c.newPage(); watch(p);
    let fail = true, scheduleCalls = 0;
    await p.route("**/api/schedule**", r => { scheduleCalls++; return r.continue(); });
    await p.route("**/api/student/viec-cua-toi**", r => (fail ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.continue()));
    await p.goto(`${BASE}/student/hoc-tap?course=${X.id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    const loi = p.locator("[data-lop-can-lam] [role=alert]").filter({ hasText: "Không tải được việc cần làm." });
    await loi.waitFor({ timeout: 120000 }).catch(() => {});
    check("trang lớp không gọi /api/schedule (lịch đi cùng viec-cua-toi)", scheduleCalls === 0, scheduleCalls);
    check("viec-cua-toi 500 ⇒ mục Cần làm nói 'Không tải được việc cần làm.' + 'Thử lại' ≥ 44px (không im lặng rỗng)", await loi.isVisible() && ((await loi.getByRole("button", { name: "Thử lại" }).boundingBox())?.height ?? 0) >= 44);
    fail = false;
    await loi.getByRole("button", { name: "Thử lại" }).click();
    await eventually("Thử lại ⇒ thẻ 'Bài tập Vi-ét' hiện, dải lỗi mất", async () => (await p.locator("[data-lop-can-lam] [data-can-lam-the]").filter({ hasText: "Bài tập Vi-ét" }).count()) === 1 && (await loi.count()) === 0, 60000);
    await c.close();
  }
  section("LOI-07 · 1600 · bài hẹn 120 ngày nữa (ngoài khung 90 ngày) vẫn có trên trang lớp");
  {
    const { c, p } = await open(S2, 1600, `/student/hoc-tap?course=${W.id}`);
    await p.getByRole("heading", { level: 1, name: "Lý 9 hẹn xa (LOI-07)" }).waitFor({ timeout: 120000 });
    await eventually("'Bài hẹn xa' nằm trong Buổi gần đây (có ngày), không câu 'chưa có buổi học nào trong 90 ngày tới'", async () =>
      /Bài hẹn xa/.test(await p.locator(`[data-lesson-row="lw-${W.id}"]`).innerText().catch(() => "")) && (await p.getByText("chưa có buổi học nào trong 90 ngày tới").count()) === 0, 60000);
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
    await p.getByText("Bạn chưa vào lớp này").waitFor({ timeout: 120000 });
    await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    check("không ghi danh: 'Bạn chưa vào lớp này', KHÔNG có 'Hỏi gia sư trong lớp'", (await p.locator("[data-hoi-trong-lop]").count()) === 0 && (await p.getByText("Hỏi gia sư trong lớp").count()) === 0);
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
    // SCL-B (Q1, SUA-CHUA-LON-KE-HOACH): quản trị trung tâm đứng lớp trong vỏ gia sư ⇒ cùng dải tab quan-lop như chủ lớp (trước SCL-B là trang 200 cũ).
    const la = ra.headers.get("location") ?? "";
    check("quản trị: 307 → dải tab của lớp (quan-lop) như chủ lớp, KHÔNG /student/hoc-tap", ra.status === 307 && new URL(la, BASE).pathname === want && !la.includes("/student/hoc-tap"), [ra.status, la, want]);
  }

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
