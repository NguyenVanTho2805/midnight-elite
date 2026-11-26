// Nhóm GV ANH — chỉ thấy môn Anh; không thấy SĐT / Gmail học sinh ở bất kỳ màn nào (DOM + dữ liệu RSC + phản hồi mạng); vượt quyền sang Toán.
import { test, chay, ok, bang, W, moTrang, khongTranNgang, doi, bangBuoi, fetchTrongTrang, moSuaNeuCan } from "./lib.mjs";

const N = "GV Anh";
// SĐT HS giả 0910000xxx, SĐT PH giả 0820000xxx, Gmail giả hs…@example.com / @gamil.com; "tel:" = liên kết gọi.
const LO = /@(example|gamil)\.com|09100000\d\d|08200000\d\d|0910\s?000\s?0\d\d|tel:|hs\d+@/;

/** Buổi Anh ghi được: tối nay nếu đã mở điểm danh, không thì Anh 23/11 (quá 48 giờ → Mở sửa). */
async function buoiAnh(api, tra) {
  for (const ngay of ["2026-11-26", "2026-11-23"]) {
    const b = tra("anh", ngay);
    const d = await api.get(`/api/diem-danh/${b.id}`);
    if (["mo", "qua_48h"].includes(d.json?.trang_thai_ghi)) return b;
  }
  throw new Error("Không có buổi Anh nào ghi được");
}

for (const kich of [W.dt, W.mt]) {
  test(N, `Hôm nay chỉ môn Anh, không khối thử sắp hết (${kich.width})`, async (t) => {
    const { page } = await t.trang("gv_anh", kich);
    await moTrang(page, "/quan-ly");
    await page.getByRole("region", { name: "Việc cần làm" }).waitFor();
    const chu = await page.locator("main").innerText();
    for (const cam of [/Thử sắp hết/, /Hết thử – hỏi em/, /Đơn chờ duyệt/, /Toán|Lịch sử|Địa lí/]) ok(!cam.test(chu), `GV Anh thấy "${cam.source}" ở Hôm nay`);
    const siSo = await page.locator("h3", { hasText: "Sĩ số theo môn" }).locator("xpath=following-sibling::ul[1]").locator("li span.font-semibold").allInnerTexts();
    bang(JSON.stringify(siSo), JSON.stringify(["Anh"]), "Sĩ số theo môn của GV Anh");
    await khongTranNgang(page, "Hôm nay GV Anh");
    await t.chup(page, `gv-anh-hom-nay-${kich.width}`);
  });
}

test(N, "Danh sách học sinh (1280): chỉ em có ghi danh Anh, mỗi dòng chỉ chip Anh, không cột SĐT", async (t) => {
  const { page } = await t.trang("gv_anh", W.mt);
  const api = await t.api("chu");
  const can = (await api.get("/api/hoc-sinh")).json.hoc_sinh.filter((x) => x.mon?.anh).length;
  await moTrang(page, "/quan-ly/hoc-sinh");
  bang(await page.locator("p[aria-live=polite] span.so", { hasText: / em$/ }).innerText(), `${can} em`, "Số em GV Anh thấy khác số em có ghi danh Anh");
  const mon = await page.locator("table tbody tr td:nth-child(2)").allInnerTexts();
  ok(mon.every((x) => x.trim() === "Anh" || /^Anh\b/.test(x.trim())) && !mon.some((x) => /Toán|Sử|Địa/.test(x)), "Có chip môn khác Anh trong danh sách GV Anh");
  ok(!(await page.getByRole("columnheader", { name: /SĐT/ }).count()), "GV thấy cột SĐT");
  await t.chup(page, "gv-anh-hoc-sinh-1280");
});

