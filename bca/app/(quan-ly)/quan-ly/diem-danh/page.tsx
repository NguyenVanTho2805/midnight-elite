// Danh mục điểm danh (man-diem-danh §8): buổi hôm nay, buổi chưa điểm 14 ngày qua, lối vào ma trận tháng.
// ?mo=toi-nay (mục "Điểm danh" ở thanh dưới, T24): từ 21:45 tới 05:59, nếu chỉ còn đúng một buổi mở thì mở thẳng.
import Link from "next/link";
import { redirect } from "next/navigation";
import { danhSachBuoi } from "@/server/buoi-hoc";
import { congNgay, ngayVN } from "@/lib/ngay";
import { conGioBuoiToiQua, moDiemDanh } from "@/lib/quy-tac";
import { layNguoiQuanLy } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import { gio, thuNgay, thuNganNgay, tenMonDayDu } from "@/components/dinh-dang";
import { nutChinh, nutPhu } from "@/components/ui/nut";

export const metadata = { title: "Điểm danh" };

export default async function DanhMucDiemDanh({ searchParams }: { searchParams: Promise<{ mo?: string }> }) {
  const [u, sp] = await Promise.all([layNguoiQuanLy(), searchParams]);
  const luc = new Date();
  const h = ngayVN(luc);
  const thangs = [...new Set([congNgay(h, -14).slice(0, 7), h.slice(0, 7)])];
  const buoi = (await Promise.all(thangs.map((thang) => danhSachBuoi(u, { thang })))).flatMap((x) => x.buoi);
  const homQua = congNgay(h, -1);
  const chuaDu = (b: (typeof buoi)[number]) => b.trang_thai !== "huy" && !!b.tien_do && b.tien_do.da_diem < b.tien_do.si_so;
  const toiQua = conGioBuoiToiQua(luc) ? buoi.filter((b) => b.ngay === homQua && chuaDu(b)) : [];
  const homNay = buoi.filter((b) => b.ngay === h);
  const the = [...toiQua.map((b) => ({ b, toiQua: true })), ...homNay.map((b) => ({ b, toiQua: false }))];

  if (sp.mo === "toi-nay") {
    const mo = the.filter(({ b, toiQua: q }) => b.trang_thai !== "huy" && (q || moDiemDanh(new Date(b.bat_dau_luc), luc)));
    if (mo.length === 1) redirect(`/quan-ly/diem-danh/${mo[0].b.id}`);
  }

  const chua = buoi.filter((b) => b.ngay < h && b.ngay >= congNgay(h, -14) && chuaDu(b) && !toiQua.some((x) => x.id === b.id)).sort((a, b) => b.ngay.localeCompare(a.ngay));
  const ke = (await danhSachBuoi(u, { thang: congNgay(h, 1).slice(0, 7) })).buoi.find((b) => b.ngay > h && b.trang_thai !== "huy");
  const monDau = buoi[0]?.mon.ma ?? "toan";

  return (
    <>
      <DauTrang tieuDe="Điểm danh" phu={thuNgay(h)} />
      <NoiDung className="grid gap-6">
        <h1 className="sr-only">Điểm danh</h1>
        <section aria-labelledby="dd-hom-nay" className="grid gap-3">
          <h2 id="dd-hom-nay" className="text-lg font-semibold">Hôm nay</h2>
          {the.length ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              {the.map(({ b, toiQua: q }) => {
                const t = b.tien_do;
                const moLuc = moDiemDanh(new Date(b.bat_dau_luc), luc);
                return (
                  <li key={b.id} className="rounded-[20px] bg-raised p-4 sm:p-5">
                    <p className="text-[13px] font-semibold text-text-2">{q ? "Buổi tối qua" : "Tối nay"}{b.loai === "hoc_bu" ? " · Học bù" : ""}</p>
                    <h3 className="mt-1 text-xl font-extrabold">{tenMonDayDu(b.mon.ma, b.mon.ten)} · <span className="so">{q ? thuNganNgay(b.ngay) : b.gio}</span></h3>
                    <p className="so mt-1 text-text-2">
                      {b.trang_thai === "huy" ? `Lớp nghỉ${b.ly_do_huy ? ` · ${b.ly_do_huy}` : ""}` : t && t.da_diem ? `Đã điểm ${t.da_diem}/${t.si_so}` : `Chưa điểm · ${t?.si_so ?? 0} em`}
                    </p>
                    {b.trang_thai !== "huy" ? (
                      <Link href={`/quan-ly/diem-danh/${b.id}`} prefetch className={`${moLuc ? nutChinh : nutPhu} mt-4 w-full sm:w-auto`}>
                        {moLuc ? "Điểm danh" : `Xem trước · mở lúc ${gio(new Date(b.bat_dau_luc).getTime() - 30 * 60_000)}`}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-[14px] border border-border bg-surface px-4 py-4 text-text-2">Hôm nay không có buổi{ke ? `. Buổi kế: ${thuNgay(ke.ngay)} · ${tenMonDayDu(ke.mon.ma, ke.mon.ten)} ${ke.gio}` : ""}.</p>
          )}
        </section>

        <section id="chua-diem" aria-labelledby="dd-chua" className="grid scroll-mt-20 gap-3">
          <h2 id="dd-chua" className="text-lg font-semibold">Chưa điểm danh <span className="so text-text-3">· 14 ngày qua</span></h2>
          {chua.length ? (
            <ul className="rounded-[14px] border border-border bg-surface">
              {chua.map((b) => (
                <li key={b.id} className="border-b border-border last:border-b-0">
                  <Link href={`/quan-ly/diem-danh/${b.id}`} className="flex min-h-14 items-center gap-3 px-4 hover:bg-row-hover">
                    <span className="flex-1"><span className="font-semibold">{b.mon.ten}</span> · <span className="so">{thuNganNgay(b.ngay)}</span></span>
                    <span className="so text-warn">chưa điểm {(b.tien_do?.si_so ?? 0) - (b.tien_do?.da_diem ?? 0)} em</span>
                    <span aria-hidden="true" className="text-text-3">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[14px] border border-border bg-surface px-4 py-4 text-text-2">Không còn buổi nào chưa điểm.{ke ? ` Buổi kế: ${thuNgay(ke.ngay)} · ${tenMonDayDu(ke.mon.ma, ke.mon.ten)} ${ke.gio}.` : ""}</p>
          )}
        </section>

        <section aria-labelledby="dd-thang" className="grid gap-3">
          <h2 id="dd-thang" className="text-lg font-semibold">Ma trận tháng</h2>
          <Link href={`/quan-ly/diem-danh/thang?mon=${monDau}&thang=${h.slice(0, 7)}`} className={`${nutPhu} w-full sm:w-auto sm:justify-self-start`}>Xem ma trận tháng {Number(h.slice(5, 7))}</Link>
        </section>
      </NoiDung>
    </>
  );
}
