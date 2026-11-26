// Vòng làm gọn cuối Đợt 1, phần máy chủ (BCA-D1-MC5): T42 xoá buổi + hoàn tác + sinh buổi còn thiếu, T43 xử lý đơn,
// tách homNay, soNguyen chặt, giới hạn nhật ký "từ chối", PATCH buổi rỗng, gia hạn số ngày sai, lọc theo ngày hết thử.
// Dữ liệu giả, "hôm nay" = 26/11/2026 (Thứ Năm, tối có Anh 22:15).
import { beforeAll, describe, expect, it } from "vitest";
import { lucVN, ngayVN, s2d } from "@/lib/ngay";
import type { Nguoi } from "@/lib/quyen";
import { tenGiong } from "@/lib/chuan-hoa";
import { CHU, GV_ANH, cookieHs, cookieNd, db, goi, napSeed, nguoi } from "./chung";
import { soNguyen } from "@/server/api";
import { ghiTuChoi } from "@/server/nhat-ky";
import { hoanTacXoaBuoi, sinhBuoiConThieu, xemTruocBuoiConThieu, xoaBuoi } from "@/server/buoi-hoc";
import { boQuaDon, hoanTacXuLyDon, taoHoSoTuDon, xemTruocDon } from "@/server/don";
import { homNay, lich7Ngay, lopToiNay, theSo, viecCanLam } from "@/server/hom-nay";
import { danhSachHocSinh } from "@/server/hoc-sinh";
import * as buoiIdR from "@/app/api/buoi-hoc/[id]/route";
import * as hoanTacXoaR from "@/app/api/buoi-hoc/[id]/hoan-tac-xoa/route";
import * as conThieuR from "@/app/api/buoi-hoc/con-thieu/route";
import * as taoHoSoR from "@/app/api/don/[id]/tao-ho-so/route";
import * as boQuaR from "@/app/api/don/[id]/bo-qua/route";
import * as donHoanTacR from "@/app/api/don/[id]/hoan-tac/route";
import * as giaHanR from "@/app/api/gia-han/route";
import * as hocSinhR from "@/app/api/hoc-sinh/route";
import * as diemDanh from "@/app/api/diem-danh/[buoiId]/route";

let chu: Nguoi, cChu: string, cGvAnh: string, cHs: string;
const T22 = lucVN("2026-11-26", "22:00");
const giay = (goc: Date, s: number) => new Date(goc.getTime() + s * 1000);
const ma = (e: unknown) => (e as { ma?: string }).ma;
const buoi = async (mon: number, ngay: string, gio = "22:15") => (await db.buoi_hoc.findUniqueOrThrow({ where: { mon_id_bat_dau_luc: { mon_id: mon, bat_dau_luc: lucVN(ngay, gio) } } })).id;
const gdCua = async (maHs: string) =>
  (await db.ghi_danh.findMany({ where: { hoc_sinh: { ma_hs: maHs } }, orderBy: { id: "asc" } })).map((g) => `${g.mon_id}:${g.loai}:${g.tu_ngay.toISOString().slice(0, 10)}→${g.den_ngay?.toISOString().slice(0, 10)}`);
let soYc = 900;
const taoDon = (v: { ngay?: string; loai?: string; ho_ten?: string; gmail?: string; sdt_hs?: string; sdt_ph?: string; mon?: number[] }) =>
  db.don_dang_ky.create({
    data: {
      thoi_gian: lucVN(v.ngay ?? "2026-11-26", "20:00"), nguon: "Web", loai: v.loai ?? "Học thử", ho_ten: v.ho_ten ?? "Người Thử Mới", gmail: v.gmail, sdt_hs: v.sdt_hs, sdt_ph: v.sdt_ph,
      mon_ids: v.mon ?? [1], ma_yeu_cau: `YC${++soYc}`, trang_thai: "cho_duyet", loi_du_lieu: [],
    },
  });

beforeAll(async () => {
  await napSeed();
  chu = await nguoi(CHU);
  [cChu, cGvAnh, cHs] = await Promise.all([cookieNd(CHU), cookieNd(GV_ANH), cookieHs("HS0021")]);
});

