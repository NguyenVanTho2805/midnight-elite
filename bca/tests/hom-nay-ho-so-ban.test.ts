// Mục 1 (BCA-D1-MC5): một hồ sơ làm hỏng phép tính việc không được làm sập màn Hôm nay.
// Giả lập hồ sơ bẩn: hetThu ném lỗi riêng cho các ghi danh của một em (chọn trong test).
import { beforeAll, describe, expect, it, vi } from "vitest";
import { lucVN } from "@/lib/ngay";
import { CHU, db, napSeed, nguoi } from "./chung";
import { homNay } from "@/server/hom-nay";

const ban = vi.hoisted(() => ({ gdIds: new Set<number>() }));
vi.mock("@/lib/quy-tac", async (goc) => {
  const m = await goc<typeof import("@/lib/quy-tac")>();
  return { ...m, hetThu: (gds: Parameters<typeof m.hetThu>[0], h: string) => {
    if (gds.some((g) => g.id !== undefined && ban.gdIds.has(g.id))) throw new Error("hồ sơ bẩn (giả lập)");
    return m.hetThu(gds, h);
  } };
});

beforeAll(async () => {
  await napSeed();
});

describe("Hôm nay chịu được hồ sơ bẩn", () => {
  it("em HS0022 làm lỗi → vẫn trả đủ khối; em đó thành 'Sửa dữ liệu · loi_tinh'; các em khác vẫn có việc", async () => {
    const chu = await nguoi(CHU);
    const T22 = lucVN("2026-11-26", "22:00");
    const truoc = await homNay(chu, T22);
    expect(truoc.viec.some((v) => v.khoa === "HS0022" && v.loai === "thu_sap_het")).toBe(true);
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0022" }, include: { ghi_danh: true } });
    for (const g of hs.ghi_danh) ban.gdIds.add(g.id);
    const d = await homNay(chu, T22);
    expect(d.viec.find((v) => v.khoa === "HS0022" && v.loai === "sua_du_lieu")).toMatchObject({ loi: ["loi_tinh"] });
    expect(d.viec.filter((v) => v.khoa === "HS0022" && v.loai !== "sua_du_lieu")).toHaveLength(0);
    const khac = (x: typeof d) => x.viec.filter((v) => v.khoa !== "HS0022").map((v) => `${v.loai}|${v.khoa}`);
    expect(khac(d)).toEqual(khac(truoc));
    expect(d.lop_toi_nay).toEqual(truoc.lop_toi_nay);
    expect(d.lich_7_ngay).toHaveLength(7);
  });
});
