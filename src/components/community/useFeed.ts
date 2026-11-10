"use client";
// BU-05 — nạp feed hợp nhất theo con trỏ (GET /api/community/feed hoặc /bookmarks). Trình duyệt KHÔNG ghép hai nguồn nữa:
// máy chủ trả sẵn danh sách đã hợp nhất. Bài lặp (cùng key) bị bỏ khi nối trang; yêu cầu cũ bị bỏ khi đổi tab/lớp.
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookmarksPage, FeedItem, FeedPage } from "@/lib/communityTypes";
import type { ActionItem } from "./ActionRow";

export type FeedStatus = "loading" | "ok" | "error";
export type FeedFailure = "not_member" | "unauthorized" | "network" | "other";

function dedupe(list: FeedItem[], seen: Set<string>): FeedItem[] {
  const out: FeedItem[] = [];
  for (const it of list) if (!seen.has(it.key)) { seen.add(it.key); out.push(it); }
  return out;
}

/** `limit`: số bài mỗi trang (mặc định 20; máy chủ nhận 1–50). Trang chủ chỉ cần 5 bài đầu nên truyền 5; CommunityHome không truyền. */
export function useFeed(opts: { tab: string; scope: string; saved: boolean; enabled?: boolean; limit?: number }) {
  const { tab, scope, saved, enabled = true, limit = 20 } = opts;
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [failure, setFailure] = useState<FeedFailure>("other");
  const [pinned, setPinned] = useState<FeedItem[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const gen = useRef(0);
  const ctl = useRef<AbortController | null>(null); // huỷ yêu cầu cũ khi tải lại / đổi tab / rời trang: không bỏ request mở

  const urlFor = useCallback((cursor: string | null) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set("cursor", cursor);
    if (saved) return `/api/community/bookmarks?${q}`;
    q.set("tab", tab);
    if (scope && scope !== "all") q.set("scope", scope);
    return `/api/community/feed?${q}`;
  }, [tab, scope, saved, limit]);

  const load = useCallback(async () => {
    if (!enabled) return;
    const my = ++gen.current;
    ctl.current?.abort();
    const ac = new AbortController();
    ctl.current = ac;
    setStatus("loading");
    try {
      const res = await fetch(urlFor(null), { credentials: "same-origin", cache: "no-store", signal: ac.signal });
      if (my !== gen.current) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFailure(res.status === 403 || body?.code === "not_member" ? "not_member" : res.status === 401 ? "unauthorized" : "other");
        setStatus("error");
        return;
      }
      const data = (await res.json()) as Partial<FeedPage> & Partial<BookmarksPage>;
      if (my !== gen.current) return;
      const seen = new Set<string>();
      const p = dedupe(data.pinned ?? [], seen);
      setPinned(p);
      setItems(dedupe(data.items ?? [], seen));
      setNextCursor(data.nextCursor ?? null);
      setMore("idle");
      setStatus("ok");
    } catch {
      if (my !== gen.current) return;
      setFailure("network");
      setStatus("error");
    }
  }, [urlFor, enabled]);

  useEffect(() => {
    void Promise.resolve().then(load);
    // Huỷ kết quả của yêu cầu đang bay khi đổi tab/lớp hoặc rời trang: cần đúng giá trị MỚI NHẤT của bộ đếm, nên cố ý đọc gen.current lúc dọn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { gen.current++; ctl.current?.abort(); };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || more === "loading") return;
    const my = gen.current;
    setMore("loading");
    try {
      const res = await fetch(urlFor(nextCursor), { credentials: "same-origin", cache: "no-store", signal: ctl.current?.signal });
      if (my !== gen.current) return;
      if (!res.ok) { setMore("error"); return; }
      const data = (await res.json()) as BookmarksPage;
      setItems(prev => {
        const seen = new Set([...pinned, ...prev].map(i => i.key));
        return [...prev, ...dedupe(data.items ?? [], seen)];
      });
      setNextCursor(data.nextCursor ?? null);
      setMore("idle");
    } catch { if (my === gen.current) setMore("error"); }
  }, [nextCursor, more, urlFor, pinned]);

  const patch = useCallback((key: string, p: Partial<ActionItem>) => {
    const apply = (l: FeedItem[]) => l.map(i => (i.key === key ? { ...i, ...p } : i));
    setPinned(apply); setItems(apply);
  }, []);

  /** Bài vừa đăng hiện ngay đầu danh sách (không chờ làm mới). */
  const prepend = useCallback((item: FeedItem) => {
    setItems(prev => (prev.some(i => i.key === item.key) ? prev : [item, ...prev]));
  }, []);

  return { status, failure, pinned, items, nextCursor, more, reload: load, loadMore, patch, prepend };
}
