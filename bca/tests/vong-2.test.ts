// Vòng 2 phần máy chủ (BCA-D1-MC2): T33 việc xong, T34 nghi_luc, hoàn tác chuyển chính thức,
// tạo/ẩn hồ sơ, đổi lịch môn (T8), xoá buổi chưa có dữ liệu. Dữ liệu giả, "hôm nay" = 26/11/2026.
import { beforeAll, describe, expect, it } from "vitest";
import { d2s, lucVN, ngayVN } from "@/lib/ngay";
import { CHU, GV_ANH, cookieNd, db, goi, napSeed, nguoi } from "./chung";
import { homNay } from "@/server/hom-nay";
import type { Nguoi } from "@/lib/quyen";
import { chiTietHocSinh } from "@/server/hoc-sinh";
import { anHocSinh, boAnHocSinh, chuyenChinhThuc, hoanTacChuyenChinhThuc, nghiMon } from "@/server/ghi-danh";
import { doiLichMon } from "@/server/buoi-hoc";
import * as xong from "@/app/api/hom-nay/xong/route";
import * as nghiMonR from "@/app/api/hoc-sinh/[maHs]/nghi-mon/route";
import * as hoanTacCT from "@/app/api/hoc-sinh/[maHs]/chuyen-chinh-thuc/hoan-tac/route";
import * as hocSinhR from "@/app/api/hoc-sinh/route";
import * as hocSinhMaR from "@/app/api/hoc-sinh/[maHs]/route";
import * as anR from "@/app/api/hoc-sinh/[maHs]/an/route";
import * as boAnR from "@/app/api/hoc-sinh/[maHs]/bo-an/route";
import * as monR from "@/app/api/mon/[ma]/route";
import * as buoiIdR from "@/app/api/buoi-hoc/[id]/route";

let chu: Nguoi, cChu: string, cGvAnh: string;
const T22 = lucVN("2026-11-26", "22:00");

beforeAll(async () => {
  await napSeed();
  chu = await nguoi(CHU);
  [cChu, cGvAnh] = await Promise.all([cookieNd(CHU), cookieNd(GV_ANH)]);
});

describe("T33 — đánh dấu xong ở màn Hôm nay", () => {
  const coViec = async (luc: Date, loai: string, khoa: string) => (await homNay(chu, luc)).viec.some((v) => v.loai === loai && v.khoa === khoa);

  it("thử sắp hết: ẩn 3 ngày (26–28/11), thẻ số vẫn đếm 8; bỏ đánh dấu thì hiện lại", async () => {
    const d = await homNay(chu, T22);
    const v = d.viec.find((x) => x.loai === "thu_sap_het" && x.ngay === "2026-11-28")!;
    const r = await goi(xong.POST, { cookie: cChu, body: { loai: "thu_sap_het", khoa: v.khoa } });
    expect(r).toMatchObject({ status: 200, json: { an_den: "2026-11-28" } });
    const sau = await homNay(chu, T22);
    expect(sau.viec.filter((x) => x.loai === "thu_sap_het")).toHaveLength(7);
    expect(sau.so_viec_da_an).toBe(1);
    expect(sau.the_so).toMatchObject({ thu_het_3_ngay: 8 });
    expect(await coViec(lucVN("2026-11-28", "21:00"), "thu_sap_het", v.khoa)).toBe(false);
    expect((await goi(xong.DELETE, { cookie: cChu, method: "DELETE", path: `/api/hom-nay/xong?loai=thu_sap_het&khoa=${v.khoa}` })).status).toBe(200);
    expect(await coViec(T22, "thu_sap_het", v.khoa)).toBe(true);
    expect((await goi(xong.DELETE, { cookie: cChu, method: "DELETE", path: `/api/hom-nay/xong?loai=thu_sap_het&khoa=${v.khoa}` })).status).toBe(404);
  });

  it("buổi chưa điểm danh: ẩn đến hết hôm nay, sáng 27/11 hiện lại", async () => {
    expect((await goi(xong.POST, { cookie: cChu, body: { loai: "buoi_chua_diem_danh", khoa: "anh" } })).json).toMatchObject({ an_den: "2026-11-26" });
    expect(await coViec(T22, "buoi_chua_diem_danh", "anh")).toBe(false);
    expect(await coViec(lucVN("2026-11-27", "09:00"), "buoi_chua_diem_danh", "anh")).toBe(true);
  });

  it("GV không đánh dấu được (403, không ghi gì); loại việc lạ → 400", async () => {
    const trc = await db.viec_xong.count();
    expect((await goi(xong.POST, { cookie: cGvAnh, body: { loai: "buoi_chua_diem_danh", khoa: "anh" } })).status).toBe(403);
    expect((await goi(xong.DELETE, { cookie: cGvAnh, method: "DELETE", path: "/api/hom-nay/xong?loai=buoi_chua_diem_danh&khoa=anh" })).status).toBe(403);
    expect(await db.viec_xong.count()).toBe(trc);
    expect((await goi(xong.POST, { cookie: cChu, body: { loai: "xoa_het", khoa: "x" } })).status).toBe(400);
  });
});

