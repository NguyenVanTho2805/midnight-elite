// Màn Tài khoản (T55): chủ thêm GV, sửa tên/môn, khoá/mở khoá, đăng xuất mọi máy; không khoá được chủ còn hoạt động cuối cùng.
import { beforeAll, describe, expect, it } from "vitest";
import { kyPhien, TEN_COOKIE } from "@/server/token";
import { timTaiKhoan } from "@/server/google";
import { manTaiKhoan } from "@/server/nguoi-dung";
import { nguoiTuToken } from "@/server/phien";
import * as ndR from "@/app/api/nguoi-dung/route";
import * as ndIdR from "@/app/api/nguoi-dung/[id]/route";
import * as khoaR from "@/app/api/nguoi-dung/[id]/khoa/route";
import * as thuHoiR from "@/app/api/nguoi-dung/[id]/thu-hoi-phien/route";
import * as toi from "@/app/api/toi/route";
import { CHU, GV_ANH, GV_TOAN, cookieHs, cookieNd, db, goi, napSeed, nguoi } from "./chung";

let cChu: string, cGv: string, cHs: string, idGvAnh: string, idChu: string;
const cookieMoi = async (id: string) => `${TEN_COOKIE}=${await kyPhien({ sub: id, vai: "nd", bd: Math.floor(Date.now() / 1000) + 1 })}`;
const cho = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

beforeAll(async () => {
  await napSeed();
  [cChu, cGv, cHs] = await Promise.all([cookieNd(CHU), cookieNd(GV_TOAN), cookieHs("HS0021")]);
  idGvAnh = (await db.nguoi_dung.findUniqueOrThrow({ where: { gmail: GV_ANH } })).id;
  idChu = (await db.nguoi_dung.findUniqueOrThrow({ where: { gmail: CHU } })).id;
});

describe("Quyền — chỉ chủ (kiểm trước khi đọc tham số)", () => {
  it("GV / học sinh gọi thêm, sửa, khoá, thu hồi → 403 kể cả thân sai; không ghi gì", async () => {
    const n = await db.nguoi_dung.count(), pc = await db.phan_cong.count();
    for (const c of [cGv, cHs]) {
      expect((await goi(ndR.POST, { cookie: c, body: { gmail: "x@gmail.com", ten: "X", mon: ["toan"] } })).status).toBe(403);
      expect((await goi(ndR.POST, { cookie: c, body: "rác" })).status).toBe(403);
      expect((await goi(ndIdR.PATCH, { cookie: c, method: "PATCH", params: { id: idGvAnh }, body: { mon: ["toan", "anh"] } })).status).toBe(403);
      expect((await goi(khoaR.POST, { cookie: c, params: { id: idChu }, body: { khoa: true } })).status).toBe(403);
      expect((await goi(thuHoiR.POST, { cookie: c, params: { id: idChu }, body: {} })).status).toBe(403);
      expect((await goi(ndR.GET, { cookie: c })).status).toBe(403);
    }
    expect([await db.nguoi_dung.count(), await db.phan_cong.count()]).toEqual([n, pc]);
    expect((await db.nguoi_dung.findUniqueOrThrow({ where: { id: idChu } })).khoa_luc).toBeNull();
    await expect(manTaiKhoan(await nguoi(GV_TOAN))).rejects.toThrow("Chỉ chủ");
    expect((await goi(ndR.POST, { body: { gmail: "x@gmail.com", ten: "X" } })).status).toBe(401);
  });
});