describe("Mục 20 / T42 — xoá buổi tương lai, hoàn tác 10 giây, sinh buổi còn thiếu", () => {
  it("buổi tương lai trống → xoá, trả nhatKyId; hoàn tác trong 10 giây dựng lại đúng id + giờ; lần hai 409 da_hoan_tac", async () => {
    const id = await buoi(1, "2026-12-01");
    const r = await xoaBuoi(chu, id, T22);
    expect(r).toMatchObject({ id, da_xoa: true });
    expect(await db.buoi_hoc.findUnique({ where: { id } })).toBeNull();
    expect(await hoanTacXoaBuoi(chu, id, r.nhatKyId, giay(T22, 9))).toEqual({ id, khoi_phuc: true });
    const b = await db.buoi_hoc.findUniqueOrThrow({ where: { id } });
    expect([b.mon_id, b.bat_dau_luc.toISOString(), b.so_phut, b.loai, b.trang_thai]).toEqual([1, lucVN("2026-12-01", "22:15").toISOString(), 90, "theo_lich", "binh_thuong"]);
    await expect(hoanTacXoaBuoi(chu, id, r.nhatKyId, giay(T22, 9))).rejects.toSatisfy((e) => ma(e) === "da_hoan_tac");
  });
  it("hoàn tác quá 10 giây → 409 het_gio, buổi vẫn đã xoá; nhật ký id sai buổi → 404", async () => {
    const id = await buoi(4, "2026-12-03");
    const { nhatKyId } = await xoaBuoi(chu, id, T22);
    await expect(hoanTacXoaBuoi(chu, id, nhatKyId, giay(T22, 11))).rejects.toSatisfy((e) => ma(e) === "het_gio");
    await expect(hoanTacXoaBuoi(chu, id + 1, nhatKyId, giay(T22, 1))).rejects.toSatisfy((e) => (e as { status?: number }).status === 404);
    expect(await db.buoi_hoc.findUnique({ where: { id } })).toBeNull();
  });
  it("buổi đã qua chưa có dữ liệu (Toán 24/11) → 409 da_qua; buổi tối nay sau 22:15 → da_qua, trước 22:15 → xoá được", async () => {
    await expect(xoaBuoi(chu, await buoi(1, "2026-11-24"), T22)).rejects.toSatisfy((e) => ma(e) === "da_qua");
    const anh = await buoi(4, "2026-11-26");
    await expect(xoaBuoi(chu, anh, lucVN("2026-11-26", "22:20"))).rejects.toSatisfy((e) => ma(e) === "da_qua");
    expect(await db.buoi_hoc.findUnique({ where: { id: anh } })).not.toBeNull();
    const { nhatKyId } = await xoaBuoi(chu, anh, T22);
    await hoanTacXoaBuoi(chu, anh, nhatKyId, giay(T22, 2));
  });
  it("route: DELETE buổi 2030 → 200 + nhatKyId; POST hoan-tac-xoa → 200; GV → 403 cả hai", async () => {
    const b = await db.buoi_hoc.create({ data: { mon_id: 4, ngay: s2d("2030-01-07"), bat_dau_luc: lucVN("2030-01-07", "22:15"), so_phut: 90 } });
    const p = { id: String(b.id) };
    expect((await goi(buoiIdR.DELETE, { cookie: cGvAnh, method: "DELETE", params: p })).status).toBe(403);
    const r = await goi(buoiIdR.DELETE, { cookie: cChu, method: "DELETE", params: p });
    expect(r).toMatchObject({ status: 200, json: { da_xoa: true } });
    expect((await goi(hoanTacXoaR.POST, { cookie: cGvAnh, params: p, body: { nhatKyId: r.json.nhatKyId } })).status).toBe(403);
    expect((await goi(hoanTacXoaR.POST, { cookie: cChu, params: p, body: { nhatKyId: r.json.nhatKyId } })).status).toBe(200);
    expect(await db.buoi_hoc.findUnique({ where: { id: b.id } })).not.toBeNull();
    await db.buoi_hoc.delete({ where: { id: b.id } });
  });
  it("sinh buổi còn thiếu: chỉ ngày theo lịch chưa có buổi (huỷ / dời giờ vẫn tính là có), chỉ buổi chưa bắt đầu; lặp lại = 0", async () => {
    const t01 = await buoi(1, "2026-12-01");
    await xoaBuoi(chu, t01, T22); // xoá thật (không hoàn tác) ⇒ thiếu
    await db.buoi_hoc.update({ where: { id: await buoi(4, "2026-12-07") }, data: { bat_dau_luc: lucVN("2026-12-07", "21:00") } }); // dời giờ ⇒ vẫn có
    const truoc = await db.buoi_hoc.count();
    const xem = await xemTruocBuoiConThieu(chu, "2026-12", T22);
    // Anh 03/12 bị xoá ở ca trước + Toán 01/12 vừa xoá; Sử 09/12 đã huỷ không sinh lại
    expect(xem).toMatchObject({ thang: "2026-12", se_tao: 2, bo_qua_da_qua: 0 });
    expect(xem.buoi).toEqual([{ mon: "toan", ngay: "2026-12-01", gio: "22:15" }, { mon: "anh", ngay: "2026-12-03", gio: "22:15" }]);
    expect(await db.buoi_hoc.count()).toBe(truoc); // xem trước không ghi
    expect(await sinhBuoiConThieu(chu, "2026-12", T22)).toMatchObject({ tao_moi: 2 });
    expect(await db.buoi_hoc.count()).toBe(truoc + 2);
    expect(await db.buoi_hoc.findUnique({ where: { mon_id_bat_dau_luc: { mon_id: 4, bat_dau_luc: lucVN("2026-12-07", "22:15") } } })).toBeNull();
    expect((await sinhBuoiConThieu(chu, "2026-12", T22)).tao_moi).toBe(0);
    // Tháng 11: ngày thiếu đã qua không sinh lại
    await db.buoi_hoc.delete({ where: { id: await buoi(1, "2026-11-24") } });
    expect(await xemTruocBuoiConThieu(chu, "2026-11", T22)).toMatchObject({ se_tao: 0, bo_qua_da_qua: 1 });
  });
  it("route con-thieu: GV → 403 (GET và POST); tháng sai → 400; chủ GET → 200", async () => {
    expect((await goi(conThieuR.GET, { cookie: cGvAnh, path: "/api/buoi-hoc/con-thieu?thang=2026-12" })).status).toBe(403);
    expect((await goi(conThieuR.POST, { cookie: cGvAnh, body: { thang: "2026-12" } })).status).toBe(403);
    expect((await goi(conThieuR.GET, { cookie: cChu, path: "/api/buoi-hoc/con-thieu?thang=2026-13" })).status).toBe(400);
    expect((await goi(conThieuR.GET, { cookie: cChu, path: "/api/buoi-hoc/con-thieu?thang=2030-01" })).status).toBe(200);
  });
});

