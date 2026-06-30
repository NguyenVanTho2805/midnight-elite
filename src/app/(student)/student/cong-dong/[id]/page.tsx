"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
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
  "hoi-dap":     { label: "Hỏi đáp",    color: "#0068FF", bg: "#dbeafe" },
  "kinh-nghiem": { label: "Kinh nghiệm", color: "#16a34a", bg: "#dcfce7" },
  "tai-lieu":    { label: "Tài liệu",    color: "#b45309", bg: "#fef3c7" },
  "goc-vui":     { label: "Góc vui",     color: "#7c3aed", bg: "#ede9fe" },
};

const AVATAR_COLORS = ["#0068FF", "#dc2626", "#16a34a", "#b45309", "#7c3aed", "#0891b2", "#be185d"];
function avatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[(name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % AVATAR_COLORS.length];
}

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "vừa xong";
  if (mins < 60)  return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days  = Math.floor(hours / 24);
  if (days < 7)   return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const d = name || "?";
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(d) }}>
      {d[0].toUpperCase()}
    </div>
  );
}

// ─── MEDIA GRID ───────────────────────────────────────────────────────────────

function MediaGrid({ urls, onClick }: { urls: string[]; onClick?: (i: number) => void }) {
  if (!urls.length) return null;
  const count = urls.length;
  const cls = "w-full h-full object-cover cursor-pointer";
  if (count === 1) return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ maxHeight: 360 }}>
      <img src={urls[0]} alt="" className={cls} onClick={() => onClick?.(0)} style={{ maxHeight: 360 }} />
    </div>
  );
  if (count === 2) return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ height: 220 }}>
      {urls.map((u, i) => <img key={i} src={u} alt="" className={cls} onClick={() => onClick?.(i)} />)}
    </div>
  );
  if (count === 3) return (
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
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-2xl"
              style={{ background: "rgba(0,0,0,0.45)" }}>+{count - 4}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── LIGHTBOX ─────────────────────────────────────────────────────────────────

function Lightbox({ urls, initial, onClose }: { urls: string[]; initial: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initial);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx(i => Math.min(i + 1, urls.length - 1));
      if (e.key === "ArrowLeft")  setIdx(i => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [urls.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
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

// ─── IMAGE PREVIEWS (in reply form) ───────────────────────────────────────────

function ImagePreviews({ images, onRemove }: { images: File[]; onRemove: (i: number) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {images.map((img, i) => (
        <div key={i} className="relative rounded-lg overflow-hidden flex-shrink-0"
          style={{ width: 64, height: 64 }}>
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
  r:        ReplyDTO;
  onLike:   (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/community/replies/${r.id}`, { method: "DELETE", credentials: "same-origin" });
    if (res.ok) onDelete(r.id);
    setDeleting(false);
  }

  return (
    <>
      {lightboxIdx !== null && (
        <Lightbox urls={r.imageUrls} initial={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
      <div className="flex gap-3">
        <Avatar name={r.author.name} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{r.author.name}</span>
              {r.author.isTeacher && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: "#fef3c7", color: "#b45309" }}>Giáo viên</span>
              )}
              <span className="text-xs" style={{ color: "#a4a097" }}>· {timeAgo(r.createdAt)}</span>
            </div>
            {r.isOwn && (
              confirmDelete
                ? <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={handleDelete} disabled={deleting}
                      className="text-xs px-2 py-0.5 rounded font-bold text-white disabled:opacity-50"
                      style={{ background: "#dc2626" }}>{deleting ? "..." : "Xoá"}</button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "#f6f5f4", color: "#787671" }}>Huỷ</button>
                  </div>
                : <button onClick={() => setConfirmDelete(true)}
                    className="text-xs flex-shrink-0" style={{ color: "#a4a097" }}>✕</button>
            )}
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap mt-0.5" style={{ color: "#37352f" }}>
            {r.content}
          </p>

          {r.imageUrls.length > 0 && (
            <MediaGrid urls={r.imageUrls} onClick={i => setLightboxIdx(i)} />
          )}

          {/* Reply like */}
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

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();

  const [thread, setThread]         = useState<ThreadDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [liking, setLiking]         = useState(false);
  const [likeError, setLikeError]   = useState<string | null>(null);
  const [bookmarking, setBookmarking] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Reply form state
  const [replyText, setReplyText]     = useState("");
  const [replyImages, setReplyImages] = useState<File[]>([]);
  const [replying, setReplying]       = useState(false);
  const [replyUploading, setReplyUploading] = useState(false);
  const [replyError, setReplyError]   = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const imgRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setNotFound(false); setFetchError(false); setThread(null);

    fetch(`/api/community/threads/${id}`, { credentials: "same-origin" })
      .then(async r => {
        if (cancelled) return;
        if (r.status === 404) { setNotFound(true); return; }
        if (!r.ok) throw new Error();
        const data: ThreadDetail = await r.json();
        if (!cancelled) setThread(data);
      })
      .catch(() => { if (!cancelled) setFetchError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  // Polling 30s + refetch khi quay lại tab, để trả lời mới từ học viên khác tự hiện ra
  useEffect(() => {
    function refreshSilent() {
      fetch(`/api/community/threads/${id}`, { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : null)
        .then((data: ThreadDetail | null) => { if (data) setThread(data); })
        .catch(() => {});
    }
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
  }, [id]);

  async function handleLike() {
    if (!thread || liking) return;
    setLiking(true); setLikeError(null);
    try {
      const res  = await fetch(`/api/community/threads/${id}/like`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) setThread(prev => prev ? { ...prev, likedByMe: data.likedByMe, likeCount: data.likeCount } : prev);
      else setLikeError(data.error ?? "Không thể thực hiện");
    } catch { setLikeError("Lỗi kết nối"); }
    finally { setLiking(false); }
  }

  async function handleBookmark() {
    if (!thread || bookmarking) return;
    setBookmarking(true);
    try {
      const res  = await fetch(`/api/community/threads/${id}/bookmark`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) setThread(prev => prev ? { ...prev, bookmarkedByMe: data.bookmarkedByMe } : prev);
    } catch { /* silent */ }
    finally { setBookmarking(false); }
  }

  async function handleReplyLike(replyId: string) {
    try {
      const res  = await fetch(`/api/community/replies/${replyId}/like`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) {
        setThread(prev => prev ? {
          ...prev,
          replies: prev.replies.map(r => r.id === replyId
            ? { ...r, likedByMe: data.likedByMe, likeCount: data.likeCount } : r),
        } : prev);
      }
    } catch { /* silent */ }
  }

  function handleReplyDelete(replyId: string) {
    setThread(prev => prev ? {
      ...prev,
      replyCount: prev.replyCount - 1,
      replies: prev.replies.filter(r => r.id !== replyId),
    } : prev);
  }

  async function handleReply() {
    if (!replyText.trim()) { setReplyError("Nội dung không được để trống"); return; }
    setReplyError("");

    let imageUrls: string[] = [];
    if (replyImages.length > 0) {
      if (!cloudinaryConfigured) { setReplyError("Chưa cấu hình Cloudinary để upload ảnh"); return; }
      setReplyUploading(true);
      try { imageUrls = await uploadMany(replyImages, "community/images"); }
      catch (e) { setReplyError((e as Error).message); setReplyUploading(false); return; }
      setReplyUploading(false);
    }

    setReplying(true);
    try {
      const res  = await fetch(`/api/community/threads/${id}/reply`, {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ content: replyText, imageUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi gửi");
      setThread(prev => prev ? {
        ...prev,
        replyCount: prev.replyCount + 1,
        replies: [...prev.replies, data],
      } : prev);
      if (data.coinsEarned > 0) {
        window.dispatchEvent(new CustomEvent("coin:earned", { detail: { amount: data.coinsEarned } }));
      }
      setReplyText(""); setReplyImages([]);
      setTimeout(() => replyRef.current?.focus(), 50);
    } catch (e) {
      setReplyError(e instanceof TypeError ? "Lỗi kết nối" : (e as Error).message);
    } finally {
      setReplying(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/student/cong-dong/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {[100, 80, 60, 90, 70].map((w, i) => (
        <div key={i} className="h-4 rounded animate-pulse" style={{ background: "#e5e3df", width: `${w}%` }} />
      ))}
    </div>
  );

  if (fetchError) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-3xl mb-3">⚠️</p>
      <h1 className="font-bold text-lg mb-1" style={{ color: "#1a1a1a" }}>Không thể tải bài viết</h1>
      <p className="text-sm mb-5" style={{ color: "#787671" }}>Lỗi kết nối hoặc server. Vui lòng thử lại.</p>
      <button onClick={() => { setFetchError(false); setLoading(true);
          fetch(`/api/community/threads/${id}`, { credentials: "same-origin" })
            .then(async r => { if (!r.ok) throw new Error(); setThread(await r.json()); })
            .catch(() => setFetchError(true)).finally(() => setLoading(false)); }}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#0068FF" }}>
        Thử lại
      </button>
    </div>
  );

  if (notFound || !thread) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-3xl mb-3">💬</p>
      <h1 className="font-bold text-lg mb-1" style={{ color: "#1a1a1a" }}>Không tìm thấy bài viết</h1>
      <p className="text-sm mb-5" style={{ color: "#787671" }}>Bài viết đã bị xoá hoặc không tồn tại</p>
      <Link href="/student/cong-dong"
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white inline-block"
        style={{ background: "#0068FF" }}>← Quay lại Cộng đồng</Link>
    </div>
  );

  const cat = CAT_MAP[thread.category] ?? { label: thread.category, color: "#787671", bg: "#f6f5f4" };

  return (
    <>
      {lightboxIdx !== null && (
        <Lightbox urls={thread.imageUrls} initial={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Back */}
        <Link href="/student/cong-dong" className="flex items-center gap-1.5 text-sm font-medium w-fit"
          style={{ color: "#787671" }}>← Cộng đồng</Link>

        {/* Thread card */}
        <div className="rounded-xl border p-5"
          style={{ background: "#ffffff", borderColor: thread.isPinned ? "#bfdbfe" : "#e5e3df" }}>

          {thread.isPinned && (
            <p className="text-xs font-semibold mb-3" style={{ color: "#0068FF" }}>📌 Ghim bởi Admin</p>
          )}

          {/* Author */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Avatar name={thread.author.name} size={38} />
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{thread.author.name}</span>
                  {thread.author.isTeacher && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: "#fef3c7", color: "#b45309" }}>Giáo viên</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "#a4a097" }}>{timeAgo(thread.createdAt)}</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
          </div>

          {/* Content */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#37352f" }}>
            {thread.content}
          </p>

          {/* Images */}
          {thread.imageUrls.length > 0 && (
            <MediaGrid urls={thread.imageUrls} onClick={i => setLightboxIdx(i)} />
          )}

          {/* File */}
          {thread.fileUrl && (
            <a href={thread.fileUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mt-3"
              style={{ background: "#f6f5f4", color: "#37352f", border: "1px solid #e5e3df" }}>
              <span>📎</span>
              <span className="truncate max-w-[220px]">{thread.fileName ?? "Tệp đính kèm"}</span>
            </a>
          )}

          {/* Actions */}
          <div className="pt-4 mt-4" style={{ borderTop: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-1">
              {/* Like */}
              <button onClick={handleLike} disabled={liking}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
                style={{ color: thread.likedByMe ? "#dc2626" : "#a4a097" }}>
                <span className="text-lg leading-none">{thread.likedByMe ? "♥" : "♡"}</span>
                <span className="font-semibold">{thread.likeCount}</span>
              </button>

              {/* Reply count */}
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm" style={{ color: "#a4a097" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="font-medium">{thread.replyCount} trả lời</span>
              </span>

              <div className="flex-1" />

              {/* Bookmark */}
              <button onClick={handleBookmark} disabled={bookmarking}
                title={thread.bookmarkedByMe ? "Bỏ lưu" : "Lưu bài"}
                className="px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ color: thread.bookmarkedByMe ? "#0068FF" : "#a4a097" }}>
                {thread.bookmarkedByMe
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-3.5L5 22V4z"/></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-3.5L5 22V4z"/></svg>
                }
              </button>

              {/* Share */}
              <button onClick={copyLink}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: copied ? "#16a34a" : "#a4a097" }}>
                {copied
                  ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Đã sao chép</>
                  : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>Chia sẻ</>
                }
              </button>
            </div>
            {likeError && <p className="text-xs mt-1.5" style={{ color: "#dc2626" }}>{likeError}</p>}
          </div>
        </div>

        {/* Divider */}
        {thread.replies.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "#e5e3df" }} />
            <span className="text-xs font-semibold" style={{ color: "#a4a097" }}>{thread.replies.length} trả lời</span>
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
          <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#e5e3df" }}>
            <div className="flex gap-3">
              <Avatar name={user.name} size={32} />
              <div className="flex-1 min-w-0">
                <textarea ref={replyRef} rows={3} maxLength={1000} value={replyText}
                  onChange={e => { setReplyText(e.target.value); setReplyError(""); }}
                  placeholder={`Trả lời ${thread.author.name}...`}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none"
                  style={{ background: "#f6f5f4", color: "#1a1a1a", border: "none" }} />

                <ImagePreviews images={replyImages}
                  onRemove={i => setReplyImages(p => p.filter((_, idx) => idx !== i))} />

                {replyError && <p className="text-xs mt-1" style={{ color: "#dc2626" }}>{replyError}</p>}

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {/* Image attach */}
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
                        const valid = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
                        setReplyImages(p => [...p, ...valid].slice(0, 2));
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
      </div>
    </>
  );
}
