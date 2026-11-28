// Lớp ôn · Giáo viên (KiN lớp bước 6). Chỉ chủ lớp, sau cờ LOP_ON. Thay màn "Tài khoản" của web lớp:
// tài khoản giáo viên do khu quản trị KiN tạo; trang này chỉ phân công môn + khoá / mở khoá dòng lớp (bca_nguoi_dung, bca_phan_cong) theo Gmail đã xác minh.
import { KinPanel, KinEmptyState } from "@/components/kin";
import { chuLop } from "@/lib/lop/server/cua";
import { manGiaoVien, type TrangThaiGv } from "@/lib/lop/server/giao-vien";
import { KhoiLoi, LOP_GOC, MonCham, Nhan, thuTai } from "@/components/lop/hien-thi";
import { GiaoVienThaoTac } from "@/components/lop/GiaoVien";

export const metadata = { title: "Lớp ôn · Giáo viên" };
export const dynamic = "force-dynamic";

// Mỗi trạng thái: nhãn + việc chủ lớp cần làm (lỗi phải kèm cách xử lý).
const TT: Record<TrangThaiGv, { chu: string; tone: "xong" | "cho" | "loi"; lam: string | null }> = {
  san_sang: { chu: "Đăng nhập được", tone: "xong", lam: null },
  chua_xac_minh: { chu: "Email chưa xác minh", tone: "cho", lam: "Chưa vào được lớp. Nhờ giáo viên mở thư KiN và bấm liên kết xác minh email, rồi tải lại trang này." },
  bi_cam: { chu: "Tài khoản KiN bị khoá", tone: "loi", lam: "Chưa vào được lớp. Mở khoá tài khoản này ở khu quản trị KiN (Con người) trước." },
  chua_co_tk: { chu: "Chưa có tài khoản giáo viên KiN với Gmail này", tone: "cho", lam: "Người này chưa đăng nhập được. Tạo tài khoản giáo viên KiN đúng Gmail này ở khu quản trị KiN (Con người); môn đã phân công sẽ có hiệu lực ngay khi họ xác minh email." },
};

export default async function LopOnGiaoVien() {
  const u = await chuLop();
  const d = await thuTai("giáo viên", () => manGiaoVien(u));
  const tieuDe = (
    <header className="pb-6">
      <h1 className="text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Giáo viên</h1>
      <p className="mt-2 max-w-prose text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Chọn giáo viên KiN nào được dạy môn nào ở Lớp ôn. Tài khoản và mật khẩu của giáo viên do khu quản trị KiN quản lý, không tạo ở đây.</p>
    </header>
  );
  if (!d) return <div className="max-w-4xl">{tieuDe}<KhoiLoi ten="danh sách giáo viên" href={`${LOP_GOC}/giao-vien`} /></div>;
  return (
    <div className="max-w-4xl">
      {tieuDe}
      <KinPanel flush>
        {!d.giao_vien.length ? (
          <KinEmptyState title="Chưa có giáo viên nào">Tạo tài khoản giáo viên ở khu quản trị KiN (Con người) trước; giáo viên đã xác minh email sẽ hiện ở đây để phân công môn.</KinEmptyState>
        ) : (
          <ul>
            {d.giao_vien.map((g) => {
              const tt = TT[g.trang_thai];
              const duocSua = !!g.lop || g.trang_thai === "san_sang";
              return (
                <li key={g.lop?.id ?? g.userId} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-3 text-[length:var(--kin-co-goc)] last:border-b-0">
                  <div className="min-w-56 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><span translate="no" className="font-medium text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{g.ten}</span>
                      {g.lop?.khoa ? <Nhan tone="loi">Đã khoá ở Lớp ôn</Nhan> : <Nhan tone={tt.tone}>{tt.chu}</Nhan>}</p>
                    <p translate="no" className="mt-0.5 text-[var(--kin-chu-mo)] [overflow-wrap:anywhere]">{g.email}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--kin-chu-phu)]">
                      {g.lop?.mon.length ? g.lop.mon.map((m) => <span key={m} className="inline-flex items-center gap-1.5"><MonCham ma={m} />{d.mon.find((x) => x.ma === m)?.ten_ngan ?? m}</span>)
                        : <span className="text-[var(--kin-chu-mo)]">{g.lop ? "Chưa được phân công môn nào" : "Chưa đưa vào Lớp ôn"}</span>}
                    </p>
                    {tt.lam ? <p className="mt-1 max-w-prose text-[var(--kin-tt-chu-cho)]">{tt.lam}</p> : null}
                  </div>
                  {duocSua ? <GiaoVienThaoTac gv={{ userId: g.userId, ten: g.ten, email: g.email, lop: g.lop }} mon={d.mon} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </KinPanel>
    </div>
  );
}
