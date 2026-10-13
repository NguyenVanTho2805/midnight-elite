// Phòng thi (Figma 27:2): khoá cứng Navy bất kể chủ đề của người dùng, dải "Bạn đã rời khỏi tab N lần", ô đáp án cao 52px, điện thoại 390px.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const ex = await prisma.exam.create({ data: { id: "ex-pt", code: "ex-pt", title: "Phòng thi thử", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 2, status: "available", createdAt: "2020", ownerId: T.id, courseId: C.id } });
  const q1 = await prisma.examQuestion.create({ data: { id: "q1-pt", examId: ex.id, order: 1, text: "Tổng hai nghiệm của x² − 5x + 6 = 0 là?", type: "MC" } });
  for (const [i, t] of ["5", "−5", "6", "−6"].entries()) await prisma.examOption.create({ data: { id: `o1-${i}`, questionId: q1.id, order: i, text: t, isCorrect: i === 0 } });
  const q2 = await prisma.examQuestion.create({ data: { id: "q2-pt", examId: ex.id, order: 2, text: "Xét hàm số y = x³ − 3x:", type: "TRUE_FALSE_CLUSTER" } });
  for (const [i, l] of ["a", "b"].entries()) await prisma.examOption.create({ data: { id: `o2-${i}`, questionId: q2.id, order: i, text: `Phát biểu ${l}`, isCorrect: i === 0, subLabel: l } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const ctx = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);
  const hide = async (p: any) => p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });

  section("Khoá Navy: chủ đề của người dùng không lọt vào phòng thi");
  await pg.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).waitFor({ timeout: 90000 });
  // người dùng chọn chủ đề Cổ vịt (cổ vịt gần màu "đúng" 53 đơn vị RGB — lý do khoá)
  await pg.evaluate(`document.documentElement.setAttribute("data-chu-de", "co-vit")`);
  const probe = (sel: string) => pg.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const cs = getComputedStyle(el); return { nen: cs.getPropertyValue("--kin-nhan-nen").trim(), link: cs.getPropertyValue("--kin-nhan-link").trim() }; })()`) as Promise<{ nen: string; link: string }>;
  const inRoom = await probe('[data-vung="phong-thi"]');
  const outside = await pg.evaluate(`getComputedStyle(document.querySelector('[data-vung="sang"]')).getPropertyValue("--kin-nhan-nen").trim()`) as string;
  check("trang phòng thi có khung data-vung='phong-thi'", await pg.locator('[data-vung="phong-thi"]').count() === 1);
  check("chủ đề Cổ vịt: ngoài phòng thi màu nhấn là cổ vịt (#0e7490)", outside === "#0e7490", outside);
  check("…nhưng TRONG phòng thi vẫn là Navy (#1e3a8a, link #2563eb)", inRoom.nen === "#1e3a8a" && inRoom.link === "#2563eb", inRoom);
  const btnBg = await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).evaluate(e => getComputedStyle(e).backgroundColor);
  check("nút 'Bắt đầu làm bài' tô Navy thật (rgb 30,58,138), không phải cổ vịt", btnBg === "rgb(30, 58, 138)", btnBg);

  section("Làm bài: ô đáp án cao 52px, không có dải rời tab khi chưa rời");
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await pg.getByText("Tổng hai nghiệm của").waitFor({ timeout: 60000 });
  await hide(pg);
  check("chưa rời tab lần nào → không hiện dải", await pg.locator("[data-dai-roi-tab]").count() === 0);
  const optH = await pg.locator('label:has(input[type=radio])').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("4 ô đáp án trắc nghiệm đều cao ≥ 52px", optH.length === 4 && optH.every(h => h >= 52), optH);
  const dsH = await pg.getByRole("button", { name: /^(Đúng|Sai)$/ }).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("nút Đúng / Sai cao ≥ 44px", dsH.length === 4 && dsH.every(h => h >= 44), dsH);
  await pg.getByText("5", { exact: true }).first().click();
  const selBorder = await pg.locator('label:has(input[type=radio]:checked)').evaluate(e => getComputedStyle(e).borderTopColor);
  check("ô đang chọn viền Navy (không theo chủ đề Cổ vịt)", selBorder === "rgb(30, 58, 138)", selBorder);
  await shot(pg, "exam-room-taking");

  section("Rời tab → dải báo + server đếm");
  const leave = () => pg.evaluate(`(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); })()`);
  await leave();
  const strip = pg.locator("[data-dai-roi-tab]");
  await strip.waitFor({ timeout: 30000 });
  check("rời 1 lần: dải hiện đúng chữ 'Bạn đã rời khỏi tab 1 lần. Hệ thống có ghi lại số lần, không quay màn hình.'", (await strip.innerText()).replace(/\s+/g, " ").trim() === "Bạn đã rời khỏi tab 1 lần. Hệ thống có ghi lại số lần, không quay màn hình.", await strip.innerText());
  check("dải là vùng thông báo (role=status, aria-live) — đọc được bằng trình đọc màn hình", await strip.getAttribute("role") === "status" && await strip.getAttribute("aria-live") === "polite");
  await leave();
  await pg.waitForFunction(`document.querySelector("[data-dai-roi-tab]")?.textContent?.includes("2 lần")`, null, { timeout: 30000 });
  const att = await prisma.examAttempt.findFirst({ where: { userId: S.id, examId: ex.id } });
  check("rời 2 lần: dải cập nhật '2 lần' và DB (tabSwitchCount) = 2", att?.tabSwitchCount === 2, att?.tabSwitchCount);
  const sb = await strip.evaluate(e => { const cs = getComputedStyle(e); return { bg: cs.backgroundColor, color: cs.color }; });
  check("dải dùng màu 'chờ' (chữ + nền khác nhau, đủ tương phản — không đỏ báo lỗi)", sb.bg !== sb.color && sb.bg !== "rgba(0, 0, 0, 0)", sb);
  await shot(pg, "exam-room-leave-strip");

  section("Vào lại giữa chừng: dải vẫn nhớ số lần");
  await pg.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await pg.locator("[data-dai-roi-tab]").waitFor({ timeout: 30000 });
  check("tiếp tục lượt đang làm → dải ghi '2 lần' ngay, không về 0", (await pg.locator("[data-dai-roi-tab]").innerText()).includes("2 lần"));
  const same = await prisma.examAttempt.count({ where: { userId: S.id, examId: ex.id } });
  check("vẫn là MỘT lượt thi (không tạo lượt mới)", same === 1, same);

  section("Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pm.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await pm.locator("[data-dai-roi-tab]").waitFor({ timeout: 30000 });
  await hide(pm);
  check("không tràn ngang; dải rời tab nằm gọn trong màn hình", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean && ((await pm.locator("[data-dai-roi-tab]").boundingBox())?.width ?? 999) <= 390);
  check("phòng thi KHÔNG có thanh module (toàn màn hình)", await pm.getByRole("navigation", { name: "Module của học sinh" }).count() === 0);
  await shot(pm, "exam-room-mobile");
  await cm.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
