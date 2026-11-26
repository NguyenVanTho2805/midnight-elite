import { route, soNguyen } from "@/server/api";
import { boHuyBuoi } from "@/server/buoi-hoc";

export const POST = route<{ id: string }>((u, _req, p) => boHuyBuoi(u, soNguyen(p.id, "id")));
