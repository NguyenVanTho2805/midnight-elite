// Màn Hôm nay (man-hom-nay.md) — chủ lớp và giáo viên; lọc theo vai làm ở máy chủ (server/hom-nay.ts).
// Mỗi khối (tối nay · việc · số liệu · lịch) là một async component trong Suspense + ranh giới lỗi riêng (§10):
// lỗi khi dựng một khối không làm mất thẻ Điểm danh. Hiện cả 4 khối đọc chung MỘT lần gọi homNay (React cache theo
// lượt tải) và chọn phần mình cần — khi phòng Máy chủ tách homNay thành hàm riêng cho "lớp tối nay", khối tối nay
// sẽ tự tải trước mà không phải đổi bố cục.
import Link from "next/link";
import { cache, Suspense, type ReactNode } from "react";
import { homNay } from "@/server/hom-nay";
import { danhSachHocSinh } from "@/server/hoc-sinh";
import { ngayVN } from "@/lib/ngay";
import type { NguoiQuanLy } from "@/lib/quyen";
import { layNguoiQuanLy } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import LoiKhoi from "@/components/khung/loi-khoi";
import { ChoTai, Khoi as KhoiCho } from "@/components/ui/trang-thai";
import { ddmm, gio, lucVN, thuNgay, thuNganNgay, tenMonDayDu } from "@/components/dinh-dang";
import { IconMoNgoai } from "@/components/bieu-tuong";
import { nutChinhTo, nutPhu } from "@/components/ui/nut";
import { DemNguoc } from "@/components/quan-ly/dem-nguoc";
import { NhomThu, type EmThu } from "@/components/quan-ly/nhom-thu";

export const metadata = { title: "Hôm nay" };

type D = Awaited<ReturnType<typeof homNay>>;
type Buoi = D["lop_toi_nay"][number];
type Mon = { ma: string; ten: string } | undefined;
type Viec = D["viec"][number];
type P = { u: NguoiQuanLy; luc: number };

/** Một lần gọi homNay cho cả trang (các khối cùng đọc). */
const layHomNay = cache((u: NguoiQuanLy, luc: number) => homNay(u, new Date(luc)));
/** Lứa + SĐT HS cho khối thử sắp hết (chỉ chủ). Tạm đọc từ danhSachHocSinh — đề nghị homNay trả kèm lua/sdt_hs trong việc thử. */
const layLienHe = cache(async (u: NguoiQuanLy) => {
  const r = await danhSachHocSinh(u);
  return new Map(r.hoc_sinh.map((x) => [x.ma_hs, { lua: x.lua?.ma ?? null, sdt: (x as { sdt_hs?: string | null }).sdt_hs ?? null }]));
});

export default async function HomNay() {
  const u = await layNguoiQuanLy();
  const luc = Date.now();
  const chu = u.vai === "chu";
  void layHomNay(u, luc); // bắt đầu tải ngay, các khối dùng lại
  if (chu) void layLienHe(u);
  const hom = ngayVN(new Date(luc));
  return (
    <>
      <DauTrang tieuDe="Hôm nay" phu={thuNgay(hom)} />
      <NoiDung>
        <h1 className="sr-only">Hôm nay · {thuNgay(hom)}</h1>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="grid content-start gap-6 lg:col-span-8">
            <Khoi ten="lớp tối nay" cho={<KhoiCho className="h-[200px] rounded-[20px]" />}><KhoiToiNay u={u} luc={luc} /></Khoi>
            <Khoi ten="việc cần làm" cho={<ChoViec />}><KhoiViec u={u} luc={luc} /></Khoi>
          </div>
          <div className="grid content-start gap-6 lg:col-span-4">
            <Khoi ten="số liệu lớp" cho={<ChoSoLieu chu={chu} />}><KhoiSoLieu u={u} luc={luc} /></Khoi>
            <Khoi ten="lịch 7 ngày tới" cho={<KhoiCho className="h-[320px]" />}><KhoiLich u={u} luc={luc} /></Khoi>
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
function ChoSoLieu({ chu }: { chu: boolean }) {
  return (
    <div className="grid gap-3">
      <KhoiCho className="h-7 w-32" />
      {chu ? <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <KhoiCho key={i} className="h-20" />)}</div> : null}
      <KhoiCho className="h-56" />
    </div>
  );
}

async function KhoiToiNay({ u, luc }: P) {
  const d = await layHomNay(u, luc);
  const chu = u.vai === "chu";
  return (
    <section aria-label="Lớp tối nay" className="grid gap-3">
      {d.lop_toi_nay.length ? (
        d.lop_toi_nay.map((b) => <TheToiNay key={b.id} b={b} luc={luc} chu={chu} />)
      ) : (
        <TheKhongBuoi d={d} monGv={chu ? null : d.the_so.si_so.map((s) => s.mon?.ten).join(", ")} />
      )}
    </section>
  );
}
async function KhoiViec({ u, luc }: P) {
  const chu = u.vai === "chu";
  const [d, lienHe] = await Promise.all([layHomNay(u, luc), chu ? layLienHe(u) : null]);
  return <ViecCanLam d={d} chu={chu} lienHe={lienHe} />;
}
async function KhoiSoLieu({ u, luc }: P) {
  return <SoLieu d={await layHomNay(u, luc)} chu={u.vai === "chu"} />;
}
async function KhoiLich({ u, luc }: P) {
  return <Lich7 d={await layHomNay(u, luc)} />;
}

