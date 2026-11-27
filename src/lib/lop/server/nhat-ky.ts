// Nhật ký của lớp (chép từ bca/server/nhat-ky.ts). `u.id` phải là bca_nguoi_dung.id (nguoiLopBca).
import { prisma as db } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Nguoi } from "../quyen";
import type { Tx } from "./du-lieu";

type J = Prisma.InputJsonValue | null;
/** phan-quyen.md Điều 6: mọi thay đổi ghi danh, buổi, điểm danh đều ghi ai, vai, lúc, trước/sau. */
export function ghiNhatKy(u: Nguoi | null, hanh_dong: string, doi_tuong: string, doi_tuong_id: string | number | null, truoc: J, sau: J, tx: Tx = db) {
  return tx.bcaNhatKy.create({
    data: {
      nguoi_dung_id: u && u.vai !== "hoc_sinh" ? u.id : null,
      vai_tro: u ? (u.vai === "hoc_sinh" ? `hoc_sinh:${u.hocSinhId}` : u.vai) : "he_thong",
      hanh_dong, doi_tuong, doi_tuong_id: doi_tuong_id === null ? null : String(doi_tuong_id),
      truoc: truoc ?? undefined, sau: sau ?? undefined,
    },
  });
}

/** Nhật ký "từ chối" (phan-quyen.md 4.1), tối đa 1 dòng / người / mẫu route (phương thức + đường dẫn, id gộp thành :id) / phút: lần lặp trong phút đó tăng `sau.so_lan`. */
export async function ghiTuChoi(u: Nguoi, phuongThuc: string, duongDan: string, lyDo: string, luc = new Date()) {
  // Số trong đường dẫn gộp thành :id — vòng lặp dò /buoi/1..N chỉ sinh MỘT dòng mỗi phút (đường dẫn thật vẫn nằm ở sau.duong_dan của lần đầu).
  const khoa = `${phuongThuc} ${duongDan.replace(/\/\d+(?=\/|$)/g, "/:id")}`;
  const gan = await db.bcaNhatKy.findFirst({
    where: { hanh_dong: "tu_choi", doi_tuong: "request", doi_tuong_id: khoa, luc: { gt: new Date(luc.getTime() - 60_000) }, ...(u.vai === "hoc_sinh" ? { vai_tro: `hoc_sinh:${u.hocSinhId}` } : { nguoi_dung_id: u.id }) },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!gan) await ghiNhatKy(u, "tu_choi", "request", khoa, null, { phuong_thuc: phuongThuc, duong_dan: duongDan, ly_do: lyDo, so_lan: 1 });
  // Tăng ngay trong câu UPDATE (không đọc-rồi-ghi) để hai lần từ chối cùng lúc không mất lượt đếm.
  else await db.$executeRaw`UPDATE bca_nhat_ky SET sau = jsonb_set(sau, '{so_lan}', to_jsonb(COALESCE((sau->>'so_lan')::int, 1) + 1)) WHERE id = ${gan.id}`;
}

/** Khoá dòng nhật ký của thao tác gốc tới hết transaction: hai lần hoàn tác cùng lúc ⇒ lần sau thấy lần trước đã xong ⇒ 409. */
export const khoaNhatKy = (tx: Tx, id: number) => tx.$queryRaw`SELECT id FROM bca_nhat_ky WHERE id = ${id} FOR UPDATE`;
