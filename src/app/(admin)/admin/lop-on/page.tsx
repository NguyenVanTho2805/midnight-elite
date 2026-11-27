// Lớp ôn · Hôm nay (KiN lớp bước 4–5, Figma FyUkgGJHrhXo0u4gnREyfk 7:5 / 7:168 / 8:119). Chỉ chủ lớp, sau cờ LOP_ON.
// Bước 5: nút vàng "Điểm danh" ở thẻ Tối nay, nút "Điểm danh" ở từng buổi chưa điểm (hàng đầu nút chính), liên kết "Ma trận". Bước 6: tab Học thử nhóm theo ngày hết, có Gia hạn cả nhóm / Lên chính thức / Gia hạn / Cho nghỉ / Ẩn 3 ngày; đơn chờ dẫn tới đúng đơn ở trang Đơn. Thêm record còn ẨN.
// "Sĩ số theo môn" của bản gốc không có trong Figma ⇒ bỏ (lọc theo môn có ở trang Học sinh).
// Mỗi khối một truy vấn riêng: khối lỗi tự báo, không sập cả trang. Tab của "Việc cần làm" nằm trên URL (?viec=).
import Link from "next/link";
import type { ReactNode } from "react";
import { KinPanel, KinListRow, KinEmptyState, KIN_FIELD, KIN_TAB_BOX, KinTabInner, kinButtonClass } from "@/components/kin";
import { chuLop } from "@/lib/lop/server/cua";
import { lich7Ngay, lopToiNay, theSo, viecCanLam } from "@/lib/lop/server/hom-nay";
import { ddmm, lucVN, ngayVN, gioVN } from "@/lib/lop/ngay";
import { khoangThoiGian, sdt, tenMonDayDu, thuNgay, thuNganNgay } from "@/lib/lop/dinh-dang";
import { KhoiLoi, LOP_GOC, MonCham, lienKet, mauMon, thuTai } from "@/components/lop/hien-thi";
import { AnViec, GiaHan } from "@/components/lop/ThaoTacHs";

export const metadata = { title: "Lớp ôn · Hôm nay" };
export const dynamic = "force-dynamic";

type Buoi = Awaited<ReturnType<typeof lopToiNay>>[number];
type Lich = Awaited<ReturnType<typeof lich7Ngay>>;
type So = Awaited<ReturnType<typeof theSo>> & Partial<{ dang_hoc_chinh_thuc: number; dang_thu: number; thu_het_3_ngay: number }>;
type Viec = Awaited<ReturnType<typeof viecCanLam>>["viec"][number];
type Mon = { ma: string; ten: string } | undefined;

const HS = `${LOP_GOC}/hoc-sinh`;
const tieuDeKhoi = "text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]";

