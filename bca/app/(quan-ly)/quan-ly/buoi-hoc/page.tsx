// Màn Buổi học (man-buoi-hoc.md): danh sách theo tuần (T31), chi tiết buổi (?buoi=), dán record + nội dung
// (chủ + GV môn), huỷ / học bù (chỉ chủ). Bộ lọc trên URL: ?thang=2026-11&mon=toan&record=thieu&buoi=12
import Link from "next/link";
import type { ReactNode } from "react";
import { danhSachBuoi } from "@/server/buoi-hoc";
import { napMon } from "@/server/du-lieu";
import { congNgay, ngayVN, thuISO } from "@/lib/ngay";
import { conGioBuoiToiQua, moDiemDanh } from "@/lib/quy-tac";
import { layNguoiQuanLy, tai } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import { Chip } from "@/components/ui/chip";
import { IconDau, IconMoNgoai, IconQuayLai, IconTiep } from "@/components/bieu-tuong";
import { nutBieuTuong, nutChinh, nutPhu } from "@/components/ui/nut";
import { ddmm, gio, tenGv, thuNgan, thuNgay, tenMonDayDu } from "@/components/dinh-dang";
import { CuonToi, HanhDongBuoi, NutHocBu, SinhBuoi, SinhBuoiThieu, SuaBuoi } from "@/components/quan-ly/buoi-hoc";

export const metadata = { title: "Buổi học" };

type SP = { thang?: string; mon?: string; buoi?: string; record?: string; dan?: string };
type B = Awaited<ReturnType<typeof danhSachBuoi>>["buoi"][number];