test(N, "Không lộ SĐT / Gmail học sinh ở 6 màn (DOM + RSC + phản hồi mạng), đối chứng: chủ lớp thấy", async (t) => {
  const api = await t.api("chu");
  const tra = await bangBuoi(api);
  const b = await buoiAnh(api, tra);
  const man = ["/quan-ly", "/quan-ly/hoc-sinh", "/quan-ly/hoc-sinh/HS0022", `/quan-ly/buoi-hoc?thang=2026-11&buoi=${b.id}`, `/quan-ly/diem-danh/${b.id}`, "/quan-ly/diem-danh/thang?mon=anh&thang=2026-11"];
  for (const kich of [W.dt, W.mt]) {
    const { page } = await t.trang("gv_anh", kich);
    const lo = [];
    page.on("response", async (r) => {
      const ty = r.headers()["content-type"] ?? "";
      if (!/json|html|text\/x-component|javascript/.test(ty) || /\/_next\/static\//.test(r.url())) return;
      const s = await r.text().catch(() => "");
      const m = s.match(LO);
      if (m) lo.push(`${r.url()} chứa "${m[0]}"`);
    });
    for (const u of man) {
      await moTrang(page, u);
      const html = await page.content();
      const m = html.match(LO);
      ok(!m, `${u} (${kich.width}) lộ "${m?.[0]}" trong DOM/RSC`);
      ok(!(await page.locator('a[href^="tel:"], a[href^="mailto:"]').count()), `${u} có liên kết tel:/mailto:`);
    }
    // Mở tờ chi tiết một em trong màn điểm danh (điện thoại) — có nút "Xem hồ sơ em", không có liên hệ
    await moTrang(page, `/quan-ly/diem-danh/${b.id}`);
    await page.locator('tbody button:has(span[translate="no"])').first().click();
    await page.getByRole("dialog").waitFor();
    ok(!(await page.content()).match(LO), "Tờ chi tiết em ở màn điểm danh lộ SĐT/Gmail");
    ok(!lo.length, `Phản hồi mạng lộ dữ liệu: ${lo.slice(0, 3).join("; ")}`);
  }
  // Đối chứng: cùng mẫu tìm, chủ lớp PHẢI thấy (bảo đảm mẫu LO không rỗng nghĩa)
  const { page: pc } = await t.trang("chu", W.mt);
  await moTrang(pc, "/quan-ly/hoc-sinh/HS0022");
  ok(LO.test(await pc.content()), "Đối chứng hỏng: chủ lớp không thấy SĐT/Gmail ở trang một em");
});

test(N, "Điểm danh buổi Anh (390): bấm Phép lưu ngay lên máy chủ, 'Đã lưu'", async (t) => {
  const { page } = await t.trang("gv_anh", W.dt);
  const api = await t.api("chu");
  const b = await buoiAnh(api, await bangBuoi(api));
  await moTrang(page, `/quan-ly/diem-danh/${b.id}`);
  await moSuaNeuCan(page);
  const g = page.locator('tbody [role="group"][aria-label^="Điểm danh "]');
  let i = 0;
  while ((await g.nth(i).locator('[aria-pressed="true"]').count())) i++;
  const ten = (await g.nth(i).getAttribute("aria-label")).replace(/^Điểm danh /, "");
  await g.nth(i).getByRole("button", { name: "Phép", exact: true }).click();
  await page.locator("header span.flex", { hasText: /^Đã lưu \d\d:\d\d$/ }).waitFor();
  await doi(async () => (await api.get(`/api/diem-danh/${b.id}`)).json.em.find((e) => e.ho_ten === ten)?.trang_thai === "phep", 5000, "Máy chủ chưa nhận Phép");
  await t.chup(page, "gv-anh-diem-danh-390");
});

test(N, "Vượt quyền: buổi Toán / em chỉ học Toán+Sử / ma trận Toán → màn chặn; API → 403/404", async (t) => {
  const { page } = await t.trang("gv_anh", W.mt);
  const api = await t.api("chu");
  const toan = (await bangBuoi(api))("toan", "2026-11-24");
  for (const [u, re] of [[`/quan-ly/diem-danh/${toan.id}`, /^Không có quyền$/], ["/quan-ly/hoc-sinh/HS0021", /^(Không có quyền|Không tìm thấy)$/], ["/quan-ly/diem-danh/thang?mon=toan&thang=2026-11", /^Không có quyền$/]]) {
    await moTrang(page, u);
    const h = await page.locator("main h1").first().innerText();
    ok(re.test(h), `${u}: cần màn chặn, đang "${h}"`);
  }
  t.choPhepConsole(/status of 40[34]/);
  const em = (await api.get(`/api/diem-danh/${toan.id}`)).json.em[0];
  const ca = [
    ["GET", `/api/diem-danh/${toan.id}`, undefined, 403],
    ["PUT", `/api/diem-danh/${toan.id}`, { hocSinhId: em.hoc_sinh_id, trangThai: "vang" }, 403],
    ["PATCH", `/api/buoi-hoc/${toan.id}`, { linkRecord: "https://drive.google.com/vuot-quyen" }, 403],
    ["POST", "/api/gia-han", { maHs: ["HS0022"], soNgay: 3, lyDo: "vượt quyền" }, 403],
    ["GET", "/api/hoc-sinh/HS0021", undefined, 404],
  ];
  const sai = [];
  for (const [m, u, body, can] of ca) { const s = await fetchTrongTrang(page, m, u, body); if (s !== can) sai.push(`${m} ${u} → ${s} (cần ${can})`); }
  ok(!sai.length, `API không chặn đúng: ${sai.join("; ")}`);
  bang((await api.get(`/api/diem-danh/${toan.id}`)).json.em.find((e) => e.hoc_sinh_id === em.hoc_sinh_id).trang_thai, em.trang_thai, "GV Anh ghi được điểm danh buổi Toán");
});

await chay(N);
