// Phiên → người dùng. Mỗi request nạp lại từ CSDL.
import type { Nguoi } from "@/lib/quyen";
import { db } from "./db";
import { docPhien, TEN_COOKIE } from "./token";

/** Nạp người dùng từ CSDL mỗi request: tài khoản bị khoá / phiên bị thu hồi / mất phân công có hiệu lực ngay. */
export async function nguoiTuToken(token?: string | null): Promise<Nguoi | null> {
  const p = await docPhien(token);
  if (!p) return null;
  if (p.vai === "hs") {
    const hs = await db.hoc_sinh.findUnique({ where: { id: Number(p.sub) }, select: { id: true, ho_ten: true } });
    return hs ? { vai: "hoc_sinh", hocSinhId: hs.id, ten: hs.ho_ten } : null;
  }
  const nd = await db.nguoi_dung.findUnique({ where: { id: p.sub }, include: { phan_cong: true } });
  if (!nd || nd.khoa_luc) return null;
  if (nd.phien_huy_luc && p.bd * 1000 < nd.phien_huy_luc.getTime()) return null;
  return { vai: nd.vai_tro, id: nd.id, ten: nd.ten_hien_thi, monIds: nd.phan_cong.map((x) => x.mon_id) };
}

/** Cho Server Component / trang: đọc cookie qua next/headers. */
export async function nguoiHienTai() {
  const { cookies } = await import("next/headers");
  return nguoiTuToken((await cookies()).get(TEN_COOKIE)?.value);
}
