import { docJson, ngayHopLe, route } from "@/server/api";
import { themHocBu } from "@/server/buoi-hoc";

/** { mon, ngay, gio?: "22:15", soPhut?: 90, buChoBuoiId?, ghiChu? } — chỉ chủ. */
export const POST = route(async (u, req) => {
  const b = await docJson(req);
  return themHocBu(u, {
    mon: String(b.mon ?? ""), ngay: ngayHopLe(b.ngay, "ngay"), gio: b.gio ? String(b.gio) : undefined,
    soPhut: b.soPhut === undefined ? undefined : Number(b.soPhut), buChoBuoiId: b.buChoBuoiId ? Number(b.buChoBuoiId) : undefined, ghiChu: b.ghiChu ? String(b.ghiChu) : undefined,
  });
});
