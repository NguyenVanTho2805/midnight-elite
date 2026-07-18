"use client";

// Logic + UI thuần dùng chung giữa ThreadModal.tsx (popup mở từ feed) và
// /cong-dong/[id]/page.tsx (trang chi tiết full-page) — trước đây 2 file này
// lặp lại gần như y hệt nhau (~600 dòng mỗi file). Chrome hiển thị (modal vs
// full-page) vẫn giữ riêng ở từng file; chỉ phần fetch/mutate data + các
// component con thuần được gộp về đây.

import { useState, useEffect, useCallback, useRef } from "react";
import { uploadMany, cloudinaryConfigured } from "@/lib/cloudinary";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ReplyDTO {
  id:        string;
  content:   string;
  imageUrls: string[];
  createdAt: string;
  author:    { id: string; name: string; isTeacher: boolean };
  likeCount: number;
  likedByMe: boolean;
  isOwn:     boolean;
}

export interface ThreadDetail {
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

export const CAT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "hoi-dap":     { label: "Hỏi đáp",    color: "#0068FF", bg: "#dbeafe" },
  "kinh-nghiem": { label: "Kinh nghiệm", color: "#16a34a", bg: "#dcfce7" },
  "tai-lieu":    { label: "Tài liệu",    color: "#b45309", bg: "#fef3c7" },
  "goc-vui":     { label: "Góc vui",     color: "#7c3aed", bg: "#ede9fe" },
};

const AVATAR_COLORS = ["#0068FF", "#dc2626", "#16a34a", "#b45309", "#7c3aed", "#0891b2", "#be185d"];
export function avatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[(name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % AVATAR_COLORS.length];
}

export function timeAgo(iso: string) {
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

// ─── AVATAR ───────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const d = name || "?";
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(d) }}>
      {d[0].toUpperCase()}
    </div>
  );
}

// ─── MEDIA GRID ───────────────────────────────────────────────────────────────

