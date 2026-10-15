// Phòng thi (Figma 27:2): khoá cứng Navy bất kể chủ đề của người dùng, dải "Bạn đã rời khỏi tab N lần", ô đáp án cao 52px, điện thoại 390px.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
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

  // Đề chia Phần (kiểu ĐGNL HSA): Phần 1 có giờ riêng 20 phút, Phần 2 25 phút. Dùng để kiểm tên Phần, đồng hồ theo Phần, hộp xác nhận nộp bài.
  const ex2 = await prisma.exam.create({ data: { id: "ex-sec", code: "ex-sec", title: "Đề HSA thử", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 3, status: "available", createdAt: "2020", ownerId: T.id, courseId: C.id } });
  for (const [i, [label, mins]] of ([["Phần 1: Toán và xử lý số liệu", 20], ["Phần 1: Toán và xử lý số liệu", 20], ["Khoa học", 25]] as const).entries()) {
    const q = await prisma.examQuestion.create({ data: { id: `qs${i}-pt`, examId: ex2.id, order: i + 1, text: `Câu hỏi số ${i + 1} của đề chia Phần`, type: "MC", sectionLabel: label, sectionMinutes: mins } });
    for (const [j, t] of ["Đáp án một", "Đáp án hai"].entries()) await prisma.examOption.create({ data: { id: `os${i}-${j}`, questionId: q.id, order: j, text: t, isCorrect: j === 0 } });
  }

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
  const dsH = await pg.getByRole("radio", { name: /^(Đúng|Sai)$/ }).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("nút Đúng / Sai cao ≥ 44px", dsH.length === 4 && dsH.every(h => h >= 44), dsH);
  await pg.getByText("5", { exact: true }).first().click();
  const selBorder = await pg.locator('label:has(input[type=radio]:checked)').evaluate(e => getComputedStyle(e).borderTopColor);
  check("ô đang chọn viền Navy (không theo chủ đề Cổ vịt)", selBorder === "rgb(30, 58, 138)", selBorder);
  await shot(pg, "exam-room-taking");

  section("Thanh Navy: tên đề, 'Câu N / M', đồng hồ (Figma 27:2)");
  const hd = pg.locator("header");
  const hdBg = await hd.evaluate(e => getComputedStyle(e).backgroundColor);
  check("thanh trên tô Navy (rgb 30,58,138) bất kể chủ đề Cổ vịt, chữ trắng", hdBg === "rgb(30, 58, 138)" && await hd.evaluate(e => getComputedStyle(e).color) === "rgb(255, 255, 255)", hdBg);
  check("đề không chia Phần → dòng đầu là tên đề (chữ hoa bằng CSS)", (await pg.locator("[data-phong-thi-phan]").innerText()).trim() === "PHÒNG THI THỬ" && (await pg.locator("[data-phong-thi-phan]").textContent())?.trim() === "Phòng thi thử");
  const counter = hd.getByRole("button", { name: /^Câu \d+ \/ \d+/ });
  check("'Câu 1 / 2' (câu hiện tại / tổng số câu của đề)", (await counter.innerText()).replace(/\s+/g, " ").startsWith("Câu 1 / 2"), await counter.innerText());
  const clock = pg.getByRole("timer");
  const t0 = await clock.innerText();
  const [cm0, cs0] = t0.split(":").map(Number);
  check("đồng hồ mm:ss, đề 45 phút → còn khoảng 44–45 phút", /^\d\d:\d\d$/.test(t0) && cm0 >= 44 && cm0 <= 45, t0);
  check("đồng hồ có nhãn đọc được cho trình đọc màn hình", /^Còn lại \d+ phút \d+ giây$/.test((await clock.getAttribute("aria-label")) ?? ""), await clock.getAttribute("aria-label"));
  check("đồng hồ dùng phông đơn cách (số không nhảy chiều rộng)", /mono/i.test(await clock.evaluate(e => getComputedStyle(e).fontFamily)));
  await pg.waitForTimeout(2200);
  const t1 = (await clock.innerText()).split(":").map(Number);
  check("đồng hồ chạy ngược (sau 2 giây nhỏ hơn)", t1[0] * 60 + t1[1] < cm0 * 60 + cs0, [t0, t1]);
  check("chữ 'còn lại' dưới đồng hồ", await hd.getByText("còn lại", { exact: true }).isVisible());

  section("Khung: trang không cuộn, thân cuộn riêng, chân trang cố định");
  const lay = await pg.evaluate(`(() => {
    const body = document.querySelector('[data-cau]').parentElement.parentElement; const ft = document.querySelector('footer').getBoundingClientRect(); const h = document.querySelector('header').getBoundingClientRect();
    return { page: document.documentElement.scrollHeight - window.innerHeight, bodyOverflow: getComputedStyle(body).overflowY, footBottom: Math.round(ft.bottom), headTop: Math.round(h.top), vh: window.innerHeight };
  })()`) as any;
  check("trang không cuộn dọc; thân tự cuộn", lay.page <= 1 && lay.bodyOverflow === "auto", lay);
  check("thanh trên dính đỉnh, chân trang dính đáy", lay.headTop === 0 && lay.footBottom === lay.vh, lay);

  section("Chân trang: tiến độ, ghi chú hết giờ, Câu trước / Câu sau / Nộp bài");
  const foot = pg.locator("footer");
  check("tiến độ 'Đã trả lời 1 / 2 câu' (đã chọn câu 1)", (await foot.innerText()).includes("Đã trả lời 1 / 2 câu"), await foot.innerText());
  check("ghi chú đúng sự thật khi hết giờ: 'Hết giờ hệ thống tự nộp bài.'", (await foot.innerText()).includes("Hết giờ hệ thống tự nộp bài."));
  const btnH = await foot.getByRole("button").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check("3 nút (Nộp bài, Câu trước, Câu sau) đều cao ≥ 44px", btnH.length === 3 && btnH.every(h => h >= 44), btnH);
  check("đang ở câu 1: 'Câu trước' tắt, 'Câu sau' bật", await foot.getByRole("button", { name: "Câu trước" }).isDisabled() && await foot.getByRole("button", { name: "Câu sau" }).isEnabled());
  await foot.getByRole("button", { name: "Câu sau" }).click();
  await eventually("bấm 'Câu sau' → 'Câu 2 / 2' và 'Câu sau' tắt", async () => (await counter.innerText()).replace(/\s+/g, " ").startsWith("Câu 2 / 2") && await foot.getByRole("button", { name: "Câu sau" }).isDisabled());
  check("câu 2 nằm trong khung nhìn (đã cuộn tới)", await pg.locator('[data-cau="1"]').evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; }));
  await foot.getByRole("button", { name: "Câu trước" }).click();
  await eventually("bấm 'Câu trước' → về 'Câu 1 / 2'", async () => (await counter.innerText()).replace(/\s+/g, " ").startsWith("Câu 1 / 2"));

  section("Lưới nhảy câu");
  check("chưa mở: aria-expanded=false", (await counter.getAttribute("aria-expanded")) === "false");
  await counter.click();
  const grid = pg.getByRole("navigation", { name: "Nhảy tới câu" });
  check("mở lưới: aria-expanded=true, có 2 ô", (await counter.getAttribute("aria-expanded")) === "true" && await grid.getByRole("button").count() === 2);
  const pos = await pg.evaluate(`[...document.querySelectorAll("[data-cau]")].map(e => e.id)`) as string[]; // đề xáo thứ tự mỗi lượt → lấy thứ tự thật trên màn hình
  const doneAt = pos.indexOf("q-q1-pt") + 1, openAt = pos.indexOf("q-q1-pt") === 0 ? 2 : 1;
  const bDone = grid.getByRole("button", { name: `Câu ${doneAt}, đã trả lời` }), bOpen = grid.getByRole("button", { name: `Câu ${openAt}, chưa trả lời` });
  check("ô có chữ trạng thái: câu đã chọn = 'đã trả lời' (viền liền), câu còn lại = 'chưa trả lời' (viền đứt) — không chỉ dựa vào màu", await bDone.count() === 1 && await bOpen.count() === 1 && await bDone.evaluate(e => getComputedStyle(e).borderTopStyle) === "solid" && await bOpen.evaluate(e => getComputedStyle(e).borderTopStyle) === "dashed", pos);
  check("ô cao ≥ 44px", (await grid.getByRole("button").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)))).every(h => h >= 44));
  await grid.getByRole("button", { name: /^Câu 2,/ }).click();
  await eventually("chọn ô câu 2 → nhảy tới câu 2 và lưới tự đóng", async () => (await counter.innerText()).replace(/\s+/g, " ").startsWith("Câu 2 / 2") && await grid.count() === 0);

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

  section("Đề chia Phần: tên Phần, đồng hồ theo Phần, ghi chú, ẩn Phần chưa tới");
  const c2 = await ctxFor(S, { width: 1280, height: 900 });
  const p2 = await c2.newPage(); watch(p2);
  await p2.goto(`${BASE}/student/thi-thu/${ex2.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await p2.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await p2.getByText("Câu hỏi số 1 của đề chia Phần").waitFor({ timeout: 60000 });
  await hide(p2);
  check("dòng đầu = tên Phần đang làm (đã có chữ 'Phần' nên giữ nguyên)", (await p2.locator("[data-phong-thi-phan]").textContent())?.trim() === "Phần 1: Toán và xử lý số liệu", await p2.locator("[data-phong-thi-phan]").textContent());
  const c2counter = p2.locator("header").getByRole("button", { name: /^Câu \d+ \/ \d+/ });
  check("'Câu 1 / 3' — mẫu số là cả đề (3), dù Phần 2 chưa hiện", (await c2counter.innerText()).replace(/\s+/g, " ").startsWith("Câu 1 / 3"), await c2counter.innerText());
  const tt = (await p2.getByRole("timer").innerText()).split(":").map(Number);
  check("đồng hồ theo Phần 1 (20 phút), không phải cả đề 45 phút", tt[0] === 19 || tt[0] === 20, tt);
  check("dưới đồng hồ: 'còn lại của Phần 1'", await p2.locator("header").getByText("còn lại của Phần 1", { exact: true }).isVisible());
  check("Phần 2 chưa tới lượt → ẩn hoàn toàn (không lộ đề)", await p2.getByText("Câu hỏi số 3 của đề chia Phần").count() === 0 && await p2.getByText("Câu 3.").count() === 0);
  const f2 = (await p2.locator("footer").innerText()).replace(/\s+/g, " ");
  check("tiến độ đếm theo Phần: 'Đã trả lời 0 / 2 câu Phần 1'", f2.includes("Đã trả lời 0 / 2 câu Phần 1"), f2);
  check("ghi chú: 'Hết giờ Phần 1 thì Phần 1 khoá lại, tự sang Phần 2. Không sửa lại được.'", f2.includes("Hết giờ Phần 1 thì Phần 1 khoá lại, tự sang Phần 2. Không sửa lại được."), f2);
  await shot(p2, "exam-room-section");

  section("Nộp bài luôn qua hộp xác nhận");
  await p2.getByText("Đáp án một").first().click();
  check("chọn xong: 'Đã trả lời 1 / 2 câu Phần 1'", (await p2.locator("footer").innerText()).includes("Đã trả lời 1 / 2 câu Phần 1"));
  await p2.locator("footer").getByRole("button", { name: "Nộp bài" }).click();
  const dlg = p2.getByRole("dialog", { name: "Nộp bài ngay?" });
  await dlg.waitFor({ timeout: 15000 });
  check("hộp ghi rõ số câu chưa trả lời của CẢ đề (2 trên 3, kể cả Phần chưa hiện)", (await dlg.innerText()).includes("Bạn còn 2 câu chưa trả lời. Sau khi nộp không sửa lại được."), await dlg.innerText());
  check("tiêu điểm rơi vào nút an toàn 'Làm tiếp' (Enter nhầm không nộp bài)", await dlg.getByRole("button", { name: "Làm tiếp" }).evaluate(e => e === document.activeElement));
  await dlg.getByRole("button", { name: "Làm tiếp" }).click();
  check("'Làm tiếp' đóng hộp, bài vẫn đang làm (DB in_progress)", await dlg.count() === 0 && (await prisma.examAttempt.findFirst({ where: { examId: ex2.id } }))?.status === "in_progress");
  await p2.locator("footer").getByRole("button", { name: "Nộp bài" }).click();
  await dlg.waitFor({ timeout: 15000 });
  await p2.keyboard.press("Escape");
  check("Esc cũng đóng hộp, không nộp", await dlg.count() === 0 && (await prisma.examAttempt.findFirst({ where: { examId: ex2.id } }))?.status === "in_progress");
  await p2.locator("footer").getByRole("button", { name: "Nộp bài" }).click();
  await dlg.waitFor({ timeout: 15000 });
  await dlg.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await eventually("xác nhận → DB: lượt thi đã nộp (submitted)", async () => (await prisma.examAttempt.findFirst({ where: { examId: ex2.id } }))?.status === "submitted", 30000);
  await p2.getByRole("heading", { name: "Kết quả của bạn" }).waitFor({ timeout: 30000 });
  check("nộp xong: phòng thi chuyển sang màn kết quả (không còn thanh Navy làm bài)", await p2.getByRole("timer").count() === 0);
  await c2.close();

  section("Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 800 });
  const pm = await cm.newPage(); watch(pm);
  await pm.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pm.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await pm.locator("[data-dai-roi-tab]").waitFor({ timeout: 30000 });
  await hide(pm);
  check("không tràn ngang; dải rời tab nằm gọn trong màn hình", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean && ((await pm.locator("[data-dai-roi-tab]").boundingBox())?.width ?? 999) <= 390);
  check("phòng thi KHÔNG có thanh module (toàn màn hình)", await pm.getByRole("navigation", { name: "Module của học sinh" }).count() === 0);
  const mh = await pm.evaluate(`(() => { const h = document.querySelector('header').getBoundingClientRect(), f = document.querySelector('footer').getBoundingClientRect(); return { headH: Math.round(h.height), footBottom: Math.round(f.bottom), vh: window.innerHeight, headRight: Math.round(document.querySelector('[role=timer]').getBoundingClientRect().right) }; })()`) as any;
  check("điện thoại: đồng hồ nằm trọn trong thanh Navy (không tràn phải), chân trang dính đáy", mh.headRight <= 390 && mh.footBottom === mh.vh, mh);
  const mbtn = await pm.locator("footer").getByRole("button").evaluateAll(els => els.map(e => ({ h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })));
  check("3 nút chân trang cao ≥ 44px, rộng ≥ 44px, xếp vừa 390px", mbtn.length === 3 && mbtn.every(b => b.h >= 44 && b.w >= 44), mbtn);
  await shot(pm, "exam-room-mobile");
  await cm.close();

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));

  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
