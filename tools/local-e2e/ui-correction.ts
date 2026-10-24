import { mkUser, mkTutor, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

const MAIN = process.env.BASE ?? "http://localhost:3100"; // NC2: cổng theo BASE để chạy song song nhiều máy chủ thử
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const stu = await mkUser({ name: "Em An" });
  const eid = id("ex");
  await prisma.exam.create({ data: { id: eid, code: eid, title: "Đề Toán thử", category: "Toán", date: "01/01/2020", time: "08:00", duration: "60 phút", questions: 4, status: "available", createdAt: "2020-01-01", ownerId: tutor.id } });
  const mk = async (order: number, text: string, hint: string | null, correct: string, wrong: string[], explanation: string) => {
    const qid = id("q");
    await prisma.examQuestion.create({ data: { id: qid, examId: eid, order, text, hint, explanation, type: "MC" } });
    const c = await prisma.examOption.create({ data: { id: id("o"), questionId: qid, order: 0, text: correct, isCorrect: true } });
    const w: string[] = [];
    for (let i = 0; i < wrong.length; i++) w.push((await prisma.examOption.create({ data: { id: id("o"), questionId: qid, order: i + 1, text: wrong[i], isCorrect: false } })).id);
    return { qid, c: c.id, w };
  };
  const a = await mk(1, "2 + 3 = ?", "Đếm trên đầu ngón tay.", "5", ["4", "6"], "2 cộng 3 bằng 5.");
  const b = await mk(2, "10 − 4 = ?", null, "6", ["5", "7"], "10 trừ 4 bằng 6.");
  const c = await mk(3, "3 × 3 = ?", "Ba nhóm, mỗi nhóm ba.", "9", ["6", "12"], "3 nhân 3 bằng 9.");
  const ok = await mk(4, "1 + 1 = ?", null, "2", ["3"], "Dễ.");
  const sq = id("q");
  await prisma.examQuestion.create({ data: { id: sq, examId: eid, order: 5, text: "Căn bậc hai của 16?", hint: "Số nào bình phương bằng 16?", explanation: "Căn của 16 là 4.", type: "SHORT_ANSWER" } });
  await prisma.examOption.create({ data: { id: id("o"), questionId: sq, order: 0, text: "4", isCorrect: true } });
  const att = await prisma.examAttempt.create({ data: { userId: stu.id, examId: eid, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", score: 1, totalPoints: 5 } });
  for (const [q, o] of [[a, a.w[0]], [b, b.w[1]], [c, c.w[0]], [ok, ok.c]] as const) await prisma.examAnswer.create({ data: { attemptId: att.id, questionId: q.qid, optionId: o } });
  await prisma.examAnswer.create({ data: { attemptId: att.id, questionId: sq, textAnswer: "8" } });
  await prisma.examResult.create({ data: { userId: stu.id, examId: eid, score: 1, totalPoints: 5 } });

  await launch();
  const ctx = await ctxFor(stu);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  section("Vào màn xem lại → Chữa bài");
  await page.goto(`${MAIN}/student/thi-thu/${eid}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Xem lại bài làm" }).click({ timeout: 90000 });
  await page.getByText(/Bạn có 4 câu làm chưa đúng/).waitFor({ timeout: 30000 });
  check("báo đúng số câu sai chữa được (4: 3 trắc nghiệm + 1 điền ngắn; câu đúng không tính)", true);
  check("màn Xem lại CHƯA lộ lời giải của các câu sai, có nhắc bấm Chữa lại", (await page.getByText(/2 cộng 3 bằng 5/).count()) === 0 && (await page.getByText(/Câu này chưa chữa/).count()) === 4 && (await page.getByText("Giải thích:").count()) === 1);
  await page.getByRole("button", { name: "Chữa lại các câu sai" }).click();
  await page.getByRole("heading", { name: "Chữa bài" }).waitFor();
  check("tiêu đề 0/4 câu xong + nhắc chữa bài không đổi điểm", await page.getByText("0/4 câu đã xong").isVisible() && await page.getByText(/không đổi điểm bài thi/).isVisible());
  const steps = page.getByRole("navigation", { name: "Các câu cần chữa" }).getByRole("button");
  check("thanh bước: 4 câu (1, 2, 3, 5)", (await steps.allInnerTexts()).join("|") === "1|2|3|5", await steps.allInnerTexts());

  section("Câu 1 (có gợi ý): chưa nộp → sai lần 1 → gợi ý → đúng lần 2");
  check("chưa nộp: chưa có gợi ý, chưa có đáp án đúng", (await page.getByText(/Gợi ý:/).count()) === 0 && (await page.getByText("Đáp án đúng").count()) === 0);
  const submit = page.getByRole("button", { name: "Nộp câu này" });
  check("nút Nộp câu này khoá cho tới khi chọn", await submit.isDisabled());
  await page.getByRole("radio", { name: "4" }).check();
  check("chọn rồi: nút mở", !(await submit.isDisabled()));
  await submit.click();
  await page.getByText("Gợi ý:").waitFor({ timeout: 15000 });
  check("sai lần 1: hiện 'Chưa đúng' + MỘT gợi ý, ô đã chọn đánh dấu chữ 'Chưa đúng'", await page.getByText("Chưa đúng.").isVisible() && await page.getByText("Đếm trên đầu ngón tay.").isVisible() && (await page.getByText("Chưa đúng", { exact: true }).count()) === 1);
  check("CHƯA lộ đáp án/lời giải", (await page.getByText("Đáp án đúng").count()) === 0 && (await page.getByText("2 cộng 3 bằng 5.").count()) === 0);
  check("hai nút: Thử lại · Xem đáp án", await page.getByRole("button", { name: "Thử lại" }).isVisible() && await page.getByRole("button", { name: "Xem đáp án" }).isVisible());
  await shot(page, "correction-hint");
  await page.getByRole("button", { name: "Thử lại" }).click();
  check("Thử lại: ô chọn được mở lại, vẫn còn gợi ý", !(await page.getByRole("radio", { name: "5" }).isDisabled()) && await page.getByText("Đếm trên đầu ngón tay.").isVisible());
  await page.getByRole("radio", { name: "5" }).check();
  await page.getByRole("button", { name: "Nộp câu này" }).click();
  await page.getByText("Chính xác!").waitFor({ timeout: 15000 });
  check("đúng lần 2: 'Đáp án đúng' (chữ) + lời giải", await page.getByText("Đáp án đúng", { exact: true }).isVisible() && await page.getByText(/2 cộng 3 bằng 5\./).isVisible());
  check("hiện ô tự giải thích (đã xem gợi ý)", await page.getByLabel(/gợi ý ở trên giúp bạn ở chỗ nào/).isVisible());
  await page.getByLabel(/gợi ý ở trên giúp bạn ở chỗ nào/).fill("Đếm ngón tay giúp mình.");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByText("Đếm ngón tay giúp mình.").waitFor({ timeout: 10000 });
  await eventually("DB: lưu lời tự giải thích", async () => (await prisma.examCorrection.findFirst({ where: { questionId: a.qid } }))?.reflection === "Đếm ngón tay giúp mình.");
  check("tiến độ 1/4", await page.getByText("1/4 câu đã xong").isVisible());

  section("Câu 2 (không gợi ý): sai lần 1 là hiện đáp án luôn");
  await page.getByRole("button", { name: "Sang câu tiếp" }).click();
  await page.getByRole("radio", { name: "5" }).check();
  await page.getByRole("button", { name: "Nộp câu này" }).click();
  await page.getByText("Đây là đáp án đúng.").waitFor({ timeout: 15000 });
  check("không qua bước gợi ý: hiện đáp án + lời giải, không có nút Thử lại/Xem đáp án", (await page.getByRole("button", { name: "Thử lại" }).count()) === 0 && await page.getByText(/10 trừ 4 bằng 6/).isVisible());
  check("không có ô tự giải thích (chưa từng có gợi ý)", (await page.getByLabel(/gợi ý ở trên giúp bạn/).count()) === 0);

  section("Câu 3: Xem đáp án sau 1 lần sai");
  await page.getByRole("button", { name: "Sang câu tiếp" }).click();
  await page.getByRole("radio", { name: "12" }).check();
  await page.getByRole("button", { name: "Nộp câu này" }).click();
  await page.getByText("Ba nhóm, mỗi nhóm ba.").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Xem đáp án" }).click();
  await page.getByText("Đây là đáp án đúng.").waitFor({ timeout: 15000 });
  check("Xem đáp án → đáp án đúng (viền xanh + chữ) và lời giải", await page.getByText("Đáp án đúng", { exact: true }).isVisible() && await page.getByText(/3 nhân 3 bằng 9/).isVisible());
  await shot(page, "correction-revealed");

  section("Câu điền ngắn + hoàn thành");
  await page.getByRole("button", { name: "Sang câu tiếp" }).click();
  await page.getByLabel("Câu trả lời của bạn").fill("5");
  await page.getByRole("button", { name: "Nộp câu này" }).click();
  await page.getByText("Số nào bình phương bằng 16?").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Thử lại" }).click();
  await page.getByLabel("Câu trả lời của bạn").fill("5");
  await page.getByRole("button", { name: "Nộp câu này" }).click();
  await page.getByText("Đây là đáp án đúng.").waitFor({ timeout: 15000 });
  const ansP = page.locator("p", { hasText: "Đáp án đúng:" });
  check("lần 2 vẫn sai → hiện đáp án đúng '4' (điểm dừng 2 lần)", await ansP.isVisible() && /Đáp án đúng:\s*4/.test(await ansP.innerText()), await ansP.innerText().catch(() => ""));
  await page.getByText(/Bạn đã chữa xong 4 câu: 1 câu tự làm đúng, 3 câu đã xem đáp án/).waitFor({ timeout: 10000 });
  check("tổng kết cuối: 4 câu, 1 tự đúng, 3 xem đáp án", true);
  await page.getByRole("button", { name: "Hoàn thành" }).click();
  await page.getByText(/Bạn có 4 câu làm chưa đúng/).waitFor();
  check("Hoàn thành → về màn xem lại bài làm", true);
  await eventually("chữa xong: màn xem lại hiện lời giải của cả 4 câu sai, hết nhắc 'chưa chữa'", async () => (await page.getByText(/Câu này chưa chữa/).count()) === 0 && (await page.getByText(/2 cộng 3 bằng 5/).count()) === 1 && (await page.getByText(/3 nhân 3 bằng 9/).count()) === 1);

  section("Không đổi điểm; tải lại giữ tiến độ");
  const att2 = await prisma.examAttempt.findUnique({ where: { id: att.id } });
  const res = await prisma.examResult.findFirst({ where: { userId: stu.id, examId: eid } });
  check("điểm bài thi + kết quả nguyên (1/5)", att2?.score === 1 && res?.score === 1);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Xem lại bài làm" }).click();
  await page.getByRole("button", { name: "Chữa lại các câu sai" }).click();
  await page.getByText("4/4 câu đã xong").waitFor({ timeout: 20000 });
  check("tải lại: tiến độ vẫn 4/4", true);

  section("Điện thoại");
  const mctx = await ctxFor(stu, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${MAIN}/student/thi-thu/${eid}`, { waitUntil: "networkidle" });
  await mp.getByRole("button", { name: "Xem lại bài làm" }).click({ timeout: 60000 });
  await mp.getByRole("button", { name: "Chữa lại các câu sai" }).click();
  await mp.getByRole("heading", { name: "Chữa bài" }).waitFor();
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check("các nút bước đủ 44px", await mp.getByRole("navigation", { name: "Các câu cần chữa" }).getByRole("button").evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44 && e.getBoundingClientRect().width >= 44)));
  await shot(mp, "correction-mobile");

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
