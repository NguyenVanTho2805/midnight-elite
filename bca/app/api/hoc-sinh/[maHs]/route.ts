import { route } from "@/server/api";
import { chiTietHocSinh } from "@/server/hoc-sinh";

export const GET = route<{ maHs: string }>((u, _req, p) => chiTietHocSinh(u, p.maHs));
