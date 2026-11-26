// Vòng 3 phần máy chủ (BCA-D1-MC3, theo phiếu rà soát BCA-D1-RS-MC). Dữ liệu giả, "hôm nay" = 26/11/2026.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { lucVN, s2d } from "@/lib/ngay";
import type { Nguoi } from "@/lib/quyen";
import { CHU, GV_ANH, cookieHs, cookieNd, db, goi, napSeed, nguoi } from "./chung";
import { TEN_COOKIE, kyPhien } from "@/server/token";
import { chuyenChinhThuc, giaHanThu, hoanTacChuyenChinhThuc, hoanTacGiaHan, nghiMon } from "@/server/ghi-danh";
import { danhTatCaCoMat, datDiemDanh, hoanTacTatCa } from "@/server/diem-danh";
import { doiLichMon } from "@/server/buoi-hoc";
import * as devLogin from "@/app/api/dev/dang-nhap/route";
import * as toi from "@/app/api/toi/route";
import * as thuHoi from "@/app/api/nguoi-dung/[id]/thu-hoi-phien/route";
import * as boHuy from "@/app/api/buoi-hoc/[id]/bo-huy/route";
import * as huy from "@/app/api/buoi-hoc/[id]/huy/route";
import * as buoiIdR from "@/app/api/buoi-hoc/[id]/route";
import * as buoiHoc from "@/app/api/buoi-hoc/route";
import * as hocBu from "@/app/api/buoi-hoc/hoc-bu/route";
import * as giaHanR from "@/app/api/gia-han/route";
import * as giaHanHT from "@/app/api/gia-han/hoan-tac/route";
import * as ddHoanTac from "@/app/api/diem-danh/[buoiId]/hoan-tac/route";
import * as diemDanh from "@/app/api/diem-danh/[buoiId]/route";
import * as nhatKy from "@/app/api/nhat-ky/route";
import * as hsToi from "@/app/api/hs/toi/route";
import * as hsBuoi from "@/app/api/hs/buoi/[id]/route";
import * as don from "@/app/api/don/route";
import * as hocSinhR from "@/app/api/hoc-sinh/route";
import * as monR from "@/app/api/mon/[ma]/route";
import * as hocSinhMaR from "@/app/api/hoc-sinh/[maHs]/route";
import * as sinhR from "@/app/api/buoi-hoc/sinh/route";
import * as homNayR from "@/app/api/hom-nay/route";
import { demHocSinhDangHien } from "@/server/hoc-sinh";

let chu: Nguoi, gvAnh: Nguoi, cChu: string, cGvAnh: string;
const T22 = lucVN("2026-11-26", "22:00");
const giay = (goc: Date, s: number) => new Date(goc.getTime() + s * 1000);
const ma = (e: unknown) => (e as { ma?: string }).ma;
const buoi = async (mon: number, ngay: string) => (await db.buoi_hoc.findUniqueOrThrow({ where: { mon_id_bat_dau_luc: { mon_id: mon, bat_dau_luc: lucVN(ngay, "22:15") } } })).id;
const hsId = async (m: string) => (await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: m } })).id;
const denCua = async (m: string, mon: number) =>
  (await db.ghi_danh.findMany({ where: { hoc_sinh_id: await hsId(m), mon_id: mon }, orderBy: { id: "asc" } })).map((g) => `${g.tu_ngay.toISOString().slice(0, 10)}→${g.den_ngay?.toISOString().slice(0, 10)}${g.nghi_luc ? ":nghi" : ""}`);

beforeAll(async () => {
  await napSeed();
  [chu, gvAnh] = await Promise.all([nguoi(CHU), nguoi(GV_ANH)]);
  [cChu, cGvAnh] = await Promise.all([cookieNd(CHU), cookieNd(GV_ANH)]);
});

