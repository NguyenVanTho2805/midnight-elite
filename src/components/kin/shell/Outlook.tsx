// Mảnh ghép của bố cục Outlook (bo-cuc-outlook.md; Figma "Khung danh sách" 11:144, "Khung đọc" 11:176).
// Máy tính: danh sách 330px cạnh khung đọc, MỖI KHUNG CUỘN RIÊNG. Điện thoại: chồng lên nhau, chọn một dòng thì hiện khung đọc,
// có nút ← ở đầu để quay lại. Không dùng vòng xoay khi tải: dùng khung xương đúng chiều cao dòng thật.
"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { KinButton, kinButtonClass, type KinButtonVariant } from "@/components/kin/Button";
import { KinStatus, STATUS_DOT, type StatusTone } from "@/components/kin/Status";

export type Tone = StatusTone;

export function OutlookPanes({ list, read, open }: { list: ReactNode; read: ReactNode; open: boolean }) {
  return (
    <div className="md:grid md:grid-cols-[330px_minmax(0,1fr)] md:h-[calc(100vh-var(--kin-top,0px))] bg-[var(--kin-nen-trang)]">
      <section aria-label="Danh sách" className={`${open ? "hidden" : "flex"} md:flex flex-col min-w-0 md:h-[calc(100vh-var(--kin-top,0px))] md:border-r border-[var(--kin-vien-thuong)]`}>{list}</section>
      <section aria-label="Chi tiết" className={`${open ? "flex" : "hidden"} md:flex flex-col min-w-0 md:h-[calc(100vh-var(--kin-top,0px))]`}>{read}</section>
    </div>
  );
}

/** `aside`: một mảnh nhỏ ở bên phải tiêu đề (vd. vòng tiến độ). `subtitle` nhận cả ReactNode (vd. dòng chữ đổi bằng trượt). */
export function ListHead({ title, subtitle, aside, children }: { title: string; subtitle?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <div className="px-[14px] pt-3 pb-[10px] border-b border-[var(--kin-vien-thuong)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-body)] tracking-[-0.01em] text-[var(--kin-chu-chinh)]">{title}</h2>
          {subtitle && <div className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)] mt-[2px]">{subtitle}</div>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Khung chứa các dòng: cuộn riêng, role=listbox. */
export function ListBody({ children, label, onKeyDown }: { children: ReactNode; label: string; onKeyDown?: (e: React.KeyboardEvent) => void }) {
  return <div role="listbox" aria-label={label} onKeyDown={onKeyDown} className="flex-1 min-h-0 overflow-y-auto">{children}</div>;
}

/** `strike`: việc đã xong — "draw" = vừa xong (nét gạch quét từ trái), "static" = xong từ trước. `bloom`: thứ tự dòng khi vừa hiện ra (độ trễ nở vào, Lucian No.079). */
export function ListRow({ selected, onSelect, title, when, subtitle, status, strong, id, strike, bloom }: {
  selected: boolean; onSelect: () => void; title: string; when: string; subtitle: string; status?: { label: string; tone: Tone }; strong?: boolean; id?: string;
  strike?: "draw" | "static"; bloom?: number;
}) {
  const muted = selected ? "var(--kin-chu-mo-tren-nen-nhan)" : "var(--kin-chu-mo)";
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={`${bloom !== undefined ? "kin-bloom " : ""}flex flex-col gap-1 min-h-[50px] px-[14px] py-3 cursor-pointer border-b border-[var(--kin-vien-nhat)] hover:bg-[var(--kin-nen-bang)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)] transition-colors`}
      style={{ ...(selected ? { background: "var(--kin-nen-dang-chon)", borderLeft: "3px solid var(--kin-th-navy)", paddingLeft: 11 } : null), ...(bloom !== undefined ? { "--d": `${Math.min(bloom, 8) * 45}ms` } : null) } as React.CSSProperties}
    >
      <div className="flex items-baseline gap-2">
        <p className={`flex-1 min-w-0 truncate text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)] ${strong ? "font-semibold" : "font-medium"}`}><span data-strike={strike} className="kin-strike kin-m">{title}</span></p>
        <span className="flex-shrink-0 text-[length:var(--kin-co-caption)] font-mono" style={{ color: muted }}>{when}</span>
      </div>
      <p className="truncate text-[length:var(--kin-co-small)]" style={{ color: muted }}>{subtitle}</p>
      {status && <KinStatus tone={status.tone}>{status.label}</KinStatus>}
    </div>
  );
}

