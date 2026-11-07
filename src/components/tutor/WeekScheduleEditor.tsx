// TUT-lich-keo-tha — lưới KHUNG GIỜ hằng tuần kéo-thả (đặc tả docs/kin/phong-ban/dac-ta/TUT-lich-keo-tha.md mục 3).
// Không biết API: cha (LichKhung / TaoLop) nhận từng thao tác qua `onOp`, áp lạc quan vào `blocks` và trả {ok} | {ok:false,error} | {ok:false,conflicts}.
// Tự dựng bằng pointer events, KHÔNG thêm thư viện. Logic thuần (snap, kẹp, trùng giờ, đảo thao tác) ở src/lib/scheduleDrag.ts.
//  • Chuột (>= 640px và mọi con trỏ không phải cảm ứng): kéo ô trống = tạo bản nháp (mở panel, chưa ghi), kéo thân khối = dời (cả sang ngày khác), kéo mép = đổi dài; Esc giữa chừng = huỷ, không gọi API.
//  • Chạm: ĐƯỜNG CHÍNH = bấm ô trống / bấm khối -> panel dạng ngăn dưới có bộ chọn giờ. Đường phụ = chạm-giữ 350ms rồi kéo (ngón di > 8px trước đó = người dùng đang cuộn, bỏ qua).
//  • Bàn phím: khối là <button>; mũi tên dời ±15'/±1 ngày, Shift đổi mép dưới, Alt+Shift đổi mép trên, Delete = tắt khung (hoàn tác được), Ctrl/Cmd+Z hoàn tác; phím lặp gom thành MỘT lần ghi sau 400ms. aria-live đọc kết quả.
//  • Khối chồng giờ vẫn lưu được, nhưng có viền nét đứt + CHỮ "Trùng giờ" + dòng liệt kê dưới lưới (màu không là cách duy nhất). Chữ trùng giờ chỉ có tên lớp và giờ, không tên học sinh.
// Mọi khối nằm trong MỘT lớp phủ (không nằm trong từng cột) để đổi ngày không làm gỡ/dựng lại phần tử — giữ được tiêu điểm bàn phím và con trỏ.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { KinButton, kinButtonClass } from "@/components/kin";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { Modal } from "@/components/tutor/shared";
import { hmOf } from "@/lib/classSessions";
import {
  DAY_END_MIN, DEFAULT_DURATION_MIN, NOTE_MAX, SNAP_MIN, WEEKDAY_NAMES, WEEK_ORDER,
  applyOp, createRange, describeBlock, diffBlocks, findConflicts, formatDuration, invertOp, layoutDayLanes, moveBlock, nudge, resizeRange, snapMin, weeklyMinutes,
  type Conflict, type OpResult, type ScheduleBlock, type ScheduleOp,
} from "@/lib/scheduleDrag";

export type { ScheduleBlock, ScheduleOp, OpResult, Conflict } from "@/lib/scheduleDrag";

export interface WeekScheduleEditorProps {
  /** Khung của lớp ĐANG SỬA. */
  blocks: ScheduleBlock[];
  /** Khung của lớp KHÁC (chỉ đọc, dùng tính trùng giờ). */
  ghosts?: ScheduleBlock[];
  /** Token màu của lớp, ví dụ classAccentFor(...). */
  accent: string;
  state: "loading" | "error" | "ready";
  onRetry?: () => void;
  errorMessage?: string;
  /** Cha ghi (API hoặc cục bộ). Lỗi/trùng giờ thì cha đã HOÀN LẠI trạng thái lạc quan trước khi trả kết quả. `force` = "Vẫn lưu" sau cảnh báo trùng giờ. */
  onOp: (op: ScheduleOp, o?: { force?: boolean }) => Promise<OpResult> | OpResult;
  canEdit?: (b: ScheduleBlock) => boolean;
  /** Người dạy của khung (TUT-dong-giang). Vắng = không có ô người dạy (wizard Tạo lớp: chưa có đồng giảng).
   *  "select" = chủ/quản trị: ô chọn (mặc định Chủ lớp + các giáo viên đang dạy). "text" = đồng giảng/bộ môn: chỉ nhãn chỉ-đọc, khung mới là của chính mình. */
  teacher?: { mode: "select"; options: { id: string; label: string }[] } | { mode: "text"; selfId: string };
  /** false = không được thêm khung (giáo viên bộ môn): ẩn nút Thêm, bấm ô trống không mở bản nháp. */
  canAdd?: boolean;
  renderBadge?: (b: ScheduleBlock) => ReactNode;
  /** true = khung đã lưu trên máy chủ: Delete chỉ TẮT khung; hoàn tác không xoá cứng. false (wizard) = xoá cục bộ. */
  remote?: boolean;
  /** Khởi tạo kiểu xem trên màn hẹp. Mặc định: màn hẹp = "day", màn rộng = "week". */
  density?: "week" | "day";
  visibleRange?: [number, number];
  /** Tên hiển thị cho khung mới (tên lớp). */
  courseLabel?: string;
  /** Câu thêm vào dòng "Lớp chưa có lịch học" (hệ quả). */
  emptyNote?: ReactNode;
}

const GUTTER = 44;
const MIN_COL_NARROW = 96;
const MIN_COL_WIDE = 84;
const PPH_WEEK = 56;
const PPH_DAY = 64;
const HOLD_MS = 350;
const KEY_COALESCE_MS = 400;
const TOAST_MS = 8000;
const DEFAULT_RANGE: [number, number] = [6 * 60, 22 * 60];
const NARROW_QUERY = "(max-width: 639px)";
const HM_OPTIONS = Array.from({ length: (DAY_END_MIN / SNAP_MIN) + 1 }, (_, i) => i * SNAP_MIN);
const TMP_DRAG = "tmp-drag";
let tmpSeq = 0;
export const newTmpId = () => `tmp-${Date.now().toString(36)}-${++tmpSeq}`;
const hm = (min: number) => (min >= DAY_END_MIN ? "24:00" : hmOf(min));
const nameOf = (b: ScheduleBlock) => b.courseName?.trim() || b.note?.trim() || "Khung giờ";
const dayName = (d: number) => WEEKDAY_NAMES[d] ?? "";
const dayShort = (d: number) => (d === 0 ? "CN" : `T${d + 1}`);

