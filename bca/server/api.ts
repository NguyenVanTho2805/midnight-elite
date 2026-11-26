// Bao mọi route handler: đọc phiên từ cookie của request, bắt lỗi quyền → 403 (+ nhật ký "từ chối").
import { LoiDuLieu, LoiQuyen, type Nguoi } from "@/lib/quyen";
import { LoiQuyTac } from "@/lib/quy-tac";
import { nguoiTuToken } from "./phien";
import { docCookie } from "./token";
import { ghiNhatKy } from "./nhat-ky";

export type Ctx<P = Record<string, string>> = { params: Promise<P> };

export function route<P = Record<string, string>>(fn: (u: Nguoi, req: Request, params: P) => Promise<unknown>) {
  return async (req: Request, ctx?: Ctx<P>) => {
    const u = await nguoiTuToken(docCookie(req.headers.get("cookie")));
    if (!u) return Response.json({ loi: "Chưa đăng nhập" }, { status: 401 });
    try {
      const params = (await ctx?.params) ?? ({} as P);
      return Response.json(await fn(u, req, params));
    } catch (e) {
      if (e instanceof LoiQuyen) {
        await ghiNhatKy(u, "tu_choi", "request", null, null, { phuong_thuc: req.method, duong_dan: new URL(req.url).pathname, ly_do: e.message });
        return Response.json({ loi: e.message }, { status: 403 });
      }
      if (e instanceof LoiDuLieu) return Response.json({ loi: e.message, ma: e.ma }, { status: e.status });
      if (e instanceof LoiQuyTac) return Response.json({ loi: e.message }, { status: 409 });
      if (isExclusion(e)) return Response.json({ loi: "Ghi danh bị chồng ngày với một ghi danh khác cùng môn" }, { status: 409 });
      throw e;
    }
  };
}

const isExclusion = (e: unknown) => /ghi_danh_khong_chong_ngay|23P01/.test(String((e as Error)?.message ?? "") + JSON.stringify(e ?? {}));

export async function docJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {}
  throw new LoiDuLieu("Thân request phải là JSON object");
}
export const soNguyen = (v: unknown, ten: string) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new LoiDuLieu(`${ten} không hợp lệ`);
  return n;
};
export const ngayHopLe = (v: unknown, ten: string) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) throw new LoiDuLieu(`${ten} phải dạng YYYY-MM-DD`);
  return v;
};
