// BCA-D1-MC6 — sửa theo phiếu rà soát BCA-D1-RS3: T46 (em cũ / em đang học thêm môn), Cấp thử theo T44,
// hoàn tác "gắn hồ sơ" không ghi đè ô đã sửa, Gmail trùng hồ sơ khác, quyền trước tham số, đếm lần "từ chối", loại đơn trống.
// Dữ liệu giả, "hôm nay" = 26/11/2026.
import { beforeAll, describe, expect, it } from "vitest";
import { lucVN, s2d } from "@/lib/ngay";
import type { Nguoi } from "@/lib/quyen";
import { CHU, GV_ANH, cookieHs, cookieNd, db, goi, napSeed, nguoi } from "./chung";
import { hoanTacXuLyDon, taoHoSoTuDon, xemTruocDon } from "@/server/don";
import * as buoiIdR from "@/app/api/buoi-hoc/[id]/route";
import * as hoanTacXoaR from "@/app/api/buoi-hoc/[id]/hoan-tac-xoa/route";
import * as boQuaR from "@/app/api/don/[id]/bo-qua/route";
import * as donHoanTacR from "@/app/api/don/[id]/hoan-tac/route";
import * as hocSinhR from "@/app/api/hoc-sinh/route";

let chu: Nguoi, cGvAnh: string, cHs: string;
const T22 = lucVN("2026-11-26", "22:00");
const giay = (goc: Date, s: number) => new Date(goc.getTime() + s * 1000);
const ma = (e: unknown) => (e as { ma?: string }).ma;
const gdCua = async (maHs: string) =>
  (await db.ghi_danh.findMany({ where: { hoc_sinh: { ma_hs: maHs } }, orderBy: { id: "asc" } })).map((g) => `${g.mon_id}:${g.loai}:${g.tu_ngay.toISOString().slice(0, 10)}→${g.den_ngay?.toISOString().slice(0, 10)}`);
let soYc = 5000, soGd = 0;
const taoDon = (v: { ngay?: string; loai?: string; gmail?: string; sdt_ph?: string; mon?: number[] }) =>
  db.don_dang_ky.create({
    data: {
      thoi_gian: lucVN(v.ngay ?? "2026-11-26", "20:00"), nguon: "Web", loai: v.loai ?? "Học thử", ho_ten: "Em Thử Vòng Năm", gmail: v.gmail, sdt_ph: v.sdt_ph,
      mon_ids: v.mon ?? [1], ma_yeu_cau: `YC${++soYc}`, trang_thai: "cho_duyet", loi_du_lieu: [],
    },
  });
/** Hồ sơ giả với các ghi danh cho trước (mon, loai, tu, den). */
async function taoHs(maHs: string, gds: [number, "thu" | "chinh_thuc", string, string | null][]) {
  const hs = await db.hoc_sinh.create({ data: { ma_hs: maHs, ho_ten: `Em ${maHs}`, ngay_tao: s2d("2026-10-01") } });
  for (const [mon_id, loai, tu, den] of gds)
    await db.ghi_danh.create({ data: { ma_gd: `GD9${String(++soGd).padStart(4, "0")}`, hoc_sinh_id: hs.id, mon_id, loai, tu_ngay: s2d(tu), den_ngay: den ? s2d(den) : null } });
  return hs;
}

beforeAll(async () => {
  await napSeed();
  chu = await nguoi(CHU);
  [cGvAnh, cHs] = await Promise.all([cookieNd(GV_ANH), cookieHs("HS0021")]);
});

