// Màn Hôm nay (man-hom-nay.md) — chủ lớp và giáo viên; lọc theo vai làm ở máy chủ (server/hom-nay.ts).
// Mỗi khối (tối nay · việc · số liệu · lịch) là một async component trong Suspense + ranh giới lỗi riêng (§10):
// lỗi khi dựng một khối không làm mất thẻ Điểm danh. Mỗi khối gọi hàm riêng của máy chủ (lopToiNay · viecCanLam · theSo ·
// lich7Ngay, React cache theo lượt tải); cả 4 bắt đầu ngay khi trang dựng, khối tối nay nhẹ nhất nên hiện trước.
// Việc thử sắp hết kèm sẵn lứa + SĐT HS (không phải đọc cả danh sách học sinh).
import Link from "next/link";
import { cache, Suspense, type ReactNode } from "react";
import { lich7Ngay, lopToiNay, theSo, viecCanLam } from "@/server/hom-nay";
import { napMon } from "@/server/du-lieu";
import { ngayVN } from "@/lib/ngay";
import type { NguoiQuanLy } from "@/lib/quyen";
import { layNguoiQuanLy } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import LoiKhoi from "@/components/khung/loi-khoi";
import { ChoTai, Khoi as KhoiCho } from "@/components/ui/trang-thai";
import { ddmm, gio, lucVN, tenGv, thuNgay, thuNganNgay, tenMonDayDu } from "@/components/dinh-dang";
import { IconMoNgoai } from "@/components/bieu-tuong";
import { nutChinhTo, nutPhu } from "@/components/ui/nut";
import { DemNguoc, HenLamMoi } from "@/components/quan-ly/dem-nguoc";
import { NhomThu, type EmThu } from "@/components/quan-ly/nhom-thu";
import { TabViecCanLam, type TabViec } from "@/components/quan-ly/tab-viec";

export const metadata = { title: "Hôm nay" };

type Buoi = Awaited<ReturnType<typeof lopToiNay>>[number];
type Lich = Awaited<ReturnType<typeof lich7Ngay>>;
type TheSo = Awaited<ReturnType<typeof theSo>>;
type DsViec = Awaited<ReturnType<typeof viecCanLam>>["viec"];
type Mon = { ma: string; ten: string } | undefined;
type Viec = DsViec[number];
type P = { u: NguoiQuanLy; luc: number };

// Một lần gọi mỗi hàm cho cả lượt tải (khối tối nay rỗng cũng đọc lịch để báo buổi kế).
const layToiNay = cache((u: NguoiQuanLy, luc: number) => lopToiNay(u, new Date(luc)));
const layViec = cache((u: NguoiQuanLy, luc: number) => viecCanLam(u, new Date(luc)));
const laySo = cache((u: NguoiQuanLy, luc: number) => theSo(u, new Date(luc)));
const layLich = cache((u: NguoiQuanLy, luc: number) => lich7Ngay(u, new Date(luc)));

