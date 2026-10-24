// QZ-12 — màn "Hết giờ · đang xác nhận bài nộp" theo Figma q7 (521:5528): bố cục 2 cột, bảng "Mốc lưu" với dữ liệu THẬT, khối "Liên hệ gia sư", không bịa số liệu.
// Ép tình huống mất mạng: chặn gọi nộp bài để màn rơi vào trạng thái "Chưa nhận được xác nhận". Cần máy chủ dev đang chạy.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em Mạng Yếu" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const ex = await prisma.exam.create({ data: { id: "ut-mix", code: "ut-mix", title: "Ôn tập hết giờ", category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 2, status: "available", createdAt: "2026-10-24", ownerId: T.id, courseId: C.id, totalPoints: 4 } });
  const q1 = await prisma.examQuestion.create({ data: { id: "ut-1", examId: ex.id, order: 1, text: "Câu trắc nghiệm", type: "MC", points: 1 } });
  for (const [i, t] of ["Có", "Không"].entries()) await prisma.examOption.create({ data: { id: `ut-1-${i}`, questionId: q1.id, order: i, text: t, isCorrect: i === 0 } });
  await prisma.examQuestion.create({ data: { id: "ut-2", examId: ex.id, order: 2, text: "Giải x² − 5x + 6 = 0", type: "ESSAY", points: 3 } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const hide = async (p: any) => p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });

  const c = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await c.newPage(); watch(pg);
  await pg.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  const area = pg.getByRole("textbox", { name: /Giải x²/ });
  await area.waitFor({ timeout: 60000 });
  await area.fill("x=2 hoặc x=3");
  await eventually("bản nháp đã lưu trên máy chủ", async () => (await pg.locator("[data-trang-thai-nhap]").innerText()).includes("đã lưu trên máy chủ"), 20000);
  const at = await prisma.examAttempt.findFirst({ where: { userId: S.id, examId: ex.id } });
  await prisma.examAttempt.update({ where: { id: at!.id }, data: { expiresAt: new Date(Date.now() + 7000) } });
  await pg.reload({ waitUntil: "networkidle" });
  await pg.route("**/api/exams/attempts/*/submit", r => r.abort("failed")); // mất mạng đúng lúc gửi bài
  await pg.getByRole("button", { name: /Tiếp tục làm bài/ }).click();

  section("Màn hết giờ: trạng thái chưa xác nhận");
  await pg.locator("[data-het-gio]").waitFor({ timeout: 60000 });
  await pg.getByText("Chưa nhận được xác nhận từ máy chủ").first().waitFor({ timeout: 60000 });
  await hide(pg);
  const text = (await pg.locator("[data-het-gio]").innerText()).replace(/\s+/g, " ");
  check("tiêu đề + đồng hồ 00:00 + tên đề + tên lớp", text.includes("Hết giờ · đang xác nhận bài nộp") && text.includes("00:00") && text.includes("Ôn tập hết giờ") && text.includes("Toán 9"), text.slice(0, 200));
  check("có bảng 'Mốc lưu' với hàng Máy chủ và Gửi bài", await pg.locator("[data-moc-luu] tbody tr").count() === 2 && text.includes("Máy chủ") && text.includes("Gửi bài"));
  const rowText = (await pg.locator("[data-moc-luu] tbody").innerText()).replace(/\s+/g, " ");
  check("mở lại trang giữa chừng: mốc 'Máy chủ' nói 'Chưa rõ', KHÔNG khẳng định 'chưa có bản nháp' (bản nháp thật vẫn nằm trong DB)", rowText.includes("Chưa rõ") && !/Chưa có bản nháp/.test(rowText) && ((await prisma.examAnswer.findFirst({ where: { questionId: "ut-2" } }))?.textAnswer ?? "").includes("x=2"), rowText);
  check("mốc 'Gửi bài' có giờ, ghi 'Chưa xác nhận đã nộp' (không nói đã nộp)", /Gửi bài · \d{1,2}:\d{2}:\d{2}/.test(rowText) && rowText.includes("Chưa xác nhận đã nộp") && !/đã nhận bài|Đã nhận bài/.test(text.replace("Trang chỉ chuyển sang “Đã nhận bài”", "")), rowText);
  check("có 3 bước 'Em cần làm gì bây giờ?' và nhắc đúng tên gia sư", text.includes("Em cần làm gì bây giờ?") && /gửi mã lượt cho (Cô Lan|Lan)/.test(text), text.slice(0, 600));
  check("cột phải: 'Bản lưu không phải biên nhận' và 'Liên hệ' kèm lớp", text.includes("Bản lưu không phải biên nhận") && /Liên hệ .*Lan/.test(text) && text.includes("Lớp Toán 9"));
  check("KHÔNG bịa: không 'Ví dụ sau khi đã có biên nhận', không số mẫu KN-2410, không 'ảnh'", !/Ví dụ sau khi|KN-2410|OTTH-|1 ảnh/.test(text));
  check("không điểm, không đáp án ở màn này", !/Điểm tổng:|Hạng #|Đáp án đúng/.test(text));
  const mainBox = await pg.locator("[data-moc-luu]").boundingBox(), asideBox = await pg.locator("[data-lien-he]").boundingBox();
  check("máy tính: hai cột (khối Liên hệ nằm bên PHẢI bảng Mốc lưu)", !!mainBox && !!asideBox && asideBox.x > mainBox.x + mainBox.width - 5, [mainBox, asideBox]);
  check("hai nút ≥ 44px: Kiểm tra kết nối và thử lại / Sao chép mã lượt", await pg.getByRole("button", { name: /Kiểm tra kết nối và thử lại|Sao chép mã lượt/ }).evaluateAll(bs => bs.length === 2 && bs.every(b => b.getBoundingClientRect().height >= 43.5)));
  await shot(pg, "quiz-timeup-desktop");

  section("Điện thoại 390px: một cột, không tràn ngang");
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.waitForTimeout(400);
  check("không tràn ngang", await pg.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  const m2 = await pg.locator("[data-moc-luu]").boundingBox(), a2 = await pg.locator("[data-lien-he]").boundingBox();
  check("khối Liên hệ xuống DƯỚI bảng (một cột)", !!m2 && !!a2 && a2.y > m2.y + m2.height - 5, [m2, a2]);
  await shot(pg, "quiz-timeup-mobile");

  section("Gửi lại thành công → màn 'đã nhận'");
  await pg.unroute("**/api/exams/attempts/*/submit");
  await pg.getByRole("button", { name: /Kiểm tra kết nối và thử lại/ }).click();
  await pg.locator("[data-cho-cham]").waitFor({ timeout: 60000 });
  check("có biên nhận từ máy chủ thì mới chuyển màn; DB lượt đã chốt", ["submitted", "expired"].includes((await prisma.examAttempt.findUnique({ where: { id: at!.id } }))!.status));

  section("Cùng lần mở trang: mốc 'Máy chủ' ghi giờ thật của lần lưu");
  const S2 = await mkUser({ name: "Em Một Phút" });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: C.id, status: "active" } });
  const ex2 = await prisma.exam.create({ data: { id: "ut-1p", code: "ut-1p", title: "Đề một phút", category: "Toán", date: "01/01/2030", time: "08:00", duration: "1 phút", questions: 1, status: "available", createdAt: "2026-10-24", ownerId: T.id, courseId: C.id, totalPoints: 3 } });
  await prisma.examQuestion.create({ data: { id: "ut-3", examId: ex2.id, order: 1, text: "Viết một câu về x", type: "ESSAY", points: 3 } });
  const c2 = await ctxFor(S2, { width: 1280, height: 900 });
  const p2 = await c2.newPage(); watch(p2);
  await p2.route("**/api/exams/attempts/*/submit", r => r.abort("failed"));
  await p2.goto(`${BASE}/student/thi-thu/${ex2.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await p2.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  const area2 = p2.getByRole("textbox", { name: /Viết một câu/ });
  await area2.waitFor({ timeout: 60000 });
  await area2.fill("x là ẩn số");
  await eventually("bản nháp đã lưu trên máy chủ", async () => (await p2.locator("[data-trang-thai-nhap]").innerText()).includes("đã lưu trên máy chủ"), 20000);
  await p2.getByText("Chưa nhận được xác nhận từ máy chủ").first().waitFor({ timeout: 120000 }); // đồng hồ máy chủ 1 phút về 0
  const row2 = (await p2.locator("[data-moc-luu] tbody").innerText()).replace(/\s+/g, " ");
  check("mốc 'Máy chủ' ghi giờ thật hh:mm:ss + 'Đã lưu bản nháp'", /Máy chủ · \d{1,2}:\d{2}:\d{2}/.test(row2) && row2.includes("Đã lưu bản nháp"), row2);
  await c2.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
