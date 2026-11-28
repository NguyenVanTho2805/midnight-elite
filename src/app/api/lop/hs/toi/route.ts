// Khu học sinh: dữ liệu lớp ôn của CHÍNH em đang đăng nhập (không nhận id học sinh từ request).
import { routeHs } from "@/lib/lop/server/api";
import { cuaToi } from "@/lib/lop/server/hs";

export const GET = routeHs((u) => cuaToi(u));
