// Test API theo vai: gọi đúng route handler với cookie phiên, kiểm quyền ở máy chủ (phan-quyen.md).
import { beforeAll, describe, expect, it } from "vitest";
import { lucVN } from "@/lib/ngay";
import { CHU, GV_ANH, cookieHs, cookieNd, db, goi, napSeed } from "./chung";
import { TEN_COOKIE, kyPhien } from "@/server/token";
import * as hocSinh from "@/app/api/hoc-sinh/route";
import * as hocSinhMa from "@/app/api/hoc-sinh/[maHs]/route";
import * as ghiDanh from "@/app/api/hoc-sinh/[maHs]/ghi-danh/route";
import * as chuyenCT from "@/app/api/hoc-sinh/[maHs]/chuyen-chinh-thuc/route";
import * as nghiMon from "@/app/api/hoc-sinh/[maHs]/nghi-mon/route";
import * as giaHan from "@/app/api/gia-han/route";
import * as homNay from "@/app/api/hom-nay/route";
import * as buoiHoc from "@/app/api/buoi-hoc/route";
import * as buoiId from "@/app/api/buoi-hoc/[id]/route";
import * as huy from "@/app/api/buoi-hoc/[id]/huy/route";
import * as hocBu from "@/app/api/buoi-hoc/hoc-bu/route";
import * as sinh from "@/app/api/buoi-hoc/sinh/route";
import * as diemDanh from "@/app/api/diem-danh/[buoiId]/route";
import * as tatCa from "@/app/api/diem-danh/[buoiId]/tat-ca/route";
import * as maTran from "@/app/api/diem-danh/thang/route";
import * as don from "@/app/api/don/route";
import * as nguoiDung from "@/app/api/nguoi-dung/route";
import * as thuHoi from "@/app/api/nguoi-dung/[id]/thu-hoi-phien/route";
import * as hsToi from "@/app/api/hs/toi/route";
import * as hsBuoi from "@/app/api/hs/buoi/[id]/route";
import * as toi from "@/app/api/toi/route";
import * as devLogin from "@/app/api/dev/dang-nhap/route";

let chu: string, gvAnh: string;
const buoi = async (mon: number, ngay: string) => String((await db.buoi_hoc.findUniqueOrThrow({ where: { mon_id_bat_dau_luc: { mon_id: mon, bat_dau_luc: lucVN(ngay, "22:15") } } })).id);

beforeAll(async () => {
  await napSeed();
  chu = await cookieNd(CHU);
  gvAnh = await cookieNd(GV_ANH);
});

describe("Phiên", () => {
  it("không cookie → 401; cookie giả → 401", async () => {
    expect((await goi(homNay.GET)).status).toBe(401);
    expect((await goi(homNay.GET, { cookie: `${TEN_COOKIE}=abc.def.ghi` })).status).toBe(401);
  });
  it("đăng nhập thử chỉ có khi BCA_DEV_LOGIN=1", async () => {
    const cu = process.env.BCA_DEV_LOGIN;
    delete process.env.BCA_DEV_LOGIN;
    process.env.BCA_SESSION_SECRET = "bi-mat-chi-de-test-0123456789";
    expect((await devLogin.POST(new Request("http://x/api/dev/dang-nhap", { method: "POST", body: '{"vai":"gv_anh"}' }))).status).toBe(404);
    process.env.BCA_DEV_LOGIN = "1";
    const r = await devLogin.POST(new Request("http://x/api/dev/dang-nhap", { method: "POST", body: '{"vai":"gv_anh"}' }));
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    expect((await goi(toi.GET, { cookie })).json).toMatchObject({ vai: "giao_vien", monIds: [4] });
    if (cu === undefined) delete process.env.BCA_DEV_LOGIN; else process.env.BCA_DEV_LOGIN = cu;
    chu = await cookieNd(CHU);
    gvAnh = await cookieNd(GV_ANH);
  });
});

