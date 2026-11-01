// BU-06 — trang "Tìm gia sư" kiểu sàn (khách và học sinh thấy GIỐNG HỆT nhau: cùng API công khai, không cookie).
// Bộ lọc nằm trên URL (useSearchParams + router.replace, scroll:false) ⇒ chia sẻ được, F5/Back giữ nguyên.
// 1600px: ô tìm + cột lọc trái 264px + lưới 4 cột. 390px: ô tìm dính đầu trang, nút "Bộ lọc (n)" + Sắp xếp, tờ trượt, lưới 2 cột.
// Ba trạng thái: đang tải (khung chờ cùng dáng thẻ), lỗi (+ Thử lại, giữ bộ lọc), rỗng (nêu lọc nào đang bật + Xóa bộ lọc).
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KinButton } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStateCard } from "@/components/kin/StateCard";
import { BoLoc } from "./BoLoc";
import { ThanhTim } from "./ThanhTim";
import { ToBoLoc } from "./ToBoLoc";
import { LuoiCho, LuoiGiaSu } from "./LuoiGiaSu";
import { taiDanhSach } from "./goiApi";
import { BO_LOC_RONG, SORT_OPTIONS, demLoc, docBoLoc, ghiBoLoc, moTaLoc, type BoLocState, type SortValue } from "./locUrl";
import type { TutorFacets, TutorListItem } from "./kieu";

const SELECT = "min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";

export function TimGiaSu() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spKey = sp.toString();
  const filters = useMemo(() => docBoLoc(new URLSearchParams(spKey)), [spKey]);
  const queryKey = ghiBoLoc(filters);

  const [items, setItems] = useState<TutorListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [facets, setFacets] = useState<Partial<TutorFacets> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sheet, setSheet] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  const go = useCallback((next: BoLocState) => {
    const qs = ghiBoLoc(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  // Trang 1 của bộ lọc hiện tại. Đổi bộ lọc / Thử lại ⇒ huỷ lần gọi cũ.
  useEffect(() => {
    const ac = new AbortController();
    Promise.resolve().then(() => { if (!ac.signal.aborted) { setLoading(true); setError(false); } });
    taiDanhSach(docBoLoc(new URLSearchParams(queryKey)), 1, ac.signal)
      .then(d => { setItems(d.items); setTotal(d.total); setPage(1); setHasMore(d.hasMore); if (d.facets) setFacets(d.facets); setLoading(false); })
      .catch(() => { if (!ac.signal.aborted) { setError(true); setLoading(false); } });
    return () => ac.abort();
  }, [queryKey, retry]);

  async function more() {
    setLoadingMore(true);
    const ac = new AbortController();
    try {
      const d = await taiDanhSach(filters, page + 1, ac.signal);
      // Nối, bỏ id đã có (nếu dữ liệu đổi giữa hai lần gọi thì không hiện trùng).
      setItems(cur => { const seen = new Set(cur.map(x => x.id)); return [...cur, ...d.items.filter(x => !seen.has(x.id))]; });
      setPage(d.page); setHasMore(d.hasMore); setTotal(d.total);
    } catch { setError(true); }
    setLoadingMore(false);
  }

  const nFilters = demLoc(filters);
  const clearAll = () => go({ ...BO_LOC_RONG, sort: filters.sort });
  const describe = moTaLoc(filters);
  const closeSheet = () => { setSheet(false); setTimeout(() => openerRef.current?.focus(), 0); };

  const sortSelect = (
    <label className="flex items-center gap-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
      <span className="shrink-0">Sắp xếp</span>
      <select aria-label="Sắp xếp" className={SELECT} value={filters.sort} onChange={e => go({ ...filters, sort: e.target.value as SortValue })}>
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-6 sm:px-8 lg:gap-6 lg:px-14 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[length:var(--kin-co-h3)] font-semibold leading-tight text-[var(--kin-chu-chinh)] lg:text-[length:var(--kin-co-h2)]">Tìm gia sư</h1>
        <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Hồ sơ công khai do gia sư tự lựa chọn. Không cần tài khoản để xem. KiN không thu phí nhận lớp.</p>
      </header>

      <div className="sticky top-0 z-20 -mx-5 bg-[var(--kin-nen-trang)] px-5 py-2 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:max-w-[760px] lg:p-0">
        <ThanhTim initial={filters.q} onSubmitText={q => go({ ...filters, q })} onPickSubject={subject => go({ ...filters, q: "", subject })} />
      </div>

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button ref={openerRef} type="button" onClick={() => setSheet(true)} aria-haspopup="dialog"
          className="min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-4 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
          Bộ lọc ({nFilters})
        </button>
        {sortSelect}
      </div>

      <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
        <aside aria-label="Bộ lọc gia sư" className="hidden w-[264px] shrink-0 lg:block" data-loc-trai>
          <BoLoc value={filters} onChange={go} facets={facets} onClear={clearAll} idPrefix="trai" />
        </aside>

        <section aria-label="Kết quả" className="min-w-0 flex-1 w-full">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
              {loading ? "Đang tìm gia sư…" : error ? "" : `${total.toLocaleString("vi-VN")} gia sư phù hợp`}
            </p>
            <div className="hidden lg:block">{sortSelect}</div>
          </div>
          <p className="mb-4 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] lg:hidden">Giá, khu vực, bằng cấp do gia sư tự khai; KiN chưa xác minh.</p>

          {loading && items.length === 0 ? <LuoiCho />
            : error && items.length === 0 ? (
              <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được danh sách gia sư"
                actions={<KinButton onClick={() => setRetry(n => n + 1)}>Thử lại</KinButton>}>
                Không tải được danh sách gia sư. Thử lại sau. Bộ lọc của bạn vẫn được giữ.
              </KinStateCard>
            ) : items.length === 0 ? (
              <KinEmptyState title="Chưa có gia sư phù hợp"
                action={describe.length > 0 ? <KinButton variant="secondary" onClick={() => go({ ...BO_LOC_RONG, sort: filters.sort })}>Xóa bộ lọc</KinButton> : undefined}>
                {describe.length > 0
                  ? <>Đang lọc theo {describe.join(", ")}. Gia sư chưa khai khu vực hoặc giá sẽ không hiện khi đang lọc theo khu vực hoặc giá.</>
                  : <>Hiện chưa có gia sư nào được duyệt công khai. Bạn có thể xem các lớp đang mở ở trang khóa học.</>}
              </KinEmptyState>
            ) : (
              <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading || undefined}>
                <LuoiGiaSu items={items} />
                {error && <p role="alert" className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">Không tải thêm được. Thử lại sau.</p>}
                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <KinButton variant="secondary" loading={loadingMore} loadingLabel="Đang tải…" onClick={more}>Xem thêm gia sư</KinButton>
                  </div>
                )}
              </div>
            )}

          <p className="mt-8 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
            Chỉ số do hệ thống tổng hợp từ sổ lớp; khu vực, bằng cấp, giá do gia sư tự khai; KiN chưa xác minh. KiN không thu phí nhận lớp.
          </p>
        </section>
      </div>

      <ToBoLoc open={sheet} applied={filters} facets={facets} onClose={closeSheet} onApply={f => { go(f); closeSheet(); }} />
    </div>
  );
}
