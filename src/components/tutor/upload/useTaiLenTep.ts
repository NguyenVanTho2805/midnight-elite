// GS-LOP-GON — hàng đợi tải TỆP TÀI LIỆU dùng chung (cắt từ giao-trinh/OTaiLen.tsx, hành vi giữ nguyên):
//   kiểm ở trình duyệt (routeInput: đuôi, dung lượng, hạn mức, VIDEO bị chặn) → init → gửi byte có tiến trình → complete → onUploaded(link, tên).
// Tối đa MAX_PARALLEL tệp cùng lúc, huỷ / thử lại / đóng từng tệp. Chỉ đọc khối config.document; KHÔNG BAO GIỜ đọc config.video (video chỉ là link YouTube).
// Phần cam kết bản quyền, chọn mục đích, đăng ngay… ở nơi dùng hook (qua pledge + onUploaded).
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { routeInput, type GtConfig } from "@/lib/giaoTrinh";
import { postJson, sendWithProgress } from "./sendWithProgress";

export const MAX_PARALLEL = 2;

export type TaiLenState = "wait" | "up" | "done" | "err";
export interface TaiLenEntry { id: number; file: File; pct: number; state: TaiLenState; message: string | null }

/** Kết quả nơi dùng báo về sau khi tệp lên xong: ok=false thì hàng báo lỗi bằng `error`. */
export interface UploadedResult { ok: boolean; error?: string }
export type OnUploaded = (link: string, name: string, meta: { assetId: string }) => Promise<UploadedResult> | UploadedResult;

export interface UseTaiLenTepOptions {
  courseId: string;
  config: GtConfig;
  /** Đã tích cam kết bản quyền chưa. Chưa tích ⇒ enqueue không gửi gì, trả needPledge. */
  pledge: boolean;
  onUploaded: OnUploaded;
}

export function useTaiLenTep({ courseId, config, pledge, onUploaded }: UseTaiLenTepOptions) {
  const [queue, setQueue] = useState<TaiLenEntry[]>([]);
  const files = useRef(new Map<number, File>());
  const aborts = useRef(new Map<number, () => void>());
  const nextId = useRef(1);
  const live = useRef(true);
  const started = useRef(new Set<number>());
  const cb = useRef(onUploaded);
  useEffect(() => { cb.current = onUploaded; });
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const patch = useCallback((id: number, p: Partial<TaiLenEntry>) => { if (live.current) setQueue(prev => prev.map(e => (e.id === id ? { ...e, ...p } : e))); }, []);

  /** Đưa tệp vào hàng. Tệp sai (đuôi, cỡ, video…) thành hàng lỗi tại chỗ, KHÔNG có yêu cầu mạng. */
  function enqueue(list: FileList | File[]): { needPledge: boolean; added: number } {
    const arr = Array.from(list);
    if (!arr.length) return { needPledge: false, added: 0 };
    const added: TaiLenEntry[] = [];
    let needPledge = false;
    for (const f of arr) {
      const rec = routeInput({ file: { name: f.name, size: f.size, type: f.type } }, config);
      const id = nextId.current++;
      if (!rec.ok) { files.current.set(id, f); added.push({ id, file: f, pct: 0, state: "err", message: rec.error }); continue; }
      if (!pledge) { needPledge = true; continue; }
      files.current.set(id, f);
      added.push({ id, file: f, pct: 0, state: "wait", message: null });
    }
    if (added.length) setQueue(prev => [...prev, ...added]);
    return { needPledge, added: added.length };
  }

  const runOne = useCallback(async (e: TaiLenEntry) => {
    const file = files.current.get(e.id);
    if (!file) return;
    const onDone = cb.current; // lấy lúc BẮT ĐẦU tải (như bản cũ: chọn "đăng ngay"/"gắn vào" theo lúc tệp bắt đầu lên)
    const fail = (message: string) => patch(e.id, { state: "err", message });
    patch(e.id, { state: "up", pct: 0, message: null });
    try {
      const init = await postJson("/api/media/document/init", { courseId, fileName: file.name, size: file.size, mimeType: file.type, confirmedNotice: true });
      if (!init.ok) { fail((init.json.error as string) ?? (init.status === 0 ? "Mất kết nối. Hãy thử lại." : "Chưa tải được. Hãy thử lại.")); return; }
      const up = init.json.upload as { method?: "PUT" | "POST"; url: string; fields?: Record<string, string> };
      const driver = init.json.driver as string;
      const method: "PUT" | "POST" = up.method ?? (driver === "local" ? "PUT" : "POST");
      const pr = await sendWithProgress(method, up.url, file, up.fields, p => patch(e.id, { pct: p }), f => aborts.current.set(e.id, f));
      aborts.current.delete(e.id);
      if (pr.aborted) { patch(e.id, { state: "err", message: "Đã huỷ." }); return; }
      if (!pr.ok) { fail((pr.body.error as string) ?? (pr.status === 0 ? "Mất kết nối khi đang tải. Hãy thử lại." : "Kho từ chối tệp này. Hãy thử lại.")); return; }
      const cr = await postJson("/api/media/document/complete", { assetId: init.json.assetId });
      if (!cr.ok) { fail((cr.json.error as string) ?? "Chưa chốt được tệp. Hãy thử lại."); return; }
      const link = (cr.json.link as string) ?? (init.json.link as string);
      const name = (cr.json.name as string) ?? file.name;
      const assetId = (cr.json.assetId as string) ?? (init.json.assetId as string);
      const r = await onDone(link, name, { assetId });
      if (r.ok) patch(e.id, { state: "done", pct: 100, message: null });
      else patch(e.id, { state: "err", message: r.error ?? "Chưa thêm được." });
    } catch { fail("Mất kết nối. Hãy thử lại."); }
  }, [courseId, patch]);

  // Bơm hàng đợi: tối đa MAX_PARALLEL tệp cùng lúc
  useEffect(() => {
    const running = queue.filter(e => e.state === "up").length;
    const waiting = queue.filter(e => e.state === "wait");
    for (const e of waiting.slice(0, Math.max(0, MAX_PARALLEL - running))) { if (started.current.has(e.id)) continue; started.current.add(e.id); patch(e.id, { state: "up" }); void runOne(e); }
  }, [queue, patch, runOne]);

  function cancel(id: number) {
    const abort = aborts.current.get(id);
    if (abort) abort();
    else patch(id, { state: "err", message: "Đã huỷ." });
  }
  function retry(id: number) { started.current.delete(id); patch(id, { state: "wait", pct: 0, message: null }); }
  function dismiss(id: number) { files.current.delete(id); setQueue(prev => prev.filter(e => e.id !== id)); }
  /** Bỏ hết hàng (khi đóng ngăn). Tệp đang gửi bị huỷ. */
  function clear() { aborts.current.forEach(a => a()); aborts.current.clear(); files.current.clear(); started.current.clear(); setQueue([]); }

  const busy = queue.some(e => e.state === "up" || e.state === "wait");
  return { queue, enqueue, cancel, retry, dismiss, clear, busy };
}

/** Nút "Thử lại" chỉ có nghĩa với lỗi mạng / kho, không với tệp sai đuôi / cỡ / đã huỷ (giống OTaiLen cũ). */
export function canRetryEntry(e: TaiLenEntry): boolean {
  return e.state === "err" && !!e.message && !/^Đã huỷ/.test(e.message) && !/loại|đuôi|vượt giới hạn|rỗng|không nhận/i.test(e.message);
}
