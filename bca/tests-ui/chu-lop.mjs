// Nhóm CHỦ LỚP — Hôm nay, Học sinh (gia hạn / chuyển chính thức + Hoàn tác, lọc / tìm không dấu), Buổi học (record, huỷ buổi).
import { test, chay, ok, bang, W, moTrang, khongTranNgang, boDau, doi, bangBuoi, fetchTrongTrang } from "./lib.mjs";

const N = "Chủ lớp";

for (const [k, kich] of Object.entries(W)) {
  test(N, `Hôm nay đủ 4 khối + chip/thẻ số khớp (${kich.width})`, async (t) => {
    const { page } = await t.trang("chu", kich);
    await moTrang(page, "/quan-ly");
    await page.getByRole("region", { name: "Lớp tối nay" }).waitFor();
    for (const h of ["Việc cần làm", "Số liệu lớp", "7 ngày tới"]) ok(await page.getByRole("heading", { name: h, exact: true }).isVisible(), `Thiếu khối "${h}"`);
    ok(await page.getByRole("region", { name: "Lớp tối nay" }).locator("h2").first().isVisible(), "Thẻ lớp tối nay không có tiêu đề");
    // Hộp việc chia tab (QĐ 27): Chưa điểm · Học thử · Đơn · Thiếu record — mỗi tab có số đếm
    const viec = page.getByRole("region", { name: "Việc cần làm" });
    const tab = async (nhan) => {
      const l = viec.getByRole("tab", { name: new RegExp(`^${nhan}\\s*\\d+$`) });
      ok(await l.isVisible(), `Thiếu tab "${nhan}"`);
      return { l, so: Number((await l.innerText()).match(/(\d+)\s*$/)[1]) };
    };
    await tab("Chưa điểm");
    await tab("Thiếu record");
    ok((await tab("Đơn")).so >= 1, "Dữ liệu giả có 1 đơn chờ duyệt mà tab Đơn = 0");
    const thu = await tab("Học thử");
    await thu.l.click();
    // Tổng "· N em" của các nhóm "Thử sắp hết · Hết …" = thẻ số "Thử hết trong 3 ngày"; cộng nhóm hết thử = số trên tab
    const dem = async (re) => (await page.locator("h3", { hasText: re }).allInnerTexts()).reduce((s, x) => s + Number(x.match(/· (\d+) em/)[1]), 0);
    const soSap = await dem(/^Thử sắp hết · Hết/);
    const the = page.locator("a", { hasText: "Thử hết trong 3 ngày" });
    bang(Number((await the.innerText()).match(/\d+/)[0]), soSap, "Thẻ số Thử hết trong 3 ngày khác tổng các nhóm");
    bang(soSap + (await dem(/^Hết thử – hỏi em/)), thu.so, "Số trên tab Học thử khác tổng em trong các nhóm");
    ok(await page.getByRole("heading", { name: /^Hết thử – hỏi em/ }).isVisible(), "Thiếu nhóm Hết thử – hỏi em");
    await khongTranNgang(page, "Hôm nay");
    await t.chup(page, `chu-hom-nay-${kich.width}`);
  });
}

test(N, "Thẻ số Thử hết trong 3 ngày → danh sách lọc đúng số em, URL het=3, F5 giữ lọc (390)", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  await moTrang(page, "/quan-ly");
  const chip = page.locator("a", { hasText: "Thử hết trong 3 ngày" });
  const so = Number((await chip.innerText()).match(/\d+/)[0]);
  await chip.click();
  await page.waitForURL(/\/quan-ly\/hoc-sinh\?het=3/);
  const dem = page.locator("p[aria-live=polite] span.so", { hasText: / em$/ });
  await doi(async () => (await dem.innerText()) === `${so} em`, 8000, `Danh sách lọc het=3 không ra ${so} em (đang "${await dem.innerText()}")`);
  await page.reload({ waitUntil: "networkidle" });
  ok(page.url().includes("het=3"), "F5 mất lọc het=3");
  bang(await dem.innerText(), `${so} em`, "Sau F5 số em đổi");
});

