// Thanh công cụ của Hàng chờ: "Chọn tất cả" đứng ĐẦU, rồi chip lọc theo loại (có số đếm), dải "Đang lọc" khi đang áp, thanh ngữ cảnh khi có dòng được chọn.
"use client";
import Link from "next/link";
import { KinButton } from "@/components/kin";
import type { BulkCommand, BulkState } from "./useBulk";
import { QueueCheck, KIND_ORDER, kindLabel } from "./shared";

export const QUEUE_PATH = "/admin/kiem-duyet";

export function QueueToolbar({ counts, active, selectedCount, visibleCount, onToggleAll }: {
  counts: Record<string, number>; active: string | null; selectedCount: number; visibleCount: number; onToggleAll: (on: boolean) => void;
}) {
  const kinds = [...KIND_ORDER.filter(k => k in counts), ...Object.keys(counts).filter(k => !(KIND_ORDER as readonly string[]).includes(k))];
  const total = kinds.reduce((s, k) => s + (counts[k] ?? 0), 0);
  const chip = (on: boolean) => `inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-[length:var(--kin-co-goc)] font-medium ${on
    ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nhan-nen-nhat)] text-[var(--kin-nhan-link)]"
    : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div data-select-all className="flex flex-shrink-0 items-center">
          <QueueCheck label="Chọn tất cả các dòng đang hiện" testId="all" checked={visibleCount > 0 && selectedCount === visibleCount} mixed={selectedCount > 0 && selectedCount < visibleCount} onChange={onToggleAll} />
          <span className="hidden pr-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] sm:inline">Chọn tất cả</span>
        </div>
        <nav aria-label="Lọc theo loại" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          <Link href={QUEUE_PATH} data-chip="tat-ca" aria-current={active ? undefined : "page"} className={chip(!active)}>{`Tất cả ${total}`}</Link>
          {kinds.map(k => (
            <Link key={k} href={`${QUEUE_PATH}?loai=${k}`} data-chip={k} aria-current={active === k ? "page" : undefined} className={chip(active === k)}>{`${kindLabel(k)} ${counts[k]}`}</Link>
          ))}
        </nav>
      </div>
      {active && (
        <p data-dang-loc className="flex flex-wrap items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
          <span>Đang lọc: <b className="font-semibold text-[var(--kin-chu-chinh)]">{kindLabel(active)}</b></span>
          <Link href={QUEUE_PATH} aria-label={`Bỏ lọc ${kindLabel(active)}`} className="inline-flex min-h-11 items-center px-2 font-medium text-[var(--kin-nhan-link)] hover:underline">✕ Xoá lọc</Link>
        </p>
      )}
    </div>
  );
}

/** Thanh ngữ cảnh: trượt lên khi có dòng chọn; điện thoại dính đáy vùng nội dung (trên thanh module 60px của vỏ). */
export function BulkBar({ count, commands, reason, state, message, onStart, onUndo, onClear }: {
  count: number; commands: BulkCommand[]; reason: string | null; state: BulkState; message: string | null;
  onStart: (c: BulkCommand) => void; onUndo: () => void; onClear: () => void;
}) {
  if (count === 0 && state.phase === "idle" && !message) return null;
  const n = state.phase === "idle" ? count : state.ids.length;
  return (
    <div data-bulk-bar className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2 shadow-[var(--kin-bong-hop)] md:static md:shadow-none">
      {state.phase === "undo" ? (
        <>
          <p role="status" className="flex-1 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{`Đang ${state.cmd.label.toLowerCase()} ${n} dòng… sẽ gửi sau ${state.left} giây`}</p>
          <KinButton variant="secondary" data-bulk-undo onClick={onUndo}>Hoàn tác</KinButton>
        </>
      ) : state.phase === "run" ? (
        <p role="status" className="flex-1 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{`Đang gửi ${n} dòng, chưa đóng trang…`}</p>
      ) : (
        <>
          {count > 0 && <p data-bulk-count className="text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-chu-chinh)]">{`Đã chọn ${count}`}</p>}
          {count > 0 && commands.map(c => (
            <KinButton key={c.key} data-bulk-cmd={c.key} variant={c.kind === "danger" ? "danger" : c.kind === "primary" ? "primary" : "secondary"} onClick={() => onStart(c)}>{c.label}</KinButton>
          ))}
          {count > 0 && reason && <p data-bulk-reason className="flex-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{reason}</p>}
          {message && count === 0 && <p role="status" data-bulk-msg className="flex-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{message}</p>}
          {message && count > 0 && <p role="status" data-bulk-msg className="basis-full text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{message}</p>}
          {count > 0 && <KinButton variant="ghost" data-bulk-clear onClick={onClear} className="ml-auto">Bỏ chọn</KinButton>}
        </>
      )}
    </div>
  );
}
