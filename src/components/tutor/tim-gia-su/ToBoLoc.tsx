// BU-06 — tờ trượt bộ lọc trên điện thoại (390px). role=dialog aria-modal, khoá cuộn nền, Esc / vuốt xuống / nút Đóng đóng lại,
// tiêu điểm vào hộp khi mở và trả về nút mở khi đóng. Sửa trên BẢN NHÁP; "Xem N gia sư" mới áp vào URL. N lấy từ một lần gọi pageSize=1.
"use client";
import { useEffect, useRef, useState } from "react";
import { BoLoc } from "./BoLoc";
import { BO_LOC_RONG, type BoLocState } from "./locUrl";
import { taiDanhSach } from "./goiApi";
import type { TutorFacets } from "./kieu";

export function ToBoLoc({ open, applied, facets, onApply, onClose }: {
  open: boolean;
  applied: BoLocState;
  facets: Partial<TutorFacets> | null;
  onApply: (f: BoLocState) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BoLocState>(applied);
  const [count, setCount] = useState<number | null>(null);
  const [draftFacets, setDraftFacets] = useState<Partial<TutorFacets> | null>(facets);
  const boxRef = useRef<HTMLDivElement>(null);
  const touchY = useRef<number | null>(null);

  // Mở: lấy lại bản nháp từ bộ lọc đang áp, khoá cuộn nền, đưa tiêu điểm vào hộp.
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => { setDraft(applied); setDraftFacets(facets); setCount(null); });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Đổi bản nháp ⇒ hỏi lại tổng (và facet) sau 250ms.
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      taiDanhSach(draft, 1, ac.signal, 1).then(d => { setCount(d.total); if (d.facets) setDraftFacets(d.facets); }).catch(() => { /* nút vẫn bấm được, chỉ thiếu số */ });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [draft, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden className="absolute inset-0 opacity-40" style={{ background: "var(--kin-chu-chinh)" }} onClick={onClose} />
      <div
        ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Bộ lọc gia sư" data-to-bo-loc
        onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[var(--kin-bo-xl)] bg-[var(--kin-nen-trang)] outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--kin-vien-nhat)] px-4"
          onTouchStart={e => { touchY.current = e.touches[0]?.clientY ?? null; }}
          onTouchEnd={e => { const y0 = touchY.current; touchY.current = null; if (y0 !== null && (e.changedTouches[0]?.clientY ?? y0) - y0 > 80) onClose(); }}>
          <h2 className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Bộ lọc</h2>
          <button type="button" onClick={onClose} className="min-h-[var(--kin-cham-toi-thieu)] min-w-[var(--kin-cham-toi-thieu)] px-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">Đóng</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <BoLoc value={draft} onChange={setDraft} facets={draftFacets} idPrefix="to" />
        </div>
        <div className="flex gap-3 border-t border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] px-4 py-3">
          <button type="button" onClick={() => setDraft({ ...BO_LOC_RONG, q: draft.q, sort: draft.sort })}
            className="min-h-[var(--kin-cham-toi-thieu)] flex-1 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
            Xóa lọc
          </button>
          <button type="button" onClick={() => onApply(draft)}
            className="min-h-[var(--kin-cham-toi-thieu)] flex-1 rounded-[var(--kin-bo-md)] border border-transparent bg-[var(--kin-nhan-nen)] text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-chu-tren-nen)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
            {count === null ? "Xem gia sư" : `Xem ${count.toLocaleString("vi-VN")} gia sư`}
          </button>
        </div>
      </div>
    </div>
  );
}
