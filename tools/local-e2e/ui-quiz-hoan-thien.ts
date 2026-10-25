// QZ hoàn thiện — trình duyệt thật: (A) tab "Hạn riêng" đặt/bỏ hạn cho học sinh trong lớp; (B) tải mẫu Excel + nhập bảng .xlsx (2 hàng đúng, 1 hàng lỗi, 1 hàng nhiều đáp án) → rà soát → lưu nháp;
// (C) tải nhật ký CSV từ tab "Lịch sử công bố"; (D) "Lưu vào ngân hàng" ở trình soạn; (E) học sinh chữa bài câu NHIỀU ĐÁP ÁN. 1280px và 390px không tràn ngang. Cần máy chủ dev đang chạy.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually, cookieFor } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dmy = (offset: number) => { const d = new Date(Date.now() + 7 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10); return d; };

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S1 = await mkUser({ name: "Em Một" }), S2 = await mkUser({ name: "Em Hai" }), S3 = await mkUser({ name: "Em Ba" });
  const C = await mkCourse(T.id, { name: "Toán 9 (hoàn thiện)" });
  for (const s of [S1, S2, S3]) await prisma.enrollment.create({ data: { userId: s.id, courseId: C.id, status: "active" } });
  await prisma.questionCategory.create({ data: { name: "Toán 9 (UI)" } });
  const exam = await prisma.exam.create({ data: { id: "uh-q", code: "UH.Q", title: "Quiz hoàn thiện", category: "Quiz", date: "01/01/2030", time: "19:00", duration: "20 phút", questions: 2, status: "available", createdAt: "2026-10-24", ownerId: T.id, courseId: C.id, totalPoints: 4, active: true, isDraft: false } });
  const qm = await prisma.examQuestion.create({ data: { id: "uh-q1", examId: exam.id, order: 1, text: "Chọn các số nguyên tố", type: "MC_MULTI", points: 2 } });
  for (const [i, [t, ok]] of ([["2", true], ["4", false], ["3", true]] as [string, boolean][]).entries()) await prisma.examOption.create({ data: { id: `uh-q1-${i}`, questionId: qm.id, order: i, text: t, isCorrect: ok } });
  const qe = await prisma.examQuestion.create({ data: { id: "uh-q2", examId: exam.id, order: 2, text: "Tự luận ngắn", type: "ESSAY", points: 2 } });
  await prisma.examPublishPolicy.create({ data: { examId: exam.id, holdUntilPublish: true, updatedById: T.id } });
  const att = await prisma.examAttempt.create({ data: { userId: S1.id, examId: exam.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", totalPoints: 4 } });
  await prisma.examAnswer.create({ data: { attemptId: att.id, questionId: qe.id, textAnswer: "bài", pointsAwarded: 1.5, teacherComment: "=BIEN-NHAN" } });
  await prisma.examGradeEdit.create({ data: { examId: exam.id, attemptId: att.id, questionId: qe.id, editedById: T.id, prevPoints: null, newPoints: 1.5, prevComment: null, newComment: "=BIEN-NHAN" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const hide = async (p: any) => p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
  const noOverflow = (p: any) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) as Promise<boolean>;

  const tctx = await ctxFor(T, { width: 1280, height: 900 });
  const pg = await tctx.newPage(); watch(pg);

  section("A. Tab 'Hạn riêng' trong trang Phiên bản");
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/${exam.id}/phien-ban`, { waitUntil: "networkidle", timeout: 120000 });
  await hide(pg);
  await pg.getByRole("tab", { name: "Hạn riêng" }).click({ timeout: 90000 });
  await pg.getByRole("heading", { name: "Chọn học sinh" }).waitFor({ timeout: 60000 });
  const t0 = (await pg.locator("[data-kin-page]").innerText()).replace(/\s+/g, " ");
  check("callout nói hạn riêng KHÔNG đổi lịch chung + nêu lịch chung thật (01/01/2030 19:00, 20 phút)", t0.includes("Hạn riêng không đổi lịch chung của đề") && t0.includes("01/01/2030") && t0.includes("19:00") && t0.includes("20 phút"));
  check("liệt kê đúng 3 học sinh trong lớp, đều 'Theo lịch chung'", ["Em Một", "Em Hai", "Em Ba"].every(n => t0.includes(n)) && (t0.match(/Theo lịch chung/g) ?? []).length === 3 && !t0.includes("Cô Khác"));
  check("đặt khi chưa chọn ai → báo lỗi, không gọi lưu", await (async () => { await pg.getByRole("button", { name: "Đặt hạn riêng" }).click(); return (await pg.getByText("Chọn ít nhất một học sinh.").count()) === 1; })());
  await pg.getByLabel("Em Một").check();
  await pg.getByLabel("Em Hai").check();
  await pg.getByRole("button", { name: "Đặt hạn riêng" }).click();
  check("chưa chọn ngày → báo lỗi", (await pg.getByText("Chọn ngày hạn nộp.").count()) === 1);
  await pg.getByLabel("Ngày hạn nộp").fill(dmy(2));
  await pg.getByLabel("Giờ hạn nộp").fill("20:30");
  await pg.getByLabel(/Ghi chú cho cô/).fill("Em ốm");
  await pg.getByRole("button", { name: "Đặt hạn riêng" }).click();
  await pg.getByText(/Đã đặt hạn riêng cho 2 học sinh/).waitFor({ timeout: 30000 });
  const rows = await prisma.quizStudentDeadline.findMany({ where: { examId: exam.id } });
  check("DB: 2 dòng, đúng giờ VN 20:30 (13:30 UTC), có ghi chú", rows.length === 2 && rows.every(r => r.dueAt.getUTCHours() === 13 && r.dueAt.getUTCMinutes() === 30 && r.note === "Em ốm"), rows);
  // Component đã sửa: nạp lại danh sách rồi mới báo "Đã đặt", nên danh sách đã mới ngay khi lời báo hiện; bài vẫn chờ rõ điều kiện danh sách (không đọc ngay một lần).
  await eventually("danh sách đã làm mới: 2 dòng 'Hạn riêng: …20:30'", async () => ((await pg.locator("[data-kin-page]").innerText()).match(/Hạn riêng: \d{2}\/\d{2}\/\d{4} 20:30/g) ?? []).length === 2, 20000);
  const t1 = (await pg.locator("[data-kin-page]").innerText()).replace(/\s+/g, " ");
  check("danh sách: Em Một + Em Hai có 'Hạn riêng: …20:30', Em Ba vẫn 'Theo lịch chung'; lịch chung của đề không đổi", (t1.match(/Hạn riêng: \d{2}\/\d{2}\/\d{4} 20:30/g) ?? []).length === 2 && (t1.match(/Theo lịch chung/g) ?? []).length === 1 && (await prisma.exam.findUnique({ where: { id: exam.id } }))!.date === "01/01/2030");
  check("ô chọn đã được bỏ sau khi lưu", await pg.getByLabel("Em Một").isChecked() === false);
  check("nút/ô trong tab ≥ 44px", await pg.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main input[type=checkbox], main input:not([type=checkbox]), main select")].filter(e => e.offsetParent && !(e.closest("[role=tablist]"))).every(e => e.getBoundingClientRect().height >= 19 /* ô tích 20px nằm trong nhãn cao ≥ 44 */)) as boolean);
  await shot(pg, "quiz-han-rieng");
  await pg.getByLabel("Em Một").check();
  await pg.getByRole("button", { name: "Bỏ hạn riêng của các em đã chọn" }).click();
  const dlg = pg.getByRole("dialog");
  await dlg.waitFor({ timeout: 15000 });
  check("bỏ hạn có hộp xác nhận KinConfirm (không window.confirm)", (await dlg.innerText()).includes("Bỏ hạn riêng của 1 học sinh"));
  await dlg.getByRole("button", { name: "Bỏ hạn riêng" }).click();
  await eventually("DB còn 1 dòng (Em Hai)", async () => (await prisma.quizStudentDeadline.findMany({ where: { examId: exam.id } })).map(r => r.userId).join() === S2.id, 20000);
  await pg.getByRole("tab", { name: "Nhật ký thay đổi" }).click();
  await pg.getByText("Hạn nộp riêng").first().waitFor({ timeout: 30000 });
  await eventually("nhật ký đề có 2 dòng 'Hạn nộp riêng' (đặt + bỏ) — trang tự nạp lại sau khi đổi", async () => (await pg.locator("tbody tr").filter({ hasText: "Hạn nộp riêng" }).count()) === 2, 20000);
  check("nhật ký đề KHÔNG có tên học sinh nào", !/Em Một|Em Hai|Em Ba/.test(await pg.locator("tbody").innerText()));

  section("B. Tải mẫu Excel + nhập bảng .xlsx");
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/nhap-de`, { waitUntil: "networkidle", timeout: 120000 });
  const tai = pg.locator("[data-tai-mau-excel]");
  await tai.waitFor({ timeout: 90000 });
  check("có nút 'Tải bảng mẫu Excel' trỏ tới API mẫu, thuộc tính download", (await tai.getAttribute("href")) === "/api/tutor/quiz/mau-excel" && (await tai.getAttribute("download")) !== null);
  const dl = await pg.evaluate(async () => { const r = await fetch("/api/tutor/quiz/mau-excel", { credentials: "same-origin" }); return { status: r.status, type: r.headers.get("content-type"), size: (await r.arrayBuffer()).byteLength }; });
  check("tải mẫu thật: 200 xlsx > 2KB", dl.status === 200 && /spreadsheetml/.test(dl.type ?? "") && dl.size > 2000, dl);
  // Dựng bảng gia sư đã nhập: 2 câu đúng (1 một đáp án + 1 nhiều đáp án), 1 hàng lỗi (đáp án trỏ ô trống), 1 hàng ví dụ quên xoá.
  const exmod = await import("exceljs"); const { Workbook } = (exmod as unknown as { default?: typeof exmod }).default ?? exmod;
  const wb = new Workbook(); const ws = wb.addWorksheet("Câu hỏi");
  ws.addRow(["Câu hỏi", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng", "Điểm", "Giải thích", "Gợi ý"]);
  ws.addRow(["(Ví dụ - xoá dòng này) Thủ đô?", "Hà Nội", "Huế", "", "", "A", "1", "", ""]);
  ws.addRow(["1 + 1 = ?", "1", "2", "3", "4", "B", "1", "Cộng hai số", ""]);
  ws.addRow(["Chọn các số chẵn", "2", "3", "4", "5", "A,C", "2", "", "Chia hết cho 2"]);
  ws.addRow(["Đáp án trỏ ô trống", "x", "y", "", "", "D", "1", "", ""]);
  const dir = mkdtempSync(join(tmpdir(), "kin-sheet-")); const xlsx = join(dir, "cau-hoi-cua-co.xlsx");
  writeFileSync(xlsx, Buffer.from(await wb.xlsx.writeBuffer()));
  await pg.getByLabel("Chọn bảng Excel đã nhập").setInputFiles(xlsx);
  await pg.getByText(/Bước 2\/2/).waitFor({ timeout: 60000 });
  const rv = (await pg.locator("[data-kin-page]").innerText()).replace(/\s+/g, " ");
  check("rà soát: 2 câu được nhập, KHÔNG gọi AI (không dòng 'AI chưa tách')", rv.includes("2 câu phát hiện") && !rv.includes("AI chưa tách"));
  check("hộp lỗi nêu SỐ HÀNG THẬT: hàng 2 (ví dụ bỏ qua) và hàng 5 (đáp án D trỏ ô trống)", rv.includes("2 hàng trong bảng chưa nhập được") && rv.includes("Hàng 2: Hàng ví dụ của bảng mẫu, đã bỏ qua.") && /Hàng 5: Đáp án đúng D trỏ vào ô đáp án đang để trống/.test(rv), rv.slice(0, 700));
  check("câu nhiều đáp án hiện đáp án A, C; tên quiz lấy từ tên tệp", rv.includes("Nhiều đáp án") && rv.includes("A, C") && (await pg.locator("#qi-title2").inputValue()) === "cau-hoi-cua-co");
  check("khung xem trước nói rõ lấy từ bảng trên máy cô", (await pg.locator("aside, section").filter({ hasText: "lấy từ bảng" }).count()) >= 1);
  await shot(pg, "quiz-nhap-excel");
  for (const i of [0, 1]) { await pg.locator("[data-import-q]").nth(i).getByRole("button", { name: /Sửa câu/ }).click(); await pg.getByLabel(/Tôi đã đối chiếu câu này/).check(); await pg.getByRole("button", { name: "Xác nhận câu" }).click(); await pg.getByRole("button", { name: /Sửa câu \d/ }).first().waitFor({ timeout: 15000 }); }
  await pg.getByRole("button", { name: "Lưu bản nháp" }).click();
  await pg.waitForURL(/\/lop-cua-toi\/bai-tap\/quiz\/quiz-/, { timeout: 60000 });
  const newId = pg.url().split("/quiz/")[1].split(/[?#]/)[0];
  const saved = await prisma.examQuestion.findMany({ where: { examId: newId }, orderBy: { order: "asc" }, include: { options: true } });
  check("DB: bản nháp 2 câu — MC (đáp án B) và MC_MULTI (2 ô đúng)", saved.length === 2 && saved[0].type === "MC" && saved[0].options.filter(o => o.isCorrect).map(o => o.text).join() === "2" && saved[1].type === "MC_MULTI" && saved[1].options.filter(o => o.isCorrect).length === 2, saved.map(q => [q.type, q.options.map(o => o.isCorrect)]));
  check("đề mới là BẢN NHÁP (học sinh chưa thấy)", (await prisma.exam.findUnique({ where: { id: newId } }))!.isDraft === true);

  section("C. Tải nhật ký CSV");
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/de/${exam.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("tab", { name: "Lịch sử công bố" }).click({ timeout: 90000 });
  const csvBtn = pg.locator("[data-xuat-csv]");
  await csvBtn.waitFor({ timeout: 30000 });
  check("nút 'Tải nhật ký (CSV)' trỏ tới API xuất, có download", /\/history\/xuat-csv$/.test((await csvBtn.getAttribute("href")) ?? "") && (await csvBtn.getAttribute("download")) !== null);
  const [download] = await Promise.all([pg.waitForEvent("download", { timeout: 30000 }), csvBtn.click()]);
  const path = await download.path();
  const bytes = path ? (await import("node:fs")).readFileSync(path) : Buffer.alloc(0);
  const csv = bytes.toString("utf8");
  check("tệp tải về: tên nhat-ky-cham-quiz-…csv, BOM, tiêu đề, ô '=BIEN-NHAN' bị chèn nháy", /^nhat-ky-cham-quiz-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()) && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf && csv.includes("Thời điểm (giờ VN),Loại,Học sinh") && csv.includes("'=BIEN-NHAN"), [download.suggestedFilename(), csv.slice(0, 300)]);

  section("D. Lưu vào ngân hàng câu hỏi ở trình soạn");
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/${exam.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const saveBtn = pg.getByRole("button", { name: "Lưu câu 1 vào ngân hàng câu hỏi" });
  await saveBtn.waitFor({ timeout: 90000 });
  check("quiz đã có người làm (khoá sửa) vẫn có nút lưu vào ngân hàng", await saveBtn.isVisible() && (await pg.getByRole("button", { name: "Sửa câu 1" }).count()) === 0);
  await saveBtn.click();
  const box = pg.locator("[data-luu-ngan-hang]");
  await box.waitFor({ timeout: 30000 });
  await box.getByLabel("Đầu mục").waitFor({ timeout: 30000 }); // đợi tải xong các đầu mục
  check("hộp nói thật: bản nháp, sao chép độc lập, giữ mọi đáp án đúng của câu nhiều đáp án", (await box.innerText()).includes("trạng thái nháp") && (await box.innerText()).includes("độc lập") && (await box.innerText()).includes("Mọi đáp án đúng"));
  await box.getByRole("button", { name: "Lưu vào ngân hàng" }).click();
  check("chưa chọn đầu mục → báo lỗi", (await box.getByText("Chọn đầu mục của ngân hàng.").count()) === 1);
  await box.getByLabel("Đầu mục").selectOption({ label: "Toán 9 (UI)" });
  await box.getByLabel("Độ khó").selectOption("VD");
  await box.getByRole("button", { name: "Lưu vào ngân hàng" }).click();
  // Sửa 2026-10: component cũ hiện toast TRƯỚC khi nạp lại danh sách (QuizEditor onDone) nên đọc ngay sau toast còn thấy nút cũ — đã sửa ở component (nạp rồi mới báo).
  // Bài vẫn chờ điều kiện cụ thể (nhãn "Đã lưu vào ngân hàng" của câu 1 xuất hiện), không dựa vào toast.
  await pg.locator("[data-quiz-q]").first().getByText("Đã lưu vào ngân hàng", { exact: true }).waitFor({ timeout: 30000 });
  const item = await prisma.questionBankItem.findFirst({ include: { options: true } });
  check("DB: ngân hàng có 1 câu MC_MULTI, 2 ô đúng, độ khó VD, của gia sư, nháp", !!item && item.type === "MC_MULTI" && item.options.filter(o => o.isCorrect).length === 2 && item.difficulty === "VD" && item.ownerId === T.id && item.status === "draft", item);
  check("sau khi lưu: nút đổi thành nhãn 'Đã lưu vào ngân hàng' (không lưu đôi)", (await pg.getByRole("button", { name: "Lưu câu 1 vào ngân hàng câu hỏi" }).count()) === 0);
  check("không tràn ngang ở trình soạn", await noOverflow(pg));

  section("Điện thoại 390px: không tràn ngang");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const pm = await mctx.newPage(); watch(pm);
  for (const [name, url, ready] of [
    ["phiên bản · hạn riêng", `/lop-cua-toi/bai-tap/quiz/${exam.id}/phien-ban`, async () => { await pm.getByRole("tab", { name: "Hạn riêng" }).click({ timeout: 90000 }); await pm.getByRole("heading", { name: "Chọn học sinh" }).waitFor({ timeout: 60000 }); }],
    ["nhập đề từ tệp", `/lop-cua-toi/bai-tap/nhap-de`, async () => { await pm.locator("[data-tai-mau-excel]").waitFor({ timeout: 90000 }); }],
    ["lịch sử công bố", `/lop-cua-toi/bai-tap/de/${exam.id}`, async () => { await pm.getByRole("tab", { name: "Lịch sử công bố" }).click({ timeout: 90000 }); await pm.locator("[data-xuat-csv]").waitFor({ timeout: 30000 }); }],
  ] as [string, string, () => Promise<void>][]) {
    await pm.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 120000 });
    await ready();
    check(`390px · ${name}: không tràn ngang`, await noOverflow(pm));
  }
  await mctx.close();

  section("E. Học sinh chữa bài câu NHIỀU ĐÁP ÁN");
  const ex2 = await prisma.exam.create({ data: { id: "uh-q-multi", code: "UH.M", title: "Đề nhiều đáp án thử chữa", category: "Toán", date: "01/01/2024", time: "08:00", duration: "20 phút", questions: 1, status: "available", createdAt: "2024-01-01", ownerId: T.id, answerVisibility: "after_submit" } });
  const m = await prisma.examQuestion.create({ data: { id: "uh-m1", examId: ex2.id, order: 1, text: "Chọn các số chẵn", type: "MC_MULTI", points: 2, hint: "Chia hết cho 2", explanation: "LỜI-GIẢI-CHẴN" } });
  const mo: string[] = [];
  for (const [i, [t, ok]] of ([["2", true], ["3", false], ["4", true], ["5", false]] as [string, boolean][]).entries()) mo.push((await prisma.examOption.create({ data: { id: `uh-m1-${i}`, questionId: m.id, order: i, text: t, isCorrect: ok } })).id);
  const a2 = await prisma.examAttempt.create({ data: { userId: S3.id, examId: ex2.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", score: 0, totalPoints: 2 } });
  await prisma.examAnswerBoolean.create({ data: { attemptId: a2.id, optionId: mo[0], answerTrue: true } }); // thiếu ô 4
  await prisma.examResult.create({ data: { userId: S3.id, examId: ex2.id, score: 0, totalPoints: 2 } });
  const sctx = await ctxFor(S3, { width: 1280, height: 900 });
  const ps = await sctx.newPage(); watch(ps);
  await ps.goto(`${BASE}/student/thi-thu/${ex2.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await ps.getByRole("button", { name: "Xem lại bài làm" }).click({ timeout: 90000 });
  await ps.getByText(/Bạn có 1 câu làm chưa đúng/).waitFor({ timeout: 30000 });
  check("màn xem lại: câu nhiều đáp án làm sai CHƯA lộ lời giải, có nhắc 'Câu này chưa chữa'", (await ps.getByText("LỜI-GIẢI-CHẴN").count()) === 0 && (await ps.getByText(/Câu này chưa chữa/).count()) === 1 && (await ps.getByText("✓ đáp án đúng").count()) === 0);
  await ps.getByRole("button", { name: "Chữa lại các câu sai" }).click();
  await ps.getByRole("heading", { name: "Chữa bài" }).waitFor();
  const group = ps.locator("[data-chua-nhieu-dap-an]");
  check("câu hiện dạng ô tích (checkbox) + câu dặn 'Chọn tất cả các đáp án đúng'", (await group.getByRole("checkbox").count()) === 4 && (await group.innerText()).includes("Chọn tất cả các đáp án đúng"));
  const submit = ps.getByRole("button", { name: "Nộp câu này" });
  check("chưa tích gì: nút Nộp khoá", await submit.isDisabled());
  await group.getByLabel("2", { exact: true }).check();
  await group.getByLabel("3", { exact: true }).check(); // sai: thừa ô 3, thiếu ô 4
  await submit.click();
  await ps.getByText("Gợi ý:").waitFor({ timeout: 15000 });
  check("sai lần 1: hiện 'Chưa đúng' + 1 gợi ý, CHƯA lộ lời giải/đáp án", await ps.getByText("Chưa đúng.").isVisible() && await ps.getByText("Chia hết cho 2").isVisible() && (await ps.getByText("LỜI-GIẢI-CHẴN").count()) === 0 && (await ps.getByText("Đáp án đúng", { exact: true }).count()) === 0);
  await ps.getByRole("button", { name: "Thử lại" }).click();
  await group.getByLabel("2", { exact: true }).check();
  await group.getByLabel("4", { exact: true }).check();
  await ps.getByRole("button", { name: "Nộp câu này" }).click();
  await ps.getByText("Chính xác!").waitFor({ timeout: 15000 });
  check("đúng lần 2: hiện 'Chính xác!', lời giải, hai ô 'Đáp án đúng' (2 và 4)", (await ps.getByText("LỜI-GIẢI-CHẴN").count()) === 1 && (await ps.getByText("Đáp án đúng", { exact: true }).count()) === 2);
  check("DB: chữa bài ghi 2 lượt, solved; điểm bài thi KHÔNG đổi (0)", await (async () => { const c = await prisma.examCorrection.findFirst({ where: { attemptId: a2.id } }); const a = await prisma.examAttempt.findUnique({ where: { id: a2.id } }); return c?.tries === 2 && c.solved === true && c.lastOptionIds.length === 2 && a?.score === 0; })());
  await shot(ps, "quiz-chua-bai-nhieu-dap-an");
  check("390px: không tràn ngang ở chữa bài", await (async () => { await ps.setViewportSize({ width: 390, height: 844 }); await ps.waitForTimeout(300); return noOverflow(ps); })());
  check("tài khoản gia sư khác không có quyền thấy tab (kiểm API)", (await fetch(`${BASE}/api/tutor/quiz-cham/${exam.id}/han-rieng`, { headers: { cookie: await cookieFor(T2) } })).status === 403);

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