export default async function TrangBuoiHoc({ searchParams }: { searchParams: Promise<SP> }) {
  const [u, sp] = await Promise.all([layNguoiQuanLy(), searchParams]);
  const chu = u.vai === "chu";
  const luc = new Date();
  const h = ngayVN(luc);
  const thang = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang ?? "") ? sp.thang! : h.slice(0, 7);
  const mons = (await napMon()).filter((m) => chu || u.monIds.includes(m.id)).map((m) => ({ ma: m.ma, ten: m.ten_ngan }));
  const r = { d: await tai(() => danhSachBuoi(u, { thang, mon: sp.mon || undefined })) };
  const thieuRec = sp.record === "thieu";
  const tatCa = r.d.buoi;
  const ds = thieuRec ? tatCa.filter((b) => b.trang_thai !== "huy" && !b.link_record && b.ngay < h) : tatCa;
  const chon = sp.buoi ? tatCa.find((b) => String(b.id) === sp.buoi) ?? null : null;

  const url = (p: Partial<Record<keyof SP, string | null>>) => {
    const q = new URLSearchParams();
    const g = { thang, mon: sp.mon ?? null, record: sp.record ?? null, buoi: null, ...p };
    for (const [k, v] of Object.entries(g)) if (v) q.set(k, v);
    return `/quan-ly/buoi-hoc?${q}`;
  };
  const truoc = congNgay(`${thang}-01`, -1).slice(0, 7);
  const sau = congNgay(`${thang}-28`, 7).slice(0, 7);
  // Gom theo tuần (Thứ Hai → Chủ nhật).
  const tuan = Map.groupBy(ds, (b) => congNgay(b.ngay, 1 - thuISO(b.ngay)));
  const tuanNay = congNgay(h, 1 - thuISO(h));
  const chip = (bat: boolean) => `nhan inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-semibold ${bat ? "border-gold bg-nav-active text-gold" : "border-border bg-surface text-text-2 hover:bg-row-hover"}`;

  return (
    <>
      <DauTrang tieuDe="Buổi học">{chu ? <NutHocBu mon={mons} ds={tatCa.map(nho)} homNay={h} /> : null}</DauTrang>
      <NoiDung>
        <h1 className="sr-only">Buổi học tháng {Number(thang.slice(5))}/{thang.slice(0, 4)}</h1>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className={`grid content-start gap-3 lg:col-span-7 ${chon ? "hidden lg:grid" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-1">
                <Link href={url({ thang: truoc })} className={nutBieuTuong} aria-label="Tháng trước"><IconQuayLai /></Link>
                <span className="so min-w-32 text-center font-semibold">Tháng {Number(thang.slice(5))}/{thang.slice(0, 4)}</span>
                <Link href={url({ thang: sau })} className={nutBieuTuong} aria-label="Tháng sau"><IconTiep /></Link>
              </div>
              {mons.length > 1 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Lọc môn">
                  <li><Link href={url({ mon: null })} aria-current={!sp.mon ? "page" : undefined} className={chip(!sp.mon)}>{!sp.mon ? <IconDau size={14} /> : null}Tất cả</Link></li>
                  {mons.map((m) => <li key={m.ma}><Link href={url({ mon: m.ma })} aria-current={sp.mon === m.ma ? "page" : undefined} className={chip(sp.mon === m.ma)}>{sp.mon === m.ma ? <IconDau size={14} /> : null}{m.ten}</Link></li>)}
                </ul>
              ) : null}
              {thieuRec ? <Link href={url({ record: null })} className={chip(true)}><IconDau size={14} />Thiếu record ✕<span className="sr-only"> (bỏ lọc)</span></Link> : null}
              {chu && tatCa.length && !sp.mon ? <SinhBuoiThieu thang={thang} mon={mons} /> : null}
            </div>

            {!tatCa.length ? (
              <div className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">
                {sp.mon ? <>Tháng này không có buổi {mons.find((m) => m.ma === sp.mon)?.ten}. — <Link href={url({ mon: null })} className="font-semibold text-gold hover:underline">Xem tất cả môn</Link></> : <>Tháng {Number(thang.slice(5))}/{thang.slice(0, 4)} chưa có lịch.</>}
                {chu && !sp.mon ? <SinhBuoi thang={thang} /> : null}
              </div>
            ) : !ds.length ? (
              <p className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">Không còn buổi nào thiếu record trong tháng này. — <Link href={url({ record: null })} className="font-semibold text-gold hover:underline">Xem mọi buổi</Link></p>
            ) : (
              [...tuan].map(([dau, bs]) => (
                <section key={dau} id={`tuan-${dau}`} aria-labelledby={`t-${dau}`} className="scroll-mt-20">
                  <h2 id={`t-${dau}`} className="so sticky top-14 z-10 bg-bg py-2 text-[13px] font-semibold text-text-2 sm:top-16">Tuần {ddmm(dau).slice(0, 2)}–{ddmm(congNgay(dau, 6))}</h2>
                  <ul className="rounded-[14px] border border-border bg-surface">
                    {bs.map((b) => <HangBuoi key={b.id} b={b} h={h} luc={luc} chon={chon?.id === b.id} href={url({ buoi: String(b.id) })} danHref={url({ buoi: String(b.id), dan: "1" })} />)}
                  </ul>
                </section>
              ))
            )}
            {!chon && tuan.has(tuanNay) ? <CuonToi id={`tuan-${tuanNay}`} /> : null}
          </div>

          <div className={`lg:col-span-5 ${chon ? "" : "hidden lg:block"}`}>
            {chon ? (
              <ChiTiet b={chon} chu={chu} h={h} luc={luc} dongHref={url({})} dan={sp.dan === "1"} mons={mons} ds={tatCa} />
            ) : (
              <p className="sticky top-20 rounded-[20px] border border-border bg-surface px-4 py-6 text-text-2">Chọn một buổi để dán record, ghi nội dung hoặc mở điểm danh.</p>
            )}
          </div>
        </div>
      </NoiDung>
    </>
  );
}

const nho = (b: B) => ({ id: b.id, ngay: b.ngay, gio: b.gio, mon: b.mon, trang_thai: b.trang_thai, loai: b.loai });

function trangThaiDD(b: B, h: string) {
  const t = b.tien_do;
  if (b.trang_thai === "huy" || !t) return null;
  if (b.ngay > h) return <span className="text-text-2 so">{t.si_so} em</span>;
  if (t.da_diem >= t.si_so && t.si_so > 0) return <span className="text-text-2 so">Đã điểm {t.da_diem}/{t.si_so}</span>;
  if (t.da_diem > 0) return <span className="text-warn so">Đã điểm {t.da_diem}/{t.si_so}</span>;
  return <span className={b.ngay < h ? "text-warn" : "text-text-2"}>{b.ngay < h ? "Chưa điểm" : `${t.si_so} em · chưa tới giờ`}</span>;
}

function HangBuoi({ b, h, luc, chon, href, danHref }: { b: B; h: string; luc: Date; chon: boolean; href: string; danHref: string }) {
  const homNay = b.ngay === h;
  const huy = b.trang_thai === "huy";
  const moDD = !huy && ((homNay && moDiemDanh(new Date(b.bat_dau_luc), luc)) || (conGioBuoiToiQua(luc) && b.ngay === congNgay(h, -1)));
  const thieu = !huy && !b.link_record && b.ngay < h;
  let nut: ReactNode = null;
  if (moDD) nut = <Link href={`/quan-ly/diem-danh/${b.id}`} className={`${nutChinh} relative z-[1] min-h-11 px-3 text-[14px]`}>Điểm danh</Link>;
  else if (thieu) nut = <Link href={danHref} replace scroll={false} className={`${nutPhu} relative z-[1] px-3 text-[14px]`}>Dán record</Link>;
  return (
    <li className={`relative flex min-h-[72px] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 ${chon ? "bg-nav-active" : homNay ? "bg-today-col" : "hover:bg-row-hover"}`}>
      <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-bg ${huy ? "opacity-60" : ""}`}>
        <span className={`text-[12px] font-semibold ${homNay ? "text-gold" : "text-text-3"}`}>{thuNgan(b.ngay)}</span>
        <span className="so text-lg font-extrabold leading-none">{b.ngay.slice(8)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <Link href={href} replace scroll={false} aria-current={chon ? "true" : undefined} className={`font-semibold after:absolute after:inset-0 ${huy ? "text-text-3" : ""}`}>
          {tenMonDayDu(b.mon.ma, b.mon.ten)} · <span className="so">{b.gio}</span>
          <span className="sr-only">, {thuNgay(b.ngay)}</span>
        </Link>
        {homNay ? <span className="ml-2 text-[13px] font-semibold text-gold">Hôm nay</span> : null}
        {b.loai === "hoc_bu" ? <Chip className="ml-2">Học bù</Chip> : null}
        <p className="text-[14px]">
          {huy ? <span className="text-text-3">Lớp nghỉ{b.ly_do_huy ? ` · Lý do: ${b.ly_do_huy}` : ""}</span> : (
            <>
              {trangThaiDD(b, h)}
              {b.ngay < h ? (b.link_record ? <span className="text-ok"> · Có record</span> : <span className="text-warn"> · Thiếu record</span>) : null}
              {b.noi_dung ? <span className="hidden truncate text-text-3 lg:inline"> · {b.noi_dung}</span> : null}
            </>
          )}
        </p>
      </div>
      {nut}
    </li>
  );
}