export default async function HomNay() {
  const u = await layNguoiQuanLy();
  const luc = Date.now();
  const chu = u.vai === "chu";
  // Bắt đầu cả 4 ngay (chạy song song, mỗi khối chờ đúng phần của mình). Lỗi để ranh giới lỗi của khối bắt khi khối đọc lại.
  for (const f of [layToiNay, layViec, laySo, layLich]) f(u, luc).catch(() => {});
  const hom = ngayVN(new Date(luc));
  return (
    <>
      <DauTrang tieuDe="Hôm nay" phu={thuNgay(hom)} />
      <NoiDung>
        <h1 className="sr-only">Hôm nay · {thuNgay(hom)}</h1>
        <div className="grid gap-6">
        {chu ? <div className="order-last lg:order-first"><Khoi ten="số liệu nhanh" cho={<div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">{[0, 1, 2, 3].map((i) => <KhoiCho key={i} className="h-20" />)}</div>}><KhoiTheSo u={u} luc={luc} /></Khoi></div> : null}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="grid content-start gap-6 lg:col-span-8">
            <Khoi ten="lớp tối nay" cho={<KhoiCho className="h-[200px] rounded-[20px]" />}><KhoiToiNay u={u} luc={luc} /></Khoi>
            <Khoi ten="việc cần làm" cho={<ChoViec />}><KhoiViec u={u} luc={luc} /></Khoi>
          </div>
          <div className="grid content-start gap-6 lg:col-span-4">
            <Khoi ten="số liệu lớp" cho={<ChoSoLieu />}><KhoiSoLieu u={u} luc={luc} /></Khoi>
            <Khoi ten="lịch 7 ngày tới" cho={<KhoiCho className="h-[320px]" />}><KhoiLich u={u} luc={luc} /></Khoi>
          </div>
        </div>
        </div>
      </NoiDung>
    </>
  );
}

function Khoi({ ten, cho, children }: { ten: string; cho: ReactNode; children: ReactNode }) {
  return (
    <LoiKhoi ten={ten}>
      <Suspense fallback={<ChoTai>{cho}</ChoTai>}>{children}</Suspense>
    </LoiKhoi>
  );
}
function ChoViec() {
  return (
    <div className="grid gap-3">
      <KhoiCho className="h-7 w-36" />
      <div className="flex flex-wrap gap-2">{[0, 1, 2, 3].map((i) => <KhoiCho key={i} className="h-11 w-28 rounded-full" />)}</div>
      {[0, 1, 2].map((i) => <KhoiCho key={i} className="h-14" />)}
    </div>
  );
}
function ChoSoLieu() {
  return (
    <div className="grid gap-3">
      <KhoiCho className="h-7 w-32" />
      <KhoiCho className="h-56" />
    </div>
  );
}

async function KhoiToiNay({ u, luc }: P) {
  const ds = await layToiNay(u, luc);
  const chu = u.vai === "chu";
  if (ds.length) return <section aria-label="Lớp tối nay" className="grid gap-3">{ds.map((b) => <TheToiNay key={b.id} b={b} luc={luc} chu={chu} />)}</section>;
  const [lich, mons] = await Promise.all([layLich(u, luc), chu ? null : napMon()]);
  const monGv = mons ? mons.filter((m) => u.monIds.includes(m.id)).map((m) => m.ten_ngan).join(", ") : null;
  return <section aria-label="Lớp tối nay" className="grid gap-3"><TheKhongBuoi lich={lich} hom={ngayVN(new Date(luc))} monGv={monGv} /></section>;
}
async function KhoiViec({ u, luc }: P) {
  const d = await layViec(u, luc);
  return <ViecCanLam viec={d.viec} chu={u.vai === "chu"} hom={ngayVN(new Date(luc))} />;
}
async function KhoiSoLieu({ u, luc }: P) {
  return <SoLieu t={await laySo(u, luc)} />;
}
async function KhoiLich({ u, luc }: P) {
  return <Lich7 lich={await layLich(u, luc)} hom={ngayVN(new Date(luc))} />;
}

// Thẻ tối nay: nền đêm (cùng nhận diện với khu học sinh), mỗi trạng thái đúng MỘT nút vàng (QĐ 27).
const theLon = "nen-dem rounded-[20px] p-4 sm:p-6";

function TheToiNay({ b, luc, chu }: { b: Buoi; luc: number; chu: boolean }) {
  const mon = b.mon?.ten_day_du || tenMonDayDu(b.mon?.ma, b.mon?.ten);
  const meet = b.mon?.link_meet ? <a href={b.mon.link_meet} target="_blank" rel="noopener noreferrer" className={nutPhu}>Mở Meet <IconMoNgoai size={16} /><span className="sr-only"> (mở thẻ mới)</span></a> : null;
  const gv = chu && b.mon?.giao_vien.length ? <> · <span translate="no" className="whitespace-nowrap">{tenGv(b.mon.giao_vien)}</span></> : null;
  const batDau = lucVN(b.ngay, b.gio.slice(0, 5)).getTime();
  const ketThuc = lucVN(b.ngay, b.gio.slice(6, 11)).getTime() + (b.gio.slice(6, 11) < b.gio.slice(0, 5) ? 86400_000 : 0);
  const moLuc = batDau - 30 * 60_000;
  const conThieu = b.si_so - b.da_diem;
  const ddHref = `/quan-ly/diem-danh/${b.id}`;
  const ndHref = `/quan-ly/buoi-hoc?thang=${b.ngay.slice(0, 7)}&buoi=${b.id}`;
  const gioBd = b.gio.slice(0, 5);
  let h1: React.ReactNode, phu: React.ReactNode, chinh: React.ReactNode = null, phuNut: React.ReactNode = null, mauH1 = "";

  if (b.trang_thai === "huy") {
    h1 = `${mon} tối nay: lớp nghỉ`;
    phu = b.ly_do_huy ? `Lý do: ${b.ly_do_huy}` : "Lớp nghỉ";
    phuNut = <Link href={ndHref} className={nutPhu}>Xem buổi</Link>;
  } else if (b.toi_qua) {
    h1 = `Buổi tối qua — ${b.mon?.ten} ${ddmm(b.ngay)}`;
    phu = `Còn thiếu ${conThieu} em`;
    chinh = <Link href={ddHref} prefetch className={`${nutChinhTo} w-full sm:w-auto sm:min-w-56`}>Điểm danh</Link>;
  } else if (luc < moLuc) {
    h1 = `Tối nay học ${mon} lúc ${gioBd}`;
    phu = <>{b.chinh_thuc} chính thức · {b.thu} thử · còn <DemNguoc den={batDau} luc={luc} /></>;
    // Trang để nguyên tới 21:45: làm mới một lần để nút đổi thành nút vàng "Điểm danh".
    chinh = <><Link href={ddHref} prefetch className={`${nutChinhTo} w-full sm:w-auto`}>Điểm danh mở lúc {gio(moLuc)}</Link><HenLamMoi luc={moLuc} /></>;
    phuNut = <Link href={ndHref} className={nutPhu}>Thêm nội dung / record</Link>;
  } else if (luc <= ketThuc) {
    h1 = luc < batDau ? `Tối nay học ${mon} lúc ${gioBd}` : `Đang học ${mon}`;
    phu = `Đã điểm ${b.da_diem}/${b.si_so}`;
    chinh = <Link href={ddHref} prefetch className={`${nutChinhTo} w-full sm:w-auto sm:min-w-56`}>Điểm danh</Link>;
    phuNut = meet;
  } else if (conThieu > 0) {
    h1 = `${mon} tối nay chưa điểm xong`;
    mauH1 = "text-warn";
    phu = `Còn ${conThieu} em chưa điểm`;
    chinh = <Link href={ddHref} prefetch className={`${nutChinhTo} w-full sm:w-auto sm:min-w-56`}>Điểm danh tiếp</Link>;
    phuNut = <Link href={ndHref} className={nutPhu}>Thêm nội dung / record</Link>;
  } else {
    h1 = `${mon} tối nay đã điểm đủ`;
    phu = `Đã điểm ${b.da_diem}/${b.si_so}`;
    chinh = <Link href={ndHref} className={b.co_record ? `${nutPhu} min-h-12` : `${nutChinhTo} w-full sm:w-auto`}>Thêm nội dung / record</Link>;
    phuNut = <Link href={ddHref} className={nutPhu}>Xem điểm danh</Link>;
  }
  return (
    <article className={theLon}>
      <h2 className={`text-[22px] font-extrabold leading-tight text-balance lg:text-[28px] ${mauH1}`}>{h1}</h2>
      <p className="so mt-1 text-text-2">{phu}{gv}</p>
      {chinh || phuNut ? <div className="mt-4 flex flex-wrap items-center gap-3">{chinh}{phuNut}</div> : null}
    </article>
  );
}

function TheKhongBuoi({ lich, hom, monGv }: { lich: Lich; hom: string; monGv: string | null }) {
  const ke = lich.flatMap((x) => x.buoi).find((b) => b.ngay > hom && b.trang_thai !== "huy");
  return (
    <article className={theLon}>
      <h2 className="text-[22px] font-extrabold leading-tight text-balance lg:text-[28px]">Tối nay không có buổi{monGv ? ` ${monGv}` : ""}</h2>
      <p className="so mt-1 text-text-2">{ke ? `Buổi kế: ${thuNgay(ke.ngay)} · ${tenMonDayDu(ke.mon?.ma, ke.mon?.ten)} ${ke.gio.slice(0, 5)}` : "Chưa có lịch buổi học trong 7 ngày tới."}</p>
      <div className="mt-4"><Link href="/quan-ly/buoi-hoc" className={nutPhu}>Xem lịch</Link></div>
    </article>
  );
}

const hangViec = "flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2 last:border-b-0";
/** Hàng có nhiều nút: điện thoại cho chữ chiếm hết dòng, nút xuống dòng dưới (không vỡ chữ từng từ). */
const chuNhieuNut = "min-w-0 basis-full sm:basis-0 sm:flex-1";
const nutNho = "nhan inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border-input px-3 text-[14px] font-semibold hover:bg-row-hover";

function ViecCanLam({ viec, chu, hom }: { viec: DsViec; chu: boolean; hom: string }) {
  const theo = <L extends string>(loai: L) => viec.filter((v) => v.loai === loai);
  const don = theo("don_cho_duyet");
  const sap = theo("thu_sap_het");
  const het = theo("het_thu");
  const chua = theo("buoi_chua_diem_danh");
  const thieu = theo("buoi_thieu_record");
  const vang = theo("em_vang_nhieu");
  const sua = theo("sua_du_lieu");
  const dem = (vs: Viec[]) => vs.reduce((s, v) => s + ((v.buoi as unknown[] | undefined)?.length ?? 0), 0);
  const emThu = (v: Viec): EmThu => ({ ma_hs: String(v.ma_hs), ho_ten: String(v.ho_ten), mon: ((v.mon as Mon[]) ?? []).map((m) => m?.ten ?? ""), den: v.loai === "thu_sap_het" ? v.ngay : null, het: v.loai === "het_thu" && v.ngay ? ddmm(v.ngay) : null, con_ngay: (v.con_ngay as number) ?? null, lua: (v.lua as string | null) ?? null, sdt: (v.sdt_hs as string | null) ?? null });
  const nhomTheoNgay = (vs: Viec[]) => [...Map.groupBy(vs, (v) => v.ngay ?? "").entries()].sort(([a], [b]) => a.localeCompare(b));
  const trong = (chu2: string, href: string, nhan: string) => (
    <p className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 px-4 py-2 text-text-2">{chu2} <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-gold hover:underline">{nhan} ›</Link></p>
  );
  const xemTatCa = (href: string, nhan: string) => <Link href={href} className="flex min-h-11 items-center justify-end border-t border-border px-4 text-[14px] font-semibold text-gold hover:underline">{nhan} ›</Link>;

  const tabs: TabViec[] = [
    {
      id: "chua", nhan: "Chưa điểm", so: dem(chua),
      noiDung: chua.length || vang.length ? (
        <>
          <ul>
            {chua.map((v) => {
              const bs = v.buoi as { id: number; ngay: string; thieu: number }[];
              return (
                <li key={`chua-${(v.mon as Mon)?.ma}`} className={hangViec}>
                  <p className={chuNhieuNut}><span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-danger align-middle" /><span className="font-semibold">Buổi chưa điểm danh</span> · {(v.mon as Mon)?.ten} · {bs.length} buổi</p>
                  <span className="flex flex-wrap gap-2">
                    {bs.map((b) => <Link key={b.id} href={`/quan-ly/diem-danh/${b.id}`} className={`${nutNho} so`} aria-label={`Điểm danh ${(v.mon as Mon)?.ten} ${thuNgay(b.ngay)}, còn ${b.thieu} em`}>{thuNganNgay(b.ngay)}</Link>)}
                  </span>
                </li>
              );
            })}
            {vang.map((v) => {
              const em = v.em as { ma_hs: string; ho_ten: string; so_vang: number }[];
              return (
                <li key={`vang-${(v.mon as Mon)?.ma}`} className={hangViec}>
                  <p className={chuNhieuNut}><span className="font-semibold">Em vắng nhiều</span> · {(v.mon as Mon)?.ten} · {em.length} em vắng từ 2 buổi</p>
                  <span className="flex flex-wrap gap-2">
                    {em.slice(0, 3).map((e) => <Link key={e.ma_hs} href={`/quan-ly/hoc-sinh/${e.ma_hs}`} className={nutNho} translate="no">{e.ho_ten} <span className="so ml-1 text-danger">{e.so_vang}</span></Link>)}
                    <Link href={`/quan-ly/diem-danh/thang?mon=${(v.mon as Mon)?.ma}`} className={nutNho}>Ma trận ›</Link>
                  </span>
                </li>
              );
            })}
          </ul>
          {xemTatCa("/quan-ly/diem-danh#chua-diem", "Mở Điểm danh")}
        </>
      ) : trong("Không còn buổi nào chưa điểm danh.", "/quan-ly/diem-danh", "Mở Điểm danh"),
    },
    ...(chu ? [{
      id: "thu", nhan: "Học thử", so: sap.length + het.length,
      noiDung: sap.length || het.length ? (
        <>
          <div className="grid gap-3 p-3">
            {het.length ? <NhomThu mo loai="het_thu" tieuDe="Hết thử – hỏi em" em={het.map(emThu)} xemTatCa="/quan-ly/hoc-sinh?het=da-het" homNay={hom} /> : null}
            {nhomTheoNgay(sap).map(([ngay, vs]) => (
              <NhomThu loai="thu_sap_het" key={`sap-${ngay}`} tieuDe={`Thử sắp hết · Hết ${thuNgay(ngay)}`} em={vs.map(emThu)} xemTatCa={`/quan-ly/hoc-sinh?het_ngay=${ngay}`} homNay={hom} />
            ))}
          </div>
          {xemTatCa("/quan-ly/hoc-sinh?het=3", "Xem cả danh sách thử sắp hết")}
        </>
      ) : trong("Không có em nào sắp hết hoặc đã hết thử.", "/quan-ly/hoc-sinh?loai=thu", "Xem em đang thử"),
    }, {
      id: "don", nhan: "Đơn", so: don.length,
      noiDung: don.length ? (
        <ul>
          {don.map((v) => (
            <li key={String(v.don_id)} className={hangViec}>
              <span aria-hidden="true" className="size-2 rounded-full bg-gold" />
              <p className="min-w-0 flex-1"><span className="font-semibold">Đơn chờ duyệt</span> · <span translate="no">{String(v.ho_ten)}</span>{v.ngay ? <span className="so text-text-3"> · {ddmm(v.ngay)}</span> : null}</p>
              <Link href={`/quan-ly/don?don=${v.don_id}`} className={nutNho}>Mở</Link>
            </li>
          ))}
        </ul>
      ) : trong("Không có đơn nào chờ duyệt.", "/quan-ly/don?loc=tat-ca", "Xem tất cả đơn"),
    }] : []),
    {
      id: "record", nhan: "Thiếu record", so: dem(thieu),
      noiDung: thieu.length ? (
        <ul>
          {thieu.map((v) => (
            <li key={`thieu-${(v.mon as Mon)?.ma}`} className={hangViec}>
              <p className="min-w-0 flex-1"><span className="font-semibold">Buổi thiếu record</span> · {(v.mon as Mon)?.ten} · <span className="so">{(v.buoi as unknown[]).length}</span></p>
              <Link href={`/quan-ly/buoi-hoc?record=thieu&mon=${(v.mon as Mon)?.ma}`} className={nutNho}>Mở</Link>
            </li>
          ))}
        </ul>
      ) : trong("Buổi nào cũng đã có record.", "/quan-ly/buoi-hoc", "Mở Buổi học"),
    },
    ...(sua.length ? [{
      id: "sua", nhan: "Sửa dữ liệu", so: sua.length,
      noiDung: (
        <ul>
          {sua.map((v) => (
            <li key={`sua-${v.ma_hs}`} className={hangViec}>
              <p className="min-w-0 flex-1"><span className="font-semibold">Sửa dữ liệu</span> · <span translate="no">{String(v.ho_ten)}</span> · <span className="text-text-3">{(v.loi as string[]).map((x) => ({ gmail: "Gmail", sdt: "SĐT", lua: "lứa" })[x] ?? x).join(", ")}</span></p>
              <Link href={`/quan-ly/hoc-sinh/${v.ma_hs}`} className={nutNho}>Mở</Link>
            </li>
          ))}
        </ul>
      ),
    }] : []),
  ];

  return (
    <section aria-labelledby="viec" className="grid grid-cols-1 gap-3">{/* grid-cols-1 = minmax(0,1fr): dãy tab tự cuộn, không đẩy trang tràn ngang */}
      <h2 id="viec" className="text-lg font-semibold">Việc cần làm</h2>
      <TabViecCanLam tabs={tabs} />
    </section>
  );
}

/** Bốn thẻ số liệu của chủ lớp: hàng trên cùng ở máy tính, cuối trang ở điện thoại (thẻ buổi và việc đi trước). */
async function KhoiTheSo({ u, luc }: P) {
  const t = (await laySo(u, luc)) as TheSo & Partial<{ dang_hoc_chinh_thuc: number; dang_thu: number; thu_het_3_ngay: number; len_chinh_thuc_thang_nay: number }>;
  const the = "nhan flex min-h-20 flex-col justify-center rounded-[14px] border border-border bg-surface px-4 py-3 hover:bg-row-hover";
  return (
    <ul aria-label="Số liệu nhanh" className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
      {[
        { so: t.dang_hoc_chinh_thuc ?? 0, nhan: "Chính thức", href: "/quan-ly/hoc-sinh?loai=chinh-thuc" },
        { so: t.dang_thu ?? 0, nhan: "Đang thử", href: "/quan-ly/hoc-sinh?loai=thu" },
        { so: t.thu_het_3_ngay ?? 0, nhan: "Thử hết trong 3 ngày", href: "/quan-ly/hoc-sinh?het=3", bao: true },
        { so: t.len_chinh_thuc_thang_nay ?? 0, nhan: "Lên chính thức tháng này", href: "/quan-ly/hoc-sinh?loai=chinh-thuc" },
      ].map((x) => (
        <li key={x.nhan}><Link href={x.href} className={`${the} ${x.bao && x.so > 0 ? "border-warn" : ""}`}><span className={`so text-2xl font-extrabold ${x.bao && x.so > 0 ? "text-warn" : ""}`}>{x.so}</span><span className="text-[13px] text-text-2">{x.nhan}</span></Link></li>
      ))}
    </ul>
  );
}

function SoLieu({ t }: { t: TheSo }) {
  return (
    <section aria-labelledby="so-lieu" className="grid gap-3">
      <h2 id="so-lieu" className="text-lg font-semibold">Số liệu lớp</h2>
      <div className="rounded-[14px] border border-border bg-surface">
        <h3 className="px-4 pt-3 text-[13px] font-semibold text-text-2">Sĩ số theo môn</h3>
        <ul className="py-1">
          {t.si_so.map((s) => (
            <li key={s.mon?.ma}>
              <Link href={`/quan-ly/hoc-sinh?mon=${s.mon?.ma}`} className="flex min-h-11 items-center justify-between gap-3 px-4 hover:bg-row-hover">
                <span className="font-semibold">{s.mon?.ten}</span>
                <span className="so text-text-2">{s.chinh_thuc} chính thức · {s.thu} thử</span>
              </Link>
            </li>
          ))}
        </ul>
        <h3 className="border-t border-border px-4 pt-3 text-[13px] font-semibold text-text-2">Có mặt tháng này</h3>
        <ul className="py-1">
          {t.co_mat_thang.map((s) => (
            <li key={s.mon?.ma}>
              <Link href={`/quan-ly/diem-danh/thang?mon=${s.mon?.ma}`} className="block px-4 py-2 hover:bg-row-hover">
                <span className="flex min-h-7 items-center justify-between gap-3">
                  <span className="font-semibold">{s.mon?.ten}</span>
                  <span className="so text-text-2">{s.tong ? <><span className="font-semibold text-text">{Math.round((s.co / s.tong) * 100)}%</span> · </> : null}{s.co}/{s.tong}</span>
                </span>
                {/* Thanh chỉ để nhìn nhanh; số ở trên là thông tin chính. Dưới 70% đổi màu cảnh báo. */}
                <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-raised"><span className={`block h-full rounded-full ${s.tong && s.co / s.tong < 0.7 ? "bg-warn" : "bg-ok"}`} style={{ width: `${s.tong ? (s.co / s.tong) * 100 : 0}%` }} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Lich7({ lich, hom }: { lich: Lich; hom: string }) {
  return (
    <section aria-labelledby="lich7" className="grid gap-3">
      <h2 id="lich7" className="text-lg font-semibold">7 ngày tới</h2>
      <ul className="rounded-[14px] border border-border bg-surface py-1">
        {lich.map((x) => (
          <li key={x.ngay} className={`flex min-h-11 flex-wrap items-center gap-x-3 px-4 py-1 ${x.ngay === hom ? "bg-today-col" : ""}`}>
            <span className={`so w-20 shrink-0 font-semibold ${x.ngay === hom ? "text-gold" : "text-text-2"}`}>{thuNganNgay(x.ngay)}</span>
            {x.buoi.length ? (
              x.buoi.map((b) => (
                <Link key={b.id} href={`/quan-ly/buoi-hoc?thang=${b.ngay.slice(0, 7)}&buoi=${b.id}`} className="inline-flex min-h-11 items-center hover:underline">
                  {b.mon?.ten} <span className="so ml-1 text-text-3">{b.gio.slice(0, 5)}</span>
                  {b.trang_thai === "huy" ? <span className="ml-1 text-text-3">· Lớp nghỉ</span> : b.loai === "hoc_bu" ? <span className="ml-1 text-text-3">· bù</span> : null}
                </Link>
              ))
            ) : (
              <span className="text-text-3">Không có buổi</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