describe("Mục 21 / T43 — tạo hồ sơ từ đơn, bỏ qua, hoàn tác", () => {
  const donCho = async () => (await db.don_dang_ky.findFirstOrThrow({ where: { ma_yeu_cau: "YC0041" } })).id; // đơn chờ duyệt của seed (25/11, Toán)
  const coViecDon = async (id: number) => (await homNay(chu, T22)).viec.some((v) => v.loai === "don_cho_duyet" && v.khoa === String(id));

  it("đơn mới không trùng: tạo HS0084, thử Toán 26/11 (nhận đơn muộn 1 ngày) → 08/12 (= 25/11 + 13); đơn da_nhan; hết khỏi Hôm nay; hoàn tác trả lại hết", async () => {
    const id = await donCho();
    expect(await coViecDon(id)).toBe(true);
    expect(await xemTruocDon(chu, id, T22)).toMatchObject({ ngay_dang_ky: "2026-11-25", thu_du_kien: { tu: "2026-11-26", den: "2026-12-08" }, trung: [], muon_chinh_thuc: false, mon: ["toan"] });
    const r = await taoHoSoTuDon(chu, id, {}, T22);
    expect(r).toMatchObject({ ket_qua: "da_tao", ma_hs: "HS0084", thu: { tu: "2026-11-26", den: "2026-12-08" }, mon: ["toan"], muon_chinh_thuc: false });
    expect(await gdCua("HS0084")).toEqual(["1:thu:2026-11-26→2026-12-08"]);
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id } })).toMatchObject({ trang_thai: "da_nhan" });
    expect(await coViecDon(id)).toBe(false);
    await expect(taoHoSoTuDon(chu, id, {}, T22)).rejects.toSatisfy((e) => ma(e) === "da_xu_ly");

    await hoanTacXuLyDon(chu, id, (r as { nhatKyId: number }).nhatKyId, giay(T22, 8));
    expect(await db.hoc_sinh.findUnique({ where: { ma_hs: "HS0084" } })).toBeNull();
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id } })).toMatchObject({ trang_thai: "cho_duyet", hoc_sinh_id: null });
    expect(await coViecDon(id)).toBe(true);
    await expect(hoanTacXuLyDon(chu, id, (r as { nhatKyId: number }).nhatKyId, giay(T22, 9))).rejects.toSatisfy((e) => ma(e) === "da_hoan_tac");
    // Tạo lại: mã mới HS0085 (mã đã cấp không cấp lại — ghi-danh.md 1.1)
    expect(await taoHoSoTuDon(chu, id, {}, T22)).toMatchObject({ ket_qua: "da_tao", ma_hs: "HS0085" });
  });
  it("trùng Gmail → trung_ho_so + gợi ý, không ghi gì; gắn vào HS0021 đang thử: môn mới hết cùng hạn chung 28/11 (5.2), môn đang thử bỏ qua", async () => {
    const d = await taoDon({ ho_ten: "Nguyễn Minh Bình", gmail: " HS21@example.com", mon: [1, 3] });
    const soHs = await db.hoc_sinh.count();
    const r = await taoHoSoTuDon(chu, d.id, {}, T22);
    expect(r).toMatchObject({ ket_qua: "trung_ho_so", goi_y: [{ ma_hs: "HS0021", khop: ["gmail"], an: false }] });
    expect(await db.hoc_sinh.count()).toBe(soHs);
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ trang_thai: "cho_duyet" });
    const g = await taoHoSoTuDon(chu, d.id, { maHs: "HS0021" }, T22);
    expect(g).toMatchObject({ ket_qua: "da_gan", ma_hs: "HS0021", thu: { tu: "2026-11-26", den: "2026-11-28" }, mon: ["dia"], bo_qua: [{ mon: "toan", ly_do: "dang_thu" }] });
    expect((await gdCua("HS0021")).at(-1)).toBe("3:thu:2026-11-26→2026-11-28");
  });
  it("gắn hồ sơ cũ chỉ điền ô trống (SĐT PH của HS0002), không ghi đè SĐT HS; hoàn tác trả ô về trống", async () => {
    const d = await taoDon({ gmail: "hs2@example.com", sdt_hs: "0911111111", sdt_ph: "+84 812 345 678", mon: [4] });
    const r = await taoHoSoTuDon(chu, d.id, { maHs: "HS0002" }, T22);
    expect(r).toMatchObject({ ket_qua: "da_gan", dien: ["sdt_ph"], mon: [], bo_qua: [{ mon: "anh", ly_do: "dang_chinh_thuc" }] });
    expect(await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } })).toMatchObject({ sdt_ph: "0812345678", sdt_hs: "0910000001" });
    await hoanTacXuLyDon(chu, d.id, (r as { nhatKyId: number }).nhatKyId, giay(T22, 3));
    expect((await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } })).sdt_ph).toBeNull();
  });
  it("T2: em hết thử (HS0061) đăng ký thử lại → can_chu_quyet, không ghi gì; chủ gửi capThuMoi → thử 14 ngày từ hôm nay", async () => {
    const d = await taoDon({ gmail: "hs61@example.com", mon: [1] });
    const truoc = await gdCua("HS0061");
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS0061" }, T22)).toEqual({ ket_qua: "can_chu_quyet", ly_do: "het_thu_dang_ky_lai", ma_hs: "HS0061", muon_chinh_thuc: false });
    expect(await gdCua("HS0061")).toEqual(truoc);
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS0061", capThuMoi: true }, T22)).toMatchObject({ ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-09" } });
  });
  it("T3: đơn Chính thức của em chưa từng thử → ghi danh THỬ + muon_chinh_thuc; đơn quá 14 ngày → can_chu_quyet don_qua_han", async () => {
    const d = await taoDon({ loai: "Chính thức", ho_ten: "Trần Văn Mới", mon: [2, 4] });
    const r = await taoHoSoTuDon(chu, d.id, {}, T22);
    expect(r).toMatchObject({ ket_qua: "da_tao", muon_chinh_thuc: true, thu: { tu: "2026-11-26", den: "2026-12-09" }, mon: ["su", "anh"] });
    expect((await gdCua((r as { ma_hs: string }).ma_hs)).every((x) => x.includes(":thu:"))).toBe(true);
    const cu = await taoDon({ ngay: "2026-11-01", ho_ten: "Lê Thị Cũ" });
    expect(await taoHoSoTuDon(chu, cu.id, {}, T22)).toMatchObject({ ket_qua: "can_chu_quyet", ly_do: "don_qua_han" });
  });
  it("bỏ qua: thiếu lý do → 400; có lý do → bo_qua, hết khỏi Hôm nay; hoàn tác quá 10 giây → het_gio, trong hạn → về cho_duyet", async () => {
    const d = await taoDon({ ho_ten: "Đơn Bỏ Qua" });
    await expect(boQuaDon(chu, d.id, "  ", T22)).rejects.toSatisfy((e) => (e as { status?: number }).status === 400);
    const r = await boQuaDon(chu, d.id, "Gửi trùng", T22);
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ trang_thai: "bo_qua", ghi_chu_xu_ly: "Gửi trùng" });
    expect(await coViecDon(d.id)).toBe(false);
    await expect(boQuaDon(chu, d.id, "lần hai", T22)).rejects.toSatisfy((e) => ma(e) === "da_xu_ly");
    await expect(hoanTacXuLyDon(chu, d.id, r.nhatKyId, giay(T22, 11))).rejects.toSatisfy((e) => ma(e) === "het_gio");
    await hoanTacXuLyDon(chu, d.id, r.nhatKyId, giay(T22, 4));
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ trang_thai: "cho_duyet", ghi_chu_xu_ly: null });
    expect(await coViecDon(d.id)).toBe(true);
  });
  it("hoàn tác tạo hồ sơ khi em đã có điểm danh → 409 co_diem_danh, không đổi gì", async () => {
    const d = await taoDon({ ho_ten: "Phạm Có Điểm", mon: [4] });
    const r = (await taoHoSoTuDon(chu, d.id, {}, T22)) as { ma_hs: string; nhatKyId: number };
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: r.ma_hs } });
    await db.diem_danh.create({ data: { buoi_id: await buoi(4, "2026-11-26"), hoc_sinh_id: hs.id, trang_thai: "co", ghi_luc: T22 } });
    await expect(hoanTacXuLyDon(chu, d.id, r.nhatKyId, giay(T22, 5))).rejects.toSatisfy((e) => ma(e) === "co_diem_danh");
    expect(await db.hoc_sinh.findUnique({ where: { id: hs.id } })).not.toBeNull();
  });
  it("route: GV và học sinh → 403 (tao-ho-so GET/POST, bo-qua, hoan-tac); chủ bỏ qua + hoàn tác qua route → 200", async () => {
    const d = await taoDon({ ho_ten: "Đơn Route", ngay: ngayVN(new Date()) }); // route dùng giờ thật
    const p = { id: String(d.id) };
    for (const c of [cGvAnh, cHs]) {
      expect((await goi(taoHoSoR.GET, { cookie: c, params: p })).status).toBe(403);
      expect((await goi(taoHoSoR.POST, { cookie: c, params: p, body: {} })).status).toBe(403);
      expect((await goi(boQuaR.POST, { cookie: c, params: p, body: { lyDo: "x" } })).status).toBe(403);
      expect((await goi(donHoanTacR.POST, { cookie: c, params: p, body: { nhatKyId: 1 } })).status).toBe(403);
    }
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ trang_thai: "cho_duyet" });
    const r = await goi(boQuaR.POST, { cookie: cChu, params: p, body: { lyDo: "Không liên lạc được" } });
    expect(r).toMatchObject({ status: 200, json: { trang_thai: "bo_qua" } });
    expect((await goi(donHoanTacR.POST, { cookie: cChu, params: p, body: { nhatKyId: r.json.nhatKyId } })).status).toBe(200);
    expect((await goi(taoHoSoR.GET, { cookie: cChu, params: { id: "999999" } })).status).toBe(404);
    expect((await goi(taoHoSoR.POST, { cookie: cChu, params: p, body: { taoMoi: true, hoSo: { hoTen: "Tên Sửa Tay" } } })).json).toMatchObject({ ket_qua: "da_tao" });
    expect(await db.hoc_sinh.count({ where: { ho_ten: "Tên Sửa Tay" } })).toBe(1);
  });
  it("tenGiong (ghi-danh.md 1.4)", () => {
    expect(tenGiong("Nguyễn Minh  An", "nguyen minh an")).toBe(true);
    expect(tenGiong("Lê Thị An", "Lê Văn Bình")).toBe(false);
    expect(tenGiong("Trần Gia Bảo", "Gia Bảo")).toBe(true);
    expect(tenGiong("Trần Bảo", "Lê Bảo")).toBe(false);
  });
});

