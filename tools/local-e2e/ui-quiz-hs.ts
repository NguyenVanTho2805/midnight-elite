// Học sinh làm quiz hỗn hợp (QZ-11): cổng vào đề → phòng làm → tự lưu nháp → hộp xác nhận liệt kê câu chưa làm → "đã nộp, chờ chấm" KHÔNG điểm;
// học sinh ngoài lớp bị chặn ở cổng; hết giờ → màn "Hết giờ"; 390px không tràn. Cần máy chủ đang chạy.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" });
  const X = await mkUser({ name: "Em Xa" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const ex = await prisma.exam.create({ data: { id: "uq-mix", code: "uq-mix", title: "Ôn tập tổng hợp", category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 3, status: "available", createdAt: "2020", ownerId: T.id, courseId: C.id, totalPoints: 10 } });
  const q1 = await prisma.examQuestion.create({ data: { id: "uq-1", examId: ex.id, order: 1, text: "Hai nghiệm có tổng bằng?", type: "MC", points: 1 } });
  for (const [i, t] of ["5", "6"].entries()) await prisma.examOption.create({ data: { id: `uq-1-${i}`, questionId: q1.id, order: i, text: t, isCorrect: i === 0 } });
  const q2 = await prisma.examQuestion.create({ data: { id: "uq-2", examId: ex.id, order: 2, text: "Câu trắc nghiệm thứ hai", type: "MC", points: 1 } });
  for (const [i, t] of ["Có", "Không"].entries()) await prisma.examOption.create({ data: { id: `uq-2-${i}`, questionId: q2.id, order: i, text: t, isCorrect: i === 0 } });
  const q3 = await prisma.examQuestion.create({ data: { id: "uq-3", examId: ex.id, order: 3, text: "Giải x² − 5x + 6 = 0 và trình bày các bước", type: "ESSAY", points: 2 } });
  await prisma.quizAttemptLimit.create({ data: { examId: ex.id, maxAttempts: 1 } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const hide = async (p: any) => p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });

  section("Học sinh ngoài lớp: cổng chặn, có đường tới nhập mã lớp");
  const cx = await ctxFor(X, { width: 1280, height: 900 });
  const px = await cx.newPage(); watch(px);
  await px.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await px.getByText("Em chưa vào lớp của đề này").waitFor({ timeout: 90000 });
  check("nút bắt đầu bị khoá", await px.getByRole("button", { name: /Bắt đầu làm bài/ }).isDisabled());
  check("có link 'Nhập mã lớp' tới /student/nhap-ma-lop", (await px.getByRole("link", { name: "Nhập mã lớp" }).getAttribute("href")) === "/student/nhap-ma-lop");
  await cx.close();

  section("Cổng vào đề của học sinh trong lớp");
  const c1 = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await c1.newPage(); watch(pg);
  await pg.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).waitFor({ timeout: 90000 });
  await hide(pg);
  const gateText = await pg.locator("main, body").first().innerText();
  check("hiện tên lớp 'Toán 9', '15 phút', 'Lượt 1/1'", gateText.includes("Toán 9") && gateText.includes("15 phút") && gateText.includes("Lượt 1/1"), gateText.slice(0, 300));
  check("nói rõ đồng hồ theo giờ máy chủ và tự luận chờ công bố", gateText.includes("giờ máy chủ KiN") && gateText.includes("gia sư công bố"));
  await shot(pg, "quiz-hs-cong");

  section("Phòng làm: tự lưu nháp tự luận");
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  const area = pg.getByRole("textbox", { name: /Giải x²/ });
  await area.waitFor({ timeout: 60000 });
  const clock0 = await pg.getByRole("timer").innerText();
  check("đồng hồ chạy theo hạn máy chủ (còn 14–15 phút)", /^1[45]:\d\d$/.test(clock0) || clock0 === "15:00" || /^14:\d\d$/.test(clock0), clock0);
  check("trước khi gõ: dòng nháp nói tự lưu khi ngừng gõ", (await pg.locator("[data-trang-thai-nhap]").innerText()).includes("tự lưu"));
  await area.fill("(x−2)(x−3)=0 ⇒ x=2 hoặc x=3");
  await eventually("sau ~1,2 giây: 'Bản nháp đã lưu trên máy chủ' + DB có chữ", async () => (await pg.locator("[data-trang-thai-nhap]").innerText()).includes("đã lưu trên máy chủ") && (await prisma.examAnswer.findFirst({ where: { questionId: q3.id } }))?.textAnswer?.includes("x=2") === true, 20000);
  check("không bao giờ hiện 'đã chấm' / điểm trong phòng làm", !(await pg.locator("body").innerText()).match(/đã chấm|Điểm tổng:/));

  section("Hộp xác nhận liệt kê câu chưa làm");
  await pg.getByText("5", { exact: true }).first().click(); // câu 1
  await pg.locator("footer").getByRole("button", { name: "Nộp bài" }).click();
  const dlg = pg.getByRole("dialog", { name: "Nộp bài ngay?" });
  await dlg.waitFor({ timeout: 15000 });
  const dt = (await dlg.innerText()).replace(/\s+/g, " ");
  check("ghi 'Em còn 1 câu chưa làm: Câu 2.' + tự luận chờ chấm + không sửa lại được", dt.includes("Em còn 1 câu chưa làm: Câu 2.") && dt.includes("chờ gia sư chấm") && dt.includes("không sửa lại được"), dt);
  await dlg.getByRole("button", { name: "Làm tiếp" }).click();
  check("'Làm tiếp': lượt vẫn đang làm (DB)", (await prisma.examAttempt.findFirst({ where: { examId: ex.id } }))?.status === "in_progress");

  section("Nộp → màn 'đã ghi nhận', không điểm");
  await pg.locator("footer").getByRole("button", { name: "Nộp bài" }).click();
  await dlg.waitFor({ timeout: 15000 });
  await dlg.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await pg.locator("[data-cho-cham]").waitFor({ timeout: 40000 });
  const doneText = (await pg.locator("body").innerText()).replace(/\s+/g, " ");
  check("'Máy chủ KiN đã nhận bài của em' + mã lượt KN-…", doneText.includes("Máy chủ KiN đã nhận bài của em") && /KN-[A-Z0-9]{8}/.test(doneText), doneText.slice(0, 400));
  check("nói rõ chờ gia sư chấm, điểm/đáp án chưa hiển thị", doneText.includes("chờ gia sư chấm") && doneText.includes("chưa hiển thị"));
  check("KHÔNG có điểm dạng 'n/10' và KHÔNG có 'Hạng #'", !/\b\d+(\.\d+)?\s*\/\s*10\b/.test(doneText) && !doneText.includes("Hạng #"), doneText.slice(0, 300));
  check("hết 1 lượt → không còn nút 'Thi lại đề này'", await pg.getByRole("button", { name: "Thi lại đề này" }).count() === 0);
  await shot(pg, "quiz-hs-da-nop");
  await pg.getByRole("button", { name: /Xem lại câu trả lời của em/ }).click();
  await pg.locator("[data-cho-cong-bo]").waitFor({ timeout: 30000 });
  const rvText = await pg.locator("body").innerText();
  check("xem lại: có câu trả lời của em, không có đáp án đúng ✓, có thông báo chờ công bố", rvText.includes("x=2") && !rvText.includes("✓") && rvText.includes("chưa chấm xong và công bố"));
  await c1.close();

  section("Điện thoại 390px: cổng và phòng làm không tràn ngang, nút ≥ 44px");
  const S2 = await mkUser({ name: "Em Mobile" });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: C.id, status: "active" } });
  const cm = await ctxFor(S2, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pm.getByRole("button", { name: /Bắt đầu làm bài/ }).waitFor({ timeout: 90000 });
  await hide(pm);
  check("cổng: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  check("nút bắt đầu cao ≥ 44px", ((await pm.getByRole("button", { name: /Bắt đầu làm bài/ }).boundingBox())?.height ?? 0) >= 44);
  await pm.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await pm.getByRole("textbox", { name: /Giải x²/ }).waitFor({ timeout: 60000 });
  check("phòng làm: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pm, "quiz-hs-mobile");
  await cm.close();

  section("Hết giờ → màn 'Hết giờ' rồi ghi nhận");
  const S3 = await mkUser({ name: "Em Muộn" });
  await prisma.enrollment.create({ data: { userId: S3.id, courseId: C.id, status: "active" } });
  const c3 = await ctxFor(S3, { width: 1280, height: 900 });
  const p3 = await c3.newPage(); watch(p3);
  await p3.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await p3.getByRole("textbox", { name: /Giải x²/ }).waitFor({ timeout: 60000 });
  // Ép hạn gần kề trong DB (đồng hồ theo máy chủ): trang tải lại sẽ thấy còn vài giây, rồi tự nộp.
  const at = await prisma.examAttempt.findFirst({ where: { userId: S3.id, examId: ex.id } });
  await prisma.examAttempt.update({ where: { id: at!.id }, data: { expiresAt: new Date(Date.now() + 6000) } });
  await p3.reload({ waitUntil: "networkidle" });
  await p3.getByRole("button", { name: /Tiếp tục làm bài/ }).click();
  await p3.locator("[data-cho-cham]").waitFor({ timeout: 60000 });
  const lateText = (await p3.locator("body").innerText()).replace(/\s+/g, " ");
  check("hết giờ: tự nộp, tiêu đề 'Hết giờ · bài đã được ghi nhận', không điểm", lateText.includes("Hết giờ · bài đã được ghi nhận") && !lateText.includes("Hạng #"), lateText.slice(0, 200));
  check("DB: lượt đã 'submitted' hoặc 'expired' (do máy chủ chốt)", ["submitted", "expired"].includes((await prisma.examAttempt.findUnique({ where: { id: at!.id } }))!.status));
  await c3.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
