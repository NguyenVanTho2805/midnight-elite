// Chọn nhiều + hành động hàng loạt có HOÀN TÁC trễ 5 giây (BU-08 mục 5.3).
// Không có route hàng loạt mới: hết 5 giây thì gọi TỪNG API duyệt có sẵn (song song ≤ 3), mỗi cuộc gọi tự ghi nhật ký.
// Hoàn tác = huỷ trước khi gửi (không có cuộc gọi nào). Gửi xong thì không hoàn tác được.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueueAction, QueueItem } from "@/lib/adminQueue";

export const BULK_MAX = 25;
export const UNDO_SECONDS = 5;
const PARALLEL = 3;

export interface BulkCommand { key: QueueAction["key"]; label: string; kind: QueueAction["kind"] }
export type BulkState =
  | { phase: "idle" }
  | { phase: "undo"; cmd: BulkCommand; ids: string[]; left: number }
  | { phase: "run"; cmd: BulkCommand; ids: string[] };

/** Lệnh hàng loạt dùng chung được cho tập đang chọn; `reason` nói vì sao không có lệnh. */
export function bulkCommands(selected: QueueItem[]): { commands: BulkCommand[]; reason: string | null } {
  if (selected.length === 0) return { commands: [], reason: null };
  if (new Set(selected.map(i => i.kind)).size > 1) return { commands: [], reason: "Chọn cùng một loại để xử lý hàng loạt" };
  if (selected.length > BULK_MAX) return { commands: [], reason: `Chọn tối đa ${BULK_MAX} dòng mỗi lần` };
  let keys = selected[0].bulk ?? [];
  for (const i of selected.slice(1)) keys = keys.filter(k => (i.bulk ?? []).includes(k));
  const commands: BulkCommand[] = [];
  for (const k of keys) {
    const acts = selected.map(i => i.detail.actions.find(a => a.key === k));
    // Lệnh cần lý do hoặc đang khoá thì không bao giờ làm hàng loạt.
    if (acts.some(a => !a || a.reason || a.disabled)) continue;
    commands.push({ key: k, label: acts[0]!.label, kind: acts[0]!.kind });
  }
  return { commands, reason: commands.length === 0 ? "Loại này chỉ xử lý từng dòng" : null };
}

export interface BulkResult { done: number; conflict: number; failed: number; total: number }

async function callAction(a: QueueAction): Promise<"ok" | "conflict" | "fail"> {
  try {
    const r = await fetch(a.url, { method: a.method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a.body ?? {}) });
    if (r.ok) return "ok";
    return r.status === 409 ? "conflict" : "fail";
  } catch { return "fail"; }
}

export function useBulk(items: QueueItem[], onDone: (doneIds: string[], res: BulkResult) => void) {
  const [picked, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<BulkState>({ phase: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const onDoneRef = useRef(onDone);
  useEffect(() => { itemsRef.current = items; onDoneRef.current = onDone; });

  // Chỉ tính lựa chọn của dòng còn trong danh sách (dòng đã biến mất tự rơi khỏi tập chọn).
  const selected = useMemo(() => {
    const ids = new Set(items.map(i => i.id));
    return new Set([...picked].filter(id => ids.has(id)));
  }, [items, picked]);

  const chosen = useMemo(() => items.filter(i => selected.has(i.id)), [items, selected]);
  const { commands, reason } = useMemo(() => bulkCommands(chosen), [chosen]);

  const toggle = useCallback((id: string, on: boolean) => setSelected(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; }), []);
  /** "Chọn tất cả" CHỈ chọn các dòng đang hiện của trang. */
  const toggleAll = useCallback((on: boolean) => setSelected(on ? new Set(itemsRef.current.map(i => i.id)) : new Set()), []);
  const clear = useCallback(() => { setSelected(new Set()); setMessage(null); }, []);

  const run = useCallback(async (cmd: BulkCommand, ids: string[]) => {
    setState({ phase: "run", cmd, ids });
    const todo = ids.map(id => itemsRef.current.find(i => i.id === id)).filter((i): i is QueueItem => !!i);
    const doneIds: string[] = []; const res: BulkResult = { done: 0, conflict: 0, failed: 0, total: todo.length };
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const item = todo[next++]; const a = item.detail.actions.find(x => x.key === cmd.key);
        if (!a) { res.failed++; continue; }
        const out = await callAction(a);
        if (out === "ok") { res.done++; doneIds.push(item.id); }
        else if (out === "conflict") { res.conflict++; doneIds.push(item.id); } // 409 = đã có người xử lý: coi như xong
        else res.failed++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, worker));
    setState({ phase: "idle" });
    setSelected(prev => new Set([...prev].filter(id => !doneIds.includes(id))));
    const parts = [`Đã xử lý ${res.done + res.conflict}/${res.total}`];
    if (res.conflict) parts.push(`${res.conflict} dòng đã có người xử lý`);
    if (res.failed) parts.push(`${res.failed} dòng chưa xử lý được, thử lại`);
    setMessage(`${parts.join("; ")}. Việc đã gửi không hoàn tác được.`);
    onDoneRef.current(doneIds, res);
  }, []);

  const start = useCallback((cmd: BulkCommand) => {
    setMessage(null);
    setState({ phase: "undo", cmd, ids: chosen.map(i => i.id), left: UNDO_SECONDS });
  }, [chosen]);
  const undo = useCallback(() => { setState({ phase: "idle" }); setMessage("Đã hoàn tác, chưa gửi gì."); }, []);

  // Đếm ngược; hết giờ thì gửi.
  useEffect(() => {
    if (state.phase !== "undo") return;
    const t = setTimeout(() => {
      if (state.left <= 1) void run(state.cmd, state.ids);
      else setState({ ...state, left: state.left - 1 });
    }, 1000);
    return () => clearTimeout(t);
  }, [state, run]);

  return { selected, chosen, commands, reason, state, message, toggle, toggleAll, clear, start, undo };
}
