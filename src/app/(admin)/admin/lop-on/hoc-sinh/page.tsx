// Lớp ôn · Học sinh (KiN lớp bước 4 + 6, Figma FyUkgGJHrhXo0u4gnREyfk 9:1044). Chỉ chủ lớp, sau cờ LOP_ON.
// Mọi bộ lọc nằm trên URL (?q=&mon=&loai=&lua=&het=&sap=&trang=), lọc ở máy chủ, 50 em một trang. Bước 6: ô chọn nhiều em + thanh "Gia hạn thử", nút "Thêm học sinh" (src/components/lop/ThaoTacHs.tsx).
import { KinSelect } from "@/components/kin/KinSelect";
import Link from "next/link";
import { KinPanel, KinEmptyState, KIN_FIELD, KIN_TABLE_HEAD, kinButtonClass } from "@/components/kin";
import { chuLop } from "@/lib/lop/server/cua";
import { danhSachHocSinh } from "@/lib/lop/server/hoc-sinh";
import { docLoc, hrefLoc, locHocSinh, TEN_HET, TEN_LOAI, type DongHs, type LocHs } from "@/lib/lop/loc-hoc-sinh";
import { ddmm } from "@/lib/lop/ngay";
import { ngayDayDu, sdt } from "@/lib/lop/dinh-dang";
import { KhoiLoi, LOP_GOC, MonHuyHieu, NhanTinhTrang, lienKet, thuTai } from "@/components/lop/hien-thi";
import { ChonNhieu, OChon, OChonTatCa, ThemHocSinh } from "@/components/lop/ThaoTacHs";

export const metadata = { title: "Lớp ôn · Học sinh" };
export const dynamic = "force-dynamic";

const GOC = `${LOP_GOC}/hoc-sinh`;
const COT = "md:grid md:grid-cols-[2.75rem_minmax(0,2.2fr)_7rem_minmax(0,1.3fr)_5rem_6.5rem_7.5rem] md:gap-4";

