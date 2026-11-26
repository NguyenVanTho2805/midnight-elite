// Vòng 2 phần máy chủ (BCA-D1-MC2): T33 việc xong, T34 nghi_luc, hoàn tác chuyển chính thức,
// tạo/ẩn hồ sơ, đổi lịch môn (T8), xoá buổi chưa có dữ liệu. Dữ liệu giả, "hôm nay" = 26/11/2026.
import { beforeAll, describe, expect, it } from "vitest";
import { lucVN } from "@/lib/ngay";
import { CHU, GV_ANH, cookieNd, db, goi, napSeed, nguoi } from "./chung";
import { homNay } from "@/server/hom-nay";
import type { Nguoi } from "@/lib/quyen";
import * as xong from "@/app/api/hom-nay/xong/route";

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
