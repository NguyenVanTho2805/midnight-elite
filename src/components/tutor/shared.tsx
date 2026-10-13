// Phần dùng chung cho các màn học phí/đối soát của gia sư (TT-200).
// Token KiN (--kin-*): màu trạng thái luôn đi kèm CHỮ, không chỉ chấm màu.
"use client";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useToast } from "@/components/ui";
import { KinStatus, type StatusTone } from "@/components/kin/Status";

// useToast() trả object MỚI mỗi lần render → đưa thẳng vào deps của useEffect/
// useCallback sẽ làm effect chạy lại mỗi khi toast hiện (vòng lặp tải lại khi
// lỗi). Bản này có danh tính ổn định.
export function useNotify() {
  const t = useToast();
  const ref = useRef(t);
  useEffect(() => { ref.current = t; });
  return useMemo(() => ({
    ok:  (m: string) => ref.current.ok(m),
    err: (m: string) => ref.current.err(m),
    info: (m: string) => ref.current.info(m),
  }), []);
}

export const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

export const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `Tháng ${Number(m)}/${y}`; };

// fetch JSON có xử lý lỗi mạng; không ném.
export async function callApi<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const r = await fetch(url, { credentials: "same-origin", ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) } });
    const data = await r.json().catch(() => ({})) as T & { error?: string };
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Lỗi kết nối, thử lại sau" } as T & { error?: string } };
  }
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* rơi xuống cách cũ */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

type Tone = "ok" | "wait" | "bad" | "neutral";
const TONE_OF: Record<Tone, StatusTone> = { ok: "xong", wait: "cho", bad: "loi", neutral: "mo" };
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <KinStatus tone={TONE_OF[tone]}>{children}</KinStatus>;
}
export const invoiceTone = (status: string): Tone =>
  status === "paid" ? "ok" : status === "cancelled" ? "neutral" : status === "draft" ? "neutral" : status === "parent_reported" || status === "partial" ? "wait" : "wait";

export function Modal({ title, onClose, children, labelledBy = "modal-title" }: { title: string; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, []);
  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(15,23,42,0.5)" }}
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div ref={boxRef} onClick={stop} className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
        style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <h2 id={labelledBy} className="text-base font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const FIELD_STYLE = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-o-nhap)", color: "var(--kin-chu-chinh)" } as const;
export const CARD_STYLE = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;
