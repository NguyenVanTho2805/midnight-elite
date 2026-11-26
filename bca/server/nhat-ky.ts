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
