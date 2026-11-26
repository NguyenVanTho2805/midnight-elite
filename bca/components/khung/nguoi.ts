// Người dùng hiện tại cho trang khu quản lý (máy chủ). React.cache: layout và trang dùng chung một lần đọc.
import { cache } from "react";
import { forbidden, notFound, redirect } from "next/navigation";
import { nguoiHienTai } from "@/server/phien";
import { LoiDuLieu, LoiQuyen, type NguoiQuanLy } from "@/lib/quyen";

export const layNguoiQuanLy = cache(async (): Promise<NguoiQuanLy> => {
  const u = await nguoiHienTai();
  if (!u) redirect("/dang-nhap");
  if (u.vai === "hoc_sinh") redirect("/hoc");
  return u;
});

/** Gọi hàm máy chủ; lỗi quyền → forbidden() (HTTP 403 thật, giao diện ở quan-ly/forbidden.tsx; cần
 *  `experimental.authInterrupts` trong next.config.ts); không có → 404. */
export async function tai<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LoiQuyen) forbidden();
    if (e instanceof LoiDuLieu && e.status === 404) notFound();
    throw e;
  }
}
