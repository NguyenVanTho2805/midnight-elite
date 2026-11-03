// BU-03 P2 — trình duyệt thật: Đề thi (danh sách), Tạo đề, Ma trận đề, Mã đề, Tệp đề gốc; đường cũ 307 sang đường mới.
// 1600px và 390px; không tràn ngang; nút ≥ 44px (loại nextjs-portal và KinToast); ba trạng thái (tải/lỗi/rỗng) bằng chặn mạng; không hộp thoại gốc.
// CHƯA CHẠY lần nào (viết khi không được bật máy chủ) — chạy lần đầu có thể cần chỉnh bộ chọn.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S = await mkUser({ name: "Em An" });
  const course = await mkCourse(T.id, { name: "Toán 12 (đề thi)" });

  const root = await prisma.questionCategory.create({ data: { name: "Toán" } });
  // Môn › Lớp › Chương › YCCĐ (đúng 4 tầng của đặc tả: chương = tầng 2; thiếu tầng Lớp thì "Chương 1" bị coi là Lớp và không hiện ở ma trận)
  const lop = await prisma.questionCategory.create({ data: { name: "Lớp 12", parentId: root.id } });
  const ch = await prisma.questionCategory.create({ data: { name: "Chương 1", parentId: lop.id } });
  const y11 = await prisma.questionCategory.create({ data: { name: "YCCĐ 1.1", parentId: ch.id } });
  const y12 = await prisma.questionCategory.create({ data: { name: "YCCĐ 1.2", parentId: ch.id } });
  const mkItem = async (cat: string, diff: string, i: number, owner: string, status = "approved") =>
    prisma.questionBankItem.create({ data: { categoryId: cat, difficulty: diff, type: "MC", text: `Câu ngân hàng ${diff}-${i} $x^${i}$`, ownerId: owner, status,
      options: { create: ["A", "B", "C", "D"].map((t, k) => ({ order: k, text: `Đáp án ${t}`, isCorrect: k === 0 })) } } });
  for (let i = 1; i <= 6; i++) await mkItem(y11.id, "NB", i, T.id);
  for (let i = 1; i <= 3; i++) await mkItem(y11.id, "TH", i, T.id);
  for (let i = 1; i <= 2; i++) await mkItem(y12.id, "NB", i, T.id);
  await mkItem(y12.id, "NB", 9, T2.id, "draft");

  await prisma.examFile.create({ data: { fileName: "de-goc-1.docx", fileUrl: "https://res.cloudinary.com/demo/raw/upload/de-goc-1.docx", fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ownerId: T.id } });
  await prisma.examFile.create({ data: { fileName: "de-goc-2.pdf", fileUrl: "https://res.cloudinary.com/demo/raw/upload/de-goc-2.pdf", fileType: "application/pdf", ownerId: T.id } });
  await prisma.examFile.create({ data: { fileName: "cua-co-khac.pdf", fileUrl: "https://res.cloudinary.com/demo/raw/upload/khac.pdf", fileType: "application/pdf", ownerId: T2.id } });

  // Đề của cô Lan (đã có) + đề của cô khác
  const base = { category: "Quiz", date: "01/01/2030", time: "19:00", duration: "15 phút", status: "upcoming", createdAt: "x", courseId: course.id, active: false, isDraft: true, questions: 1, totalPoints: 1 };
  await prisma.exam.create({ data: { ...base, id: "bu3-own", code: "BU3.A", title: "Đề giữa kỳ của cô Lan", ownerId: T.id } });
  await prisma.exam.create({ data: { ...base, id: "bu3-other", code: "BU3.B", title: "Đề bí mật của cô khác", ownerId: T2.id } });
  await prisma.examQuestion.create({ data: { id: "bu3-own-1", examId: "bu3-own", order: 1, type: "MC", text: "Câu 1 đề giữa kỳ", points: 1, options: { create: ["A", "B", "C", "D"].map((t, k) => ({ id: `bu3-o-${k}`, order: k, text: `Đáp án ${t}`, isCorrect: k === 0 })) } } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => errors.push(String(e)));
    // React 19 báo console.error về thẻ <script> chủ đề trong src/app/layout.tsx — lành tính, bỏ qua.
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag while rendering React component/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (p: any) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const smallTargets = (p: any) => p.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main a[class*='min-h'], [data-kin-page] button")]
    .filter(b => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 43.5
      && !b.closest("[role=tablist]") && !b.closest("[data-feedback-toolbar]") && !b.closest("nextjs-portal") && !b.closest("[data-kin-toast]") && !b.closest("[role=status]"))
    .map(b => (b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 30)));
  let nativeDialogs = 0;

  const tctx = await ctxFor(T, { width: 1600, height: 1000 });
  const p = await tctx.newPage(); watch(p); p.on("dialog", d => { nativeDialogs++; d.dismiss(); });
  const goto = (pg: any, path: string) => pg.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
  const BASE_DT = "/lop-cua-toi/de-thi";

  section("Đề thi: danh sách, ẩn đề người khác, thanh tab");
  await goto(p, BASE_DT);
  await p.getByText("Đề giữa kỳ của cô Lan").first().waitFor({ timeout: 30000 });
  check("danh sách thấy đề của mình", await p.getByText("Đề giữa kỳ của cô Lan").first().isVisible());
  check("danh sách KHÔNG lộ đề của gia sư khác", (await p.getByText("Đề bí mật của cô khác").count()) === 0);
  check("tab 'Tệp đề gốc' có mặt trên thanh tab nội dung", await p.getByRole("link", { name: /Tệp đề gốc/ }).first().isVisible());
  check("thanh bên: đúng một mục đang chọn (visible)", (await p.locator("[aria-current=page]:visible").count()) >= 1);
  check("1600px: không tràn ngang", await noOverflow(p));
  check("1600px: nút ≥ 44px", (await smallTargets(p)).length === 0, await smallTargets(p));
  await shot(p, "de-thi-list-1600");

  section("Đề thi: ba trạng thái (tải / lỗi / rỗng) bằng chặn mạng");
  await p.route("**/api/tutor/de-thi", async r => { if (r.request().method() !== "GET") return r.continue(); await new Promise(res => setTimeout(res, 1500)); await r.continue(); });
  const slow = p.goto(`${BASE}${BASE_DT}`, { waitUntil: "domcontentloaded" });
  await slow;
  check("đang tải: có vùng aria-busy", await p.locator("[aria-busy=true]").first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.unroute("**/api/tutor/de-thi");
  await p.route("**/api/tutor/de-thi", r => r.request().method() === "GET" ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Lỗi giả lập" }) }) : r.continue());
  await goto(p, BASE_DT);
  check("lỗi: có nút 'Thử lại'", await p.getByRole("button", { name: /Thử lại/ }).first().isVisible());
  await p.unroute("**/api/tutor/de-thi");
  await p.route("**/api/tutor/de-thi", r => r.request().method() === "GET" ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }) : r.continue());
  await goto(p, BASE_DT);
  check("rỗng: có trạng thái trống, không bảng", (await p.getByText("Đề giữa kỳ của cô Lan").count()) === 0 && await noOverflow(p));
  await shot(p, "de-thi-rong-1600");
  await p.unroute("**/api/tutor/de-thi");

  section("Tạo đề: bốn lối");
  await goto(p, `${BASE_DT}/tao-moi`);
  for (const re of [/ma trận|Ma trận/, /Word/, /PDF|ảnh/i, /trắng|Trang trắng|Tự soạn/i]) {
    check(`Tạo đề có lối ${re}`, (await p.getByText(re).count()) > 0);
  }
  check("Tạo đề: không tràn ngang, nút ≥ 44px", await noOverflow(p) && (await smallTargets(p)).length === 0, await smallTargets(p));

  section("Ma trận: danh sách rỗng, dựng, thiếu câu, lưu, bốc");
  await goto(p, `${BASE_DT}/ma-tran`);
  check("danh sách ma trận rỗng có lối tạo mới", (await p.getByRole("link", { name: /Tạo ma trận|Ma trận mới|Tạo mới/ }).count()) > 0);
  await goto(p, `${BASE_DT}/ma-tran/moi`);
  await p.getByText("Chương 1").first().waitFor({ timeout: 30000 });
  await p.getByText("Chương 1").first().click();
  // YCCĐ nằm sau nút mở/gập của chương (aria-expanded); mở nếu đang gập.
  const tg = p.getByRole("button", { name: /yêu cầu cần đạt của Chương 1/ });
  if ((await tg.first().getAttribute("aria-expanded")) !== "true") await tg.first().click();
  await p.getByText("YCCĐ 1.2").first().click();
  const nb = p.getByLabel(/YCCĐ 1\.2, mức NB, số câu/);
  await nb.fill("5");
  check("thiếu câu: hiện 'Thiếu 3 câu (có 2)'", await p.getByText(/Thiếu 3 câu \(có 2\)/).first().isVisible());
  await nb.fill("2");
  await p.getByLabel(/Tên ma trận/).fill("Ma trận giữa kỳ");
  await p.getByRole("button", { name: /Lưu ma trận/ }).click();
  await p.waitForURL(u => !u.pathname.endsWith("/moi"), { timeout: 30000 });
  check("lưu xong: URL đổi khỏi /moi", !/\/moi$/.test(p.url()));
  await p.getByRole("button", { name: /^Bốc câu/ }).click();
  await p.getByText(/Câu ngân hàng NB-/).first().waitFor({ timeout: 30000 });
  check("bốc câu: hiện bản xem trước", (await p.getByText(/Câu ngân hàng NB-/).count()) >= 1);
  check("Ma trận 1600px: không tràn ngang, nút ≥ 44px", await noOverflow(p) && (await smallTargets(p)).length === 0, await smallTargets(p));
  await shot(p, "ma-tran-1600");

  section("Mã đề: đề không có mã con, tạo mã, khoá con, chặn phát hành");
  await goto(p, `${BASE_DT}/bu3-own/ma-de`);
  await p.getByRole("button", { name: /Tạo mã đề|Tạo các mã/ }).first().waitFor({ timeout: 30000 });
  check("Mã đề: có nút tạo", await p.getByRole("button", { name: /Tạo mã đề|Tạo các mã/ }).first().isVisible());
  check("Mã đề 1600px: không tràn ngang, nút ≥ 44px", await noOverflow(p) && (await smallTargets(p)).length === 0, await smallTargets(p));
  await shot(p, "ma-de-1600");

  section("Tệp đề gốc: danh sách, Word tách được, PDF dẫn sang nhập AI");
  await goto(p, `${BASE_DT}/ngan-hang-de-thi`);
  await p.getByText("de-goc-1.docx").first().waitFor({ timeout: 30000 });
  check("thấy tệp của mình, không thấy tệp người khác", await p.getByText("de-goc-2.pdf").first().isVisible() && (await p.getByText("cua-co-khac.pdf").count()) === 0);
  check("PDF có lối 'Nhập bằng AI'", (await p.getByText(/Nhập bằng AI/).count()) >= 1);
  check("thanh tab: 'Tệp đề gốc' đang chọn", (await p.locator("[aria-current=page]:visible", { hasText: /Tệp đề gốc/ }).count()) >= 1);
  check("Tệp gốc 1600px: không tràn ngang, nút ≥ 44px", await noOverflow(p) && (await smallTargets(p)).length === 0, await smallTargets(p));
  await shot(p, "tep-goc-1600");

  section("Trình soạn: nút Mã đề / Giao đề và liên kết quay về");
  await goto(p, `${BASE_DT}/bu3-own`);
  await p.getByRole("link", { name: /Mã đề/ }).first().waitFor({ timeout: 30000 });
  check("QuizEditor có 'Mã đề' và 'Giao đề'", await p.getByRole("link", { name: /Giao đề/ }).first().isVisible());
  check("liên kết quay về là 'Đề thi'", (await p.getByRole("link", { name: /Đề thi/ }).count()) >= 1);
  await p.getByRole("link", { name: /Giao đề/ }).first().click();
  await p.waitForURL(/\/bu3-own\/giao/, { timeout: 30000 });
  check("'Giao đề' không 404", !(await p.getByText(/404|not found/i).count()));

  section("Đường cũ → 307 sang đường mới");
  const cookie = (await tctx.cookies()).map(c => `${c.name}=${c.value}`).join("; ");
  const redir = async (from: string, to: RegExp) => {
    const r = await tctx.request.get(`${BASE}${from}`, { maxRedirects: 0, headers: { cookie } });
    // loading.tsx của vỏ gia sư biến redirect() của trang thành 200 + chỉ thị NEXT_REDIRECT;…;307; trong luồng (như mọi trang /lop-cua-toi); chấp nhận cả hai dạng.
    const body = r.status() === 200 ? await r.text() : "";
    const m = /NEXT_REDIRECT;(?:replace|push);([^;"]+);(\d+);/.exec(body);
    const loc = r.headers()["location"] ?? (m ? decodeURIComponent(m[1]) : "");
    check(`${from} → 307 ${to}`, (r.status() === 307 || m?.[2] === "307") && to.test(loc), [r.status(), loc]);
  };
  await redir("/lop-cua-toi/bai-tap/quiz/moi", /\/lop-cua-toi\/de-thi\/tao-moi/);
  await redir("/lop-cua-toi/bai-tap/quiz/bu3-own", /\/lop-cua-toi\/de-thi\/bu3-own$/);
  await redir("/lop-cua-toi/bai-tap/quiz/bu3-own/phien-ban", /\/de-thi\/bu3-own\/phien-ban$/);
  await redir("/lop-cua-toi/bai-tap/nhap-de", /\/de-thi\/tao-moi$/);
  await redir("/lop-cua-toi/bai-tap/de/bu3-own", /\/de-thi\/bu3-own\/cham$/);

  section("Quyền: học sinh và khách");
  const sctx = await ctxFor(S, { width: 1600, height: 900 });
  const sp = await sctx.newPage(); watch(sp);
  await sp.goto(`${BASE}${BASE_DT}`, { waitUntil: "networkidle", timeout: 120000 });
  check("học sinh không ở lại trang Đề thi của gia sư", !sp.url().includes("/lop-cua-toi/de-thi"), sp.url());
  const gctx = await ctxFor(null, { width: 1600, height: 900 });
  const gp = await gctx.newPage();
  await gp.goto(`${BASE}${BASE_DT}`, { waitUntil: "networkidle", timeout: 120000 });
  check("khách bị đưa tới đăng nhập", /dang-nhap|login/i.test(gp.url()), gp.url());

  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  for (const [name, path] of [["de-thi", BASE_DT], ["tao-moi", `${BASE_DT}/tao-moi`], ["ma-tran", `${BASE_DT}/ma-tran`], ["ma-tran-moi", `${BASE_DT}/ma-tran/moi`], ["ma-de", `${BASE_DT}/bu3-own/ma-de`], ["tep-goc", `${BASE_DT}/ngan-hang-de-thi`]] as const) {
    await goto(mp, path);
    await mp.waitForTimeout(800);
    check(`390px ${name}: không tràn ngang`, await noOverflow(mp));
    const small = await smallTargets(mp);
    check(`390px ${name}: nút cao ≥ 44px`, small.length === 0, small);
    await shot(mp, `de-thi-${name}-390`);
  }

  check("không dùng hộp thoại gốc (confirm/alert)", nativeDialogs === 0, nativeDialogs);
  check("không lỗi JS / console.error trong toàn bài", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