export function MediaGrid({ urls, onClick }: { urls: string[]; onClick?: (i: number) => void }) {
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

export function Lightbox({ urls, initial, onClose }: { urls: string[]; initial: number; onClose: () => void }) {
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
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

// ─── IMAGE PREVIEWS (trong form trả lời) ──────────────────────────────────────

export function ImagePreviews({ images, onRemove }: { images: File[]; onRemove: (i: number) => void }) {
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

export function ReplyCard({ r, onLike, onDelete }: {
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

// ─── REPLY FORM ───────────────────────────────────────────────────────────────

export function ReplyForm({
  user, threadAuthorName, replyText, setReplyText, replyImages, setReplyImages,
  replyError, uploading, replying, onSubmit, wrapperBg, textareaBg, inputRef,
}: {
  user:             { name: string };
  threadAuthorName: string;
  replyText:        string;
  setReplyText:     (v: string) => void;
  replyImages:      File[];
  setReplyImages:   (fn: (p: File[]) => File[]) => void;
  replyError:       string;
  uploading:        boolean;
  replying:         boolean;
  onSubmit:         () => void;
  wrapperBg:        string;
  textareaBg:        string;
  inputRef:         React.RefObject<HTMLTextAreaElement | null>;
}) {
  const imgRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border p-4" style={{ background: wrapperBg, borderColor: "#e5e3df" }}>
      <div className="flex gap-3">
        <Avatar name={user.name} size={32} />
        <div className="flex-1 min-w-0">
          <textarea ref={inputRef} rows={3} maxLength={1000} value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder={`Trả lời ${threadAuthorName}...`}
            className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none"
            style={{ background: textareaBg, color: "#1a1a1a", border: textareaBg === "#ffffff" ? "1px solid #e5e3df" : "none" }} />

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
                  const valid = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
                  setReplyImages(p => [...p, ...valid].slice(0, 2));
                  e.target.value = "";
                }} />
              <span className="text-xs" style={{ color: "#a4a097" }}>{replyText.length}/1000</span>
            </div>
            <button onClick={onSubmit} disabled={replying || uploading || !replyText.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#0068FF" }}>
              {uploading ? "Upload..." : replying ? "Đang gửi..." : "Gửi trả lời"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REPORT PANEL ─────────────────────────────────────────────────────────────

export function ReportPanel({
  reporting, reportReason, setReportReason, reportSending, reportDone, reportError, onSubmit, onCancel,
}: {
  reporting:       boolean;
  reportReason:    string;
  setReportReason: (v: string) => void;
  reportSending:   boolean;
  reportDone:      boolean;
  reportError:     string;
  onSubmit:        () => void;
  onCancel:        () => void;
}) {
  if (!reporting) return null;
  return (
    <div className="p-3 rounded-lg" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
      {reportDone ? (
        <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>Đã gửi báo cáo, cảm ơn bạn!</p>
      ) : (
        <>
          <textarea rows={2} maxLength={300} value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="Lý do báo cáo bài viết này..."
            className="w-full text-xs rounded-lg px-2.5 py-2 outline-none resize-none"
            style={{ background: "#ffffff", color: "#1a1a1a", border: "1px solid #fecaca" }} />
          {reportError && <p className="text-xs mt-1" style={{ color: "#dc2626" }}>{reportError}</p>}
          <div className="flex gap-1.5 mt-2">
            <button onClick={onSubmit} disabled={reportSending}
              className="px-3 py-1 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#dc2626" }}>{reportSending ? "..." : "Gửi báo cáo"}</button>
            <button onClick={onCancel}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: "#f6f5f4", color: "#787671" }}>Huỷ</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── HOOK: useThreadDetail ─────────────────────────────────────────────────────
// Toàn bộ fetch + mutate logic dùng chung giữa modal và trang full-page.

export function useThreadDetail(threadId: string | null, opts: {
  onRequireLogin: () => void;
  hasUser:        boolean;
  onLikeChange?:     (id: string, likedByMe: boolean, likeCount: number) => void;
  onBookmarkChange?: (id: string, bookmarkedByMe: boolean) => void;
}) {
  const { onRequireLogin, hasUser, onLikeChange, onBookmarkChange } = opts;

  const [thread, setThread]         = useState<ThreadDetail | null>(null);
  const [loading, setLoading]       = useState(false);
  const [notFound, setNotFound]     = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [liking, setLiking]         = useState(false);
  const [likeError, setLikeError]   = useState<string | null>(null);
  const [bookmarking, setBookmarking] = useState(false);

  const [replyText, setReplyText]     = useState("");
  const [replyImages, setReplyImages] = useState<File[]>([]);
  const [replying, setReplying]       = useState(false);
  const [replyUploading, setReplyUploading] = useState(false);
  const [replyError, setReplyError]   = useState("");

  const [reporting, setReporting]         = useState(false);
  const [reportReason, setReportReason]   = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone]       = useState(false);
  const [reportError, setReportError]     = useState("");

  const fetchThread = useCallback((id: string) => {
    setLoading(true);
    setNotFound(false);
    setFetchError(false);
    fetch(`/api/community/threads/${id}`, { credentials: "same-origin" })
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return; }
        if (!r.ok) throw new Error();
        setThread(await r.json());
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!threadId) { setThread(null); setNotFound(false); setFetchError(false); return; }
    fetchThread(threadId);
  }, [threadId, fetchThread]);

  // Polling nền + refetch khi quay lại tab/focus
  useEffect(() => {
    if (!threadId) return;
    function refresh() {
      fetch(`/api/community/threads/${threadId}`, { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : null)
        .then((d: ThreadDetail | null) => { if (d) setThread(d); })
        .catch(() => {});
    }
    const iv = setInterval(refresh, 30_000);
    function onVisible() { if (document.visibilityState === "visible") refresh(); }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [threadId]);

  async function handleLike() {
    if (!thread || liking) return;
    if (!hasUser) { onRequireLogin(); return; }
    setLiking(true); setLikeError(null);
    try {
      const res  = await fetch(`/api/community/threads/${thread.id}/like`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) {
        setThread(p => p ? { ...p, likedByMe: data.likedByMe, likeCount: data.likeCount } : p);
        onLikeChange?.(thread.id, data.likedByMe, data.likeCount);
      } else setLikeError(data.error ?? "Không thể thực hiện");
    } catch { setLikeError("Lỗi kết nối"); }
    finally { setLiking(false); }
  }

  async function handleBookmark() {
    if (!thread || bookmarking) return;
    if (!hasUser) { onRequireLogin(); return; }
    setBookmarking(true);
    try {
      const res  = await fetch(`/api/community/threads/${thread.id}/bookmark`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) {
        setThread(p => p ? { ...p, bookmarkedByMe: data.bookmarkedByMe } : p);
        onBookmarkChange?.(thread.id, data.bookmarkedByMe);
      }
    } catch { /* silent */ }
    finally { setBookmarking(false); }
  }

  async function handleReplyLike(replyId: string) {
    if (!hasUser) { onRequireLogin(); return; }
    try {
      const res  = await fetch(`/api/community/replies/${replyId}/like`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) setThread(p => p ? {
        ...p,
        replies: p.replies.map(r => r.id === replyId ? { ...r, likedByMe: data.likedByMe, likeCount: data.likeCount } : r),
      } : p);
    } catch { /* silent */ }
  }

  function handleReplyDelete(replyId: string) {
    setThread(p => p ? { ...p, replyCount: p.replyCount - 1, replies: p.replies.filter(r => r.id !== replyId) } : p);
  }

  // Trả về true nếu gửi thành công — để consumer tự cuộn/focus lại sau khi gửi
  async function handleReply(): Promise<boolean> {
    if (!thread || !replyText.trim()) { setReplyError("Nội dung không được để trống"); return false; }
    setReplyError("");

    let imageUrls: string[] = [];
    if (replyImages.length > 0) {
      if (!cloudinaryConfigured) { setReplyError("Chưa cấu hình Cloudinary để upload ảnh"); return false; }
      setReplyUploading(true);
      try { imageUrls = await uploadMany(replyImages, "community/images"); }
      catch (e) { setReplyError((e as Error).message); setReplyUploading(false); return false; }
      setReplyUploading(false);
    }

    setReplying(true);
    try {
      const res  = await fetch(`/api/community/threads/${thread.id}/reply`, {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ content: replyText, imageUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi gửi");
      setThread(p => p ? { ...p, replyCount: p.replyCount + 1, replies: [...p.replies, data] } : p);
      if (data.coinsEarned > 0) {
        window.dispatchEvent(new CustomEvent("coin:earned", { detail: { amount: data.coinsEarned } }));
      }
      setReplyText(""); setReplyImages([]);
      return true;
    } catch (e) {
      setReplyError(e instanceof TypeError ? "Lỗi kết nối" : (e as Error).message);
      return false;
    } finally {
      setReplying(false);
    }
  }

  async function handleReport() {
    if (!thread) return;
    if (!reportReason.trim()) { setReportError("Vui lòng nêu lý do báo cáo"); return; }
    setReportSending(true);
    setReportError("");
    try {
      const res  = await fetch(`/api/community/threads/${thread.id}/report`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: reportReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi gửi báo cáo");
      setReportDone(true);
      setTimeout(() => { setReporting(false); setReportDone(false); setReportReason(""); }, 1500);
    } catch (e) {
      setReportError((e as Error).message);
    } finally {
      setReportSending(false);
    }
  }

  function cancelReport() {
    setReporting(false); setReportReason(""); setReportError("");
  }

  return {
    thread, loading, notFound, fetchError, refetch: () => threadId && fetchThread(threadId),
    liking, likeError, handleLike,
    bookmarking, handleBookmark,
    handleReplyLike, handleReplyDelete,
    replyText, setReplyText, replyImages, setReplyImages, replying, replyUploading, replyError, handleReply,
    reporting, setReporting, reportReason, setReportReason, reportSending, reportDone, reportError, handleReport, cancelReport,
  };
}
