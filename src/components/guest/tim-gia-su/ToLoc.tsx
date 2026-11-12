// LOI-05 mục 4.1 — tờ trượt bộ lọc trên điện thoại (< md). role=dialog aria-modal; Esc / nút Đóng / bấm nền mờ đều đóng;
// khoá cuộn nền khi mở; tiêu điểm vào hộp khi mở, Tab vòng trong hộp, và (bên gọi) trả tiêu điểm về nút "Lọc (n)" khi đóng.
// Sửa trên BẢN NHÁP: chỉ "Xem kết quả" mới ghi vào URL. "Xóa lọc" đưa bản nháp về rỗng (giữ chữ đang tìm).
"use client";
import { useEffect, useId, useRef, useState } from "react";
import { KinButton } from "@/components/kin/Button";
import { SAN_LOC_RONG, type SanLoc } from "@/lib/tutorFloorFilter";
import type { TutorFacets } from "@/components/tutor/tim-gia-su/kieu";
import { BoChonLoc } from "./BoChonLoc";

const FOCUSABLE = 'a[href],button:not([disabled]),select,input,textarea,[tabindex]:not([tabindex="-1"])';

/** Chỉ gắn vào cây khi đang mở (bên gọi: `{mo && <ToLoc … />}`): bản nháp lấy từ bộ lọc đang áp lúc mở. */
export function ToLoc({ applied, facets, onApply, onClose }: {
  applied: SanLoc;
  facets: Partial<TutorFacets> | null;
  onApply: (f: SanLoc) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<SanLoc>(applied);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // Mở: khoá cuộn nền, đưa tiêu điểm vào hộp; Esc đóng, Tab vòng trong hộp.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab" || !boxRef.current) return;
      const list = Array.from(boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (list.length === 0) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div aria-hidden className="absolute inset-0 opacity-40" style={{ background: "var(--kin-chu-chinh)" }} onClick={onClose} />
      <div ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} data-to-loc
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[var(--kin-bo-xl)] bg-[var(--kin-nen-trang)] outline-none">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--kin-vien-nhat)] py-1 pl-4 pr-2">
          <h2 id={titleId} className="m-0 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Lọc gia sư</h2>
          <KinButton type="button" variant="ghost" onClick={onClose}>Đóng</KinButton>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <BoChonLoc kieu="to" value={draft} onChange={setDraft} facets={facets} />
        </div>
        <div className="flex gap-3 border-t border-[var(--kin-vien-nhat)] px-4 py-3">
          <KinButton type="button" variant="secondary" className="flex-1" onClick={() => setDraft({ ...SAN_LOC_RONG, q: draft.q })}>Xóa lọc</KinButton>
          <KinButton type="button" className="flex-1" onClick={() => onApply(draft)}>Xem kết quả</KinButton>
        </div>
      </div>
    </div>
  );
}