export default async function LopOnHocSinh({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const u = await chuLop();
  const p = docLoc(await searchParams);
  const d = await thuTai("danh sách học sinh", () => danhSachHocSinh(u));
  if (!d) return <div className="max-w-7xl"><TieuDe /><KhoiLoi ten="danh sách học sinh" href={hrefLoc(GOC, p, { trang: p.trang })} /></div>;

  const ds = d.hoc_sinh as unknown as (DongHs & { ma_hs: string; ho_ten: string })[];
  const r = locHocSinh(ds, p);
  const lua = [...new Set(ds.map((x) => x.lua?.ma).filter((x): x is string => !!x))].sort();
  const dangLoc = !!(p.q || p.mon || p.loai || p.lua || p.het);
  const sap = (k: LocHs["sap"], nhan: string) => (
    <Link href={hrefLoc(GOC, p, { sap: k })} aria-current={p.sap === k ? "true" : undefined} className={`inline-flex min-h-11 items-center hover:underline ${p.sap === k ? "font-medium text-[var(--kin-chu-chinh)]" : ""}`}>
      {nhan}<span aria-hidden className="ml-1">{p.sap === k ? "↑" : "↕"}</span><span className="sr-only">{p.sap === k ? " (đang sắp theo cột này)" : " (bấm để sắp)"}</span>
    </Link>
  );
  const chip = (k: keyof typeof TEN_HET) => (
    <Link key={k} href={hrefLoc(GOC, p, { het: p.het === k ? null : k })} aria-current={p.het === k ? "true" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[length:var(--kin-co-goc)] ${p.het === k ? "border-[var(--kin-nhan-link)] bg-[var(--kin-nhan-nen-nhat)] font-medium text-[var(--kin-nhan-chu-tren-nhat)]" : "border-[var(--kin-vien-thuong)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
      {TEN_HET[k]}
    </Link>
  );

  return (
    <div className="max-w-7xl">
      <TieuDe />
      <form action={GOC} method="get" role="search" className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-64"><span className="sr-only">Tìm học sinh</span>
          <input type="search" name="q" defaultValue={p.q} placeholder="Tìm theo tên, mã, SĐT, Gmail…" autoComplete="off" spellCheck={false} enterKeyHint="search" className={KIN_FIELD} /></label>
        <Chon ten="mon" nhan="Môn" giaTri={p.mon} luaChon={d.mon.map((m) => [m.ma, m.ten])} />
        <Chon ten="loai" nhan="Loại" giaTri={p.loai} luaChon={Object.entries(TEN_LOAI)} />
        <Chon ten="lua" nhan="Lứa" giaTri={p.lua} luaChon={lua.map((l) => [l, l])} />
        {p.het ? <input type="hidden" name="het" value={p.het} /> : null}
        {p.sap !== "ten" ? <input type="hidden" name="sap" value={p.sap} /> : null}
        <button type="submit" data-kin-nut className={kinButtonClass("primary")}>Lọc</button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chip("3")}{chip("da-het")}
        {dangLoc ? <Link href={GOC} className={`${lienKet} px-2`}>Bỏ lọc</Link> : null}
        <p className="ml-auto text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-phu)]" aria-live="polite">{r.tong} em{dangLoc ? ` · trong ${ds.length}` : ""}</p>
      </div>

      <ChonNhieu em={r.hien.map((x) => ({ ma_hs: x.ma_hs, ho_ten: x.ho_ten }))}>
      <KinPanel flush className="mt-4">
        {!ds.length ? (
          <KinEmptyState title="Chưa có học sinh">Danh sách có sau khi dữ liệu lớp được chuyển sang KiN.</KinEmptyState>
        ) : !r.tong ? (
          <KinEmptyState title="Không có em nào khớp" action={<Link href={GOC} className={kinButtonClass("secondary")}>Bỏ lọc</Link>}>
            {p.q ? `Không tìm thấy “${p.q}”` : "Không em nào khớp bộ lọc đang chọn"}. Thử bỏ bớt điều kiện lọc.
          </KinEmptyState>
        ) : (
          <>
            <div className={`hidden ${COT} ${KIN_TABLE_HEAD}`}>
              <OChonTatCa ma={r.hien.map((x) => x.ma_hs)} /><span>{sap("ten", "Học sinh")}</span><span>Môn</span><span>Trạng thái</span><span>{sap("het", "Hạn thử")}</span><span>{sap("moi", "Đăng ký")}</span><span>SĐT</span>
            </div>
            {/* Điện thoại không có hàng tiêu đề bảng: ô "chọn tất cả" nằm ở một dòng riêng. */}
            <div className="flex items-center gap-3 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] md:hidden"><OChonTatCa ma={r.hien.map((x) => x.ma_hs)} /><span aria-hidden>Chọn tất cả em trên trang này</span></div>
            <ul>
              {r.hien.map((x) => (
                <li key={x.ma_hs} className={`${COT} items-center border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-2 text-[length:var(--kin-co-goc)] last:border-b-0 hover:bg-[var(--kin-nen-re-chuot)] has-[:checked]:bg-[var(--kin-nhan-nen-nhat)] max-md:grid max-md:grid-cols-[2.75rem_minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1`}>
                  <span className="max-md:row-span-4 max-md:self-start"><OChon ma={x.ma_hs} ten={x.ho_ten} /></span>
                  <Link href={`${GOC}/${x.ma_hs}`} className="flex min-h-11 min-w-0 flex-col justify-center hover:underline max-md:col-span-2">
                    <span translate="no" className="font-medium text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{x.ho_ten}</span>
                    <span translate="no" className="text-[length:var(--kin-co-phu)] tabular-nums text-[var(--kin-chu-mo)]">{x.ma_hs}{x.lua?.ma ? ` · ${x.lua.ma}` : ""}</span>
                  </Link>
                  <MonHuyHieu mon={d.mon} o={x.mon} />
                  <span className="max-md:justify-self-end"><NhanTinhTrang tinhTrang={x.tinh_trang} thu={x.thu} /></span>
                  <span className={`tabular-nums text-[var(--kin-chu-phu)] ${x.thu ? "" : "max-md:invisible"}`}><span className="md:hidden text-[var(--kin-chu-mo)]">Hạn thử </span>{x.thu ? ddmm(x.thu.den) : "—"}</span>
                  <span className="tabular-nums text-[var(--kin-chu-phu)] max-md:justify-self-end"><span className="md:hidden text-[var(--kin-chu-mo)]">Đăng ký </span>{x.dang_ky ? ngayDayDu(x.dang_ky) : "—"}</span>
                  <span translate="no" className="tabular-nums text-[var(--kin-chu-phu)] max-md:col-span-2">{sdt(x.sdt_hs) || "—"}</span>
                </li>
              ))}
            </ul>
            <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-3">
              <p className="text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-phu)]">{r.tu}–{r.den} trong {r.tong}</p>
              <div className="flex gap-2">
                <Trang href={r.trang > 1 ? hrefLoc(GOC, p, { trang: r.trang - 1 }) : null}>Trước</Trang>
                <Trang href={r.trang < r.soTrang ? hrefLoc(GOC, p, { trang: r.trang + 1 }) : null}>Sau</Trang>
              </div>
            </nav>
          </>
        )}
      </KinPanel>
      </ChonNhieu>
    </div>
  );
}

function TieuDe() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
      <h1 className="text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Học sinh</h1>
      <ThemHocSinh />
    </div>
  );
}

function Chon({ ten, nhan, giaTri, luaChon }: { ten: string; nhan: string; giaTri: string | null; luaChon: (readonly [string, string])[] | [string, string][] }) {
  return (
    <label className="min-w-0 flex-1 basis-[calc(50%-0.375rem)] sm:flex-none sm:basis-auto">
      <span className="sr-only">{nhan}</span>
      <KinSelect name={ten} defaultValue={giaTri ?? ""} className="sm:w-auto sm:min-w-32">
        <option value="">{nhan}: tất cả</option>
        {luaChon.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </KinSelect>
    </label>
  );
}

/** Nút phân trang: hết trang thì là chữ mờ (không phải liên kết chết). */
function Trang({ href, children }: { href: string | null; children: string }) {
  return href
    ? <Link href={href} className={kinButtonClass("secondary")}>{children}</Link>
    : <span aria-disabled="true" className={`${kinButtonClass("secondary")} cursor-not-allowed opacity-45`}>{children}</span>;
}
