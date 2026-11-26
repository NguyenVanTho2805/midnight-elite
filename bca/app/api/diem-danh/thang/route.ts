import { route } from "@/server/api";
import { maTranThang } from "@/server/diem-danh";
import { ngayVN } from "@/lib/ngay";

/** ?mon=toan&thang=2026-11 */
export const GET = route((u, req) => {
  const q = new URL(req.url).searchParams;
  return maTranThang(u, q.get("mon") ?? "", q.get("thang") ?? ngayVN(new Date()).slice(0, 7));
});
