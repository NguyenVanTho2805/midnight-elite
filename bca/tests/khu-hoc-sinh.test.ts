// Khu học sinh (Đợt 2, BCA-D2-HS): dữ liệu cuaToi cho màn thật. Dữ liệu giả, "bây giờ" = 22:00 26/11/2026.
import { beforeAll, describe, expect, it } from "vitest";
import { lucVN } from "@/lib/ngay";
import { chuoiDiHoc, cuaToi } from "@/server/hs";
import * as hsToi from "@/app/api/hs/toi/route";
import { GV_TOAN, cookieNd, db, goi, napSeed, nguoiHs } from "./chung";

const T22 = lucVN("2026-11-26", "22:00");
type D = Awaited<ReturnType<typeof cuaToi>>;
let tatCa: { ma: string; d: D }[];
const tim = (f: (d: D) => boolean) => tatCa.find((x) => f(x.d))!;

beforeAll(async () => {
  await napSeed();
  await db.mon.update({ where: { ma: "toan" }, data: { link_meet: "https://meet.google.com/aaa-bbbb-ccc", link_zalo: "https://zalo.me/g/toan" } });
  await db.cai_dat.createMany({ data: [{ khoa: "ZALO_HOC_THU", gia_tri: "https://zalo.me/g/hocthu" }, { khoa: "ZALO_CHUNG", gia_tri: "nhắn chị Thu" }] });
  const hs = await db.hoc_sinh.findMany({ where: { an_luc: null }, select: { ma_hs: true }, orderBy: { ma_hs: "asc" } });
  tatCa = await Promise.all(hs.map(async ({ ma_hs }) => ({ ma: ma_hs, d: await cuaToi(await nguoiHs(ma_hs), T22) })));
});

describe("cuaToi — dữ liệu cho màn học sinh", () => {
  it("em thử còn hạn (HS0021): trạng thái dang_thu, ngày thử 12/14, còn 2 ngày, hết 28/11; link Meet + Zalo môn còn hạn; Zalo học thử", async () => {
    const d = tatCa.find((x) => x.ma === "HS0021")!.d;
    expect(d.trang_thai).toBe("dang_thu");
    expect(d.thu).toEqual({ tu: "2026-11-15", den: "2026-11-28", con_ngay: 2, ngay_thu: 12, tong_ngay: 14 });
    const toan = d.mon.find((m) => m.ma === "toan")!;
    expect(toan).toMatchObject({ ten_day_du: "Toán", o: "thu", con_han: true, link_meet: "https://meet.google.com/aaa-bbbb-ccc", link_zalo: "https://zalo.me/g/toan", gio: "22:15", thu: [2, 6] });
    expect(d.lien_he).toEqual({ zalo_hoc_thu: "https://zalo.me/g/hocthu", zalo_chung: null }); // giá trị không phải link ⇒ null
    expect(d.buoi.every((b) => typeof b.bat_dau === "string" && b.so_phut === 90)).toBe(true);
  });
  it("em hết thử: trạng thái het_thu, có ngày hết; không có link Meet/Zalo môn, không nội dung/record; KHÔNG có câu 'hỏi em'", () => {
    const x = tim((d) => d.trang_thai === "het_thu");
    expect(x).toBeTruthy();
    expect(x.d.het_thu).toMatch(/^2026-/);
    expect(x.d.thu).toBeNull();
    expect(x.d.tinh_trang).not.toContain("hỏi em");
    expect(x.d.mon.every((m) => m.link_meet === null && m.link_zalo === null && !m.con_han)).toBe(true);
    expect(x.d.buoi.every((b) => b.noi_dung === null && b.link_record === null && b.khoa)).toBe(true);
  });
  it("em chính thức: dang_hoc, không có khối học thử; không em nào nhận chuỗi 'hỏi em'", () => {
    const x = tim((d) => d.trang_thai === "dang_hoc");
    expect(x.d.thu).toBeNull();
    expect(tatCa.some((y) => y.d.tinh_trang.includes("hỏi em"))).toBe(false);
  });
  it("link không phải http(s) (vd. 'javascript:' chuyển từ sheet) → null, không trả cho học sinh", async () => {
    await db.mon.update({ where: { ma: "toan" }, data: { link_meet: "javascript:alert(1)", link_zalo: "zalo nhóm toán" } });
    const d = await cuaToi(await nguoiHs("HS0021"), T22);
    expect(d.mon.find((m) => m.ma === "toan")).toMatchObject({ link_meet: null, link_zalo: null });
    await db.mon.update({ where: { ma: "toan" }, data: { link_meet: "https://meet.google.com/aaa-bbbb-ccc", link_zalo: "https://zalo.me/g/toan" } });
  });
  it("trạng thái luôn thuộc tập đã đặc tả", () => {
    for (const { d } of tatCa) expect(["dang_hoc", "dang_thu", "sap_bat_dau", "chua_ghi_danh", "het_thu", "da_nghi"]).toContain(d.trang_thai);
  });
  it("chuỗi đi học: Có +1; Phép, chưa điểm, lớp nghỉ không đứt; Vắng đứt; buổi chưa kết thúc không tính", () => {
    const b = (ngay: string, diem_danh: string | null, trang_thai = "binh_thuong") => ({ bat_dau: lucVN(ngay, "22:15").toISOString(), so_phut: 90, trang_thai, diem_danh });
    const ds = [b("2026-11-10", "co"), b("2026-11-12", "vang"), b("2026-11-14", "co"), b("2026-11-17", "phep"), b("2026-11-19", null), b("2026-11-21", null, "huy"), b("2026-11-24", "co"), b("2026-11-26", "vang")];
    expect(chuoiDiHoc(ds, lucVN("2026-11-26", "23:00"))).toBe(2); // 26/11 chưa kết thúc (23:45) ⇒ bỏ qua; 24 co, 21 huỷ, 19 trống, 17 phép, 14 co, 12 vắng ⇒ dừng
    expect(chuoiDiHoc(ds, lucVN("2026-11-27", "01:00"))).toBe(0); // 26/11 vắng đã kết thúc ⇒ 0
    expect(chuoiDiHoc([], T22)).toBe(0);
  });
});

describe("/api/hs/toi — quyền", () => {
  it("GV gọi → 403; không cookie → 401", async () => {
    expect((await goi(hsToi.GET, { cookie: await cookieNd(GV_TOAN) })).status).toBe(403);
    expect((await goi(hsToi.GET)).status).toBe(401);
  });
});
