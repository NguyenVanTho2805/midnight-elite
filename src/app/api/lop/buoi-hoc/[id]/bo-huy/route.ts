import { canChu } from "@/lib/lop/quyen";
import { route, soNguyen } from "@/lib/lop/server/api";
import { boHuyBuoi } from "@/lib/lop/server/buoi-hoc";

/** Chỉ chủ. */
export const POST = route<{ id: string }>(async (u, _req, p) => {
  canChu(u);
  return boHuyBuoi(u, soNguyen(p.id, "id"));
});
