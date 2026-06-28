"use client";

import { useState, useEffect, useCallback } from "react";
import { PERMISSIONS } from "@/contexts/AuthContext";
import PermissionGuard from "@/components/PermissionGuard";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ThreadRow {
  id:         string;
  content:    string;
  category:   string;
  isPinned:   boolean;
  createdAt:  string;
  author:     { id: string; name: string };
  likeCount:  number;
  replyCount: number;
}

// Matches actual API shape: { threads, nextCursor }
interface ThreadsResponse {
  threads:    ThreadRow[];
  nextCursor: string | null;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CAT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "hoi-dap":     { label: "Hỏi đáp",    color: "#0068FF", bg: "#dbeafe" },
  "kinh-nghiem": { label: "Kinh nghiệm", color: "#16a34a", bg: "#dcfce7" },
  "tai-lieu":    { label: "Tài liệu",    color: "#b45309", bg: "#fef3c7" },
  "goc-vui":     { label: "Góc vui",     color: "#7c3aed", bg: "#ede9fe" },
};

const NEU_CARD = {
  background: "#F0F5FF",
  boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff",
  borderRadius: "16px",
};

function CatBadge({ cat }: { cat: string }) {
  const c = CAT_MAP[cat] ?? { label: cat, color: "#787671", bg: "#f6f5f4" };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

function CommunityAdmin() {
  const [allThreads, setAllThreads]   = useState<ThreadRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState(false);
  const [nextCursor, setNextCursor]   = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinningId, setPinningId]     = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [catFilter, setCatFilter]     = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    setActionError(null);
    try {
      const res = await fetch("/api/community/threads?limit=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ThreadsResponse = await res.json();
      // API already returns pinned first, then non-pinned — no extra transform needed
      setAllThreads(data.threads);
      setNextCursor(data.nextCursor);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch âm thầm trang đầu — gộp bài mới vào đầu, giữ lại các bài đã "Tải thêm" phía dưới
  const refreshSilent = useCallback(async () => {
    try {
      const res = await fetch("/api/community/threads?limit=100", { credentials: "same-origin" });
      if (!res.ok) return;
      const data: ThreadsResponse = await res.json();
      const freshIds = new Set(data.threads.map(t => t.id));
      setAllThreads(prev => [...data.threads, ...prev.filter(t => !freshIds.has(t.id))]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Polling 30s + refetch ngay khi quay lại tab, để đồng bộ với bài viết mới từ học viên
  useEffect(() => {
    const interval = setInterval(refreshSilent, 30_000);
    function onVisible() {
      if (document.visibilityState === "visible") refreshSilent();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshSilent);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshSilent);
    };
  }, [refreshSilent]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/community/threads?limit=100&cursor=${encodeURIComponent(nextCursor)}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ThreadsResponse = await res.json();
      // Dedup: pinned threads from page 2+ are already in allThreads
      setAllThreads(prev => {
        const seenIds = new Set(prev.map(t => t.id));
        return [...prev, ...data.threads.filter(t => !seenIds.has(t.id))];
      });
      setNextCursor(data.nextCursor);
    } catch {
      setActionError("Không thể tải thêm bài viết. Vui lòng thử lại.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePin(id: string, current: boolean) {
    setPinningId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/community/threads/${id}`, {
        method:      "PATCH",
        headers:     { "Content-Type": "application/json" },
        credentials: "same-origin",
        body:        JSON.stringify({ isPinned: !current }),
      });
      if (res.ok) {
        setAllThreads(prev => prev.map(t => t.id === id ? { ...t, isPinned: !current } : t));
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError((err as { error?: string }).error ?? "Không thể thực hiện thao tác ghim");
      }
    } catch {
      setActionError("Lỗi kết nối khi ghim bài viết");
    } finally {
      setPinningId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/community/threads/${id}`, {
        method:      "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        setAllThreads(prev => prev.filter(t => t.id !== id));
        setConfirmDelete(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError((err as { error?: string }).error ?? "Không thể xoá bài viết này");
      }
    } catch {
      setActionError("Lỗi kết nối khi xoá bài viết");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = allThreads.filter(t => {
    const matchCat  = catFilter === "all" || t.category === catFilter;
    const matchText = !search || t.content.toLowerCase().includes(search.toLowerCase()) ||
                                 t.author.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchText;
  });

  const pinned  = filtered.filter(t => t.isPinned);
  const regular = filtered.filter(t => !t.isPinned);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1E2938" }}>Kiểm duyệt cộng đồng</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            Ghim, xoá bài viết vi phạm — Tổng: {allThreads.length} bài
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={NEU_CARD} className="p-4 flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm nội dung, tên tác giả..."
          className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #C5D0EA", color: "#1E2938" }}
        />
        <div className="flex gap-2 flex-wrap">
          {["all", "hoi-dap", "kinh-nghiem", "tai-lieu", "goc-vui"].map(c => {
            const info = c === "all" ? { label: "Tất cả", color: "#0068FF", bg: "#dbeafe" } : CAT_MAP[c];
            const active = catFilter === c;
            return (
              <button key={c} onClick={() => setCatFilter(c)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: active ? info.bg : "rgba(255,255,255,0.6)",
                  color:      active ? info.color : "#64748B",
                  border:     active ? `1px solid ${info.color}40` : "1px solid #C5D0EA",
                }}>
                {info.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
          <span className="text-sm font-semibold" style={{ color: "#DC2626" }}>Lỗi tải dữ liệu</span>
          <button onClick={load}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: "#DC2626" }}>
            Thử lại
          </button>
        </div>
      )}

      {/* Action error (pin/delete/loadMore failures) */}
      {actionError && (
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
          <span className="text-sm font-semibold" style={{ color: "#B45309" }}>{actionError}</span>
          <button onClick={() => setActionError(null)}
            className="text-xs font-semibold ml-4 flex-shrink-0" style={{ color: "#B45309" }}>
            ✕ Đóng
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#e5e3df" }} />
          ))}
        </div>
      )}

      {/* Pinned section */}
      {!loading && pinned.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#0068FF" }}>
            Bài ghim ({pinned.length})
          </h2>
          {pinned.map(t => (
            <ThreadRowCard key={t.id} t={t} confirmDelete={confirmDelete} deletingId={deletingId}
              pinningId={pinningId} onPin={handlePin} onDelete={handleDelete} onConfirm={setConfirmDelete} />
          ))}
        </section>
      )}

      {/* Regular posts */}
      {!loading && regular.length > 0 && (
        <section className="space-y-3">
          {pinned.length > 0 && (
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748B" }}>
              Bài viết ({regular.length})
            </h2>
          )}
          {regular.map(t => (
            <ThreadRowCard key={t.id} t={t} confirmDelete={confirmDelete} deletingId={deletingId}
              pinningId={pinningId} onPin={handlePin} onDelete={handleDelete} onConfirm={setConfirmDelete} />
          ))}
        </section>
      )}

      {/* Empty */}
      {!loading && !fetchError && filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: "#64748B" }}>
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold">Không có bài viết nào</p>
        </div>
      )}

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#0068FF" }}>
            {loadingMore ? "Đang tải..." : "Tải thêm"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── THREAD ROW ───────────────────────────────────────────────────────────────

function ThreadRowCard({
  t, confirmDelete, deletingId, pinningId, onPin, onDelete, onConfirm,
}: {
  t:             ThreadRow;
  confirmDelete: string | null;
  deletingId:    string | null;
  pinningId:     string | null;
  onPin:         (id: string, current: boolean) => void;
  onDelete:      (id: string) => void;
  onConfirm:     (id: string | null) => void;
}) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-4 transition-all"
      style={{
        background: t.isPinned ? "rgba(0,104,255,0.04)" : "#ffffff",
        border: `1px solid ${t.isPinned ? "#bfdbfe" : "#e5e3df"}`,
      }}>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CatBadge cat={t.category} />
          {t.isPinned && (
            <span className="text-xs font-semibold" style={{ color: "#0068FF" }}>📌 Đang ghim</span>
          )}
          <span className="text-xs" style={{ color: "#94a3b8" }}>{formatDate(t.createdAt)}</span>
        </div>

        <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: "#37352f" }}>
          {t.content}
        </p>

        <div className="flex items-center gap-3 text-xs" style={{ color: "#94a3b8" }}>
          <span className="font-semibold" style={{ color: "#1E2938" }}>{t.author.name}</span>
          <span>♥ {t.likeCount}</span>
          <span>💬 {t.replyCount}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onPin(t.id, t.isPinned)}
          disabled={pinningId === t.id}
          title={t.isPinned ? "Bỏ ghim" : "Ghim bài"}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{
            background: t.isPinned ? "#bfdbfe" : "rgba(0,104,255,0.08)",
            color:      "#0068FF",
          }}>
          {pinningId === t.id ? "..." : t.isPinned ? "Bỏ ghim" : "📌 Ghim"}
        </button>

        {confirmDelete === t.id ? (
          <div className="flex items-center gap-1.5">
            <button onClick={() => onDelete(t.id)} disabled={deletingId === t.id}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#DC2626" }}>
              {deletingId === t.id ? "..." : "Xác nhận xoá"}
            </button>
            <button onClick={() => onConfirm(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#f6f5f4", color: "#787671" }}>
              Huỷ
            </button>
          </div>
        ) : (
          <button onClick={() => onConfirm(t.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#FEE2E2", color: "#DC2626" }}>
            Xoá
          </button>
        )}
      </div>
    </div>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_COMMUNITY}>
      <CommunityAdmin />
    </PermissionGuard>
  );
}
