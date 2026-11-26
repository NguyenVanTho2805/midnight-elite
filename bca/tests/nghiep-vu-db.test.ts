// Test nghiệp vụ trên DB thử với giờ cố định (dữ liệu giả của scripts/seed-gia.ts, "hôm nay" = 26/11/2026).
import { beforeAll, describe, expect, it } from "vitest";
import { d2s, lucVN, s2d } from "@/lib/ngay";
import { LoiQuyen } from "@/lib/quyen";
import { CHU, GV_ANH, GV_TOAN, db, napSeed, nguoi, nguoiHs } from "./chung";
import { homNay } from "@/server/hom-nay";
import { chiTietDiemDanh, danhTatCaCoMat, datDiemDanh, hoanTacTatCa, maTranThang } from "@/server/diem-danh";
import { chuyenChinhThuc, giaHanThu, hoanTacGiaHan, nghiMon, themMon } from "@/server/ghi-danh";
import { boHuyBuoi, huyBuoi, sinhBuoiThang, themHocBu } from "@/server/buoi-hoc";
import { chiTietHocSinh } from "@/server/hoc-sinh";
import { cuaToi } from "@/server/hs";
import type { Nguoi } from "@/lib/quyen";

let chu: Nguoi, gvAnh: Nguoi, gvToan: Nguoi;
const T22 = lucVN("2026-11-26", "22:00");
const buoiId = async (mon: number, ngay: string, gio = "22:15") => (await db.buoi_hoc.findUniqueOrThrow({ where: { mon_id_bat_dau_luc: { mon_id: mon, bat_dau_luc: lucVN(ngay, gio) } } })).id;
const hsId = async (ma: string) => (await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: ma } })).id;
const gdCua = async (ma: string, mon: number) =>
  (await db.ghi_danh.findMany({ where: { hoc_sinh_id: await hsId(ma), mon_id: mon }, orderBy: { id: "asc" } })).map((g) => ({ loai: g.loai, tu: d2s(g.tu_ngay), den: g.den_ngay ? d2s(g.den_ngay) : null, huy: !!g.huy_luc }));
const ma = (e: unknown) => (e as { ma?: string }).ma;

beforeAll(async () => {
  await napSeed();
  [chu, gvAnh, gvToan] = await Promise.all([nguoi(CHU), nguoi(GV_ANH), nguoi(GV_TOAN)]);
});

