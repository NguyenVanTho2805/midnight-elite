// Lớp ôn · Buổi học (KiN lớp bước 5). Chỉ chủ lớp, sau cờ LOP_ON. Danh sách theo TUẦN (Thứ Hai → Chủ nhật), lọc môn trên URL (?tuan=YYYY-MM-DD&mon=).
// Figma chưa có màn này ⇒ theo mẫu trang Học sinh của bước 4. Thao tác ghi nằm ở components/lop/BuoiHoc.tsx (gọi /api/lop/buoi-hoc/*).
import Link from "next/link";
import { KinPanel, KinEmptyState, kinButtonClass } from "@/components/kin";
import { chuLop } from "@/lib/lop/server/cua";
import { danhSachBuoi } from "@/lib/lop/server/buoi-hoc";
import { napMon } from "@/lib/lop/server/du-lieu";
import { congNgay, ddmm, ngayVN, thangCua, thuISO } from "@/lib/lop/ngay";
import { tenMonDayDu, thuNgay } from "@/lib/lop/dinh-dang";
import { BuoiCongCu, BuoiThaoTac } from "@/components/lop/BuoiHoc";
import { KhoiLoi, LOP_GOC, MonCham, Nhan, lienKet, thuTai } from "@/components/lop/hien-thi";

export const metadata = { title: "Lớp ôn · Buổi học" };
export const dynamic = "force-dynamic";

const GOC = `${LOP_GOC}/buoi-hoc`;
const chip = (bat: boolean) => `inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[length:var(--kin-co-goc)] ${bat ? "border-[var(--kin-nhan-link)] bg-[var(--kin-nhan-nen-nhat)] font-medium text-[var(--kin-nhan-chu-tren-nhat)]" : "border-[var(--kin-vien-thuong)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`;

export default async function LopOnBuoiHoc({ searchParams }: { searchParams: Promise<{ tuan?: string; mon?: string }> }) {
  const u = await chuLop();
  const sp = await searchParams, luc = new Date(), hom = ngayVN(luc);
  const ngay = sp.tuan && /^\d{4}-\d{2}-\d{2}$/.test(sp.tuan) && !isNaN(Date.parse(sp.tuan)) ? sp.tuan : hom;
  const t2 = congNgay(ngay, 1 - thuISO(ngay)), cn = congNgay(t2, 6);
  const mons = (await thuTai("môn", napMon)) ?? [];
  const mon = mons.find((m) => m.ma === sp.mon)?.ma;
  const href = (o: { tuan?: string; mon?: string | null }) => {
    const q = new URLSearchParams();
    const tuan = o.tuan ?? t2, m = o.mon === undefined ? mon : o.mon;
    if (tuan !== congNgay(hom, 1 - thuISO(hom))) q.set("tuan", tuan);
    if (m) q.set("mon", m);
    return q.size ? `${GOC}?${q}` : GOC;
  };
  // Tuần có thể vắt qua hai tháng: nạp cả hai rồi cắt theo ngày.
  const d = await thuTai("buổi học", async () => (await Promise.all([...new Set([thangCua(t2), thangCua(cn)])].map((thang) => danhSachBuoi(u, { thang, mon })))).flatMap((x) => x.buoi).filter((b) => b.ngay >= t2 && b.ngay <= cn));

  return (
    <div className="max-w-5xl">
      <h1 className="pb-4 text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Buổi học</h1>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Lọc theo môn" className="flex flex-wrap gap-2">
          <Link href={href({ mon: null })} aria-current={!mon ? "true" : undefined} className={chip(!mon)}>Tất cả môn</Link>
          {mons.map((m) => <Link key={m.ma} href={href({ mon: m.ma })} aria-current={mon === m.ma ? "true" : undefined} className={chip(mon === m.ma)}><MonCham ma={m.ma} />{m.ten_ngan}</Link>)}
        </nav>
        <nav aria-label="Chọn tuần" className="ml-auto flex items-center gap-1 tabular-nums">
          <Link href={href({ tuan: congNgay(t2, -7) })} aria-label="Tuần trước" className={`${kinButtonClass("secondary")} px-3`}>‹</Link>
          <span className="px-2 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{ddmm(t2)} – {ddmm(cn)}</span>
          <Link href={href({ tuan: congNgay(t2, 7) })} aria-label="Tuần sau" className={`${kinButtonClass("secondary")} px-3`}>›</Link>
          {hom < t2 || hom > cn ? <Link href={href({ tuan: congNgay(hom, 1 - thuISO(hom)) })} className={`${lienKet} px-2`}>Tuần này</Link> : null}
        </nav>
      </div>
      <BuoiCongCu thang={thangCua(t2)} mon={mons.map((m) => ({ ma: m.ma, ten: m.ten_ngan }))} />

      {!d ? <div className="mt-4"><KhoiLoi ten="danh sách buổi học" href={href({})} /></div> : (
        <KinPanel flush className="mt-4">
          {!d.length ? <KinEmptyState title="Tuần này chưa có buổi nào">Buổi theo lịch hiện ra sau khi sinh buổi cho tháng; dùng “Sinh buổi còn thiếu” ở trên nếu tháng này thiếu buổi.</KinEmptyState> : (
            <ul>
              {d.map((b) => {
                const td = b.tien_do, huy = b.trang_thai === "huy", batDau = new Date(b.bat_dau_luc).getTime();
                return (
                  <li key={b.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-3 last:border-b-0">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--kin-co-body)] font-medium text-[var(--kin-chu-chinh)]">
                        <MonCham ma={b.mon.ma} />{tenMonDayDu(b.mon.ma, b.mon.ten)}
                        <span className="font-normal tabular-nums text-[var(--kin-chu-phu)]">· {b.ngay === hom ? "Tối nay" : thuNgay(b.ngay)} · {b.gio}</span>
                        {huy ? <Nhan tone="loi">Lớp nghỉ</Nhan> : b.loai === "hoc_bu" ? <Nhan tone="thu">Học bù</Nhan> : null}
                      </p>
                      <p className="mt-1 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-mo)] [overflow-wrap:anywhere]">
                        {huy ? `Lý do: ${b.ly_do_huy ?? "—"}` : [td ? `Đã điểm ${td.da_diem}/${td.si_so}` : null, b.mon.giao_vien.join(", ") || null, b.noi_dung, b.link_record ? "có record" : batDau < luc.getTime() ? "chưa có record" : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {!huy ? <Link href={`${LOP_GOC}/diem-danh/${b.id}`} className={kinButtonClass(td && td.da_diem < td.si_so && batDau - 30 * 60_000 <= luc.getTime() ? "primary" : "secondary")}>Điểm danh</Link> : null}
                    <BuoiThaoTac b={{ id: b.id, ten: `${b.mon.ten} ${ddmm(b.ngay)}`, huy, tuong_lai: batDau > luc.getTime(), noi_dung: b.noi_dung, link_record: b.link_record, ghi_chu: b.ghi_chu }} />
                  </li>
                );
              })}
            </ul>
          )}
        </KinPanel>
      )}
    </div>
  );
}
