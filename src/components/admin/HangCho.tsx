// Hàng chờ MỘT cửa (BU-08, Figma 608:1515 — chưa đối chiếu): thanh công cụ → bảng NN/g (1280) / danh sách thẻ (390) → panel bên khi mở một dòng.
// Mọi lệnh gọi đúng API duyệt đã có; hàng loạt = gọi từng API sau 5 giây hoàn tác (queue/useBulk). Không hộp thoại, không window.confirm.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KinButton, KinEmptyState } from "@/components/kin";
import type { QueueAction, QueueItem } from "@/lib/adminQueue";
import { QueueToolbar, BulkBar, QUEUE_PATH } from "./queue/QueueToolbar";
import { QueueTable, QueueCards } from "./queue/QueueTable";
import { QueuePanel, QUEUE_PANEL_GUTTER } from "./queue/QueuePanel";
import { QueueErrorStrip, QueueSkeleton, kindLabel, kindHidden } from "./queue/shared";
import { useBulk } from "./queue/useBulk";

/** Báo cho thanh module cập nhật số trên badge ngay khi xử lý xong một dòng. */
export const QUEUE_CHANGED = "kin:hang-cho-doi";
const PAGE = 50;

interface Resp { items: QueueItem[]; counts: Record<string, number>; badge: number; nextCursor: string | null }
type Fail = null | "net" | "perm" | "kind";