const theLon = "rounded-[20px] bg-raised p-4 sm:p-6";

function TheToiNay({ b, luc, chu }: { b: Buoi; luc: number; chu: boolean }) {
  const mon = b.mon?.ten_day_du || tenMonDayDu(b.mon?.ma, b.mon?.ten);
  const meet = b.mon?.link_meet ? <a href={b.mon.link_meet} target="_blank" rel="noopener noreferrer" className={nutPhu}>Mở Meet <IconMoNgoai size={16} /><span className="sr-only"> (mở thẻ mới)</span></a> : null;
  const gv = chu && b.mon?.giao_vien.length ? <span translate="no"> · GV {b.mon.giao_vien.join(", ")}</span> : null;
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
    chinh = <Link href={ddHref} prefetch className={`${nutPhu} min-h-14 w-full sm:w-auto`}>Điểm danh mở lúc {gio(moLuc)}</Link>;
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

function TheKhongBuoi({ d, monGv }: { d: D; monGv: string | null }) {
  const ke = d.lich_7_ngay.flatMap((x) => x.buoi).find((b) => b.ngay > d.hom_nay && b.trang_thai !== "huy");
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

function ViecCanLam({ d, chu, lienHe }: { d: D; chu: boolean; lienHe: Map<string, { lua: string | null; sdt: string | null }> | null }) {
  const theo = <L extends string>(loai: L) => d.viec.filter((v) => v.loai === loai);
  const don = theo("don_cho_duyet");
  const sap = theo("thu_sap_het");
  const het = theo("het_thu");
  const chua = theo("buoi_chua_diem_danh");
  const thieu = theo("buoi_thieu_record");
  const vang = theo("em_vang_nhieu");
  const sua = theo("sua_du_lieu");
  const dem = (vs: Viec[]) => vs.reduce((s, v) => s + ((v.buoi as unknown[] | undefined)?.length ?? 0), 0);
  const chips = [
    ...(chu ? [{ nhan: "Đơn", so: don.length, href: "/quan-ly/don" }, { nhan: "Thử sắp hết", so: sap.length, href: "/quan-ly/hoc-sinh?het=3" }] : []),
    { nhan: "Chưa điểm", so: dem(chua), href: "/quan-ly/diem-danh#chua-diem" },
    { nhan: "Thiếu record", so: dem(thieu), href: "/quan-ly/buoi-hoc?record=thieu" },
  ];
  const emThu = (v: Viec): EmThu => ({ ma_hs: String(v.ma_hs), ho_ten: String(v.ho_ten), mon: ((v.mon as Mon[]) ?? []).map((m) => m?.ten ?? ""), den: v.loai === "thu_sap_het" ? v.ngay : null, het: v.loai === "het_thu" && v.ngay ? ddmm(v.ngay) : null, con_ngay: (v.con_ngay as number) ?? null, ...lienHe?.get(String(v.ma_hs)) });
  const nhomTheoNgay = (vs: Viec[]) => [...Map.groupBy(vs, (v) => v.ngay ?? "").entries()].sort(([a], [b]) => a.localeCompare(b));
  const coViec = don.length + sap.length + het.length + chua.length + thieu.length + vang.length + sua.length > 0;

  return (
    <section aria-labelledby="viec" className="grid gap-3">
      <h2 id="viec" className="text-lg font-semibold">Việc cần làm</h2>
      <ul className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <li key={c.nhan}>
            <Link href={c.href} className="nhan inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 font-semibold hover:bg-row-hover">
              {c.nhan} <span className={`so ${c.so > 0 ? "text-warn" : "text-text-3"}`}>{c.so}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!coViec ? <p className="rounded-[14px] border border-border bg-surface px-4 py-4 text-text-2">Không còn việc gì cần làm hôm nay.</p> : null}
      {don.length ? (
        <ul className="rounded-[14px] border border-border bg-surface">
          {don.map((v) => (
            <li key={String(v.don_id)} className={hangViec}>
              <span aria-hidden="true" className="size-2 rounded-full bg-gold" />
              <p className="min-w-0 flex-1"><span className="font-semibold">Đơn chờ duyệt</span> · <span translate="no">{String(v.ho_ten)}</span>{v.ngay ? <span className="so text-text-3"> · {ddmm(v.ngay)}</span> : null}</p>
              <Link href="/quan-ly/don" className={nutNho}>Mở</Link>
            </li>
          ))}
        </ul>
      ) : null}
      {het.length ? <NhomThu loai="het_thu" tieuDe="Hết thử – hỏi em" em={het.map(emThu)} xemTatCa="/quan-ly/hoc-sinh?het=da-het" homNay={d.hom_nay} /> : null}
      {nhomTheoNgay(sap).map(([ngay, vs]) => (
        <NhomThu loai="thu_sap_het" key={`sap-${ngay}`} tieuDe={`Thử sắp hết · Hết ${thuNgay(ngay)}`} em={vs.map(emThu)} xemTatCa="/quan-ly/hoc-sinh?het=3" homNay={d.hom_nay} />
      ))}
      {chua.length || thieu.length || vang.length ? (
        <ul className="rounded-[14px] border border-border bg-surface">
          {chua.map((v) => {
            const bs = v.buoi as { id: number; ngay: string; thieu: number }[];
            return (
              <li key={`chua-${(v.mon as Mon)?.ma}`} className={hangViec}>
                <p className={chuNhieuNut}><span className="font-semibold">Buổi chưa điểm danh</span> · {(v.mon as Mon)?.ten} · {bs.length} buổi</p>
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
          {thieu.map((v) => (
            <li key={`thieu-${(v.mon as Mon)?.ma}`} className={hangViec}>
              <p className="min-w-0 flex-1"><span className="font-semibold">Buổi thiếu record</span> · {(v.mon as Mon)?.ten} · <span className="so">{(v.buoi as unknown[]).length}</span></p>
              <Link href={`/quan-ly/buoi-hoc?record=thieu&mon=${(v.mon as Mon)?.ma}`} className={nutNho}>Mở</Link>
            </li>
          ))}
        </ul>
      ) : null}
      {sua.length ? (
        <ul className="rounded-[14px] border border-border bg-surface">
          {sua.map((v) => (
            <li key={`sua-${v.ma_hs}`} className={hangViec}>
              <p className="min-w-0 flex-1"><span className="font-semibold">Sửa dữ liệu</span> · <span translate="no">{String(v.ho_ten)}</span> · <span className="text-text-3">{(v.loi as string[]).map((x) => ({ gmail: "Gmail", sdt: "SĐT", lua: "lứa" })[x] ?? x).join(", ")}</span></p>
              <Link href={`/quan-ly/hoc-sinh/${v.ma_hs}`} className={nutNho}>Mở</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SoLieu({ d, chu }: { d: D; chu: boolean }) {
  const t = d.the_so as D["the_so"] & Partial<{ dang_hoc_chinh_thuc: number; dang_thu: number; thu_het_3_ngay: number; len_chinh_thuc_thang_nay: number }>;
  const the = "nhan flex min-h-20 flex-col justify-center rounded-[14px] border border-border bg-surface px-4 py-3 hover:bg-row-hover";
  return (
    <section aria-labelledby="so-lieu" className="grid gap-3">
      <h2 id="so-lieu" className="text-lg font-semibold">Số liệu lớp</h2>
      {chu ? (
        <ul className="grid grid-cols-2 gap-2">
          {[
            { so: t.dang_hoc_chinh_thuc ?? 0, nhan: "Chính thức", href: "/quan-ly/hoc-sinh?loai=chinh-thuc" },
            { so: t.dang_thu ?? 0, nhan: "Đang thử", href: "/quan-ly/hoc-sinh?loai=thu" },
            { so: t.thu_het_3_ngay ?? 0, nhan: "Thử hết trong 3 ngày", href: "/quan-ly/hoc-sinh?het=3" },
            { so: t.len_chinh_thuc_thang_nay ?? 0, nhan: "Lên chính thức tháng này", href: "/quan-ly/hoc-sinh?loai=chinh-thuc" },
          ].map((x) => (
            <li key={x.nhan}><Link href={x.href} className={the}><span className="so text-2xl font-extrabold">{x.so}</span><span className="text-[13px] text-text-2">{x.nhan}</span></Link></li>
          ))}
        </ul>
      ) : null}
      <div className="rounded-[14px] border border-border bg-surface">
        <h3 className="px-4 pt-3 text-[13px] font-semibold text-text-2">Sĩ số theo môn</h3>
        <ul className="py-1">
          {d.the_so.si_so.map((s) => (
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
          {d.the_so.co_mat_thang.map((s) => (
            <li key={s.mon?.ma}>
              <Link href={`/quan-ly/diem-danh/thang?mon=${s.mon?.ma}`} className="flex min-h-11 items-center justify-between gap-3 px-4 hover:bg-row-hover">
                <span className="font-semibold">{s.mon?.ten}</span>
                <span className="so text-text-2">{s.co}/{s.tong}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Lich7({ d }: { d: D }) {
  return (
    <section aria-labelledby="lich7" className="grid gap-3">
      <h2 id="lich7" className="text-lg font-semibold">7 ngày tới</h2>
      <ul className="rounded-[14px] border border-border bg-surface py-1">
        {d.lich_7_ngay.map((x) => (
          <li key={x.ngay} className={`flex min-h-11 flex-wrap items-center gap-x-3 px-4 py-1 ${x.ngay === d.hom_nay ? "bg-today-col" : ""}`}>
            <span className={`so w-20 shrink-0 font-semibold ${x.ngay === d.hom_nay ? "text-gold" : "text-text-2"}`}>{thuNganNgay(x.ngay)}</span>
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