function useNarrow(): boolean {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia(NARROW_QUERY); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

interface DragCtx {
  kind: "create" | "move" | "rt" | "rb";
  pointerId: number; touch: boolean; active: boolean;
  startX: number; startY: number;
  top: number; left: number; right: number; bottom: number;
  cols: { day: number; left: number; right: number }[];
  orig: ScheduleBlock | null; day: number; anchor: number; grab: number;
  timer: number | null; raf: number | null; lastX: number; lastY: number;
}

function labelFor(op: ScheduleOp, before: readonly ScheduleBlock[]): string {
  if (op.type === "create") return `Đã thêm khung ${nameOf(op.block)} ${dayName(op.block.dayOfWeek)} ${hm(op.block.startMin)} đến ${hm(op.block.endMin)}.`;
  const was = before.find(b => b.id === op.id);
  if (!was) return "Đã lưu.";
  if (op.type === "remove") return `Đã xoá khung ${nameOf(was)} ${dayName(was.dayOfWeek)}.`;
  const after = { ...was, ...op.patch };
  if (op.patch.active === false) return `Đã tắt khung ${nameOf(was)} ${dayName(was.dayOfWeek)}.`;
  if (op.patch.active === true) return `Đã bật lại khung ${nameOf(was)} ${dayName(was.dayOfWeek)}.`;
  if (op.patch.dayOfWeek !== undefined || op.patch.startMin !== undefined || op.patch.endMin !== undefined)
    return `Đã dời ${nameOf(after)} sang ${dayName(after.dayOfWeek)} ${hm(after.startMin)} đến ${hm(after.endMin)}.`;
  return `Đã lưu khung ${nameOf(after)} ${dayName(after.dayOfWeek)}.`;
}

export default function WeekScheduleEditor(props: WeekScheduleEditorProps) {
  const { blocks, ghosts = [], accent, state, onOp, canEdit, renderBadge, remote = false, courseLabel, emptyNote, teacher, canAdd = true } = props;
  const narrow = useNarrow();
  const { ask, dialog: confirmDialog } = useKinConfirm();

  const [userMode, setUserMode] = useState<"week" | "day" | null>(props.density ?? null);
  const mode: "week" | "day" = narrow ? (userMode ?? "day") : "week";
  const pph = mode === "day" ? PPH_DAY : PPH_WEEK;
  const [selectedDay, setSelectedDay] = useState<number>(() => (blocks[0]?.dayOfWeek ?? 2));
  const [fullDay, setFullDay] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleBlock | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);     // id khối đang mở panel ("draft" = bản nháp)
  const [preview, setPreview] = useState<ScheduleBlock | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: boolean; key: number } | null>(null);
  const [live, setLive] = useState("");
  const [undoCount, setUndoCount] = useState(0);
  const [conflictAsk, setConflictAsk] = useState<{ op: ScheduleOp; label: string; conflicts: Conflict[]; after?: () => void } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragCtx | null>(null);
  const suppressClick = useRef(false);
  const undoStack = useRef<{ inverse: ScheduleOp; label: string }[]>([]);
  const toastTimer = useRef<number | null>(null);
  const kb = useRef<{ id: string; base: ScheduleBlock; cur: ScheduleBlock; timer: number | null } | null>(null);
  const focusId = useRef<string | null>(null);
  const blocksRef = useRef(blocks);
  const commitRef = useRef<((op: ScheduleOp, o?: { force?: boolean; noUndo?: boolean; after?: () => void }) => Promise<boolean>) | null>(null);
  useEffect(() => { blocksRef.current = blocks; });

  // ── Khoảng giờ nhìn thấy ────────────────────────────────────────────────────
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (fullDay) return [0, DAY_END_MIN] as [number, number];
    let [lo, hi] = props.visibleRange ?? DEFAULT_RANGE;
    for (const b of [...blocks, ...(draft ? [draft] : [])]) { lo = Math.min(lo, b.startMin); hi = Math.max(hi, b.endMin); }
    return [Math.floor(lo / 60) * 60, Math.min(DAY_END_MIN, Math.ceil(hi / 60) * 60)] as [number, number];
  }, [fullDay, props.visibleRange, blocks, draft]);
  const geom = useRef({ pph, rangeStart, rangeEnd, mode, selectedDay });
  useEffect(() => { geom.current = { pph, rangeStart, rangeEnd, mode, selectedDay }; });
  const bodyH = ((rangeEnd - rangeStart) / 60) * pph;
  const days: number[] = mode === "day" ? [selectedDay] : [...WEEK_ORDER];
  const N = days.length;

  // ── Khối đang hiển thị (có xem trước khi kéo/phím) ──────────────────────────
  const view = useMemo(() => {
    let list = blocks.map(b => (preview && preview.id === b.id ? preview : b));
    // Bản nháp vừa được cha áp lạc quan (cùng id) thì chỉ vẽ MỘT khối — trùng key làm React để sót phần tử cũ.
    if (draft && !blocks.some(b => b.id === draft.id)) list = [...list, preview && preview.id === draft.id ? preview : draft];
    if (preview && preview.id === TMP_DRAG) list = [...list, preview];
    return list;
  }, [blocks, draft, preview]);
  const lanes = useMemo(() => layoutDayLanes(view.filter(b => b.active !== false)), [view]);
  const conflictsOf = useMemo(() => {
    const m = new Map<string, Conflict[]>();
    for (const b of view) { const own = view.filter(o => o.id !== TMP_DRAG); const c = findConflicts(b, own, ghosts); if (c.length) m.set(b.id, c); }
    return m;
  }, [view, ghosts]);
  const sorted = useMemo(() => [...view].sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek as typeof WEEK_ORDER[number]) - WEEK_ORDER.indexOf(b.dayOfWeek as typeof WEEK_ORDER[number]) || a.startMin - b.startMin || (a.id < b.id ? -1 : 1)), [view]);
  const activeOwn = blocks.filter(b => b.active !== false);
  const countOfDay = (d: number) => blocks.filter(b => b.dayOfWeek === d && b.active !== false).length;

  // ── Thông báo + hoàn tác ───────────────────────────────────────────────────
  const announce = useCallback((t: string) => { setLive(""); window.setTimeout(() => setLive(t), 30); }, []);
  const showToast = useCallback((text: string, undo: boolean) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, undo, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const setBusyIds = (ids: string[], on: boolean) => setBusy(prev => { const n = new Set(prev); for (const i of ids) { if (on) n.add(i); else n.delete(i); } return n; });

  /** Gửi một thao tác lên cha. Trả true khi cha báo ok. */
  const commit = useCallback(async (op: ScheduleOp, o: { force?: boolean; noUndo?: boolean; after?: () => void } = {}): Promise<boolean> => {
    const before = blocksRef.current;
    const label = labelFor(op, before);
    const inverse = o.noUndo ? null : invertOp(op, before, { remote });
    const id = op.type === "create" ? op.block.id : op.id;
    setError(null); setBusyIds([id], true);
    let res: OpResult;
    try { res = await onOp(op, { force: o.force }); } catch { res = { ok: false, error: "Lỗi kết nối" }; }
    setBusyIds([id], false);
    if (res.ok) {
      if (inverse) { undoStack.current = [...undoStack.current.slice(-19), { inverse, label }]; setUndoCount(undoStack.current.length); }
      announce(label); showToast(label, !!inverse); o.after?.();
      return true;
    }
    if ("conflicts" in res) { setConflictAsk({ op, label, conflicts: res.conflicts, after: o.after }); return false; }
    const text = `Không lưu được: ${res.error}`;
    setError({ text, retry: () => void commitRef.current?.(op, o) }); announce(text);
    return false;
  }, [onOp, remote, announce, showToast]);

  useEffect(() => { commitRef.current = commit; });

  const undo = useCallback(async () => {
    const top = undoStack.current[undoStack.current.length - 1];
    if (!top) return;
    undoStack.current = undoStack.current.slice(0, -1); setUndoCount(undoStack.current.length);
    setToast(null); setError(null);
    const id = top.inverse.type === "create" ? top.inverse.block.id : top.inverse.id;
    setBusyIds([id], true);
    let res: OpResult;
    try { res = await onOp(top.inverse, { force: true }); } catch { res = { ok: false, error: "Lỗi kết nối" }; }
    setBusyIds([id], false);
    if (res.ok) { announce("Đã hoàn tác."); showToast("Đã hoàn tác.", false); }
    else { const t = `Không hoàn tác được: ${"error" in res ? res.error : "khung giờ trùng"}`; setError({ text: t }); announce(t); }
  }, [onOp, announce, showToast]);

  // ── Mở panel / bản nháp ────────────────────────────────────────────────────
  const openDraft = useCallback((day: number, startMin: number, endMin?: number) => {
    if (!canAdd) return;
    const start = Math.min(startMin, DAY_END_MIN - SNAP_MIN);
    const end = endMin ?? Math.min(DAY_END_MIN, start + DEFAULT_DURATION_MIN);
    const d: ScheduleBlock = { id: newTmpId(), dayOfWeek: day, startMin: start, endMin: end, courseName: courseLabel, draft: true, active: true, note: null, ...(teacher?.mode === "text" ? { teacherId: teacher.selfId, teacherLabel: "bạn" } : {}) };
    setDraft(d); setPanelId("draft"); setSelectedId(d.id); setPreview(null);
  }, [courseLabel, canAdd, teacher]);

  function addButton() {
    const day = mode === "day" ? selectedDay : 2;
    const same = blocksRef.current.filter(b => b.dayOfWeek === day && b.active !== false);
    let start = 19 * 60;
    if (same.some(b => b.startMin < start + DEFAULT_DURATION_MIN && start < b.endMin)) start = Math.min(...[Math.max(...same.map(b => b.endMin)), DAY_END_MIN - DEFAULT_DURATION_MIN]);
    openDraft(day, snapMin(start));
  }
  const closePanel = useCallback(() => {
    focusId.current = panelId && panelId !== "draft" ? panelId : null;
    setPanelId(null); setDraft(null);
  }, [panelId]);

  // ── Con trỏ ────────────────────────────────────────────────────────────────
  const minAt = (y: number, c: DragCtx) => { const g = geom.current; return Math.min(g.rangeEnd, Math.max(g.rangeStart, g.rangeStart + ((y - c.top) / g.pph) * 60)); };
  const dayAt = (x: number, c: DragCtx) => {
    if (geom.current.mode === "day" || !c.cols.length) return geom.current.selectedDay;
    const hit = c.cols.find(k => x >= k.left && x < k.right);
    return (hit ?? (x < c.cols[0].left ? c.cols[0] : c.cols[c.cols.length - 1])).day;
  };

  /** Khối xem trước ở toạ độ (x,y); null = đang ở NGOÀI lưới (thả ra đây = huỷ). */
  const compute = (c: DragCtx, x: number, y: number): ScheduleBlock | null => {
    const g = geom.current;
    const inside = x >= c.left && x <= c.right && y >= c.top - 24 && y <= c.bottom + 24;
    if (!inside) return null;
    const m = minAt(y, c);
    if (c.kind === "create") return { id: TMP_DRAG, dayOfWeek: c.day, courseName: courseLabel, draft: true, active: true, note: null, ...createRange(c.anchor, m) };
    const o = c.orig as ScheduleBlock;
    if (c.kind === "move") {
      let delta = snapMin(m - c.grab) - o.startMin;
      delta = Math.max(g.rangeStart - o.startMin, Math.min(g.rangeEnd - o.endMin, delta));
      return moveBlock(o, { deltaMin: delta, toDay: g.mode === "day" ? undefined : dayAt(x, c) });
    }
    return { ...o, ...resizeRange(o, c.kind === "rt" ? "start" : "end", m) };
  };

  function activate(c: DragCtx) {
    if (c.active || dragRef.current !== c) return;
    c.active = true; setDragging(true);
    if (c.touch && typeof navigator.vibrate === "function") navigator.vibrate(12);
    try { rootRef.current?.setPointerCapture(c.pointerId); } catch { /* con trỏ đã thôi */ }
    if (c.orig) setSelectedId(c.orig.id);
  }
  function endDrag(c: DragCtx) {
    if (c.timer) window.clearTimeout(c.timer);
    if (c.raf) cancelAnimationFrame(c.raf);
    if (dragRef.current === c) dragRef.current = null;
    try { rootRef.current?.releasePointerCapture(c.pointerId); } catch { /* đã nhả */ }
    setDragging(false); setPreview(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (state !== "ready" || dragRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const t = e.target as HTMLElement, area = areaRef.current;
    if (!area || !area.contains(t)) return;
    const handleEl = t.closest<HTMLElement>("[data-handle]");
    const blockEl = t.closest<HTMLElement>("[data-block-id]");
    const colEl = t.closest<HTMLElement>("[data-day-col]");
    if (!blockEl && !colEl) return;
    if (!blockEl && !canAdd) return;
    let orig: ScheduleBlock | null = null;
    let kind: DragCtx["kind"] = "create";
    if (blockEl) {
      orig = blocksRef.current.find(b => b.id === blockEl.dataset.blockId) ?? null;
      if (!orig || (canEdit && !canEdit(orig))) return;
      kind = handleEl?.dataset.handle === "top" ? "rt" : handleEl?.dataset.handle === "bottom" ? "rb" : "move";
    }
    const ar = area.getBoundingClientRect();
    const cols = [...area.querySelectorAll<HTMLElement>("[data-day-col]")].map(el => { const r = el.getBoundingClientRect(); return { day: Number(el.dataset.dayCol), left: r.left, right: r.right }; });
    const c: DragCtx = {
      kind, pointerId: e.pointerId, touch: e.pointerType === "touch", active: false, startX: e.clientX, startY: e.clientY,
      top: ar.top, left: ar.left, right: ar.right, bottom: ar.bottom, cols, orig, day: 0, anchor: 0, grab: 0, timer: null, raf: null, lastX: e.clientX, lastY: e.clientY,
    };
    c.day = dayAt(e.clientX, c);
    const m = minAt(e.clientY, c);
    c.anchor = snapMin(m); c.grab = orig ? m - orig.startMin : 0;
    dragRef.current = c;
    if (c.touch) c.timer = window.setTimeout(() => activate(c), HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const c = dragRef.current;
    if (!c || e.pointerId !== c.pointerId) return;
    c.lastX = e.clientX; c.lastY = e.clientY;
    if (!c.active) {
      const dist = Math.hypot(e.clientX - c.startX, e.clientY - c.startY);
      if (c.touch) { if (dist > 8) endDrag(c); return; }   // ngón di chuyển trước khi giữ đủ lâu = đang cuộn trang
      if (dist < 4) return;
      activate(c);
    }
    if (c.raf) return;
    c.raf = requestAnimationFrame(() => {
      c.raf = null;
      if (dragRef.current !== c) return;
      const nb = compute(c, c.lastX, c.lastY);
      setPreview(prev => {
        const next = nb ?? (c.orig ? c.orig : null);
        if (prev && next && prev.id === next.id && prev.dayOfWeek === next.dayOfWeek && prev.startMin === next.startMin && prev.endMin === next.endMin) return prev;
        return next;
      });
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    const c = dragRef.current;
    if (!c || e.pointerId !== c.pointerId) return;
    if (!c.active) {
      const dist = Math.hypot(e.clientX - c.startX, e.clientY - c.startY);
      const wasCreate = c.kind === "create";
      endDrag(c);
      if (wasCreate && dist <= (c.touch ? 8 : 4)) openDraft(c.day, c.anchor);   // bấm ô trống -> bản nháp 90' tại giờ vừa bấm
      return;
    }
    const fin = compute(c, e.clientX, e.clientY);
    const orig = c.orig;
    suppressClick.current = true; window.setTimeout(() => { suppressClick.current = false; }, 60);
    endDrag(c);
    if (!fin) return;                       // thả ngoài lưới: không đổi gì
    if (c.kind === "create") { openDraft(fin.dayOfWeek, fin.startMin, fin.endMin); return; }
    if (!orig) return;
    const ops = diffBlocks([orig], [fin]);
    if (ops[0]) void commit(ops[0]);
  }

  function cancelDrag() {
    const c = dragRef.current;
    if (c) { endDrag(c); }
  }

  // Esc giữa chừng = huỷ kéo; touchmove không bị cuộn khi đang kéo bằng cách giữ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && dragRef.current?.active) { e.preventDefault(); cancelDrag(); } };
    window.addEventListener("keydown", onKey);
    const el = rootRef.current;
    const onTouchMove = (e: TouchEvent) => { if (dragRef.current?.active && dragRef.current.touch && e.cancelable) e.preventDefault(); };
    el?.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => { window.removeEventListener("keydown", onKey); el?.removeEventListener("touchmove", onTouchMove); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useEffect(() => () => { const c = dragRef.current; if (c?.timer) window.clearTimeout(c.timer); if (kb.current?.timer) window.clearTimeout(kb.current.timer); }, []);

  // Giữ tiêu điểm trên khối sau khi bàn phím/đổi ngày làm phần tử bị sắp xếp lại.
  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  });

  // ── Bàn phím trên khối ─────────────────────────────────────────────────────
  function flushKb() {
    const k = kb.current;
    if (!k) return;
    kb.current = null; setPreview(null);
    const ops = diffBlocks([k.base], [k.cur]);
    if (ops[0]) void commit(ops[0]);
  }
  function onBlockKey(e: React.KeyboardEvent, b: ScheduleBlock) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); void undo(); return; }
    if (b.draft) return;
    if (canEdit && !canEdit(b)) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (b.active === false && remote) return;
      void commit(remote ? { type: "update", id: b.id, patch: { active: false } } : { type: "remove", id: b.id });
      focusId.current = null;
      return;
    }
    if (e.key === "Escape") { if (kb.current) { if (kb.current.timer) window.clearTimeout(kb.current.timer); kb.current = null; setPreview(null); } return; }
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    if (e.altKey && !e.shiftKey) return;
    const base = kb.current?.id === b.id ? kb.current.base : b;
    const cur = kb.current?.id === b.id ? kb.current.cur : b;
    const next = nudge(cur, e.key, { shift: e.shiftKey, alt: e.altKey });
    if (kb.current?.timer) window.clearTimeout(kb.current.timer);
    focusId.current = b.id;
    kb.current = { id: b.id, base, cur: next, timer: window.setTimeout(flushKb, KEY_COALESCE_MS) };
    setPreview(next);
    if (mode === "day" && next.dayOfWeek !== selectedDay) setSelectedDay(next.dayOfWeek);
  }

  function onBlockClick(b: ScheduleBlock) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setSelectedId(b.id);
    setPanelId(b.draft ? "draft" : b.id);
  }

  // ── Dựng ───────────────────────────────────────────────────────────────────
  if (state === "loading") return <div aria-busy="true" aria-label="Đang tải lịch khung giờ" role="status" data-schedule-state="loading" className="kin-skel kin-skel--soft rounded" style={{ height: 420 }} />;
  if (state === "error") return <div data-schedule-state="error"><ErrorStrip message={props.errorMessage ?? "Không tải được khung giờ của lớp. Kiểm tra mạng rồi thử lại."} onRetry={props.onRetry ?? (() => {})} /></div>;

  const panelBlock = panelId === "draft" ? draft : panelId ? blocks.find(b => b.id === panelId) ?? null : null;
  const conflictList = view.filter(b => b.id !== TMP_DRAG && conflictsOf.has(b.id) && b.active !== false);
  const showDays = mode === "day" ? [selectedDay] : [...WEEK_ORDER];
  const colIndex = (d: number) => (mode === "day" ? 0 : WEEK_ORDER.indexOf(d as typeof WEEK_ORDER[number]));
  const visibleBlocks = sorted.filter(b => mode === "week" || b.dayOfWeek === selectedDay);
  const visibleGhosts = ghosts.filter(g => g.active !== false && (mode === "week" || g.dayOfWeek === selectedDay));
  const hours: number[] = []; for (let m = rangeStart; m < rangeEnd; m += 60) hours.push(m);
  const geomStyle = (b: ScheduleBlock, lane = 0, laneN = 1, inset = 2): React.CSSProperties => {
    const top = ((b.startMin - rangeStart) / 60) * pph, h = Math.max(14, ((b.endMin - b.startMin) / 60) * pph - 1);
    const colW = 100 / N, w = colW / laneN;
    return { top, height: h, left: `calc(${colIndex(b.dayOfWeek) * colW + lane * w}% + ${inset}px)`, width: `calc(${w}% - ${inset * 2}px)` };
  };
  const btnSm = "inline-flex items-center justify-center min-h-[var(--kin-cham-toi-thieu)] min-w-[var(--kin-cham-toi-thieu)] px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] enabled:hover:bg-[var(--kin-nen-re-chuot)]";

  return (
    <div ref={rootRef} data-week-editor data-mode={mode} data-dragging={dragging ? "1" : undefined} data-schedule-state="ready"
      role="group" aria-label="Lịch khung giờ hằng tuần, 7 ngày" className="min-w-0"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => cancelDrag()}
      onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target as HTMLElement).closest("input,textarea,select")) { e.preventDefault(); void undo(); } }}>

      <div className="flex flex-wrap items-center gap-2 pb-3">
        {canAdd && <button type="button" data-add-block onClick={addButton} className={kinButtonClass("primary")}>Thêm khung giờ</button>}
        {narrow && (
          <div role="group" aria-label="Kiểu xem" className="inline-flex">
            {(["day", "week"] as const).map(m => (
              <button key={m} type="button" aria-pressed={mode === m} data-view-mode={m} onClick={() => setUserMode(m)}
                className={`${btnSm} ${m === "day" ? "rounded-r-none" : "rounded-l-none -ml-px"} ${mode === m ? "!bg-[var(--kin-nen-nhan)] font-medium !border-[var(--kin-nhan-nen)]" : ""}`}>{m === "day" ? "Ngày" : "Tuần"}</button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setFullDay(v => !v)} aria-pressed={fullDay} className={btnSm}>{fullDay ? "Thu gọn giờ" : "Hiện cả ngày"}</button>
        {undoCount > 0 && <button type="button" data-undo onClick={() => void undo()} className={btnSm}>Hoàn tác</button>}
        <p className="basis-full sm:basis-auto sm:ml-auto text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] tabular-nums" data-weekly-total>
          {activeOwn.length ? `${activeOwn.length} khung · tổng ${formatDuration(weeklyMinutes(blocks))} mỗi tuần` : "Chưa có khung giờ nào"}
        </p>
      </div>

      {activeOwn.length === 0 && (
        <p data-empty-hint className="mb-3 px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] bg-[var(--kin-nen-bang)] border-l-2 border-[var(--kin-tt-chu-cho)] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
          <b className="font-medium">Lớp chưa có lịch học.</b> {canAdd ? "Kéo trên lưới để thêm khung giờ, hoặc bấm Thêm khung giờ." : "Giáo viên bộ môn chỉ xem khung giờ, chủ lớp hoặc đồng giảng đặt giúp."}{emptyNote ? <> {emptyNote}</> : null}
        </p>
      )}

      {mode === "day" && (
        <div className="pb-3">
          <div className="flex items-center justify-between gap-2 pb-2">
            <button type="button" className={btnSm} aria-label="Ngày trước" onClick={() => setSelectedDay(d => WEEK_ORDER[Math.max(0, WEEK_ORDER.indexOf(d as typeof WEEK_ORDER[number]) - 1)])}>‹</button>
            <span className="font-medium text-[var(--kin-chu-chinh)]" aria-live="off" data-day-title>{dayName(selectedDay)}</span>
            <button type="button" className={btnSm} aria-label="Ngày sau" onClick={() => setSelectedDay(d => WEEK_ORDER[Math.min(WEEK_ORDER.length - 1, WEEK_ORDER.indexOf(d as typeof WEEK_ORDER[number]) + 1)])}>›</button>
          </div>
          <div role="group" aria-label="Chọn ngày" className="grid grid-cols-7 gap-0.5">
            {WEEK_ORDER.map(d => (
              <button key={d} type="button" aria-pressed={selectedDay === d} data-pick-day={d} aria-label={`${dayName(d)}, ${countOfDay(d)} khung`} onClick={() => setSelectedDay(d)}
                className={`flex flex-col items-center justify-center min-h-[var(--kin-cham-toi-thieu)] min-w-0 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-small)] leading-4 ${selectedDay === d ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)] font-medium" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)]"} text-[var(--kin-chu-chinh)]`}>
                <span>{dayShort(d)}</span><span className="text-[var(--kin-chu-mo)]">{countOfDay(d)} khung</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto overscroll-x-contain rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)]" data-grid-scroller>
        <div style={{ minWidth: mode === "week" ? GUTTER + N * (narrow ? MIN_COL_NARROW : MIN_COL_WIDE) : undefined, touchAction: "pan-x pan-y" }} className="bg-[var(--kin-nen-trang)] [-webkit-touch-callout:none] select-none">
          {mode === "week" && (
            <div className="flex border-b border-[var(--kin-vien-thuong)]" role="row">
              <div style={{ width: GUTTER }} className="sticky left-0 z-[4] shrink-0 bg-[var(--kin-nen-trang)]" />
              {showDays.map(d => (
                <div key={d} role="columnheader" className="flex-1 min-w-0 py-1.5 text-center text-[length:var(--kin-co-small)] leading-4 text-[var(--kin-chu-chinh)] border-l border-[var(--kin-vien-nhat)]">
                  <div className="font-medium">{dayName(d)}</div>
                  <div className="text-[var(--kin-chu-mo)]">{countOfDay(d)} khung</div>
                </div>
              ))}
            </div>
          )}
          <div className="relative flex" style={{ height: bodyH }}>
            <div aria-hidden style={{ width: GUTTER }} className="sticky left-0 z-[4] shrink-0 bg-[var(--kin-nen-trang)] border-r border-[var(--kin-vien-nhat)]">
              {hours.map(m => (
                <span key={m} className="absolute left-0 w-[44px] pr-1.5 text-right text-[length:var(--kin-co-small)] leading-none text-[var(--kin-chu-mo)] tabular-nums" style={{ top: ((m - rangeStart) / 60) * pph - 6 + (m === rangeStart ? 7 : 0) }}>{hm(m)}</span>
              ))}
            </div>
            <div ref={areaRef} data-grid-area data-range-start={rangeStart} data-pph={pph} className="relative flex-1 min-w-0">
              <div className="absolute inset-0 flex" style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--kin-vien-nhat) 0, var(--kin-vien-nhat) 1px, transparent 1px, transparent ${pph}px)` }}>
                {showDays.map(d => (
                  <div key={d} role="group" aria-label={dayName(d)} data-day-col={d} className="flex-1 min-w-0 border-l border-[var(--kin-vien-nhat)] first:border-l-0 cursor-crosshair" />
                ))}
              </div>
              <div className="absolute inset-0 pointer-events-none">
                {visibleGhosts.map(g => (
                  <div key={`g-${g.id}`} aria-hidden data-ghost className="absolute overflow-hidden rounded-[var(--kin-bo-sm)] border border-dashed border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] px-1 py-0.5 text-[length:var(--kin-co-small)] leading-4 text-[var(--kin-chu-mo)] opacity-80"
                    style={geomStyle(g, 0, 1, 1)}>
                    <span className="block truncate">{g.courseName?.trim() || "Lớp khác"} · lớp khác</span>
                  </div>
                ))}
                {visibleBlocks.map(b => {
                  const ln = lanes[b.id] ?? { lane: 0, lanes: 1 };
                  const st = geomStyle(b, ln.lane, ln.lanes);
                  const h = st.height as number;
                  const conf = conflictsOf.get(b.id);
                  const off = b.active === false, isDraft = !!b.draft, isPrev = preview?.id === b.id;
                  const editable = !(canEdit && !canEdit(b)) && !isDraft;
                  const isBusy = busy.has(b.id);
                  const sel = selectedId === b.id;
                  const tags = [conf && !off ? "Trùng giờ" : null, off ? "Đã tắt" : null, isDraft ? "Chưa lưu" : null].filter(Boolean) as string[];
                  const aria = [describeBlock(b), b.teacherLabel ? `người dạy ${b.teacherLabel}` : null, conf && !off ? conf.map(c => c.text.toLowerCase()).join("; ") : null, off ? "đã tắt" : null, isDraft ? "chưa lưu" : null, isBusy ? "đang lưu" : null].filter(Boolean).join(", ");
                  const pad = Math.max(0, Math.ceil((44 - h) / 2));
                  return (
                    <button key={b.id} type="button" data-block-id={b.id} data-day={b.dayOfWeek} data-start={b.startMin} data-end={b.endMin}
                      data-conflict={conf && !off ? "1" : undefined} data-inactive={off ? "1" : undefined} data-draft={isDraft ? "1" : undefined}
                      aria-label={aria} aria-roledescription="khung giờ" aria-pressed={sel} aria-busy={isBusy || undefined}
                      onClick={() => onBlockClick(b)} onKeyDown={e => onBlockKey(e, b)} onContextMenu={e => e.preventDefault()}
                      onBlur={e => { if (e.relatedTarget && !(e.relatedTarget as HTMLElement).closest?.("[data-block-id]")) focusId.current = null; }}
                      className={`group pointer-events-auto absolute text-left overflow-visible rounded-[var(--kin-bo-sm)] px-1.5 text-[length:var(--kin-co-small)] leading-4 text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--kin-nhan-link)] ${isPrev ? "z-[3] shadow-md" : "z-[2]"} ${editable ? "cursor-grab" : "cursor-pointer"} ${isDraft || (conf && !off) ? "border border-dashed border-[var(--kin-tt-chu-loi)]" : "border border-transparent"}`}
                      style={{
                        ...st,
                        background: off
                          ? `repeating-linear-gradient(135deg, var(--kin-nen-bang) 0 6px, var(--kin-nen-trang) 6px 12px)`
                          : `color-mix(in srgb, ${accent} 18%, var(--kin-nen-trang))`,
                        borderLeft: `3px solid ${off ? "var(--kin-chu-mo)" : accent}`,
                        ...(isPrev ? { opacity: 0.92 } : {}),
                      }}>
                      {pad > 0 && <span aria-hidden className="absolute left-0 right-0" style={{ top: -pad, bottom: -pad }} />}
                      <span className="relative block overflow-hidden h-full pt-0.5">
                        {h >= 40 ? (
                          <>
                            <span className="block truncate font-medium">{nameOf(b)}</span>
                            <span className="block truncate tabular-nums">{hm(b.startMin)}–{hm(b.endMin)}</span>
                            {b.teacherLabel && h >= 56 && <span data-teacher-label className="block truncate text-[var(--kin-chu-mo)]">Dạy: {b.teacherLabel}</span>}
                            {tags.length > 0 && <span className="block truncate font-medium text-[var(--kin-tt-chu-loi)]">{conf && !off ? "⚠ " : ""}{tags.join(" · ")}</span>}
                          </>
                        ) : (
                          <span className="block truncate tabular-nums"><span className="font-medium">{hm(b.startMin)}</span> {nameOf(b)}{tags.length ? ` · ${tags[0]}` : ""}</span>
                        )}
                        {isBusy && <span className="block truncate text-[var(--kin-chu-mo)]">Đang lưu…</span>}
                        {renderBadge?.(b)}
                      </span>
                      {isPrev && (
                        <span aria-hidden data-drag-label className="absolute left-1 -top-7 z-[5] whitespace-nowrap rounded px-1.5 py-0.5 bg-[var(--kin-nen-trang)] border border-[var(--kin-vien-o-nhap)] text-[length:var(--kin-co-small)] tabular-nums text-[var(--kin-chu-chinh)] shadow-sm">
                          {hm(b.startMin)}–{hm(b.endMin)}{conf && !off ? ` · ⚠ ${conf[0].text}` : ""}
                        </span>
                      )}
                      {editable && (["top", "bottom"] as const).map(side => (
                        <span key={side} aria-hidden data-handle={side}
                          className={`absolute left-0 right-0 z-[1] flex items-center justify-center h-3 ${sel ? "[@media(pointer:coarse)]:h-[var(--kin-cham-toi-thieu)]" : "[@media(pointer:coarse)]:hidden"} cursor-ns-resize ${side === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"}`}>
                          <span className={`block h-1 w-8 rounded-full bg-[var(--kin-chu-mo)] ${sel ? "opacity-80" : "opacity-0 group-hover:opacity-60"}`} />
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {conflictList.length > 0 && (
        <ul aria-label="Khung giờ trùng nhau" data-conflict-list className="mt-3 space-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">
          {conflictList.map(b => (
            <li key={b.id}>⚠ <span className="font-medium">{nameOf(b)} {dayName(b.dayOfWeek)} {hm(b.startMin)}–{hm(b.endMin)}:</span> {(conflictsOf.get(b.id) ?? []).map(c => c.text).join("; ")}</li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[length:var(--kin-co-small)] leading-4 text-[var(--kin-chu-mo)]">
        Khung lặp mọi tuần. {!canAdd ? "Bấm khối để xem chi tiết." : narrow ? "Bấm ô trống để thêm khung, bấm khối để sửa; chạm giữ rồi kéo để dời." : "Kéo trên ô trống để thêm khung, kéo khối để dời, kéo mép để đổi độ dài."}{" "}
        Muốn dời một buổi, mở buổi đó ở <Link href="/lop-cua-toi/lich" className="text-[var(--kin-nhan-link)] underline">Lịch dạy</Link> rồi chọn Dời.
      </p>

      {error && (
        <div role="alert" data-schedule-error className="mt-3 flex flex-wrap items-center gap-2 px-[var(--kin-kc-7)] py-[var(--kin-kc-5)] border-l-2 border-[var(--kin-tt-chu-loi)] bg-[var(--kin-nhan-nen-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">
          <span className="min-w-0 flex-1 font-medium break-words">{error.text}</span>
          {error.retry && <button type="button" className={btnSm} onClick={() => error.retry?.()}>Thử lại</button>}
          <button type="button" className={btnSm} onClick={() => setError(null)}>Đóng</button>
        </div>
      )}
      {toast && (
        <div data-undo-toast key={toast.key} className="mt-3 flex flex-wrap items-center gap-2 px-[var(--kin-kc-7)] py-[var(--kin-kc-5)] bg-[var(--kin-nen-bang)] border-l-2 border-[var(--kin-tt-chu-xong)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
          <span className="min-w-0 flex-1 break-words">{toast.text}</span>
          {toast.undo && undoCount > 0 && <button type="button" className={btnSm} onClick={() => void undo()}>Hoàn tác</button>}
        </div>
      )}
      <div aria-live="polite" role="status" className="sr-only" data-live>{live}</div>

      {panelBlock && (
        <BlockPanel key={panelBlock.id} block={panelBlock} others={blocks.filter(b => b.id !== panelBlock.id)} ghosts={ghosts} remote={remote}
          readOnly={!!canEdit && !canEdit(panelBlock)} teacher={teacher} accent={accent} onClose={closePanel}
          onSave={async next => {
            if (panelBlock.draft) { const { draft: _d, ...rest } = next; void _d; return commit({ type: "create", block: { ...rest, draft: false } }, { after: closePanel }); }
            const ops = diffBlocks([panelBlock], [next]);
            if (!ops[0]) { closePanel(); return true; }
            return commit(ops[0], { after: closePanel });
          }}
          onToggle={async () => { const on = panelBlock.active === false; return commit({ type: "update", id: panelBlock.id, patch: { active: on } }, { after: closePanel }); }}
          onRemove={async () => {
            if (panelBlock.draft) { closePanel(); return true; }
            if (remote) {
              const ok = await ask({ title: "Xoá hẳn khung này?", message: "Báo nghỉ và nhắc lịch gắn với khung sẽ không còn nơi tham chiếu. Nếu chỉ muốn tạm nghỉ, hãy chọn Tắt khung.", confirmLabel: "Xoá hẳn", cancelLabel: "Giữ lại", tone: "nguy-hiem" });
              if (!ok) return false;
              return commit({ type: "remove", id: panelBlock.id }, { noUndo: true, after: closePanel });
            }
            return commit({ type: "remove", id: panelBlock.id }, { after: closePanel });
          }} />
      )}

      {conflictAsk && (
        <Modal title="Khung giờ này trùng lịch" labelledBy="sched-conflict-title" onClose={() => setConflictAsk(null)}>
          <div data-conflict-ask>
            <ul className="space-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
              {conflictAsk.conflicts.map((c, i) => <li key={i}>{c.text}</li>)}
            </ul>
            <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Vẫn lưu được, nhưng hai buổi sẽ cùng giờ. Chọn Hoàn lại nếu cô muốn giữ khung như cũ.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <KinButton onClick={() => { const a = conflictAsk; setConflictAsk(null); void commit(a.op, { force: true, after: a.after }); }}>Vẫn lưu</KinButton>
              <button type="button" className={kinButtonClass("secondary")} onClick={() => setConflictAsk(null)}>Hoàn lại</button>
            </div>
          </div>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}

// ── Panel sửa chi tiết ────────────────────────────────────────────────────────

function BlockPanel({ block, others, ghosts, remote, readOnly, teacher, accent, onClose, onSave, onToggle, onRemove }: {
  block: ScheduleBlock; others: ScheduleBlock[]; ghosts: ScheduleBlock[]; remote: boolean; readOnly: boolean; teacher: WeekScheduleEditorProps["teacher"]; accent: string;
  onClose: () => void;
  onSave: (next: ScheduleBlock) => Promise<boolean>; onToggle: () => Promise<boolean>; onRemove: () => Promise<boolean>;
}) {
  const [day, setDay] = useState(block.dayOfWeek);
  const [start, setStart] = useState(block.startMin);
  const [end, setEnd] = useState(block.endMin);
  const [note, setNote] = useState(block.note ?? "");
  const [mode, setMode] = useState<"" | "online" | "offline">(block.mode ?? "");
  const [location, setLocation] = useState(block.location ?? "");
  const [joinUrl, setJoinUrl] = useState(block.joinUrl ?? "");
  const [teacherId, setTeacherId] = useState<string>(block.teacherId ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const field = "w-full min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]";
  const lab = "block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]";
  const step = "inline-flex items-center justify-center min-h-[var(--kin-cham-toi-thieu)] min-w-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] enabled:hover:bg-[var(--kin-nen-re-chuot)]";
  const formBlock: ScheduleBlock = { ...block, dayOfWeek: day, startMin: start, endMin: end };
  const conflicts = end > start ? findConflicts(formBlock, others, ghosts) : [];
  const move = (which: "s" | "e", d: number) => {
    if (which === "s") setStart(v => Math.max(0, Math.min(end - SNAP_MIN, v + d)));
    else setEnd(v => Math.min(DAY_END_MIN, Math.max(start + SNAP_MIN, v + d)));
  };
  const inactive = block.active === false;

  async function save(e: React.SyntheticEvent) {
    e.preventDefault();
    if (readOnly || saving) return;
    if (end <= start) { setErr("Giờ kết thúc phải sau giờ bắt đầu."); return; }
    if (note.length > NOTE_MAX) { setErr(`Ghi chú tối đa ${NOTE_MAX} ký tự.`); return; }
    const url = joinUrl.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) { setErr("Link vào lớp phải bắt đầu bằng http:// hoặc https://."); return; }
    setErr(null); setSaving(true);
    const ok = await onSave({ ...block, dayOfWeek: day, startMin: start, endMin: end, note: note.trim() || null, ...(teacher?.mode === "select" ? { teacherId: teacherId || null } : {}), mode: mode || null, location: mode === "offline" ? location.trim() || null : null, joinUrl: url || null });
    setSaving(false);
    void ok;
  }

  return (
    <Modal title={block.draft ? "Thêm khung giờ" : "Sửa khung giờ"} labelledBy="sched-panel-title" onClose={onClose}>
      {/* div chứ không phải <form>: panel còn nằm trong form của wizard tạo lớp, form lồng form là lỗi HTML. */}
      <div data-block-panel className="space-y-3"
        onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") void save(e); }}>
        <p aria-hidden className="h-1 rounded" style={{ background: accent }} />
        <label className={lab}>Thứ
          <select value={day} disabled={readOnly} onChange={e => setDay(Number(e.target.value))} className={`${field} mt-1`}>
            {WEEK_ORDER.map(d => <option key={d} value={d}>{dayName(d)}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {([["s", "Bắt đầu", start, setStart], ["e", "Kết thúc", end, setEnd]] as const).map(([k, title, val, setVal]) => (
            <div key={k}>
              <label className={lab} htmlFor={`sched-${k}`}>{title}</label>
              <select id={`sched-${k}`} value={val} disabled={readOnly} onChange={e => setVal(Number(e.target.value))} className={`${field} mt-1`}>
                {HM_OPTIONS.filter(m => (k === "s" ? m < DAY_END_MIN : m > 0)).map(m => <option key={m} value={m}>{hm(m)}</option>)}
              </select>
              {!readOnly && (
                <div className="mt-1 flex gap-1">
                  <button type="button" className={step} aria-label={`${title} lùi 15 phút`} onClick={() => move(k, -SNAP_MIN)}>−15</button>
                  <button type="button" className={step} aria-label={`${title} thêm 15 phút`} onClick={() => move(k, SNAP_MIN)}>+15</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {end <= start && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">Giờ kết thúc phải sau giờ bắt đầu.</p>}
        {conflicts.length > 0 && (
          <ul role="status" data-panel-conflicts className="space-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">
            {conflicts.map(c => <li key={c.otherId}>⚠ {c.text}</li>)}
          </ul>
        )}
        <label className={lab}>Tên hoặc ghi chú của khung
          <input value={note} maxLength={NOTE_MAX} disabled={readOnly} onChange={e => setNote(e.target.value)} className={`${field} mt-1`} placeholder="Ví dụ: Toán 9 nhóm sáng" autoComplete="off" />
          <span className="block text-right text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)] tabular-nums">{note.length}/{NOTE_MAX}</span>
        </label>
        {teacher?.mode === "select" && (
          <label className={lab}>Người dạy
            <select value={teacherId} disabled={readOnly} onChange={e => setTeacherId(e.target.value)} className={`${field} mt-1`} data-teacher-select>
              <option value="">Chủ lớp</option>
              {block.teacherId && !teacher.options.some(o => o.id === block.teacherId) && <option value={block.teacherId}>Giáo viên đã rời lớp</option>}
              {teacher.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}
        {teacher?.mode === "text" && (
          <p data-teacher-text className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Người dạy: <b className="font-medium">{block.draft ? "bạn" : block.teacherLabel ?? "chủ lớp"}</b></p>
        )}
        <label className={lab}>Hình thức
          <select value={mode} disabled={readOnly} onChange={e => setMode(e.target.value as "" | "online" | "offline")} className={`${field} mt-1`}>
            <option value="">Chưa chọn</option><option value="online">Trực tuyến</option><option value="offline">Trực tiếp</option>
          </select>
        </label>
        {mode === "offline" && (
          <label className={lab}>Địa chỉ
            <input value={location} disabled={readOnly} onChange={e => setLocation(e.target.value)} className={`${field} mt-1`} autoComplete="off" />
          </label>
        )}
        <label className={lab}>Link vào lớp
          <input value={joinUrl} disabled={readOnly} onChange={e => setJoinUrl(e.target.value)} className={`${field} mt-1`} placeholder="https://…" inputMode="url" autoComplete="off" />
        </label>
        <p className="text-[length:var(--kin-co-small)] leading-4 text-[var(--kin-chu-mo)]" data-repeat-note>
          Khung này lặp <b>mọi tuần</b>, áp dụng cho cả lớp. Muốn dời một buổi, mở buổi đó ở Lịch dạy rồi chọn Dời. KiN không tự báo học sinh khi cô đổi giờ khung.
        </p>
        {err && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
        {readOnly && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Khung này do giáo viên khác đặt, cô chỉ xem được.</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {!readOnly && <KinButton type="button" onClick={e => void save(e)} loading={saving} loadingLabel="Đang lưu…">{block.draft ? "Lưu khung giờ" : "Lưu"}</KinButton>}
          <button type="button" className={kinButtonClass("secondary")} onClick={onClose}>{block.draft ? "Bỏ" : "Đóng"}</button>
        </div>
        {!readOnly && !block.draft && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--kin-vien-nhat)] pt-3">
            {remote && <button type="button" className={kinButtonClass("secondary")} onClick={() => void onToggle()}>{inactive ? "Bật lại khung" : "Tắt khung"}</button>}
            <button type="button" className={kinButtonClass("danger")} onClick={() => void onRemove()}>{remote ? "Xoá hẳn…" : "Bỏ khung giờ này"}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Dùng ở nơi cần áp thao tác lạc quan lên mảng (TaoLop, LichKhung). */
export { applyOp };
