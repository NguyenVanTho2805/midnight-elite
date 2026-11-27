// Cửa vào các trang của lớp. Gọi ở ĐẦU mỗi trang (trang chạy lại mỗi request; layout thì không). Người trả về có id = bca_nguoi_dung.id (nguoiLopBca).
import { notFound, redirect } from "next/navigation";
import { LOP_ON } from "@/lib/features";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { nguoiLopBca } from "../phien";
import type { NguoiQuanLy } from "../quyen";

/** /admin/lop-on: cờ tắt ⇒ 404. Không phải chủ lớp (kể cả chưa đăng nhập) ⇒ về /admin như các trang quản trị thiếu quyền (PermissionGuard, topups/layout). */
export async function chuLop(): Promise<NguoiQuanLy> {
  if (!LOP_ON) notFound();
  const u = await nguoiLopBca();
  if (u?.vai !== "chu") redirect("/admin");
  return u;
}

/** /lop-cua-toi/lop-on (bước 5): cờ tắt ⇒ 404; không phải gia sư ⇒ theo cổng gia sư của KiN. Trả null khi gia sư chưa có tài khoản lớp / chưa được phân công môn nào. */
export async function giaoVienLop(path: string): Promise<NguoiQuanLy | null> {
  if (!LOP_ON) notFound();
  await redirectIfNotTutor(await getSession(), { path });
  const u = await nguoiLopBca();
  return u?.vai === "giao_vien" && u.monIds.length ? u : null;
}