describe("Mục 1 — homNay tách 4 khối, việc thử kèm lứa + SĐT HS", () => {
  it("4 hàm trả đúng các phần của homNay (chủ và GV)", async () => {
    for (const u of [chu, await nguoi(GV_ANH)]) {
      const d = await homNay(u, T22);
      expect(await lopToiNay(u, T22)).toEqual(d.lop_toi_nay);
      expect(await viecCanLam(u, T22)).toEqual({ viec: d.viec, so_viec_da_an: d.so_viec_da_an });
      expect(await theSo(u, T22)).toEqual(d.the_so);
      expect(await lich7Ngay(u, T22)).toEqual(d.lich_7_ngay);
    }
  });
  it("việc thử sắp hết / hết thử có lua + sdt_hs (chỉ chủ); GV không nhận sdt_hs ở đâu", async () => {
    const v = (await viecCanLam(chu, T22)).viec;
    expect(v.find((x) => x.loai === "thu_sap_het")).toMatchObject({ lua: "L2", sdt_hs: expect.stringMatching(/^09/) });
    expect(v.find((x) => x.loai === "het_thu")).toMatchObject({ lua: "L2", sdt_hs: expect.any(String) });
    expect(JSON.stringify(await homNay(await nguoi(GV_ANH), T22))).not.toContain("sdt_hs");
  });
});

