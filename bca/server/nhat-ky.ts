import { LoiQuyen, type Nguoi } from "@/lib/quyen";
import { db, type Tx } from "./db";
import type { Prisma } from "@/generated/prisma/client";

type J = Prisma.InputJsonValue | null;
/** phan-quyen.md Điều 6: mọi thay đổi ghi danh, buổi, điểm danh đều ghi ai, vai, lúc, trước/sau. */
export function ghiNhatKy(u: Nguoi | null, hanh_dong: string, doi_tuong: string, doi_tuong_id: string | number | null, truoc: J, sau: J, tx: Tx = db) {
  return tx.nhat_ky.create({
    data: {
      nguoi_dung_id: u && u.vai !== "hoc_sinh" ? u.id : null,
      vai_tro: u ? (u.vai === "hoc_sinh" ? `hoc_sinh:${u.hocSinhId}` : u.vai) : "he_thong",
      hanh_dong, doi_tuong, doi_tuong_id: doi_tuong_id === null ? null : String(doi_tuong_id),
      truoc: truoc ?? undefined, sau: sau ?? undefined,
    },
  });
}

/** Nhật ký "từ chối" (phan-quyen.md 4.1), tối đa 1 dòng / người / route (phương thức + đường dẫn) / phút: lần lặp trong phút đó tăng `sau.so_lan`. */
export async function ghiTuChoi(u: Nguoi, phuongThuc: string, duongDan: string, lyDo: string, luc = new Date()) {
  const khoa = `${phuongThuc} ${duongDan}`;
  const gan = await db.nhat_ky.findFirst({
    where: { hanh_dong: "tu_choi", doi_tuong: "request", doi_tuong_id: khoa, luc: { gt: new Date(luc.getTime() - 60_000) }, ...(u.vai === "hoc_sinh" ? { vai_tro: `hoc_sinh:${u.hocSinhId}` } : { nguoi_dung_id: u.id }) },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!gan) await ghiNhatKy(u, "tu_choi", "request", khoa, null, { phuong_thuc: phuongThuc, duong_dan: duongDan, ly_do: lyDo, so_lan: 1 });
  // Tăng ngay trong câu UPDATE (không đọc-rồi-ghi) để hai lần từ chối cùng lúc không mất lượt đếm.
  else await db.$executeRaw`UPDATE nhat_ky SET sau = jsonb_set(sau, '{so_lan}', to_jsonb(COALESCE((sau->>'so_lan')::int, 1) + 1)) WHERE id = ${gan.id}`;
}

/** Khoá dòng nhật ký của thao tác gốc tới hết transaction: hai lần hoàn tác cùng lúc ⇒ lần sau thấy lần trước đã xong ⇒ 409. */
export const khoaNhatKy = (tx: Tx, id: number) => tx.$queryRaw`SELECT id FROM nhat_ky WHERE id = ${id} FOR UPDATE`;

/** Chủ xem tất cả; GV chỉ thay đổi của chính mình (phan-quyen.md Điều 3). */
export async function xemNhatKy(u: Nguoi, opt: { doiTuong?: string; id?: string; gioiHan?: number }) {
  if (u.vai === "hoc_sinh") throw new LoiQuyen("Học sinh không xem nhật ký");
  return db.nhat_ky.findMany({
    where: { ...(opt.doiTuong ? { doi_tuong: opt.doiTuong } : {}), ...(opt.id ? { doi_tuong_id: opt.id } : {}), ...(u.vai === "chu" ? {} : { nguoi_dung_id: u.id }) },
    orderBy: { luc: "desc" },
    take: Math.min(Math.max(opt.gioiHan ?? 100, 1), 500),
  });
}