test(N, "Gia hạn 1 em: thiếu lý do bị chặn (không gửi) → +7 ngày → Hoàn tác (390)", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  const api = await t.api("chu");
  const truoc = (await api.get("/api/hoc-sinh/HS0021")).json;
  bang(truoc.thu.den, "2026-11-28", "Dữ liệu giả: HS0021 phải hết thử 28/11");
  await moTrang(page, "/quan-ly/hoc-sinh/HS0021");
  let soLanGui = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/gia-han") && r.method() === "POST") soLanGui++; });
  await page.getByRole("button", { name: "Gia hạn thử", exact: true }).click();
  const hop = page.getByRole("dialog");
  await hop.getByRole("heading", { name: /Gia hạn thử · / }).waitFor();
  await hop.getByRole("button", { name: "Gia hạn", exact: true }).click();
  await hop.getByRole("alert").filter({ hasText: "Cần ghi lý do" }).waitFor();
  bang(soLanGui, 0, "Thiếu lý do mà vẫn gửi POST /api/gia-han");
  bang((await api.get("/api/hoc-sinh/HS0021")).json.thu.den, "2026-11-28", "Thiếu lý do mà hạn thử đã đổi");
  // Máy chủ cũng phải chặn khi thiếu lý do (gọi thẳng API, bỏ qua giao diện)
  t.choPhepConsole(/status of 400/);
  bang(await fetchTrongTrang(page, "POST", "/api/gia-han", { maHs: ["HS0021"], soNgay: 7 }), 400, "API gia hạn thiếu lý do không trả 400");
  await hop.getByRole("button", { name: "+7 ngày" }).click();
  await hop.getByRole("textbox", { name: /Lý do/ }).fill("Em bận thi giữa kỳ (kiểm thử)");
  await hop.getByRole("button", { name: "Gia hạn", exact: true }).click();
  const tb = page.getByRole("status").filter({ hasText: "Đã gia hạn Nguyễn Minh Linh tới 05/12" });
  await tb.waitFor();
  bang((await api.get("/api/hoc-sinh/HS0021")).json.thu.den, "2026-12-05", "Máy chủ chưa ghi hạn mới 05/12");
  await tb.getByRole("button", { name: "Hoàn tác" }).click();
  await page.getByRole("status").filter({ hasText: "Đã hoàn tác gia hạn" }).waitFor();
  bang((await api.get("/api/hoc-sinh/HS0021")).json.thu.den, "2026-11-28", "Hoàn tác không trả hạn về 28/11");
  await khongTranNgang(page, "Trang một em");
  await t.chup(page, "chu-hoc-sinh-HS0021-390");
});

test(N, "Chuyển chính thức Toán+Anh: mặc định 29/11, 55.000đ/buổi/môn (bỏ 1 môn → 65.000đ/buổi) → Hoàn tác (1280)", async (t) => {
  const { page } = await t.trang("chu", W.mt);
  const api = await t.api("chu");
  const ct = async () => (await api.get("/api/hoc-sinh/HS0043")).json.mon.flatMap((m) => m.ghi_danh.filter((g) => g.loai === "chinh_thuc" && !g.huy).map((g) => `${m.ma}:${g.tu_ngay}`));
  bang((await ct()).length, 0, "Dữ liệu giả: HS0043 chưa có ghi danh chính thức");
  await moTrang(page, "/quan-ly/hoc-sinh/HS0043");
  await page.getByRole("button", { name: "Chuyển chính thức", exact: true }).click();
  const hop = page.getByRole("dialog");
  await hop.getByRole("heading", { name: /Chuyển chính thức · / }).waitFor();
  bang(await hop.locator('input[type="date"]').inputValue(), "2026-11-29", "Ngày chính thức mặc định không phải 29/11 (hết thử 28/11)");
  const giaText = () => hop.locator("p", { hasText: /→ .*\/buổi/ }).innerText();
  ok(/55\.000\s?đ\/buổi\/môn/.test(await giaText()), `2 môn phải 55.000đ/buổi/môn, đang: ${await giaText()}`);
  await hop.getByRole("checkbox", { name: /^Anh/ }).uncheck();
  ok(/1 môn → 65\.000\s?đ\/buổi(?!\/môn)/.test(await giaText()), `1 môn phải 65.000đ/buổi, đang: ${await giaText()}`);
  await hop.getByRole("checkbox", { name: /^Anh/ }).check();
  ok(/2 môn → 55\.000/.test(await giaText()), "Chọn lại Anh mà giá không về 55.000");
  await hop.getByRole("button", { name: "Chuyển chính thức", exact: true }).click();
  const tb = page.getByRole("status").filter({ hasText: /Đã chuyển .* lên chính thức/ });
  await tb.waitFor();
  const sau = await ct();
  ok(sau.length === 2 && sau.every((x) => x.endsWith("2026-11-29")), `Máy chủ phải có 2 ghi danh chính thức từ 29/11, đang: ${sau}`);
  await tb.getByRole("button", { name: "Hoàn tác" }).click();
  await page.getByRole("status").filter({ hasText: "Đã hoàn tác chuyển chính thức" }).waitFor();
  bang((await ct()).length, 0, "Hoàn tác mà vẫn còn ghi danh chính thức");
  await t.chup(page, "chu-chuyen-chinh-thuc-1280");
});

