// Bao mọi route handler: đọc phiên từ cookie của request, bắt lỗi quyền → 403 (+ nhật ký "từ chối").
import { LoiDuLieu, LoiQuyen, type Nguoi } from "@/lib/quyen";
import { LoiQuyTac } from "@/lib/quy-tac";
import { d2s, s2d } from "@/lib/ngay";
import { nguoiTuToken } from "./phien";
import { docCookie } from "./token";
import { ghiTuChoi } from "./nhat-ky";

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
        await ghiTuChoi(u, req.method, new URL(req.url).pathname, e.message);
        return Response.json({ loi: e.message }, { status: 403 });
      }
      if (e instanceof LoiDuLieu) return Response.json({ loi: e.message, ma: e.ma }, { status: e.status });
      if (e instanceof LoiQuyTac) return Response.json({ loi: e.message }, { status: 409 });
      if (isExclusion(e)) return Response.json({ loi: "Ghi danh bị chồng ngày với một ghi danh khác cùng môn" }, { status: 409 });
      // Hai thao tác cùng lúc: trùng khoá duy nhất (P2002) hoặc dòng vừa bị người khác xoá/sửa (P2025) ⇒ 409, không 500.
      const ma = (e as { code?: unknown })?.code;
      if (ma === "P2002") return Response.json({ loi: "Dữ liệu vừa được tạo trùng (có thể do thao tác cùng lúc) — tải lại rồi thử lại", ma: "trung" }, { status: 409 });
      if (ma === "P2025") return Response.json({ loi: "Dữ liệu vừa bị thay đổi bởi thao tác khác — tải lại rồi thử lại", ma: "da_doi" }, { status: 409 });
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