describe("Mục 9, 10, 14, 25 — đầu vào và nhật ký", () => {
  it("soNguyen chỉ nhận ^-?\\d+$ (chuỗi) hoặc số nguyên", () => {
    expect([soNguyen("2", "x"), soNguyen("-3", "x"), soNguyen(7, "x")]).toEqual([2, -3, 7]);
    for (const v of ["0x2", "1e3", " 2", "2 ", "+2", "0b1", "", true, null, 1.5]) expect(() => soNguyen(v, "x")).toThrow();
  });
  it("route: id buổi '0x2' → 400", async () => {
    expect((await goi(diemDanh.GET, { cookie: cChu, params: { buoiId: "0x2" } })).status).toBe(400);
  });
  it("nhật ký 'từ chối': tối đa 1 dòng / người / route / phút; khác phương thức hoặc qua 1 phút → dòng mới", async () => {
    const dem = () => db.nhat_ky.count({ where: { hanh_dong: "tu_choi", doi_tuong_id: "POST /api/gioi-han" } });
    const truoc = await dem();
    for (let i = 0; i < 3; i++) expect((await goi(conThieuR.POST, { cookie: cGvAnh, path: "/api/gioi-han", body: { thang: "2026-12" } })).status).toBe(403);
    expect(await dem()).toBe(truoc + 1);
    expect((await goi(conThieuR.POST, { cookie: cHs, path: "/api/gioi-han", body: { thang: "2026-12" } })).status).toBe(403); // người khác
    expect(await dem()).toBe(truoc + 2);
    expect((await goi(conThieuR.GET, { cookie: cGvAnh, path: "/api/gioi-han" })).status).toBe(403);
    expect(await db.nhat_ky.count({ where: { hanh_dong: "tu_choi", doi_tuong_id: "GET /api/gioi-han" } })).toBe(1);
    await ghiTuChoi(await nguoi(GV_ANH), "POST", "/api/gioi-han", "x", giay(new Date(), 61));
    expect(await dem()).toBe(truoc + 3);
  });
  it("PATCH /api/buoi-hoc/[id] không có trường hợp lệ → 400, không ghi nhật ký", async () => {
    const id = String(await buoi(4, "2026-12-10"));
    const truoc = await db.nhat_ky.count({ where: { hanh_dong: "sua_noi_dung_buoi" } });
    for (const body of [{}, { foo: 1 }]) expect((await goi(buoiIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id }, body })).status).toBe(400);
    expect(await db.nhat_ky.count({ where: { hanh_dong: "sua_noi_dung_buoi" } })).toBe(truoc);
    expect((await goi(buoiIdR.PATCH, { cookie: cGvAnh, method: "PATCH", params: { id }, body: { noiDung: "Bài 1" } })).status).toBe(200);
  });
  it("gia hạn số ngày sai (−5, 9999, 'abc', thiếu cả soNgay lẫn denNgay) → 400; GV → 403 trước", async () => {
    for (const soNgay of [-5, 9999, "abc", 0, 1.5]) expect((await goi(giaHanR.POST, { cookie: cChu, body: { maHs: ["HS0036"], soNgay, lyDo: "x" } })).status).toBe(400);
    expect((await goi(giaHanR.POST, { cookie: cChu, body: { maHs: ["HS0036"], lyDo: "x" } })).status).toBe(400);
    expect((await goi(giaHanR.POST, { cookie: cGvAnh, body: { maHs: ["HS0036"], soNgay: -5, lyDo: "x" } })).status).toBe(403);
  });
});

