// BU-03 P1 — trình duyệt thật: Ngân hàng câu hỏi (cây Môn›Lớp›Chương›YCCĐ + ma trận chương × mức + kho của tôi / chung / tất cả) và Nhập Word (không AI).
// 1600px và 390px; không tràn ngang; nút ≥ 44px (loại overlay dev của Next nextjs-portal và KinToast ra khỏi phép đo); ba trạng thái (đang tải / lỗi + Thử lại / rỗng).
// Phần Ngân hàng dùng API thật (/api/tutor/ngan-hang/thong-ke — tut-code) trên dữ liệu dựng riêng. Phần Nhập Word: bước ĐỌC tệp (parser Word) và LƯU được GIẢ ở tầng mạng
// (Playwright trả JSON đúng hợp đồng BU-03 mục P1.3/P1.4), vì parser Word đã có bài t-azota-docx-lib/t-bank-word-import riêng; ở đây kiểm giao diện: cờ đỏ chặn lưu,
// sửa câu, đặt mức, gom theo mức khi lưu, và KHÔNG gọi API AI. Chỉ VIẾT — kin-kiem-thu chạy.
import { BASE, mkTutor, mkUser, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NH = "/lop-cua-toi/de-thi/ngan-hang-cau-hoi";

// Kết quả đọc Word giả, đúng kiểu AzotaParse + images (hợp đồng BU-03 P1.3).
const opt = (text: string, isCorrect = false, subLabel?: string) => ({ text, isCorrect, ...(subLabel ? { subLabel } : {}) });
const FAKE_PARSE = {
  questions: [
    { key: "s1-1", number: 1, sectionIndex: 0, sectionLabel: "PHẦN I", type: "MC", text: "Hàm số $y = 2x + 1$ đồng biến trên:", explanation: "", difficulty: null, answerSource: "dau-gach-chan", flags: [],
      options: [opt("$\\mathbb{R}$"), opt("$(0; +\\infty)$", true), opt("$(-\\infty; 0)$"), opt("$\\{0\\}$")] },
    { key: "s1-2", number: 2, sectionIndex: 0, sectionLabel: "PHẦN I", type: "MC", text: "Giá trị nhỏ nhất của $x^2$ là:", explanation: "", difficulty: null, answerSource: "khong-co", flags: ["answer_conflict"],
      options: [opt("0"), opt("1"), opt("−1"), opt("2")] },
    { key: "s2-1", number: 1, sectionIndex: 1, sectionLabel: "PHẦN II", type: "TRUE_FALSE_CLUSTER", text: "Cho hàm số $f(x) = x^3$. Mệnh đề nào đúng?", explanation: "", difficulty: "VD", answerSource: "bang-het", flags: [],
      options: [opt("f đồng biến trên R", true, "a"), opt("f có cực trị", false, "b"), opt("f(0) = 0", true, "c"), opt("f' luôn dương", false, "d")] },
    { key: "s1-3", number: 3, sectionIndex: 0, sectionLabel: "PHẦN I", type: "MC", text: "Tính giá trị của biểu thức ⟦công thức⟧ khi $x = 2$.", explanation: "", difficulty: null, answerSource: "bang-het", flags: ["formula_unread"],
      options: [opt("4", true), opt("5"), opt("6"), opt("7")] },
    { key: "s3-1", number: 1, sectionIndex: 2, sectionLabel: "PHẦN III", type: "SHORT_ANSWER", text: "Tính $7 \\times 2$.", explanation: "", difficulty: null, answerSource: "loi-giai", flags: [],
      options: [opt("14", true)] },
  ],
  errors: [], warnings: [{ question: "s1-9", code: "orphan_key", message: "Bảng đáp án có khoá cho câu 9 nhưng đề không có câu 9" }],
  stats: { total: 5, byType: { MC: 3, TRUE_FALSE_CLUSTER: 1, SHORT_ANSWER: 1 }, withAnswer: 4, withImage: 0, withFormulaUnread: 1 }, fatal: null, images: [],
};

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S = await mkUser({ name: "Em An" });

  // Cây: Toán › Lớp 12 › Chương 1 › {YCCĐ 1.1, YCCĐ 1.2}; Chương 2 trống.
  const mon = await prisma.questionCategory.create({ data: { name: "Toán", sortOrder: 1 } });
  const lop = await prisma.questionCategory.create({ data: { name: "Lớp 12", parentId: mon.id, sortOrder: 1 } });
  const ch1 = await prisma.questionCategory.create({ data: { name: "Chương 1 Hàm số", parentId: lop.id, sortOrder: 1 } });
  const ch2 = await prisma.questionCategory.create({ data: { name: "Chương 2 Mũ logarit", parentId: lop.id, sortOrder: 2 } });
  const y11 = await prisma.questionCategory.create({ data: { name: "YCCĐ 1.1 Tính đơn điệu", parentId: ch1.id, sortOrder: 1 } });
  const y12 = await prisma.questionCategory.create({ data: { name: "YCCĐ 1.2 Cực trị", parentId: ch1.id, sortOrder: 2 } });
  const mk = (n: number, categoryId: string, difficulty: string, status: string, ownerId: string, tag: string) =>
    prisma.questionBankItem.createMany({ data: Array.from({ length: n }, (_, i) => ({ type: "MC", text: `Câu ${tag} số ${i + 1}`, categoryId, difficulty, status, ownerId })) });
  await mk(2, y11.id, "NB", "approved", T2.id, "chung-NB");   // chung
  await mk(1, y12.id, "TH", "approved", T2.id, "chung-TH");   // chung
  await mk(1, y11.id, "VD", "approved", T.id, "cua-toi-VD");  // của tôi, đã duyệt
  await mk(1, y12.id, "VDC", "draft", T.id, "nhap-toi-VDC");  // của tôi, nháp
  await mk(5, y11.id, "NB", "draft", T2.id, "nhap-khac-NB");  // nháp gia sư khác: KHÔNG được thấy
  // Mong đợi Chương 1 — tất cả: NB2 TH1 VD1 VDC1 chưa mức 0, tổng 5 · của tôi: VD1 VDC1 tổng 2 · chung: NB2 TH1 VD1 tổng 4.

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => errors.push(String(e)));
    // Lọc lỗi có sẵn: script chủ đề ở src/app/layout.tsx làm React 19 in "Encountered a script tag…" (bản dev) — không thuộc BU-03.
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (p: any) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  // Nút nhỏ hơn 44px — không tính overlay dev của Next (nextjs-portal nằm trong shadow DOM nên querySelectorAll không chạm tới, vẫn loại tường minh) và KinToast.
  const smallTargets = (p: any) => p.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main a[class*='min-h'], main select, [data-kin-page] button")]
    .filter(b => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 43.5
      && !b.closest("nextjs-portal") && !b.closest("[data-kin-toast]") && !b.closest("[role=tablist]") && !b.closest("[data-feedback-toolbar]"))
    .map(b => (b.textContent || b.getAttribute("aria-label") || b.tagName).trim().slice(0, 30)));

  // ───────────────────────── 1600px: Ngân hàng câu hỏi ─────────────────────────
  section("Ngân hàng câu hỏi — máy tính 1600px (API thật)");
  const dctx = await ctxFor(T, { width: 1600, height: 1000 });
  const pg = await dctx.newPage(); watch(pg);
  await pg.goto(`${BASE}${NH}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Ngân hàng câu hỏi", level: 1 }).waitFor({ timeout: 90000 });
  check("có ba lối nhập: 'Nhập từ Word', 'Nhập từ PDF/ảnh (AI)', 'Soạn tay'",
    await pg.getByRole("link", { name: "Nhập từ Word" }).first().isVisible() && await pg.getByRole("link", { name: "Nhập từ PDF/ảnh (AI)" }).isVisible() && await pg.getByRole("link", { name: "Soạn tay" }).isVisible());
  check("1600px: cây hiện sẵn (không cần mở ngăn), nút 'Chọn nút' của điện thoại ẩn", await pg.getByRole("tree", { name: "Cây ngân hàng câu hỏi" }).isVisible() && !(await pg.getByRole("button", { name: /^Chọn nút/ }).isVisible()));
  await pg.getByRole("tree").getByText("Chương 1 Hàm số").first().waitFor({ timeout: 60000 });
  const treeText = (await pg.getByRole("tree").innerText()).replace(/\s+/g, " ");
  check("cây có tên tầng: 'Môn', 'Lớp', 'Chương' (không gọi Chương/Bài kiểu cũ)", /Toán Môn/.test(treeText) && /Lớp 12 Lớp/.test(treeText) && /Chương 1 Hàm số Chương/.test(treeText), treeText.slice(0, 300));
  check("tab dải 'Ngân hàng câu hỏi' đang sáng (aria-current=page, thấy được)", (await pg.locator("nav[aria-label^='Trang của'] [aria-current=page]:visible").innerText().catch(() => "")).includes("Ngân hàng câu hỏi"));

  const matrix = pg.getByRole("region", { name: /Bảng số câu theo chương và mức/ });
  const rowCells = async (name: string) => (await matrix.locator("tr", { has: pg.getByRole("button", { name, exact: true }) }).first().locator("td").allInnerTexts()).map(s => s.trim());
  await matrix.waitFor({ timeout: 60000 });
  check("kho 'Tất cả': Chương 1 = NB2 TH1 VD1 VDC1 · chưa mức 0 · tổng 5 (không tính 5 câu nháp của gia sư khác)", JSON.stringify(await rowCells("Chương 1 Hàm số")) === JSON.stringify(["2", "1", "1", "1", "0", "5"]), await rowCells("Chương 1 Hàm số"));
  check("Chương 2 trống: toàn 0", (await rowCells("Chương 2 Mũ logarit")).every(c => c === "0"));
  await pg.getByRole("button", { name: "Mở yêu cầu cần đạt của Chương 1 Hàm số" }).click();
  check("mở chương: hiện hai yêu cầu cần đạt YCCĐ 1.1 và 1.2", await matrix.getByRole("rowheader", { name: /YCCĐ 1\.1/ }).isVisible() && await matrix.getByRole("rowheader", { name: /YCCĐ 1\.2/ }).isVisible());
  await shot(pg, "ngan-hang-cau-hoi-1600");

  await pg.getByRole("tab", { name: "Kho của tôi" }).click();
  await eventually("kho 'Của tôi': Chương 1 = VD1 VDC1, tổng 2", async () => JSON.stringify(await rowCells("Chương 1 Hàm số")) === JSON.stringify(["0", "0", "1", "1", "0", "2"]));
  await pg.getByRole("tab", { name: "Kho chung" }).click();
  await eventually("kho 'Chung': chỉ câu đã duyệt — NB2 TH1 VD1, tổng 4 (không có nháp)", async () => JSON.stringify(await rowCells("Chương 1 Hàm số")) === JSON.stringify(["2", "1", "1", "0", "0", "4"]));
  await pg.getByRole("tab", { name: "Tất cả" }).click();

  await matrix.getByRole("button", { name: "Chương 1 Hàm số", exact: true }).click();
  check("chọn nút trong cây/bảng: tiêu đề nút hiện tên + tầng, có 'Nhập Word vào nút này' và 'Xem câu hỏi trong nút này'",
    await pg.getByRole("heading", { name: "Chương 1 Hàm số" }).first().isVisible() && await pg.getByRole("link", { name: "Nhập Word vào nút này" }).isVisible() && await pg.getByRole("link", { name: "Xem câu hỏi trong nút này" }).isVisible());
  check("1600px: không tràn ngang", await noOverflow(pg));
  const small16 = await smallTargets(pg);
  check("1600px: nút/ô chọn cao ≥ 44px", small16.length === 0, small16);

  section("Ba trạng thái — đang tải / lỗi + Thử lại / rỗng");
  const sp1 = await dctx.newPage(); watch(sp1);
  await sp1.route("**/api/tutor/ngan-hang/thong-ke**", async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
  await sp1.goto(`${BASE}${NH}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("đang tải số liệu: khung xương 'Đang tải số liệu' (không số liệu tạm), tiêu đề trang vẫn hiện", await sp1.getByLabel("Đang tải số liệu").waitFor({ timeout: 60000 }).then(() => true).catch(() => false) && await sp1.getByRole("heading", { name: "Ngân hàng câu hỏi", level: 1 }).isVisible());
  await sp1.getByRole("region", { name: /Bảng số câu theo chương và mức/ }).waitFor({ timeout: 60000 });
  await sp1.close();

  const sp2 = await dctx.newPage(); watch(sp2);
  let failStats = true;
  await sp2.route("**/api/tutor/ngan-hang/thong-ke**", r => failStats ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Máy chủ đang bận, thử lại sau ít phút." }) }) : r.continue());
  await sp2.goto(`${BASE}${NH}`, { waitUntil: "networkidle", timeout: 120000 });
  await sp2.getByText("Chưa tải được số liệu").waitFor({ timeout: 60000 });
  check("lỗi: câu tiếng Việt từ máy chủ + nút 'Thử lại' (role=alert), không trắng trang", /Máy chủ đang bận/.test(await sp2.locator('[role="alert"]:not(#__next-route-announcer__)').innerText()) && await sp2.getByRole("button", { name: "Thử lại" }).isVisible());
  failStats = false;
  await sp2.getByRole("button", { name: "Thử lại" }).click();
  await sp2.getByRole("region", { name: /Bảng số câu theo chương và mức/ }).waitFor({ timeout: 60000 });
  check("bấm 'Thử lại' → số liệu về, hết báo lỗi", await sp2.getByText("Chưa tải được số liệu").count() === 0);
  await sp2.close();

  const sp3 = await dctx.newPage(); watch(sp3);
  await sp3.route("**/api/question-categories", r => r.request().method() === "GET" ? r.fulfill({ json: [] }) : r.continue());
  await sp3.goto(`${BASE}${NH}`, { waitUntil: "networkidle", timeout: 120000 });
  await sp3.getByText("Ngân hàng chưa có môn nào").waitFor({ timeout: 60000 });
  check("rỗng (chưa có Môn): có lời giải thích vì sao + việc làm tiếp ('Soạn câu hỏi tay', 'Nhắn hỗ trợ')", /do quản trị KiN tạo sẵn/.test(await sp3.locator("body").innerText()) && await sp3.getByRole("link", { name: "Soạn câu hỏi tay" }).isVisible() && await sp3.getByRole("link", { name: "Nhắn hỗ trợ" }).isVisible());
  await sp3.close();

  // ───────────────────────── Nhập Word ─────────────────────────
  section("Nhập Word — 1600px (đọc và lưu được giả ở tầng mạng; AI phải KHÔNG bị gọi)");
  const wp = await dctx.newPage(); watch(wp);
  let aiCalls = 0, readCalls = 0; const saveBodies: any[] = [];
  await wp.route("**/api/exams/ai-extract-questions", r => { aiCalls++; return r.abort(); });
  await wp.route("**/api/tutor/ngan-hang/nhap-word", async r => { readCalls++; await new Promise(res => setTimeout(res, 400)); await r.fulfill({ json: FAKE_PARSE }); });
  await wp.route("**/api/tutor/ngan-hang/luu-nhieu", async r => {
    const body = r.request().postDataJSON(); saveBodies.push(body);
    const n = body.items.length, dup = 1; // giả báo 1 câu trùng trong lần gọi duy nhất
    await r.fulfill({ json: { saved: n - dup, skippedDuplicate: dup, skippedInvalid: 0, ids: Array.from({ length: n - dup }, (_, i) => `b${saveBodies.length}-${i}`) } });
  });
  await wp.goto(`${BASE}${NH}/nhap-word?nut=${ch1.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await wp.getByRole("heading", { name: "Nhập câu hỏi từ Word", level: 1 }).waitFor({ timeout: 90000 });
  check("bước 1: ghi rõ 'Không tốn lượt AI' và 'chưa có gì được ghi'; 'Đọc tệp' khoá khi chưa chọn tệp",
    await wp.getByText("Không tốn lượt AI").first().isVisible() && /chưa có gì được ghi vào ngân hàng/.test(await wp.locator("body").innerText()) && await wp.getByRole("button", { name: "Đọc tệp và xem lại" }).isDisabled());
  check("tab dải 'Ngân hàng câu hỏi' vẫn sáng ở trang nhập Word", (await wp.locator("nav[aria-label^='Trang của'] [aria-current=page]:visible").innerText().catch(() => "")).includes("Ngân hàng câu hỏi"));
  const dir = mkdtempSync(join(tmpdir(), "nh-ui-"));
  writeFileSync(join(dir, "de.pdf"), "x");
  await wp.locator('input[type="file"][accept=".docx"]').setInputFiles(join(dir, "de.pdf"));
  check("tệp không phải .docx → báo định dạng chưa đúng, không nhận", /chưa đúng định dạng/.test(await wp.locator('[role="alert"]:not(#__next-route-announcer__)').first().innerText()) && await wp.getByRole("button", { name: "Đọc tệp và xem lại" }).isDisabled());
  writeFileSync(join(dir, "De_Toan12.docx"), "PK-gia");
  await wp.locator('input[type="file"][accept=".docx"]').setInputFiles(join(dir, "De_Toan12.docx"));
  await wp.getByRole("button", { name: "Đọc tệp và xem lại" }).click();
  check("đang đọc: nút khoá và đổi chữ 'Đang đọc tệp…'", await wp.getByRole("button", { name: "Đang đọc tệp…" }).isDisabled().catch(() => false));
  await wp.getByText("5 câu đã đọc").waitFor({ timeout: 60000 });
  check("bước 2: tóm tắt 5 câu, 1 câu còn công thức chưa đọc; lưu ý orphan_key hiện bằng chữ", /5 câu đã đọc · 4 có đáp án/.test(await wp.locator("body").innerText()) && await wp.getByText(/1 câu còn công thức chưa đọc/).isVisible() && await wp.getByText(/Bảng đáp án có khoá cho câu 9/).isVisible());
  const list = wp.getByRole("list", { name: "Các câu đã đọc" });
  const rowAt = (i: number) => list.locator("> li").nth(i);
  check("mỗi câu hiện loại câu, đáp án và NGUỒN đáp án (gạch chân / bảng đáp án / lời giải / không có)",
    /Trắc nghiệm|Một đáp án/i.test(await rowAt(0).innerText()) && /nguồn: gạch chân trong đề/.test(await rowAt(0).innerText()) && /nguồn: bảng đáp án cuối đề/.test(await rowAt(2).innerText()) && /nguồn: lời giải/.test(await rowAt(4).innerText()) && /nguồn: không có/.test(await rowAt(1).innerText()));
  check("cờ đỏ bằng CHỮ: 'mâu thuẫn' (câu 2) và 'công thức chưa đọc được' (câu 3)", await rowAt(1).getByText(/mâu thuẫn, KiN không tự chọn/).isVisible() && await rowAt(3).getByText("Còn công thức chưa đọc được").isVisible());
  check("nút đích lấy từ ?nut= (Chương 1) và nhãn tầng hiện trong ô chọn", (await wp.getByLabel("Nút đích trong ngân hàng *").inputValue()) === ch1.id && /Chương 1 Hàm số · Chương/.test(await wp.getByLabel("Nút đích trong ngân hàng *").locator("option:checked").innerText()));
  // Ngân hàng cần mức cho mọi câu (luu-nhieu không đoán mức): đặt NB cho tất cả trước để các phép đếm "câu cần xử lý" bên dưới chỉ còn đếm cờ đỏ.
  await wp.getByRole("group", { name: "Đặt mức cho tất cả câu đang tích" }).getByRole("button", { name: "NB", exact: true }).click();
  const saveBtn = wp.getByRole("button", { name: /^Lưu \d+ câu vào ngân hàng/ });
  check("còn 2 câu cờ đỏ → nút Lưu KHOÁ và nói lý do bằng chữ ('Còn 2 câu cần xử lý hoặc bỏ tích')", await saveBtn.isDisabled() && await wp.getByText("Còn 2 câu cần xử lý hoặc bỏ tích.").isVisible());
  check("mỗi câu cờ đỏ nêu việc cần làm", /bấm “Sửa câu” và chọn đáp án đúng/.test(await rowAt(1).innerText()) && /Còn nhãn ⟦công thức⟧/.test(await rowAt(3).innerText()));

  // Xử lý câu 2: chọn đáp án; câu 4 (ô thứ 3 trong danh sách): gõ lại công thức
  await rowAt(1).getByRole("button", { name: "Sửa câu 2" }).click();
  await rowAt(1).getByLabel("Phương án A là đáp án đúng").check();
  check("chọn đáp án cho câu mâu thuẫn → hết lý do chặn của câu đó, còn 1 câu", !/chọn đáp án đúng/.test(await rowAt(1).innerText()) && await wp.getByText("Còn 1 câu cần xử lý hoặc bỏ tích.").isVisible());
  await rowAt(3).getByRole("button", { name: "Sửa câu 3" }).click();
  await rowAt(3).getByLabel("Nội dung câu 3").fill("Tính giá trị của biểu thức $x^2$ khi $x = 2$.");
  check("gõ lại công thức, hết nhãn ⟦công thức⟧ → mở khoá, nút Lưu bật", await saveBtn.isEnabled() && await wp.getByText(/Còn \d+ câu cần xử lý/).count() === 0);

  // BU-03 MathType: ô sửa LaTeX tay có xem trước trực tiếp; công thức không vẽ được thì khoá lưu
  await rowAt(3).getByLabel("Nội dung câu 3").fill("Tính $\\frac{1}{$ ngay.");
  check("LaTeX hỏng → báo lỗi tiếng Việt, nút Lưu khoá", await rowAt(3).getByText(/chưa vẽ được công thức/).first().isVisible() && await saveBtn.isDisabled());
  await rowAt(3).getByLabel("Nội dung câu 3").fill("Tính giá trị của biểu thức $x^2$ khi $x = 2$.");
  check("LaTeX đúng → có bản vẽ KaTeX xem trước, Lưu bật lại", await rowAt(3).locator(".katex").count() > 0 && await saveBtn.isEnabled());

  // Mức: đặt cho tất cả rồi từng câu
  await wp.getByRole("group", { name: "Đặt mức cho tất cả câu đang tích" }).getByRole("button", { name: "NB", exact: true }).click();
  check("'đặt mức cho tất cả' = NB: mọi câu có mức NB, chú thích 'Mọi câu đang tích đều có mức'", (await rowAt(0).getByLabel("Mức của câu 1").inputValue()) === "NB" && (await rowAt(4).getByLabel("Mức của câu 1").inputValue()) === "NB" && await wp.getByText("Mọi câu đang tích đều có mức.").isVisible());
  await rowAt(2).getByLabel("Mức của câu 1").selectOption("VD");
  await rowAt(4).getByLabel("Mức của câu 1").selectOption("");
  check("đặt riêng từng câu: câu Đ/S = VD, câu trả lời ngắn = chưa đặt → ngân hàng cần mức nên nút Lưu khoá và nói rõ lý do", /1 câu đang tích chưa có mức\. Ngân hàng cần mức/.test(await wp.locator("body").innerText()) && await saveBtn.isDisabled() && /Chọn mức NB \/ TH \/ VD \/ VDC cho câu này/.test(await rowAt(4).innerText()));
  await rowAt(4).getByLabel("Mức của câu 1").selectOption("TH");
  check("đặt mức cho câu còn lại → nút Lưu bật lại", await saveBtn.isEnabled());
  await shot(wp, "nhap-word-xem-lai-1600");
  check("1600px xem lại: không tràn ngang; nút ≥44px", await noOverflow(wp) && (await smallTargets(wp)).length === 0, await smallTargets(wp));

  await saveBtn.click();
  await wp.getByText(/Đã lưu \d+ câu vào ngân hàng/).waitFor({ timeout: 60000 });
  check("lưu MỘT lần gọi (mức nằm trên TỪNG câu: NB, NB, VD, NB, TH), không có defaultDifficulty, nút đích đúng, mỗi câu có type/text/options",
    saveBodies.length === 1 && saveBodies[0].categoryId === ch1.id && saveBodies[0].defaultDifficulty === undefined && saveBodies[0].items.length === 5
    && JSON.stringify(saveBodies[0].items.map((q: any) => q.difficulty)) === JSON.stringify(["NB", "NB", "VD", "NB", "TH"])
    && saveBodies[0].items.every((q: any) => q.type && q.text && Array.isArray(q.options) && !/⟦công thức⟧/.test(q.text)), saveBodies.map(b => [b.defaultDifficulty, b.items.length]));
  check("câu đã sửa được gửi đúng: đáp án A của câu 2 và nội dung câu 3 đã gõ lại", saveBodies[0].items.some((q: any) => q.text.startsWith("Giá trị nhỏ nhất") && q.options[0].isCorrect && q.options.filter((o: any) => o.isCorrect).length === 1) && saveBodies[0].items.some((q: any) => q.text === "Tính giá trị của biểu thức $x^2$ khi $x = 2$."));
  const body = (await wp.locator("body").innerText()).replace(/\s+/g, " ");
  check("kết quả: 'Đã lưu 4 câu', 1 câu trùng bỏ qua, nói rõ không tốn lượt AI; có nút 'Xem nút vừa nhập' / 'Nhập tệp khác' / 'Về ngân hàng'", /Đã lưu 4 câu vào ngân hàng/.test(body) && /1 câu trùng nội dung trong nút này đã được bỏ qua/.test(body) && /Không tốn lượt AI/.test(body)
    && await wp.getByRole("link", { name: "Xem nút vừa nhập" }).isVisible() && await wp.getByRole("link", { name: "Nhập tệp khác" }).isVisible() && await wp.getByRole("link", { name: "Về ngân hàng" }).isVisible());
  check("cả luồng Word KHÔNG gọi API AI (ai-extract-questions = 0 lần); đọc tệp đúng 1 lần", aiCalls === 0 && readCalls === 1, { aiCalls, readCalls });
  await wp.close();

  section("Nhập Word — lỗi đọc tệp và tệp không có câu");
  const ep = await dctx.newPage(); watch(ep);
  let mode: "loi" | "rong" = "loi";
  await ep.route("**/api/tutor/ngan-hang/nhap-word", r => mode === "loi"
    ? r.fulfill({ status: 413, contentType: "application/json", body: JSON.stringify({ error: "Tệp lớn hơn 4 MB. Cô tách thành các tệp nhỏ hơn.", code: "TOO_LARGE" }) })
    : r.fulfill({ json: { ...FAKE_PARSE, questions: [], stats: { total: 0, byType: {}, withAnswer: 0, withImage: 0, withFormulaUnread: 0 }, warnings: [] } }));
  await ep.goto(`${BASE}${NH}/nhap-word`, { waitUntil: "networkidle", timeout: 120000 });
  await ep.locator('input[type="file"][accept=".docx"]').setInputFiles(join(dir, "De_Toan12.docx"));
  await ep.getByRole("button", { name: "Đọc tệp và xem lại" }).click();
  await ep.getByText("Chưa đọc được tệp").waitFor({ timeout: 60000 });
  check("lỗi 413: câu tiếng Việt của máy chủ + nút 'Thử lại'; vẫn ở bước 1 (không mất tệp đã chọn)", /lớn hơn 4 MB/.test(await ep.locator('[role="alert"]:not(#__next-route-announcer__)').innerText()) && await ep.getByRole("button", { name: "Thử lại" }).isVisible() && await ep.getByText(/Đã chọn: De_Toan12\.docx/).isVisible());
  mode = "rong";
  await ep.getByRole("button", { name: "Thử lại" }).click();
  await ep.getByText("Chưa đọc được câu nào").waitFor({ timeout: 60000 });
  check("rỗng (0 câu): lời giải thích + việc làm tiếp 'Chọn tệp khác'; nút Lưu không xuất hiện thành nút bật", /không theo mẫu Azota/.test(await ep.locator("body").innerText()) && await ep.getByRole("button", { name: "Chọn tệp khác" }).first().isVisible() && await ep.getByRole("button", { name: /^Lưu \d+ câu/ }).isDisabled());
  await ep.close();

  section("Lối vào từ trang 'Nhập đề từ tệp' (PDF/ảnh AI) sang Nhập Word");
  const ip = await dctx.newPage(); watch(ip);
  await ip.goto(`${BASE}/lop-cua-toi/de-thi/tao-moi?cach=pdf`, { waitUntil: "networkidle", timeout: 120000 });
  await ip.getByRole("heading", { name: "Word theo mẫu Azota — không dùng AI" }).waitFor({ timeout: 90000 });
  await ip.getByRole("link", { name: "Nhập Word vào ngân hàng" }).click();
  await ip.waitForURL(/\/lop-cua-toi\/de-thi\/ngan-hang-cau-hoi\/nhap-word/, { timeout: 60000 });
  check("lựa chọn Word nằm cạnh PDF/ảnh/Excel và dẫn tới trang nhập Word", await ip.getByRole("heading", { name: "Nhập câu hỏi từ Word", level: 1 }).isVisible());
  await ip.close();

  section("Quyền");
  const sctx = await ctxFor(S, { width: 1600, height: 1000 });
  const sp = await sctx.newPage(); watch(sp);
  await sp.goto(`${BASE}${NH}/nhap-word`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sp.waitForURL(u => !/\/nhap-word/.test(u.toString()), { timeout: 60000 });
  check("học sinh mở trang nhập Word → bị đưa đi nơi khác, không thấy màn nhập", await sp.getByRole("heading", { name: "Nhập câu hỏi từ Word" }).count() === 0, sp.url());
  const gctx = await ctxFor(null, { width: 1600, height: 1000 });
  const gp = await gctx.newPage(); watch(gp);
  await gp.goto(`${BASE}${NH}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await gp.waitForURL(u => /dang-nhap/.test(u.toString()), { timeout: 60000 });
  check("khách mở ngân hàng → về trang đăng nhập", /dang-nhap/.test(gp.url()), gp.url());
  void T2;

  // ───────────────────────── 390px ─────────────────────────
  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(`${BASE}${NH}`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Ngân hàng câu hỏi", level: 1 }).waitFor({ timeout: 90000 });
  await mp.getByRole("region", { name: /Bảng số câu theo chương và mức/ }).waitFor({ timeout: 60000 });
  check("390px: cây nằm trong ngăn — ẩn lúc đầu, nút 'Chọn nút' hiện", !(await mp.getByRole("tree").isVisible().catch(() => false)) && await mp.getByRole("button", { name: /^Chọn nút/ }).isVisible());
  check("390px ngân hàng: không tràn ngang (ma trận cuộn ngang trong thẻ, không kéo cả trang)", await noOverflow(mp));
  check("390px: bảng ma trận là vùng cuộn ngang có nhãn (tabindex=0)", (await mp.getByRole("region", { name: /Bảng số câu theo chương và mức/ }).getAttribute("tabindex")) === "0");
  await mp.getByRole("button", { name: /^Chọn nút/ }).click();
  await mp.getByRole("tree").waitFor({ timeout: 15000 });
  check("mở ngăn 'Chọn nút': cây hiện, không tràn ngang, nút cao ≥44px", await mp.getByRole("tree").isVisible() && await noOverflow(mp) && (await smallTargets(mp)).length === 0, [await smallTargets(mp), await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, off: [...document.querySelectorAll<HTMLElement>("body *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest("nextjs-portal")).slice(0, 6).map(e => e.tagName + "." + String(e.className).slice(0, 60) + " r=" + Math.round(e.getBoundingClientRect().right) + " w=" + Math.round(e.getBoundingClientRect().width)) }))]);
  await mp.getByRole("tree").getByRole("button", { name: /^Chương 1 Hàm số/ }).first().click();
  check("chọn nút xong ngăn tự đóng, tiêu đề nút hiện", !(await mp.getByRole("tree").isVisible()) && await mp.getByRole("heading", { name: "Chương 1 Hàm số" }).first().isVisible());
  await shot(mp, "ngan-hang-cau-hoi-390");

  await mp.route("**/api/tutor/ngan-hang/nhap-word", r => r.fulfill({ json: FAKE_PARSE }));
  await mp.goto(`${BASE}${NH}/nhap-word?nut=${ch1.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Nhập câu hỏi từ Word", level: 1 }).waitFor({ timeout: 90000 });
  check("390px nhập Word bước 1: không tràn ngang; nút ≥44px", await noOverflow(mp) && (await smallTargets(mp)).length === 0, [await smallTargets(mp), await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, off: [...document.querySelectorAll<HTMLElement>("body *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest("nextjs-portal")).slice(0, 6).map(e => e.tagName + "." + String(e.className).slice(0, 60) + " r=" + Math.round(e.getBoundingClientRect().right) + " w=" + Math.round(e.getBoundingClientRect().width)) }))]);
  await mp.locator('input[type="file"][accept=".docx"]').setInputFiles(join(dir, "De_Toan12.docx"));
  await mp.getByRole("button", { name: "Đọc tệp và xem lại" }).click();
  await mp.getByText("5 câu đã đọc").waitFor({ timeout: 60000 });
  const mlist = mp.getByRole("list", { name: "Các câu đã đọc" });
  await mlist.locator("> li").nth(1).getByRole("button", { name: "Sửa câu 2" }).click();
  await mlist.locator("> li").nth(3).getByRole("button", { name: "Sửa câu 3" }).click();
  check("390px xem lại (danh sách thẻ, đang sửa 2 câu): không tràn ngang; nút ≥44px; thanh Lưu cố định đáy thấy được", await noOverflow(mp) && (await smallTargets(mp)).length === 0 && await mp.getByRole("button", { name: /^Lưu \d+ câu vào ngân hàng/ }).isVisible(), await smallTargets(mp));
  check("390px: nút Lưu vẫn khoá khi còn cờ đỏ (khoá cả trên điện thoại)", await mp.getByRole("button", { name: /^Lưu \d+ câu vào ngân hàng/ }).isDisabled());
  await shot(mp, "nhap-word-xem-lai-390");

  // BU-03 MathType: công thức hiện bằng ảnh (token {{ctimg:…}}), chip trong ô sửa, nhãn MathType, KiN đoán LaTeX
  const svgTok = "{{ctimg:" + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="gray"/></svg>').toString("base64") + "}}";
  const IMG_PARSE = { ...FAKE_PARSE, questions: [{ key: "s1-1", number: 1, sectionIndex: 0, sectionLabel: "PHẦN I", type: "MC", text: `Tính ${svgTok} biết $x=1$.`, explanation: "", difficulty: "NB", answerSource: "bang-het", flags: ["formula_image", "formula_mathtype"],
    latexUnverified: [{ imgToken: svgTok, latex: "\\frac{1}{2}" }], options: [opt("1", true), opt("2"), opt("3"), opt("4")] }],
    stats: { total: 1, byType: { MC: 1 }, withAnswer: 1, withImage: 0, withFormulaUnread: 0 }, warnings: [] };
  await mp.unroute("**/api/tutor/ngan-hang/nhap-word");
  await mp.route("**/api/tutor/ngan-hang/nhap-word", r => r.fulfill({ json: IMG_PARSE }));
  await mp.goto(`${BASE}${NH}/nhap-word?nut=${ch1.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator('input[type="file"][accept=".docx"]').setInputFiles(join(dir, "De_Toan12.docx"));
  await mp.getByRole("button", { name: "Đọc tệp và xem lại" }).click();
  await mp.getByText("1 câu đã đọc").waitFor({ timeout: 60000 });
  const irow = mp.getByRole("list", { name: "Các câu đã đọc" }).locator("> li").first();
  check("công thức ảnh: hiện <img> (không chuỗi base64 thô), 2 nhãn cờ (ảnh + MathType)", await irow.locator('img[alt="công thức (ảnh)"]').count() >= 1 && !/ctimg/.test(await irow.innerText()) && await irow.getByText(/hiện bằng ảnh — cô có thể sửa thành LaTeX/).isVisible() && await irow.getByText("Công thức đọc từ MathType — kiểm lại").isVisible());
  check("KiN đoán: hiện ảnh gốc cạnh bản đọc và nút dùng", await irow.getByText("KiN đọc là (chưa chắc đúng)").isVisible() && await irow.getByRole("button", { name: "Dùng công thức KiN đọc" }).isVisible());
  await irow.getByRole("button", { name: "Sửa câu 1" }).click();
  check("ô sửa hiện chip '[ảnh công thức 1]', không dán base64", (await irow.getByLabel("Nội dung câu 1").inputValue()).includes("[ảnh công thức 1]") && !(await irow.getByLabel("Nội dung câu 1").inputValue()).includes("ctimg"));
  await irow.getByRole("button", { name: "Dùng công thức KiN đọc" }).click();
  check("bấm dùng: ảnh được thay bằng $LaTeX$, vẽ KaTeX", (await irow.getByLabel("Nội dung câu 1").inputValue()).includes("$\\frac{1}{2}$") && await irow.locator(".katex").count() > 0 && await irow.locator('img[alt="công thức (ảnh)"]').count() === 0);
  check("390px công thức ảnh: không tràn ngang; nút ≥44px", await noOverflow(mp) && (await smallTargets(mp)).length === 0, [await smallTargets(mp), await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, off: [...document.querySelectorAll<HTMLElement>("body *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest("nextjs-portal")).slice(0, 6).map(e => e.tagName + "." + String(e.className).slice(0, 60) + " r=" + Math.round(e.getBoundingClientRect().right) + " w=" + Math.round(e.getBoundingClientRect().width)) }))]);

  check("không lỗi JS / console.error trong toàn bài (đã lọc lỗi script chủ đề có sẵn của React 19)", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