export default async function LopOnHomNay({ searchParams }: { searchParams: Promise<{ viec?: string }> }) {
  const u = await chuLop();
  const luc = new Date(), hom = ngayVN(luc), sp = await searchParams;
  const [toiNay, viec, so, lich] = await Promise.all([
    thuTai("lớp tối nay", () => lopToiNay(u, luc)), thuTai("việc cần làm", () => viecCanLam(u, luc)),
    thuTai("số liệu lớp", () => theSo(u, luc)), thuTai("lịch 7 ngày", () => lich7Ngay(u, luc)),
  ]);
  const chuaDiem = viec ? viec.viec.filter((v) => v.loai === "buoi_chua_diem_danh").reduce((s, v) => s + (v.buoi as unknown[]).length, 0) : null;

  return (
    <div className="max-w-7xl">
      <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Hôm nay <span className="whitespace-nowrap">· {thuNgay(hom)}</span></h1>
        <form action={HS} method="get" role="search" className="flex w-full gap-2 sm:w-80">
          <label className="min-w-0 flex-1"><span className="sr-only">Tìm học sinh theo tên, mã, số điện thoại</span>
            <input type="search" name="q" placeholder="Tìm học sinh…" autoComplete="off" spellCheck={false} enterKeyHint="search" className={KIN_FIELD} /></label>
          <button type="submit" data-kin-nut className={kinButtonClass("secondary")}>Tìm</button>
        </form>
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <section aria-label="Số liệu nhanh" className="order-3 lg:order-none lg:col-span-12">
          {so ? (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <TheSo so={(so as So).dang_hoc_chinh_thuc ?? 0} nhan="Chính thức" href={`${HS}?loai=chinh-thuc`} />
              <TheSo so={(so as So).dang_thu ?? 0} nhan="Đang thử" href={`${HS}?loai=thu`} />
              <TheSo so={(so as So).thu_het_3_ngay ?? 0} nhan="Thử hết trong 3 ngày" href={`${HS}?het=3`} bao />
              <TheSo so={chuaDiem} nhan="Buổi chưa điểm danh" bao />
            </ul>
          ) : <KhoiLoi ten="số liệu nhanh" href={LOP_GOC} />}
        </section>

        <section aria-label="Lớp tối nay" className="order-1 grid gap-3 lg:order-none lg:col-span-8">
          {!toiNay ? <KhoiLoi ten="lớp tối nay" href={LOP_GOC} />
            : toiNay.length ? toiNay.map((b) => <TheToiNay key={b.id} b={b} luc={luc.getTime()} />)
            : <TheKhongBuoi lich={lich} hom={hom} />}
        </section>

        <section aria-labelledby="co-mat" className="order-4 lg:order-none lg:col-span-4">
          {so ? (
            <KinPanel className="h-full">
              <div className="flex items-center justify-between gap-3"><h2 id="co-mat" className={tieuDeKhoi}>Có mặt tháng này</h2><Link href={`${LOP_GOC}/diem-danh/thang`} className={lienKet}>Ma trận ›</Link></div>
              <ul className="mt-3 grid gap-1">
                {so.co_mat_thang.map((s) => {
                  const pt = s.tong ? Math.round((s.co / s.tong) * 100) : null;
                  return (
                    <li key={s.mon?.ma} className="grid min-h-9 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-[length:var(--kin-co-goc)]">
                      <span className="flex items-center gap-2 text-[var(--kin-chu-chinh)]"><MonCham ma={s.mon?.ma} />{s.mon?.ten}</span>
                      {/* Thanh chỉ để nhìn nhanh; số bên phải là thông tin chính. */}
                      <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-[var(--kin-nen-re-chuot)]"><span className="block h-full rounded-full" style={{ width: `${pt ?? 0}%`, background: mauMon(s.mon?.ma) }} /></span>
                      <span className="tabular-nums text-right text-[var(--kin-chu-phu)]">{pt === null ? "Chưa có buổi" : <><span className="font-semibold text-[var(--kin-chu-chinh)]">{pt}%</span> <span className="text-[var(--kin-chu-mo)]">· {s.co}/{s.tong}</span></>}</span>
                    </li>
                  );
                })}
              </ul>
            </KinPanel>
          ) : <KhoiLoi ten="số liệu lớp" href={LOP_GOC} />}
        </section>

        <section aria-labelledby="viec" className="order-2 min-w-0 lg:order-none lg:col-span-8">
          {viec ? <ViecCanLam viec={viec.viec} daAn={viec.so_viec_da_an} tab={sp.viec} /> : <KhoiLoi ten="việc cần làm" href={LOP_GOC} />}
        </section>

        <section aria-labelledby="lich7" className="order-5 lg:order-none lg:col-span-4">
          {lich ? <Lich7 lich={lich} hom={hom} /> : <KhoiLoi ten="lịch 7 ngày tới" href={LOP_GOC} />}
        </section>
      </div>
    </div>
  );
}

