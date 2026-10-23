// KiN Pro F4 + F5 + F6 — trình duyệt thật, 390px. Chạy hai cấu hình máy chủ (pro-stats-run.sh): EXPECT_ENFORCE=0 / 1.
//   • Doanh thu: khối chuyên cần (Free khoá khi cổng bật, Pro thấy đủ, số trên màn = số API); không tràn ngang; nút ≥44px; số cơ bản không bị che
//   • Tạo đề thi: ô 'Còn N lượt' trước/sau, hết lượt → nút tới Gói
//   • Liên hệ hỗ trợ: gửi, nhãn 'Ưu tiên' của Pro, quản trị trả lời, gia sư thấy trả lời
import { BASE, api, mkTutor, mkSuper, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, addDaysKey } from "@/lib/classSessions";

const ENFORCE = process.env.EXPECT_ENFORCE === "1";
const DAY = 86_400_000;

(async () => {
  await wipe();
  const TF = await mkTutor("Cô Free"), TP = await mkTutor("Cô Pro"), SA = await mkSuper("Quản trị hỗ trợ");
  await prisma.proOrder.create({ data: { userId: TP.id, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 0, source: "admin_grant", memoCode: `UI-${Date.now()}`, status: "active", startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 20 * DAY) } });
  const today = vnDateKeyOf(new Date());
  for (const owner of [TF, TP]) {
    const course = await mkCourse(owner.id, { name: "Toán 9 thử" });
    const studs = [];
    for (let i = 0; i < 6; i++) { const s = await mkUser({ name: `Em Thử ${i}` }); studs.push(s); await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active", createdAt: new Date(Date.now() - 120 * DAY) } }); }
    for (const off of [1, 3, 8, 10, 15]) {
      const sess = await prisma.attendanceSession.create({ data: { courseId: course.id, date: new Date(`${addDaysKey(today, -off)}T00:00:00.000Z`), createdBy: owner.id } });
      await prisma.attendanceRecord.createMany({ data: studs.map((s, i) => ({ sessionId: sess.id, userId: s.id, status: i === 0 && off <= 8 ? "absent" : i === 1 && off === 10 ? "late" : "present" })) });
    }
  }

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    const devPerf = /negative time stamp/i;
    p.on("pageerror", (e: unknown) => { if (!devPerf.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 4|status of 5|Hydration/i.test(m.text()) && !devPerf.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (pg: any) => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  const minH = async (loc: any) => (await loc.boundingBox())?.height ?? 0;

  section("Doanh thu 390px · gia sư Free");
  const cf = await ctxFor(TF, { width: 390, height: 844 }); const pf = await cf.newPage(); watch(pf);
  await pf.goto(`${BASE}/lop-cua-toi/doanh-thu`, { waitUntil: "networkidle", timeout: 120000 });
  await pf.getByTestId("thong-ke-chuyen-can").waitFor({ timeout: 90000 });
  await pf.getByRole("heading", { name: "Theo lớp" }).waitFor();
  check("số cơ bản không bị che: 'Đã thu', 'Theo tháng thu tiền', 'Theo lớp' đều hiện", await pf.getByText("Đã thu", { exact: true }).isVisible() && await pf.getByRole("heading", { name: "Theo tháng thu tiền" }).isVisible());
  if (ENFORCE) {
    const lock = pf.getByTestId("khoa-pro");
    await lock.waitFor({ timeout: 30000 });
    check("cổng BẬT, Free: khối mờ có chữ 'Có trong KiN Pro'", await lock.getByText("Có trong KiN Pro").isVisible());
    const btn = pf.getByTestId("khoa-pro-nut");
    check("nút tới /lop-cua-toi/goi, cao ≥ 44px", (await btn.getAttribute("href")) === "/lop-cua-toi/goi" && (await minH(btn)) >= 44, await minH(btn));
    check("khối mờ không có tên em hay số phần trăm nào", !/Em Thử|%/.test(await pf.getByTestId("thong-ke-chuyen-can").innerText()));
    check("DOM không có dữ liệu thật (không testid xu hướng / vắng liên tiếp)", (await pf.getByTestId("xh-tuan").count()) === 0 && (await pf.getByTestId("vang-lien-tiep").count()) === 0);
    await btn.click(); await pf.waitForURL("**/lop-cua-toi/goi", { timeout: 60000 });
    check("bấm nút → màn Gói của tôi", pf.url().endsWith("/lop-cua-toi/goi"));
    await pf.goto(`${BASE}/lop-cua-toi/doanh-thu`, { waitUntil: "networkidle" }); await pf.getByTestId("khoa-pro").waitFor();
  } else {
    await pf.getByTestId("vang-lien-tiep").waitFor({ timeout: 30000 });
    check("cổng TẮT: Free thấy đủ khối, không có khối khoá", (await pf.getByTestId("khoa-pro").count()) === 0 && await pf.getByTestId("xh-tuan").isVisible());
  }
  check("390px không tràn ngang", await noOverflow(pf));
  await shot(pf, `pro-stats-free-${ENFORCE ? "bat" : "tat"}`);

  section("Doanh thu 390px · gia sư Pro, số trên màn = số API");
  const cp = await ctxFor(TP, { width: 390, height: 844 }); const pp = await cp.newPage(); watch(pp);
  await pp.goto(`${BASE}/lop-cua-toi/doanh-thu`, { waitUntil: "networkidle", timeout: 120000 });
  await pp.getByTestId("vang-lien-tiep").waitFor({ timeout: 90000 });
  const apiJson = (await api("GET", "/api/tutor/thong-ke-chuyen-can", { as: TP })).json;
  const items = pp.getByTestId("xh-tuan").locator("li");
  check("8 dòng tuần, 6 dòng tháng", (await items.count()) === 8 && (await pp.getByTestId("xh-thang").locator("li").count()) === 6);
  let ok = true;
  for (const w of apiJson.weekly) {
    const li = pp.getByTestId(`xh-tuan-${w.key}`); const t = await li.innerText();
    const shown = w.rate !== null ? t.includes(`${w.rate}%`) && t.includes(`${w.n} lượt`) : /Chưa đủ dữ liệu|Chưa có buổi/.test(t);
    if (!shown) { ok = false; console.log("  lệch", w, t); }
  }
  for (const m of apiJson.monthly) {
    const t = await pp.getByTestId(`xh-thang-${m.key}`).innerText();
    if (!(m.rate !== null ? t.includes(`${m.rate}%`) : /Chưa đủ dữ liệu|Chưa có buổi/.test(t))) { ok = false; console.log("  lệch", m, t); }
  }
  check("mọi tuần/tháng hiển thị đúng phần trăm và số lượt của API", ok);
  const vang = await pp.getByTestId("vang-lien-tiep").innerText();
  check("em vắng liên tiếp hiện tên em và 'Vắng 3 buổi liên tiếp'", /Em Thử 0/.test(vang) && /Vắng 3 buổi liên tiếp/.test(vang), vang);
  const cmp = await pp.getByTestId("so-sanh-lop").innerText();
  check("so sánh lớp hiện tên lớp và đúng phần trăm", cmp.includes("Toán 9 thử") && cmp.includes(`${apiJson.compare.rows[0].rate}%`), cmp);
  check("390px không tràn ngang", await noOverflow(pp));
  await shot(pp, "pro-stats-pro");

  section("Tạo đề thi · ô 'Còn N lượt AI trích đề'");
  const openCreate = async (pg: any) => {
    await pg.goto(`${BASE}/admin/thi-thu`, { waitUntil: "networkidle", timeout: 120000 });
    await pg.getByRole("button", { name: "+ Tạo đề thi mới" }).first().click();
    await pg.getByTestId("ai-quota-note").waitFor({ timeout: 60000 });
  };
  await openCreate(pf);
  check("Free: 'Còn 3 lượt' và link tới /lop-cua-toi/goi", (await pf.getByTestId("ai-quota-remaining").innerText()).includes("Còn 3 lượt") && (await pf.getByTestId("ai-quota-link").getAttribute("href")) === "/lop-cua-toi/goi");
  check(ENFORCE ? "cổng BẬT: không có câu 'chưa chặn'" : "cổng TẮT: nói thẳng 'Hiện KiN chưa chặn khi hết lượt'", (await pf.getByTestId("ai-quota-note").innerText()).includes("chưa chặn") === !ENFORCE);
  check("nút ≥ 44px", (await minH(pf.getByTestId("ai-quota-link"))) >= 44);
  for (let i = 0; i < 3; i++) await prisma.usageEvent.create({ data: { userId: TF.id, kind: "ai_extract", meta: { thu: true } } });
  await openCreate(pf);
  const note = pf.getByTestId("ai-quota-note");
  if (ENFORCE) {
    check("cổng BẬT, hết lượt: câu 'Đã hết lượt AI trích đề tháng này' + nút 'Xem Gói của tôi'", (await note.innerText()).includes("Đã hết lượt AI trích đề tháng này") && (await pf.getByTestId("ai-quota-link").innerText()) === "Xem Gói của tôi");
  } else {
    check("cổng TẮT, hết lượt: 'Còn 0 lượt' nhưng nói chưa chặn", (await note.innerText()).includes("Còn 0 lượt") && (await note.innerText()).includes("chưa chặn"));
  }
  check("390px không tràn ngang (modal tạo đề)", await noOverflow(pf));
  await shot(pf, `pro-stats-ai-${ENFORCE ? "bat" : "tat"}`);

  section("Liên hệ hỗ trợ 390px");
  await pp.goto(`${BASE}/lop-cua-toi/ho-tro`, { waitUntil: "networkidle", timeout: 120000 });
  await pp.getByTestId("form-ho-tro").waitFor({ timeout: 90000 });
  check("Pro: lời hứa 'xếp trước … giờ hành chính', không 24/7", /giờ hành chính/.test(await pp.getByTestId("loi-hua").innerText()) && !/24\/7/.test(await pp.locator("body").innerText()));
  check("form có lời dặn không ghi tên/ảnh học sinh", /họ tên, số điện thoại, ảnh/.test(await pp.locator("body").innerText()));
  check("nút Gửi ≥ 44px; mỗi lựa chọn loại việc ≥ 44px", (await minH(pp.getByTestId("gui"))) >= 44 && (await minH(pp.locator('label:has(input[name="kind"])').first())) >= 44);
  await pp.getByTestId("tieu-de").fill("Kẹt khi nối SePay");
  await pp.getByTestId("noi-dung").fill("Dán khoá webhook xong báo lỗi, đã thử lại hai lần vẫn vậy.");
  await pp.getByTestId("gui").click();
  await pp.getByTestId("ket-qua").waitFor({ timeout: 30000 });
  check("gửi xong: 'Đã ghi trên KiN', mục mới hiện với nhãn 'Ưu tiên' và 'Chờ trả lời' (chữ, không chỉ màu)", (await pp.getByTestId("ket-qua").innerText()).startsWith("Đã ghi trên KiN") && await pp.getByTestId("yeu-cau").first().getByText("Ưu tiên").isVisible() && await pp.getByTestId("yeu-cau").first().getByText("Chờ trả lời").isVisible());
  await pp.getByTestId("gui").waitFor();
  check("form được làm trống sau khi gửi", (await pp.getByTestId("tieu-de").inputValue()) === "");
  check("390px không tràn ngang", await noOverflow(pp));
  await shot(pp, "pro-stats-ho-tro");
  const cs = await ctxFor(SA, { width: 390, height: 844 }); const ps = await cs.newPage(); watch(ps);
  await ps.goto(`${ADMIN}/admin/ho-tro`, { waitUntil: "networkidle", timeout: 120000 });
  await ps.getByTestId("hang-doi").first().waitFor({ timeout: 90000 });
  check("quản trị thấy yêu cầu Pro ở làn 'Ưu tiên', có tên gia sư", await ps.getByTestId("hang-doi").first().getByText("Ưu tiên").isVisible() && (await ps.getByTestId("hang-doi").first().innerText()).includes("Cô Pro"));
  await ps.getByLabel("Trả lời Cô Pro").fill("Cô gửi lại khoá API ở mục Kết nối nhé.");
  await ps.getByRole("button", { name: "Gửi trả lời" }).click();
  await ps.getByText("Đã gửi trả lời.").waitFor({ timeout: 30000 });
  await pp.reload({ waitUntil: "networkidle" });
  await pp.getByTestId("tra-loi").waitFor({ timeout: 60000 });
  check("gia sư thấy 'KiN trả lời' kèm nội dung và trạng thái 'Đã trả lời'", (await pp.getByTestId("tra-loi").innerText()).includes("Cô gửi lại khoá API") && await pp.getByTestId("yeu-cau").first().getByText("Đã trả lời").isVisible());
  check("trang quản trị 390px không tràn ngang", await noOverflow(ps));

  section("Không lỗi trình duyệt");
  check("không pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