describe("T34 — cột nghi_luc thay cho ghi chú 'Cho nghỉ…'", () => {
  it("ghi chú 'Cho nghỉ…' không còn tác dụng; cột nghi_luc mới quyết định", async () => {
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0061" } }); // thử Toán + Anh 01/11–14/11, chưa xử lý
    await db.ghi_danh.updateMany({ where: { hoc_sinh_id: hs.id }, data: { ghi_chu: "Cho nghỉ đến hết 14/11" } });
    const v = await homNay(chu, T22);
    expect(v.viec.some((x) => x.loai === "het_thu" && x.khoa === "HS0061")).toBe(true);
    await db.ghi_danh.updateMany({ where: { hoc_sinh_id: hs.id }, data: { ghi_chu: null } });
  });
  it("chủ bấm 'Cho nghỉ' cả hai môn cho em hết thử → nghi_luc + nghi_boi, ngày giữ nguyên, hết việc 'Hết thử – hỏi em', tình trạng 'Đã nghỉ'", async () => {
    const r = await goi(nghiMonR.POST, { cookie: cChu, params: { maHs: "HS0062" }, body: { mon: ["toan", "anh"] } });
    expect(r.status).toBe(200);
    const gds = await db.ghi_danh.findMany({ where: { hoc_sinh: { ma_hs: "HS0062" } } });
    expect(gds).toHaveLength(2);
    for (const g of gds) expect(g).toMatchObject({ nghi_boi: (chu as { id: string }).id, ghi_chu: null });
    expect(gds.every((g) => g.nghi_luc && d2s(g.den_ngay!) === "2026-11-15")).toBe(true);
    expect((await homNay(chu, T22)).viec.some((x) => x.loai === "het_thu" && x.khoa === "HS0062")).toBe(false);
    expect((await chiTietHocSinh(chu, "HS0062", T22)).tinh_trang).toBe("Đã nghỉ");
    expect((await goi(nghiMonR.POST, { cookie: cChu, params: { maHs: "HS0062" }, body: { mon: "toan" } })).status).toBe(409);
  });
  it("cho nghỉ em đang học (22:30) → cắt hết hôm nay, có nghi_luc; GV gọi → 403", async () => {
    await nghiMon(chu, "HS0003", "toan", undefined, lucVN("2026-11-26", "22:30"));
    const g = await db.ghi_danh.findFirstOrThrow({ where: { hoc_sinh: { ma_hs: "HS0003" }, mon_id: 1, loai: "chinh_thuc" } });
    expect([d2s(g.den_ngay!), !!g.nghi_luc]).toEqual(["2026-11-26", true]);
    expect((await goi(nghiMonR.POST, { cookie: cGvAnh, params: { maHs: "HS0004" }, body: { mon: "anh" } })).status).toBe(403);
  });
});

// T34 + chuyen-tu-sheet: xem tests/chuyen.test.ts (chạy trên DB rỗng để đối soát số dòng khớp).