function TheSo({ so, nhan, href, bao = false }: { so: number | null; nhan: string; href?: string; bao?: boolean }) {
  const nong = bao && !!so;
  const trong = (
    <>
      <span className={`block text-[length:var(--kin-co-so)] leading-7 font-semibold tabular-nums ${nong ? "text-[var(--kin-tt-chu-cho)]" : "text-[var(--kin-chu-chinh)]"}`}>{so ?? "—"}</span>
      <span className="mt-1 block text-[length:var(--kin-co-small)] leading-5 text-[var(--kin-chu-phu)]">{nhan}</span>
    </>
  );
  return (
    <li>
      <KinPanel variant={nong ? "canh-bao" : "mac-dinh"} flush className="h-full">
        {href ? <Link href={href} className="block h-full min-h-20 px-4 py-3 hover:bg-[var(--kin-nen-re-chuot)]">{trong}</Link> : <div className="min-h-20 px-4 py-3">{trong}</div>}
      </KinPanel>
    </li>
  );
}

// Thẻ tối nay: nền đêm (Figma dem/*). Nút vàng hiện khi điểm danh đã mở (30 phút trước giờ học); trước đó mốc mở hiện bằng chữ.
const theDem = "flex flex-col justify-center rounded-[var(--kin-bo-the)] bg-[var(--kin-lop-dem-nen)] px-5 py-6 sm:px-6 sm:py-8 text-[var(--kin-lop-dem-chu)]";
const demPhu = "text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)]";
const demH2 = "mt-2 text-[length:var(--kin-co-so)] leading-7 font-semibold text-balance [overflow-wrap:anywhere]";

function TheToiNay({ b, luc }: { b: Buoi; luc: number }) {
  const mon = b.mon?.ten_day_du || tenMonDayDu(b.mon?.ma, b.mon?.ten);
  const gioBd = b.gio.slice(0, 5), gioKt = b.gio.slice(6, 11);
  const batDau = lucVN(b.ngay, gioBd).getTime();
  const ketThuc = lucVN(b.ngay, gioKt).getTime() + (gioKt < gioBd ? 86400_000 : 0);
  const moLuc = batDau - 30 * 60_000, conThieu = b.si_so - b.da_diem;
  const gv = b.mon?.giao_vien.length ? ` · ${b.mon.giao_vien.join(", ")}` : "";
  let tren: string, h2: string, duoi: ReactNode = null;
  if (b.trang_thai === "huy") {
    tren = "Tối nay · lớp nghỉ"; h2 = `${mon} tối nay: lớp nghỉ`; duoi = b.ly_do_huy ? `Lý do: ${b.ly_do_huy}` : null;
  } else if (b.toi_qua) {
    tren = `Tối qua · ${ddmm(b.ngay)}`; h2 = `Buổi tối qua — ${b.mon?.ten} chưa điểm xong`; duoi = `Còn thiếu ${conThieu} em`;
  } else if (luc < moLuc) {
    tren = `Tối nay · còn ${khoangThoiGian(batDau - luc)} · ${b.chinh_thuc} chính thức · ${b.thu} thử`; h2 = `Tối nay học ${mon} lúc ${gioBd}`; duoi = `Điểm danh mở lúc ${gioVN(new Date(moLuc))}`;
  } else if (luc <= ketThuc) {
    tren = `Tối nay · ${b.chinh_thuc} chính thức · ${b.thu} thử`; h2 = luc < batDau ? `Tối nay học ${mon} lúc ${gioBd}` : `Đang học ${mon}`; duoi = `Đã điểm ${b.da_diem}/${b.si_so}`;
  } else if (conThieu > 0) {
    tren = `Tối nay · đã hết giờ học`; h2 = `${mon} tối nay chưa điểm xong`; duoi = `Còn ${conThieu} em chưa điểm · đã điểm ${b.da_diem}/${b.si_so}`;
  } else {
    tren = `Tối nay · đã hết giờ học`; h2 = `${mon} tối nay đã điểm đủ`; duoi = `Đã điểm ${b.da_diem}/${b.si_so}${b.co_record ? " · đã có record" : " · chưa có record"}`;
  }
  return (
    <article className={theDem}>
      <p className={`${demPhu} tabular-nums`}>{tren}{gv}</p>
      <h2 className={demH2}>{h2}</h2>
      {duoi ? <p className="mt-3 text-[length:var(--kin-co-body)] font-medium tabular-nums text-[var(--kin-lop-dem-nut)]">{duoi}</p> : null}
      {b.mo_diem_danh ? (
        <p className="mt-4"><Link href={`${LOP_GOC}/diem-danh/${b.id}`} className="inline-flex min-h-12 items-center justify-center rounded-[var(--kin-bo-md)] bg-[var(--kin-lop-dem-nut)] px-6 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-lop-dem-chu-tren-nut)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--kin-lop-dem-chu)]">{conThieu > 0 ? "Điểm danh" : "Xem điểm danh"}</Link></p>
      ) : null}
    </article>
  );
}