describe("P2-1 — đăng nhập thử theo môi trường (T40); khoá ký bắt buộc ngoài máy cục bộ", () => {
  const goc = { ...process.env };
  afterEach(() => {
    for (const k of ["BCA_DEV_LOGIN", "VERCEL_ENV", "BCA_SESSION_SECRET"]) if (goc[k] === undefined) delete process.env[k]; else process.env[k] = goc[k];
  });
  const dangNhap = () => devLogin.POST(new Request("http://x/api/dev/dang-nhap", { method: "POST", body: '{"vai":"chu"}' }));
  const moiTruong = (vercel: string | undefined, dev: string | undefined) => {
    if (vercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = vercel;
    if (dev === undefined) delete process.env.BCA_DEV_LOGIN; else process.env.BCA_DEV_LOGIN = dev;
  };

  it("production → 404 dù BCA_DEV_LOGIN=1 và DB có dấu giả", async () => {
    moiTruong("production", "1");
    expect(await db.cai_dat.count({ where: { khoa: "DU_LIEU_GIA" } })).toBe(1); // seed-gia ghi dấu
    expect((await dangNhap()).status).toBe(404);
  });
  it("preview + DB KHÔNG có dấu DU_LIEU_GIA (DB thật) → 404; có dấu → 200", async () => {
    moiTruong("preview", "1");
    await db.cai_dat.delete({ where: { khoa: "DU_LIEU_GIA" } });
    expect((await dangNhap()).status).toBe(404);
    await db.cai_dat.create({ data: { khoa: "DU_LIEU_GIA", gia_tri: true } });
    const r = await dangNhap();
    expect(r.status).toBe(200);
    expect((await goi(toi.GET, { cookie: r.headers.get("set-cookie")!.split(";")[0] })).json).toMatchObject({ vai: "chu" });
  });
  it("preview không đặt BCA_DEV_LOGIN → 404; máy cục bộ (không VERCEL_ENV) + BCA_DEV_LOGIN=1 → 200 kể cả không có dấu", async () => {
    moiTruong("preview", undefined);
    expect((await dangNhap()).status).toBe(404);
    moiTruong(undefined, "1");
    await db.cai_dat.delete({ where: { khoa: "DU_LIEU_GIA" } });
    expect((await dangNhap()).status).toBe(200);
    await db.cai_dat.create({ data: { khoa: "DU_LIEU_GIA", gia_tri: true } });
  });
  it("thiếu BCA_SESSION_SECRET ngoài máy cục bộ → lỗi rõ (ký và đọc phiên), không dùng khoá mặc định; cục bộ thì chạy", async () => {
    const cookie = cChu;
    delete process.env.BCA_SESSION_SECRET;
    for (const env of ["preview", "production"]) {
      moiTruong(env, "1");
      await expect(kyPhien({ sub: "x", vai: "nd", bd: 0 })).rejects.toThrow(/BCA_SESSION_SECRET/);
      await expect(goi(toi.GET, { cookie })).rejects.toThrow(/BCA_SESSION_SECRET/);
    }
    moiTruong(undefined, undefined);
    await expect(kyPhien({ sub: "x", vai: "nd", bd: 0 })).resolves.toBeTypeOf("string");
  });
});

describe("P2-6 — quyền các route còn thiếu test", () => {
  it("GV gọi thu-hoi-phien, bo-huy, gia-han/hoan-tac → 403 và không đổi gì", async () => {
    const nd = await db.nguoi_dung.findUniqueOrThrow({ where: { gmail: CHU } });
    const idHuy = await buoi(2, "2026-12-09"); // Sử 09/12 đã huỷ
    const gh = await giaHanThu(chu, ["HS0022"], { soNgay: 2 }, "test quyền", new Date());
    const r = await Promise.all([
      goi(thuHoi.POST, { cookie: cGvAnh, params: { id: nd.id }, body: { khoaTaiKhoan: true } }),
      goi(boHuy.POST, { cookie: cGvAnh, params: { id: String(idHuy) }, body: {} }),
      goi(giaHanHT.POST, { cookie: cGvAnh, body: { nhatKyId: gh.nhatKyId } }),
      goi(giaHanHT.POST, { cookie: await cookieHs("HS0022"), body: { nhatKyId: gh.nhatKyId } }),
    ]);
    expect(r.map((x) => x.status)).toEqual([403, 403, 403, 403]);
    expect((await db.nguoi_dung.findUniqueOrThrow({ where: { id: nd.id } })).khoa_luc).toBeNull();
    expect((await db.buoi_hoc.findUniqueOrThrow({ where: { id: idHuy } })).trang_thai).toBe("huy");
    expect((await goi(giaHanHT.POST, { cookie: cChu, body: { nhatKyId: gh.nhatKyId } })).status).toBe(200); // chủ, trong 10 giây
  });
  it("/api/nhat-ky: GV chỉ thấy dòng của mình; học sinh 403; chủ thấy cả hai", async () => {
    await goi(buoiIdR.PATCH, { cookie: cGvAnh, method: "PATCH", params: { id: String(await buoi(4, "2026-11-19")) }, body: { noiDung: "Unit 6" } });
    const gv = await goi(nhatKy.GET, { cookie: cGvAnh, path: "/api/nhat-ky?gioi_han=500" });
    expect(gv.status).toBe(200);
    expect(gv.json.length).toBeGreaterThan(0);
    expect(gv.json.every((x: { nguoi_dung_id: string }) => x.nguoi_dung_id === (gvAnh as { id: string }).id)).toBe(true);
    const c = await goi(nhatKy.GET, { cookie: cChu, path: "/api/nhat-ky?gioi_han=500" });
    expect(c.json.some((x: { nguoi_dung_id: string }) => x.nguoi_dung_id === (chu as { id: string }).id)).toBe(true);
    expect((await goi(nhatKy.GET, { cookie: await cookieHs("HS0001") })).status).toBe(403);
  });
  it("chủ / GV gọi /api/hs/* → 403 (khu học sinh chỉ cho học sinh)", async () => {
    const id = String(await buoi(1, "2026-11-17"));
    for (const cookie of [cChu, cGvAnh]) {
      expect((await goi(hsToi.GET, { cookie })).status).toBe(403);
      expect((await goi(hsBuoi.GET, { cookie, params: { id } })).status).toBe(403);
    }
  });
});

describe("P2-2 — hạn hoàn tác 10 giây ở máy chủ, tính từ lúc thao tác gốc", () => {
  it("hoàn tác gia hạn sau 11 giây → 409 het_gio qua API, ghi danh giữ nguyên", async () => {
    const gh = await giaHanThu(chu, ["HS0024"], { soNgay: 3 }, "quá hạn", giay(new Date(), -11));
    const truoc = await denCua("HS0024", 4);
    expect(truoc).toHaveLength(1);
    expect(await goi(giaHanHT.POST, { cookie: cChu, body: { nhatKyId: gh.nhatKyId } })).toMatchObject({ status: 409, json: { ma: "het_gio" } });
    expect(await denCua("HS0024", 4)).toEqual(truoc);
  });
  it("hoàn tác gia hạn mà đoạn sắp bị cắt đã có điểm danh → 409 co_diem_danh, không đổi gì", async () => {
    const gh = await giaHanThu(chu, ["HS0021"], { soNgay: 7 }, "có điểm danh", T22); // Toán + Sử 28/11 → 05/12
    const sau = await denCua("HS0021", 1);
    await db.diem_danh.create({ data: { buoi_id: await buoi(1, "2026-12-01"), hoc_sinh_id: await hsId("HS0021"), trang_thai: "co", ghi_luc: T22 } });
    await expect(hoanTacGiaHan(chu, gh.nhatKyId, giay(T22, 3))).rejects.toSatisfy((e) => ma(e) === "co_diem_danh");
    expect(await denCua("HS0021", 1)).toEqual(sau);
  });
  it("hoàn tác 'đánh tất cả' sau 11 giây → 409 het_gio, điểm danh giữ nguyên; `luc` máy khách tự bịa → 404 qua API", async () => {
    const id = await buoi(4, "2026-11-26");
    const lucDanh = lucVN("2026-11-26", "22:20");
    const r = await danhTatCaCoMat(gvAnh, id, {}, lucDanh);
    const n = await db.diem_danh.count({ where: { buoi_id: id } });
    await expect(hoanTacTatCa(gvAnh, id, r.luc, giay(lucDanh, 11))).rejects.toSatisfy((e) => ma(e) === "het_gio");
    expect(await db.diem_danh.count({ where: { buoi_id: id } })).toBe(n);
    expect((await goi(ddHoanTac.POST, { cookie: cGvAnh, params: { buoiId: String(id) }, body: { ids: r.ids, luc: new Date().toISOString() } })).status).toBe(404);
    expect(await hoanTacTatCa(gvAnh, id, r.luc, giay(lucDanh, 10))).toMatchObject({ so_tra_lai: n }); // đúng 10 giây: còn hạn
  });
  it("P3-3: hai lần hoàn tác cùng lúc → một lần chạy, lần kia 409", async () => {
    const gh = await giaHanThu(chu, ["HS0026"], { soNgay: 3 }, "đồng thời", T22);
    const r = await Promise.allSettled([hoanTacGiaHan(chu, gh.nhatKyId, giay(T22, 2)), hoanTacGiaHan(chu, gh.nhatKyId, giay(T22, 2))]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(r.map((x) => (x.status === "rejected" ? (x.reason as { status?: number }).status : 200)).sort()).toEqual([200, 409]);
    const ct = await chuyenChinhThuc(chu, "HS0027", ["anh"], {}, T22);
    const r2 = await Promise.allSettled([hoanTacChuyenChinhThuc(chu, "HS0027", ct.nhatKyId, giay(T22, 2)), hoanTacChuyenChinhThuc(chu, "HS0027", ct.nhatKyId, giay(T22, 2))]);
    expect(r2.map((x) => (x.status === "rejected" ? (x.reason as { status?: number }).status : 200)).sort()).toEqual([200, 409]);
  });
});

describe("P2-3 — gia hạn bỏ qua môn chủ đã cho nghỉ (T4 + T34)", () => {
  it("HS0035 thử Toán + Anh đến 01/12; 22:30 chủ cho nghỉ Anh (hết 26/11) → gia hạn +7 chỉ dời Toán tới 08/12", async () => {
    await nghiMon(chu, "HS0035", "anh", undefined, lucVN("2026-11-26", "22:30"));
    expect(await denCua("HS0035", 4)).toEqual(["2026-11-18→2026-11-26:nghi"]);
    const r = await giaHanThu(chu, ["HS0035"], { soNgay: 7 }, "chỉ Toán", lucVN("2026-11-26", "22:31"));
    expect(r.ketQua).toEqual([{ ma_hs: "HS0035", den_moi: "2026-12-08", doan_moi: false }]);
    expect(await denCua("HS0035", 1)).toEqual(["2026-11-18→2026-12-08"]);
    expect(await denCua("HS0035", 4)).toEqual(["2026-11-18→2026-11-26:nghi"]);
  });
  it("HS0062 hết thử Toán + Anh 15/11, chủ cho nghỉ Anh → gia hạn tạo đoạn mới chỉ Toán", async () => {
    await nghiMon(chu, "HS0062", "anh", undefined, T22);
    await giaHanThu(chu, ["HS0062"], { soNgay: 7 }, "chỉ Toán", T22);
    expect(await denCua("HS0062", 1)).toEqual(["2026-11-02→2026-11-15", "2026-11-26→2026-12-02"]);
    expect(await denCua("HS0062", 4)).toEqual(["2026-11-02→2026-11-15:nghi"]);
  });
  it("P3-4: ngày hết mới không sau ngày hết hiện tại → 409", async () => {
    expect((await goi(giaHanR.POST, { cookie: cChu, body: { maHs: ["HS0036"], denNgay: "2026-11-26", lyDo: "x" } })).status).toBe(409);
  });
});

describe("P3 — đầu vào sai trả 400/404/409, không 500", () => {
  it("cookie có % hỏng → 401; tháng sai → 400; ngày không có thật → 400; trạng thái đơn lạ → 400", async () => {
    expect((await goi(toi.GET, { cookie: `${TEN_COOKIE}=%E0%A4%A` })).status).toBe(401);
    expect((await goi(buoiHoc.GET, { cookie: cChu, path: "/api/buoi-hoc?thang=2026-13" })).status).toBe(400);
    expect((await goi(hocBu.POST, { cookie: cChu, body: { mon: "su", ngay: "2026-02-30" } })).status).toBe(400);
    expect((await goi(giaHanR.POST, { cookie: cChu, body: { maHs: ["HS0036"], denNgay: "2026-12-32", lyDo: "x" } })).status).toBe(400);
    expect((await goi(don.GET, { cookie: cChu, path: "/api/don?trang_thai=xoa_het" })).status).toBe(400);
  });
  it("id NaN / vượt int32 / số lẻ → 400; id người dùng không phải uuid → 404", async () => {
    for (const id of ["abc", "9999999999", "1.5", ""]) expect((await goi(diemDanh.GET, { cookie: cChu, params: { buoiId: id } })).status).toBe(400);
    expect((await goi(hocBu.POST, { cookie: cChu, body: { mon: "su", ngay: "2026-12-20", buChoBuoiId: "x" } })).status).toBe(400);
    expect((await goi(huy.POST, { cookie: cChu, params: { id: "2147483648" }, body: { lyDo: "x" } })).status).toBe(400);
    expect((await goi(thuHoi.POST, { cookie: cChu, params: { id: "khong-phai-uuid" }, body: {} })).status).toBe(404);
  });
  it("P3-12: hai lần tạo hồ sơ cùng Gmail cùng lúc → một 200, một 409", async () => {
    const body = { hoTen: "Em Đồng Thời", gmail: "dong.thoi@example.com" };
    const r = await Promise.all([goi(hocSinhR.POST, { cookie: cChu, body }), goi(hocSinhR.POST, { cookie: cChu, body })]);
    expect(r.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(await db.hoc_sinh.count({ where: { gmail: "dong.thoi@example.com" } })).toBe(1);
  });
  it("P3-6: hai người điểm hai em cuối cùng lúc → buổi vẫn được đánh dấu đã điểm danh xong", async () => {
    const id = await buoi(4, "2026-11-26");
    const luc = lucVN("2026-11-26", "22:20");
    const ds = (await import("@/server/diem-danh")).chiTietDiemDanh;
    const em = (await ds(gvAnh, id, luc)).em.map((e) => e.hoc_sinh_id);
    await db.diem_danh.createMany({ data: em.slice(2).map((hoc_sinh_id) => ({ buoi_id: id, hoc_sinh_id, trang_thai: "co" as const, ghi_luc: luc })) });
    await Promise.all([datDiemDanh(gvAnh, id, em[0], { trangThai: "co" }, luc), datDiemDanh(chu, id, em[1], { trangThai: "vang" }, luc)]);
    expect((await db.buoi_hoc.findUniqueOrThrow({ where: { id } })).da_diem_danh_luc).not.toBeNull();
  });
  it("P3-11: đổi lịch từ tháng 02/2027 khi tháng 01/2027 chưa sinh buổi → 400 thang_chua_sinh, lịch môn giữ nguyên", async () => {
    const r = await goi(monR.PATCH, { cookie: cChu, method: "PATCH", params: { ma: "dia" }, body: { thu: [4], tuNgay: "2027-02-01" } });
    expect(r).toMatchObject({ status: 400, json: { ma: "thang_chua_sinh" } });
    expect((await db.mon.findUniqueOrThrow({ where: { ma: "dia" } })).thu).toEqual([5]);
    await expect(doiLichMon(chu, "dia", { thu: [4], tuNgay: "2027-01-01" }, T22)).resolves.toMatchObject({ tu_ngay: "2027-01-01" }); // ngày 1 của tháng chưa sinh: được
  });
  it("P3-5: đơn giá trả về khi chuyển chính thức ghi rõ là ước tính", async () => {
    expect(await chuyenChinhThuc(chu, "HS0037", ["anh"], {}, T22)).toMatchObject({ donGiaDuKien: expect.any(Number), donGiaLaUocTinh: true });
  });
});

describe("Bổ sung cho phòng Giao diện (Điều hành, BCA-D1-MC3)", () => {
  it("1. ghi chú nội bộ buổi: chủ + GV môn sửa được, GV môn khác 403, học sinh không thấy", async () => {
    const id = String(await buoi(4, "2026-11-19"));
    expect(await goi(buoiIdR.PATCH, { cookie: cGvAnh, method: "PATCH", params: { id }, body: { ghiChu: "Lớp ồn, nhắc mic" } })).toMatchObject({ status: 200, json: { ghi_chu: "Lớp ồn, nhắc mic" } });
    expect((await goi(buoiIdR.PATCH, { cookie: cGvAnh, method: "PATCH", params: { id: String(await buoi(1, "2026-11-17")) }, body: { ghiChu: "x" } })).status).toBe(403);
    expect((await goi(buoiIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id }, body: { ghiChu: "x".repeat(501) } })).status).toBe(400);
    const hs = await cookieHs("HS0002"); // chính thức Anh
    expect(JSON.stringify((await goi(hsToi.GET, { cookie: hs })).json)).not.toContain("Lớp ồn");
    expect(JSON.stringify((await goi(hsBuoi.GET, { cookie: hs, params: { id } })).json)).not.toContain("Lớp ồn");
  });
  it("2. sửa ghi chú hồ sơ (ghi_chu, ghi_chu_rieng): chỉ chủ, có nhật ký; GV/HS 403 và không đổi", async () => {
    const r = await goi(hocSinhMaR.PATCH, { cookie: cChu, method: "PATCH", params: { maHs: "HS0002" }, body: { ghiChu: " Hay quên bài ", ghiChuRieng: "PH khó tính" } });
    expect(r).toMatchObject({ status: 200, json: { ghi_chu: "Hay quên bài", ghi_chu_rieng: "PH khó tính" } });
    expect(await db.nhat_ky.count({ where: { hanh_dong: "sua_ghi_chu_hoc_sinh", doi_tuong_id: "HS0002" } })).toBe(1);
    for (const cookie of [cGvAnh, await cookieHs("HS0002")])
      expect((await goi(hocSinhMaR.PATCH, { cookie, method: "PATCH", params: { maHs: "HS0002" }, body: { ghiChuRieng: "đổi" } })).status).toBe(403);
    expect((await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } })).ghi_chu_rieng).toBe("PH khó tính");
    expect((await goi(hocSinhMaR.PATCH, { cookie: cChu, method: "PATCH", params: { maHs: "HS9999" }, body: { ghiChu: "x" } })).status).toBe(404);
    expect((await goi(hocSinhMaR.PATCH, { cookie: cChu, method: "PATCH", params: { maHs: "HS0002" }, body: {} })).status).toBe(400);
  });
  it("3. xem trước sinh buổi: Toán tháng 12 đã có đủ (se_tao 0), tháng 03/2027 Toán 9 buổi; không ghi gì; GV 403", async () => {
    const dem = await db.buoi_hoc.count();
    const t12 = await goi(sinhR.GET, { cookie: cChu, path: "/api/buoi-hoc/sinh?thang=2026-12&xem=1" });
    expect(t12.status).toBe(200); // (Địa đã đổi lịch sang T5 ở test trên ⇒ tháng 12 Địa có buổi T5 "sẽ tạo"; Toán đủ)
    expect(t12.json.mon.find((m: { ma: string }) => m.ma === "toan")).toEqual({ ma: "toan", ten: "Toán", theo_lich: 9, da_co: 9, se_tao: 0 });
    const t3 = await goi(sinhR.GET, { cookie: cChu, path: "/api/buoi-hoc/sinh?thang=2027-03&xem=1" });
    expect(t3.json.mon.find((m: { ma: string }) => m.ma === "toan")).toEqual({ ma: "toan", ten: "Toán", theo_lich: 9, da_co: 0, se_tao: 9 });
    expect(await db.buoi_hoc.count()).toBe(dem);
    expect((await goi(sinhR.GET, { cookie: cGvAnh, path: "/api/buoi-hoc/sinh?thang=2027-03&xem=1" })).status).toBe(403);
    expect((await goi(sinhR.GET, { cookie: cChu, path: "/api/buoi-hoc/sinh?thang=3-2027" })).status).toBe(400);
  });
  it("4. Hôm nay + danh sách buổi trả tên đầy đủ, link Meet, tên GV phụ trách; GV chỉ môn mình", async () => {
    await db.mon.update({ where: { ma: "anh" }, data: { link_meet: "https://meet.google.com/gia-anh" } });
    const b = await goi(buoiHoc.GET, { cookie: cGvAnh, path: "/api/buoi-hoc?thang=2026-11" });
    expect(b.json.buoi[0].mon).toEqual({ ma: "anh", ten: "Anh", ten_day_du: "Tiếng Anh", link_meet: "https://meet.google.com/gia-anh", giao_vien: ["GV Anh (thử)"] });
    const h = await goi(homNayR.GET, { cookie: cGvAnh });
    expect(h.json.the_so.si_so.map((x: { mon: { ma: string } }) => x.mon)).toEqual([{ ma: "anh", ten: "Anh", ten_day_du: "Tiếng Anh", link_meet: "https://meet.google.com/gia-anh", giao_vien: ["GV Anh (thử)"] }]);
    const c = await goi(buoiHoc.GET, { cookie: cChu, path: "/api/buoi-hoc?thang=2026-11&mon=toan" });
    expect(c.json.buoi[0].mon).toMatchObject({ ma: "toan", giao_vien: ["GV Toán (thử)"] });
    expect(JSON.stringify(c.json)).not.toContain("@bca.invalid"); // không lộ Gmail giáo viên
  });
  it("5. đếm học sinh đang hiện: chủ 69 (70 − 1 ẩn) cộng hồ sơ tạo thêm; GV Anh = số dòng danh sách của GV; HS 403", async () => {
    const dsGv = await goi(hocSinhR.GET, { cookie: cGvAnh });
    expect(await demHocSinhDangHien(gvAnh)).toBe(dsGv.json.hoc_sinh.length);
    const dsChu = await goi(hocSinhR.GET, { cookie: cChu });
    expect(await demHocSinhDangHien(chu)).toBe(dsChu.json.hoc_sinh.length);
    await expect(demHocSinhDangHien({ vai: "hoc_sinh", hocSinhId: 1, ten: "" })).rejects.toThrow();
  });
  it("6. chi tiết học sinh: chủ có caiDat đơn giá thật từ cai_dat; GV không có", async () => {
    await db.cai_dat.update({ where: { khoa: "GIA_1_MON" }, data: { gia_tri: 70000 } });
    expect((await goi(hocSinhMaR.GET, { cookie: cChu, params: { maHs: "HS0002" } })).json.caiDat).toEqual({ GIA_1_MON: 70_000, GIA_TU_2_MON: 55_000 });
    await db.cai_dat.update({ where: { khoa: "GIA_1_MON" }, data: { gia_tri: 65000 } });
    expect((await goi(hocSinhMaR.GET, { cookie: cGvAnh, params: { maHs: "HS0002" } })).json).not.toHaveProperty("caiDat");
  });
});

describe("Phiên ký đúng vẫn vào được sau các thay đổi khoá ký", () => {
  it("cookie ký bằng BCA_SESSION_SECRET hiện tại → 200", async () => {
    const nd = await db.nguoi_dung.findUniqueOrThrow({ where: { gmail: CHU } });
    expect((await goi(toi.GET, { cookie: `${TEN_COOKIE}=${await kyPhien({ sub: nd.id, vai: "nd", bd: Math.floor(Date.now() / 1000) })}` })).status).toBe(200);
    expect(s2d("2026-11-26")).toBeInstanceOf(Date);
  });
});
