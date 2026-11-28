// Nhật ký của lớp (chép từ bca/server/nhat-ky.ts). `u.id` phải là bca_nguoi_dung.id (nguoiLopBca).
import { prisma as db } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Nguoi } from "../quyen";
import { ID_RONG } from "../phien";
import type { Tx } from "./du-lieu";

type J = Prisma.InputJsonValue | null;
/** phan-quyen.md Điều 6: mọi thay đổi ghi danh, buổi, điểm danh đều ghi ai, vai, lúc, trước/sau. */
const idGhi = (u: Nguoi | null) => (u && u.vai !== "hoc_sinh" && u.id !== ID_RONG ? u.id : null);
export function ghiNhatKy(u: Nguoi | null, hanh_dong: string, doi_tuong: string, doi_tuong_id: string | number | null, truoc: J, sau: J, tx: Tx = db) {
  return tx.bcaNhatKy.create({
    data: {
      nguoi_dung_id: idGhi(u),
      vai_tro: u ? (u.vai === "hoc_sinh" ? `hoc_sinh:${u.hocSinhId}` : u.vai) : "he_thong",
      hanh_dong, doi_tuong, doi_tuong_id: doi_tuong_id === null ? null : String(doi_tuong_id),
      truoc: truoc ?? undefined, sau: sau ?? undefined,
    },
  });
}

/** Nhật ký "từ chối" (phan-quyen.md 4.1), tối đa 1 dòng / người / mẫu route (phương thức + đường dẫn, id gộp thành :id) / phút: lần lặp trong phút đó tăng `sau.so_lan`. */
export async function ghiTuChoi(u: Nguoi, phuongThuc: string, duongDan: string, lyDo: string, luc = new Date()) {
  // Số trong đường dẫn gộp thành :id — vòng lặp dò /buoi/1..N chỉ sinh MỘT dòng mỗi phút (đường dẫn thật vẫn nằm ở sau.duong_dan của lần đầu).
  const khoa = `${phuongThuc} ${duongDan.replace(/\/\d+(?=\/|$)/g, () => `/${":id"}`)}`;
  const gan = await db.bcaNhatKy.findFirst({
    where: { hanh_dong: "tu_choi", doi_tuong: "request", doi_tuong_id: khoa, luc: { gt: new Date(luc.getTime() - 60_000) }, ...(u.vai === "hoc_sinh" ? { vai_tro: `hoc_sinh:${u.hocSinhId}` } : { nguoi_dung_id: idGhi(u), vai_tro: u.vai }) },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!gan) await ghiNhatKy(u, "tu_choi", "request", khoa, null, { phuong_thuc: phuongThuc, duong_dan: duongDan, ly_do: lyDo, so_lan: 1 });
  // Tăng ngay trong câu UPDATE (không đọc-rồi-ghi) để hai lần từ chối cùng lúc không mất lượt đếm.
  else await db.$executeRaw`UPDATE bca_nhat_ky SET sau = jsonb_set(sau, '{so_lan}', to_jsonb(COALESCE((sau->>'so_lan')::int, 1) + 1)) WHERE id = ${gan.id}`;
}

/** Khoá dòng nhật ký của thao tác gốc tới hết transaction: hai lần hoàn tác cùng lúc ⇒ lần sau thấy lần trước đã xong ⇒ 409. */
export const khoaNhatKy = (tx: Tx, id: number) => tx.$queryRaw`SELECT id FROM bca_nhat_ky WHERE id = ${id} FOR UPDATE`;

export const HAN_TU_CHOI_NGAY = 90, HAN_SUA_HO_SO_NGAY = 365;
/**
 * Hạn lưu nhật ký (chủ quyết 28/11/2026; cron /api/cron/lop-don-nhat-ky chạy mỗi ngày): dòng "từ chối" quá 90 ngày ⇒ xoá;
 * dòng sửa hồ sơ quá 365 ngày ⇒ GIỮ dòng (ai, lúc nào) nhưng xoá giá trị trước/sau (SĐT, Gmail cũ của học sinh). Các nhật ký khác (ghi danh, điểm danh, buổi) giữ nguyên: cần cho đối soát.
 */
export async function donNhatKy(luc = new Date()) {
  const truoc = (ngay: number) => new Date(luc.getTime() - ngay * 86400_000);
  const { count: tu_choi } = await db.bcaNhatKy.deleteMany({ where: { hanh_dong: "tu_choi", luc: { lt: truoc(HAN_TU_CHOI_NGAY) } } });
  const sua_ho_so = await db.$executeRaw`UPDATE bca_nhat_ky SET truoc = NULL, sau = NULL WHERE hanh_dong = 'sua_ho_so_hoc_sinh' AND luc < ${truoc(HAN_SUA_HO_SO_NGAY)} AND (truoc IS NOT NULL OR sau IS NOT NULL)`;
  return { tu_choi, sua_ho_so };
}