describe("Mục 22 — danh sách học sinh lọc theo ngày hết thử", () => {
  it("het_ngay = 28/11 → đúng các em của nhóm 'Thử sắp hết · Hết 28/11' ở Hôm nay; 15/11 → nhóm hết thử", async () => {
    const viec = (await homNay(chu, T22)).viec;
    const nhom = (loai: string, ngay: string) => viec.filter((v) => v.loai === loai && v.ngay === ngay).map((v) => v.ma_hs).sort();
    for (const [loai, ngay] of [["thu_sap_het", "2026-11-28"], ["thu_sap_het", "2026-11-29"], ["het_thu", "2026-11-15"]]) {
      const ds = (await danhSachHocSinh(chu, { hetNgay: ngay }, T22)).hoc_sinh.map((x) => x.ma_hs).sort();
      expect(ds.length).toBeGreaterThan(0);
      expect(ds).toEqual(nhom(loai, ngay));
    }
  });
  it("route: ?het_ngay sai → 400; GV lọc được (chỉ em môn mình)", async () => {
    expect((await goi(hocSinhR.GET, { cookie: cChu, path: "/api/hoc-sinh?het_ngay=2026-02-30" })).status).toBe(400);
    expect((await goi(hocSinhR.GET, { cookie: cGvAnh, path: "/api/hoc-sinh?het_ngay=2026-11-28" })).status).toBe(200);
  });
});
