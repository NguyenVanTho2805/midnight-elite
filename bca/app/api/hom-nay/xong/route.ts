import { docJson, route } from "@/server/api";
import { boDanhDauXong, danhDauXong } from "@/server/hom-nay";

/** { loai: "thu_sap_het", khoa: "HS0021" } — chỉ chủ. Ẩn theo hom-nay.md 3.3 (T33). */
export const POST = route(async (u, req) => {
  const b = await docJson(req);
  return danhDauXong(u, String(b.loai ?? ""), String(b.khoa ?? ""));
});

/** ?loai=…&khoa=… — bỏ đánh dấu (Hoàn tác), chỉ chủ. */
export const DELETE = route(async (u, req) => {
  const q = new URL(req.url).searchParams;
  return boDanhDauXong(u, q.get("loai") ?? "", q.get("khoa") ?? "");
});
