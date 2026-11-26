import { route } from "@/server/api";
import { danhSachHocSinh } from "@/server/hoc-sinh";

export const GET = route((u, req) => danhSachHocSinh(u, { coAn: new URL(req.url).searchParams.get("an") === "1" }));