describe("Hoàn tác chuyển chính thức (man-hoc-sinh.md 9.2) — chỉ chủ, một lần, 5 giây", () => {
  const gdCua = async (ma: string) =>
    (await db.ghi_danh.findMany({ where: { hoc_sinh: { ma_hs: ma } }, orderBy: { id: "asc" } })).map((g) => `${g.mon_id}:${g.loai}:${d2s(g.tu_ngay)}→${g.den_ngay ? d2s(g.den_ngay) : "…"}${g.huy_luc ? ":huy" : ""}${g.nghi_luc ? ":nghi" : ""}`);
  const giay = (s: number) => new Date(T22.getTime() + s * 1000);

  it("HS0027 thử Toán + Anh lên chính thức từ 26/11 → 55.000đ/buổi/môn; hoàn tác sau 3 giây trả đúng như cũ; lần hai 409", async () => {
    const truoc = await gdCua("HS0027");
    const r = await chuyenChinhThuc(chu, "HS0027", ["toan", "anh"], { tuNgay: "2026-11-26" }, T22);
    expect(r).toMatchObject({ donGiaDuKien: 55_000, soMonChinhThuc: 2 });
    expect(await gdCua("HS0027")).not.toEqual(truoc);
    expect(await hoanTacChuyenChinhThuc(chu, "HS0027", r.nhatKyId, giay(3))).toEqual({ traLai: 4 });
    expect(await gdCua("HS0027")).toEqual(truoc);
    await expect(hoanTacChuyenChinhThuc(chu, "HS0027", r.nhatKyId, giay(4))).rejects.toSatisfy((e) => (e as { ma?: string }).ma === "da_hoan_tac");
  });
  it("kèm 'cho nghỉ các môn thử còn lại': hoàn tác bỏ cả nghi_luc", async () => {
    const truoc = await gdCua("HS0028"); // thử Sử + Địa + Anh
    const r = await chuyenChinhThuc(chu, "HS0028", ["su"], { nghiMonThuConLai: true }, T22);
    expect((await gdCua("HS0028")).filter((x) => x.endsWith(":nghi"))).toHaveLength(2);
    await hoanTacChuyenChinhThuc(chu, "HS0028", r.nhatKyId, giay(2));
    expect(await gdCua("HS0028")).toEqual(truoc);
  });
  it("quá hạn (11 giây) hoặc đã có thay đổi sau → 409, không đổi gì", async () => {
    const r = await chuyenChinhThuc(chu, "HS0029", ["toan"], {}, T22);
    const sau = await gdCua("HS0029");
    await expect(hoanTacChuyenChinhThuc(chu, "HS0029", r.nhatKyId, giay(11))).rejects.toSatisfy((e) => (e as { ma?: string }).ma === "het_gio");
    const r2 = await chuyenChinhThuc(chu, "HS0030", ["anh"], {}, T22);
    await nghiMon(chu, "HS0030", "anh", undefined, giay(1));
    await expect(hoanTacChuyenChinhThuc(chu, "HS0030", r2.nhatKyId, giay(2))).rejects.toSatisfy((e) => (e as { ma?: string }).ma === "da_sua");
    expect(await gdCua("HS0029")).toEqual(sau);
  });
  it("GV gọi API hoàn tác → 403; mã em không khớp lần chuyển → 404", async () => {
    const r = await chuyenChinhThuc(chu, "HS0031", ["anh"], {}, new Date());
    expect((await goi(hoanTacCT.POST, { cookie: cGvAnh, params: { maHs: "HS0031" }, body: { nhatKyId: r.nhatKyId } })).status).toBe(403);
    expect((await goi(hoanTacCT.POST, { cookie: cChu, params: { maHs: "HS0032" }, body: { nhatKyId: r.nhatKyId } })).status).toBe(404);
    expect((await goi(hoanTacCT.POST, { cookie: cChu, params: { maHs: "HS0031" }, body: { nhatKyId: r.nhatKyId } })).status).toBe(200);
  });
});

describe("Tạo hồ sơ tay (chủ) — ghi-danh.md Điều 1–2", () => {
  it("mã mới HS0084 (không cấp lại mã đã dùng), lứa theo ngày tạo, chuẩn hoá SĐT/Gmail, gợi ý Gmail gõ nhầm, cảnh báo trùng SĐT", async () => {
    const r = await goi(hocSinhR.POST, { cookie: cChu, body: { hoTen: "  Trần   Văn  Mới ", sdtHs: "+84 900 000 001", sdtPh: "0910000000", gmail: " Moi.Em@Gamil.com " } });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ma_hs: "HS0084", lua: "L2", sdt_hs: "0900000001", goi_y_gmail: "moi.em@gmail.com", trung_sdt: ["HS0001"] });
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0084" } });
    expect(hs).toMatchObject({ ho_ten: "Trần Văn Mới", gmail: "moi.em@gamil.com", nguon: "Chủ thêm tay" });
    expect(d2s(hs.ngay_tao)).toBe(ngayVN(new Date())); // ngày tạo mặc định = hôm nay giờ VN
    const cu = await goi(hocSinhR.POST, { cookie: cChu, body: { hoTen: "Em lứa 1", ngayTao: "2026-09-30" } });
    expect(cu.json).toMatchObject({ ma_hs: "HS0085", lua: "L1" });
  });
  it("trùng Gmail → 409; thiếu tên → 400; GV → 403 và không tạo gì", async () => {
    expect((await goi(hocSinhR.POST, { cookie: cChu, body: { hoTen: "Trùng", gmail: "HS1@example.com" } })).json).toMatchObject({ ma: "trung_gmail" });
    expect((await goi(hocSinhR.POST, { cookie: cChu, body: { hoTen: "  " } })).status).toBe(400);
    const n = await db.hoc_sinh.count();
    expect((await goi(hocSinhR.POST, { cookie: cGvAnh, body: { hoTen: "GV tạo" } })).status).toBe(403);
    expect(await db.hoc_sinh.count()).toBe(n);
  });
});

