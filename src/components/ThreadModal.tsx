"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { uploadMany, cloudinaryConfigured } from "@/lib/cloudinary";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ReplyDTO {
  id:        string;
  content:   string;
  imageUrls: string[];
  createdAt: string;
  author:    { id: string; name: string; isTeacher: boolean };
  likeCount: number;
  likedByMe: boolean;
  isOwn:     boolean;
}

interface ThreadDetail {
  id:             string;
  content:        string;
  category:       string;
  isPinned:       boolean;
  imageUrls:      string[];
  fileUrl:        string | null;
  fileName:       string | null;
  createdAt:      string;
  author:         { id: string; name: string; isTeacher: boolean };
  likeCount:      number;
  replyCount:     number;
  likedByMe:      boolean;
  bookmarkedByMe: boolean;
  replies:        ReplyDTO[];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const CAT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "hoi-dap":     { label: "Hỏi nhanh",  color: "#0068FF", bg: "#dbeafe" },
  "kinh-nghiem": { label: "Chia sẻ",    color: "#16a34a", bg: "#dcfce7" },
  "tai-lieu":    { label: "Tài liệu",   color: "#b45309", bg: "#fef3c7" },
  "goc-vui":     { label: "Góc vui",    color: "#7c3aed", bg: "#ede9fe" },
};

const AVATAR_COLORS = ["#0068FF","#dc2626","#16a34a","#b45309","#7c3aed","#0891b2","#be185d"];
function avatarColor(n: string) {
  if (!n) return AVATAR_COLORS[0];
  return AVATAR_COLORS[(n.charCodeAt(0) + n.charCodeAt(n.length - 1)) % AVATAR_COLORS.length];
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "vừa xong";
  if (mins < 60)  return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7)   return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const d = name || "?";
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(d) }}>
      {d[0].toUpperCase()}
    </div>
  );
}

