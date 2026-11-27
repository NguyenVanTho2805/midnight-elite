// Cửa vào các trang /admin/lop-on (bước 4: chỉ chủ lớp). Gọi ở ĐẦU mỗi trang (trang chạy lại mỗi request; layout thì không).
import { notFound, redirect } from "next/navigation";
import { LOP_ON } from "@/lib/features";
import { nguoiLop } from "../phien";
import type { NguoiQuanLy } from "../quyen";

/** Cờ tắt ⇒ 404. Không phải chủ lớp (kể cả chưa đăng nhập) ⇒ về /admin như các trang quản trị thiếu quyền (PermissionGuard, topups/layout). */
export async function chuLop(): Promise<NguoiQuanLy> {
  if (!LOP_ON) notFound();
  const u = await nguoiLop();
  if (u?.vai !== "chu") redirect("/admin");
  return u;
}
