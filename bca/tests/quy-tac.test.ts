// Test thuần: quy tắc ngày thử, giá trị mặc định, tiền, quyền. Ví dụ số lấy đúng từ docs/bca/nghiep-vu/*.md.
import { describe, expect, it } from "vitest";
import { lucVN, ngayVN } from "@/lib/ngay";
import { chuanHoaSdt, goiYGmail, sdtHopLe } from "@/lib/chuan-hoa";
import {
  buoiTheoLich, chuanHoaLink, chuoi, hetThu, hieuLuc, keHoachChinhThuc, keHoachGiaHan, keHoachNghi, keHoachThemThu, khoangThu,
  moDiemDanh, ngayChinhThucMacDinh, ngayNghiMacDinh, oMon, qua48Gio, tienKy, tinhTrang, thuSapHet, type GD,
} from "@/lib/quy-tac";
import { COT_HS_CHU, COT_HS_GV, coMon, type Nguoi } from "@/lib/quyen";

const MON = [
  { id: 1, thu: [2, 6], gio_bat_dau: "22:15", so_phut: 90 }, // Toán T3, T7
  { id: 2, thu: [3, 7], gio_bat_dau: "22:15", so_phut: 90 }, // Sử T4, CN
  { id: 3, thu: [5], gio_bat_dau: "22:15", so_phut: 90 }, // Địa T6
  { id: 4, thu: [1, 4], gio_bat_dau: "22:15", so_phut: 90 }, // Anh T2, T5
];
const thu = (mon_id: number, tu: string, den: string, id = mon_id): GD => ({ id, mon_id, loai: "thu", tu, den, huy: false });
const ct = (mon_id: number, tu: string, den: string | null = null, id = 100 + mon_id): GD => ({ id, mon_id, loai: "chinh_thuc", tu, den, huy: false });
const buoiCo = (mon: number, gds: GD[], thang: string) => buoiTheoLich(MON, thang, "2026-11-16").filter((b) => b.mon_id === mon && gds.some((g) => hieuLuc(g, b.ngay)));

describe("Múi giờ Asia/Ho_Chi_Minh", () => {
  it("2026-12-02T17:10Z là ngày 03/12 ở Việt Nam", () => expect(ngayVN(new Date("2026-12-02T17:10:00Z"))).toBe("2026-12-03"));
  it("buổi Toán 01/12 22:15 +07 = 15:15Z", () => expect(lucVN("2026-12-01", "22:15").toISOString()).toBe("2026-12-01T15:15:00.000Z"));
});

describe("Học thử 14 ngày (ghi-danh.md 5.1)", () => {
  it("đơn 20:00 02/12 → thử 02/12–15/12; Sử 4 buổi, Toán 4 buổi (có 15/12)", () => {
    const k = khoangThu(lucVN("2026-12-02", "20:00"));
    expect(k).toEqual({ tu: "2026-12-02", den: "2026-12-15" });
    expect(buoiCo(2, [thu(2, k.tu, k.den)], "2026-12").map((b) => b.ngay)).toEqual(["2026-12-02", "2026-12-06", "2026-12-09", "2026-12-13"]);
    expect(buoiCo(1, [thu(1, k.tu, k.den)], "2026-12").map((b) => b.ngay)).toEqual(["2026-12-05", "2026-12-08", "2026-12-12", "2026-12-15"]);
  });
  it("00:10 ngày 03/12 → 03/12–16/12; 23:50 ngày 02/12 → 02/12–15/12 (T1)", () => {
    expect(khoangThu(new Date("2026-12-02T17:10:00Z"))).toEqual({ tu: "2026-12-03", den: "2026-12-16" });
    expect(khoangThu(lucVN("2026-12-02", "23:50"))).toEqual({ tu: "2026-12-02", den: "2026-12-15" });
  });
  it("đơn 25/11 → 25/11–08/12", () => expect(khoangThu(lucVN("2026-11-25", "09:00"))).toEqual({ tu: "2026-11-25", den: "2026-12-08" }));
  it("cửa sổ chung: thêm Địa thử ngày 07/12 hết 15/12, không phải 20/12 (5.2)", () => {
    const v = keHoachThemThu([thu(1, "2026-12-02", "2026-12-15"), thu(2, "2026-12-02", "2026-12-15")], 3, "2026-12-07");
    expect(v).toEqual([{ kieu: "tao", mon_id: 3, loai: "thu", tu: "2026-12-07", den: "2026-12-15" }]);
  });
  it("không thêm Thử môn đang học chính thức", () => expect(() => keHoachThemThu([ct(1, "2026-11-01")], 1, "2026-12-07")).toThrow());
});

