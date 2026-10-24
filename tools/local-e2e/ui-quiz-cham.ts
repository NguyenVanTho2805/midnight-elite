// QZ-08 / QZ-06 (Figma 521:4906 máy tính, 521:6932 điện thoại): trang chấm quiz hỗn hợp của gia sư — tab, trạng thái bằng CHỮ, chấm + lưu, công bố qua hộp xác nhận,
// theo dõi, phân tích; 390px không tràn ngang, nút ≥ 44px; gia sư khác thấy lời giải thích (không phải trang trống). Cần máy chủ dev ở BASE; gọi wipe().
import { BASE, mkTutor, mkUser, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { regradeAttempt } from "@/lib/examGrading";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const ss = [await mkUser({ name: "Gia Bảo" }), await mkUser({ name: "Đỗ Hà" }), await mkUser({ name: "Minh Khôi" })];
  const ex = await prisma.exam.create({ data: { id: "ex-qc", code: "ex-qc", title: "Ôn tập tổng hợp · Toán 9", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 2, status: "available", createdAt: "2020", ownerId: T.id, totalPoints: 10 } });
  const q1 = await prisma.examQuestion.create({ data: { id: "qc-1", examId: ex.id, order: 1, text: "Câu trắc nghiệm", type: "MC", points: 1 } });
  const ok = await prisma.examOption.create({ data: { id: "qc-1a", questionId: q1.id, order: 0, text: "đúng", isCorrect: true } });
  const q2 = await prisma.examQuestion.create({ data: { id: "qc-2", examId: ex.id, order: 2, text: "Giải x² − 5x + 6 = 0 bằng phân tích nhân tử.", type: "ESSAY", points: 2, explanation: "x ∈ {2; 3}" } });
  await prisma.examPublishPolicy.create({ data: { examId: ex.id, holdUntilPublish: true } });
  const atts: string[] = [];
  for (const [i, s] of ss.entries()) {
    const a = await prisma.examAttempt.create({ data: { userId: s.id, examId: ex.id, expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", totalPoints: 3, tabSwitchCount: i } });
    await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: q1.id, optionId: ok.id } });
    await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: q2.id, textAnswer: `Bài làm của ${s.name}: (x − 2)(x − 3) = 0`, ...(i === 2 ? { pointsAwarded: 1.5, teacherComment: "Tốt" } : {}) } });
    await regradeAttempt(a.id); atts.push(a.id);
  }
  const url = `${BASE}/lop-cua-toi/bai-tap/de/${ex.id}`;

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const ctx = await ctxFor(T, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);

  section("Máy tính: bài nộp, trạng thái bằng chữ");
  await pg.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: "Ôn tập tổng hợp · Toán 9" }).waitFor({ timeout: 90000 });
  check("có đủ 5 tab", (await pg.getByRole("tab").count()) === 5, await pg.getByRole("tab").allTextContents());
  await pg.getByText("Danh sách bài nộp").waitFor({ timeout: 30000 });
  const body = async () => (await pg.locator("body").innerText());
  let t = await body();
  check("hiện 'Chờ chấm' và 'Đã chấm' bằng chữ (màu không nói một mình)", /Chờ chấm/.test(t) && /Đã chấm/.test(t));
  check("tên học sinh hiện cho gia sư chủ", /Gia Bảo/.test(t) && /Đỗ Hà/.test(t) && /Minh Khôi/.test(t));
  check("khách quan 1 / 1 và đang giữ điểm đến khi công bố", /1 \/ 1/.test(t) && /Đang giữ điểm đến khi cô công bố/.test(t));
  await shot(pg, "quiz-cham-bai-nop");

  section("Chấm một bài: nhập điểm, lưu, trạng thái đổi");
  await pg.getByRole("button", { name: "Chấm bài" }).first().click();
  await pg.getByLabel(/^Điểm \/ 2/).waitFor({ timeout: 30000 });
  check("hiện bài làm và đáp án tham khảo chỉ cô xem", /Bài làm của/.test(await body()) && /Đáp án tham khảo/.test(await body()));
  await pg.getByLabel(/^Điểm \/ 2/).fill("3");
  await pg.getByRole("button", { name: "Lưu điểm" }).click();
  await eventually("điểm vượt tối đa báo lỗi, không lưu", async () => /Điểm phải từ 0 đến 2/.test(await body()));
  await pg.getByLabel(/^Điểm \/ 2/).fill("1,5");
  await pg.getByLabel(/^Phản hồi cho/).fill("Em phân tích đúng.");
  await pg.getByRole("button", { name: "Lưu điểm" }).click();
  await eventually("lưu xong báo 'học sinh chưa thấy' khi đang giữ điểm", async () => /Học sinh chưa thấy gì cho tới khi cô công bố/.test(await body()));
  const saved = await prisma.examAnswer.findFirst({ where: { questionId: q2.id, pointsAwarded: 1.5, teacherComment: "Em phân tích đúng." } });
  check("DB có điểm 1,5 và nhận xét", !!saved);
  await shot(pg, "quiz-cham-cham");

  section("Công bố từng em qua hộp xác nhận");
  await eventually("nút 'Công bố cho em này' bấm được sau khi chấm", async () => await pg.getByRole("button", { name: "Công bố cho em này" }).isEnabled());
  await pg.getByRole("button", { name: "Công bố cho em này" }).click();
  await pg.getByRole("button", { name: "Công bố", exact: true }).click();
  await eventually("sau công bố có dòng công bố", async () => (await prisma.examAttemptPublish.count({ where: { examId: ex.id } })) === 1);

  section("Theo dõi, phân tích, lịch sử");
  await pg.getByRole("tab", { name: "Theo dõi lượt làm" }).click();
  await eventually("liệt kê 3 học sinh, có số lần rời tab", async () => /Học sinh đã làm · 3/.test(await body()) && /rời tab 2 lần/.test(await body()));
  await pg.getByRole("tab", { name: "Phân tích kết quả" }).click();
  await eventually("phân tích hiện phân bố điểm và từng câu", async () => /Phân bố điểm/.test(await body()) && /Câu 1 · Trắc nghiệm/.test(await body()));
  check("phân tích KHÔNG chứa tên học sinh", !/Gia Bảo|Đỗ Hà|Minh Khôi/.test(await body()));
  await pg.getByRole("tab", { name: "Lịch sử công bố" }).click();
  await eventually("lịch sử có phần đã công bố và sửa điểm", async () => /Đã công bố · 1/.test(await body()) && /Lịch sử sửa điểm/.test(await body()));

  section("Điện thoại 390px");
  const m = await ctxFor(T, { width: 390, height: 844 });
  const mp = await m.newPage(); watch(mp);
  await mp.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByText("Danh sách bài nộp").waitFor({ timeout: 90000 });
  await mp.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }); // thanh công cụ dev (agentation) không phải của trang — nút của nó thấp là bình thường
  const over = async () => mp.evaluate(`document.documentElement.scrollWidth - window.innerWidth`) as Promise<number>;
  check("bài nộp: không tràn ngang", (await over()) <= 0, await over());
  const small = await mp.locator("button:visible, a:visible").evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 44 && !e.closest("nav") && !e.closest("[role=tablist]") && !e.hasAttribute("data-nextjs-dev-tools-button") && !(e.getAttribute("aria-label") ?? "").startsWith("KiN —"); }) /* bỏ nút công cụ dev của Next và logo vỏ gia sư: không thuộc trang chấm */.map(e => `${(e.textContent ?? "").trim().slice(0, 30)}:${Math.round(e.getBoundingClientRect().height)}`));
  check("mọi nút/liên kết trong trang cao ≥ 44px", small.length === 0, small);
  await mp.getByRole("button", { name: "Chấm bài" }).first().click();
  await mp.getByLabel(/^Điểm \/ 2/).waitFor({ timeout: 30000 });
  check("màn chấm: không tràn ngang", (await over()) <= 0, await over());
  await shot(mp, "quiz-cham-mobile");
  for (const tab of ["Theo dõi lượt làm", "Phân tích kết quả", "Lịch sử công bố"]) { await mp.getByRole("tab", { name: tab }).click(); await mp.waitForTimeout(400); check(`tab '${tab}': không tràn ngang`, (await over()) <= 0, await over()); }

  section("Gia sư khác: lời giải thích rõ, không phải trang trống; liên kết quay lại sống");
  const c2 = await ctxFor(T2, { width: 1280, height: 900 });
  const p2 = await c2.newPage(); watch(p2);
  await p2.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await p2.getByText("Đề này không phải của cô").waitFor({ timeout: 60000 });
  check("không lộ tên học sinh / tên đề cho gia sư khác", !/Gia Bảo|Ôn tập tổng hợp/.test(await p2.locator("body").innerText()));
  await p2.getByRole("link", { name: "Về Bài tập" }).click();
  await p2.waitForURL(/\/lop-cua-toi\/bai-tap$/, { timeout: 60000 });
  check("'Về Bài tập' đi tới trang Bài tập", true);

  section("Trang Bài tập của gia sư chủ: đề hiện 'Chờ chấm' và có lối vào chấm");
  const lp = await ctx.newPage(); watch(lp);
  await lp.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await lp.getByText("Ôn tập tổng hợp · Toán 9").first().waitFor({ timeout: 90000 });
  await lp.locator("[data-bai-tap-row]").first().click();
  await lp.getByRole("link", { name: "Chấm và theo dõi" }).click();
  await lp.waitForURL(new RegExp(`/bai-tap/de/${ex.id}$`), { timeout: 60000 });
  check("'Chấm và theo dõi' mở đúng trang chấm của đề", true);

  check("không có lỗi JS/console", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})();
