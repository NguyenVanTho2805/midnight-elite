import { route } from "@/server/api";
import { xemNhatKy } from "@/server/nhat-ky";

/** ?doi_tuong=ghi_danh&id=12&gioi_han=100 */
export const GET = route((u, req) => {
  const q = new URL(req.url).searchParams;
  return xemNhatKy(u, { doiTuong: q.get("doi_tuong") ?? undefined, id: q.get("id") ?? undefined, gioiHan: Number(q.get("gioi_han")) || undefined });
});
