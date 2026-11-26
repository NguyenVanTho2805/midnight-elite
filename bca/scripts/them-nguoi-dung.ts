// Thêm / cập nhật tài khoản chủ lớp hoặc giáo viên (T17, phan-quyen.md 5.1: "chủ nhập Gmail rồi chọn môn").
// Dùng để tạo tài khoản chủ ĐẦU TIÊN trên DB thật (T50) và thêm GV khi chưa có màn Tài khoản.
// Chạy (chủ, trên máy mình):
//   BCA_DATABASE_URL=<chuỗi Neon> npx tsx scripts/them-nguoi-dung.ts --gmail ten@gmail.com --ten "Tên hiển thị" --vai chu
//   BCA_DATABASE_URL=<chuỗi Neon> npx tsx scripts/them-nguoi-dung.ts --gmail gv@gmail.com --ten "Cô Hoa" --vai giao_vien --mon toan
// Lặp lại an toàn: Gmail đã có ⇒ cập nhật tên/vai, THÊM môn còn thiếu (không bỏ môn cũ, không mở khoá tài khoản đã khoá).
// Không xoá gì. Nhật ký ghi vai "he_thong" (không tính là "web đã vận hành" với chuyen-tu-sheet).
import { chuanHoaGmail, gmailHopLe } from "../lib/chuan-hoa";
import type { PrismaClient } from "../generated/prisma/client";

export type NguoiMoi = { gmail: string; ten: string; vai: "chu" | "giao_vien"; mon: string[] };

export async function themNguoiDung(db: PrismaClient, v: NguoiMoi) {
  const gmail = chuanHoaGmail(v.gmail);
  if (!gmail || !gmailHopLe(gmail)) throw new Error("Gmail không hợp lệ");
  const ten = v.ten.trim();
  if (!ten) throw new Error("Thiếu --ten");
  if (v.vai !== "chu" && v.vai !== "giao_vien") throw new Error('--vai phải là "chu" hoặc "giao_vien"');
  if (v.vai === "chu" && v.mon.length) throw new Error("Chủ lớp thấy mọi môn — không cần --mon");
  const mons = await db.mon.findMany({ where: { ma: { in: v.mon } }, select: { id: true, ma: true } });
  const thieu = v.mon.filter((m) => !mons.some((x) => x.ma === m));
  if (thieu.length) throw new Error(`Không có môn: ${thieu.join(", ")} (chạy chuyen-tu-sheet trước để có bảng môn)`);
  return db.$transaction(async (tx) => {
    const cu = await tx.nguoi_dung.findUnique({ where: { gmail }, include: { phan_cong: true } });
    const nd = cu
      ? await tx.nguoi_dung.update({ where: { id: cu.id }, data: { ten_hien_thi: ten, vai_tro: v.vai } })
      : await tx.nguoi_dung.create({ data: { gmail, ten_hien_thi: ten, vai_tro: v.vai } });
    const them = mons.filter((m) => !cu?.phan_cong.some((p) => p.mon_id === m.id));
    if (them.length) await tx.phan_cong.createMany({ data: them.map((m) => ({ nguoi_dung_id: nd.id, mon_id: m.id })) });
    await tx.nhat_ky.create({
      data: {
        vai_tro: "he_thong", hanh_dong: cu ? "sua_nguoi_dung" : "them_nguoi_dung", doi_tuong: "nguoi_dung", doi_tuong_id: nd.id,
        truoc: cu ? { ten_hien_thi: cu.ten_hien_thi, vai_tro: cu.vai_tro } : undefined,
        sau: { ten_hien_thi: ten, vai_tro: v.vai, them_mon: them.map((m) => m.ma) },
      },
    });
    return { ket_qua: cu ? "da_cap_nhat" : "da_tao", id: nd.id, vai: v.vai, them_mon: them.map((m) => m.ma), dang_khoa: !!nd.khoa_luc };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] ?? "" : ""; };
  const url = process.env.BCA_DATABASE_URL;
  if (!url) { console.error("Thiếu BCA_DATABASE_URL"); process.exit(1); }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../generated/prisma/client");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const mon = lay("--mon").split(",").map((s) => s.trim()).filter(Boolean);
    console.log(JSON.stringify(await themNguoiDung(db, { gmail: lay("--gmail"), ten: lay("--ten"), vai: lay("--vai") as NguoiMoi["vai"], mon }), null, 2));
  } catch (e) {
    console.error("DỪNG:", (e as Error).message);
    process.exitCode = 2;
  } finally {
    await db.$disconnect();
  }
}
