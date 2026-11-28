// Khu học sinh: một buổi của em. Buổi không thuộc lớp của em ⇒ 403; môn đã hết hạn ⇒ 403 het_han.
import { routeHs, soNguyen } from "@/lib/lop/server/api";
import { buoiCuaToi } from "@/lib/lop/server/hs";

export const GET = routeHs<{ id: string }>((u, _req, p) => buoiCuaToi(u, soNguyen(p.id, "id")));
