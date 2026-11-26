import { route, soNguyen } from "@/server/api";
import { buoiCuaToi } from "@/server/hs";

export const GET = route<{ id: string }>((u, _req, p) => buoiCuaToi(u, soNguyen(p.id, "id")));
