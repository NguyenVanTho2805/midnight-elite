// Gia sư dời / huỷ buổi trên trang Lịch (trình duyệt thật) + phụ huynh thấy ở Sổ của con.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, vnMinutesOfDay, dayOfWeekOfKey, hmOf, addDaysKey, weekRangeOf } from "@/lib/classSessions";

const RUN = Date.now().toString(16).padStart(16, "0").slice(-16);
const tok = (n: number) => (RUN + n.toString(16).padStart(16, "0")).slice(-32);
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S1 = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  const course2 = await mkCourse(T.id, { name: "Lý 9" });
  await prisma.course.update({ where: { id: course.id }, data: { zaloGroupUrl: "https://zalo.me/g/abcxyz" } });
  for (const s of [S1, S2]) await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: course2.id, status: "active" } });
  const parentTok = tok(0xa1);
  await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "PH An" })).id, studentId: S1.id, status: "verified", verifiedAt: new Date(), portalToken: parentTok } });

  const today = vnDateKeyOf(new Date());
  // Buổi cách 3 ngày vào 19:00; ngày mới = hôm sau (khác thứ của khung).
  const D3 = addDaysKey(today, 3), D4 = addDaysKey(D3, 1);
  const sched = await prisma.classSchedule.create({ data: { courseId: course.id, dayOfWeek: dayOfWeekOfKey(D3), startTime: "19:00", endTime: "21:00" } });
  // Buổi ĐÃ BẮT ĐẦU cách đây 30 phút (khung khác).
  const past = new Date(Date.now() - 30 * 60_000), pastKey = vnDateKeyOf(past), pastM = vnMinutesOfDay(past);
  await prisma.classSchedule.create({ data: { courseId: course2.id, dayOfWeek: dayOfWeekOfKey(pastKey), startTime: hmOf(pastM), endTime: hmOf(Math.min(pastM + 60, 1439)) } });
  // Báo nghỉ sát giờ đang chờ của em An ở buổi sẽ huỷ.
  const abs = await prisma.classAbsence.create({ data: { courseId: course.id, scheduleId: sched.id, dateKey: D3, startAt: new Date(`${D3}T12:00:00Z`), studentId: S1.id, reportedBy: "parent", leadMinutes: 60, status: "pending" } });

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const opened: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me)\//, route => { opened.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>zalo</title>" }); });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo/i.test(m.text())) errors.push(m.text()); });

  const goToWeekOf = async (key: string) => {
    const want = weekRangeOf(key);
    const label = `Tuần ${ddmm(want.from)} – ${ddmm(want.to)}`;
    for (let i = 0; i < 6; i++) {
      if (await page.getByText(label).count()) return;
      const cur = weekRangeOf(today).from;
      await page.getByRole("button", { name: want.from > cur ? "Tuần sau ›" : "‹ Tuần trước" }).click();
      await page.waitForTimeout(400);
    }
  };
  // Lịch dạy (Figma 299:112052): màn rộng dùng lưới tuần + cột chi tiết thay cho danh sách thẻ → "thẻ" = khối trong lưới; chữ chi tiết ở cột phải.
  const card = () => page.getByRole("group", { name: "Lịch tuần theo giờ" });
  const side = () => page.getByRole("complementary", { name: "Chi tiết buổi" });
  const cardText = async () => (await card().innerText().catch(() => "")) + "\n" + (await side().innerText().catch(() => ""));
  const toggle = () => page.getByRole("button", { name: /Toán 9/ }).first();
  const openCard = async () => { if ((await toggle().getAttribute("aria-expanded")) !== "true") await toggle().click(); };

  await page.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Lịch dạy", exact: true }).waitFor({ timeout: 90000 });
  await goToWeekOf(D3);
  await toggle().waitFor({ timeout: 60000 });

  section("Buổi chưa bắt đầu có mục 'Đổi lịch buổi này'");
  await openCard();
  check("có mục 'Đổi lịch buổi này' với nút 'Dời buổi' và 'Huỷ buổi'", await page.getByRole("heading", { name: "Đổi lịch buổi này" }).isVisible() && await page.getByRole("button", { name: "Dời buổi", exact: true }).isVisible() && await page.getByRole("button", { name: "Huỷ buổi", exact: true }).isVisible());
  check("ghi rõ không đụng tới học phí + học viên được báo trong ứng dụng", await page.getByText(/Không đụng tới học phí/).isVisible() && await page.getByText(/Học viên được báo trong ứng dụng/).isVisible());
  check("báo nghỉ sát giờ đang chờ của em An hiện ở buổi", await page.getByText("Báo nghỉ sát giờ — chờ bạn xử lý").isVisible());

  section("Huỷ buổi");
  await page.getByRole("button", { name: "Huỷ buổi", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: /Huỷ buổi — Toán 9/ });
  await dlg.waitFor();
  check("hộp thoại Huỷ: không có ô ngày/giờ mới; nói rõ báo nghỉ chờ sẽ tự đóng", (await dlg.locator('input[type="date"]').count()) === 0 && await dlg.getByText(/Báo nghỉ sát giờ đang chờ của buổi này sẽ tự đóng/).isVisible());
  check("lựa chọn 'Huỷ buổi' đang được chọn (radio)", (await dlg.getByRole("radio", { name: "Huỷ buổi" }).getAttribute("aria-checked")) === "true");
  await dlg.getByLabel(/Lý do/).fill("Cô ốm");
  await dlg.getByRole("button", { name: "Huỷ buổi này" }).click();
  const notice = page.getByRole("dialog", { name: "Đã huỷ buổi" });
  await notice.waitFor({ timeout: 30000 });
  check("hộp 'Đã huỷ buổi' nêu: báo 2 học viên trong ứng dụng, 1 báo nghỉ chờ đã tự đóng, KiN không gửi giúp", await notice.getByText("Đã báo 2 học viên trong ứng dụng.").isVisible() && await notice.getByText(/1 báo nghỉ sát giờ đang chờ đã tự đóng/).isVisible() && await notice.getByText(/KiN không gửi giúp/).isVisible());
  const msg = notice.getByLabel("Tin báo lớp (sửa được trước khi gửi)");
  const text = await msg.inputValue();
  check("tin soạn sẵn: có HUỶ, môn, lý do; KHÔNG tên em / link / tiền", text.includes("HUỶ") && text.includes("Toán 9") && text.includes("Lý do: Cô ốm") && !/Em An|Em Bình|https?:/.test(text), text);
  check("nói rõ tin chung cho cả lớp và sẽ mở nhóm Zalo của lớp", await notice.getByText(/Tin chung cho cả lớp/).isVisible() && await notice.getByText(/Sẽ mở nhóm Zalo của lớp/).isVisible());
  await shot(page, "session-change-cancel-notice");
  await msg.fill(text + "\nCảm ơn anh/chị.");
  await notice.getByRole("button", { name: "Mở Zalo" }).click();
  await eventually("mở đúng nhóm Zalo của lớp", () => opened.includes("https://zalo.me/g/abcxyz"));
  check("tin ĐÃ SỬA được chép vào bộ nhớ tạm (gia sư dán và tự gửi)", (await page.evaluate(`navigator.clipboard.readText()`) as string).endsWith("Cảm ơn anh/chị."));
  await eventually("DB: ghi 'đã mở Zalo' (KiN không ghi 'đã gửi')", async () => !!(await prisma.classSessionChange.findFirst({ where: { scheduleId: sched.id, dateKey: D3, kind: "cancel", zaloOpenedAt: { not: null } } })));
  await eventually("DB: báo nghỉ chờ đã thành 'voided'", async () => (await prisma.classAbsence.findUnique({ where: { id: abs.id } }))?.status === "voided");
  await eventually("thẻ buổi: huy hiệu 'Đã huỷ', 'buổi đã huỷ', gạch ngang tên lớp", async () => {
    const c = card();
    const striked = await c.getByText("Toán 9", { exact: true }).first().evaluate(e => getComputedStyle(e).textDecorationLine.includes("line-through")).catch(() => false);
    return (await c.getByText("Đã huỷ", { exact: true }).count()) >= 1 && /buổi đã huỷ/i.test(await side().innerText()) && striked;
  });
  // Sau khi ghi "đã mở Zalo", trang còn phải tải lại lịch (GET) mới hiện dòng "Đã mở Zalo báo lớp lúc …": chờ dòng đó thay vì giả định đã xong.
  await eventually("giao diện làm mới xong: dòng 'Đã mở Zalo báo lớp lúc …' hiện trong chi tiết", async () => { await openCard(); return page.getByText(/Đã mở Zalo báo lớp lúc \d{2}:\d{2}/).isVisible(); }, 15000);
  check("chi tiết: 'Buổi này đã huỷ — lý do: Cô ốm' + 'Đã mở Zalo báo lớp lúc …'", await page.getByText(/Buổi này đã huỷ — lý do: Cô ốm/).isVisible() && await page.getByText(/Đã mở Zalo báo lớp lúc \d{2}:\d{2}/).isVisible());
  check("buổi huỷ KHÔNG còn mục 'Nhắc lịch' và nhãn báo nghỉ là 'Buổi đã huỷ — không tính phí, không buổi bù'", (await page.getByRole("heading", { name: "Nhắc lịch" }).count()) === 0 && await page.getByText("Buổi đã huỷ — không tính phí, không buổi bù").isVisible());
  check("có các nút: Mở lại tin báo lớp, Sửa lý do huỷ, Đổi thành dời buổi, Khôi phục lịch cũ", await page.getByRole("button", { name: "Mở lại tin báo lớp" }).isVisible() && await page.getByRole("button", { name: "Sửa lý do huỷ" }).isVisible() && await page.getByRole("button", { name: "Đổi thành dời buổi" }).isVisible() && await page.getByRole("button", { name: "Khôi phục lịch cũ" }).isVisible());
  await shot(page, "session-change-cancelled-card");

  section("Phụ huynh thấy buổi đã huỷ (Sổ của con)");
  const gctx = await ctxFor(null);
  const pp = await gctx.newPage();
  pp.on("pageerror", e => errors.push(String(e)));
  await pp.goto(`${BASE}/so-cua-con/${parentTok}`, { waitUntil: "networkidle", timeout: 120000 });
  const item = pp.getByRole("listitem").filter({ hasText: "Toán 9" }).first();
  await item.waitFor({ timeout: 90000 });
  check("buổi hiện kèm 'Gia sư đã huỷ buổi này — lý do: Cô ốm. Không cần báo nghỉ.'", await item.getByText(/Gia sư đã huỷ buổi này — lý do: Cô ốm\. Không cần báo nghỉ\./).isVisible());
  check("KHÔNG có nút 'Báo nghỉ' ở buổi đã huỷ", (await item.getByRole("button", { name: "Báo nghỉ" }).count()) === 0);
  check("tên lớp và giờ bị gạch ngang", await item.getByText("Toán 9", { exact: true }).first().evaluate(e => getComputedStyle(e).textDecorationLine.includes("line-through")));
  await shot(pp, "session-change-parent-cancelled");

  section("Đổi từ Huỷ sang Dời");
  await page.getByRole("button", { name: "Đổi thành dời buổi" }).click();
  const mdlg = page.getByRole("dialog", { name: /Dời buổi — Toán 9/ });
  await mdlg.waitFor();
  check("hộp thoại Dời: có ô ngày + giờ bắt đầu + giờ kết thúc; lý do cũ được điền sẵn", await mdlg.getByLabel("Ngày mới").isVisible() && await mdlg.getByLabel("Giờ bắt đầu mới").isVisible() && await mdlg.getByLabel("Giờ kết thúc mới").isVisible() && (await mdlg.getByLabel(/Lý do/).inputValue()) === "Cô ốm");
  await mdlg.getByLabel("Ngày mới").fill(addDaysKey(D3, 7));
  await mdlg.getByRole("button", { name: "Dời buổi", exact: true }).click();
  await mdlg.getByText(/đã là ngày học theo lịch tuần/).waitFor({ timeout: 15000 });
  check("dời sang ngày học khác của khung: báo lỗi RÕ ngay trong hộp thoại, hộp thoại ở lại, DB không đổi", (await prisma.classSessionChange.findFirst({ where: { scheduleId: sched.id, dateKey: D3 } }))?.kind === "cancel");
  await mdlg.getByLabel("Ngày mới").fill(D4);
  await mdlg.getByLabel("Giờ bắt đầu mới").fill("20:30");
  await mdlg.getByLabel("Giờ kết thúc mới").fill("22:00");
  await mdlg.getByLabel(/Lý do/).fill("Trùng lịch thi");
  await mdlg.getByRole("button", { name: "Dời buổi", exact: true }).click();
  const n2 = page.getByRole("dialog", { name: "Đã dời buổi" });
  await n2.waitFor({ timeout: 30000 });
  const t2 = await n2.getByLabel("Tin báo lớp (sửa được trước khi gửi)").inputValue();
  check("tin báo dời: 'DỜI sang 20:30' + lý do", t2.includes("DỜI sang 20:30") && t2.includes("Trùng lịch thi"), t2);
  check("báo nghỉ sát giờ đã mở lại — gia sư thấy ở hộp tóm tắt? (voided → pending, hộp 'dời' không nói là đã đóng)", (await n2.getByText(/đã tự đóng/).count()) === 0);
  await n2.getByRole("button", { name: "Để sau" }).click();
  await eventually("DB: kind=move, ngày mới D4, 'đã mở Zalo' bị xoá (tin cũ không còn đúng)", async () => { const c = await prisma.classSessionChange.findFirst({ where: { scheduleId: sched.id, dateKey: D3 } }); return c?.kind === "move" && c.newDateKey === D4 && c.zaloOpenedAt === null; });
  await eventually("DB: báo nghỉ chờ được mở lại (pending)", async () => (await prisma.classAbsence.findUnique({ where: { id: abs.id } }))?.status === "pending");
  await goToWeekOf(D4);
  await eventually("thẻ buổi hiện ở ngày MỚI với 'Đã dời' + 'dời từ …'", async () => { const t = await cardText(); return t.includes("Đã dời") && t.includes("dời từ") && t.includes("20:30"); });
  const h4 = page.getByRole("heading", { level: 2 }).filter({ hasText: ddmm(D4) });
  check("thẻ nằm dưới đúng ngày mới (heading ngày D4)", await h4.count() >= 1);
  await shot(page, "session-change-moved-card");

  section("Phụ huynh thấy buổi đã dời, vẫn báo nghỉ được");
  await pp.reload({ waitUntil: "networkidle" });
  const item2 = pp.getByRole("listitem").filter({ hasText: "Toán 9" }).first();
  await item2.waitFor({ timeout: 90000 });
  check("'Gia sư đã dời buổi này (lịch cũ: … lúc 19:00) — lý do: Trùng lịch thi'", await item2.getByText(/Gia sư đã dời buổi này \(lịch cũ: .* lúc 19:00\) — lý do: Trùng lịch thi/).isVisible());
  check("giờ hiện là giờ MỚI 20:30–22:00; vẫn còn trạng thái báo nghỉ của em", /20:30–22:00/.test(await item2.innerText()) && await item2.getByText(/chờ gia sư xác nhận/).isVisible());

  section("Khôi phục");
  await page.getByRole("button", { name: "Khôi phục lịch cũ" }).click();
  const n3 = page.getByRole("dialog", { name: "Đã khôi phục buổi về lịch tuần" });
  await n3.waitFor({ timeout: 30000 });
  check("tin khôi phục: 'GIỮ NGUYÊN lịch'", (await n3.getByLabel("Tin báo lớp (sửa được trước khi gửi)").inputValue()).includes("GIỮ NGUYÊN"));
  await n3.getByRole("button", { name: "Để sau" }).click();
  await eventually("DB: dòng thay đổi bị xoá", async () => (await prisma.classSessionChange.count({ where: { scheduleId: sched.id } })) === 0);
  await goToWeekOf(D3);
  await eventually("thẻ buổi trở về ngày gốc, hết huy hiệu 'Đã dời'/'Đã huỷ'", async () => { const t = await cardText(); return t.length > 0 && !t.includes("Đã dời") && !t.includes("Đã huỷ") && !t.includes("dời từ"); });
  await shot(page, "session-change-restored");

  section("Buổi đã bắt đầu: không đổi lịch được");
  if (pastKey === today) {
    await goToWeekOf(today);
    const lyBtn = page.getByRole("button", { name: /Lý 9/ }).first();
    await lyBtn.waitFor({ timeout: 60000 });
    if ((await lyBtn.getAttribute("aria-expanded")) !== "true") await lyBtn.click();
    check("buổi đã bắt đầu KHÔNG có mục 'Đổi lịch buổi này'", (await page.getByRole("heading", { name: "Đổi lịch buổi này" }).count()) === 0 || !(await page.locator("li").filter({ has: lyBtn }).getByRole("heading", { name: "Đổi lịch buổi này" }).count()));
  } else check("(bỏ qua: buổi 'đã bắt đầu' rơi sang hôm qua do chạy lúc 0h)", true);

  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 800 });
  const mp = await mctx.newPage();
  mp.on("pageerror", e => errors.push(String(e)));
  await mp.goto(`${BASE}/lop-cua-toi/lich`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Lịch dạy", exact: true }).waitFor({ timeout: 90000 });
  const want = weekRangeOf(D3);
  for (let i = 0; i < 4 && !(await mp.getByText(`Tuần ${ddmm(want.from)} – ${ddmm(want.to)}`).count()); i++) { await mp.getByRole("button", { name: want.from > weekRangeOf(today).from ? "Tuần sau ›" : "‹ Tuần trước" }).click(); await mp.waitForTimeout(400); }
  await mp.getByRole("button", { name: /Toán 9/ }).first().click();
  await mp.getByRole("button", { name: "Dời buổi", exact: true }).click();
  const md = mp.getByRole("dialog", { name: /Dời buổi — Toán 9/ });
  await md.waitFor();
  check("hộp thoại Dời vừa màn hình điện thoại, không tràn ngang", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  const hs = await md.locator("input, textarea, button").evaluateAll(es => es.map(e => Math.round((e as HTMLElement).getBoundingClientRect().height)));
  check("ô nhập và nút trong hộp thoại cao ≥ 44px (trừ ô lý do nhiều dòng)", hs.filter(h => h > 0).every(h => h >= 44), hs);
  await shot(mp, "session-change-mobile");

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
