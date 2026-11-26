import { route } from "@/server/api";
import { boAnHocSinh } from "@/server/ghi-danh";

/** Chỉ chủ. Bỏ ẩn; khôi phục ngày ghi danh cũ nếu bỏ ẩn ngay trong ngày và chưa ghi danh lại (ghi-danh.md 10.2). */
export const POST = route<{ maHs: string }>((u, _req, p) => boAnHocSinh(u, p.maHs));