describe("Hôm nay (hom-nay.md)", () => {
  it("chủ 22:00 Thứ Năm 26/11: thẻ Anh 13 chính thức · 30 thử, đã điểm 0/43, nút điểm danh sáng", async () => {
    const d = await homNay(chu, T22);
    expect(d.lop_toi_nay).toHaveLength(1);
    expect(d.lop_toi_nay[0]).toMatchObject({ mon: { ma: "anh" }, gio: "22:15–23:45", chinh_thuc: 13, thu: 30, si_so: 43, da_diem: 0, mo_diem_danh: true, toi_qua: false });
    expect((await homNay(chu, lucVN("2026-11-26", "21:44"))).lop_toi_nay[0].mo_diem_danh).toBe(false);
  });
  it("việc cần làm của chủ: đơn 1 · hết thử 5 · sắp hết 8 · chưa điểm danh Toán 24/11, Anh 23/11 · sửa dữ liệu HS0008", async () => {
    const v = (await homNay(chu, T22)).viec;
    const dem = (l: string) => v.filter((x) => x.loai === l).length;
    expect([dem("don_cho_duyet"), dem("het_thu"), dem("thu_sap_het")]).toEqual([1, 5, 8]);
    expect(v.filter((x) => x.loai === "buoi_chua_diem_danh").map((x) => [(x.mon as { ma: string }).ma, (x.buoi as { ngay: string }[]).map((b) => b.ngay)])).toEqual([
      ["anh", ["2026-11-23"]], // cùng mức: ngày cũ hơn lên trước (3.1)
      ["toan", ["2026-11-24"]],
    ]);
    expect(v.find((x) => x.loai === "sua_du_lieu")).toMatchObject({ ma_hs: "HS0008", loi: ["gmail"] });
    expect(v.find((x) => x.loai === "em_vang_nhieu" && (x.mon as { ma: string }).ma === "su")?.em).toContainEqual(expect.objectContaining({ ma_hs: "HS0021", so_vang: 3 }));
    expect(v.find((x) => x.loai === "buoi_thieu_record")?.buoi).toEqual([expect.objectContaining({ ngay: "2026-11-16" }), expect.objectContaining({ ngay: "2026-11-19" })]);
    expect(v.map((x) => x.muc)).toEqual([...v.map((x) => x.muc)].sort((a, b) => a - b));
  });
  it("thẻ số liệu của chủ: 23 chính thức · 40 thử · 8 sắp hết · 3 lên chính thức tháng này", async () => {
    expect((await homNay(chu, T22)).the_so).toMatchObject({ dang_hoc_chinh_thuc: 23, dang_thu: 40, thu_het_3_ngay: 8, len_chinh_thuc_thang_nay: 3 });
  });
  it("GV Anh chỉ thấy môn Anh, chỉ việc mức 5, không thấy thử/đơn/thẻ tổng (6.2, T13)", async () => {
    const d = await homNay(gvAnh, T22);
    expect(d.lop_toi_nay.map((b) => b.mon?.ma)).toEqual(["anh"]);
    expect(d.viec.every((x) => x.muc === 5 && (x.mon as { ma: string }).ma === "anh")).toBe(true);
    expect(d.the_so).not.toHaveProperty("dang_thu");
    expect(d.the_so.si_so.map((s) => s.mon?.ma)).toEqual(["anh"]);
    expect((await homNay(gvToan, T22)).lop_toi_nay).toHaveLength(0);
  });
  it("00:20 ngày 27/11 còn thẻ 'Buổi tối qua — Anh 26/11'; 06:05 thì không (T12)", async () => {
    const d = await homNay(gvAnh, lucVN("2026-11-27", "00:20"));
    expect(d.lop_toi_nay[0]).toMatchObject({ toi_qua: true, ngay: "2026-11-26", mon: { ma: "anh" } });
    expect((await homNay(gvAnh, lucVN("2026-11-27", "06:05"))).lop_toi_nay.some((b) => b.toi_qua)).toBe(false);
  });
});

