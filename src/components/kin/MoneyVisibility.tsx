// HV-07 — ẩn/hiện số tiền bằng biểu tượng mắt (Tổng quan, Học phí, Doanh thu của gia sư).
// Chỉ CHE HIỂN THỊ ở máy này: dữ liệu, phiếu và phép tính không đổi. Lựa chọn lưu trong localStorage của trình duyệt; mặc định là hiện.
// Dùng: <KinMoney>{vnd(n)}</KinMoney> cho từng số tiền; <KinMoneyEye /> một nút ở đầu trang (mọi nút trên cùng trang đổi theo nhau).
"use client";
import { useSyncExternalStore, type ReactNode } from "react";

export const MONEY_HIDDEN_KEY = "kin:an-so-tien";
const EVENT = "kin-money-visibility";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
function read(): boolean {
  try { return window.localStorage.getItem(MONEY_HIDDEN_KEY) === "1"; } catch { return false; }
}

/** true = đang ẩn số tiền. Lần dựng đầu trên máy chủ luôn là false (hiện), rồi khớp lại với lựa chọn đã lưu. */
export function useMoneyHidden(): [boolean, (hidden: boolean) => void] {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  const set = (next: boolean) => {
    try { if (next) window.localStorage.setItem(MONEY_HIDDEN_KEY, "1"); else window.localStorage.removeItem(MONEY_HIDDEN_KEY); } catch { /* không lưu được thì chỉ đổi trên trang này */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [hidden, set];
}

/** Bọc một số tiền: ẩn thì thay bằng dấu chấm, người đọc màn hình nghe "đã ẩn". */
export function KinMoney({ children, className }: { children: ReactNode; className?: string }) {
  const [hidden] = useMoneyHidden();
  if (!hidden) return <span className={className}>{children}</span>;
  return <span className={className} data-money-hidden><span aria-hidden>•••••</span><span className="sr-only">Số tiền đang ẩn</span></span>;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function KinMoneyEye({ className = "" }: { className?: string }) {
  const [hidden, setHidden] = useMoneyHidden();
  return (
    <button type="button" onClick={() => setHidden(!hidden)} aria-pressed={hidden} data-money-eye
      aria-label={hidden ? "Hiện số tiền" : "Ẩn số tiền"} title={hidden ? "Hiện số tiền" : "Ẩn số tiền"}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-lg text-[var(--kin-chu-phu)] hover:text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors ${className}`}>
      <EyeIcon off={hidden} />
    </button>
  );
}
