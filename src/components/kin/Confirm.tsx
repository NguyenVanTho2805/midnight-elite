// Hộp xác nhận KiN (Figma "Hộp xác nhận" 106:51): rộng tối đa 420px, bo 14px, bóng nổi.
// Hai loại: "thuong" (nút xác nhận màu nhấn) và "nguy-hiem" (tiêu đề đỏ + nút xác nhận đỏ đặc, dùng cho việc không hoàn tác).
//
// Hành vi:
//   - Mở ra thì giữ tiêu điểm trong hộp (Tab xoay vòng), Escape = huỷ, bấm nền = huỷ, khoá cuộn trang, trả tiêu điểm về chỗ cũ khi đóng.
//   - Loại nguy hiểm: tiêu điểm đầu tiên rơi vào nút HUỶ (gõ Enter nhầm không xoá được gì). Loại thường: vào nút xác nhận.
//   - Đang xử lý (`loading`): khoá cả hai nút và Escape/bấm nền; nhãn nút xác nhận đổi thành `loadingLabel`, không có vòng xoay.
"use client";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { KinButton } from "./Button";

export interface KinConfirmProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "thuong" | "nguy-hiem";
  loading?: boolean;
  loadingLabel?: string;
  /** Khoá nút xác nhận (vd. chưa nhập lý do bắt buộc trong `message`). */
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function KinConfirm({
  open, title, message, confirmLabel = "Xác nhận", cancelLabel = "Huỷ", tone = "thuong",
  loading, loadingLabel = "Đang xử lý…", confirmDisabled, onConfirm, onCancel,
}: KinConfirmProps) {
  const uid = useId();
  const titleId = `${uid}-tieu-de`, descId = `${uid}-noi-dung`;
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRefLatest = useRef(onCancel);
  const loadingRef = useRef(loading);
  useEffect(() => { cancelRefLatest.current = onCancel; loadingRef.current = loading; });
  const danger = tone === "nguy-hiem";

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (danger ? cancelRef.current : confirmRef.current)?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape" && !loadingRef.current) cancelRefLatest.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open, danger]);

  if (!open) return null;

  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const els = Array.from(boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (els.length === 0) { e.preventDefault(); return; }
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[var(--kin-phu-hop)]"
      onClick={() => { if (!loading) onCancel(); }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        data-kin-confirm={tone}
        onClick={e => e.stopPropagation()}
        onKeyDown={trapTab}
        className="w-full max-w-[420px] overflow-hidden rounded-[var(--kin-bo-the)] bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-hop)]"
      >
        <div className="flex flex-col gap-2 pt-[22px] pb-[18px] px-6">
          <h2 id={titleId} className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-body)]"
            style={{ color: danger ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-chinh)" }}>{title}</h2>
          {message && <div id={descId} className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] whitespace-pre-line">{message}</div>}
        </div>
        <div className="flex justify-end gap-[10px] pt-[14px] pb-5 px-6">
          <KinButton ref={cancelRef} variant="secondary" disabled={loading} onClick={onCancel} className="min-w-[100px] font-semibold">{cancelLabel}</KinButton>
          <KinButton ref={confirmRef} variant={danger ? "danger-solid" : "primary"} loading={loading} loadingLabel={loadingLabel} disabled={confirmDisabled}
            onClick={() => void onConfirm()} className="min-w-[100px] font-semibold">{confirmLabel}</KinButton>
        </div>
      </div>
    </div>
  );
}
