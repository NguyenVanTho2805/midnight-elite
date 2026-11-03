// Panel bên của Hàng chờ (BU-08 mục 5.3; phương án dự phòng D5 khi chưa có SidePanel của #98). KHÔNG phải hộp thoại:
//  • ≥1280px đứng cạnh bảng (trang chừa lề phải `QUEUE_PANEL_GUTTER`), nền sau không khoá; <768px là tấm toàn màn hình, chừa thanh module 60px.
//  • Esc / ✕ / Huỷ đóng và trả tiêu điểm về nút "Xem" của dòng; không role="dialog".
//  • Xác nhận nội dòng thay window.confirm: lý do bắt buộc, hoặc ô tick "Tôi hiểu…" (trừ Coin, đối chiếu sao kê, số điện thoại/đường dẫn).
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KinButton, KinStatus } from "@/components/kin";
import type { QueueAction, QueueItem } from "@/lib/adminQueue";
import { QueueCheck, kindLabel } from "./shared";

/** Lề phải trang khi panel mở (≥1280px) để bảng không bị đè. */
export const QUEUE_PANEL_GUTTER = "xl:pr-[436px]";

/** Việc cần một ô tick riêng trước khi cho gửi: do hợp đồng QueueAction.ack (trừ Coin, đã đối chiếu sao kê, không lộ số điện thoại/đường dẫn). */
export function tickLabel(a: QueueAction): string | null {
  return a.ack ?? null;
}

export function QueuePanel({ item, busy, error, onClose, onRun }: {
  item: QueueItem; busy: boolean; error: string | null; onClose: () => void; onRun: (a: QueueAction, reason: string) => void;
}) {
  const [pending, setPending] = useState<QueueAction["key"] | null>(null);
  const [reason, setReason] = useState("");
  const [tick, setTick] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);

  useEffect(() => { head.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const mine = pending ? item.detail.actions.find(a => a.key === pending) ?? null : null;
  const tick1 = mine ? tickLabel(mine) : null;

  const start = (a: QueueAction) => {
    if (!a.reason && !a.confirm && !tickLabel(a)) return onRun(a, "");
    setReason(""); setTick(false); setPending(a.key);
  };
  const ready = !!mine && (!mine.reason || reason.trim() !== "") && (!tick1 || tick);

  return (
    <aside data-side-panel aria-label={`Chi tiết: ${item.title}`}
      className="fixed inset-x-0 bottom-[60px] top-0 z-40 flex flex-col border-l border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-hop)] md:bottom-0 md:left-auto md:right-0 md:top-[var(--kin-top,0px)] md:w-[420px]">
      <div className="flex items-start gap-2 border-b border-[var(--kin-vien-thuong)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-wide text-[var(--kin-chu-mo)]">{kindLabel(item.kind)}</p>
          <h2 ref={head} tabIndex={-1} className="text-[length:var(--kin-co-body)] font-semibold leading-snug text-[var(--kin-chu-chinh)] outline-none">{item.detail.heading}</h2>
          <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{item.detail.meta}</p>
          <div className="mt-2"><KinStatus tone={item.status.tone}>{item.status.label}</KinStatus></div>
        </div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng panel" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-body)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]">✕</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]"><b className="font-semibold text-[var(--kin-chu-chinh)]">{item.who}</b>{` · ${item.place}`}</p>
        {item.detail.sections.map(s => (
          <section key={s.title} className="mb-4">
            <h3 className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-mo)]">{s.title}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-chinh)]">{s.text}</p>
          </section>
        ))}
        {item.detail.links.length > 0 && (
          <ul className="mb-2 flex flex-col">
            {item.detail.links.map(l => (
              <li key={l.href}><Link href={l.href} className="inline-flex min-h-11 items-center font-medium text-[var(--kin-nhan-link)] hover:underline">{l.label}</Link></li>
            ))}
          </ul>
        )}
        {item.detail.actions.filter(a => a.disabled).map(a => (
          <p key={a.key} data-disabled-why className="mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{`${a.label}: ${a.disabled}`}</p>
        ))}

        {mine && (
          <div role="group" aria-label={mine.label} data-confirm className="mt-2 flex flex-col gap-3 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-3">
            {mine.confirm && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{mine.confirm}</p>}
            {mine.reason && (
              <label className="flex flex-col gap-1">
                <span className="font-medium text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{mine.reason.label}</span>
                <textarea value={reason} rows={3} disabled={busy} onChange={e => setReason(e.target.value.slice(0, mine.reason!.max))}
                  className="w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" />
                <span className="self-end text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{`${reason.length}/${mine.reason.max}`}</span>
              </label>
            )}
            {tick1 && (
              <div className="flex items-start gap-1">
                <QueueCheck checked={tick} onChange={setTick} label={tick1} testId="tick" />
                <p className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{tick1}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <KinButton type="button" variant={mine.kind === "danger" ? "danger-solid" : "primary"} disabled={!ready} loading={busy} loadingLabel="Đang gửi…" onClick={() => onRun(mine, reason.trim())}>{`Xác nhận: ${mine.label}`}</KinButton>
              <KinButton type="button" variant="secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</KinButton>
            </div>
          </div>
        )}
        {error && <p role="status" data-loi className="mt-3 font-semibold text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>}
      </div>

      <div data-panel-foot className="flex flex-wrap items-center gap-2 border-t border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-4 py-3">
        {!mine && item.detail.actions.slice(0, 2).map(a => (
          <KinButton key={a.key} type="button" variant={a.kind === "danger" ? "danger" : a.kind === "primary" ? "primary" : "secondary"} disabled={busy || !!a.disabled} onClick={() => start(a)}>{a.label}</KinButton>
        ))}
        <KinButton type="button" variant="ghost" disabled={busy} onClick={onClose} className="ml-auto">Huỷ</KinButton>
      </div>
    </aside>
  );
}
