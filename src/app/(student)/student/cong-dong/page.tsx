"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { uploadMany, cloudinaryConfigured } from "@/lib/cloudinary";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ThreadDTO {
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
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "hoi-dap",     label: "Hỏi đáp",    color: "#0068FF", bg: "#dbeafe" },
  { key: "kinh-nghiem", label: "Kinh nghiệm", color: "#16a34a", bg: "#dcfce7" },
  { key: "tai-lieu",    label: "Tài liệu",    color: "#b45309", bg: "#fef3c7" },
  { key: "goc-vui",     label: "Góc vui",     color: "#7c3aed", bg: "#ede9fe" },
] as const;

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c])) as Record<
  string, { key: string; label: string; color: string; bg: string }
>;

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
  const display = name || "?";
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(display) }}>
      {display[0].toUpperCase()}
    </div>
  );
}

function CatBadge({ cat }: { cat: string }) {
  const c = CAT_MAP[cat] ?? { label: cat, color: "#787671", bg: "#f6f5f4" };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: c.bg, color: c.color }}>{c.label}</span>
  );
}

// ─── MEDIA GRID ───────────────────────────────────────────────────────────────

function MediaGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  const count = urls.length;
  if (count === 1) return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ maxHeight: 320 }}>
      <img src={urls[0]} alt="" className="w-full object-cover" style={{ maxHeight: 320 }} />
    </div>
  );
  if (count === 2) return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ height: 200 }}>
      {urls.map((u, i) => <img key={i} src={u} alt="" className="w-full h-full object-cover" />)}
    </div>
  );
  if (count === 3) return (
    <div className="mt-3 gap-1 rounded-xl overflow-hidden" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", height: 200 }}>
      <img src={urls[0]} alt="" className="w-full h-full object-cover" style={{ gridRow: "1/3" }} />
      <img src={urls[1]} alt="" className="w-full h-full object-cover" />
      <img src={urls[2]} alt="" className="w-full h-full object-cover" />
    </div>
  );
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ height: 200 }}>
      {urls.slice(0, 4).map((u, i) => (
        <div key={i} className="relative overflow-hidden">
          <img src={u} alt="" className="w-full h-full object-cover" />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xl"
              style={{ background: "rgba(0,0,0,0.45)" }}>+{count - 4}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function FileChip({ url, name }: { url: string; name: string | null }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mt-2"
      style={{ background: "#f6f5f4", color: "#37352f", border: "1px solid #e5e3df" }}>
      <span>📎</span>
      <span className="truncate max-w-[200px]">{name ?? "Tệp đính kèm"}</span>
    </a>
  );
}

// ─── IMAGE PREVIEWS (in form) ─────────────────────────────────────────────────

function ImagePreviews({ images, onRemove }: { images: File[]; onRemove: (i: number) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-3">
      {images.map((img, i) => {
        const url = URL.createObjectURL(img);
        return (
          <div key={i} className="relative rounded-lg overflow-hidden flex-shrink-0"
            style={{ width: 80, height: 80 }}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "rgba(0,0,0,0.55)" }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── MEDIA PICKER (in form) ───────────────────────────────────────────────────

function MediaPicker({ images, file, onImages, onFile, disabled }: {
  images:   File[];
  file:     File | null;
  onImages: (imgs: File[]) => void;
  onFile:   (f: File | null) => void;
  disabled: boolean;
}) {
  const imgRef  = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addImages(list: FileList | null) {
    if (!list) return;
    const valid = Array.from(list).filter(f => f.type.startsWith("image/"));
    onImages([...images, ...valid].slice(0, 4));
  }

  return (
    <div className="flex items-center gap-3 mt-3 pt-2.5" style={{ borderTop: "1px solid #f6f5f4" }}>
      <button type="button" onClick={() => imgRef.current?.click()}
        disabled={images.length >= 4 || disabled}
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition-all"
        style={{ background: "#f6f5f4", color: "#37352f" }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Ảnh{images.length > 0 ? ` (${images.length}/4)` : ""}
      </button>
      <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { addImages(e.target.files); e.target.value = ""; }} />

      <button type="button" onClick={() => fileRef.current?.click()}
        disabled={!!file || disabled}
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition-all"
        style={{ background: "#f6f5f4", color: "#37352f" }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        Tệp{file ? ` (${file.name.slice(0, 10)}…)` : ""}
      </button>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ""; }} />

      {!cloudinaryConfigured && (
        <span className="text-xs" style={{ color: "#b45309" }}>⚠ Cần cấu hình Cloudinary để dùng ảnh/tệp</span>
      )}
    </div>
  );
}

// ─── POST FORM ────────────────────────────────────────────────────────────────

function PostForm({ user, onPost }: {
  user:   { name: string };
  onPost: (t: ThreadDTO) => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [content, setContent]     = useState("");
  const [category, setCategory]   = useState("hoi-dap");
  const [images, setImages]       = useState<File[]>([]);
  const [file, setFile]           = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting]     = useState(false);
  const [error, setError]         = useState("");

  function reset() {
    setContent(""); setCategory("hoi-dap"); setImages([]); setFile(null);
    setError(""); setExpanded(false);
  }

  async function handlePost() {
    if (!content.trim()) { setError("Hãy nhập nội dung bài viết"); return; }
    setError("");

    let imageUrls: string[] = [];
    let fileUrl:   string | null = null;
    let fileName:  string | null = null;

    if ((images.length > 0 || file) && !cloudinaryConfigured) {
      setError("Chưa cấu hình Cloudinary. Hãy thêm NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME và UPLOAD_PRESET vào .env");
      return;
    }

    try {
      if (images.length > 0 || file) {
        setUploading(true);
        if (images.length > 0) imageUrls = await uploadMany(images, "community/images");
        if (file) {
          const { uploadToCloudinary } = await import("@/lib/cloudinary");
          const r = await uploadToCloudinary(file, "community/files");
          fileUrl  = r.url;
          fileName = file.name;
        }
        setUploading(false);
      }

      setPosting(true);
      const res  = await fetch("/api/community/threads", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ content, category, imageUrls, fileUrl, fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi đăng bài");
      onPost(data as ThreadDTO);
      if (data.coinsEarned > 0) {
        window.dispatchEvent(new CustomEvent("coin:earned", { detail: { amount: data.coinsEarned } }));
      }
      reset();
    } catch (e) {
      setUploading(false);
      setError(e instanceof TypeError ? "Lỗi kết nối" : (e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  if (!expanded) return (
    <div className="rounded-xl border px-4 py-3 flex items-center gap-3 cursor-text"
      style={{ background: "#ffffff", borderColor: "#e5e3df" }}
      onClick={() => setExpanded(true)}>
      <Avatar name={user.name} size={34} />
      <span className="text-sm flex-1" style={{ color: "#a4a097" }}>
        Chia sẻ điều gì đó với cộng đồng...
      </span>
      <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
        style={{ background: "#dbeafe", color: "#0068FF" }}>Đăng bài</span>
    </div>
  );

  return (
    <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#0068FF40" }}>
      <div className="flex gap-3">
        <Avatar name={user.name} size={34} />
        <div className="flex-1 min-w-0">
          <textarea rows={4} maxLength={2000} value={content} autoFocus
            onChange={e => { setContent(e.target.value); setError(""); }}
            placeholder="Chia sẻ kiến thức, hỏi bài, hoặc kể chuyện vui..."
            className="w-full text-sm rounded-lg px-3 py-2.5 outline-none resize-none"
            style={{ background: "#f6f5f4", color: "#1a1a1a", border: "none" }} />

          <ImagePreviews images={images} onRemove={i => setImages(p => p.filter((_, idx) => idx !== i))} />

          {file && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
              <span className="text-xs font-medium truncate max-w-[160px]" style={{ color: "#37352f" }}>
                📎 {file.name}
              </span>
              <button onClick={() => setFile(null)} className="text-xs font-bold" style={{ color: "#a4a097" }}>✕</button>
            </div>
          )}

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap mt-3">
            {CATEGORIES.map(c => (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: category === c.key ? c.bg : "#f6f5f4",
                  color:      category === c.key ? c.color : "#787671",
                  border:     category === c.key ? `1px solid ${c.color}40` : "1px solid transparent",
                }}>
                {c.label}
              </button>
            ))}
          </div>

          <MediaPicker images={images} file={file} onImages={setImages} onFile={setFile}
            disabled={uploading || posting} />

          {error && <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{error}</p>}

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs" style={{ color: "#a4a097" }}>{content.length}/2000</span>
            <div className="flex gap-2">
              <button onClick={reset}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold"
                style={{ background: "#f6f5f4", color: "#787671" }}>Huỷ</button>
              <button onClick={handlePost} disabled={posting || uploading || !content.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#0068FF" }}>
                {uploading ? "Đang upload..." : posting ? "Đang đăng..." : "Đăng bài"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── THREAD CARD ──────────────────────────────────────────────────────────────

function ThreadCard({ thread: t, onLike, onBookmark, onDelete, currentUser }: {
  thread:      ThreadDTO;
  onLike:      (id: string) => void;
  onBookmark:  (id: string) => void;
  onDelete:    (id: string) => void;
  currentUser: { id: string; role?: string } | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [copied, setCopied]               = useState(false);

  const isOwn   = currentUser?.id === t.author.id;
  const isAdmin = currentUser?.role === "admin";

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/community/threads/${t.id}`, { method: "DELETE", credentials: "same-origin" });
    if (res.ok) onDelete(t.id);
    setDeleting(false);
    setConfirmDelete(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/student/cong-dong/${t.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className="rounded-xl border p-4"
      style={{ background: "#ffffff", borderColor: t.isPinned ? "#bfdbfe" : "#e5e3df" }}>

      {t.isPinned && (
        <p className="text-xs font-semibold mb-2" style={{ color: "#0068FF" }}>📌 Bài ghim</p>
      )}

      {/* Author */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={t.author.name} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{t.author.name}</span>
              {t.author.isTeacher && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: "#fef3c7", color: "#b45309" }}>Giáo viên</span>
              )}
              <CatBadge cat={t.category} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#a4a097" }}>{timeAgo(t.createdAt)}</p>
          </div>
        </div>
        {(isOwn || isAdmin) && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1 rounded flex-shrink-0"
            style={{ color: "#a4a097" }}>✕</button>
        )}
        {confirmDelete && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={handleDelete} disabled={deleting}
              className="text-xs px-2.5 py-1 rounded-lg font-bold text-white disabled:opacity-50"
              style={{ background: "#dc2626" }}>{deleting ? "..." : "Xoá"}</button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: "#f6f5f4", color: "#787671" }}>Huỷ</button>
          </div>
        )}
      </div>

      {/* Content */}
      <Link href={`/student/cong-dong/${t.id}`} className="block mt-3">
        <p className="text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap" style={{ color: "#37352f" }}>
          {t.content}
        </p>
        <MediaGrid urls={t.imageUrls} />
        {t.fileUrl && <FileChip url={t.fileUrl} name={t.fileName} />}
      </Link>

      {/* Action bar */}
      <div className="flex items-center gap-0.5 mt-3 pt-2" style={{ borderTop: "1px solid #f6f5f4" }}>
        {/* Like */}
        <button onClick={() => onLike(t.id)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
          style={{ color: t.likedByMe ? "#dc2626" : "#a4a097" }}>
          <span className="text-base leading-none">{t.likedByMe ? "♥" : "♡"}</span>
          <span className="text-xs font-semibold">{t.likeCount}</span>
        </button>

        {/* Reply */}
        <Link href={`/student/cong-dong/${t.id}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ color: "#a4a097" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-semibold">{t.replyCount}</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bookmark */}
        <button onClick={() => onBookmark(t.id)}
          className="px-2.5 py-1.5 rounded-lg transition-colors"
          title={t.bookmarkedByMe ? "Bỏ lưu" : "Lưu bài"}
          style={{ color: t.bookmarkedByMe ? "#0068FF" : "#a4a097" }}>
          {t.bookmarkedByMe
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
    </article>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function CongDongPage() {
  const { user } = useAuth();

  const [threads, setThreads]         = useState<ThreadDTO[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor]   = useState<string | null>(null);
  const [fetchError, setFetchError]   = useState(false);
  const [catFilter, setCatFilter]     = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const q   = catFilter === "all" ? "" : `&category=${catFilter}`;
      const res = await fetch(`/api/community/threads?limit=20${q}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setThreads(data.threads);
      setNextCursor(data.nextCursor);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [catFilter]);

  // Refetch âm thầm trang đầu — gộp bài mới vào đầu, giữ lại các bài đã "Tải thêm" phía dưới
  const refreshSilent = useCallback(async () => {
    try {
      const q   = catFilter === "all" ? "" : `&category=${catFilter}`;
      const res = await fetch(`/api/community/threads?limit=20${q}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      const freshIds = new Set((data.threads as ThreadDTO[]).map(t => t.id));
      setThreads(prev => [...data.threads, ...prev.filter(t => !freshIds.has(t.id))]);
    } catch { /* silent */ }
  }, [catFilter]);

  useEffect(() => { load(); }, [load]);

  // Polling 30s + refetch ngay khi quay lại tab, để bài viết mới từ học viên khác tự hiện ra
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
    try {
      const q   = catFilter === "all" ? "" : `&category=${catFilter}`;
      const res = await fetch(
        `/api/community/threads?limit=20&cursor=${encodeURIComponent(nextCursor)}${q}`,
        { credentials: "same-origin" },
      );
      const data = await res.json();
      setThreads(prev => {
        const seen = new Set(prev.map(t => t.id));
        return [...prev, ...data.threads.filter((t: ThreadDTO) => !seen.has(t.id))];
      });
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleLike(id: string) {
    try {
      const res  = await fetch(`/api/community/threads/${id}/like`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) setThreads(prev => prev.map(t => t.id === id
        ? { ...t, likedByMe: data.likedByMe, likeCount: data.likeCount } : t));
    } catch { /* silent */ }
  }

  async function handleBookmark(id: string) {
    try {
      const res  = await fetch(`/api/community/threads/${id}/bookmark`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) setThreads(prev => prev.map(t => t.id === id
        ? { ...t, bookmarkedByMe: data.bookmarkedByMe } : t));
    } catch { /* silent */ }
  }

  const currentUser = user ? { id: user.id, role: user.role as string } : null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      <div>
        <h1 className="text-xl font-bold" style={{ color: "#1a1a1a" }}>Cộng đồng</h1>
        <p className="text-sm" style={{ color: "#787671" }}>Trao đổi, hỏi đáp, chia sẻ kinh nghiệm</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ key: "all", label: "Tất cả", color: "#0068FF", bg: "#dbeafe" }, ...CATEGORIES].map(c => (
          <button key={c.key} onClick={() => setCatFilter(c.key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: catFilter === c.key ? c.bg : "#f6f5f4",
              color:      catFilter === c.key ? c.color : "#787671",
              border:     catFilter === c.key ? `1px solid ${c.color}40` : "1px solid #e5e3df",
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Post form */}
      {user && <PostForm user={user} onPost={t => setThreads(prev => [t, ...prev])} />}

      {/* Error */}
      {fetchError && (
        <div className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
          <span className="text-sm font-semibold" style={{ color: "#dc2626" }}>Lỗi tải dữ liệu</span>
          <button onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: "#dc2626" }}>Thử lại</button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: "#e5e3df" }} />
          ))}
        </div>
      )}

      {/* Thread list */}
      {!loading && threads.map(t => (
        <ThreadCard key={t.id} thread={t} onLike={handleLike} onBookmark={handleBookmark}
          onDelete={id => setThreads(prev => prev.filter(x => x.id !== id))}
          currentUser={currentUser} />
      ))}

      {/* Empty */}
      {!loading && !fetchError && threads.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold mb-1" style={{ color: "#1a1a1a" }}>Chưa có bài viết nào</p>
          <p className="text-sm" style={{ color: "#787671" }}>Hãy là người đầu tiên chia sẻ!</p>
        </div>
      )}

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="text-center pb-4">
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