for (const [k, kich] of Object.entries(W)) {
  test(N, `Học sinh: tìm không dấu, SĐT 4 số cuối, "dang" khớp "Đặng", URL q= (${kich.width})`, async (t) => {
    const { page } = await t.trang("chu", kich);
    await moTrang(page, "/quan-ly/hoc-sinh");
    const o = page.getByRole("searchbox", { name: "Tìm học sinh" });
    const dem = page.locator("p[aria-live=polite] span.so", { hasText: / em$/ });
    const tenHien = async () => (kich.width < 1024
      ? page.locator("ul.lg\\:hidden > li span.font-semibold[translate=no]").allInnerTexts()
      : page.locator("table tbody tr td:nth-child(2) a[translate=no]").allInnerTexts());
    const tim = async (q) => {
      await o.fill(q);
      await page.waitForURL((u) => u.searchParams.get("q") === q.trim(), { timeout: 5000 });
      await page.waitForTimeout(150);
      return tenHien();
    };
    let ds = await tim("nguyen minh linh");
    ok(ds.includes("Nguyễn Minh Linh"), `Gõ không dấu "nguyen minh linh" không thấy "Nguyễn Minh Linh": ${ds}`);
    ok(ds.every((x) => boDau(x).includes("nguyen minh linh")), `Có tên không khớp: ${ds}`);
    bang(await dem.innerText(), `${ds.length} em`, "Số em hiện khác số dòng");
    ds = await tim("dang bao");
    ok(ds.length > 0 && ds.every((x) => x.startsWith("Đặng Bảo")), `"dang bao" phải ra các em "Đặng Bảo …": ${ds}`);
    // 4 số cuối SĐT HS0021 (0910000020) — dữ liệu giả: "0020" cũng là đuôi mã HS0020 nên ra 2 em; 6 số cuối thì đúng một em
    ds = await tim("0020");
    ok(ds.includes("Nguyễn Minh Linh"), `Tìm 4 số cuối SĐT 0020 không thấy HS0021: ${ds}`);
    ds = await tim("000020");
    bang(JSON.stringify(ds), JSON.stringify(["Nguyễn Minh Linh"]), "Tìm 6 số cuối SĐT 000020 phải ra đúng HS0021");
    ds = await tim("zzzz khong co");
    ok(await page.getByText(/Không có em nào khớp/).isVisible(), "Không có kết quả mà không báo");
    await khongTranNgang(page, "Học sinh");
    await t.chup(page, `chu-hoc-sinh-tim-${kich.width}`);
  });
}

test(N, "Học sinh: lọc môn Anh + lứa L2 (URL), đếm khớp API (1280)", async (t) => {
  const { page } = await t.trang("chu", W.mt);
  const api = await t.api("chu");
  const all = (await api.get("/api/hoc-sinh")).json.hoc_sinh;
  const can = all.filter((x) => x.lua?.ma === "L2" && x.mon?.anh).length;
  await moTrang(page, "/quan-ly/hoc-sinh?mon=anh&lua=L2");
  bang(await page.locator("p[aria-live=polite] span.so", { hasText: / em$/ }).innerText(), `${can} em`, "Lọc Anh + L2 khác số API");
  const chip = await page.locator("table tbody tr td:nth-child(3)").allInnerTexts();
  ok(chip.every((x) => /Anh/.test(x)), "Có dòng không có môn Anh khi lọc mon=anh");
});

test(N, "Buổi học (390): hôm nay trong tầm nhìn; Dán record tự thêm https://; 'abc xyz' báo lỗi, không lưu", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  const api = await t.api("chu");
  const tra = await bangBuoi(api);
  const b = tra("anh", "2026-11-23");
  ok(!b.link_record, "Dữ liệu giả: Anh 23/11 phải thiếu record");
  await moTrang(page, "/quan-ly/buoi-hoc?thang=2026-11");
  const homNay = page.locator("main li", { has: page.getByText("Hôm nay", { exact: true }) }).first();
  const hop = await homNay.boundingBox();
  ok(hop && hop.y >= 0 && hop.y + 40 <= W.dt.height, `Hàng "Hôm nay" không nằm trong tầm nhìn khi mở trang (y=${hop?.y})`);
  await page.locator(`a[href*="buoi=${b.id}"][href*="dan=1"]`).click();
  await page.waitForURL(new RegExp(`buoi=${b.id}`));
  const o = page.locator('input[name="record"]');
  await o.waitFor();
  await doi(() => o.evaluate((el) => document.activeElement === el), 3000, "Mở bằng Dán record mà tiêu điểm không ở ô link");
  // Dán (sự kiện paste thật) link thiếu https://
  await o.evaluate((el, s) => { const dt = new DataTransfer(); dt.setData("text", s); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, "drive.google.com/file/d/kt-abc/view");
  await doi(async () => (await o.inputValue()) === "https://drive.google.com/file/d/kt-abc/view", 3000, `Ô không tự thêm https:// (đang "${await o.inputValue()}")`);
  await page.getByText(/^Đã lưu ·/).waitFor();
  bang((await bangBuoi(api))("anh", "2026-11-23").link_record, "https://drive.google.com/file/d/kt-abc/view", "Máy chủ chưa lưu link đã chuẩn hoá");
  await o.fill("abc xyz");
  await o.press("Enter");
  await page.getByText(/Đây không phải link/).waitFor();
  await page.waitForTimeout(800);
  bang((await bangBuoi(api))("anh", "2026-11-23").link_record, "https://drive.google.com/file/d/kt-abc/view", "Link sai 'abc xyz' vẫn bị lưu");
  await khongTranNgang(page, "Buổi học chi tiết");
  await t.chup(page, "chu-buoi-hoc-record-390");
});