describe("Giáo viên Anh — chỉ môn mình, không thấy liên hệ/PH/tiền", () => {
  it("danh sách học sinh: 49 em từng học Anh, không có cột cấm", async () => {
    const { status, json } = await goi(hocSinh.GET, { cookie: gvAnh });
    expect(status).toBe(200);
    expect(json.hoc_sinh).toHaveLength(49);
    expect(json.mon.map((m: { ma: string }) => m.ma)).toEqual(["anh"]);
    for (const h of json.hoc_sinh) for (const k of ["sdt_hs", "gmail", "ho_ten_ph", "sdt_ph", "ghi_chu_rieng", "so_du_dau_ky"]) expect(h).not.toHaveProperty(k);
    const c = await goi(hocSinh.GET, { cookie: chu });
    expect(c.json.hoc_sinh).toHaveLength(69); // 70 − 1 em đã ẩn
    expect(c.json.hoc_sinh[0]).toHaveProperty("sdt_hs");
  });
  it("chi tiết em không học Anh → 404; em học Anh → 200 không có SĐT", async () => {
    expect((await goi(hocSinhMa.GET, { cookie: gvAnh, params: { maHs: "HS0001" } })).status).toBe(404);
    const r = await goi(hocSinhMa.GET, { cookie: gvAnh, params: { maHs: "HS0002" } });
    expect(r.status).toBe(200);
    expect(r.json.hoc_sinh).not.toHaveProperty("sdt_hs");
    expect(r.json.mon.map((m: { ma: string }) => m.ma)).toEqual(["anh"]);
    expect(r.json).not.toHaveProperty("don");
  });
  it("điểm danh buổi Toán → 403, không ghi gì, có nhật ký 'từ chối' (4.1)", async () => {
    const id = await buoi(1, "2026-11-17");
    const trc = await db.nhat_ky.count({ where: { hanh_dong: "tu_choi" } });
    const ddTrc = await db.diem_danh.count();
    expect((await goi(diemDanh.GET, { cookie: gvAnh, params: { buoiId: id } })).status).toBe(403);
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0001" } });
    expect((await goi(diemDanh.PUT, { cookie: gvAnh, method: "PUT", params: { buoiId: id }, body: { hocSinhId: hs.id, trangThai: null, xacNhan: true } })).status).toBe(403);
    expect((await goi(tatCa.POST, { cookie: gvAnh, params: { buoiId: id }, body: { xacNhan: true } })).status).toBe(403);
    expect(await db.diem_danh.count()).toBe(ddTrc);
    expect(await db.nhat_ky.count({ where: { hanh_dong: "tu_choi" } })).toBe(trc + 3);
  });
  it("mọi thao tác chỉ chủ → 403 (QĐ 16, T9)", async () => {
    const p = { maHs: "HS0021" };
    const cases = [
      goi(giaHan.POST, { cookie: gvAnh, body: { maHs: ["HS0021"], soNgay: 3, lyDo: "x" } }),
      goi(chuyenCT.POST, { cookie: gvAnh, params: p, body: { mon: ["anh"] } }),
      goi(ghiDanh.POST, { cookie: gvAnh, params: p, body: { mon: "anh", loai: "thu" } }),
      goi(nghiMon.POST, { cookie: gvAnh, params: p, body: { mon: "anh" } }),
      goi(huy.POST, { cookie: gvAnh, params: { id: await buoi(4, "2026-12-03") }, body: { lyDo: "x" } }),
      goi(hocBu.POST, { cookie: gvAnh, body: { mon: "anh", ngay: "2026-12-05" } }),
      goi(sinh.POST, { cookie: gvAnh, body: { thang: "2027-01" } }),
      goi(don.GET, { cookie: gvAnh }),
      goi(nguoiDung.GET, { cookie: gvAnh }),
    ];
    expect((await Promise.all(cases)).map((r) => r.status)).toEqual(Array(9).fill(403));
  });
  it("sửa nội dung/record buổi Anh được; buổi Toán thì 403", async () => {
    const r = await goi(buoiId.PATCH, { cookie: gvAnh, method: "PATCH", params: { id: await buoi(4, "2026-11-19") }, body: { noiDung: "Unit 5", linkRecord: "drive.google.com/abc" } });
    expect(r).toMatchObject({ status: 200, json: { link_record: "https://drive.google.com/abc" } });
    expect((await goi(buoiId.PATCH, { cookie: gvAnh, method: "PATCH", params: { id: await buoi(1, "2026-11-17") }, body: { noiDung: "x" } })).status).toBe(403);
  });
  it("danh sách buổi và ma trận chỉ môn Anh", async () => {
    const r = await goi(buoiHoc.GET, { cookie: gvAnh, path: "/api/buoi-hoc?thang=2026-11" });
    expect(r.json.buoi.every((b: { mon: { ma: string } }) => b.mon.ma === "anh")).toBe(true);
    expect(r.json.buoi).toHaveLength(5);
    expect((await goi(buoiHoc.GET, { cookie: gvAnh, path: "/api/buoi-hoc?thang=2026-11&mon=toan" })).status).toBe(403);
    expect((await goi(maTran.GET, { cookie: gvAnh, path: "/api/diem-danh/thang?mon=toan&thang=2026-11" })).status).toBe(403);
    expect((await goi(maTran.GET, { cookie: gvAnh, path: "/api/diem-danh/thang?mon=anh&thang=2026-11" })).status).toBe(200);
  });
});