describe("P2-1 / T46 — em cũ vào hàng chờ chủ, em đang học thêm môn mới thì thử bình thường (T44)", () => {
  it("em đang học Chính thức Anh (từng thử Anh) gửi đơn Toán + Anh → da_gan: thử Toán 26/11–09/12, Anh bỏ qua dang_chinh_thuc", async () => {
    await taoHs("HS9001", [[4, "thu", "2026-11-01", "2026-11-14"], [4, "chinh_thuc", "2026-11-15", null]]);
    const d = await taoDon({ mon: [1, 4] });
    const r = await taoHoSoTuDon(chu, d.id, { maHs: "HS9001" }, T22);
    expect(r).toMatchObject({ ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-09" }, mon: ["toan"], bo_qua: [{ mon: "anh", ly_do: "dang_chinh_thuc" }] });
    expect((await gdCua("HS9001")).at(-1)).toBe("1:thu:2026-11-26→2026-12-09");
  });
  it("em đang học Chính thức, đơn gửi 20/11 nhận muộn 26/11 → thử từ hôm nay, hết 03/12 (= 20/11 + 13, T44)", async () => {
    await taoHs("HS9002", [[2, "chinh_thuc", "2026-11-16", null]]);
    const d = await taoDon({ ngay: "2026-11-20", mon: [3] });
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS9002" }, T22)).toMatchObject({ ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-03" }, mon: ["dia"] });
  });
  it("em đã nghỉ hết (từng Chính thức, chưa từng thử) → can_chu_quyet da_nghi_dang_ky_lai, không ghi gì; Cấp thử với đơn còn trong 14 ngày → hết theo T44", async () => {
    await taoHs("HS9003", [[2, "chinh_thuc", "2026-10-01", "2026-11-10"]]);
    const d = await taoDon({ ngay: "2026-11-20", mon: [1] });
    const truoc = await gdCua("HS9003");
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS9003" }, T22)).toEqual({ ket_qua: "can_chu_quyet", ly_do: "da_nghi_dang_ky_lai", ma_hs: "HS9003", muon_chinh_thuc: false });
    expect(await gdCua("HS9003")).toEqual(truoc);
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ trang_thai: "cho_duyet" });
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS9003", capThuMoi: true }, T22)).toMatchObject({ ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-03" } });
  });
  it("em từng thử đã hết → can_chu_quyet het_thu_dang_ky_lai; Cấp thử với đơn quá hạn (01/11) → 14 ngày từ hôm nay 26/11–09/12", async () => {
    await taoHs("HS9004", [[1, "thu", "2026-10-20", "2026-11-02"]]);
    const d = await taoDon({ ngay: "2026-11-01", mon: [1] });
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS9004" }, T22)).toMatchObject({ ket_qua: "can_chu_quyet", ly_do: "het_thu_dang_ky_lai" });
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS9004", capThuMoi: true }, T22)).toMatchObject({ ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-09" } });
  });
});

