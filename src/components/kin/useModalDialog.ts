// SCL-D (P2-34) — hành vi hộp thoại thật cho ngăn kéo / tờ dưới tự dựng: Escape đóng, Tab xoay vòng trong hộp, khoá cuộn trang, tiêu điểm vào hộp khi mở
// và trả về chỗ cũ khi đóng. Cùng luật với KinConfirm (src/components/kin/Confirm.tsx); hộp gắn role="dialog" aria-modal="true" và trả `onKeyDown` từ đây.
"use client";
import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function useModalDialog(open: boolean, boxRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Ô đầu tiên có autoFocus thì để nó; còn lại đưa tiêu điểm vào hộp.
    const t = setTimeout(() => {
      const box = boxRef.current;
      if (box && !box.contains(document.activeElement)) (box.querySelector<HTMLElement>("[autofocus], input, textarea") ?? box).focus();
    }, 0);
    const onKey = (e: globalThis.KeyboardEvent) => {
      // Escape của hộp con (menu chọn, KinConfirm) đã tự dừng lan truyền; chỉ đóng khi không ai xử lý.
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("[data-kin-confirm]")) closeRef.current(); // hộp xác nhận chồng lên thì nó đóng trước
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open, boxRef]);

  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Tab") return;
    const els = Array.from(boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(el => el.offsetParent !== null);
    if (els.length === 0) { e.preventDefault(); return; }
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}