function MediaGrid({ urls, onClick }: { urls: string[]; onClick?: (i: number) => void }) {
  if (!urls.length) return null;
  const n = urls.length;
  const cls = "w-full h-full object-cover cursor-pointer";
  if (n === 1) return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ maxHeight: 360 }}>
      <img src={urls[0]} alt="" className={cls} onClick={() => onClick?.(0)} style={{ maxHeight: 360 }} />
    </div>
  );
  if (n === 2) return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ height: 220 }}>
      {urls.map((u, i) => <img key={i} src={u} alt="" className={cls} onClick={() => onClick?.(i)} />)}
    </div>
  );
  if (n === 3) return (
    <div className="mt-3 gap-1 rounded-xl overflow-hidden"
      style={{ display: "grid", gridTemplateColumns: "2fr 1fr", height: 220 }}>
      <img src={urls[0]} alt="" className={cls} style={{ gridRow: "1/3" }} onClick={() => onClick?.(0)} />
      <img src={urls[1]} alt="" className={cls} onClick={() => onClick?.(1)} />
      <img src={urls[2]} alt="" className={cls} onClick={() => onClick?.(2)} />
    </div>
  );
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ height: 220 }}>
      {urls.slice(0, 4).map((u, i) => (
        <div key={i} className="relative overflow-hidden">
          <img src={u} alt="" className={cls} onClick={() => onClick?.(i)} />
          {i === 3 && n > 4 && (
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl"
              style={{ background: "rgba(0,0,0,0.45)" }}>+{n - 4}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function Lightbox({ urls, initial, onClose }: { urls: string[]; initial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initial);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowRight")  setIdx(i => Math.min(i + 1, urls.length - 1));
      if (e.key === "ArrowLeft")   setIdx(i => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [urls.length, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)" }} onClick={onClose}>
      <img src={urls[idx]} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={e => e.stopPropagation()} />
      {urls.length > 1 && (
        <>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ background: "rgba(255,255,255,0.15)" }}
            onClick={e => { e.stopPropagation(); setIdx(i => Math.max(i - 1, 0)); }}>‹</button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ background: "rgba(255,255,255,0.15)" }}
            onClick={e => { e.stopPropagation(); setIdx(i => Math.min(i + 1, urls.length - 1)); }}>›</button>
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm opacity-60">
            {idx + 1} / {urls.length}
          </p>
        </>
      )}
      <button className="absolute top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center"
        onClick={onClose}>✕</button>
    </div>
  );
}

function ImagePreviews({ images, onRemove }: { images: File[]; onRemove: (i: number) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {images.map((img, i) => (
        <div key={i} className="relative rounded-lg overflow-hidden flex-shrink-0" style={{ width: 64, height: 64 }}>
          <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
          <button onClick={() => onRemove(i)}
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
            style={{ background: "rgba(0,0,0,0.55)" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── REPLY CARD ───────────────────────────────────────────────────────────────

function ReplyCard({ r, onLike, onDelete }: {
  r: ReplyDTO; onLike: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [lbIdx, setLbIdx]             = useState<number | null>(null);
  const [confirmDelete, setConfirm]   = useState(false);
  const [deleting, setDeleting]       = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/community/replies/${r.id}`, { method: "DELETE", credentials: "same-origin" });
    if (res.ok) onDelete(r.id);
    setDeleting(false);
  }

  return (
    <>
      {lbIdx !== null && <Lightbox urls={r.imageUrls} initial={lbIdx} onClose={() => setLbIdx(null)} />}
      <div className="flex gap-3">
        <Avatar name={r.author.name} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{r.author.name}</span>
              {r.author.isTeacher && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: "#fef3c7", color: "#b45309" }}>Gia sư</span>
              )}
              <span className="text-xs" style={{ color: "#a4a097" }}>· {timeAgo(r.createdAt)}</span>
            </div>
            {r.isOwn && (
              confirmDelete
                ? <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={handleDelete} disabled={deleting}
                      className="text-xs px-2 py-0.5 rounded font-bold text-white disabled:opacity-50"
                      style={{ background: "#dc2626" }}>{deleting ? "..." : "Xoá"}</button>
                    <button onClick={() => setConfirm(false)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "#f6f5f4", color: "#787671" }}>Huỷ</button>
                  </div>
                : <button onClick={() => setConfirm(true)}
                    className="text-xs flex-shrink-0" style={{ color: "#a4a097" }}>✕</button>
            )}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap mt-0.5" style={{ color: "#37352f" }}>
            {r.content}
          </p>
          {r.imageUrls.length > 0 && <MediaGrid urls={r.imageUrls} onClick={i => setLbIdx(i)} />}
          <button onClick={() => onLike(r.id)}
            className="flex items-center gap-1 mt-2 text-xs transition-colors"
            style={{ color: r.likedByMe ? "#dc2626" : "#a4a097" }}>
            <span className="text-sm leading-none">{r.likedByMe ? "♥" : "♡"}</span>
            <span className="font-semibold">{r.likeCount > 0 ? r.likeCount : ""}</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

export default function ThreadModal({
  threadId,
  onClose,
  onLikeUpdate,
  onBookmarkUpdate,
}: {
  threadId:         string | null;
  onClose:          () => void;
  onLikeUpdate?:    (id: string, likedByMe: boolean, likeCount: number) => void;
  onBookmarkUpdate?:(id: string, bookmarkedByMe: boolean) => void;
}) {
  const { user } = useAuth();

  const [mounted, setMounted]             = useState(false);
  const [thread, setThread]               = useState<ThreadDetail | null>(null);
  const [loading, setLoading]             = useState(false);
  const [fetchError, setFetchError]       = useState(false);
  const [liking, setLiking]               = useState(false);
  const [bookmarking, setBookmarking]     = useState(false);
  const [copied, setCopied]               = useState(false);
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [replyText, setReplyText]         = useState("");
  const [replyImages, setReplyImages]     = useState<File[]>([]);
  const [replying, setReplying]           = useState(false);
  const [replyUploading, setReplyUploading] = useState(false);
  const [replyError, setReplyError]       = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const imgRef   = useRef<HTMLInputElement>(null);
  const bodyRef  = useRef<HTMLDivElement>(null);

  const fetchThread = useCallback((id: string) => {
    setLoading(true);
    setFetchError(false);
    fetch(`/api/community/threads/${id}`, { credentials: "same-origin" })
      .then(async r => {
        if (!r.ok) throw new Error();
        setThread(await r.json());
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!threadId) { setThread(null); setFetchError(false); return; }
    fetchThread(threadId);
  }, [threadId, fetchThread]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!threadId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [threadId, onClose]);

  // Silent polling inside modal
  useEffect(() => {
    if (!threadId) return;
    function refresh() {
      fetch(`/api/community/threads/${threadId}`, { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : null)
        .then((d: ThreadDetail | null) => { if (d) setThread(d); })
        .catch(() => {});
    }
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  }, [threadId]);

  async function handleLike() {
    if (!thread || liking) return;
    setLiking(true);
    const res  = await fetch(`/api/community/threads/${thread.id}/like`, { method: "POST", credentials: "same-origin" });
    const data = await res.json();
    if (res.ok) {
      setThread(p => p ? { ...p, likedByMe: data.likedByMe, likeCount: data.likeCount } : p);
      onLikeUpdate?.(thread.id, data.likedByMe, data.likeCount);
    }
    setLiking(false);
  }

  async function handleBookmark() {
    if (!thread || bookmarking) return;
    setBookmarking(true);
    const res  = await fetch(`/api/community/threads/${thread.id}/bookmark`, { method: "POST", credentials: "same-origin" });
    const data = await res.json();
    if (res.ok) {
      setThread(p => p ? { ...p, bookmarkedByMe: data.bookmarkedByMe } : p);
      onBookmarkUpdate?.(thread.id, data.bookmarkedByMe);
    }
    setBookmarking(false);
  }

  async function handleReplyLike(replyId: string) {
    const res  = await fetch(`/api/community/replies/${replyId}/like`, { method: "POST", credentials: "same-origin" });
    const data = await res.json();
    if (res.ok) setThread(p => p ? {
      ...p,
      replies: p.replies.map(r => r.id === replyId ? { ...r, likedByMe: data.likedByMe, likeCount: data.likeCount } : r),
    } : p);
  }

  function handleReplyDelete(id: string) {
    setThread(p => p ? { ...p, replyCount: p.replyCount - 1, replies: p.replies.filter(r => r.id !== id) } : p);
  }

  async function handleReply() {
    if (!thread || !replyText.trim()) { setReplyError("Nội dung không được để trống"); return; }
    setReplyError("");
    let imageUrls: string[] = [];
    if (replyImages.length > 0) {
      if (!cloudinaryConfigured) { setReplyError("Chưa cấu hình Cloudinary"); return; }
      setReplyUploading(true);
      try { imageUrls = await uploadMany(replyImages, "community/images"); }
      catch (e) { setReplyError((e as Error).message); setReplyUploading(false); return; }
      setReplyUploading(false);
    }
    setReplying(true);
    try {
      const res  = await fetch(`/api/community/threads/${thread.id}/reply`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content: replyText, imageUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi gửi");
      setThread(p => p ? { ...p, replyCount: p.replyCount + 1, replies: [...p.replies, data] } : p);
      if (data.coinsEarned > 0) {
        window.dispatchEvent(new CustomEvent("coin:earned", { detail: { amount: data.coinsEarned } }));
      }
      setReplyText(""); setReplyImages([]);
      setTimeout(() => {
        replyRef.current?.focus();
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    } catch (e) {
      setReplyError(e instanceof TypeError ? "Lỗi kết nối" : (e as Error).message);
    } finally {
      setReplying(false);
    }
  }

  function copyLink() {
    if (!thread) return;
    navigator.clipboard.writeText(`${window.location.origin}/student/cong-dong/${thread.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!threadId || !mounted) return null;

  const cat = thread ? (CAT_MAP[thread.category] ?? { label: thread.category, color: "#787671", bg: "#f6f5f4" }) : null;

  return createPortal(
    <>
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Lightbox is above modal */}
      {lightboxIdx !== null && thread && (
        <Lightbox urls={thread.imageUrls} initial={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      {/* Backdrop */}
      <div
        className="fixed top-0 left-0 z-[9999] flex items-end sm:items-center justify-center"
        style={{
          width: "100vw",
          height: "100vh",
          background: "rgba(15,15,15,0.6)",
          animation: "backdropIn 0.18s ease-out",
        }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          className="relative w-full sm:max-w-2xl sm:mx-4 flex flex-col overflow-hidden rounded-t-[20px] sm:rounded-[20px]"
          style={{
            background: "#ffffff",
            maxHeight: "92dvh",
            animation: "modalSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: "#e5e3df" }} />
          </div>

          {/* Sticky header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "#37352f" }}>Bài viết</span>
              {cat && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all hover:bg-gray-100"
              style={{ color: "#787671" }}>✕</button>
          </div>

          {/* Scrollable body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">

            {/* Loading skeleton */}
            {loading && (
              <div className="p-5 space-y-3">
                {[85, 70, 90, 60, 75].map((w, i) => (
                  <div key={i} className="h-4 rounded-lg animate-pulse"
                    style={{ background: "#e5e3df", width: `${w}%` }} />
                ))}
              </div>
            )}

            {/* Error */}
            {fetchError && (
              <div className="p-8 text-center">
                <p className="text-2xl mb-3">⚠️</p>
                <p className="font-semibold mb-1" style={{ color: "#1a1a1a" }}>Không thể tải bài viết</p>
                <button onClick={() => threadId && fetchThread(threadId)}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "#0068FF" }}>Thử lại</button>
              </div>
            )}

            {/* Content */}
            {!loading && !fetchError && thread && (
              <div className="p-5 space-y-4">

                {thread.isPinned && (
                  <p className="text-xs font-semibold" style={{ color: "#0068FF" }}>📌 Ghim bởi Admin</p>
                )}

                {/* Author */}
                <div className="flex items-center gap-2.5">
                  <Avatar name={thread.author.name} size={38} />
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{thread.author.name}</span>
                      {thread.author.isTeacher && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "#fef3c7", color: "#b45309" }}>Gia sư</span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "#a4a097" }}>{timeAgo(thread.createdAt)}</p>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#37352f" }}>
                  {thread.content}
                </p>

                {thread.imageUrls.length > 0 && (
                  <MediaGrid urls={thread.imageUrls} onClick={i => setLightboxIdx(i)} />
                )}

                {thread.fileUrl && (
                  <a href={thread.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "#f6f5f4", color: "#37352f", border: "1px solid #e5e3df" }}>
                    📎 <span className="truncate max-w-[220px]">{thread.fileName ?? "Tệp đính kèm"}</span>
                  </a>
                )}

                {/* Actions */}
                <div className="pt-3 flex items-center gap-0.5" style={{ borderTop: "1px solid #e5e3df" }}>
                  <button onClick={handleLike} disabled={liking}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
                    style={{ color: thread.likedByMe ? "#dc2626" : "#a4a097" }}>
                    <span className="text-lg leading-none">{thread.likedByMe ? "♥" : "♡"}</span>
                    <span className="font-semibold">{thread.likeCount}</span>
                  </button>

                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm" style={{ color: "#a4a097" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="font-medium">{thread.replyCount} trả lời</span>
                  </span>

                  <div className="flex-1" />

                  <button onClick={handleBookmark} disabled={bookmarking} title={thread.bookmarkedByMe ? "Bỏ lưu" : "Lưu bài"}
                    className="px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{ color: thread.bookmarkedByMe ? "#0068FF" : "#a4a097" }}>
                    {thread.bookmarkedByMe
                      ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-3.5L5 22V4z"/></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-3.5L5 22V4z"/></svg>
                    }
                  </button>

                  <button onClick={copyLink}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ color: copied ? "#16a34a" : "#a4a097" }}>
                    {copied
                      ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Đã sao chép</>
                      : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>Chia sẻ</>
                    }
                  </button>
                </div>

                {/* Replies divider */}
                {thread.replies.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: "#e5e3df" }} />
                    <span className="text-xs font-semibold" style={{ color: "#a4a097" }}>
                      {thread.replies.length} trả lời
                    </span>
                    <div className="flex-1 h-px" style={{ background: "#e5e3df" }} />
                  </div>
                )}

                {/* Replies */}
                <div className="space-y-4">
                  {thread.replies.map(r => (
                    <ReplyCard key={r.id} r={r} onLike={handleReplyLike} onDelete={handleReplyDelete} />
                  ))}
                </div>

                {/* Reply form */}
                {user && (
                  <div className="rounded-xl border p-4" style={{ background: "#f9f9f8", borderColor: "#e5e3df" }}>
                    <div className="flex gap-3">
                      <div className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm"
                        style={{ width: 32, height: 32, background: avatarColor(user.name) }}>
                        {user.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <textarea ref={replyRef} rows={3} maxLength={1000} value={replyText}
                          onChange={e => { setReplyText(e.target.value); setReplyError(""); }}
                          placeholder={`Trả lời ${thread.author.name}...`}
                          className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none"
                          style={{ background: "#ffffff", color: "#1a1a1a", border: "1px solid #e5e3df" }} />

                        <ImagePreviews images={replyImages}
                          onRemove={i => setReplyImages(p => p.filter((_, idx) => idx !== i))} />

                        {replyError && <p className="text-xs mt-1" style={{ color: "#dc2626" }}>{replyError}</p>}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => imgRef.current?.click()}
                              disabled={replyImages.length >= 2}
                              className="p-1.5 rounded-lg disabled:opacity-40 transition-all"
                              title="Thêm ảnh (tối đa 2)"
                              style={{ color: "#a4a097" }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
                              onChange={e => {
                                if (!e.target.files) return;
                                setReplyImages(p => [...p, ...Array.from(e.target.files!).filter(f => f.type.startsWith("image/"))].slice(0, 2));
                                e.target.value = "";
                              }} />
                            <span className="text-xs" style={{ color: "#a4a097" }}>{replyText.length}/1000</span>
                          </div>
                          <button onClick={handleReply} disabled={replying || replyUploading || !replyText.trim()}
                            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                            style={{ background: "#0068FF" }}>
                            {replyUploading ? "Upload..." : replying ? "Đang gửi..." : "Gửi trả lời"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom padding */}
                <div className="h-2" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