describe("Thêm giáo viên", () => {
  it("chủ thêm GV: Gmail chuẩn hoá, môn, nhật ký; GV đăng nhập Google được ngay và chỉ có môn được giao", async () => {
    const r = await goi(ndR.POST, { cookie: cChu, body: { gmail: " Co.Thu.Huong@Gmail.com ", ten: "  Chị   Thu Hương ", mon: ["anh", "anh"] } });
    expect(r).toMatchObject({ status: 200, json: { gmail: "co.thu.huong@gmail.com", ten: "Chị Thu Hương", mon: ["anh"], trung_ho_so_hs: [] } });
    const nd = await db.nguoi_dung.findUniqueOrThrow({ where: { id: r.json.id }, include: { phan_cong: true } });
    expect(nd).toMatchObject({ vai_tro: "giao_vien", khoa_luc: null });
    expect(nd.phan_cong.map((p) => p.mon_id)).toEqual([4]);
    expect(await db.nhat_ky.count({ where: { hanh_dong: "them_giao_vien", doi_tuong_id: nd.id } })).toBe(1);
    const p = await timTaiKhoan("cothuhuong@gmail.com");
    expect(p).toMatchObject({ sub: nd.id, vai: "nd" });
    expect(await nguoiTuToken(await kyPhien(p))).toMatchObject({ vai: "giao_vien", monIds: [4] });
  });
  it("Gmail trùng hộp với tài khoản có sẵn (khác dấu chấm / hoa) → 409 trung; gõ nhầm đuôi → 400 kèm gợi ý; tên trống / môn lạ → 400", async () => {
    expect(await goi(ndR.POST, { cookie: cChu, body: { gmail: "cothu.huong@gmail.com", ten: "Trùng" } })).toMatchObject({ status: 409, json: { ma: "trung" } });
    expect(await goi(ndR.POST, { cookie: cChu, body: { gmail: GV_ANH.toUpperCase(), ten: "Trùng" } })).toMatchObject({ status: 409 });
    const g = await goi(ndR.POST, { cookie: cChu, body: { gmail: "co.moi@gamil.com", ten: "X" } });
    expect(g).toMatchObject({ status: 400, json: { ma: "gmail" } });
    expect(g.json.loi).toContain("co.moi@gmail.com");
    expect((await goi(ndR.POST, { cookie: cChu, body: { gmail: "khong-phai-email", ten: "X" } })).status).toBe(400);
    expect((await goi(ndR.POST, { cookie: cChu, body: { gmail: "a@gmail.com", ten: "   " } })).status).toBe(400);
    expect((await goi(ndR.POST, { cookie: cChu, body: { gmail: "a@gmail.com", ten: "X".repeat(81) } })).status).toBe(400);
    expect(await goi(ndR.POST, { cookie: cChu, body: { gmail: "a@gmail.com", ten: "X", mon: ["hoa"] } })).toMatchObject({ status: 400, json: { loi: "Không có môn: hoa" } });
    expect((await goi(ndR.POST, { cookie: cChu, body: { gmail: "a@gmail.com", ten: "X", mon: "toan" } })).status).toBe(400);
    expect(await db.nguoi_dung.count({ where: { gmail: { in: ["a@gmail.com", "co.moi@gamil.com", "cothu.huong@gmail.com"] } } })).toBe(0);
  });
  it("Gmail đang ghi trên hồ sơ học sinh → vẫn thêm, trả mã hồ sơ để cảnh báo (T49)", async () => {
    await db.hoc_sinh.update({ where: { ma_hs: "HS0030" }, data: { gmail: "anh.quang.minh@gmail.com" } });
    const r = await goi(ndR.POST, { cookie: cChu, body: { gmail: "anhquangminh@gmail.com", ten: "Anh Quang Minh", mon: [] } });
    expect(r).toMatchObject({ status: 200, json: { trung_ho_so_hs: ["HS0030"], mon: [] } });
  });
});

describe("Sửa tên / môn", () => {
  it("đặt lại môn của GV: bỏ Anh thêm Toán có hiệu lực ngay ở request kế tiếp; nhật ký phan_cong có trước/sau", async () => {
    const cGvAnh = await cookieNd(GV_ANH);
    expect(await nguoiTuToken(cGvAnh.split("=")[1])).toMatchObject({ monIds: [4] });
    const r = await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: idGvAnh }, body: { mon: ["toan"], ten: "GV Anh → Toán" } });
    expect(r).toMatchObject({ status: 200, json: { mon: ["toan"], ten: "GV Anh → Toán" } });
    expect(await nguoiTuToken(cGvAnh.split("=")[1])).toMatchObject({ monIds: [1], ten: "GV Anh → Toán" });
    expect(await db.nhat_ky.findFirst({ where: { hanh_dong: "phan_cong", doi_tuong_id: idGvAnh }, orderBy: { id: "desc" } })).toMatchObject({ truoc: { mon: ["anh"] }, sau: { mon: ["toan"] } });
    await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: idGvAnh }, body: { mon: ["anh"], ten: "GV Anh (thử)" } });
  });
  it("chủ: sửa tên được, giao môn → 400; thân rỗng → 400; id lạ / không phải uuid → 404", async () => {
    expect(await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: idChu }, body: { ten: "Anh Thọ" } })).toMatchObject({ status: 200, json: { ten: "Anh Thọ" } });
    expect((await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: idChu }, body: { mon: ["toan"] } })).status).toBe(400);
    expect((await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: idChu }, body: {} })).status).toBe(400);
    expect((await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: "00000000-0000-4000-8000-000000000000" }, body: { ten: "X" } })).status).toBe(404);
    expect((await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: "abc" }, body: { ten: "X" } })).status).toBe(404);
    await goi(ndIdR.PATCH, { cookie: cChu, method: "PATCH", params: { id: idChu }, body: { ten: "Chủ lớp (thử)" } });
  });
});

