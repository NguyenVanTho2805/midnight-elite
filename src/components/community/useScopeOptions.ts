"use client";
// BU-05 — danh sách lớp của tôi (GET /api/community/scope-options). Khách hoặc người chưa có lớp → mảng rỗng (mục "Lớp của tôi" ẩn).
import { useEffect, useState } from "react";

export interface ScopeOption { id: string; name: string; role: "student" | "teacher" }

export function useScopeOptions(signedIn: boolean): ScopeOption[] {
  const [options, setOptions] = useState<ScopeOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const p: Promise<{ scopes?: ScopeOption[] }> = signedIn
      ? fetch("/api/community/scope-options", { credentials: "same-origin", signal: ac.signal }).then(r => (r.ok ? r.json() : { scopes: [] }))
      : Promise.resolve({ scopes: [] });
    p.then(d => { if (!cancelled) setOptions(d.scopes ?? []); }).catch(() => { /* lỗi mạng: chỉ ẩn mục lớp */ });
    return () => { cancelled = true; ac.abort(); };
  }, [signedIn]);
  return options;
}