function ChiTiet({ b, chu, h, luc, dongHref, dan, mons, ds }: { b: B; chu: boolean; h: string; luc: Date; dongHref: string; dan: boolean; mons: { ma: string; ten: string }[]; ds: B[] }) {
  const t = b.tien_do;
  const huy = b.trang_thai === "huy";
  const ketThuc = new Date(new Date(b.bat_dau_luc).getTime() + b.so_phut * 60_000);
  const chua = t ? t.si_so - t.da_diem : 0;
  const moDD = moDiemDanh(new Date(b.bat_dau_luc), luc);
  // T42 + T37: chỉ xoá được buổi chưa bắt đầu và chưa có dữ liệu; máy chủ kiểm lại (409 da_qua / co_du_lieu).
  const coDuLieu = !!(t?.da_diem || b.noi_dung || b.link_record || b.ghi_chu || huy || ds.some((x) => x.bu_cho_buoi_id === b.id));
  const xoaDuoc = !coDuLieu && new Date(b.bat_dau_luc).getTime() > luc.getTime();
  return (
    <section aria-labelledby="ct-buoi" className="grid gap-4 rounded-[20px] bg-raised p-4 sm:p-6 lg:sticky lg:top-20">
      <div className="flex items-start gap-2">
        <Link href={dongHref} replace scroll={false} className={`${nutBieuTuong} -ml-2 lg:hidden`} aria-label="Quay lại danh sách buổi"><IconQuayLai /></Link>
        <div className="min-w-0 flex-1">
          <h2 id="ct-buoi" className="text-[22px] font-extrabold leading-tight">{b.mon.ten_day_du || tenMonDayDu(b.mon.ma, b.mon.ten)} · {thuNgay(b.ngay)}</h2>
          <p className="so text-text-2">{b.gio}–{gio(ketThuc)}{b.mon.giao_vien.length ? <> · <span translate="no" className="whitespace-nowrap">{tenGv(b.mon.giao_vien)}</span></> : null}</p>
          <p className="mt-1">{huy ? <Chip mau="mo">Lớp nghỉ{b.ly_do_huy ? ` · ${b.ly_do_huy}` : ""}</Chip> : b.loai === "hoc_bu" ? <Chip>Học bù</Chip> : <Chip mau="ok">Có học</Chip>}</p>
        </div>
      </div>
      {!huy && t ? (
        <div className="rounded-[14px] bg-surface p-4">
          <h3 className="font-semibold">Điểm danh</h3>
          <p className="so mt-1 text-text-2">{t.si_so} em · {t.chinh_thuc} chính thức · {t.thu} thử</p>
          <p className="so text-text-2">{t.co} có · {t.phep} phép · {t.vang} vắng · {chua} chưa</p>
          <Link href={`/quan-ly/diem-danh/${b.id}`} className={`${moDD && chua > 0 ? nutChinh : nutPhu} mt-3 w-full`}>{moDD ? (chua > 0 ? "Mở điểm danh" : "Xem điểm danh") : "Xem trước danh sách"}</Link>
        </div>
      ) : null}
      {b.mon.link_meet && !huy && b.ngay >= h ? (
        <a href={b.mon.link_meet} target="_blank" rel="noopener noreferrer" className={`${nutPhu} w-full sm:w-auto sm:justify-self-start`}>Mở Meet <IconMoNgoai size={16} /></a>
      ) : null}
      <SuaBuoi key={b.id} id={b.id} linkRecord={b.link_record} noiDung={b.noi_dung} ghiChu={b.ghi_chu} dan={dan} />
      {chu ? <HanhDongBuoi b={{ ...nho(b), ly_do_huy: b.ly_do_huy }} daDiem={t?.da_diem ?? 0} xoaDuoc={xoaDuoc} mon={mons} ds={ds.map(nho)} homNay={h} /> : null}
    </section>
  );
}
