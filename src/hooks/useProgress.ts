"use client";
import { useState, useEffect, useCallback } from "react";

export function useProgress() {
  const [completedIds,      setCompleted]      = useState<Set<string>>(new Set());
  const [courseCompletion,  setCourseCompletion] = useState<Record<string, number>>({});
  const [loading,           setLoading]         = useState(true);
  // MD-06: "đang xem dở" tách khỏi "đã xong". positions = giây xem gần nhất của mọi bài đã từng xem (để xem tiếp).
  const [watching,          setWatching]        = useState<Record<string, number>>({});
  const [positions,         setPositions]       = useState<Record<string, number>>({});
  // SCL5: lỗi tải tiến độ là LỖI, không phải "chưa học bài nào" — màn đọc `error` để ẩn số 0/N và trạng thái từng bài (t-no-fabricated).
  const [error,             setError]           = useState(false);
  const [tick,              setTick]            = useState(0);

  useEffect(() => {
    if (tick > 0) void Promise.resolve().then(() => { setLoading(true); setError(false); }); // thử lại
    fetch("/api/progress", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => {
        setCompleted(new Set(data.completedIds ?? []));
        setCourseCompletion(data.byCourse ?? {});
        setWatching(data.watching ?? {});
        setPositions(data.positions ?? {});
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);

  const markComplete = useCallback(async (lessonId: string) => {
    const res  = await fetch(`/api/progress/${lessonId}`, { method: "POST", credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    setCompleted(prev => new Set([...prev, lessonId]));
    setWatching(prev => { if (!(lessonId in prev)) return prev; const n = { ...prev }; delete n[lessonId]; return n; });
    if (data.coinsEarned > 0) {
      window.dispatchEvent(new CustomEvent("coin:earned", { detail: { amount: data.coinsEarned } }));
    }
  }, []);

  const unmarkComplete = useCallback(async (lessonId: string) => {
    await fetch(`/api/progress/${lessonId}`, { method: "DELETE", credentials: "same-origin" });
    setCompleted(prev => { const n = new Set(prev); n.delete(lessonId); return n; });
  }, []);

  return { completedIds, courseCompletion, loading, error, reload, watching, positions, markComplete, unmarkComplete };
}
