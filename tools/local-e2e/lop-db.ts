// Dùng chung cho các bài t-lop-* có DB (KiN lớp bước 5). KHÔNG gọi wipe(): chỉ nạp lại 13 bảng bca_* từ DB dữ liệu giả `bca_gia` (cùng máy chủ Postgres cục bộ)
// bằng scripts/lop-chuyen-du-lieu.ts --apply --ghi-de — trước bài (trạng thái biết trước, "hôm nay" của dữ liệu = 26/11/2026) và sau bài (trả lại cho lần chạy thử tay).
import { execFileSync } from "node:child_process";
import { prisma as db } from "@/lib/prisma";
import { lucVN } from "@/lib/lop/ngay";
import type { NguoiQuanLy } from "@/lib/lop/quyen";

export function napLaiBca() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error("Bài này ghi đè bảng bca_*: chỉ chạy với DATABASE_URL ở localhost");
  const ra = execFileSync("npx", ["tsx", "scripts/lop-chuyen-du-lieu.ts", "--apply", "--ghi-de"], { env: { ...process.env, LOP_GHI_DE_DA_NOI: "1", LOP_NGUON_URL: url.replace(/\/[^/?]+(\?.*)?$/, "/bca_gia"), LOP_DICH_URL: url }, encoding: "utf8" });
  if (!/"ket_qua": "KHỚP"/.test(ra)) throw new Error("Nạp lại bca_* không khớp:\n" + ra.slice(-600));
}

export const CHU = "chu.thu@bca.invalid", GV_TOAN = "gv.toan@bca.invalid", GV_ANH = "gv.anh@bca.invalid";
/** Người quản lý dựng thẳng từ bca_nguoi_dung (id = uuid của bảng đó, đúng như nguoiLopBca trả). */
export async function nguoi(gmail: string): Promise<NguoiQuanLy> {
  const nd = await db.bcaNguoiDung.findUniqueOrThrow({ where: { gmail }, include: { phan_cong: true } });
  return { vai: nd.vai_tro, id: nd.id, ten: nd.ten_hien_thi, monIds: nd.phan_cong.map((p) => p.mon_id) };
}
export const buoiId = async (mon: number, ngay: string, gio = "22:15") => (await db.bcaBuoiHoc.findUniqueOrThrow({ where: { mon_id_bat_dau_luc: { mon_id: mon, bat_dau_luc: lucVN(ngay, gio) } } })).id;
export const hsId = async (ma: string) => (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: ma } })).id;
/** Lỗi mà hàm ném ra (null nếu không ném) — để so `ma` / `status` / lớp lỗi. */
export const loi = async (f: () => Promise<unknown>) => { try { await f(); return null; } catch (e) { return e as { ma?: string; status?: number; message: string }; } };
export const giay = (goc: Date, s: number) => new Date(goc.getTime() + s * 1000);
export { db };
