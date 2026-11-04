// Hàng đợi lưu đáp án + chip "Đã lưu / Chưa lưu được" (BU-04 mục 5.2). Luật hàng đợi nằm ở `@/lib/examRoomLib` (thuần, có test); ở đây chỉ nối với mạng và localStorage.
// Đáp án luôn hiện đã chọn trên màn; việc lưu chạy nền. Mất mạng → giữ trong hàng đợi (localStorage `kin.room.queue.<attemptId>`), thử lại lùi mũi 1s/2s/4s/8s trần 15s
// và khi có mạng / quay lại tab. Mỗi câu chỉ giữ BẢN CUỐI. Hết giờ / bài đã kết thúc do MÁY CHỦ quyết (409) → báo cho trang chuyển màn, không coi là lỗi mạng.
import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftState } from "@/lib/quizRoom";
import { examRoomApi, type SaveAnswerBody } from "@/lib/examRoomApi";
import { backoffMs, chipLabel, classifySaveFailure, enqueue as enqueueAnswer, initialSaveState, markFailed, markRejected, markSaved, parseQueue, retryRejected, serializeQueue, type SaveState } from "@/lib/examRoomLib";
import { queueStorageKey } from "./roomLogic";

export interface SaveQueueHooks { onClock: (serverNow: string | null, expiresAt: string | null) => void; onEnded: () => void }
export interface ChipView { status: SaveState["status"]; label: string }

const stamp = (iso: string | null) => new Date(iso && Number.isFinite(Date.parse(iso)) ? iso : Date.now()).toLocaleTimeString("vi-VN", { hour12: false });