describe("Gia hạn thử (5.4)", () => {
  it("còn hạn: hạn 15/12, ngày 14/12 +3 → 18/12, áp cả Toán và Sử (T4); chỉ thêm buổi Sử 16/12", () => {
    const gds = [thu(1, "2026-12-02", "2026-12-15"), thu(2, "2026-12-02", "2026-12-15")];
    const k = keHoachGiaHan(gds, "2026-12-14", { soNgay: 3 });
    expect(k.denMoi).toBe("2026-12-18");
    expect(k.viec).toEqual([{ kieu: "sua_den", id: 1, den: "2026-12-18" }, { kieu: "sua_den", id: 2, den: "2026-12-18" }]);
    const truoc = buoiTheoLich(MON, "2026-12", "2026-11-16").filter((b) => gds.some((g) => g.mon_id === b.mon_id && hieuLuc(g, b.ngay)));
    const sau = buoiTheoLich(MON, "2026-12", "2026-11-16").filter((b) => gds.some((g) => g.mon_id === b.mon_id && hieuLuc({ ...g, den: "2026-12-18" }, b.ngay)));
    expect(sau.length - truoc.length).toBe(1);
  });
  it("đã hết: hết 15/12, ngày 17/12 +3 → đoạn mới 17/12–19/12, không phủ 16/12", () => {
    const k = keHoachGiaHan([thu(1, "2026-12-02", "2026-12-15")], "2026-12-17", { soNgay: 3 });
    expect(k).toMatchObject({ denMoi: "2026-12-19", doanMoi: true });
    expect(k.viec[0]).toMatchObject({ kieu: "tao", tu: "2026-12-17", den: "2026-12-19" });
  });
  it("số ngày sai bị chặn", () => expect(() => keHoachGiaHan([thu(1, "2026-12-02", "2026-12-15")], "2026-12-14", { soNgay: 0 })).toThrow());
});

describe("Chuyển chính thức (Điều 7) + tiền", () => {
  const gds = [thu(1, "2026-12-02", "2026-12-15")];
  it("mặc định khi còn hạn = ngày sau hết thử (16/12); đã hết = hôm nay", () => {
    expect(ngayChinhThucMacDinh(gds, 1, "2026-12-08")).toBe("2026-12-16");
    expect(ngayChinhThucMacDinh([thu(1, "2026-11-15", "2026-11-28")], 1, "2026-12-02")).toBe("2026-12-02");
  });
  it("lên sớm 08/12: Thử còn 02/12–07/12, CT từ 08/12; tháng 12 tính 7 buổi Toán = 455.000đ", () => {
    const v = keHoachChinhThuc(gds, 1, "2026-12-08");
    expect(v).toEqual([
      { kieu: "sua_den", id: 1, den: "2026-12-07" },
      { kieu: "tao", mon_id: 1, loai: "chinh_thuc", tu: "2026-12-08", den: null, ghi_chu: "Lên chính thức sớm từ 08/12" },
    ]);
    const n = buoiCo(1, [ct(1, "2026-12-08")], "2026-12").length;
    expect(n).toBe(7);
    expect(tienKy([n])).toBe(455_000);
  });
  it("mặc định 16/12: Thử giữ nguyên, 4 buổi = 260.000đ", () => {
    const v = keHoachChinhThuc(gds, 1, "2026-12-16");
    expect(v).toHaveLength(1);
    expect(tienKy([buoiCo(1, [ct(1, "2026-12-16")], "2026-12").length])).toBe(260_000);
  });
  it("đổi môn giữa tháng: Toán 3 buổi + Sử 7 buổi → 55.000đ × 10 = 550.000đ (T5)", () => {
    const toan = buoiCo(1, [ct(1, "2026-12-01", "2026-12-08")], "2026-12").length;
    const su = buoiCo(2, [ct(2, "2026-12-09")], "2026-12").length;
    expect([toan, su]).toEqual([3, 7]);
    expect(tienKy([toan, su])).toBe(550_000);
    expect(tienKy([0, 5])).toBe(325_000); // môn 0 buổi không tính vào số môn
  });
  it("đã có chính thức thì báo lỗi", () => expect(() => keHoachChinhThuc([ct(1, "2026-11-01")], 1, "2026-12-08")).toThrow());
});

