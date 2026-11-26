import { route } from "@/server/api";
import { danhSachDon } from "@/server/don";

export const GET = route((u, req) => danhSachDon(u, { trangThai: new URL(req.url).searchParams.get("trang_thai") ?? undefined }));
