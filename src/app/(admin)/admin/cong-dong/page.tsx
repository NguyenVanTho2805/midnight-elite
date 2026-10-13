"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PERMISSIONS } from "@/contexts/AuthContext";
import PermissionGuard from "@/components/PermissionGuard";
import ClassScopeBadge, { ClassScopeSelect, type ClassScope } from "@/components/admin/ClassScopeBadge";

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
  course:     { id: string; name: string } | null; // FE-139: bài thuộc lớp nào (null = cộng đồng chung)
}

// Matches actual API shape: { threads, nextCursor }
interface ThreadsResponse {
  threads:    ThreadRow[];
  nextCursor: string | null;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CAT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "hoi-dap":     { label: "Hỏi đáp",    color: "var(--kin-nhan-link)", bg: "var(--kin-nhan-nen-nhat)" },
  "kinh-nghiem": { label: "Kinh nghiệm", color: "var(--kin-tt-chu-xong)", bg: "var(--kin-chu-tren-nut-chinh)" },
  "tai-lieu":    { label: "Tài liệu",    color: "var(--kin-tt-chu-cho)", bg: "var(--kin-chu-tren-nut-chinh)" },
  "goc-vui":     { label: "Góc vui",     color: "var(--kin-nhan-link)", bg: "var(--kin-chu-tren-nut-chinh)" },
};

const NEU_CARD = {
  background: "var(--kin-nen-bang)",
  boxShadow: "var(--kin-bong-the)",
  borderRadius: "16px",
};

function CatBadge({ cat }: { cat: string }) {
  const c = CAT_MAP[cat] ?? { label: cat, color: "var(--kin-chu-mo)", bg: "var(--kin-nen-bang)" };
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
  // FE-139: lọc theo lớp — lọc ở máy chủ (courseId) để "Tải thêm" vẫn đúng phạm vi.
  const [scope, setScope]             = useState<ClassScope>("all");
  const [classes, setClasses]         = useState<{ id: string; name: string }[]>([]);
  const scopeQuery = scope === "all" ? "" : `&courseId=${encodeURIComponent(scope)}`;
  const loadSeq = useRef(0); // bỏ kết quả của lần tải cũ khi đổi lớp nhanh

  useEffect(() => {
    let off = false;
    fetch("/api/courses?all=1", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string }[]) => { if (!off) setClasses(list.map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, "vi"))); })
      .catch(() => { /* bộ lọc vẫn dùng được với 'Tất cả' và 'Chỉ cộng đồng chung' */ });
    return () => { off = true; };
  }, []);

  const load = useCallback(async () => {
    const my = ++loadSeq.current;
    setLoading(true);
    setFetchError(false);
    setActionError(null);
    try {
      const res = await fetch(`/api/community/threads?limit=100${scopeQuery}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ThreadsResponse = await res.json();
      if (my !== loadSeq.current) return;
      // API already returns pinned first, then non-pinned — no extra transform needed
      setAllThreads(data.threads);
      setNextCursor(data.nextCursor);
    } catch {
      if (my === loadSeq.current) setFetchError(true);
    } finally {
      if (my === loadSeq.current) setLoading(false);
    }
  }, [scopeQuery]);

  // Refetch âm thầm trang đầu — gộp bài mới vào đầu, giữ lại các bài đã "Tải thêm" phía dưới
  const refreshSilent = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/threads?limit=100${scopeQuery}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const data: ThreadsResponse = await res.json();
      const freshIds = new Set(data.threads.map(t => t.id));
      setAllThreads(prev => [...data.threads, ...prev.filter(t => !freshIds.has(t.id))]);
    } catch { /* silent */ }
  }, [scopeQuery]);

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
        `/api/community/threads?limit=100&cursor=${encodeURIComponent(nextCursor)}${scopeQuery}`,
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
          <h1 className="text-2xl font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Kiểm duyệt cộng đồng</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>
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
          style={{ background: "rgba(255,255,255,0.7)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}
        />
        <ClassScopeSelect value={scope} onChange={v => { setScope(v); setAllThreads([]); setNextCursor(null); }} classes={classes} />
        <div className="flex gap-2 flex-wrap">
          {["all", "hoi-dap", "kinh-nghiem", "tai-lieu", "goc-vui"].map(c => {
            const info = c === "all" ? { label: "Tất cả", color: "var(--kin-nhan-link)", bg: "var(--kin-nhan-nen-nhat)" } : CAT_MAP[c];
            const active = catFilter === c;
            return (
              <button key={c} onClick={() => setCatFilter(c)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: active ? info.bg : "rgba(255,255,255,0.6)",
                  color:      active ? info.color : "var(--kin-chu-mo)",
                  border:     active ? `1px solid color-mix(in srgb, ${info.color} 25%, transparent)` : "1px solid var(--kin-vien-thuong)",
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
          style={{ background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>Lỗi tải dữ liệu</span>
          <button onClick={load}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: "var(--kin-tt-chu-loi)" }}>
            Thử lại
          </button>
        </div>
      )}

      {/* Action error (pin/delete/loadMore failures) */}
      {actionError && (
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>{actionError}</span>
          <button onClick={() => setActionError(null)}
            className="text-xs font-semibold ml-4 flex-shrink-0" style={{ color: "var(--kin-tt-chu-cho)" }}>
            ✕ Đóng
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--kin-vien-thuong)" }} />
          ))}
        </div>
      )}

      {/* Pinned section */}
      {!loading && pinned.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--kin-nhan-link)" }}>
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
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--kin-chu-mo)" }}>
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
        <div className="text-center py-16" style={{ color: "var(--kin-chu-mo)" }}>
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold">Không có bài viết nào</p>
        </div>
      )}

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--kin-nhan-nen)" }}>
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
        background: t.isPinned ? "color-mix(in srgb, var(--kin-nhan-nen) 4%, transparent)" : "var(--kin-nen-trang)",
        border: `1px solid ${t.isPinned ? "var(--kin-nhan-vien)" : "var(--kin-vien-thuong)"}`,
      }}>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CatBadge cat={t.category} />
          <ClassScopeBadge course={t.course} />
          {t.isPinned && (
            <span className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>📌 Đang ghim</span>
          )}
          <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{formatDate(t.createdAt)}</span>
        </div>

        <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: "var(--kin-chu-phu)" }}>
          {t.content}
        </p>

        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
          <span className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{t.author.name}</span>
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
            background: t.isPinned ? "var(--kin-nhan-vien)" : "color-mix(in srgb, var(--kin-nhan-nen) 8%, transparent)",
            color:      "var(--kin-nhan-link)",
          }}>
          {pinningId === t.id ? "..." : t.isPinned ? "Bỏ ghim" : "📌 Ghim"}
        </button>

        {confirmDelete === t.id ? (
          <div className="flex items-center gap-1.5">
            <button onClick={() => onDelete(t.id)} disabled={deletingId === t.id}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "var(--kin-tt-chu-loi)" }}>
              {deletingId === t.id ? "..." : "Xác nhận xoá"}
            </button>
            <button onClick={() => onConfirm(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
              Huỷ
            </button>
          </div>
        ) : (
          <button onClick={() => onConfirm(t.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
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