function useWide() {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function HangCho() {
  const loaiRaw = useSearchParams().get("loai");
  const loai = loaiRaw && kindHidden(loaiRaw) ? null : loaiRaw; // Coin ẩn: địa chỉ ?loai=nap-coin coi như không lọc
  const visible = <T extends { kind: string }>(a: T[]) => a.filter(i => !kindHidden(i.kind));
  const wide = useWide();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [next, setNext] = useState<string | null>(null);
  const [fail, setFail] = useState<Fail>(null);
  const [more, setMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [panelErr, setPanelErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef(0);
  const opener = useRef<string | null>(null);

  const load = useCallback((silent = false) => {
    const my = ++seq.current;
    if (!silent) { setItems(null); setFail(null); }
    const q = new URLSearchParams({ limit: String(PAGE) });
    if (loai) q.set("loai", loai);
    fetch(`/api/admin/kiem-duyet?${q}`, { credentials: "same-origin", cache: "no-store" })
      .then(async r => {
        if (my !== seq.current) return;
        if (r.status === 403) { setFail(loai ? "kind" : "perm"); setItems([]); return; }
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as Partial<Resp>;
        setItems(Array.isArray(d.items) ? visible(d.items) : []);
        setCounts(d.counts && typeof d.counts === "object" ? Object.fromEntries(Object.entries(d.counts).filter(([k]) => !kindHidden(k))) : {});
        setNext(d.nextCursor ?? null); setFail(null); setNow(Date.now());
      })
      .catch(() => { if (my === seq.current) setFail("net"); });
  }, [loai]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); setOpenId(null); }, [load]);

  const loadMore = () => {
    if (!next) return;
    setMore(true);
    const q = new URLSearchParams({ limit: String(PAGE), cursor: next });
    if (loai) q.set("loai", loai);
    fetch(`/api/admin/kiem-duyet?${q}`, { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Partial<Resp>) => {
        setItems(prev => { const seen = new Set((prev ?? []).map(i => i.id)); return [...(prev ?? []), ...visible(d.items ?? []).filter(i => !seen.has(i.id))]; });
        setNext(d.nextCursor ?? null);
      })
      .catch(() => setFail("net"))
      .finally(() => setMore(false));
  };

  const list = items ?? [];
  const changed = useCallback(() => { window.dispatchEvent(new Event(QUEUE_CHANGED)); load(true); }, [load]);
  const bulk = useBulk(list, (doneIds) => {
    setItems(prev => (prev ?? []).filter(i => !doneIds.includes(i.id)));
    changed();
  });

  // Làm tươi khi quay lại tab, nhưng không giật khỏi tay người đang chọn/duyệt.
  useEffect(() => {
    const onFocus = () => { if (bulk.selected.size === 0 && !openId && bulk.state.phase === "idle") load(true); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load, bulk.selected.size, openId, bulk.state.phase]);

  const openItem = list.find(i => i.id === openId) ?? null;
  const open = (id: string) => { opener.current = id; setPanelErr(null); setOpenId(id); };
  const close = useCallback(() => {
    setOpenId(null); setPanelErr(null);
    const id = opener.current;
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row-open="${CSS.escape(id)}"]`)?.focus());
  }, []);

  const run = (item: QueueItem, a: QueueAction, reason: string) => {
    setBusyId(item.id); setPanelErr(null);
    fetch(a.url, {
      method: a.method, credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(a.body ?? {}), ...(a.reason ? { reason } : {}) }),
    })
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        // 409 = người khác vừa xử lý xong dòng này: coi như xong.
        if (r.ok || r.status === 409) {
          setItems(prev => (prev ?? []).filter(i => i.id !== item.id));
          setOpenId(null); changed();
          return;
        }
        setPanelErr(typeof d.error === "string" ? d.error : "Không xử lý được. Thử lại.");
      })
      .catch(() => setPanelErr("Không kết nối được. Thử lại."))
      .finally(() => setBusyId(null));
  };

  const quick = (item: QueueItem) => { const a = item.detail.actions.find(x => x.key === item.quick); if (a) run(item, a, ""); };

  const loading = items === null && !fail;
  const empty = items !== null && list.length === 0 && !fail;
  const gutter = openItem ? QUEUE_PANEL_GUTTER : "";

  return (
    <div className={`flex min-h-full flex-col gap-3 p-4 sm:p-6 ${gutter}`} data-hang-cho>
      <header>
        <h1 className="text-[length:var(--kin-co-h4)] font-semibold tracking-[-0.015em] text-[var(--kin-chu-chinh)]">Hàng chờ</h1>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Mọi việc đang chờ người duyệt, ở một chỗ. Chờ lâu nhất xếp trước.</p>
      </header>

      <QueueToolbar counts={counts} active={loai} selectedCount={bulk.selected.size} visibleCount={list.length} onToggleAll={bulk.toggleAll} />
      {fail === "net" && <QueueErrorStrip message="Chưa tải được hàng chờ." onRetry={() => load()} />}

      {loading && <QueueSkeleton />}

      {fail === "perm" && (
        <KinEmptyState title="Bạn không có quyền xem hàng chờ">Tài khoản này chưa được giao việc duyệt. Nhờ quản trị cấp 1 cấp quyền nếu cần.</KinEmptyState>
      )}
      {fail === "kind" && (
        <KinEmptyState title="Bạn không có quyền xem loại này" action={<Link href={QUEUE_PATH} className="inline-flex min-h-11 items-center font-medium text-[var(--kin-nhan-link)] underline">Xoá lọc</Link>}>
          Loại việc này thuộc quyền khác. Các loại bạn duyệt được vẫn ở Hàng chờ.
        </KinEmptyState>
      )}
      {empty && !loai && <KinEmptyState title="Hàng chờ trống">Hồ sơ gia sư, báo cáo và đánh giá mới sẽ hiện ở đây.</KinEmptyState>}
      {empty && loai && (
        <KinEmptyState title="Không có việc loại này" action={<Link href={QUEUE_PATH} className="inline-flex min-h-11 items-center font-medium text-[var(--kin-nhan-link)] underline">Xoá lọc</Link>}>
          {`Hiện không có việc “${kindLabel(loai)}” nào đang chờ.`}
        </KinEmptyState>
      )}

      {items !== null && list.length > 0 && wide !== null && (
        <>
          {wide
            ? <QueueTable items={list} selected={bulk.selected} openId={openId} busyId={busyId} now={now} onToggle={bulk.toggle} onOpen={open} onQuick={quick} />
            : <QueueCards items={list} selected={bulk.selected} openId={openId} busyId={busyId} now={now} onToggle={bulk.toggle} onOpen={open} onQuick={quick} />}
          {next && (
            <div className="flex justify-center">
              <KinButton variant="secondary" loading={more} loadingLabel="Đang tải…" onClick={loadMore}>Tải thêm</KinButton>
            </div>
          )}
        </>
      )}

      <BulkBar count={bulk.selected.size} commands={bulk.commands} reason={bulk.reason} state={bulk.state} message={bulk.message}
        onStart={bulk.start} onUndo={bulk.undo} onClear={bulk.clear} />

      {openItem && <QueuePanel key={openItem.id} item={openItem} busy={busyId === openItem.id} error={panelErr} onClose={close} onRun={(a, reason) => run(openItem, a, reason)} />}
    </div>
  );
}
