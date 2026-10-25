import { mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

const MAIN = process.env.BASE ?? "http://localhost:3100"; // NC2: cổng theo BASE để chạy song song nhiều máy chủ thử
const RUN = Date.now().toString(16).padStart(16, "0").slice(-16);
const tok = (n: number) => (RUN + n.toString(16).padStart(16, "0")).slice(-32);
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;
const vn = (day: string, hm = "12:00") => new Date(`${day}T${hm}:00+07:00`);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Bình" });
  await prisma.user.update({ where: { id: A.id }, data: { parentName: "Hoa", parentPhone: "0901234567" } });
  const toan = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: toan.id, status: "active" } });
  for (const [d, a, b] of [["2026-09-03", "present", "present"], ["2026-09-10", "present", "present"], ["2026-09-17", "late", "present"]] as const) {
    const s = await prisma.attendanceSession.create({ data: { courseId: toan.id, date: new Date(`${d}T00:00:00Z`), createdBy: T.id } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: A.id, status: a } });
    await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: B.id, status: b } });
  }
  for (const [d, sc] of [["2026-08-05", 9], ["2026-08-12", 9], ["2026-08-20", 9], ["2026-09-05", 7], ["2026-09-15", 6.5], ["2026-09-25", 6]] as const) {
    const eid = id("ex");
    await prisma.exam.create({ data: { id: eid, code: eid, title: "KT", category: "Toán", date: "01/01/2020", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId: toan.id } });
    await prisma.examResult.create({ data: { userId: A.id, examId: eid, score: sc * 15, totalPoints: 150, completedAt: vn(d) } });
  }
  const tokA = tok(0xa1), tokB = tok(0xb2);
  for (const [stu, t, name] of [[A, tokA, "Chị Hoa"], [B, tokB, "Anh Bình"]] as const) await prisma.parentLink.create({ data: { parentId: (await mkUser({ name })).id, studentId: stu.id, status: "verified", verifiedAt: new Date(), portalToken: t } });

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: MAIN }).catch(() => {});
  const popups: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me)\//, route => { popups.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>zalo</title>" }); });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo/i.test(m.text())) errors.push(m.text()); });

  section("Danh sách theo tháng");
  await page.goto(`${MAIN}/lop-cua-toi/bao-cao-thang`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Báo cáo tháng" }).waitFor({ timeout: 90000 });
  check("nhắc nguyên tắc: hai con số riêng, mục Điều chưa đạt luôn có", await page.getByText(/hai con số riêng/).isVisible() && await page.getByText(/luôn có trong báo cáo/).isVisible());
  check("tháng hiện tại (10): nút 'Tháng sau' khoá", await page.getByRole("button", { name: /Tháng sau/ }).isDisabled());
  await page.getByRole("button", { name: /Tháng trước/ }).click();
  await page.getByText("Tháng 9/2026").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Minh Anh/ }).waitFor({ timeout: 15000 });
  check("hai học sinh, cùng 'Chưa soạn'; 0/2 đã duyệt", (await page.getByText("Chưa soạn").count()) === 2 && await page.getByText(/0\/2 đã duyệt/).isVisible());

  section("Mở báo cáo: số liệu thật + dòng KiN gợi ý");
  await page.getByRole("button", { name: /Minh Anh/ }).click();
  await page.getByRole("columnheader", { name: "Nỗ lực" }).waitFor({ timeout: 30000 });
  const rowTxt = (await page.getByRole("row", { name: /Toán 9/ }).innerText()).replace(/\s+/g, " ");
  check("bảng: chuyên cần 97% (3 buổi), không giao bài, nỗ lực 10/10 và năng lực 6,5/10 (7,0 · 6,5 · 6,0)", /97% \(3 buổi\)/.test(rowTxt) && /không giao bài/.test(rowTxt) && /10\/10/.test(rowTxt) && /6,5\/10 \(7,0 · 6,5 · 6,0\)/.test(rowTxt), rowTxt);
  check("nhãn 'Đang tụt · tháng 8 đã đạt' (chữ + chấm)", await page.getByText("Đang tụt · tháng 8 đã đạt").first().isVisible());
  const lines = page.getByRole("textbox", { name: /Dòng chưa đạt/ });
  const lineVals = await lines.evaluateAll(els => els.map(e => (e as HTMLTextAreaElement).value));
  check("2 dòng gợi ý của KiN: môn đang tụt + học chăm mà chưa đạt (cách dạy)", lineVals.length === 2 && lineVals[0].includes("năng lực đang tụt") && lineVals[1].includes("cách dạy") && (await page.getByText("Gợi ý của KiN", { exact: true }).count()) === 2, JSON.stringify({ lineVals, kin: await page.getByText("Gợi ý của KiN", { exact: true }).count() }));
  await shot(page, "monthly-open");

  section("Gia sư đọc và sửa trước khi duyệt");
  await lines.nth(1).fill("Cô sẽ dành thêm 10 phút mỗi buổi để giải lại phần em chưa vững.");
  check("sửa xong: nút Lưu bản nháp mở", !(await page.getByRole("button", { name: "Lưu bản nháp" }).isDisabled()));
  await page.getByRole("button", { name: "+ Thêm dòng" }).click();
  await page.getByRole("textbox", { name: "Dòng chưa đạt 3" }).fill("Em cần ghi chép bài đầy đủ hơn.");
  await page.getByRole("button", { name: "Xoá dòng 1" }).click();
  check("xoá dòng 1 → còn 2 dòng (đã sửa + tự viết)", (await lines.count()) === 2);
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();
  await page.getByText("Đã lưu bản nháp.").waitFor({ timeout: 15000 });
  await eventually("DB: bản nháp 2 dòng", async () => ((await prisma.monthlyReport.findFirst({ where: { studentId: A.id } }))?.draftItems as any[])?.length === 2);
  await eventually("danh sách: 'Bản nháp'", async () => (await page.getByText("Bản nháp", { exact: true }).count()) === 1);
  check("phụ huynh CHƯA thấy gì (chưa duyệt)", (await prisma.monthlyReport.findFirst({ where: { studentId: A.id } }))?.approvedAt === null);

  section("Duyệt → phụ huynh thấy; Zalo");
  await page.getByRole("button", { name: "Duyệt — hiện cho phụ huynh" }).click();
  await page.getByText(/Đã duyệt — phụ huynh thấy báo cáo/).waitFor({ timeout: 15000 });
  await eventually("trạng thái 'Đã duyệt' + nhãn nút đổi 'Duyệt lại'", async () => (await page.getByText("Đã duyệt", { exact: true }).count()) >= 1 && await page.getByRole("button", { name: "Duyệt lại" }).isVisible());
  await page.getByRole("button", { name: "Gửi phụ huynh qua Zalo" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  const ta = dlg.getByLabel("Tin nhắn (sửa được trước khi gửi)");
  const draft = await ta.inputValue();
  check("tin soạn sẵn: xưng hô, 2 dòng Nỗ lực/Năng lực riêng, mục Điều chưa đạt với dòng gia sư vừa sửa", draft.startsWith("Kính gửi anh/chị Hoa,") && /- Nỗ lực: 10\/10/.test(draft) && /- Năng lực: 6,5\/10 \(7,0 · 6,5 · 6,0\)/.test(draft) && draft.includes("Điều chưa đạt tháng này:") && draft.includes("Cô sẽ dành thêm 10 phút") && !/hạng/i.test(draft), draft);
  check("báo rõ KiN không gửi giúp + SĐT phụ huynh", await dlg.getByText(/KiN không gửi giúp/).isVisible() && await dlg.getByText(/0901234567/).isVisible());
  await ta.fill(draft + "\nCảm ơn anh/chị.");
  await dlg.getByRole("button", { name: "Mở Zalo" }).click();
  await dlg.waitFor({ state: "detached", timeout: 15000 });
  await eventually("đã chép đúng tin ĐÃ SỬA", async () => (await page.evaluate(() => navigator.clipboard.readText()).catch(() => "")).endsWith("Cảm ơn anh/chị."));
  await eventually("mở Zalo đúng số phụ huynh", () => popups.some(u => u.startsWith("https://zalo.me/0901234567")));
  await eventually("DB: ghi 'đã mở Zalo'", async () => !!(await prisma.monthlyReport.findFirst({ where: { studentId: A.id } }))?.zaloOpenedAt);
  await eventually("giao diện: 'Đã mở Zalo lúc', không có chữ 'đã gửi'", async () => (await page.getByText(/Đã mở Zalo lúc/).count()) >= 1 && (await page.getByText(/đã gửi/i).count()) === 0);

  section("Sửa sau khi duyệt");
  await lines.nth(0).fill("Dòng sửa sau khi đã duyệt.");
  await page.getByText(/phụ huynh vẫn thấy bản cũ/).waitFor({ timeout: 10000 });
  check("cảnh báo + nút Gửi Zalo khoá cho tới khi duyệt lại", await page.getByRole("button", { name: "Gửi phụ huynh qua Zalo" }).isDisabled());

  section("Sổ của con: báo cáo tháng cho phụ huynh");
  const pctx = await ctxFor(null);
  const pp = await pctx.newPage();
  pp.on("pageerror", e => errors.push(String(e)));
  await pp.goto(`${MAIN}/so-cua-con/${tokA}`, { waitUntil: "networkidle" });
  await pp.getByRole("heading", { name: "Báo cáo tháng", exact: true }).waitFor({ timeout: 60000 });
  const art = pp.getByRole("article", { name: "Báo cáo tháng 9/2026" });
  check("thẻ báo cáo T9 do gia sư Cô Lan duyệt", await art.isVisible() && await art.getByText("Gia sư Cô Lan đã duyệt").isVisible());
  check("hai thanh RIÊNG: Nỗ lực 10/10 và Năng lực 6,5/10 (7,0 · 6,5 · 6,0) — không có điểm gộp, không thứ hạng", await art.getByRole("img", { name: "Nỗ lực: 10/10" }).isVisible() && await art.getByRole("img", { name: /Năng lực: 6,5\/10 \(7,0 · 6,5 · 6,0\)/ }).isVisible() && !/hạng|tổng điểm/i.test(await art.innerText()));
  check("nhãn năng lực bằng chữ: 'Đang tụt · tháng 8 đã đạt'", await art.getByText("Đang tụt · tháng 8 đã đạt").isVisible());
  check("mục 'Điều chưa đạt tháng này' hiện bản ĐÃ DUYỆT (không phải dòng sửa sau)", await art.getByRole("heading", { name: "Điều chưa đạt tháng này" }).isVisible() && await art.getByText(/Cô sẽ dành thêm 10 phút/).isVisible() && (await art.getByText("Dòng sửa sau khi đã duyệt.").count()) === 0);
  const colorOfLabel = await art.getByText("Đang tụt · tháng 8 đã đạt").evaluate(e => getComputedStyle(e).color);
  check("năng lực không bao giờ đỏ", !/^rgb\((2[0-5]\d|1[89]\d), (0|[1-6]?\d), (0|[1-6]?\d)\)$/.test(colorOfLabel), colorOfLabel);
  await shot(pp, "monthly-parent");

  section("Rỗng vẫn có mục cố định");
  await page.getByRole("button", { name: /Bảo Bình/ }).click();
  await page.getByRole("columnheader", { name: "Nỗ lực" }).waitFor({ timeout: 30000 });
  check("Bảo Bình: không dòng gợi ý → câu cố định ngay trên màn gia sư", await page.getByText("Tháng này không có mục nào chưa đạt.").first().isVisible());
  await page.getByRole("button", { name: "Duyệt — hiện cho phụ huynh" }).click();
  await page.getByText(/Đã duyệt — phụ huynh thấy báo cáo/).waitFor({ timeout: 15000 });
  const pb = await (await ctxFor(null)).newPage();
  await pb.goto(`${MAIN}/so-cua-con/${tokB}`, { waitUntil: "networkidle" });
  await pb.getByRole("heading", { name: "Điều chưa đạt tháng này" }).waitFor({ timeout: 60000 });
  check("phụ huynh Bảo Bình: mục luôn có + câu 'Tháng này không có mục nào chưa đạt.'", await pb.getByText("Tháng này không có mục nào chưa đạt.").isVisible());

  section("Điện thoại");
  const mctx = await ctxFor(null, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  await mp.goto(`${MAIN}/so-cua-con/${tokA}`, { waitUntil: "networkidle" });
  await mp.getByRole("heading", { name: "Báo cáo tháng", exact: true }).waitFor({ timeout: 60000 });
  check("Sổ của con không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const mt = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  await mt.goto(`${MAIN}/lop-cua-toi/bao-cao-thang`, { waitUntil: "networkidle" });
  await mt.getByRole("heading", { name: "Báo cáo tháng" }).waitFor({ timeout: 60000 });
  check("trang gia sư không tràn ngang", await mt.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