describe("P3-6 — loại đơn trống; xem trước tính ngày hết như lúc tạo thật", () => {
  it("loai trống → muon_chinh_thuc false (xem trước và tạo)", async () => {
    const d = await taoDon({ loai: "  " });
    expect((await xemTruocDon(chu, d.id, T22)).muon_chinh_thuc).toBe(false);
    expect(await taoHoSoTuDon(chu, d.id, { taoMoi: true }, T22)).toMatchObject({ ket_qua: "da_tao", muon_chinh_thuc: false });
  });
  it("trùng Gmail HS0021 đang thử (hạn 28/11): thu_du_kien của hồ sơ đó là hạn chung 28/11, hồ sơ mới 26/11–09/12; khớp với lúc gắn thật", async () => {
    const d = await taoDon({ gmail: "hs21@example.com", mon: [3] }); // HS0021 đang thử Toán + Sử
    const x = await xemTruocDon(chu, d.id, T22);
    expect(x.thu_du_kien).toEqual({ tu: "2026-11-26", den: "2026-12-09", ly_do: null });
    expect(x.trung).toMatchObject([{ ma_hs: "HS0021", thu_du_kien: { tu: "2026-11-26", den: "2026-11-28", ly_do: null } }]);
    expect(await taoHoSoTuDon(chu, d.id, { maHs: "HS0021" }, T22)).toMatchObject({ ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-11-28" } });
  });
  it("xem trước em đã nghỉ hết → thu_du_kien.ly_do da_nghi_dang_ky_lai (như lúc tạo)", async () => {
    const hs = await taoHs("HS9005", [[2, "chinh_thuc", "2026-10-01", "2026-11-10"]]);
    const d = await taoDon({ mon: [1] });
    await db.don_dang_ky.update({ where: { id: d.id }, data: { hoc_sinh_id: hs.id } });
    expect((await xemTruocDon(chu, d.id, T22)).trung).toMatchObject([{ ma_hs: "HS9005", khop: ["don_da_gan"], thu_du_kien: { ly_do: "da_nghi_dang_ky_lai" } }]);
  });
});

describe("P3-1, P3-2 — gắn hồ sơ: Gmail trùng hồ sơ khác, hoàn tác không ghi đè ô đã sửa", () => {
  it("Gmail của đơn thuộc HS0021 → không điền gmail, trả trung_gmail HS0021; ô khác vẫn điền", async () => {
    await taoHs("HS9006", [[4, "chinh_thuc", "2026-11-16", null]]);
    const d = await taoDon({ gmail: "HS21@example.com", sdt_ph: "0987654321", mon: [1] });
    const r = await taoHoSoTuDon(chu, d.id, { maHs: "HS9006" }, T22);
    expect(r).toMatchObject({ ket_qua: "da_gan", trung_gmail: "HS0021", dien: ["sdt_ph"] });
    expect(await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS9006" } })).toMatchObject({ gmail: null, sdt_ph: "0987654321" });
  });
  it("ô vừa điền bị sửa trước khi hoàn tác → 409 da_sua, giữ giá trị mới và ghi danh; ô không đổi → hoàn tác trả về trống", async () => {
    await taoHs("HS9007", [[4, "chinh_thuc", "2026-11-16", null]]);
    const d = await taoDon({ sdt_ph: "0901234567", mon: [1] });
    const r = (await taoHoSoTuDon(chu, d.id, { maHs: "HS9007" }, T22)) as { nhatKyId: number; dien: string[] };
    expect(r.dien).toEqual(["sdt_ph"]);
    await db.hoc_sinh.update({ where: { ma_hs: "HS9007" }, data: { sdt_ph: "0911222333" } });
    await expect(hoanTacXuLyDon(chu, d.id, r.nhatKyId, giay(T22, 3))).rejects.toSatisfy((e) => ma(e) === "da_sua");
    expect((await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS9007" } })).sdt_ph).toBe("0911222333");
    expect(await gdCua("HS9007")).toHaveLength(2);
    expect(await db.don_dang_ky.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ trang_thai: "da_nhan" });
    // trả lại đúng giá trị đã điền ⇒ hoàn tác được
    await db.hoc_sinh.update({ where: { ma_hs: "HS9007" }, data: { sdt_ph: "0901234567" } });
    await hoanTacXuLyDon(chu, d.id, r.nhatKyId, giay(T22, 4));
    expect((await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS9007" } })).sdt_ph).toBeNull();
    expect(await gdCua("HS9007")).toHaveLength(1);
  });
});

describe("P3-3, P3-4 — quyền trước tham số; nhật ký 'từ chối' đếm số lần", () => {
  const tuChoi = (path: string) => db.nhat_ky.findMany({ where: { hanh_dong: "tu_choi", doi_tuong_id: { endsWith: path } } });
  it("GV / học sinh gửi tham số sai → 403 (không 400) và có dòng tu_choi", async () => {
    const ca: [unknown, string, string, Record<string, unknown>][] = [
      [hoanTacXoaR.POST, "POST", "/api/p33/hoan-tac-xoa", { params: { id: "abc" }, body: { nhatKyId: "x" } }],
      [boQuaR.POST, "POST", "/api/p33/bo-qua", { params: { id: "abc" }, body: [] }],
      [donHoanTacR.POST, "POST", "/api/p33/don-hoan-tac", { params: { id: "0x2" }, body: {} }],
      [buoiIdR.DELETE, "DELETE", "/api/p33/xoa-buoi", { params: { id: "1e3" } }],
    ];
    for (const c of [cGvAnh, cHs])
      for (const [h, method, path, o] of ca) expect((await goi(h, { cookie: c, method, path, ...o })).status).toBe(403);
    for (const [, , path] of ca) expect((await tuChoi(path)).map((x) => x.vai_tro).sort()).toEqual(expect.arrayContaining(["giao_vien", expect.stringMatching(/^hoc_sinh:/)]));
    expect((await goi(hocSinhR.GET, { cookie: cHs, path: "/api/p33/hoc-sinh?het_ngay=2026-02-30" })).status).toBe(403);
    expect(await tuChoi("/api/p33/hoc-sinh")).toHaveLength(1);
    expect((await goi(hocSinhR.GET, { cookie: cGvAnh, path: "/api/p33/hoc-sinh?het_ngay=2026-02-30" })).status).toBe(400); // GV được xem ⇒ lỗi tham số
  });
  it("từ chối lặp trong cùng phút → một dòng, sau.so_lan tăng (3 lần ⇒ 3)", async () => {
    for (let i = 0; i < 3; i++) expect((await goi(boQuaR.POST, { cookie: cGvAnh, path: "/api/p34/lap", params: { id: "1" }, body: { lyDo: "x" } })).status).toBe(403);
    const rows = await tuChoi("/api/p34/lap");
    expect(rows).toHaveLength(1);
    expect(rows[0].sau).toMatchObject({ so_lan: 3, ly_do: expect.any(String) });
  });
});
