// LOI-05 mục 4.1 — phần tương tác của /giang-vien (client, trang bọc Suspense vì dùng useSearchParams). Khách và học sinh thấy giống hệt (API công khai).
// Bộ lọc tối giản nằm trên URL (router.replace, scroll:false) ⇒ chia sẻ được, F5/Back giữ nguyên; tham số cũ (grade, district, price…) bị bỏ qua khi đọc.
// ≥ md: một hàng lọc ngang (ô tìm giãn · Môn · Khu vực · Hình thức · "Xóa lọc" khi có lọc). < md: ô tìm + nút "Lọc (n)" mở tờ trượt.
// Ba trạng thái: đang tải (6 khung chờ cùng dáng thẻ), lỗi (+ Thử lại, giữ bộ lọc), rỗng (có lọc: nêu lọc + Xóa lọc; không lọc: lối sang lớp đang mở).
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KinButton } from "@/components/kin/Button";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStateCard } from "@/components/kin/StateCard";
import { SAN_LOC_RONG, demSanLoc, docSanLoc, ghiSanLoc, moTaSanLoc, type SanLoc } from "@/lib/tutorFloorFilter";
import type { TutorFacets, TutorListItem } from "@/components/tutor/tim-gia-su/kieu";
import { BoChonLoc } from "./BoChonLoc";
import { LuoiCho, LuoiGiaSu } from "./LuoiGiaSu";
import { OTim } from "./OTim";
import { ToLoc } from "./ToLoc";
import { taiTrang } from "./goiDanhSach";

export function SanGiaSu() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spKey = sp.toString();
  const f = useMemo(() => docSanLoc(new URLSearchParams(spKey)), [spKey]);
  const key = ghiSanLoc(f);

  const [items, setItems] = useState<TutorListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [facets, setFacets] = useState<Partial<TutorFacets> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sheet, setSheet] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  const go = useCallback((next: SanLoc) => {
    const qs = ghiSanLoc(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);
  // Ô tìm áp chữ sau 400 ms: đọc bộ lọc HIỆN TẠI trên URL lúc áp (không dùng bản cũ đã đóng trong hàm).
  const applyQ = useCallback((q: string) => go({ ...docSanLoc(new URLSearchParams(window.location.search)), q }), [go]);

  // Trang 1 của bộ lọc hiện tại. Đổi bộ lọc / Thử lại ⇒ huỷ lần gọi cũ.
  useEffect(() => {
    const ac = new AbortController();
    Promise.resolve().then(() => { if (!ac.signal.aborted) { setLoading(true); setError(false); setMoreError(false); } });
    taiTrang(docSanLoc(new URLSearchParams(key)), 1, ac.signal)
      .then(d => { setItems(d.items); setTotal(d.total); setPage(1); setHasMore(d.hasMore); if (d.facets) setFacets(d.facets); setLoading(false); })
      .catch(() => { if (!ac.signal.aborted) { setError(true); setLoading(false); } });
    return () => ac.abort();
  }, [key, retry]);

  async function more() {
    setLoadingMore(true); setMoreError(false);
    try {
      const d = await taiTrang(f, page + 1);
      // Nối, bỏ id đã có (dữ liệu đổi giữa hai lần gọi thì không hiện trùng).
      setItems(cur => { const seen = new Set(cur.map(x => x.id)); return [...cur, ...d.items.filter(x => !seen.has(x.id))]; });
      setPage(d.page); setHasMore(d.hasMore); setTotal(d.total);
    } catch { setMoreError(true); }
    setLoadingMore(false);
  }

  const nLoc = demSanLoc(f);
  const coLoc = nLoc > 0 || f.q.trim() !== "";
  const xoaLoc = () => go(SAN_LOC_RONG);
  const closeSheet = () => { setSheet(false); setTimeout(() => openerRef.current?.focus(), 0); };

  let body;
  if (loading && items.length === 0) body = <LuoiCho />;
  else if (error && items.length === 0) {
    body = (
      <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được danh sách gia sư"
        actions={<KinButton onClick={() => setRetry(n => n + 1)}>Thử lại</KinButton>}>
        Kết nối bị gián đoạn. Bấm Thử lại; bộ lọc của bạn vẫn được giữ.
      </KinStateCard>
    );
  } else if (items.length === 0) {
    body = coLoc ? (
      <KinEmptyState title="Không có gia sư khớp bộ lọc" action={<KinButton variant="secondary" onClick={xoaLoc}>Xóa lọc</KinButton>}>
        Đang lọc theo {moTaSanLoc(f).join(", ")}. Gia sư chưa khai khu vực hoặc hình thức sẽ không hiện khi lọc theo mục đó.
      </KinEmptyState>
    ) : (
      <KinEmptyState title="Chưa có gia sư nào mở hồ sơ công khai." action={<Link href="/khoa-hoc" className={kinButtonClass("secondary")}>Xem lớp đang mở</Link>}>
        Khi gia sư mở hồ sơ công khai, hồ sơ sẽ hiện ở đây.
      </KinEmptyState>
    );
  } else {
    body = (
      <div aria-busy={loading || undefined} className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <LuoiGiaSu items={items} />
        {moreError && <p role="alert" className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">Chưa tải thêm được. Bấm Xem thêm để thử lại.</p>}
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <KinButton variant="secondary" loading={loadingMore} loadingLabel="Đang tải…" onClick={more}>Xem thêm gia sư</KinButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-san-gia-su-client className="flex flex-col gap-4">
      {/* Một hàng: ô tìm giãn; ≥ md thêm Môn · Khu vực · Hình thức · Xóa lọc (xuống dòng ở 768–1023); < md thêm nút Lọc (n). */}
      <div data-hang-loc className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-[200px] md:basis-[280px]">
          <OTim value={f.q} onApply={applyQ} />
        </div>
        <button ref={openerRef} type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet}
          className={`${kinButtonClass("secondary")} shrink-0 md:hidden`}>
          Lọc ({nLoc})
        </button>
        <div className="hidden min-w-0 flex-wrap items-end gap-3 md:flex">
          <BoChonLoc kieu="hang" value={f} onChange={go} facets={facets} />
          {coLoc && <KinButton type="button" variant="ghost" onClick={xoaLoc}>Xóa lọc</KinButton>}
        </div>
      </div>

      <p role="status" className="m-0 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
        {loading ? "Đang tải…" : error && items.length === 0 ? "" : `${total.toLocaleString("vi-VN")} gia sư`}
      </p>

      {body}

      {sheet && <ToLoc applied={f} facets={facets} onClose={closeSheet} onApply={next => { go(next); closeSheet(); }} />}
    </div>
  );
}
