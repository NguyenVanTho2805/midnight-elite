// Bao mọi route handler /api/lop/* (chép từ bca/server/api.ts): cờ tắt ⇒ 404; người lấy từ phiên KiN (nguoiLopBca, id = bca_nguoi_dung.id);
// lỗi quyền ⇒ 403 + nhật ký "từ chối". Thân lỗi theo quy ước KiN: { error, ma? }.
import { NextResponse } from "next/server";
import { LOP_ON } from "@/lib/features";
import { getSession } from "@/lib/session";
import { d2s, s2d } from "../ngay";
import { nguoiLop, nguoiLopBca } from "../phien";
import { LoiDuLieu, LoiQuyen, type Nguoi, type NguoiHocSinh, type NguoiQuanLy } from "../quyen";
import { LoiQuyTac } from "../quy-tac";
import { ghiTuChoi } from "./nhat-ky";

export type Ctx<P = Record<string, string>> = { params: Promise<P> };
const loi = (error: string, status: number, ma?: string) => NextResponse.json({ error, ma }, { status });

function bao<U extends Nguoi, P>(lay: (req: Request) => Promise<U | null>, khongQuyen: string, fn: (u: U, req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    if (!LOP_ON) return loi("Không tìm thấy", 404);
    const u = await lay(req);
    if (!u) return (await getSession()) ? loi(khongQuyen, 403) : loi("Chưa đăng nhập", 401);
    try {
      return NextResponse.json(await fn(u, req, await ctx.params));
    } catch (e) {
      if (e instanceof LoiQuyen) {
        await ghiTuChoi(u, req.method, new URL(req.url).pathname, e.message);
        return loi(e.message, 403);
      }
      if (e instanceof LoiDuLieu) return loi(e.message, e.status, e.ma);
      if (e instanceof LoiQuyTac) return loi(e.message, 409);
      // Hai thao tác cùng lúc: trùng khoá duy nhất (P2002) hoặc dòng vừa bị người khác xoá/sửa (P2025) ⇒ 409, không 500.
      const ma = (e as { code?: unknown })?.code;
      if (ma === "P2002") return loi("Dữ liệu vừa được tạo trùng (có thể do thao tác cùng lúc) — tải lại rồi thử lại", 409, "trung");
      if (ma === "P2025") return loi("Dữ liệu vừa bị thay đổi bởi thao tác khác — tải lại rồi thử lại", 409, "da_doi");
      console.error(`[${req.method} ${new URL(req.url).pathname}]`, e);
      return loi("Máy chủ gặp lỗi", 500);
    }
  };
}

/** Route của chủ lớp / giáo viên. Chủ lớp chưa có dòng bca_nguoi_dung chỉ được tạo dòng ở request GHI. */
export const route = <P = Record<string, string>>(fn: (u: NguoiQuanLy, req: Request, params: P) => Promise<unknown>) =>
  bao((req) => nguoiLopBca(req.method !== "GET"), "Bạn không có quyền vào lớp ôn", fn);

/** Route của HỌC SINH (/api/lop/hs/*, bước 7): chỉ người đã nối hồ sơ lớp còn hiệu lực; chủ / giáo viên / học sinh KiN không có hồ sơ ⇒ 403. Không nhận id học sinh từ request. */
export const routeHs = <P = Record<string, string>>(fn: (u: NguoiHocSinh, req: Request, params: P) => Promise<unknown>) =>
  bao(async () => { const u = await nguoiLop(); return u?.vai === "hoc_sinh" ? u : null; }, "Khu này dành cho học sinh của lớp ôn", fn);

export async function docJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {}
  throw new LoiDuLieu("Thân request phải là JSON object");
}
/** Số nguyên vừa cột int4 của Postgres (id vượt int32 / NaN / số lẻ / "0x2" / "1e3" ⇒ 400, không 500). */
export const soNguyen = (v: unknown, ten: string) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) throw new LoiDuLieu(`${ten} không hợp lệ`);
  return n;
};
/** Ngày có thật dạng YYYY-MM-DD (2026-02-30 ⇒ 400). */
export const ngayHopLe = (v: unknown, ten: string) => {
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? s2d(v) : null;
  if (!d || isNaN(d.getTime()) || d2s(d) !== v) throw new LoiDuLieu(`${ten} phải là ngày có thật dạng YYYY-MM-DD`);
  return v as string;
};