describe("Điểm danh (diem-danh.md)", () => {
  it("chọn Vắng 2 em rồi 'đánh tất cả' → 41 Có + 2 Vắng; hoàn tác chỉ trả 41 em về chưa điểm", async () => {
    const id = await buoiId(4, "2026-11-26");
    const luc = lucVN("2026-11-26", "22:20");
    const ct = await chiTietDiemDanh(gvAnh, id, luc);
    expect(ct.em).toHaveLength(43);
    expect(ct.trang_thai_ghi).toBe("mo");
    const [a, b] = ct.em;
    await datDiemDanh(gvAnh, id, a.hoc_sinh_id, { trangThai: "vang" }, luc);
    await datDiemDanh(gvAnh, id, b.hoc_sinh_id, { trangThai: "vang" }, luc);
    const r = await danhTatCaCoMat(gvAnh, id, {}, lucVN("2026-11-26", "22:21"));
    expect(r.ids).toHaveLength(41);
    expect(r.tien_do).toEqual({ si_so: 43, da_diem: 43, xong: true });
    expect((await chiTietDiemDanh(gvAnh, id, luc)).dem).toEqual({ chua_diem: 0, co: 41, phep: 0, vang: 2 });
    expect((await db.buoi_hoc.findUniqueOrThrow({ where: { id } })).da_diem_danh_luc).not.toBeNull();
    // Một em bị sửa tay sau "đánh tất cả" → hoàn tác không đụng em đó
    await datDiemDanh(gvAnh, id, r.ids[0], { trangThai: "phep" }, lucVN("2026-11-26", "22:22"));
    const h = await hoanTacTatCa(gvAnh, id, r.ids, r.luc, lucVN("2026-11-26", "22:22"));
    expect(h.so_tra_lai).toBe(40);
    expect((await chiTietDiemDanh(gvAnh, id, luc)).dem).toEqual({ chua_diem: 40, co: 0, phep: 1, vang: 2 });
    expect((await db.buoi_hoc.findUniqueOrThrow({ where: { id } })).da_diem_danh_luc).toBeNull();
  });
  it("hai GV cùng môn sửa một ô: bản sau thắng, nhật ký giữ cả hai (2.3); ghi chú em (T25) học sinh không thấy", async () => {
    const id = await buoiId(4, "2026-11-26");
    const gv2nd = await db.nguoi_dung.create({ data: { gmail: "gv2.anh@bca.invalid", ten_hien_thi: "GV Anh 2", vai_tro: "giao_vien", phan_cong: { create: { mon_id: 4 } } } });
    const gv2 = await nguoi(gv2nd.gmail);
    const em = (await chiTietDiemDanh(gvAnh, id, T22)).em[5];
    await datDiemDanh(gvAnh, id, em.hoc_sinh_id, { trangThai: "vang" }, lucVN("2026-11-26", "22:30"));
    await datDiemDanh(gv2, id, em.hoc_sinh_id, { trangThai: "phep", ghiChu: "Ốm, đã báo Zalo" }, lucVN("2026-11-26", "22:41"));
    const sau = (await chiTietDiemDanh(chu, id, T22)).em.find((e) => e.hoc_sinh_id === em.hoc_sinh_id)!;
    expect(sau).toMatchObject({ trang_thai: "phep", ghi_boi: "GV Anh 2", ghi_chu: "Ốm, đã báo Zalo" });
    expect(await db.nhat_ky.count({ where: { doi_tuong: "diem_danh", doi_tuong_id: `${id}:${em.hoc_sinh_id}` } })).toBe(2);
    const hs = await cuaToi({ vai: "hoc_sinh", hocSinhId: em.hoc_sinh_id, ten: "" }, T22);
    expect(JSON.stringify(hs)).not.toContain("Ốm, đã báo Zalo");
  });
  it("chưa tới 21:45 → chua_mo; buổi quá 48 giờ cần xác nhận; GV môn khác → 403; em không có tên → 409", async () => {
    const anh = await buoiId(4, "2026-11-26");
    const em = (await chiTietDiemDanh(gvAnh, anh, T22)).em[0].hoc_sinh_id;
    await expect(datDiemDanh(gvAnh, anh, em, { trangThai: "co" }, lucVN("2026-11-26", "21:40"))).rejects.toSatisfy((e) => ma(e) === "chua_mo");
    const toan = await buoiId(1, "2026-11-17");
    const hs1 = await hsId("HS0001");
    await expect(datDiemDanh(gvToan, toan, hs1, { trangThai: "vang" }, T22)).rejects.toSatisfy((e) => ma(e) === "can_xac_nhan_48h");
    await datDiemDanh(gvToan, toan, hs1, { trangThai: "vang", xacNhan: true }, T22);
    expect((await db.nhat_ky.findFirst({ where: { doi_tuong_id: `${toan}:${hs1}` }, orderBy: { id: "desc" } }))?.sau).toMatchObject({ trang_thai: "vang", qua_48h_xac_nhan: true });
    await expect(datDiemDanh(gvAnh, toan, hs1, { trangThai: "co", xacNhan: true }, T22)).rejects.toBeInstanceOf(LoiQuyen);
    await expect(datDiemDanh(gvAnh, anh, await hsId("HS0001"), { trangThai: "co" }, T22)).rejects.toSatisfy((e) => ma(e) === "khong_trong_buoi");
  });
  it("ma trận Sử tháng 11: 4 buổi, HS0021 vắng 3, hết thử 28/11 nên 29/11 là \"-\" → có mặt 0/3, chuỗi 0", async () => {
    const m = await maTranThang(chu, "su", "2026-11", T22);
    expect(m.buoi.map((b) => b.ngay)).toEqual(["2026-11-18", "2026-11-22", "2026-11-25", "2026-11-29"]);
    expect(m.hang.find((h) => h.ma_hs === "HS0021")).toMatchObject({ o: ["vang", "vang", "vang", "-"], co_mat: "0/3", chuoi: 0, loai: "thu" });
    await expect(maTranThang(gvAnh, "su", "2026-11", T22)).rejects.toBeInstanceOf(LoiQuyen);
  });
});

