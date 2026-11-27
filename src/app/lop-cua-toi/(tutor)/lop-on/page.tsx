// Lớp ôn của GIÁO VIÊN (KiN lớp bước 5): buổi tối nay + buổi còn nợ điểm danh của các môn mình được phân công. Sau cờ LOP_ON.
// Giáo viên đứng lớp ở vỏ gia sư /lop-cua-toi theo luật hiện hành của KiN (docs/kin/lop/README.md mục 6.1 còn chờ chủ quyết) — không vào tên miền quản trị.
import Link from "next/link";
import { KinPanel, KinEmptyState, KIN_PAGE, kinButtonClass } from "@/components/kin";
import { giaoVienLop } from "@/lib/lop/server/cua";
import { lopToiNay, viecCanLam } from "@/lib/lop/server/hom-nay";
import { ngayVN } from "@/lib/lop/ngay";
import { tenMonDayDu, thuNgay, thuNganNgay } from "@/lib/lop/dinh-dang";
import { KhoiLoi, MonCham, thuTai } from "@/components/lop/hien-thi";

export const metadata = { title: "Lớp ôn · Điểm danh" };
export const dynamic = "force-dynamic";

const GOC = "/lop-cua-toi/lop-on";
const tieuDe = "text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]";

export default async function LopOnGiaoVien() {
  const u = await giaoVienLop(GOC);
  const luc = new Date();
  const dau = <h1 className="pb-4 text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Lớp ôn <span className="whitespace-nowrap">· {thuNgay(ngayVN(luc))}</span></h1>;
  if (!u) return <div className={`${KIN_PAGE} max-w-2xl`}>{dau}<KinPanel><KinEmptyState title="Chưa được phân công môn nào">Chủ lớp cần thêm Gmail của tài khoản này vào lớp ôn và giao môn. Sau đó buổi dạy của bạn hiện ở đây.</KinEmptyState></KinPanel></div>;
  const [toiNay, viec] = await Promise.all([thuTai("lớp tối nay", () => lopToiNay(u, luc)), thuTai("buổi còn nợ", () => viecCanLam(u, luc))]);
  const no = (viec?.viec ?? []).filter((v) => v.loai === "buoi_chua_diem_danh").flatMap((v) => (v.buoi as { id: number; ngay: string; thieu: number }[]).map((b) => ({ ...b, mon: v.mon as { ma: string; ten: string } | undefined })));

  return (
    <div className={`${KIN_PAGE} max-w-2xl`}>
      {dau}
      <section aria-labelledby="toi-nay">
        <h2 id="toi-nay" className={tieuDe}>Tối nay</h2>
        {!toiNay ? <div className="mt-2"><KhoiLoi ten="lớp tối nay" href={GOC} /></div> : !toiNay.length ? <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tối nay bạn không có buổi nào.</p> : (
          <ul className="mt-2 grid gap-3">
            {toiNay.map((b) => (
              <li key={b.id}>
                <KinPanel className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="flex items-center gap-2 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]"><MonCham ma={b.mon?.ma} />{tenMonDayDu(b.mon?.ma, b.mon?.ten)}</p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-phu)]">
                      {b.toi_qua ? `Tối qua ${thuNganNgay(b.ngay)}` : "Tối nay"} · {b.gio}
                      {b.trang_thai === "huy" ? ` · lớp nghỉ${b.ly_do_huy ? ` (${b.ly_do_huy})` : ""}` : ` · đã điểm ${b.da_diem}/${b.si_so}`}
                    </p>
                  </div>
                  {b.trang_thai !== "huy" ? <Link href={`${GOC}/${b.id}`} className={`${kinButtonClass(b.mo_diem_danh ? "primary" : "secondary", "lg")} min-h-12`}>{b.mo_diem_danh ? "Điểm danh" : "Xem danh sách"}</Link> : null}
                </KinPanel>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="con-no" className="mt-8">
        <h2 id="con-no" className={tieuDe}>Buổi còn nợ điểm danh</h2>
        {!viec ? <div className="mt-2"><KhoiLoi ten="buổi còn nợ" href={GOC} /></div> : !no.length ? <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Không còn buổi nào chưa điểm danh trong 14 ngày qua.</p> : (
          <KinPanel flush className="mt-2">
            <ul>
              {no.map((b, i) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-3 last:border-b-0">
                  <p className="min-w-0 flex-1 basis-40 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-chinh)]"><span className="inline-flex items-center gap-2 font-medium"><MonCham ma={b.mon?.ma} />{b.mon?.ten} {thuNganNgay(b.ngay)}</span><span className="text-[var(--kin-chu-mo)]"> · còn {b.thieu} em</span></p>
                  <Link href={`${GOC}/${b.id}`} className={kinButtonClass(i === 0 ? "primary" : "secondary")}>Điểm danh</Link>
                </li>
              ))}
            </ul>
          </KinPanel>
        )}
      </section>
    </div>
  );
}