function TheKhongBuoi({ lich, hom }: { lich: Lich | null; hom: string }) {
  const ke = lich?.flatMap((x) => x.buoi).find((b) => b.ngay > hom && b.trang_thai !== "huy");
  return (
    <article className={theDem}>
      <p className={demPhu}>Tối nay</p>
      <h2 className={demH2}>Tối nay không có buổi</h2>
      <p className={`mt-3 ${demPhu} tabular-nums`}>{ke ? `Buổi kế: ${thuNgay(ke.ngay)} · ${tenMonDayDu(ke.mon?.ma, ke.mon?.ten)} ${ke.gio.slice(0, 5)}` : "Chưa có lịch buổi học trong 7 ngày tới."}</p>
    </article>
  );
}

function ViecCanLam({ viec, daAn, tab }: { viec: Viec[]; daAn: number; tab: string | undefined }) {
  const theo = (loai: string) => viec.filter((v) => v.loai === loai);
  const don = theo("don_cho_duyet"), sap = theo("thu_sap_het"), het = theo("het_thu"), chua = theo("buoi_chua_diem_danh"), thieu = theo("buoi_thieu_record"), vang = theo("em_vang_nhieu"), sua = theo("sua_du_lieu");
  const dem = (vs: Viec[]) => vs.reduce((s, v) => s + ((v.buoi as unknown[] | undefined)?.length ?? 0), 0);
  const tenCacMon = (v: Viec) => ((v.mon as Mon[]) ?? []).map((m) => m?.ten).filter(Boolean).join(", ");
  // Một em học thử: tên dẫn tới hồ sơ; bốn việc của chủ ngay trên hàng (không nút nào nổi bật — nút chính của trang là Điểm danh).
  const emThu = (v: Viec, phu: string) => (
    <li key={`${v.loai}-${v.ma_hs}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-2 last:border-b-0">
      <div className="min-w-48 flex-1">
        <Link href={`${HS}/${v.ma_hs}`} translate="no" className="inline-flex min-h-11 items-center font-medium text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] hover:underline [overflow-wrap:anywhere]">{String(v.ho_ten)}</Link>
        <p className="-mt-2 pb-1 text-[length:var(--kin-co-goc)] leading-5 tabular-nums text-[var(--kin-chu-mo)] [overflow-wrap:anywhere]">{[tenCacMon(v), phu, v.lua as string | null].filter(Boolean).join(" · ")}{v.sdt_hs ? <> · <span translate="no" className="whitespace-nowrap">{sdt(v.sdt_hs as string)}</span></> : null}</p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <Link href={`${HS}/${v.ma_hs}?mo=chinh-thuc`} className={kinButtonClass("secondary")}>Lên chính thức</Link>
        <GiaHan em={[{ ma_hs: String(v.ma_hs), ho_ten: String(v.ho_ten) }]} nhan="Gia hạn" />
        <Link href={`${HS}/${v.ma_hs}?mo=nghi`} className={kinButtonClass("ghost")}>Cho nghỉ</Link>
        <AnViec loai={v.loai} khoa={String(v.khoa)} ten={String(v.ho_ten)} />
      </div>
    </li>
  );
  // Nhóm theo ngày hết (hom-nay.md mức 2–3): cả nhóm cùng hạn thì gia hạn một lần.
  const nhomThu = (vs: Viec[], tieuDe: (ngay: string) => string, phu: (v: Viec) => string) => [...new Set(vs.map((v) => String(v.ngay ?? "")))].sort().map((ngay) => {
    const em = vs.filter((v) => String(v.ngay ?? "") === ngay);
    return (
      <section key={`${vs[0]?.loai}-${ngay}`} aria-label={tieuDe(ngay)}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-bang)] px-[var(--kin-kc-6)] py-2">
          <h3 className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{tieuDe(ngay)} <span className="font-normal tabular-nums text-[var(--kin-chu-mo)]">· {em.length} em</span></h3>
          {em.length > 1 ? <GiaHan em={em.map((v) => ({ ma_hs: String(v.ma_hs), ho_ten: String(v.ho_ten) }))} nhan="Gia hạn cả nhóm" /> : null}
        </div>
        <ul>{em.map((v) => emThu(v, phu(v)))}</ul>
      </section>
    );
  });
  const rong = (chu: string) => <KinEmptyState title="Không còn việc ở mục này">{chu}</KinEmptyState>;

  const tabs: { id: string; nhan: string; so: number; noiDung: ReactNode }[] = [
    {
      id: "chua", nhan: "Chưa điểm", so: dem(chua),
      noiDung: chua.length || vang.length ? (
        <>
          {chua.flatMap((v) => (v.buoi as { id: number; ngay: string; thieu: number }[]).map((b) => ({ ...b, mon: v.mon as Mon }))).map((b, i) => (
            <KinListRow key={b.id} title={<span className="font-medium">Buổi chưa điểm danh</span>} sub={<span className="tabular-nums">{b.mon?.ten} {thuNganNgay(b.ngay)} · còn {b.thieu} em</span>}
              trailing={<Link href={`${LOP_GOC}/diem-danh/${b.id}`} className={kinButtonClass(i === 0 ? "primary" : "secondary")}>Điểm danh</Link>} />
          ))}
          {vang.map((v) => {
            const em = v.em as { ma_hs: string; ho_ten: string; so_vang: number }[];
            return (
              <KinListRow key={`vang-${(v.mon as Mon)?.ma}`} title={<span className="font-medium">Em vắng nhiều · {(v.mon as Mon)?.ten}</span>}
                sub={`${em.length} em vắng không phép từ 2 buổi trong tháng`}
                status={<span className="flex flex-wrap gap-x-4">{em.slice(0, 5).map((e) => <Link key={e.ma_hs} href={`${HS}/${e.ma_hs}`} className={lienKet} translate="no">{e.ho_ten} ({e.so_vang})</Link>)}</span>} />
            );
          })}
        </>
      ) : rong("Không còn buổi nào chưa điểm danh trong 14 ngày qua."),
    },
    {
      id: "thu", nhan: "Học thử", so: sap.length + het.length,
      noiDung: sap.length || het.length ? (
        <>
          {nhomThu(het, (n) => `Hết thử – hỏi em · hết ${n ? ddmm(n) : ""}`, () => "đang không vào được lớp")}
          {nhomThu(sap, (n) => `Thử sắp hết · hết ${n ? thuNganNgay(n) : ""}`, (v) => `còn ${v.con_ngay} ngày`)}
          <p className="flex flex-wrap justify-end gap-x-6 px-[var(--kin-kc-6)]">
            {het.length ? <Link href={`${HS}?het=da-het`} className={lienKet}>Xem em đã hết thử ›</Link> : null}
            <Link href={`${HS}?het=3`} className={lienKet}>Xem em sắp hết thử ›</Link>
          </p>
        </>
      ) : rong("Không có em nào sắp hết hoặc đã hết thử."),
    },
    {
      id: "don", nhan: "Đơn", so: don.length,
      noiDung: don.length ? don.map((v) => (
        <KinListRow key={String(v.don_id)} href={`${LOP_GOC}/don?don=${v.don_id}#don-${v.don_id}`} title={<><span className="font-medium">Đơn chờ duyệt</span> · <span translate="no">{String(v.ho_ten)}</span></>} sub={v.ngay ? `Gửi ngày ${ddmm(v.ngay)}` : undefined} />
      )) : rong("Không có đơn nào chờ duyệt."),
    },
    {
      id: "record", nhan: "Thiếu record", so: dem(thieu),
      noiDung: thieu.length ? thieu.map((v) => (
        <KinListRow key={`thieu-${(v.mon as Mon)?.ma}`} title={<span className="font-medium">Buổi thiếu record · {(v.mon as Mon)?.ten}</span>}
          sub={<span className="tabular-nums">{(v.buoi as { id: number; ngay: string }[]).map((b) => thuNganNgay(b.ngay)).join(", ")}</span>} />
      )) : rong("Buổi nào đã điểm xong quá 24 giờ cũng đã có record."),
    },
    ...(sua.length ? [{
      id: "sua", nhan: "Sửa dữ liệu", so: sua.length,
      noiDung: sua.map((v) => (
        <KinListRow key={`sua-${v.ma_hs}`} href={`${HS}/${v.ma_hs}`} title={<span translate="no" className="font-medium">{String(v.ho_ten)}</span>}
          sub={`Thiếu hoặc sai: ${(v.loi as string[]).map((x) => ({ gmail: "Gmail", sdt: "SĐT", lua: "lứa", loi_tinh: "không tính được việc" })[x] ?? x).join(", ")}`} />
      )),
    }] : []),
  ];
  const mo = tabs.find((t) => t.id === tab) ?? tabs.find((t) => t.so > 0) ?? tabs[0];

  return (
    <KinPanel flush>
      <h2 id="viec" className={`${tieuDeKhoi} px-[var(--kin-kc-6)] pt-[var(--kin-kc-7)]`}>Việc cần làm</h2>
      <nav aria-label="Loại việc" className="mt-2 flex flex-wrap border-b border-[var(--kin-vien-nhat)] px-1">
        {tabs.map((t) => (
          <Link key={t.id} href={`${LOP_GOC}?viec=${t.id}`} scroll={false} aria-current={t.id === mo.id ? "page" : undefined} className={KIN_TAB_BOX}>
            <KinTabInner active={t.id === mo.id}>{t.nhan} <span className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-[var(--kin-nen-re-chuot)] px-1.5 text-[length:var(--kin-co-phu)] tabular-nums text-[var(--kin-chu-phu)]">{t.so}</span></KinTabInner>
          </Link>
        ))}
      </nav>
      <div>{mo.noiDung}</div>
      {daAn ? <p className="px-[var(--kin-kc-6)] py-3 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{daAn} việc đã đánh dấu xong đang ẩn.</p> : null}
    </KinPanel>
  );
}

function Lich7({ lich, hom }: { lich: Lich; hom: string }) {
  const buoi = lich.flatMap((x) => x.buoi);
  return (
    <KinPanel className="h-full">
      <h2 id="lich7" className={tieuDeKhoi}>7 ngày tới</h2>
      {buoi.length ? (
        <ul className="mt-2">
          {buoi.map((b) => (
            <li key={b.id} className="flex min-h-9 items-center justify-between gap-3 text-[length:var(--kin-co-goc)]">
              <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--kin-chu-chinh)]"><MonCham ma={b.mon?.ma} />{tenMonDayDu(b.mon?.ma, b.mon?.ten)}
                {b.trang_thai === "huy" ? <span className="font-normal text-[var(--kin-chu-mo)]">· Lớp nghỉ</span> : b.loai === "hoc_bu" ? <span className="font-normal text-[var(--kin-chu-mo)]">· học bù</span> : null}</span>
              <span className="shrink-0 tabular-nums text-[var(--kin-chu-phu)]">{b.ngay === hom ? "Tối nay" : thuNganNgay(b.ngay)} · {b.gio.slice(0, 5)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa có buổi học nào trong 7 ngày tới. Lịch hiện ra khi buổi học được tạo.</p>}
    </KinPanel>
  );
}