describe("Ghi danh — chỉ chủ (ghi-danh.md)", () => {
  it("gia hạn 2 em +7 ngày (T29): em còn hạn dời 28/11 → 05/12; em đã hết được đoạn mới 26/11–02/12; hoàn tác trả lại", async () => {
    const r = await giaHanThu(chu, ["HS0021", "HS0065"], { soNgay: 7 }, "Em bận thi (giả)", T22);
    expect(r.ketQua).toEqual([
      { ma_hs: "HS0021", den_moi: "2026-12-05", doan_moi: false },
      { ma_hs: "HS0065", den_moi: "2026-12-02", doan_moi: true },
    ]);
    expect(await gdCua("HS0021", 2)).toEqual([{ loai: "thu", tu: "2026-11-15", den: "2026-12-05", huy: false }]);
    expect(await gdCua("HS0065", 1)).toEqual([
      { loai: "thu", tu: "2026-11-05", den: "2026-11-18", huy: false },
      { loai: "thu", tu: "2026-11-26", den: "2026-12-02", huy: false },
    ]);
    expect(await hoanTacGiaHan(chu, r.nhatKyId)).toEqual({ traLai: 4, boQua: 0 });
    expect(await gdCua("HS0021", 2)).toEqual([{ loai: "thu", tu: "2026-11-15", den: "2026-11-28", huy: false }]);
    expect(await gdCua("HS0065", 1)).toHaveLength(1);
    await expect(hoanTacGiaHan(chu, r.nhatKyId)).rejects.toSatisfy((e) => (e as { status?: number }).status === 409);
  });
  it("gia hạn cần lý do; GV không được gia hạn / chuyển chính thức / thêm môn / cho nghỉ (QĐ 16)", async () => {
    await expect(giaHanThu(chu, ["HS0021"], { soNgay: 3 }, " ", T22)).rejects.toThrow("lý do");
    for (const f of [
      () => giaHanThu(gvAnh, ["HS0022"], { soNgay: 3 }, "x", T22),
      () => chuyenChinhThuc(gvAnh, "HS0022", ["anh"], {}, T22),
      () => themMon(gvAnh, "HS0022", "toan", "thu", undefined, T22),
      () => nghiMon(gvAnh, "HS0022", "anh", undefined, T22),
    ]) await expect(f()).rejects.toBeInstanceOf(LoiQuyen);
  });
  it("chuyển chính thức mặc định = ngày sau hết thử (29/11 → 30/11), 1 môn → 65.000đ/buổi", async () => {
    const r = await chuyenChinhThuc(chu, "HS0022", ["anh"], {}, T22);
    expect(r).toMatchObject({ donGiaDuKien: 65_000, soMonChinhThuc: 1 });
    expect(await gdCua("HS0022", 4)).toEqual([
      { loai: "thu", tu: "2026-11-16", den: "2026-11-29", huy: false },
      { loai: "chinh_thuc", tu: "2026-11-30", den: null, huy: false },
    ]);
  });
  it("lên sớm từ 26/11 cả Toán + Anh: thử cắt còn 25/11, 2 môn → 55.000đ/buổi/môn", async () => {
    const r = await chuyenChinhThuc(chu, "HS0023", ["toan", "anh"], { tuNgay: "2026-11-26" }, T22);
    expect(r).toMatchObject({ donGiaDuKien: 55_000, soMonChinhThuc: 2 });
    expect(await gdCua("HS0023", 1)).toEqual([
      { loai: "thu", tu: "2026-11-17", den: "2026-11-25", huy: false },
      { loai: "chinh_thuc", tu: "2026-11-26", den: null, huy: false },
    ]);
    const ct = await db.ghi_danh.findFirstOrThrow({ where: { hoc_sinh_id: await hsId("HS0023"), mon_id: 1, loai: "chinh_thuc" } });
    expect(ct.ghi_chu).toBe("Lên chính thức sớm từ 26/11");
  });
  it("thêm môn thử theo cửa sổ chung; cho nghỉ trước 22:00 → hết hôm qua; mã GD mới tăng từ bộ đếm", async () => {
    const dem = (await db.bo_dem.findUniqueOrThrow({ where: { khoa: "gd" } })).gia_tri;
    const r = await themMon(chu, "HS0024", "toan", "thu", undefined, T22);
    expect(r.thayDoi[0]).toMatchObject({ kieu: "tao", ma_gd: `GD${String(dem + 1).padStart(5, "0")}`, den_moi: "2026-12-01" });
    expect((await nghiMon(chu, "HS0002", "anh", undefined, lucVN("2026-11-26", "21:00"))).denNgay).toBe("2026-11-25");
    expect(await gdCua("HS0002", 4)).toEqual([{ loai: "chinh_thuc", tu: "2026-06-30", den: "2026-11-25", huy: false }]);
    const ct = await chiTietHocSinh(chu, "HS0002", T22);
    expect(ct.tinh_trang).toBe("Thử đến 03/12");
    expect(ct.mon.find((m) => m.ma === "anh")?.lich_su.at(-1)).toMatchObject({ ai: "Chủ lớp (thử)", hanh_dong: "nghi_mon" });
  });
  it("CSDL chặn chồng ngày cùng em cùng môn (EXCLUDE)", async () => {
    const id = await hsId("HS0003");
    await expect(db.ghi_danh.create({ data: { ma_gd: "GD99999", hoc_sinh_id: id, mon_id: 1, loai: "thu", tu_ngay: s2d("2026-12-01"), den_ngay: s2d("2026-12-10") } })).rejects.toThrow();
  });
});