test(N, "Huỷ buổi Toán 28/11: thiếu lý do bị chặn (UI + API 400) → huỷ → Hoàn tác về Có học; bấm hàng không dài lịch sử (1280)", async (t) => {
  const { page } = await t.trang("chu", W.mt);
  const api = await t.api("chu");
  const b = (await bangBuoi(api))("toan", "2026-11-28");
  bang(b.trang_thai, "binh_thuong", "Dữ liệu giả: Toán 28/11 phải đang Có học");
  await moTrang(page, `/quan-ly/buoi-hoc?thang=2026-11&buoi=${b.id}`);
  let gui = 0;
  page.on("request", (r) => { if (r.url().includes(`/api/buoi-hoc/${b.id}/huy`)) gui++; });
  await page.getByRole("button", { name: "Huỷ buổi…" }).click();
  const hop = page.getByRole("dialog");
  await hop.getByRole("heading", { name: /Huỷ buổi Toán/ }).waitFor();
  await hop.getByRole("button", { name: "Huỷ buổi", exact: true }).click();
  await hop.getByRole("alert").filter({ hasText: "Cần ghi lý do huỷ" }).waitFor();
  bang(gui, 0, "Thiếu lý do mà vẫn gửi yêu cầu huỷ");
  t.choPhepConsole(/status of 400/);
  bang(await fetchTrongTrang(page, "POST", `/api/buoi-hoc/${b.id}/huy`, { xacNhan: true }), 400, "API huỷ buổi thiếu lý do không trả 400");
  await hop.getByRole("textbox", { name: /Lý do/ }).fill("GV ốm (kiểm thử)");
  await hop.getByRole("button", { name: "Huỷ buổi", exact: true }).click();
  const tb = page.getByRole("status").filter({ hasText: "Đã huỷ buổi Toán 28/11" });
  await tb.waitFor();
  bang((await bangBuoi(api))("toan", "2026-11-28").trang_thai, "huy", "Máy chủ chưa huỷ buổi");
  await tb.getByRole("button", { name: "Hoàn tác" }).click();
  await page.getByRole("status").filter({ hasText: "Đã đổi về Có học" }).waitFor();
  bang((await bangBuoi(api))("toan", "2026-11-28").trang_thai, "binh_thuong", "Hoàn tác không trả buổi về Có học");
  // Kiểm nhận 7: bấm hàng đổi ?buoi= bằng replace — lịch sử trình duyệt không dài thêm
  const dai = await page.evaluate(() => history.length);
  const b2 = (await bangBuoi(api))("su", "2026-11-25");
  await page.locator(`a[href$="buoi=${b2.id}"]`).first().click();
  await page.waitForURL(new RegExp(`buoi=${b2.id}`));
  bang(await page.evaluate(() => history.length), dai, "Bấm hàng buổi làm dài lịch sử trình duyệt");
  await t.chup(page, "chu-buoi-hoc-huy-1280");
});

test(N, "Hộp thoại huỷ buổi: tiêu điểm đầu ở nút 'Giữ buổi' (man-buoi-hoc §14.4) (1280)", async (t) => {
  const { page } = await t.trang("chu", W.mt);
  const b = (await bangBuoi(await t.api("chu")))("toan", "2026-11-28");
  await moTrang(page, `/quan-ly/buoi-hoc?thang=2026-11&buoi=${b.id}`);
  await page.getByRole("button", { name: "Huỷ buổi…" }).click();
  await page.getByRole("dialog").getByRole("heading", { name: /Huỷ buổi Toán/ }).waitFor();
  await page.waitForTimeout(300);
  const tieuDiem = await page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName);
  bang(tieuDiem, "Giữ buổi", "Tiêu điểm đầu của hộp thoại huỷ không ở nút Giữ buổi");
});

await chay(N);