describe("Nghỉ môn (Điều 8, luật 22:00)", () => {
  it("21:00 10/12 → hết 09/12; 22:30 → hết 10/12", () => {
    expect(ngayNghiMacDinh(lucVN("2026-12-10", "21:00"))).toBe("2026-12-09");
    expect(ngayNghiMacDinh(lucVN("2026-12-10", "22:30"))).toBe("2026-12-10");
  });
  it("thử đến 15/12 + CT hẹn 16/12, nghỉ ngày 11/12: Thử cắt 11/12, CT bị huỷ", () => {
    const v = keHoachNghi([thu(1, "2026-12-02", "2026-12-15", 1), ct(1, "2026-12-16", null, 2)], 1, "2026-12-11");
    expect(v).toEqual([
      { kieu: "sua_den", id: 1, den: "2026-12-11", nghi: true },
      { kieu: "huy", id: 2, den: "2026-12-15" },
    ]);
  });
  it("T34: em hết thử 14/11 (không còn dòng mở) → chỉ ghi nghi lên dòng cuối, giữ ngày; nghỉ lần hai báo lỗi", () => {
    const g = thu(1, "2026-11-01", "2026-11-14", 7);
    expect(keHoachNghi([g], 1, "2026-11-25")).toEqual([{ kieu: "sua_den", id: 7, den: "2026-11-14", nghi: true }]);
    expect(() => keHoachNghi([{ ...g, nghi: true }], 1, "2026-11-25")).toThrow("đã nghỉ");
    expect(() => keHoachNghi([g], 2, "2026-11-25")).toThrow("chưa ghi danh");
  });
});

describe("Ô môn và tình trạng (Điều 4)", () => {
  it("H=26/11, Thử Sử 17/11–30/11 + CT Sử từ 01/12 → Học, 'Thử → CT 01/12'", () => {
    const gds = [thu(2, "2026-11-17", "2026-11-30"), ct(2, "2026-12-01")];
    expect(oMon(gds, 2, "2026-11-26")).toBe("hoc");
    expect(tinhTrang(gds, "2026-11-26")).toBe("Thử → CT 01/12");
  });
  it("hết thử chưa xử lý → 'Hết thử dd/mm – hỏi em'; bị chủ cho nghỉ → 'Đã nghỉ'", () => {
    expect(tinhTrang([thu(1, "2026-11-01", "2026-11-14")], "2026-11-26")).toBe("Hết thử 14/11 – hỏi em");
    expect(hetThu([{ ...thu(1, "2026-11-01", "2026-11-10"), nghi: true }], "2026-11-26")).toBeNull();
  });
  it("T34: thử Toán + Anh hết 14/11, chủ chỉ cho nghỉ Toán → vẫn 'Hết thử – hỏi em' (còn Anh); nghỉ cả hai → 'Đã nghỉ'", () => {
    const toan = thu(1, "2026-11-01", "2026-11-14", 1), anh = thu(4, "2026-11-01", "2026-11-14", 4);
    expect(tinhTrang([{ ...toan, nghi: true }, anh], "2026-11-26")).toBe("Hết thử 14/11 – hỏi em");
    expect(tinhTrang([{ ...toan, nghi: true }, { ...anh, nghi: true }], "2026-11-26")).toBe("Đã nghỉ");
  });
  it("thử sắp hết trong 3 ngày, không tính em có chính thức", () => {
    expect(thuSapHet([thu(1, "2026-11-15", "2026-11-28")], "2026-11-26")).toBe("2026-11-28");
    expect(thuSapHet([thu(1, "2026-11-15", "2026-11-28"), ct(2, "2026-06-30")], "2026-11-26")).toBeNull();
    expect(thuSapHet([thu(1, "2026-11-20", "2026-12-03")], "2026-11-26")).toBeNull();
  });
});

