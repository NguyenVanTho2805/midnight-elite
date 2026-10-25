// Mảnh giao diện dùng chung cho phần Tiếng Anh — chỉ dùng token --kin-* (không mã màu viết cứng).
"use client";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export const CARD: CSSProperties = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" };
export const INK = { chinh: "var(--kin-chu-chinh)", phu: "var(--kin-chu-phu)", mo: "var(--kin-chu-mo)" } as const;

/** fetch JSON cùng nguồn; lỗi HTTP → ném Error mang câu tiếng Việt từ máy chủ. */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin", cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Lỗi ${res.status}`);
  return data as T;
}

export function Card({ children, className = "", as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; "aria-labelledby"?: string }) {
  return <Tag className={`rounded-[var(--kin-bo-the)] p-4 ${className}`} style={CARD} {...rest}>{children}</Tag>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-h3 font-bold" style={{ color: INK.chinh }}>{title}</h1>
        {sub && <p className="text-caption mt-1" style={{ color: INK.phu }}>{sub}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </header>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-[var(--kin-bo-the)] p-3" style={CARD}>
      <dt className="text-xs" style={{ color: INK.phu }}>{label}</dt>
      <dd className="text-2xl font-bold mt-1" style={{ color: INK.chinh }}>{value}</dd>
      {sub && <p className="text-xs mt-0.5" style={{ color: INK.phu }}>{sub}</p>}
    </div>
  );
}

/** Thanh tiến độ — luôn có chữ đi kèm (màu không nói một mình). */
export function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: INK.phu }}><span>{label}</span><span>{Math.round(v)}%</span></div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--kin-vien-nhat)" }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: "var(--kin-nhan-nen)" }} />
      </div>
    </div>
  );
}

export function Pill({ children, tone = "mo" }: { children: ReactNode; tone?: "xong" | "cho" | "loi" | "mo" | "nhan" }) {
  const style: CSSProperties = tone === "nhan"
    ? { background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)" }
    : { background: "var(--kin-nen-trang)", color: tone === "mo" ? INK.mo : `var(--kin-tt-chu-${tone})`, border: "1px solid var(--kin-vien-thuong)" };
  return <span className="inline-flex items-center px-2 h-6 rounded-full text-xs font-medium whitespace-nowrap" style={style}>{children}</span>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const style: CSSProperties = variant === "primary"
    ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }
    : { background: "var(--kin-nen-trang)", color: INK.chinh, border: "1px solid var(--kin-vien-o-nhap)" };
  return <Link href={href} className="inline-flex items-center justify-center min-h-11 px-4 rounded-[var(--kin-bo-md)] text-sm font-medium whitespace-nowrap" style={style}>{children}</Link>;
}

export function ErrorLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p role="alert" className="rounded-[var(--kin-bo-md)] px-3 py-2 text-sm flex items-center justify-between gap-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-tt-chu-loi)" }}>
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="underline min-h-11 px-2" style={{ color: "var(--kin-nhan-link)" }}>Thử lại</button>}
    </p>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-hidden>{Array.from({ length: rows }, (_, i) => <div key={i} className="h-20 rounded-[var(--kin-bo-the)] animate-pulse" style={{ background: "var(--kin-vien-nhat)" }} />)}</div>;
}

export const LEVEL_TEXT: Record<"nhe" | "hoc" | "kho", { label: string; tone: "xong" | "cho" | "loi" }> = {
  nhe: { label: "Đọc nhẹ", tone: "xong" },
  hoc: { label: "Vừa sức để học", tone: "cho" },
  kho: { label: "Hơi khó", tone: "loi" },
};
