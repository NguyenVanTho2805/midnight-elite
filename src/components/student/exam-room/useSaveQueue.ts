// Hàng đợi lưu đáp án + chip "Đã lưu / Chưa lưu được" (BU-04 mục 5.2).
// Đáp án luôn hiện đã chọn trên màn; việc lưu chạy nền. Mất mạng → giữ trong hàng đợi (localStorage), thử lại lùi mũi và khi có mạng / quay lại tab.
// Mỗi câu chỉ giữ BẢN CUỐI (không phát lại bản cũ). Hết giờ / bài đã kết thúc do MÁY CHỦ quyết (409) → báo cho trang chuyển màn, không coi là lỗi mạng.
import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftState } from "@/lib/quizRoom";
import { saveAnswer, type SavePayload } from "./roomApi";
import { backoffMs, pendingQuestionCount, queueKey, queueStorageKey, type QueueItem, type SaveChip } from "./roomLogic";

const stamp = (iso: string | null) => new Date(iso && Number.isFinite(Date.parse(iso)) ? iso : Date.now()).toLocaleTimeString("vi-VN", { hour12: false });

function readStored(attemptId: string): QueueItem[] {
  try {
    const raw = window.localStorage.getItem(queueStorageKey(attemptId));
    const arr = raw ? (JSON.parse(raw) as QueueItem[]) : [];
    return Array.isArray(arr) ? arr.filter(i => i && typeof i.key === "string" && i.payload) : [];
  } catch { return []; }
}

export interface SaveQueueHooks { onClock: (serverNow: string | null, expiresAt: string | null) => void; onEnded: () => void }

export function useSaveQueue(attemptId: string | null, hooks: SaveQueueHooks) {
  const [chip, setChip] = useState<SaveChip>({ kind: "idle" });
  const [textStatus, setTextStatus] = useState<Record<string, DraftState>>({});
  const queue = useRef(new Map<string, QueueItem>());
  const seq = useRef(0);
  const busy = useRef(false);
  const again = useRef(false);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(attemptId);
  const hk = useRef(hooks);
  useEffect(() => { hk.current = hooks; });

  const persist = useCallback(() => {
    const id = idRef.current;
    if (!id) return;
    try { window.localStorage.setItem(queueStorageKey(id), JSON.stringify([...queue.current.values()])); } catch { /* chế độ riêng tư: chấp nhận */ }
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    const id = idRef.current;
    if (!id) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    try {
      do {
        again.current = false;
        for (const item of [...queue.current.values()]) {
          if (idRef.current !== id) return;
          const p = item.payload;
          setChip({ kind: "saving" });
          if (p.kind === "text") setTextStatus(s => ({ ...s, [p.questionId]: { kind: "saving" } }));
          const r = await saveAnswer(id, p);
          if (r.ok) {
            failures.current = 0;
            if (queue.current.get(item.key)?.v === item.v) queue.current.delete(item.key);
            persist();
            hk.current.onClock(r.serverNow, r.expiresAt);
            if (p.kind === "text") setTextStatus(s => ({ ...s, [p.questionId]: { kind: "saved", at: stamp(r.savedAt ?? r.serverNow) } }));
            setChip(queue.current.size === 0 ? { kind: "saved", at: stamp(r.savedAt ?? r.serverNow) } : { kind: "saving" });
          } else if (r.code === "expired" || r.code === "finished") {
            queue.current.clear(); persist(); hk.current.onEnded(); return;
          } else if (r.code === "section_locked") {
            queue.current.delete(item.key); persist(); // Phần đã khoá: máy chủ không nhận nữa, giữ lại chỉ làm chip đỏ mãi
            if (p.kind === "text") setTextStatus(s => ({ ...s, [p.questionId]: { kind: "idle" } }));
          } else {
            if (p.kind === "text") setTextStatus(s => ({ ...s, [p.questionId]: { kind: "failed" } }));
            setChip({ kind: "failed", count: pendingQuestionCount(queue.current.values()) });
            retryTimer.current = setTimeout(() => { void flush(); }, backoffMs(failures.current++));
            return;
          }
        }
      } while (again.current);
    } finally { busy.current = false; }
  }, [persist]);

  const enqueue = useCallback((payload: SavePayload, delayMs = 0) => {
    const key = queueKey(payload);
    queue.current.set(key, { key, v: ++seq.current, payload });
    persist();
    if (payload.kind === "text") setTextStatus(s => ({ ...s, [payload.questionId]: { kind: "saving" } }));
    if (delayMs <= 0) { void flush(); return; }
    // gõ chữ: chờ em ngừng gõ rồi mới gửi (bản chưa gửi vẫn nằm trong localStorage)
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => { void flush(); }, delayMs);
  }, [persist, flush]);

  /** Nạp hàng đợi còn sót của lượt này (lần trước mất mạng / đóng tab). Trả các mục để trang phủ lên câu trả lời đang hiện. */
  const adopt = useCallback((id: string): QueueItem[] => {
    idRef.current = id; queue.current.clear(); failures.current = 0; setChip({ kind: "idle" }); setTextStatus({});
    const stored = readStored(id);
    stored.forEach(i => { queue.current.set(i.key, i); seq.current = Math.max(seq.current, i.v); });
    if (stored.length > 0) { setChip({ kind: "failed", count: pendingQuestionCount(stored) }); void flush(); }
    return stored;
  }, [flush]);

  const clearStored = useCallback(() => {
    const id = idRef.current;
    queue.current.clear();
    if (retryTimer.current) clearTimeout(retryTimer.current);
    try { if (id) window.localStorage.removeItem(queueStorageKey(id)); } catch { /* bỏ qua */ }
  }, []);

  useEffect(() => {
    if (!attemptId) return;
    const kick = () => { if (queue.current.size > 0) void flush(); };
    const vis = kick; // rời tab: đẩy ngay phần chưa gửi; quay lại: thử lại
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("online", kick); document.removeEventListener("visibilitychange", vis); };
  }, [attemptId, flush]);
  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current); }, []);

  return { chip, textStatus, enqueue, flush, adopt, clearStored, hasPending: () => queue.current.size > 0 };
}