describe("Buổi học + điểm danh", () => {
  it("tháng 11 từ 16/11 = 15 buổi (4/4/2/5); tháng 12 = 31 buổi (9/9/4/9)", () => {
    const dem = (t: string) => [1, 2, 3, 4].map((m) => buoiTheoLich(MON, t, "2026-11-16").filter((b) => b.mon_id === m).length);
    expect(dem("2026-11")).toEqual([4, 4, 2, 5]);
    expect(dem("2026-12")).toEqual([9, 9, 4, 9]);
  });
  it("mở điểm danh từ 21:45 cho buổi 22:15; quá 48 giờ phải xác nhận", () => {
    const b = lucVN("2026-11-26", "22:15");
    expect(moDiemDanh(b, lucVN("2026-11-26", "21:44"))).toBe(false);
    expect(moDiemDanh(b, lucVN("2026-11-26", "21:45"))).toBe(true);
    expect(qua48Gio(b, lucVN("2026-11-28", "22:15"))).toBe(false);
    expect(qua48Gio(b, lucVN("2026-11-28", "22:16"))).toBe(true);
  });
  it("chuỗi: Có +1, Phép giữ, Vắng về 0, chưa điểm bỏ qua", () => {
    expect(chuoi(["co", "co", "phep", "co", "vang", "co"])).toBe(1);
    expect(chuoi(["co", "phep", null, "co"])).toBe(2);
  });
  it("link record: thêm https://, từ chối chuỗi không phải URL", () => {
    expect(chuanHoaLink("drive.google.com/abc")).toBe("https://drive.google.com/abc");
    expect(chuanHoaLink("không phải link")).toBeNull();
  });
});

describe("Chuẩn hoá", () => {
  it("SĐT", () => {
    expect(chuanHoaSdt("+84 900 000 001")).toBe("0900000001");
    expect(chuanHoaSdt("900000001")).toBe("0900000001");
    expect(sdtHopLe("0200000001")).toBe(false);
  });
  it("Gmail gõ nhầm chỉ gợi ý", () => expect(goiYGmail("ab@gamil.com")).toBe("ab@gmail.com"));
});

describe("Quyền (thuần)", () => {
  const gvAnh: Nguoi = { vai: "giao_vien", id: "x", ten: "GV", monIds: [4] };
  const chu: Nguoi = { vai: "chu", id: "y", ten: "Chủ", monIds: [] };
  const hs: Nguoi = { vai: "hoc_sinh", hocSinhId: 1, ten: "HS" };
  it("GV chỉ môn mình, chủ mọi môn, học sinh không môn nào", () => {
    expect([coMon(gvAnh, 4), coMon(gvAnh, 1), coMon(chu, 1), coMon(hs, 4)]).toEqual([true, false, true, false]);
  });
  it("cột GV không có SĐT/Gmail HS, thông tin PH, tiền, ghi chú riêng (T14, QĐ 14)", () => {
    for (const k of ["sdt_hs", "gmail", "ho_ten_ph", "sdt_ph", "so_du_dau_ky", "ghi_chu_rieng", "ghi_chu"]) {
      expect(k in COT_HS_GV).toBe(false);
      expect(k in COT_HS_CHU).toBe(true);
    }
  });
});