describe("Ẩn hồ sơ (chủ, T7 — chỉ ẩn, không xoá cứng)", () => {
  const gdCua = async (ma: string) =>
    (await db.ghi_danh.findMany({ where: { hoc_sinh: { ma_hs: ma } }, orderBy: { id: "asc" } })).map((g) => `${g.mon_id}:${d2s(g.tu_ngay)}→${g.den_ngay ? d2s(g.den_ngay) : "…"}${g.nghi_luc ? ":nghi" : ""}`);
  it("ẩn lúc 21:00 → mọi môn còn mở hết 25/11 + nghi_luc; biến khỏi danh sách và Hôm nay; bỏ ẩn trong ngày → khôi phục", async () => {
    const truoc = await gdCua("HS0033"); // thử Toán + Sử
    const r = await anHocSinh(chu, "HS0033", undefined, lucVN("2026-11-26", "21:00"));
    expect(r.denNgay).toBe("2026-11-25");
    expect(await gdCua("HS0033")).toEqual(truoc.map((x) => x.replace(/→.*$/, "→2026-11-25:nghi")));
    expect((await goi(hocSinhR.GET, { cookie: cChu })).json.hoc_sinh.some((h: { ma_hs: string }) => h.ma_hs === "HS0033")).toBe(false);
    expect(JSON.stringify((await homNay(chu, T22)).viec)).not.toContain("HS0033");
    await expect(anHocSinh(chu, "HS0033", undefined, T22)).rejects.toSatisfy((e) => (e as { status?: number }).status === 409);
    expect(await boAnHocSinh(chu, "HS0033", lucVN("2026-11-26", "21:05"))).toMatchObject({ khoi_phuc_ghi_danh: true });
    expect(await gdCua("HS0033")).toEqual(truoc);
  });
  it("bỏ ẩn sang hôm sau → chỉ hiện lại hồ sơ, ghi danh vẫn dừng (chủ thêm môn nếu em học lại)", async () => {
    await goi(anR.POST, { cookie: cChu, params: { maHs: "HS0034" }, body: {} });
    const sau = await gdCua("HS0034");
    expect(await boAnHocSinh(chu, "HS0034", new Date(Date.now() + 86400_000))).toMatchObject({ khoi_phuc_ghi_danh: false });
    expect(await gdCua("HS0034")).toEqual(sau);
    expect((await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0034" } })).an_luc).toBeNull();
  });
  it("GV ẩn/bỏ ẩn → 403; không có route xoá cứng hồ sơ", async () => {
    expect((await goi(anR.POST, { cookie: cGvAnh, params: { maHs: "HS0035" }, body: {} })).status).toBe(403);
    expect((await goi(boAnR.POST, { cookie: cGvAnh, params: { maHs: "HS0070" }, body: {} })).status).toBe(403);
    expect(Object.keys(hocSinhMaR)).not.toContain("DELETE");
  });
});

describe("Đổi lịch môn (T8, buoi-hoc.md Điều 4)", () => {
  const buoiThang = async (mon: number, thang: string) =>
    (await db.buoi_hoc.findMany({ where: { mon_id: mon, ngay: { gte: new Date(`${thang}-01`), lt: new Date(thang === "2026-12" ? "2027-01-01" : "2026-12-01") } }, orderBy: { bat_dau_luc: "asc" } }));

  it("Địa T6 → T5 từ 01/12: 4 buổi T6 (04, 11, 18, 25) xoá, sinh 5 buổi T5 (03, 10, 17, 24, 31); 27/11 giữ; cảnh báo trùng Anh", async () => {
    const r = await goi(monR.PATCH, { cookie: cChu, method: "PATCH", params: { ma: "dia" }, body: { thu: [4], tuNgay: "2026-12-01" } });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ xoa: 4, tao: 5, giu: [] });
    expect((await buoiThang(3, "2026-12")).map((b) => d2s(b.ngay))).toEqual(["2026-12-03", "2026-12-10", "2026-12-17", "2026-12-24", "2026-12-31"]);
    expect((await buoiThang(3, "2026-11")).map((b) => d2s(b.ngay))).toContain("2026-11-27");
    expect(r.json.canh_bao).toHaveLength(1);
    expect(r.json.canh_bao[0]).toMatch(/^Trùng giờ Anh T5 22:15, \d+ em học cả hai môn$/);
    expect((await db.mon.findUniqueOrThrow({ where: { ma: "dia" } })).thu).toEqual([4]);
  });
  it("Sử 22:15 → 21:00 từ 01/12: buổi có nội dung (02/12) và đã huỷ (09/12) giữ nguyên + báo chủ; 7 buổi còn lại sinh lại lúc 21:00; học bù 13/12 không đụng", async () => {
    const b02 = (await buoiThang(2, "2026-12")).find((b) => d2s(b.ngay) === "2026-12-02")!;
    await db.buoi_hoc.update({ where: { id: b02.id }, data: { noi_dung: "Bài 1 (giả)" } });
    const r = await doiLichMon(chu, "su", { gio: "21:00", tuNgay: "2026-12-01" }, T22);
    expect(r).toMatchObject({ xoa: 7, tao: 7 });
    expect(r.giu.map((g) => [g.ngay, g.gio, g.du_lieu])).toEqual([["2026-12-02", "22:15", ["noi_dung"]], ["2026-12-09", "22:15", ["da_huy", "co_buoi_bu"]]]);
    const ds = (await buoiThang(2, "2026-12")).map((b) => `${d2s(b.ngay)} ${b.loai} ${b.bat_dau_luc.toISOString().slice(11, 16)}`);
    expect(ds).toHaveLength(10); // 9 buổi lịch (2 giữ + 7 mới) + 1 học bù, không ngày nào 2 buổi lịch
    expect(ds.filter((x) => x.endsWith("14:00"))).toHaveLength(7); // 21:00 giờ VN = 14:00Z
  });
  it("ngày hiệu lực đã qua → 400; GV → 403", async () => {
    await expect(doiLichMon(chu, "toan", { gio: "21:00", tuNgay: "2026-11-20" }, T22)).rejects.toSatisfy((e) => (e as { status?: number }).status === 400);
    expect((await goi(monR.PATCH, { cookie: cGvAnh, method: "PATCH", params: { ma: "anh" }, body: { gio: "21:00" } })).status).toBe(403);
  });
});

