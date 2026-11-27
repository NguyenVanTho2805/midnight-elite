// Nhóm GV TOÁN — Hôm nay lọc theo môn, điểm danh buổi (Có/Phép/Vắng, đánh tất cả + Hoàn tác, mất mạng), ma trận phím 1/2/3, vượt quyền.
import { test, chay, ok, bang, W, moTrang, khongTranNgang, doi, ngu, bangBuoi, fetchTrongTrang, moSuaNeuCan } from "./lib.mjs";

const N = "GV Toán";
const nhom = (page) => page.locator('tbody [role="group"][aria-label^="Điểm danh "]');
const nut = (page, i, ten) => nhom(page).nth(i).getByRole("button", { name: ten, exact: true });
const tenEm = async (page, i) => (await nhom(page).nth(i).getAttribute("aria-label")).replace(/^Điểm danh /, "");
/** Trạng thái điểm danh trên máy chủ: { "Họ tên": "co" | "phep" | "vang" | null } */
const mayChu = async (api, id) => {
  const r = await api.get(`/api/diem-danh/${id}`);
  ok(r.status === 200, `GET /api/diem-danh/${id} lỗi ${r.status}`);
  return Object.fromEntries(r.json.em.map((e) => [e.ho_ten, e.trang_thai]));
};

for (const kich of [W.dt, W.mt]) {
  test(N, `Hôm nay: không có khối thử sắp hết / đơn / học phí, chỉ môn Toán (${kich.width})`, async (t) => {
    const { page } = await t.trang("gv_toan", kich);
    await moTrang(page, "/quan-ly");
    const viec = page.getByRole("region", { name: "Việc cần làm" });
    await viec.waitFor();
    const chu = await page.locator("main").innerText();
    for (const cam of [/Thử sắp hết/, /Hết thử – hỏi em/, /Gia hạn cả nhóm/, /Đơn chờ duyệt/, /Thử hết trong 3 ngày/, /Lên chính thức tháng này/, /học phí/i, /\d{2,3}\.000\s?đ/]) ok(!cam.test(chu), `GV Toán thấy "${cam.source}" ở Hôm nay`);
    ok(!(await viec.getByRole("tab", { name: /^(Đơn|Học thử)\s*\d+$/ }).count()), "GV thấy tab Đơn / Học thử");
    const siSo = await page.locator("h3", { hasText: "Sĩ số theo môn" }).locator("xpath=following-sibling::ul[1]").locator("li span.font-semibold").allInnerTexts();
    bang(JSON.stringify(siSo), JSON.stringify(["Toán"]), "Sĩ số theo môn của GV Toán");
    const lich = await page.getByRole("region", { name: "7 ngày tới" }).locator("a").allInnerTexts();
    ok(lich.length > 0 && lich.every((x) => x.startsWith("Toán")), `Lịch 7 ngày có môn khác Toán: ${lich}`);
    await khongTranNgang(page, "Hôm nay GV Toán");
    await t.chup(page, `gv-toan-hom-nay-${kich.width}`);
  });
}

