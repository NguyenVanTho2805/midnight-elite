// Bảng hàng chờ (từ 768px) và danh sách thẻ (điện thoại). Cột đầu = định danh ("Việc"); ô tick nằm TRONG ô này, bên trái chữ.
// Mỗi hàng tối đa 2 nút: "Xem" + (nếu có) một lệnh nhanh. Mọi lệnh cần lý do/xác nhận chỉ nằm trong panel.
"use client";
import { KinButton, KinStatus } from "@/components/kin";
import type { QueueItem } from "@/lib/adminQueue";
import { waitedText } from "@/lib/adminQueue";
import { QueueCheck, kindLabel, quickAction } from "./shared";

interface RowProps {
  items: QueueItem[]; selected: Set<string>; openId: string | null; busyId: string | null; now: number;
  onToggle: (id: string, on: boolean) => void; onOpen: (id: string) => void; onQuick: (item: QueueItem) => void;
}

const waited = (item: QueueItem, now: number) => waitedText(new Date(item.at), new Date(now));

function Actions({ item, busyId, onOpen, onQuick }: { item: QueueItem; busyId: string | null; onOpen: (id: string) => void; onQuick: (i: QueueItem) => void }) {
  const q = quickAction(item);
  return (
    <div className="flex items-center gap-2">
      <KinButton variant="secondary" data-row-open={item.id} onClick={() => onOpen(item.id)} aria-label={`Xem: ${item.title}`}>Xem</KinButton>
      {q && <KinButton variant="primary" data-row-quick={q.key} loading={busyId === item.id} loadingLabel="Đang gửi…" onClick={() => onQuick(item)}>{q.label}</KinButton>}
    </div>
  );
}

/** Mũi tên lên/xuống, Home/End dời giữa các nút "Xem" của các hàng. */
function rowKeys(e: React.KeyboardEvent) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const el = e.target as HTMLElement;
  if (!el.matches("[data-row-open]")) return;
  const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-row-open]"));
  const at = all.indexOf(el); if (at < 0) return;
  e.preventDefault();
  const to = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : Math.min(all.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
  all[to].focus();
}

export function QueueTable({ items, selected, openId, busyId, now, onToggle, onOpen, onQuick }: RowProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)]">
      <table data-queue-table className="w-full border-collapse text-left text-[length:var(--kin-co-goc)]">
        <thead>
          <tr className="text-[length:var(--kin-co-caption)] uppercase tracking-wide text-[var(--kin-chu-mo)]">
            {["Việc", "Từ ai · ở đâu", "Chờ", "Trạng thái", "Hành động"].map(h => (
              <th key={h} scope="col" className="sticky top-0 z-10 border-b border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody onKeyDown={rowKeys}>
          {items.map(item => {
            const on = selected.has(item.id);
            return (
              <tr key={item.id} data-row={item.id} aria-selected={openId === item.id || undefined}
                className={`border-b border-[var(--kin-vien-nhat)] last:border-b-0 ${openId === item.id ? "bg-[var(--kin-nen-dang-chon)]" : on ? "bg-[var(--kin-nen-bang)]" : ""}`}>
                <th scope="row" className="px-3 py-1 font-normal">
                  <div className="flex items-center gap-1">
                    <QueueCheck checked={on} onChange={v => onToggle(item.id, v)} label={`Chọn: ${item.title}`} testId="row" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--kin-chu-chinh)]">{item.title}</p>
                      <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{kindLabel(item.kind)}</p>
                      <p className="line-clamp-1 max-w-[46ch] text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">{item.subtitle}</p>
                    </div>
                  </div>
                </th>
                <td className="px-3 py-2 text-[var(--kin-chu-phu)]">
                  <p className="font-medium text-[var(--kin-chu-chinh)]">{item.who}</p>
                  <p className="text-[length:var(--kin-co-small)]">{item.place}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-[var(--kin-chu-phu)]">
                  <p>{item.when}</p>
                  <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{waited(item, now)}</p>
                </td>
                <td className="px-3 py-2"><KinStatus tone={item.status.tone}>{item.status.label}</KinStatus></td>
                <td className="px-3 py-2"><Actions item={item} busyId={busyId} onOpen={onOpen} onQuick={onQuick} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function QueueCards({ items, selected, openId, busyId, now, onToggle, onOpen, onQuick }: RowProps) {
  return (
    <ul data-queue-cards className="flex flex-col gap-2" onKeyDown={rowKeys}>
      {items.map(item => {
        const on = selected.has(item.id);
        return (
          <li key={item.id} data-row={item.id} className={`flex min-h-[72px] flex-col gap-2 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] p-3 ${openId === item.id ? "bg-[var(--kin-nen-dang-chon)]" : on ? "bg-[var(--kin-nen-bang)]" : "bg-[var(--kin-nen-trang)]"}`}>
            <div className="flex items-start gap-1">
              <QueueCheck checked={on} onChange={v => onToggle(item.id, v)} label={`Chọn: ${item.title}`} testId="row" />
              <div className="min-w-0 flex-1 pt-2">
                <p className="break-words font-semibold text-[var(--kin-chu-chinh)]">{item.title}</p>
                <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{`${kindLabel(item.kind)} · ${item.who} · ${item.place}`}</p>
                <p className="line-clamp-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">{item.subtitle}</p>
                <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">{`${item.when} · ${waited(item, now)}`}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <KinStatus tone={item.status.tone}>{item.status.label}</KinStatus>
              <Actions item={item} busyId={busyId} onOpen={onOpen} onQuick={onQuick} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