describe("Học sinh — chỉ dữ liệu của mình, lớp còn hạn", () => {
  it("không vào được khu quản lý", async () => {
    const hs = await cookieHs("HS0001");
    expect((await goi(hocSinh.GET, { cookie: hs })).status).toBe(403);
    expect((await goi(homNay.GET, { cookie: hs })).status).toBe(403);
    expect((await goi(diemDanh.GET, { cookie: hs, params: { buoiId: await buoi(1, "2026-11-17") } })).status).toBe(403);
  });
  it("em chính thức xem record buổi của mình; không có ghi chú điểm danh", async () => {
    const hs = await cookieHs("HS0001");
    const r = await goi(hsBuoi.GET, { cookie: hs, params: { id: await buoi(1, "2026-11-17") } });
    expect(r.status).toBe(200);
    expect(r.json.link_record).toBe("https://drive.google.com/gia");
    expect(r.json).not.toHaveProperty("ghi_chu");
    const t = await goi(hsToi.GET, { cookie: hs });
    expect(t.json.hoc_sinh.ma_hs).toBe("HS0001");
    expect(t.json.hoc_sinh).not.toHaveProperty("ghi_chu_rieng");
    expect(t.json.buoi.every((b: object) => !("ghi_chu" in b))).toBe(true);
  });
  it("buổi không thuộc lớp em → 403; em hết thử → 403 het_han, record bị khoá (T16)", async () => {
    expect((await goi(hsBuoi.GET, { cookie: await cookieHs("HS0002"), params: { id: await buoi(1, "2026-11-17") } })).status).toBe(403);
    const het = await cookieHs("HS0065"); // thử Toán + Anh 05/11–18/11
    const r = await goi(hsBuoi.GET, { cookie: het, params: { id: await buoi(1, "2026-11-17") } });
    expect(r).toMatchObject({ status: 403, json: { ma: "het_han" } });
    const t = await goi(hsToi.GET, { cookie: het });
    const b17 = t.json.buoi.find((b: { ngay: string; mon: string }) => b.ngay === "2026-11-17" && b.mon === "toan");
    expect(b17).toMatchObject({ khoa: true, link_record: null, noi_dung: null });
    expect(b17.diem_danh).not.toBeUndefined(); // vẫn xem được điểm danh của mình
  });
});

describe("Thu hồi phiên (T23)", () => {
  it("chủ thu hồi phiên GV → cookie cũ 401 ngay; đăng nhập lại thì vào được", async () => {
    const nd = await db.nguoi_dung.findUniqueOrThrow({ where: { gmail: GV_ANH } });
    expect((await goi(toi.GET, { cookie: gvAnh })).status).toBe(200);
    expect((await goi(thuHoi.POST, { cookie: chu, params: { id: nd.id }, body: {} })).status).toBe(200);
    expect((await goi(toi.GET, { cookie: gvAnh })).status).toBe(401);
    const moi = `${TEN_COOKIE}=${await kyPhien({ sub: nd.id, vai: "nd", bd: Math.ceil(Date.now() / 1000) + 1 })}`;
    expect((await goi(toi.GET, { cookie: moi })).status).toBe(200);
  });
});
