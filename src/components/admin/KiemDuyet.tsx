// "Chờ kiểm duyệt" (Figma "Vỏ — Quản trị" 11:287): một hàng chờ gộp, danh sách bên trái + khung đọc bên phải, lệnh ở đầu khung đọc.
// Mọi lệnh gọi đúng API xử lý đã có (duyệt/từ chối gia sư, xử lý báo cáo bài viết/hồ sơ) — không có đường xử lý mới ở đây.
// Việc cần lý do thì hỏi lý do trước; việc không hoàn tác được thì hỏi lại một câu; báo cáo câu trả lời (có thể trừ xu) chỉ mở trang riêng.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueAction, QueueItem } from "@/lib/adminQueue";
import { KinButton } from "@/components/kin/Button";
import {
  ErrorStrip, ListBody, ListHead, ListRow, ListSkeleton, OutlookPanes, ReadBody, ReadEmpty, ReadHead, ReadSection, type Command,
} from "@/components/kin/shell/Outlook";

/** Báo cho thanh module cập nhật số trên badge ngay khi xử lý xong một dòng. */
export const QUEUE_CHANGED = "kin:hang-cho-doi";

const KIND_LABEL: Record<QueueItem["kind"], string> = { "gia-su": "Hồ sơ gia sư", "bai-viet": "Bài viết", "ho-so": "Hồ sơ bị báo cáo", "tra-loi": "Câu trả lời" };

export default function KiemDuyet() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readOpen, setReadOpen] = useState(false);
  const [pending, setPending] = useState<{ itemId: string; key: QueueAction["key"] } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<{ itemId: string; text: string } | null>(null);
  const focusRow = useRef<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/kiem-duyet", { credentials: "same-origin", cache: "no-store" })
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
    const el = document.getElementById(`kd-${focusRow.current}`);
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

  const run = (item: QueueItem, a: QueueAction) => {
    const text = reason.trim();
    setBusy(true);
    setFail(null);
    fetch(a.url, {
      method: a.method, credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(a.body ?? {}), ...(a.reason ? { reason: text } : {}) }),
    })
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        // 409 = người khác vừa xử lý xong dòng này: coi như đã xong, tải lại hàng chờ.
        if (r.ok || r.status === 409) {
          setItems(prev => (prev ?? []).filter(i => i.id !== item.id));
          setPending(null); setReason(""); setReadOpen(false);
          window.dispatchEvent(new Event(QUEUE_CHANGED));
          load();
          return;
        }
        setFail({ itemId: item.id, text: typeof d.error === "string" ? d.error : "Không xử lý được. Thử lại." });
      })
      .catch(() => setFail({ itemId: item.id, text: "Không kết nối được. Thử lại." }))
      .finally(() => setBusy(false));
  };

  const start = (item: QueueItem, a: QueueAction) => {
    setFail(null);
    if (!a.reason && !a.confirm) return run(item, a);
    setReason("");
    setPending({ itemId: item.id, key: a.key });
  };

  const listPane = (
    <>
      <ListHead title="Chờ kiểm duyệt" subtitle="Hàng chờ nội dung và hồ sơ" />
      {error && <ErrorStrip message="Không tải được hàng chờ." onRetry={load} />}
      {items === null && !error ? (
        <ListSkeleton rows={5} />
      ) : (
        <ListBody label="Chờ kiểm duyệt" onKeyDown={onKeyDown}>
          {list.length === 0 && items !== null && (
            <p className="px-[14px] py-6 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Không có gì đang chờ.</p>
          )}
          {list.map(i => (
            <ListRow key={i.id} id={`kd-${i.id}`} selected={current?.id === i.id} onSelect={() => select(i.id)}
              title={i.title} when={i.when} subtitle={i.subtitle} status={i.status} strong />
          ))}
        </ListBody>
      )}
    </>
  );

  let readPane: React.ReactNode;
  if (current) {
    const mine = pending && pending.itemId === current.id ? current.detail.actions.find(a => a.key === pending.key) ?? null : null;
    const commands: Command[] = [
      ...current.detail.actions.map<Command>(a => ({
        label: a.label, kind: a.kind, disabled: !!a.disabled || busy,
        onClick: () => start(current, a),
      })),
      ...current.detail.links.map<Command>(l => ({ label: l.label, href: l.href, kind: current.detail.actions.length === 0 ? "primary" : "secondary" })),
    ];
    const err = fail && fail.itemId === current.id ? fail.text : null;
    readPane = (
      <>
        <ReadHead title={current.detail.heading} meta={`${KIND_LABEL[current.kind]} · ${current.detail.meta}`} commands={commands} onBack={() => setReadOpen(false)} />
        <ReadBody>
          {mine && (
            <div role="group" aria-label={mine.label} className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-4 flex flex-col gap-3">
              {mine.reason ? (
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-[var(--kin-chu-chinh)]">{mine.reason.label}</span>
                  <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, mine.reason!.max))} rows={3} disabled={busy}
                    className="notion-input w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]" />
                  <span className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] self-end">{reason.length}/{mine.reason.max}</span>
                </label>
              ) : (
                <p className="text-[var(--kin-chu-chinh)]">{mine.confirm}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <KinButton type="button" variant={mine.kind === "danger" ? "danger-solid" : "primary"} onClick={() => run(current, mine)}
                  disabled={busy || (!!mine.reason && reason.trim() === "")} loading={busy} loadingLabel="Đang gửi…">
                  {`Xác nhận: ${mine.label}`}
                </KinButton>
                <KinButton type="button" variant="secondary" onClick={() => { setPending(null); setFail(null); }} disabled={busy}>Huỷ</KinButton>
              </div>
            </div>
          )}
          {err && <p role="alert" className="font-semibold text-[var(--kin-tt-chu-loi)]">{err}</p>}
          {current.detail.sections.map(s => <ReadSection key={s.title} title={s.title} text={s.text} />)}
        </ReadBody>
      </>
    );
  } else {
    readPane = <ReadEmpty title={items === null ? "Đang tải…" : "Hàng chờ trống"} text={items === null ? undefined : "Hồ sơ gia sư xin duyệt và các báo cáo mới sẽ hiện ở đây."} />;
  }

  return <OutlookPanes list={listPane} read={readPane} open={readOpen && !!current} />;
}
