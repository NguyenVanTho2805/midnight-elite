import { route } from "@/server/api";
import { danhSachNguoiDung } from "@/server/nguoi-dung";

export const GET = route((u) => danhSachNguoiDung(u));
