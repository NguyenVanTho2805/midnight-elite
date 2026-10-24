// QZ-03/04/05/07 — trình duyệt thật: gia sư soạn quiz (nhiều đáp án, tự luận có tiêu chí), phát hành, quiz đã có người làm → phiên bản mới,
// trang so sánh phiên bản, nhập đề từ tệp (AI được GIẢ ở tầng mạng: Playwright trả JSON mẫu cho /api/exams/ai-extract-questions, không gọi Gemini thật).
// 1280px và 390px; không tràn ngang; nút ≥ 44px; không lỗi JS. Dữ liệu dựng riêng (wipe ở đầu bài).
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S = await mkUser({ name: "Em An" });
  const course = await mkCourse(T.id, { name: "Toán 9 (soạn quiz)" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: course.id, status: "active" } });

  // Quiz đã có người làm (v1) — dựng bằng DB để không phụ thuộc đường soạn
  const base = { category: "Quiz", date: "01/01/2030", time: "19:00", duration: "15 phút", status: "upcoming", createdAt: "x", ownerId: T.id, courseId: course.id };
  await prisma.exam.create({ data: { ...base, id: "ui-q-v1", code: "UI.Q1", title: "Kiểm tra 15 phút", active: true, questions: 2, totalPoints: 2 } });
  for (const [i, ok] of [[1, 1], [2, 2]] as const) {
    await prisma.examQuestion.create({ data: { id: `ui-q-v1-${i}`, examId: "ui-q-v1", order: i, type: "MC", text: `Câu ${i}. $x^2 = ${i * 4}$ khi:`, points: 1, options: { create: ["A", "B", "C", "D"].map((t, k) => ({ id: `ui-o-${i}-${k}`, order: k, text: `Đáp án ${t}`, isCorrect: k + 1 === ok })) } } });
  }
  await prisma.examAttempt.create({ data: { userId: S.id, examId: "ui-q-v1", expiresAt: new Date(Date.now() + 60_000), status: "submitted", submittedAt: new Date(), score: 1, totalPoints: 2 } });
  await prisma.exam.create({ data: { ...base, id: "ui-q-other", code: "UI.Q2", ownerId: T2.id, title: "Quiz của cô khác", active: false, isDraft: true, questions: 0 } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon/i.test(m.text())) errors.push(m.text()); }); };
  const noOverflow = (p: any) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const smallTargets = (p: any) => p.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main a[class*='min-h'], [data-kin-page] button")].filter(b => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 43.5 && !b.closest("[role=tablist]") && !b.closest("[data-feedback-toolbar]")).map(b => (b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 30)));

  section("Tạo quiz và soạn câu — máy tính 1280px");
  const dctx = await ctxFor(T, { width: 1280, height: 900 });
  const pg = await dctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  check("trang Bài tập có 'Tạo quiz' và 'Nhập đề từ tệp'", await pg.getByRole("link", { name: "Tạo quiz" }).isVisible() && await pg.getByRole("link", { name: "Nhập đề từ tệp" }).isVisible());
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/moi`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Tạo quiz", level: 1 }).waitFor({ timeout: 90000 });
  check("nút tạo khoá khi chưa có tên", await pg.getByRole("button", { name: "Tạo và soạn câu hỏi" }).isDisabled());
  await pg.getByLabel("Tên quiz *").fill("Quiz thử UI · Phương trình bậc hai");
  await pg.getByLabel("Lớp (chọn sau cũng được)").selectOption({ label: "Toán 9 (soạn quiz)" });
  await pg.getByRole("button", { name: "Tạo và soạn câu hỏi" }).click();
  await pg.waitForURL(/\/lop-cua-toi\/bai-tap\/quiz\/quiz-/, { timeout: 60000 });
  const qid = pg.url().split("/quiz/")[1].split(/[?#]/)[0];
  await pg.getByRole("heading", { name: "Quiz thử UI · Phương trình bậc hai", level: 1 }).waitFor({ timeout: 60000 });
  check("quiz mới là BẢN NHÁP, chưa có câu: trạng thái rỗng có lời giải thích + việc làm tiếp", await pg.getByText("Bản nháp · chưa phát hành").first().isVisible() && await pg.getByText("Quiz chưa có câu nào").isVisible() && await pg.getByRole("button", { name: "Thêm câu đầu tiên" }).isVisible());

  await pg.getByRole("button", { name: "Thêm câu đầu tiên" }).click();
  await pg.getByRole("radio", { name: "Nhiều đáp án" }).click();
  check("chưa điền gì: dòng trạng thái báo lỗi bằng chữ, nút Lưu bị khoá", /Thiếu nội dung/.test(await pg.getByRole("status").filter({ hasText: /Thiếu|Hợp lệ|Cần|Đánh dấu/ }).first().innerText()) && await pg.getByRole("button", { name: "Lưu câu hỏi" }).isDisabled());
  await pg.getByLabel("Nội dung câu hỏi *").fill("Chọn tất cả các giá trị của $x$ thỏa mãn $x^2 = 4$.");
  await pg.getByLabel("Điểm tối đa").fill("2");
  const texts = ["x = −2", "x = 2", "x = 4", "x = 0"];
  for (let i = 0; i < 4; i++) await pg.getByLabel(`Nội dung đáp án ${"ABCD"[i]}`).fill(texts[i]);
  await pg.getByLabel("Đáp án A là đáp án đúng").check();
  check("mới tích 1 đáp án: vẫn hợp lệ (1 đáp án đúng), dòng ghi '1 đáp án đúng'", /Hợp lệ · 1 đáp án đúng, tổng 2 điểm/.test(await pg.getByText(/^Hợp lệ ·/).first().innerText()));
  await pg.getByLabel("Đáp án B là đáp án đúng").check();
  check("tích 2 đáp án: 'Hợp lệ · 2 đáp án đúng, tổng 2 điểm' (như Figma)", await pg.getByText("Hợp lệ · 2 đáp án đúng, tổng 2 điểm").isVisible());
  check("hiện quy tắc điểm rõ ràng: không chấm từng phần, không trừ điểm âm", await pg.getByText(/không trừ điểm âm/i).isVisible() && await pg.getByText(/không chấm từng phần/i).isVisible());
  for (const l of ["C", "D"]) await pg.getByLabel(`Đáp án ${l} là đáp án đúng`).check();
  check("tích cả 4 ô: báo lỗi 'không thể đánh dấu đúng cả mọi lựa chọn' và khoá nút Lưu", await pg.getByText(/không thể đánh dấu đúng cả mọi/i).isVisible() && await pg.getByRole("button", { name: "Lưu câu hỏi" }).isDisabled());
  for (const l of ["C", "D"]) await pg.getByLabel(`Đáp án ${l} là đáp án đúng`).uncheck();
  const prev = pg.getByRole("complementary", { name: "Xem như học sinh" });
  check("bản xem như học sinh: có ô tích ☐, KHÔNG có dấu đáp án đúng", await prev.isVisible() && (await prev.innerText()).includes("☐") && !/✓|Đáp án đúng:/.test(await prev.innerText()) && /không hiện ở bản học sinh/.test(await prev.innerText()));
  check("không tràn ngang khi đang soạn", await noOverflow(pg));
  await shot(pg, "quiz-soan-nhieu-dap-an-1280");
  await pg.getByRole("button", { name: "Lưu câu hỏi" }).click();
  await pg.getByText("Đã thêm câu hỏi").waitFor({ timeout: 30000 });
  const dbq = await prisma.examQuestion.findMany({ where: { examId: qid }, include: { options: true } });
  check("DB: 1 câu MC_MULTI, 2 đáp án đúng, điểm 2; tổng điểm quiz = 2", dbq.length === 1 && dbq[0].type === "MC_MULTI" && dbq[0].options.filter(o => o.isCorrect).length === 2 && dbq[0].points === 2 && (await prisma.exam.findUnique({ where: { id: qid } }))?.totalPoints === 2);
  check("danh sách hiện 'Câu 1.' kèm 'Nhiều đáp án · 2 điểm · Đáp án: A, B'", /Nhiều đáp án · 2 điểm · Đáp án: A, B/.test((await pg.getByRole("list", { name: "Danh sách câu hỏi" }).innerText()).replace(/\s+/g, " ")));

  // Tự luận có tiêu chí
  await pg.getByRole("button", { name: "+ Thêm câu" }).click();
  await pg.getByRole("radio", { name: "Tự luận" }).click();
  await pg.getByLabel("Nội dung câu hỏi *").fill("Giải $x^2 - 5x + 6 = 0$ bằng cách phân tích thành nhân tử.");
  await pg.getByLabel("Hướng dẫn cho học sinh").fill("Viết lời giải rõ ràng, nêu kết luận.");
  await pg.getByLabel("Hướng dẫn chấm · chỉ cô xem").fill("GUI-CHAM-RIENG-UI");
  for (const [i, [n, p]] of ([["Phương pháp", "4"], ["Tính toán", "4"], ["Trình bày", "1"]] as const).entries()) {
    await pg.getByRole("button", { name: "+ Thêm tiêu chí" }).click();
    await pg.getByLabel(`Tên tiêu chí ${i + 1}`).fill(n);
    await pg.getByLabel(`Điểm của tiêu chí ${i + 1}`).fill(p);
  }
  check("tổng tiêu chí 9 ≠ 10: báo lỗi nêu cả hai số, nút Lưu khoá", await pg.getByText(/Tổng điểm các tiêu chí \(9\) phải bằng điểm của câu \(10\)/).isVisible() && await pg.getByRole("button", { name: "Lưu câu hỏi" }).isDisabled());
  await pg.getByLabel("Điểm của tiêu chí 3").fill("2");
  check("sửa lại thành 4+4+2: hợp lệ · chấm thủ công; có chữ 'Không tự quy thành 0 điểm'", await pg.getByText(/Hợp lệ · 3 tiêu chí chấm, tổng 10 điểm · chấm thủ công/).isVisible() && await pg.getByText("Không tự quy thành 0 điểm").isVisible());
  check("bản học sinh có hướng dẫn cho học sinh nhưng KHÔNG có hướng dẫn chấm", (await prev.innerText()).includes("Viết lời giải rõ ràng") && !(await prev.innerText()).includes("GUI-CHAM-RIENG-UI"));
  await pg.getByRole("button", { name: "Lưu câu hỏi" }).click();
  await pg.getByText("Đã thêm câu hỏi").waitFor({ timeout: 30000 });

  // Đáp án và phát hành
  await pg.getByRole("tab", { name: "Đáp án và phát hành" }).click();
  const table = (await pg.getByRole("table", { name: "Đáp án đúng và điểm của từng câu" }).innerText()).replace(/\s+/g, " ");
  check("bảng đáp án: câu 1 nhiều đáp án 'A, B', câu 2 tự luận 'Chấm thủ công · 3 tiêu chí'; tổng 12 điểm", /A, B/.test(table) && /Chấm thủ công · 3 tiêu chí/.test(table) && /2 câu · 12 điểm/.test((await pg.locator("body").innerText()).replace(/\s+/g, " ")), table);
  check("đã chọn lớp từ bước tạo: 'Đủ điều kiện phát hành'", await pg.getByText("Đủ điều kiện phát hành.").isVisible());
  await pg.getByLabel("Lớp", { exact: true }).selectOption({ value: "" });
  await pg.getByRole("button", { name: "Lưu cài đặt" }).click();
  await pg.getByText("Đã lưu cài đặt").waitFor({ timeout: 30000 });
  check("gỡ lớp: nút Phát hành khoá và nêu lý do bằng chữ", await pg.getByRole("button", { name: "Phát hành quiz" }).isDisabled() && await pg.getByText(/Chọn lớp sẽ làm quiz này/).isVisible());
  await pg.getByLabel("Lớp", { exact: true }).selectOption({ label: "Toán 9 (soạn quiz)" });
  await pg.getByLabel("Ngày mở").fill("2026-11-05");
  await pg.getByLabel("Thời lượng (phút)").fill("20");
  await pg.getByRole("button", { name: "Lưu cài đặt" }).click();
  await pg.getByText("Đã lưu cài đặt").waitFor({ timeout: 30000 });
  check("DB: ngày 05/11/2026, 20 phút", await (async () => { const e = await prisma.exam.findUnique({ where: { id: qid } }); return e?.date === "05/11/2026" && e.duration === "20 phút" && e.courseId === course.id; })());
  await pg.getByRole("button", { name: "Phát hành quiz" }).click();
  const dlg = pg.getByRole("dialog");
  await dlg.waitFor({ timeout: 15000 });
  await dlg.getByRole("button", { name: "Phát hành", exact: true }).click();
  await pg.getByText("Đã phát hành quiz").waitFor({ timeout: 30000 });
  check("phát hành: DB hết nháp + active; học sinh có thông báo", await (async () => { const e = await prisma.exam.findUnique({ where: { id: qid } }); return !!e && !e.isDraft && e.active && (await prisma.notification.count({ where: { userId: S.id, type: "exam_new" } })) === 1; })());
  check("hết nháp: mục Phát hành biến mất", await pg.getByRole("button", { name: "Phát hành quiz" }).count() === 0);

  section("Quiz đã có người làm: không sửa đè → phiên bản mới");
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/ui-q-v1`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Kiểm tra 15 phút", level: 1 }).waitFor({ timeout: 90000 });
  check("hộp 'Đã có 1 lượt làm — KiN không sửa đè' + nút Tạo phiên bản mới", await pg.getByText(/Đã có 1 lượt làm — KiN không sửa đè/).isVisible() && await pg.getByRole("button", { name: "Tạo phiên bản mới" }).isVisible());
  check("KHÔNG có nút Sửa / Bỏ / + Thêm câu (mọi ô sửa bị khoá)", await pg.getByRole("button", { name: /^Sửa câu/ }).count() === 0 && await pg.getByRole("button", { name: /^Bỏ câu/ }).count() === 0 && await pg.getByRole("button", { name: "+ Thêm câu" }).count() === 0);
  await pg.getByRole("tab", { name: "Đáp án và phát hành" }).click();
  check("tab cài đặt: các ô bị khoá, không có 'Lưu cài đặt'", await pg.getByLabel("Tên quiz").isDisabled() && await pg.getByRole("button", { name: "Lưu cài đặt" }).count() === 0);
  await pg.getByRole("tab", { name: /Nội dung đề/ }).click();
  await pg.getByLabel("Lý do chỉnh (không bắt buộc, ghi vào nhật ký)").fill("Câu 2 sai đáp án gốc");
  await pg.getByRole("button", { name: "Tạo phiên bản mới" }).click();
  await pg.waitForURL(u => /\/quiz\/quiz-/.test(u.toString()), { timeout: 60000 });
  await pg.getByText("Bản đề xuất v2").waitFor({ timeout: 60000 });
  const v2id = pg.url().split("/quiz/")[1].split(/[?#]/)[0];
  const v2db = await prisma.exam.findUnique({ where: { id: v2id } });
  check("sang bản nháp v2 (cùng chuỗi, nháp, có lý do); v1 còn nguyên", !!v2db && v2db.isDraft && v2db.rootExamId === "ui-q-v1" && v2db.versionNo === 2 && v2db.versionNote === "Câu 2 sai đáp án gốc" && (await prisma.examQuestion.count({ where: { examId: "ui-q-v1" } })) === 2 && (await prisma.examAttempt.count({ where: { examId: "ui-q-v1" } })) === 1);
  check("trong v2 có nút Sửa (bản nháp sửa tự do)", await pg.getByRole("button", { name: "Sửa câu 2" }).isVisible());
  await pg.getByRole("button", { name: "Sửa câu 2" }).click();
  await pg.getByLabel("Đáp án D là đáp án đúng").check();
  await pg.getByRole("button", { name: "Lưu câu hỏi" }).click();
  await pg.getByText("Đã lưu câu hỏi").waitFor({ timeout: 30000 });
  check("v1 KHÔNG đổi sau khi sửa v2 (đáp án đúng câu 2 của v1 vẫn là B)", (await prisma.examOption.findFirst({ where: { questionId: "ui-q-v1-2", isCorrect: true } }))?.text === "Đáp án B");

  section("Trang so sánh phiên bản");
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/ui-q-v1/phien-ban`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Chỉnh sửa và phiên bản quiz", level: 1 }).waitFor({ timeout: 90000 });
  await pg.getByText("Thay đổi so với bản đang dùng").waitFor({ timeout: 60000 });
  const body = (await pg.locator("body").innerText()).replace(/\s+/g, " ");
  check("v1 đang giữ nguyên (1 lượt, 1 bài nộp); bản đề xuất v2; câu 2 'đổi đáp án hoặc điểm'", /v1 đang được giữ nguyên/.test(body) && /1 lượt bắt đầu, 1 bài nộp/.test(body) && /Bản đề xuất/.test(body) && /Đã sửa · đổi đáp án hoặc điểm/.test(body), body.slice(0, 600));
  check("nêu cách áp dụng an toàn: không âm thầm đổi đáp án của lượt cũ", /không âm thầm đổi đáp án, đề hay điểm của lượt cũ/.test(body));
  check("có nút 'Soạn và phát hành bản đề xuất' và 'Bỏ đề xuất'", await pg.getByRole("link", { name: "Soạn và phát hành bản đề xuất" }).isVisible() && await pg.getByRole("button", { name: "Bỏ đề xuất" }).isVisible());
  await pg.getByRole("tab", { name: "Nhật ký thay đổi" }).click();
  check("nhật ký có dòng 'Soạn đề xuất phiên bản mới' kèm tên người thực hiện", /Soạn đề xuất phiên bản mới/.test((await pg.getByRole("table", { name: "Nhật ký thay đổi của quiz" }).innerText())) && /Cô Lan/.test(await pg.getByRole("table", { name: "Nhật ký thay đổi của quiz" }).innerText()));
  await shot(pg, "quiz-phien-ban-1280");

  section("Quyền và địa chỉ sai");
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/ui-q-other`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByText("Không tìm thấy quiz này").waitFor({ timeout: 60000 });
  check("quiz của gia sư khác: lời giải thích + đường đi tiếp (không lộ tên quiz, không trắng)", !(await pg.locator("body").innerText()).includes("Quiz của cô khác") && await pg.getByRole("link", { name: "Về Bài tập" }).isVisible());
  await pg.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/khong-co-ma-nay/phien-ban`, { waitUntil: "networkidle", timeout: 120000 });
  check("mã không có → cũng lời giải thích + liên kết đi tiếp", await pg.getByText("Không tìm thấy quiz này").isVisible() && await pg.getByRole("link", { name: "Về Bài tập" }).isVisible());
  const sctx = await ctxFor(S, { width: 1280, height: 900 });
  const sp = await sctx.newPage(); watch(sp);
  await sp.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/${qid}`, { waitUntil: "networkidle", timeout: 120000 });
  check("học sinh mở trang soạn quiz → không vào được (bị đưa sang trang học sinh, không thấy trình soạn)", !/\/bai-tap\/quiz\//.test(sp.url()) && await sp.getByRole("button", { name: "Lưu cài đặt" }).count() === 0, sp.url());

  section("Nhập đề từ tệp — hai bước (AI giả ở tầng mạng)");
  const ip = await dctx.newPage(); watch(ip);
  await ip.route("**/api/tutor/ai-quota", r => r.fulfill({ json: { applicable: true, plan: "free", enforced: false, used: 1, limit: 5, remaining: 4 } }));
  let extractCalls = 0;
  await ip.route("**/api/exams/ai-extract-questions", async r => {
    extractCalls++;
    await new Promise(res => setTimeout(res, 600));
    await r.fulfill({ json: {
      questions: [
        { text: "Phương trình $x^2 - 5x + 6 = 0$ có hai nghiệm là:", type: "MC", options: [{ text: "1 và 6", isCorrect: false }, { text: "2 và 3", isCorrect: true }, { text: "−2 và −3", isCorrect: false }, { text: "−1 và −6", isCorrect: false }] },
        { text: "Phương trình $x^2 - 5x + 6 = 0$ có hai nghiệm là:", type: "MC", options: [{ text: "1 và 6", isCorrect: false }, { text: "2 và 3", isCorrect: true }] },
        { text: "Giải phương trình $x^2 - x - 2 = 0$ và trình bày các bước.", type: "ESSAY", options: [] },
      ],
      errors: [{ block: 8, message: "Câu 8: Phải có đúng 1 đáp án đúng" }],
    } });
  });
  await ip.goto(`${BASE}/lop-cua-toi/bai-tap/nhap-de`, { waitUntil: "networkidle", timeout: 120000 });
  await ip.getByRole("heading", { name: "Nhập đề từ tệp", level: 1 }).waitFor({ timeout: 90000 });
  check("bước 1: nói rõ chỉ tải đề gốc, không tải bài làm / tên học sinh; có dòng 'còn 4 lượt'", await ip.getByText("Chỉ tải đề gốc của cô").isVisible() && /Không tải bài làm, ảnh bài làm hay tên của học sinh/.test(await ip.locator("body").innerText()) && await ip.getByTestId("ai-quota-remaining").isVisible());
  check("chưa chọn tệp: 'Tiếp tục rà soát' khoá", await ip.getByRole("button", { name: /Tiếp tục rà soát/ }).isDisabled());
  const dir = mkdtempSync(join(tmpdir(), "qz-ui-"));
  writeFileSync(join(dir, "ghi-chu.txt"), "xin chào");
  await ip.getByLabel("Chọn tệp đề").setInputFiles(join(dir, "ghi-chu.txt"));
  check("tệp .txt → báo định dạng chưa đúng, không nhận", /chưa đúng định dạng/.test(await ip.getByRole("alert").first().innerText()) && await ip.getByRole("heading", { name: "Tệp đã chọn" }).count() === 0);
  writeFileSync(join(dir, "On-tap-phuong-trinh.png"), PNG);
  await ip.getByLabel("Chọn tệp đề").setInputFiles(join(dir, "On-tap-phuong-trinh.png"));
  await ip.getByRole("heading", { name: "Tệp đã chọn" }).waitFor({ timeout: 15000 });
  check("tệp hợp lệ: hiện tên và dung lượng, tên quiz gợi ý theo tên tệp, ảnh xem trước", await ip.getByText("On-tap-phuong-trinh.png").first().isVisible() && (await ip.getByLabel("Tên quiz nháp").first().inputValue()) === "On-tap-phuong-trinh" && await ip.getByRole("img", { name: "Ảnh đề gốc" }).count() === 1);
  await ip.getByRole("button", { name: /Tiếp tục rà soát/ }).click();
  await ip.getByText("3 câu phát hiện").waitFor({ timeout: 60000 });
  check("gọi AI đúng một lần; bước 2: 3 câu, trùng trong tệp 1, hiện cả phần AI đọc chưa trọn vẹn", extractCalls === 1 && /Trùng trong tệp: 1/.test(await ip.locator("body").innerText()) && await ip.getByText("1 phần AI đọc chưa trọn vẹn").isVisible());
  const list = ip.getByRole("list", { name: "Các câu đã tách" });
  check("danh sách: câu 1 và 2 nhắc 'trùng trong tệp'; tất cả 'Chưa xác nhận'", (await list.innerText()).match(/trùng trong tệp/g)?.length === 2 && (await list.innerText()).match(/Chưa xác nhận/g)?.length === 3);
  await ip.getByRole("button", { name: "Bỏ câu 2" }).click();
  await ip.getByRole("dialog").getByRole("button", { name: "Bỏ câu", exact: true }).click();
  await ip.getByText("2 câu phát hiện").waitFor({ timeout: 15000 });
  check("bỏ câu trùng (hỏi xác nhận trước) → còn 2 câu", true);
  await ip.getByRole("button", { name: "Sửa câu 1" }).click();
  await ip.getByRole("button", { name: "Xác nhận câu" }).click();
  check("xác nhận khi CHƯA tích 'đã đối chiếu' → bị chặn bằng chữ", await ip.getByText(/Cô tích ô “Tôi đã đối chiếu/).isVisible());
  await ip.getByLabel(/Tôi đã đối chiếu câu này/).check();
  await ip.getByRole("button", { name: "Xác nhận câu" }).click();
  await ip.getByText("Đã xác nhận: 1/2").waitFor({ timeout: 15000 });
  check("sau xác nhận: 'Đã xác nhận: 1/2'", true);
  check("lưu bản nháp cần tên: đang có tên từ tệp → nút bật", await ip.getByRole("button", { name: "Lưu bản nháp" }).isEnabled());
  await shot(ip, "quiz-nhap-de-ra-soat-1280");
  await ip.getByRole("button", { name: "Lưu bản nháp" }).click();
  await ip.waitForURL(u => /\/quiz\/quiz-/.test(u.toString()), { timeout: 60000 });
  const impId = ip.url().split("/quiz/")[1].split(/[?#]/)[0];
  await eventually("bản nháp nhập từ tệp: 2 câu, là bản nháp, nhật ký ghi tên tệp", async () => {
    const e = await prisma.exam.findUnique({ where: { id: impId }, include: { examQuestions: true } });
    const log = await prisma.examChangeLog.findFirst({ where: { examId: impId, kind: "import" } });
    return !!e && e.isDraft && e.examQuestions.length === 2 && !!log?.note?.includes("On-tap-phuong-trinh.png");
  });
  check("trình soạn mở ra bản nháp vừa lưu với 2 câu; học sinh chưa thấy", await ip.getByText("Bản nháp · chưa phát hành").first().isVisible() && (await ip.getByRole("list", { name: "Danh sách câu hỏi" }).locator("li").count()) === 2);

  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  for (const [name, path] of [["trình soạn", `/lop-cua-toi/bai-tap/quiz/${qid}`], ["quiz khoá", "/lop-cua-toi/bai-tap/quiz/ui-q-v1"], ["phiên bản", "/lop-cua-toi/bai-tap/quiz/ui-q-v1/phien-ban"], ["nhập đề", "/lop-cua-toi/bai-tap/nhap-de"], ["tạo quiz", "/lop-cua-toi/bai-tap/quiz/moi"]] as const) {
    await mp.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await mp.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 90000 });
    check(`390px ${name}: không tràn ngang`, await noOverflow(mp));
    const small = await smallTargets(mp);
    check(`390px ${name}: nút cao ≥ 44px`, small.length === 0, small);
  }
  await mp.goto(`${BASE}/lop-cua-toi/bai-tap/quiz/${v2id}`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("button", { name: "Sửa câu 2" }).click();
  await mp.getByLabel("Nội dung câu hỏi *").waitFor({ timeout: 30000 });
  check("390px đang sửa câu: không tràn ngang; nút 'Xem như học sinh' mở bản xem trước", await noOverflow(mp) && await mp.getByRole("button", { name: "Xem như học sinh" }).isVisible());
  await mp.getByRole("button", { name: "Xem như học sinh" }).click();
  check("bản xem trước hiện trên điện thoại, không lộ đáp án đúng", await mp.getByRole("complementary", { name: "Xem như học sinh" }).isVisible() && !/Đáp án đúng:/.test(await mp.getByRole("complementary", { name: "Xem như học sinh" }).innerText()));
  await shot(mp, "quiz-soan-390");

  check("không lỗi JS / console.error trong toàn bài", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