describe("Xoá buổi chưa có dữ liệu (chủ, buoi-hoc.md 6.3)", () => {
  const id = async (mon: number, ngay: string, gio = "22:15") => String((await db.buoi_hoc.findUniqueOrThrow({ where: { mon_id_bat_dau_luc: { mon_id: mon, bat_dau_luc: lucVN(ngay, gio) } } })).id);
  it("buổi Toán 01/12 trống → xoá được, có nhật ký; buổi có điểm danh (17/11) hoặc đã huỷ có buổi bù → 409", async () => {
    const t01 = await id(1, "2026-12-01");
    expect((await goi(buoiIdR.DELETE, { cookie: cChu, method: "DELETE", params: { id: t01 } })).status).toBe(200);
    expect(await db.buoi_hoc.findUnique({ where: { id: Number(t01) } })).toBeNull();
    expect(await db.nhat_ky.count({ where: { hanh_dong: "xoa_buoi", doi_tuong_id: t01 } })).toBe(1);
    expect((await goi(buoiIdR.DELETE, { cookie: cChu, method: "DELETE", params: { id: await id(1, "2026-11-17") } })).json).toMatchObject({ ma: "co_du_lieu" });
    const huy = await goi(buoiIdR.DELETE, { cookie: cChu, method: "DELETE", params: { id: await id(2, "2026-12-09") } });
    expect(huy).toMatchObject({ status: 409, json: { ma: "co_du_lieu" } });
    expect(huy.json.loi).toContain("da_huy, co_buoi_bu");
    expect((await goi(buoiIdR.DELETE, { cookie: cChu, method: "DELETE", params: { id: t01 } })).status).toBe(404);
  });
  it("GV xoá buổi môn mình → 403, buổi còn nguyên", async () => {
    const a = await id(4, "2026-12-03");
    expect((await goi(buoiIdR.DELETE, { cookie: cGvAnh, method: "DELETE", params: { id: a } })).status).toBe(403);
    expect(await db.buoi_hoc.findUnique({ where: { id: Number(a) } })).not.toBeNull();
  });
});
