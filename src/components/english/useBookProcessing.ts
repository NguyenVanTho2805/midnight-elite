// Gọi /process lặp lại tới khi sách "ready" (mỗi lần máy chủ làm một phần nhỏ để không quá thời gian).
"use client";
import { useCallback, useRef, useState } from "react";
import { api } from "./ui";

export interface ProcState { status: string; unitsDone?: number; unitsTotal?: number; statusNote?: string | null }

export function useBookProcessing(onTick?: () => void) {
  const [state, setState] = useState<ProcState | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  const run = useCallback(async (bookId: string) => {
    stop.current = false; setRunning(true); setError(null);
    let fails = 0;
    try {
      for (let guard = 0; guard < 600 && !stop.current; guard++) {
        try {
          const s = await api<ProcState & { busy?: boolean }>(`/api/english/books/${bookId}/process`, { body: {} });
          fails = 0;
          setState(s); onTick?.();
          if (s.status === "ready" || s.status === "error") break;
          if (s.busy) await new Promise(r => setTimeout(r, 2500));
        } catch (e) {
          fails++;
          if (fails >= 3) { setError((e as Error).message); break; }
          await new Promise(r => setTimeout(r, 3000 * fails));
        }
      }
    } finally { setRunning(false); }
  }, [onTick]);

  return { state, running, error, run, cancel: () => { stop.current = true; } };
}