/** Khung xương ba dòng đúng chiều cao dòng thật. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="kin-m flex flex-col gap-2 min-h-[50px] px-[14px] py-3 border-b border-[var(--kin-vien-nhat)]">
          <div className="h-[13px] w-3/4 rounded kin-skel kin-skel--lo" />
          <div className="h-[13px] w-1/2 rounded kin-skel kin-skel--lo" />
          <div className="h-[11px] w-1/4 rounded kin-skel kin-skel--lo" />
        </div>
      ))}
    </div>
  );
}

/** Dải báo lỗi tải: giữ nguyên danh sách cũ ở dưới, kèm nút thử lại. */
export function ErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-2 px-[14px] py-2 text-[length:var(--kin-co-small)] border-b border-[var(--kin-tt-chu-loi)] bg-[var(--kin-nhan-nen-nhat)]">
      <span aria-hidden className="inline-block w-[7px] h-[7px] rounded-full" style={{ background: STATUS_DOT.loi }} />
      <span className="flex-1 text-[var(--kin-tt-chu-loi)] font-semibold">{message}</span>
      <button type="button" onClick={onRetry} className="min-h-11 px-3 font-semibold text-[var(--kin-nhan-link)] hover:underline">Thử lại</button>
    </div>
  );
}

export interface Command { label: string; href?: string; onClick?: () => void; kind: "primary" | "secondary" | "danger"; external?: boolean; disabled?: boolean }

// Nút lệnh trong khung đọc dùng cùng dáng với KinButton (Figma "Nút" 6:50): "danger" là kiểu Nguy hiểm.
const COMMAND_VARIANT: Record<Command["kind"], KinButtonVariant> = { primary: "primary", secondary: "secondary", danger: "danger" };

export function ReadHead({ title, meta, commands, onBack }: { title: string; meta?: string; commands?: Command[]; onBack?: () => void }) {
  return (
    <div className="px-5 pt-4 pb-3 border-b border-[var(--kin-vien-thuong)]">
      {onBack && (
        <button type="button" onClick={onBack} className="md:hidden -ml-2 mb-1 min-h-11 px-2 inline-flex items-center gap-1 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)]">
          <span aria-hidden>←</span> Quay lại
        </button>
      )}
      <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] tracking-[-0.015em] leading-[1.3] text-[var(--kin-chu-chinh)] text-balance">{title}</h1>
      {meta && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)] mt-[3px]">{meta}</p>}
      {commands && commands.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-3">
          {commands.slice(0, 3).map(c => {
            const variant = COMMAND_VARIANT[c.kind];
            if (c.onClick) return <KinButton key={c.label} type="button" variant={variant} onClick={c.onClick} disabled={c.disabled}>{c.label}</KinButton>;
            const cls = kinButtonClass(variant);
            return c.external || !c.href?.startsWith("/")
              ? <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className={cls}>{c.label}</a>
              : <Link key={c.label} href={c.href} className={cls}>{c.label}</Link>;
          })}
        </div>
      )}
    </div>
  );
}

export function ReadBody({ children }: { children: ReactNode }) {
  return <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6 pb-8 flex flex-col gap-3 text-[length:var(--kin-co-small)]">{children}</div>;
}

export function ReadSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <p className="font-medium text-[var(--kin-chu-chinh)]">{title}</p>
      <p className="text-[var(--kin-chu-mo)] whitespace-pre-line">{text}</p>
    </div>
  );
}

/** Khung đọc khi chưa chọn mục nào / danh sách rỗng. */
export function ReadEmpty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 px-6 text-center">
      <p className="font-medium text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]">{title}</p>
      {text && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)] max-w-[34ch]">{text}</p>}
    </div>
  );
}
