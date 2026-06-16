"use client";
import { useState, useEffect, useCallback } from "react";

export function useProgress() {
  const [completedIds,      setCompleted]      = useState<Set<string>>(new Set());
  const [courseCompletion,  setCourseCompletion] = useState<Record<string, number>>({});
  const [loading,           setLoading]         = useState(true);

  useEffect(() => {
    fetch("/api/progress", { credentials: "same-origin" })
      .then(r => r.json())
      .then(data => {
        setCompleted(new Set(data.completedIds ?? []));
        setCourseCompletion(data.byCourse ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markComplete = useCallback(async (lessonId: string) => {
    await fetch(`/api/progress/${lessonId}`, { method: "POST", credentials: "same-origin" });
    setCompleted(prev => new Set([...prev, lessonId]));
  }, []);

  const unmarkComplete = useCallback(async (lessonId: string) => {
    await fetch(`/api/progress/${lessonId}`, { method: "DELETE", credentials: "same-origin" });
    setCompleted(prev => { const n = new Set(prev); n.delete(lessonId); return n; });
  }, []);

  return { completedIds, courseCompletion, loading, markComplete, unmarkComplete };
}