test(N, "Ma trận tháng 11 (1280): cột buổi gần nhất trong tầm nhìn, ký hiệu ✓ P K · –, phím 1/2/3 lưu lên máy chủ", async (t) => {
  const { page } = await t.trang("gv_toan", W.mt);
  const api = await t.api("chu");
  const b = (await bangBuoi(api))("toan", "2026-11-24");
  await moTrang(page, "/quan-ly/diem-danh/thang?mon=toan&thang=2026-11");
  const khung = page.locator('div:has(> table[role="grid"])');
  await khung.waitFor();
  ok(!(await page.getByRole("list", { name: "Môn" }).count()), "GV một môn mà vẫn có chip chọn môn");
  const kyHieu = await page.locator('table[role="grid"] tbody td').evaluateAll((tds) => tds.map((td) => td.innerText.trim()).filter((x) => x && !/\//.test(x) && !/^\d+$/.test(x)));
  ok(kyHieu.every((x) => ["✓", "P", "K", "·", "–"].includes(x)), `Ký hiệu lạ trong ma trận: ${[...new Set(kyHieu)].filter((x) => !["✓", "P", "K", "·", "–"].includes(x))}`);
  // Cột 24/11 (buổi Toán gần nhất đã qua) nằm trong khung cuộn
  const cot = page.locator('th a[aria-label*="24/11"]');
  const [kb, cb] = [await khung.boundingBox(), await cot.boundingBox()];
  ok(cb && cb.x >= kb.x && cb.x + cb.width <= kb.x + kb.width, "Cột 24/11 không nằm trong tầm nhìn khi mở ma trận");
  // 3 ô "chưa điểm" của cột 24/11 → phím 1, 2, 3
  const o = page.locator('td button[aria-label*="24/11: chưa điểm"]');
  ok((await o.count()) >= 3, "Cột 24/11 không đủ 3 ô chưa điểm");
  const ten = [];
  for (let i = 0; i < 3; i++) {
    const x = (await o.nth(0).getAttribute("aria-label")).split(",")[0];
    ten.push(x);
    const cell = page.locator(`td button[aria-label^="${x}, "][aria-label*="24/11"]`);
    await cell.click();
    const hop = page.getByRole("dialog");
    await hop.waitFor();
    const mo = hop.getByRole("button", { name: /^Mở sửa buổi/ });
    if (await mo.isVisible().catch(() => false)) await mo.click(); // quá 48 giờ: mở sửa cả cột một lần
    await page.keyboard.press("Escape");
    await hop.waitFor({ state: "hidden" });
    await cell.focus();
    await page.keyboard.press(String(i + 1));
    await doi(async () => /: (có mặt|vắng có phép|vắng không phép)/.test(await cell.getAttribute("aria-label")), 3000, `Phím ${i + 1} không đổi ô của ${x}`);
  }
  const can = ["co", "phep", "vang"];
  await doi(async () => { const m = await mayChu(api, b.id); return ten.every((x, i) => m[x] === can[i]); }, 8000, "Máy chủ chưa nhận đủ 3 ô 1/2/3 từ ma trận");
  await t.chup(page, "gv-toan-ma-tran-1280");
});

test(N, "Điểm danh buổi (390): Có/Phép/Vắng lưu ngay, đánh tất cả giữ Phép/Vắng, Hoàn tác 5 giây, mất mạng → N chưa gửi → có mạng lên máy chủ", async (t) => {
  const { ctx, page } = await t.trang("gv_toan", W.dt);
  const api = await t.api("chu");
  const b = (await bangBuoi(api))("toan", "2026-11-24");
  await moTrang(page, `/quan-ly/diem-danh/${b.id}`);
  await moSuaNeuCan(page);
  const so = await nhom(page).count();
  ok(so >= 8, `Buổi Toán 24/11 chỉ có ${so} em`);
  // Bỏ qua các em đã có trạng thái (ma trận có thể đã điểm vài em) — lấy 8 em đầu còn chưa điểm
  const chua = [];
  for (let i = 0; i < so && chua.length < 8; i++) if (!(await nhom(page).nth(i).locator('[aria-pressed="true"]').count())) chua.push(i);
  ok(chua.length === 8, "Không đủ 8 em chưa điểm");
  const [a, p, v, x1, x2, x3] = chua;
  const tA = await tenEm(page, a), tP = await tenEm(page, p), tV = await tenEm(page, v);
  await nut(page, a, "Có").click();
  await nut(page, p, "Phép").click();
  await nut(page, v, "Vắng").click();
  for (const [i, n] of [[a, "Có"], [p, "Phép"], [v, "Vắng"]]) bang(await nut(page, i, n).getAttribute("aria-pressed"), "true", `Nút ${n} không được chọn`);
  await page.locator("header span.flex", { hasText: /^Đã lưu \d\d:\d\d$/ }).waitFor();
  let m = await mayChu(api, b.id);
  ok(m[tA] === "co" && m[tP] === "phep" && m[tV] === "vang", `Máy chủ chưa lưu Có/Phép/Vắng: ${m[tA]} ${m[tP]} ${m[tV]}`);

  // Mất mạng: chạm 3 em → "3 chưa gửi", 3 chấm Chưa gửi, máy chủ chưa có; có mạng lại → lên máy chủ
  const tX = [await tenEm(page, x1), await tenEm(page, x2), await tenEm(page, x3)];
  await ctx.setOffline(true);
  for (const i of [x1, x2, x3]) await nut(page, i, "Có").click();
  await page.locator("header").getByText(/^3( thay đổi)? chưa gửi$/).waitFor();
  bang(await page.getByRole("img", { name: "Chưa gửi" }).count(), 3, "Số chấm Chưa gửi");
  ok(await page.getByText(/Mất mạng/).first().isVisible(), "Không có dải mất mạng");
  m = await mayChu(api, b.id);
  ok(tX.every((x) => m[x] === null), "Đang mất mạng mà máy chủ đã có thay đổi");
  t.choPhepConsole(/ERR_INTERNET_DISCONNECTED|Failed to fetch/);
  await ctx.setOffline(false);
  await page.locator("header span.flex", { hasText: /^Đã lưu \d\d:\d\d$/ }).waitFor({ timeout: 20_000 });
  m = await mayChu(api, b.id);
  ok(tX.every((x) => m[x] === "co"), `Có mạng lại mà máy chủ chưa nhận 3 em: ${tX.map((x) => m[x])}`);
  bang(await page.getByRole("img", { name: "Chưa gửi" }).count(), 0, "Còn chấm Chưa gửi sau khi gửi xong");

  // Đánh tất cả có mặt → không đổi Phép/Vắng → Hoàn tác trong 5 giây trả đúng các em đó về chưa điểm
  const conChua = (await mayChu(api, b.id));
  const soChua = Object.values(conChua).filter((x) => x === null).length;
  const nutTatCa = page.getByRole("button", { name: `Đánh tất cả có mặt (${soChua})` });
  await nutTatCa.click();
  const tb = page.getByRole("status").filter({ hasText: `Đã đánh ${soChua} em có mặt` });
  await tb.waitFor();
  bang(await nut(page, p, "Phép").getAttribute("aria-pressed"), "true", "Đánh tất cả làm mất Phép");
  bang(await nut(page, v, "Vắng").getAttribute("aria-pressed"), "true", "Đánh tất cả làm mất Vắng");
  await doi(async () => Object.values(await mayChu(api, b.id)).every((x) => x !== null), 8000, "Máy chủ chưa nhận đánh tất cả");
  await tb.getByRole("button", { name: "Hoàn tác" }).click();
  await page.getByRole("status").filter({ hasText: `Đã hoàn tác, ${soChua} em về chưa điểm` }).waitFor();
  await doi(async () => { const k = await mayChu(api, b.id); return Object.keys(conChua).every((x) => k[x] === conChua[x]); }, 8000, "Hoàn tác không trả máy chủ về đúng trạng thái trước khi đánh tất cả");

  // Đánh tất cả lần 2, không bấm Hoàn tác: sau 5 giây nút Hoàn tác biến mất, dữ liệu giữ
  await page.mouse.move(5, 5); // con trỏ không nằm trên thanh (rê chuột lên thanh sẽ dừng đếm)
  await page.getByRole("button", { name: `Đánh tất cả có mặt (${soChua})` }).click();
  const tb2 = page.getByRole("status").filter({ hasText: `Đã đánh ${soChua} em có mặt` });
  await tb2.waitFor();
  await ngu(6000);
  bang(await tb2.count(), 0, "Quá 5 giây mà thanh Hoàn tác còn");
  await page.getByRole("link", { name: new RegExp(`Đã điểm đủ ${so}/${so} · Xong`) }).waitFor();
  await doi(async () => Object.values(await mayChu(api, b.id)).every((x) => x !== null), 8000, "Sau 5 giây dữ liệu đánh tất cả không còn trên máy chủ");
  await t.chup(page, "gv-toan-diem-danh-390");
});

test(N, "Vùng bấm Có/Phép/Vắng ≥ 48px cao ở 390 (≥ 44px ở 1280), cách nhau ≥ 8px", async (t) => {
  const b = (await bangBuoi(await t.api("chu")))("toan", "2026-11-28");
  for (const [kich, toiThieu] of [[W.dt, 48], [W.mt, 44]]) {
    const { page } = await t.trang("gv_toan", kich);
    await moTrang(page, `/quan-ly/diem-danh/${b.id}`);
    const hop = await nhom(page).first().getByRole("button").evaluateAll((bs) => bs.map((x) => x.getBoundingClientRect()).map((r) => ({ x: r.x, w: r.width, h: r.height })));
    bang(hop.length, 3, "Số nút điểm danh một hàng");
    ok(hop.every((r) => r.h >= toiThieu && r.w >= 44), `Nút điểm danh nhỏ hơn ${toiThieu}px ở ${kich.width}: ${JSON.stringify(hop)}`);
    ok(hop[1].x - (hop[0].x + hop[0].w) >= 8 - 0.5 && hop[2].x - (hop[1].x + hop[1].w) >= 8 - 0.5, `Khoảng cách nút < 8px ở ${kich.width}`);
    await khongTranNgang(page, `Điểm danh ${kich.width}`);
  }
});

test(N, "Vượt quyền: buổi Anh / em chỉ học Anh / ma trận Anh / đơn → màn chặn; API chỉ chủ → 403, không ghi gì", async (t) => {
  const { page } = await t.trang("gv_toan", W.dt);
  const api = await t.api("chu");
  const tra = await bangBuoi(api);
  const anh = tra("anh", "2026-11-23"), toan28 = tra("toan", "2026-11-28");
  const chan = async (url, tieuDe) => {
    await moTrang(page, url);
    const h = await page.locator("main h1").first().innerText();
    ok(tieuDe.test(h), `${url}: cần màn chặn ${tieuDe}, đang "${h}"`);
  };
  await chan(`/quan-ly/diem-danh/${anh.id}`, /^(Không có quyền|Không tìm thấy)$/);
  ok(!(await page.getByRole("button", { name: /Đánh tất cả/ }).count()), "Màn chặn mà vẫn có nút Đánh tất cả");
  const tenAnh = (await mayChu(api, anh.id));
  const chuMan = await page.locator("main").innerText();
  ok(!Object.keys(tenAnh).some((x) => chuMan.includes(x)), "Màn chặn lộ tên học sinh buổi Anh");
  await chan("/quan-ly/hoc-sinh/HS0022", /^(Không có quyền|Không tìm thấy)$/); // HS0022 chỉ học Anh — máy chủ cố ý trả 404 (server/hoc-sinh.ts:50)
  ok(!(await page.locator("main").innerText()).includes((await api.get("/api/hoc-sinh/HS0022")).json.hoc_sinh.ho_ten), "Màn chặn lộ tên em HS0022");
  await chan("/quan-ly/diem-danh/thang?mon=anh&thang=2026-11", /^Không có quyền$/);
  await chan("/quan-ly/don", /^Không có quyền$/);
  // API bằng fetch ngay trong trang (cookie GV Toán)
  t.choPhepConsole(/status of 40[34]/);
  const ca = [
    ["POST", "/api/gia-han", { maHs: ["HS0021"], soNgay: 7, lyDo: "vượt quyền" }, 403],
    ["POST", "/api/hoc-sinh/HS0021/chuyen-chinh-thuc", { mon: ["toan"] }, 403],
    ["POST", `/api/buoi-hoc/${toan28.id}/huy`, { lyDo: "vượt quyền", xacNhan: true }, 403],
    ["GET", "/api/don", undefined, 403],
    ["GET", `/api/diem-danh/${anh.id}`, undefined, 403],
    ["PUT", `/api/diem-danh/${anh.id}`, { hocSinhId: (await api.get(`/api/diem-danh/${anh.id}`)).json.em[0].hoc_sinh_id, trangThai: "vang" }, 403],
    ["POST", `/api/diem-danh/${anh.id}/tat-ca`, {}, 403],
    ["GET", "/api/hoc-sinh/HS0022", undefined, 404],
  ];
  const sai = [];
  for (const [m, u, body, can] of ca) { const s = await fetchTrongTrang(page, m, u, body); if (s !== can) sai.push(`${m} ${u} → ${s} (cần ${can})`); }
  ok(!sai.length, `API không chặn đúng: ${sai.join("; ")}`);
  const sau = await api.get("/api/hoc-sinh/HS0021");
  bang(sau.json.thu.den, "2026-11-28", "GV gọi gia hạn mà hạn thử đã đổi");
  bang((await bangBuoi(api))("toan", "2026-11-28").trang_thai, "binh_thuong", "GV gọi huỷ mà buổi đã bị huỷ");
  const ddAnh = await api.get(`/api/diem-danh/${anh.id}`);
  ok(ddAnh.json.em.every((e) => e.trang_thai === null), "GV Toán ghi được điểm danh buổi Anh");
  // Học sinh môn mình: không có nút gia hạn / chuyển chính thức / ô chọn trong DOM
  await moTrang(page, "/quan-ly/hoc-sinh/HS0021");
  bang(await page.getByRole("button", { name: /Gia hạn|Chuyển chính thức|Ẩn hồ sơ/ }).count(), 0, "GV thấy nút gia hạn / chuyển chính thức / ẩn hồ sơ");
  await moTrang(page, "/quan-ly/hoc-sinh");
  bang(await page.locator('input[type="checkbox"]').count() + (await page.getByRole("button", { name: "Chọn", exact: true }).count()), 0, "GV có ô chọn / nút Chọn ở danh sách học sinh");
  await t.chup(page, "gv-toan-hoc-sinh-390");
});

await chay(N);
