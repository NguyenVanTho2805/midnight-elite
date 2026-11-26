// scripts/chuyen-tu-sheet.ts trên DB thử RỖNG (đối soát số dòng phải khớp đúng số đọc từ sheet) với bảng tính giả.
// T34 (sheet "Đã nghỉ" ⇒ nghi_luc), P2-5 (lệch bất kỳ số nào ⇒ rollback), P2-4 (chặn --apply lần hai khi web đã vận hành), T40 (xoá dấu DU_LIEU_GIA).
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { db, kiemDbThu } from "./chung";
import { xoaHet } from "@/scripts/seed-gia";
import { chuyen } from "@/scripts/chuyen-tu-sheet";

type Bao = Record<string, unknown>;
const OPT = { apply: false, ngayChot: "2026-11-26" };

/** Bảng tính giả 2 em: HS9001 sheet "Đã nghỉ", HS9002 "Hết thử 14/11 – hỏi em" (ghi chú "Cho nghỉ…" không được đọc). */
async function tepGia(sua: { tinhTrang2?: string; buoi?: unknown[][] } = {}) {
  const wb = new ExcelJS.Workbook();
  const bang = (ten: string, cot: string[], dong: unknown[][] = []) => { const ws = wb.addWorksheet(ten); ws.addRow(cot); for (const d of dong) ws.addRow(d); };
  bang("📚 Lứa", ["Mã lứa", "Tên lứa", "Nhận từ ngày", "Đến ngày", "Ghi chú"], [["L9", "Lứa thử", "01/11/2026", null, null]]);
  bang("⚙️ Cài đặt", ["Khoá", "Giá trị", "", "", "Môn", "Tên đầy đủ", "Thứ", "Giờ", "Số phút"], [
    ["SO_NGAY_HOC_THU", 14, null, null, "Toán", "Toán", "3,7", "22:15", 90],
    ["DU_LIEU_GIA", "có", null, null, "Sử", "Lịch sử", "4,8", "22:15", 90], // sheet có khoá này cũng không được ghi
    [null, null, null, null, "Địa", "Địa lí", "6", "22:15", 90],
    [null, null, null, null, "Anh", "Tiếng Anh", "2,5", "22:15", 90],
  ]);
  const cotHs = ["Mã HS", "Họ tên", "Lứa", "SĐT HS", "SĐT PH", "Gmail", "Trường", "Khối", "Họ tên PH", "Mục tiêu", "Nguồn", "Username Azota", "Đồng ý vinh danh", "Đã nhắn chào", "Ghi chú", "Note", "Ngày tạo", "Số dư đầu kỳ", "Nghỉ/ẩn", "Tình trạng", "Toán", "Sử", "Địa", "Anh"];
  const em = (ma: string, tt: string) => [ma, `Em ${ma}`, "L9", "0900000901", null, `${ma.toLowerCase()}@sheet.invalid`, null, null, null, null, "Web", `az${ma}`, false, true, null, null, "01/11/2026", 0, false, tt, "Nghỉ", null, null, null];
  bang("👥 Học sinh", cotHs, [em("HS9001", "Đã nghỉ"), em("HS9002", sua.tinhTrang2 ?? "Hết thử 14/11 – hỏi em")]);
  bang("📝 Ghi danh", ["Mã GD", "Mã HS", "Họ tên", "Môn", "Loại", "Từ ngày", "Học đến hết ngày", "Miễn phí", "Đơn giá riêng", "Ghi chú"], [
    ["GD90001", "HS9001", null, "Toán", "Thử", "01/11/2026", "14/11/2026", false, null, null],
    ["GD90002", "HS9002", null, "Toán", "Thử", "01/11/2026", "14/11/2026", false, null, "Cho nghỉ đến hết 14/11"],
  ]);
  bang("📥 Đăng ký", ["Thời gian"]);
  bang("📅 Buổi học", ["Ngày", "Môn", "Trạng thái", "Đã điểm danh", "Nội dung buổi", "Link record", "Ghi chú"], sua.buoi ?? []);
  bang("__DiemDanh", ["Ngày", "Môn", "Mã HS", "Ký hiệu"]);
  bang("Điểm danh", [""]);
  const tep = `${await mkdtemp(`${tmpdir()}/bca-chuyen-`)}/gia.xlsx`;
  await wb.xlsx.writeFile(tep);
  return tep;
}

beforeAll(async () => {
  kiemDbThu();
  await xoaHet(db as never);
});

describe("T34 — sheet 'Đã nghỉ' ⇒ nghi_luc (xem trước, rollback)", () => {
  it("em sheet ghi 'Đã nghỉ' mà ghi danh là hết thử → nghi_luc; em 'Hết thử – hỏi em' giữ nguyên; ghi chú không được đọc", async () => {
    const bao = (await chuyen(db as never, await tepGia(), OPT)) as Bao;
    expect(bao.ket_qua).toBe("KHỚP (đã rollback vì đang xem trước)");
    expect(bao.t34_chu_da_cho_nghi).toEqual(["HS9001"]);
    expect(bao.tinh_trang).toEqual({ "Đã nghỉ": 1, "Hết thử 14/11 – hỏi em": 1 });
    expect(bao.doi_soat_so_dong).toMatchObject({ hoc_sinh: { sheet: 2, csdl: 2 }, ghi_danh: { sheet: 2, csdl: 2 }, mon: { sheet: 4, csdl: 4 } });
    expect(await db.hoc_sinh.count()).toBe(0); // đã rollback
  });
});

