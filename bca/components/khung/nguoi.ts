// Người dùng hiện tại cho trang khu quản lý (máy chủ). React.cache: layout và trang dùng chung một lần đọc.
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { nguoiHienTai } from "@/server/phien";
import { LoiDuLieu, LoiQuyen, type NguoiQuanLy } from "@/lib/quyen";

export const layNguoiQuanLy = cache(async (): Promise<NguoiQuanLy> => {
  const u = await nguoiHienTai();
  if (!u) redirect("/dang-nhap");
  if (u.vai === "hoc_sinh") redirect("/hoc");
  return u;
});

/** Gọi hàm máy chủ; lỗi quyền → { cam: true } để trang hiện 403 gọn; không có → 404. */
export async function tai<T>(fn: () => Promise<T>): Promise<{ cam: false; d: T } | { cam: true; d?: undefined }> {
  try {
    return { cam: false, d: await fn() };
  } catch (e) {
    if (e instanceof LoiQuyen) return { cam: true };
    if (e instanceof LoiDuLieu && e.status === 404) notFound();
    throw e;
  }
}