describe("Buổi học (buoi-hoc.md)", () => {
  it("sinh buổi lặp lại an toàn: tháng 12 đã có → 0 buổi mới; tháng 1/2027 lần 1 tạo 31, lần 2 tạo 0", async () => {
    expect(await sinhBuoiThang(chu, "2026-12")).toEqual({ theo_lich: 31, tao_moi: 0 });
    const lan1 = await sinhBuoiThang(chu, "2027-01");
    expect(lan1.tao_moi).toBe(lan1.theo_lich);
    expect((await sinhBuoiThang(chu, "2027-01")).tao_moi).toBe(0);
    await expect(sinhBuoiThang(gvToan, "2027-02")).rejects.toBeInstanceOf(LoiQuyen);
  });
  it("huỷ buổi đã có điểm danh phải xác nhận; bỏ huỷ được; không lý do bị chặn", async () => {
    const id = await buoiId(1, "2026-11-21");
    await expect(huyBuoi(chu, id, "")).rejects.toThrow("lý do");
    await expect(huyBuoi(chu, id, "GV ốm")).rejects.toSatisfy((e) => ma(e) === "can_xac_nhan");
    expect(await huyBuoi(chu, id, "GV ốm", true)).toMatchObject({ trang_thai: "huy" });
    expect((await homNay(chu, T22)).viec.some((v) => v.loai === "buoi_chua_diem_danh" && (v.buoi as { id: number }[]).some((b) => b.id === id))).toBe(false);
    await boHuyBuoi(chu, id);
  });
  it("học bù Sử Thứ Hai 30/11 22:15 trùng giờ Anh → cảnh báo kèm số em học cả hai môn, không chặn", async () => {
    const r = await themHocBu(chu, { mon: "su", ngay: "2026-11-30" });
    expect(r.canh_bao).toHaveLength(1);
    expect(r.canh_bao[0]).toMatch(/^Trùng giờ Anh 22:15, \d+ em học cả hai môn$/);
    await expect(themHocBu(chu, { mon: "su", ngay: "2026-11-30" })).rejects.toSatisfy((e) => (e as { status?: number }).status === 409);
  });
});