describe("P2-5 — lệch bất kỳ số đối soát nào ⇒ rollback", () => {
  it("sheet có 2 dòng buổi Toán trùng ngày (CSDL gộp còn 1) → LỆCH buoi_hoc, không ghi gì dù --apply", async () => {
    const dong = ["21/11/2026", "Toán", "Có học", false, null, null, null];
    const bao = (await chuyen(db as never, await tepGia({ buoi: [dong, dong] }), { ...OPT, apply: true })) as Bao;
    expect(bao.ket_qua).toMatch(/^LỆCH: buoi_hoc sheet 2 ≠ CSDL 1/);
    expect(await db.hoc_sinh.count()).toBe(0);
    expect(await db.nhat_ky.count({ where: { hanh_dong: "chuyen_that" } })).toBe(0);
  });
  it("cột Tình trạng của sheet khác phân bố tính lại → LỆCH phân bố tình trạng, rollback", async () => {
    const bao = (await chuyen(db as never, await tepGia({ tinhTrang2: "Đang học" }), { ...OPT, apply: true })) as Bao;
    expect(bao.ket_qua).toMatch(/LỆCH: phân bố tình trạng \(.*Đang học: sheet 1 ≠ tính 0/);
    expect(await db.hoc_sinh.count()).toBe(0);
  });
});

describe("P2-4 — chuyển thật một lần; web đã vận hành thì chặn --apply", () => {
  it("--apply lần đầu: ghi + một dòng nhat_ky 'chuyen_that', xoá dấu DU_LIEU_GIA, không ghi khoá đó từ sheet", async () => {
    await db.cai_dat.create({ data: { khoa: "DU_LIEU_GIA", gia_tri: true } });
    const tep = await tepGia();
    expect(((await chuyen(db as never, tep, OPT)) as Bao).ket_qua).toMatch(/^KHỚP/);
    expect(await db.cai_dat.count({ where: { khoa: "DU_LIEU_GIA" } })).toBe(1); // xem trước: rollback, dấu còn
    const bao = (await chuyen(db as never, tep, { ...OPT, apply: true })) as Bao;
    expect(bao.ket_qua).toBe("ĐÃ GHI");
    expect(await db.hoc_sinh.count()).toBe(2);
    const nk = await db.nhat_ky.findMany({ where: { hanh_dong: "chuyen_that" } });
    expect(nk).toHaveLength(1);
    expect(nk[0]).toMatchObject({ id: bao.nhat_ky_chuyen_that, nguoi_dung_id: null, vai_tro: "he_thong" });
    expect(await db.cai_dat.count({ where: { khoa: "DU_LIEU_GIA" } })).toBe(0);
  });
  it("web chưa vận hành → chạy lại --apply an toàn (lặp lại được)", async () => {
    const bao = (await chuyen(db as never, await tepGia(), { ...OPT, apply: true })) as Bao;
    expect(bao).toMatchObject({ ket_qua: "ĐÃ GHI", web_da_van_hanh: { nhat_ky_nguoi_dung: 0, ghi_danh_tao_tren_web: 0, diem_danh_web: 0 } });
    expect(bao.lan_chuyen_that_truoc).not.toBeNull();
  });
  it("có nhật ký do người dùng / ghi danh tạo trên web → --apply bị chặn, không đổi gì; xem trước vẫn chạy; có --ghi-de-du-lieu-web mới ghi", async () => {
    const tep = await tepGia();
    await db.nhat_ky.create({ data: { nguoi_dung_id: randomUUID(), vai_tro: "chu", hanh_dong: "gia_han_thu", doi_tuong: "nhom_gia_han" } });
    await expect(chuyen(db as never, tep, { ...OPT, apply: true })).rejects.toThrow(/Web đã vận hành \(1 nhật ký người dùng.*--ghi-de-du-lieu-web/);
    await db.nhat_ky.deleteMany({ where: { hanh_dong: "gia_han_thu" } });
    await db.ghi_danh.update({ where: { ma_gd: "GD90001" }, data: { tao_boi: randomUUID() } });
    await expect(chuyen(db as never, tep, { ...OPT, apply: true })).rejects.toThrow(/1 ghi danh tạo trên web/);
    expect(await db.nhat_ky.count({ where: { hanh_dong: "chuyen_that" } })).toBe(2);
    expect(((await chuyen(db as never, tep, OPT)) as Bao).ket_qua).toMatch(/^KHỚP/);
    expect(((await chuyen(db as never, tep, { ...OPT, apply: true, ghiDeDuLieuWeb: true })) as Bao).ket_qua).toBe("ĐÃ GHI");
    expect(await db.nhat_ky.findFirst({ where: { hanh_dong: "chuyen_that" }, orderBy: { id: "desc" } })).toMatchObject({ sau: { ghi_de_du_lieu_web: true } });
  });
});
