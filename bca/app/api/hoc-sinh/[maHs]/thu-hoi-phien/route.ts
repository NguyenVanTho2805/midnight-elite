import { route } from "@/server/api";
import { thuHoiPhienHocSinh } from "@/server/hoc-sinh";

/** Chỉ chủ (T41): đăng xuất học sinh khỏi mọi máy ngay. */
export const POST = route<{ maHs: string }>((u, _req, p) => thuHoiPhienHocSinh(u, p.maHs));
