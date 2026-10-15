// Hộp việc của gia sư (Figma "Vỏ — Gia sư" 9:2): danh sách bên trái (mỗi LOẠI việc một dòng), khung đọc bên phải liệt kê từng việc
// cụ thể + nút tới đúng trang xử lý. Điện thoại: chọn một dòng thì hiện khung đọc, có nút ← quay lại. Lỗi tải: giữ danh sách cũ,
// hiện dải báo lỗi có nút thử lại. Đang tải lần đầu: khung xương, không vòng xoay. Dữ liệu: /api/tutor/hop-viec.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InboxItem } from "@/lib/tutorInbox";
import {
  ErrorStrip, ListBody, ListHead, ListRow, ListSkeleton, OutlookPanes, ReadBody, ReadEmpty, ReadHead,
} from "@/components/kin/shell/Outlook";

export default function HopViec() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readOpen, setReadOpen] = useState(false);
  const focusRow = useRef<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/tutor/hop-viec", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setItems(Array.isArray(d.items) ? d.items : []); setError(false); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const list = items ?? [];
  const current = list.find(i => i.id === selectedId) ?? list[0] ?? null;

  useEffect(() => {
    if (!focusRow.current) return;
    const el = document.getElementById(`hv-${focusRow.current}`);
    focusRow.current = null;
    el?.focus();
  }, [current?.id]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    if (list.length === 0) return;
    e.preventDefault();
    const at = Math.max(0, list.findIndex(i => i.id === current?.id));
    const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
    focusRow.current = list[next].id;
    setSelectedId(list[next].id);
  };
  const select = (id: string) => { setSelectedId(id); setReadOpen(true); };

  const listPane = (
    <>
      <ListHead title="Hộp việc" subtitle="Việc KiN sinh ra, không phải email" />
      {error && <ErrorStrip message="Không tải được Hộp việc." onRetry={load} />}
      {items === null && !error ? (
        <ListSkeleton rows={4} />
      ) : (
        <ListBody label="Hộp việc" onKeyDown={onKeyDown}>
          {list.length === 0 && items !== null && (
            <p className="px-[14px] py-6 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Không có việc nào đang chờ bạn.</p>
          )}
          {list.map(i => (
            <ListRow key={i.id} id={`hv-${i.id}`} selected={current?.id === i.id} onSelect={() => select(i.id)}
              title={i.title} when={i.when} subtitle={i.subtitle} status={i.status} strong={i.urgent} />
          ))}
        </ListBody>
      )}
    </>
  );

  const readPane = current ? (
    <>
      <ReadHead title={current.detail.heading} meta={current.detail.meta} commands={current.detail.commands} onBack={() => setReadOpen(false)} />
      <ReadBody>
        <ul aria-label="Các việc cụ thể" className="flex flex-col gap-3">
          {current.detail.rows.map((r, idx) => (
            <li key={idx} className="flex flex-col gap-[2px]">
              {r.href
                ? <Link href={r.href} className="font-medium text-[var(--kin-chu-chinh)] hover:underline w-fit">{r.title}</Link>
                : <p className="font-medium text-[var(--kin-chu-chinh)]">{r.title}</p>}
              <p className="text-[var(--kin-chu-mo)]">{r.sub}</p>
            </li>
          ))}
        </ul>
        {current.detail.more > 0 && <p className="text-[var(--kin-chu-mo)]">và {current.detail.more} việc nữa — mở trang xử lý để xem đủ.</p>}
      </ReadBody>
    </>
  ) : (
    <ReadEmpty title={items === null ? "Đang tải…" : "Hộp việc trống"} text={items === null ? undefined : "Báo nghỉ sát giờ, tiền cần đối soát, bài chưa chấm và các việc cần bạn ra tay sẽ hiện ở đây."} />
  );

  return <OutlookPanes list={listPane} read={readPane} open={readOpen && !!current} />;
}
