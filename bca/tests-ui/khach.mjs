// Nhóm KHÁCH chưa đăng nhập (+ học sinh chạm khu quản lý): trang → chuyển đăng nhập; API → 401 / 403; học sinh không xem được buổi của lớp khác / khi hết hạn.
import { test, chay, ok, bang, W, BASE, moTrang, bangBuoi } from "./lib.mjs";

const N = "Khách";
const MAN = ["/quan-ly", "/quan-ly/hoc-sinh", "/quan-ly/hoc-sinh/HS0021", "/quan-ly/buoi-hoc", "/quan-ly/diem-danh", "/quan-ly/diem-danh/9", "/quan-ly/diem-danh/thang?mon=toan"];

for (const kich of [W.dt, W.mt]) {
  test(N, `5 màn quản lý → chuyển /dang-nhap, không lộ dữ liệu (${kich.width})`, async (t) => {
    const { page } = await t.trang(null, kich);
    for (const u of MAN) {
      await moTrang(page, u);
      ok(new URL(page.url()).pathname === "/dang-nhap", `${u} không chuyển về /dang-nhap (đang ${page.url()})`);
      ok(!/Nguyễn Minh Linh|HS00\d\d/.test(await page.content()), `${u} lộ dữ liệu học sinh trước khi chuyển`);
    }
    await page.getByRole("button", { name: "Chủ lớp" }).waitFor();
    await t.chup(page, `khach-dang-nhap-${kich.width}`);
  });
}

test(N, "API khu quản lý không cookie / cookie giả → 401, không ghi gì", async (t) => {
  const api = await t.api(null);
  const chu = await t.api("chu");
  const ca = [
    ["GET", "/api/hom-nay"], ["GET", "/api/hoc-sinh"], ["GET", "/api/hoc-sinh/HS0021"], ["GET", "/api/buoi-hoc?thang=2026-11"],
    ["GET", "/api/diem-danh/9"], ["GET", "/api/diem-danh/thang?mon=toan&thang=2026-11"], ["GET", "/api/don"], ["GET", "/api/nhat-ky"],
    ["POST", "/api/gia-han", { maHs: ["HS0021"], soNgay: 7, lyDo: "khách" }], ["PUT", "/api/diem-danh/9", { hocSinhId: 1, trangThai: "vang" }],
    ["POST", "/api/diem-danh/9/tat-ca", {}], ["POST", "/api/buoi-hoc/13/huy", { lyDo: "khách", xacNhan: true }], ["PATCH", "/api/buoi-hoc/9", { linkRecord: "https://x.invalid" }],
  ];
  const sai = [];
  for (const [m, u, d] of ca) { const r = await api.gui(m, u, d); if (r.status !== 401) sai.push(`${m} ${u} → ${r.status}`); }
  ok(!sai.length, `Không trả 401: ${sai.join("; ")}`);
  // Cookie giả mạo (chữ ký sai) cũng 401
  const p = await t.trang(null, W.dt);
  await p.ctx.addCookies([{ name: "bca_phien", value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwidmFpIjoibmQifQ.sai-chu-ky", url: BASE }]);
  const r = await p.ctx.request.get("/api/hom-nay");
  bang(r.status(), 401, "Cookie giả mạo không bị 401");
  bang((await chu.get("/api/hoc-sinh/HS0021")).json.thu.den, "2026-11-28", "Khách gọi gia hạn mà hạn đã đổi");
  bang((await bangBuoi(chu))("toan", "2026-11-28").trang_thai, "binh_thuong", "Khách gọi huỷ mà buổi đã huỷ");
});

test(N, "Học sinh (thử còn hạn) vào /quan-ly → chuyển /hoc; API quản lý → 403", async (t) => {
  const { page } = await t.trang("hs_thu", W.dt);
  await moTrang(page, "/quan-ly");
  bang(new URL(page.url()).pathname, "/hoc", "Học sinh vào /quan-ly không bị chuyển về /hoc");
  const api = await t.api("hs_thu");
  const sai = [];
  for (const [m, u, d] of [["GET", "/api/hom-nay"], ["GET", "/api/hoc-sinh"], ["GET", "/api/hoc-sinh/HS0022"], ["GET", "/api/diem-danh/9"], ["POST", "/api/gia-han", { maHs: ["HS0021"], soNgay: 14, lyDo: "tự gia hạn" }]]) {
    const r = await api.gui(m, u, d);
    if (r.status !== 403) sai.push(`${m} ${u} → ${r.status}`);
  }
  ok(!sai.length, `Học sinh gọi API quản lý không bị 403: ${sai.join("; ")}`);
});

test(N, "Học sinh xem buổi lớp khác / em hết hạn thử mở tài liệu buổi → bị chặn ở máy chủ", async (t) => {
  const chu = await t.api("chu");
  const tra = await bangBuoi(chu);
  const thu = await t.api("hs_thu"); // HS0021: thử Toán + Sử
  const toi = (await thu.get("/api/hs/toi")).json;
  ok(toi?.hoc_sinh?.ma_hs, "Không đọc được /api/hs/toi của học sinh thử");
  const toan = tra("toan", "2026-11-24"), anh = tra("anh", "2026-11-23");
  const monCuaEm = toi.mon.filter((m) => m.o).map((m) => m.ma);
  const cua = monCuaEm.includes("toan") ? toan : tra("su", "2026-11-25");
  const ok1 = await thu.get(`/api/hs/buoi/${cua.id}`);
  bang(ok1.status, 200, `Học sinh ${toi.hoc_sinh.ma_hs} không xem được buổi môn mình`);
  if (!monCuaEm.includes("anh")) bang((await thu.get(`/api/hs/buoi/${anh.id}`)).status, 403, `Học sinh ${toi.hoc_sinh.ma_hs} (không học Anh) xem được buổi Anh`);
  // Em hết thử (vai hs_het_han = HS0061, thử Toán+Anh 01–14/11). Dữ liệu giả không có buổi trong khoảng thử của em,
  // nên máy chủ chặn ở nhánh "không thuộc lớp" (403), chưa chạm nhánh het_han của server/hs.ts:59.
  const het = await t.api("hs_het_han");
  const r = await het.get(`/api/hs/buoi/${toan.id}`);
  bang(r.status, 403, "Học sinh hết hạn thử mở được buổi (record/tài liệu)");
  ok(!r.json?.link_record, "Phản hồi chặn vẫn kèm link record");
});

await chay(N);