describe("Khoá / mở khoá / đăng xuất mọi máy", () => {
  it("khoá GV → phiên đang mở 401 ngay, Google từ chối; mở khoá → phiên cũ vẫn hết, phiên mới vào được; khoá lại hai lần không lỗi", async () => {
    const cGvAnh = await cookieNd(GV_ANH);
    expect(await goi(khoaR.POST, { cookie: cChu, params: { id: idGvAnh }, body: { khoa: true } })).toMatchObject({ status: 200, json: { khoa: true } });
    expect((await goi(toi.GET, { cookie: cGvAnh })).status).toBe(401);
    await expect(timTaiKhoan(GV_ANH)).rejects.toMatchObject({ ma: "tai_khoan_khoa" });
    expect((await goi(khoaR.POST, { cookie: cChu, params: { id: idGvAnh }, body: { khoa: true } })).status).toBe(200);
    expect(await goi(khoaR.POST, { cookie: cChu, params: { id: idGvAnh }, body: { khoa: false } })).toMatchObject({ status: 200, json: { khoa: false } });
    expect((await goi(toi.GET, { cookie: cGvAnh })).status).toBe(401);
    await cho(1100);
    expect((await goi(toi.GET, { cookie: await cookieMoi(idGvAnh) })).status).toBe(200);
    expect(await db.nhat_ky.count({ where: { hanh_dong: { in: ["khoa_tai_khoan", "mo_khoa_tai_khoan"] }, doi_tuong_id: idGvAnh } })).toBe(2);
    expect((await goi(khoaR.POST, { cookie: cChu, params: { id: idGvAnh }, body: { khoa: "co" } })).status).toBe(400);
  });
  it("chủ còn hoạt động cuối cùng: tự khoá → 409 chu_cuoi (cả qua thu-hoi-phien khoaTaiKhoan); tự đăng xuất mọi máy thì được", async () => {
    expect(await goi(khoaR.POST, { cookie: cChu, params: { id: idChu }, body: { khoa: true } })).toMatchObject({ status: 409, json: { ma: "chu_cuoi" } });
    expect((await goi(thuHoiR.POST, { cookie: cChu, params: { id: idChu }, body: { khoaTaiKhoan: true } })).status).toBe(409);
    expect((await db.nguoi_dung.findUniqueOrThrow({ where: { id: idChu } })).khoa_luc).toBeNull();
    expect((await goi(thuHoiR.POST, { cookie: cChu, params: { id: idChu }, body: {} })).status).toBe(200);
    expect((await goi(toi.GET, { cookie: cChu })).status).toBe(401);
    await cho(1100);
    cChu = await cookieMoi(idChu);
    expect((await goi(toi.GET, { cookie: cChu })).status).toBe(200);
  });
  it("hai chủ khoá nhau cùng lúc → đúng một lần thành công, luôn còn một chủ hoạt động", async () => {
    const chu2 = await db.nguoi_dung.create({ data: { gmail: "chu.hai@bca.invalid", ten_hien_thi: "Chủ 2", vai_tro: "chu" } });
    const c2 = await cookieMoi(chu2.id);
    const [a, b] = await Promise.all([
      goi(khoaR.POST, { cookie: cChu, params: { id: chu2.id }, body: { khoa: true } }),
      goi(khoaR.POST, { cookie: c2, params: { id: idChu }, body: { khoa: true } }),
    ]);
    // đúng một 200; lần kia 409 chu_cuoi (hoặc 401 nếu người gọi đã bị khoá trước khi request của họ được đọc phiên)
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    expect([a.status, b.status].find((s) => s !== 200)).toBeOneOf([401, 409]);
    expect(await db.nguoi_dung.count({ where: { vai_tro: "chu", khoa_luc: null } })).toBe(1);
  });
});
