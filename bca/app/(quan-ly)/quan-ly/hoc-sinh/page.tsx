// Danh sách học sinh (man-hoc-sinh §3–§5). Máy chủ chọn cột theo vai; chỉ gửi xuống trình duyệt đúng cột cần hiện.
import { danhSachHocSinh } from "@/server/hoc-sinh";
import { layNguoiQuanLy } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import { DanhSachHs, type HsDong } from "@/components/quan-ly/danh-sach-hs";

export const metadata = { title: "Học sinh" };

const lienHe = (r: { sdt_hs: string | null; gmail: string | null }) => ({ sdt: r.sdt_hs, gmail: r.gmail });

export default async function TrangHocSinh({ searchParams }: { searchParams: Promise<{ het_ngay?: string }> }) {
  const [u, sp] = await Promise.all([layNguoiQuanLy(), searchParams]);
  const chu = u.vai === "chu";
  // ?het_ngay= : nút "Xem N em ›" ở Hôm nay mở đúng nhóm ngày hết (máy chủ lọc cùng quy tắc nhóm việc).
  const hetNgay = /^\d{4}-\d{2}-\d{2}$/.test(sp.het_ngay ?? "") ? sp.het_ngay : undefined;
  const d = await danhSachHocSinh(u, { hetNgay });
  const ds: HsDong[] = d.hoc_sinh.map((r) => ({
    ma: r.ma_hs,
    ten: r.ho_ten,
    lua: r.lua?.ma ?? null,
    mon: d.mon.flatMap((m) => (r.mon[m.ma] ? [{ ma: m.ma, ten: m.ten, o: r.mon[m.ma]! }] : [])),
    tinhTrang: r.tinh_trang,
    thu: r.thu ? { den: r.thu.den, con: r.thu.con_ngay } : null,
    dangKy: r.dang_ky,
    ...(chu ? lienHe(r as unknown as { sdt_hs: string | null; gmail: string | null }) : {}),
  }));
  return (
    <>
      <DauTrang tieuDe={<>Học sinh <span className="so text-text-3">· {ds.length}</span></>} />
      <NoiDung className="grid gap-4">
        <h1 className="sr-only">Học sinh</h1>
        <DanhSachHs ds={ds} mon={d.mon} chu={chu} homNay={d.hom_nay} />
      </NoiDung>
    </>
  );
}
