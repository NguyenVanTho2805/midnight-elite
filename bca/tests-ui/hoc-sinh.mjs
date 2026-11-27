// Nhóm KHU HỌC SINH (Đợt 2, man-khu-hoc-sinh.md): 3 vai thử trên điện thoại 390 (+ 1280 cho em chính thức).
// Không mã máy, không "hỏi em", không "chưa điểm"; em thử thấy tiến độ 14 ngày; em hết hạn thấy màn khoá + liên hệ gia hạn.
import { test, chay, ok, bang, W, moTrang, khongTranNgang } from "./lib.mjs";

const N = "Khu học sinh";
const MA_MAY = /\b(thu|nghi|co|vang|phep|chinh_thuc|binh_thuong|hoc_bu|huy|dang_thu|het_thu|dang_hoc)\b/;

async function kiemChung(t, page, ten) {
  await moTrang(page, "/hoc");
  bang(new URL(page.url()).pathname, "/hoc", "Học sinh không ở /hoc");
  await page.getByRole("heading", { level: 1 }).waitFor();
  const chu = await page.locator("main").innerText();
  ok(!MA_MAY.test(chu), `Lộ mã máy: "${chu.match(MA_MAY)?.[0]}"`);
  ok(!/hỏi em|chưa điểm/i.test(chu), "Hiện câu dành cho chủ hoặc 'chưa điểm'");
  ok(!/@|0\d{9}|\d{1,3}\.\d{3}đ/.test(chu), "Lộ Gmail / SĐT / tiền");
  await khongTranNgang(page, `/hoc ${ten}`);
  const nhoNhat = await page.evaluate(() => Math.min(...[...document.querySelectorAll("main a, main button, main summary")].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height)));
  ok(nhoNhat >= 44, `Có vùng bấm thấp hơn 44px (${nhoNhat})`);
  return chu;
}

test(N, "Em thử còn hạn (390): câu tối nay, khối Học thử ngày N/14 + thanh tiến độ, chuỗi đi học, môn có chữ có dấu", async (t) => {
  const { page } = await t.trang("hs_thu", W.dt);
  const chu = await kiemChung(t, page, "hs_thu");
  ok(/Tối nay (học|lớp|em không có lớp)/.test(chu), "Thiếu câu Tối nay");
  await page.getByRole("heading", { name: /Học thử ngày \d+\/14/ }).waitFor();
  await page.getByRole("progressbar", { name: "Tiến độ học thử" }).waitFor();
  ok(/buổi đi học liên tiếp|Chuỗi đi học/.test(chu), "Thiếu chuỗi đi học");
  ok(/Học thử/.test(chu) && /Môn của em/.test(chu), "Thiếu mục Môn của em");
  await t.chup(page, "hoc-sinh-thu-390");
});

test(N, "Em hết hạn thử (390): màn khoá 'Thời gian học thử đã hết' + liên hệ gia hạn; tài liệu đã khoá; không có khối học thử", async (t) => {
  const { page } = await t.trang("hs_het_han", W.dt);
  const chu = await kiemChung(t, page, "hs_het_han");
  await page.getByRole("heading", { name: /Thời gian học thử đã hết từ \d\d\/\d\d/ }).waitFor();
  ok(/Liên hệ gia hạn|Nhắn chủ lớp qua Zalo để gia hạn/.test(chu), "Thiếu liên hệ gia hạn");
  ok(/Em vẫn xem được điểm danh/.test(chu), "Thiếu câu T16");
  bang(await page.getByRole("progressbar").count(), 0, "Em hết hạn vẫn thấy thanh học thử");
  ok(!/Xem record/.test(chu), "Em hết hạn vẫn thấy link record");
  await t.chup(page, "hoc-sinh-het-han-390");
});

for (const kich of [W.dt, W.mt]) {
  test(N, `Em chính thức (${kich.width}): không khối học thử, không màn khoá; buổi đã học có chữ Có mặt / Có phép / Vắng / — `, async (t) => {
    const { page } = await t.trang("hs_chinh_thuc", kich);
    const chu = await kiemChung(t, page, "hs_chinh_thuc");
    bang(await page.getByRole("progressbar").count(), 0, "Em chính thức thấy thanh học thử");
    ok(!/Liên hệ gia hạn/.test(chu), "Em chính thức thấy màn khoá");
    ok(/Chính thức/.test(chu), "Thiếu chip Chính thức");
    if (kich.width > 600) {
      const w = await page.locator("main").evaluate((e) => e.getBoundingClientRect().width);
      ok(w <= 560, `Cột nội dung rộng quá 560px (${w})`);
    }
    await t.chup(page, `hoc-sinh-chinh-thuc-${kich.width}`);
  });
}

test(N, "Học sinh không mở được dữ liệu em khác / khu quản lý", async (t) => {
  const api = await t.api("hs_thu");
  const toi = (await api.get("/api/hs/toi")).json;
  ok(toi?.hoc_sinh?.ma_hs, "Không đọc được /api/hs/toi");
  bang((await api.get("/api/hoc-sinh/HS0001")).status, 403, "Học sinh đọc hồ sơ em khác");
  bang((await api.get("/api/nguoi-dung")).status, 403, "Học sinh đọc danh sách tài khoản");
});

await chay(N);
