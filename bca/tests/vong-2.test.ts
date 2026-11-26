// Vòng 2 phần máy chủ (BCA-D1-MC2): T33 việc xong, T34 nghi_luc, hoàn tác chuyển chính thức,
// tạo/ẩn hồ sơ, đổi lịch môn (T8), xoá buổi chưa có dữ liệu. Dữ liệu giả, "hôm nay" = 26/11/2026.
import { beforeAll, describe, expect, it } from "vitest";
import { d2s, lucVN } from "@/lib/ngay";
import { CHU, GV_ANH, cookieNd, db, goi, napSeed, nguoi } from "./chung";
import { homNay } from "@/server/hom-nay";
import type { Nguoi } from "@/lib/quyen";
import { chiTietHocSinh } from "@/server/hoc-sinh";
import { chuyenChinhThuc, hoanTacChuyenChinhThuc, nghiMon } from "@/server/ghi-danh";
import * as xong from "@/app/api/hom-nay/xong/route";
import * as nghiMonR from "@/app/api/hoc-sinh/[maHs]/nghi-mon/route";
import * as hoanTacCT from "@/app/api/hoc-sinh/[maHs]/chuyen-chinh-thuc/hoan-tac/route";

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

describe("T34 — chuyen-tu-sheet nhận 'chủ đã cho nghỉ' từ cột Tình trạng của sheet (xem trước, rollback)", () => {
  it("em sheet ghi 'Đã nghỉ' mà ghi danh là hết thử → nghi_luc; em 'Hết thử – hỏi em' giữ nguyên; ghi chú không được đọc", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const bang = (ten: string, cot: string[], dong: unknown[][] = []) => { const ws = wb.addWorksheet(ten); ws.addRow(cot); for (const d of dong) ws.addRow(d); };
    bang("📚 Lứa", ["Mã lứa", "Tên lứa", "Nhận từ ngày", "Đến ngày", "Ghi chú"], [["L9", "Lứa thử", "01/11/2026", null, null]]);
    bang("⚙️ Cài đặt", ["Khoá", "Giá trị", "", "", "Môn", "Tên đầy đủ", "Thứ", "Giờ", "Số phút"], [
      ["SO_NGAY_HOC_THU", 14, null, null, "Toán", "Toán", "3,7", "22:15", 90],
      [null, null, null, null, "Sử", "Lịch sử", "4,8", "22:15", 90],
      [null, null, null, null, "Địa", "Địa lí", "6", "22:15", 90],
      [null, null, null, null, "Anh", "Tiếng Anh", "2,5", "22:15", 90],
    ]);
    const cotHs = ["Mã HS", "Họ tên", "Lứa", "SĐT HS", "SĐT PH", "Gmail", "Trường", "Khối", "Họ tên PH", "Mục tiêu", "Nguồn", "Username Azota", "Đồng ý vinh danh", "Đã nhắn chào", "Ghi chú", "Note", "Ngày tạo", "Số dư đầu kỳ", "Nghỉ/ẩn", "Tình trạng", "Toán", "Sử", "Địa", "Anh"];
    const em = (ma: string, tt: string) => [ma, `Em ${ma}`, "L9", "0900000901", null, `${ma.toLowerCase()}@sheet.invalid`, null, null, null, null, "Web", `az${ma}`, false, true, null, null, "01/11/2026", 0, false, tt, "Nghỉ", null, null, null];
    bang("👥 Học sinh", cotHs, [em("HS9001", "Đã nghỉ"), em("HS9002", "Hết thử 14/11 – hỏi em")]);
    const cotGd = ["Mã GD", "Mã HS", "Họ tên", "Môn", "Loại", "Từ ngày", "Học đến hết ngày", "Miễn phí", "Đơn giá riêng", "Ghi chú"];
    bang("📝 Ghi danh", cotGd, [
      ["GD90001", "HS9001", null, "Toán", "Thử", "01/11/2026", "14/11/2026", false, null, null],
      ["GD90002", "HS9002", null, "Toán", "Thử", "01/11/2026", "14/11/2026", false, null, "Cho nghỉ đến hết 14/11"],
    ]);
    bang("📥 Đăng ký", ["Thời gian"]);
    bang("📅 Buổi học", ["Ngày", "Môn", "Trạng thái", "Đã điểm danh", "Nội dung buổi", "Link record", "Ghi chú"]);
    bang("__DiemDanh", ["Ngày", "Môn", "Mã HS", "Ký hiệu"]);
    bang("Điểm danh", [""]);
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const tep = `${await mkdtemp(`${tmpdir()}/bca-chuyen-`)}/gia.xlsx`;
    await wb.xlsx.writeFile(tep);
    const { chuyen } = await import("@/scripts/chuyen-tu-sheet");
    const bao = (await chuyen(db as never, tep, { apply: false, ngayChot: "2026-11-26" })) as Record<string, unknown>;
    expect(bao.ket_qua).toBe("KHỚP (đã rollback vì đang xem trước)");
    expect(bao.t34_chu_da_cho_nghi).toEqual(["HS9001"]);
    expect(bao.tinh_trang).toEqual({ "Đã nghỉ": 1, "Hết thử 14/11 – hỏi em": 1 });
    expect(await db.hoc_sinh.count({ where: { ma_hs: { in: ["HS9001", "HS9002"] } } })).toBe(0); // đã rollback
  });
});

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