export function useSaveQueue(attemptId: string | null, hooks: SaveQueueHooks) {
  const [st, setSt] = useState<SaveState>(initialSaveState);
  const [textStatus, setTextStatus] = useState<Record<string, DraftState>>({});
  const ref = useRef<SaveState>(st);
  /** Vòng gửi đang chạy (nếu có): người gọi `flush()` trong lúc đang gửi dở nhận lại CHÍNH promise này để chờ hết vòng (kể cả phần bổ sung đến muộn). */
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(attemptId);
  const hk = useRef(hooks);
  useEffect(() => { hk.current = hooks; });
  const retryFlush = useRef<() => Promise<void>>(() => Promise.resolve()); // hẹn thử lại gọi qua ref: một useCallback không được tự tham chiếu chính nó

  const commit = useCallback((n: SaveState) => {
    ref.current = n; setSt(n);
    const id = idRef.current;
    if (id) try { window.localStorage.setItem(queueStorageKey(id), serializeQueue(n.queue)); } catch { /* chế độ riêng tư: chấp nhận */ }
  }, []);
  const setText = (b: SaveAnswerBody, s: DraftState) => { if (b.kind === "text") setTextStatus(m => ({ ...m, [b.questionId]: s })); };

  const flush = useCallback((): Promise<void> => {
    const id = idRef.current;
    if (!id) return Promise.resolve();
    // BU-04 rà soát: trước đây trả về NGAY khi đang gửi dở → nộp bài / "Kiểm tra câu này" chạy khi đáp án cuối chưa kịp lên máy chủ (mất đáp án, chấm đáp án cũ).
    if (running.current) { again.current = true; return running.current; }
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = (async () => {
      do {
        again.current = false;
        while (ref.current.queue.length > 0) {
          if (idRef.current !== id) return;
          const item = ref.current.queue[0];
          commit({ ...ref.current, status: "saving" });
          setText(item.body, { kind: "saving" });
          const r = await examRoomApi.saveAnswer(id, item.body);
          if (r.ok) {
            commit(markSaved(ref.current, item.key, item.seq, r.data.savedAt ?? r.data.serverNow ?? new Date().toISOString()));
            hk.current.onClock(r.data.serverNow ?? null, r.data.expiresAt ?? null);
            setText(item.body, { kind: "saved", at: stamp(r.data.savedAt ?? r.data.serverNow ?? null) });
            continue;
          }
          const kind = classifySaveFailure(r.status, r.code);
          if (kind === "time_up") { commit({ ...ref.current, queue: [], rejected: [], status: "idle" }); hk.current.onEnded(); return; }
          // 5A (quyết định của Thọ 04/11/2026): máy chủ TỪ CHỐI (4xx, vd. Phần đã khoá) — không thử lại tự động (vô ích, sẽ lặp mãi) nhưng cũng KHÔNG bỏ im lặng: trước đây chip vẫn báo "Đã lưu"
          // dù đáp án chưa lên máy chủ. Nay chip → "Chưa lưu được · N câu" kèm nút "Thử lại" (retry); em đổi đáp án câu đó thì bản bị từ chối được thay.
          if (kind === "drop") { commit(markRejected(ref.current, item.key, item.seq)); setText(item.body, { kind: "failed" }); continue; }
          setText(item.body, { kind: "failed" });
          commit(markFailed(ref.current));
          timer.current = setTimeout(() => { void retryFlush.current(); }, backoffMs(ref.current.retries - 1));
          return;
        }
      } while (again.current);
    })().finally(() => { running.current = null; });
    running.current = p;
    return p;
  }, [commit]);

  useEffect(() => { retryFlush.current = flush; }, [flush]);

  /** Số câu còn trong hàng đợi (đang gửi / chờ thử lại). Đáp án bị máy chủ từ chối (4xx) KHÔNG tính ở đây — thử lại tự động vô ích và không được chặn nộp bài; chip vẫn báo "Chưa lưu được". */
  const pending = useCallback((): number => ref.current.queue.length, []);

  const enqueue = useCallback((body: SaveAnswerBody, delayMs = 0) => {
    commit(enqueueAnswer(ref.current, body));
    setText(body, { kind: "saving" });
    if (delayMs <= 0) { void flush(); return; }
    // gõ chữ: chờ em ngừng gõ rồi mới gửi (bản chưa gửi vẫn nằm trong localStorage)
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, delayMs);
  }, [commit, flush]);

  /** Nạp hàng đợi còn sót của lượt này (lần trước mất mạng / đóng tab). Trả các mục để trang phủ lên câu trả lời đang hiện. */
  const adopt = useCallback((id: string): SaveAnswerBody[] => {
    idRef.current = id; setTextStatus({});
    let stored: ReturnType<typeof parseQueue> = [];
    try { stored = parseQueue(window.localStorage.getItem(queueStorageKey(id))); } catch { /* bỏ qua */ }
    const base = initialSaveState();
    commit(stored.length > 0 ? { ...base, queue: stored, seq: Math.max(...stored.map(q => q.seq)), status: "failed" } : base);
    if (stored.length > 0) void flush();
    return stored.map(q => q.body);
  }, [commit, flush]);

  /** Nút "Thử lại" ở chip: đưa đáp án bị từ chối (4xx) về hàng đợi rồi gửi lại cùng với phần còn lại. */
  const retry = useCallback((): Promise<void> => {
    for (const r of ref.current.rejected) setText(r.body, { kind: "saving" });
    commit(retryRejected(ref.current));
    return flush();
  }, [commit, flush]);

  const clearStored = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    commit(initialSaveState());
    try { if (idRef.current) window.localStorage.removeItem(queueStorageKey(idRef.current)); } catch { /* bỏ qua */ }
  }, [commit]);

  useEffect(() => {
    if (!attemptId) return;
    const kick = () => { if (ref.current.queue.length > 0) void flush(); };
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", kick); // rời tab: đẩy ngay phần chưa gửi; quay lại: thử lại
    return () => { window.removeEventListener("online", kick); document.removeEventListener("visibilitychange", kick); };
  }, [attemptId, flush]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const chip: ChipView = { status: st.status, label: chipLabel(st).replace(/ · Thử lại$/, "") };
  return { chip, textStatus, enqueue, flush, retry, pending, adopt, clearStored };
}
