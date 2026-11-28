import { canChu } from "@/lib/lop/quyen";
import { docJson, route } from "@/lib/lop/server/api";
import { boDanhDauXong, danhDauXong } from "@/lib/lop/server/hom-nay";

/** { loai: "thu_sap_het", khoa: "HS0021" } — chỉ chủ. Ẩn theo hom-nay.md 3.3 (T33): học thử 3 ngày, việc khác hết hôm nay. */
export const POST = route(async (u, req) => {
  canChu(u);
  const b = await docJson(req);
  return danhDauXong(u, String(b.loai ?? ""), String(b.khoa ?? ""));
});

/** ?loai=…&khoa=… — bỏ đánh dấu (Hoàn tác), chỉ chủ. */
export const DELETE = route(async (u, req) => {
  canChu(u);
  const q = new URL(req.url).searchParams;
  return boDanhDauXong(u, q.get("loai") ?? "", q.get("khoa") ?? "");
});
