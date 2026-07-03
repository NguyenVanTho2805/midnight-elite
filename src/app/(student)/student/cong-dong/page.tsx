"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { uploadMany, cloudinaryConfigured } from "@/lib/cloudinary";
import { QUESTION_COST } from "@/lib/wallet-constants";
import ThreadModal from "@/components/ThreadModal";
import QuestionModal from "@/components/QuestionModal";

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

interface QuestionDTO {
  id:          string;
  title:       string;
  content:     string;
  bountyPaid:  number;
  status:      string;
  createdAt:   string;
  author:      { id: string; name: string };
  answerCount: number;
  isOwn:       boolean;
}

type FeedItem =
  | (ThreadDTO   & { _type: "thread" })
  | (QuestionDTO & { _type: "question" });

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const THREAD_CATS = [
  { key: "kinh-nghiem", label: "Chia sẻ",    color: "#16a34a", bg: "#dcfce7" },
  { key: "hoi-dap",     label: "Hỏi nhanh",  color: "#0068FF", bg: "#dbeafe" },
  { key: "tai-lieu",    label: "Tài liệu",    color: "#b45309", bg: "#fef3c7" },
  { key: "goc-vui",     label: "Góc vui",     color: "#7c3aed", bg: "#ede9fe" },
] as const;

const CAT_MAP = Object.fromEntries(THREAD_CATS.map(c => [c.key, c])) as Record<
  string, { key: string; label: string; color: string; bg: string }
>;

const TABS = [
  { key: "all",          label: "Tất cả"       },
  { key: "hoi-dap-qa",  label: "🏅 Hỏi đáp"   },
  { key: "kinh-nghiem", label: "Chia sẻ"       },
  { key: "tai-lieu",    label: "Tài liệu"      },
  { key: "goc-vui",     label: "Góc vui"       },
] as const;

type TabKey = typeof TABS[number]["key"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#0068FF","#dc2626","#16a34a","#b45309","#7c3aed","#0891b2","#be185d"];
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

function mergeFeed(threads: ThreadDTO[], questions: QuestionDTO[]): FeedItem[] {
  const pinned = threads
    .filter(t => t.isPinned)
    .map(t => ({ ...t, _type: "thread" as const }));
  const rest: FeedItem[] = [
    ...threads.filter(t => !t.isPinned).map(t => ({ ...t, _type: "thread" as const })),
    ...questions.map(q => ({ ...q, _type: "question" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return [...pinned, ...rest];
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

function CatBadge({ cat }: { cat: string }) {
  const c = CAT_MAP[cat] ?? { label: cat, color: "#787671", bg: "#f6f5f4" };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: c.bg, color: c.color }}>{c.label}</span>
  );
}

// ─── MEDIA (thread only) ──────────────────────────────────────────────────────

function MediaGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  const n = urls.length;
  if (n === 1) return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ maxHeight: 320 }}>
      <img src={urls[0]} alt="" className="w-full object-cover" style={{ maxHeight: 320 }} />
    </div>
  );
  if (n === 2) return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden" style={{ height: 200 }}>
      {urls.map((u, i) => <img key={i} src={u} alt="" className="w-full h-full object-cover" />)}
    </div>
  );
  if (n === 3) return (
    <div className="mt-3 gap-1 rounded-xl overflow-hidden"
      style={{ display: "grid", gridTemplateColumns: "2fr 1fr", height: 200 }}>
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
          {i === 3 && n > 4 && (
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xl"
              style={{ background: "rgba(0,0,0,0.45)" }}>+{n - 4}</div>
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
      📎 <span className="truncate max-w-[200px]">{name ?? "Tệp đính kèm"}</span>
    </a>
  );
}

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

function MediaPicker({ images, file, onImages, onFile, disabled }: {
  images: File[]; file: File | null;
  onImages: (imgs: File[]) => void; onFile: (f: File | null) => void; disabled: boolean;
}) {
  const imgRef  = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  function addImages(list: FileList | null) {
    if (!list) return;
    onImages([...images, ...Array.from(list).filter(f => f.type.startsWith("image/"))].slice(0, 4));
  }
  return (
    <div className="flex items-center gap-3 mt-3 pt-2.5" style={{ borderTop: "1px solid #f6f5f4" }}>
      <button type="button" onClick={() => imgRef.current?.click()} disabled={images.length >= 4 || disabled}
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-40"
        style={{ background: "#f6f5f4", color: "#37352f" }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Ảnh{images.length > 0 ? ` (${images.length}/4)` : ""}
      </button>
      <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { addImages(e.target.files); e.target.value = ""; }} />

      <button type="button" onClick={() => fileRef.current?.click()} disabled={!!file || disabled}
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-40"
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
        <span className="text-xs" style={{ color: "#b45309" }}>⚠ Cần cấu hình Cloudinary</span>
      )}
    </div>
  );
}

// ─── POST FORM ────────────────────────────────────────────────────────────────

type PostType = "thread" | "question";

function PostForm({ user, balance, onThread, onQuestion }: {
  user:       { name: string };
  balance:    number;
  onThread:   (t: ThreadDTO) => void;
  onQuestion: (q: QuestionDTO) => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [postType, setPostType]   = useState<PostType>("thread");
  const [title, setTitle]         = useState("");
  const [content, setContent]     = useState("");
  const [category, setCategory]   = useState("kinh-nghiem");
  const [images, setImages]       = useState<File[]>([]);
  const [file, setFile]           = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting]     = useState(false);
  const [error, setError]         = useState("");

  function reset() {
    setContent(""); setTitle(""); setCategory("kinh-nghiem");
    setImages([]); setFile(null); setError(""); setExpanded(false); setPostType("thread");
  }

  async function handlePost() {
    if (postType === "question") {
      if (!title.trim()) { setError("Hãy nhập tiêu đề câu hỏi"); return; }
      if (!content.trim()) { setError("Hãy nhập chi tiết câu hỏi"); return; }
      if (balance < QUESTION_COST) { setError(`Bạn cần ít nhất ${QUESTION_COST} xu để đặt câu hỏi`); return; }
    } else {
      if (!content.trim()) { setError("Hãy nhập nội dung bài viết"); return; }
    }
    setError("");

    try {
      if (postType === "question") {
        setPosting(true);
        const res  = await fetch("/api/questions", {
          method:      "POST",
          credentials: "same-origin",
          headers:     { "Content-Type": "application/json" },
          body:        JSON.stringify({ title, content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Lỗi đặt câu hỏi");
        onQuestion({ ...data, author: { id: "", name: user.name }, answerCount: 0, isOwn: true });
        reset();
        return;
      }

      // Thread
      let imageUrls: string[] = [];
      let fileUrl:   string | null = null;
      let fileName:  string | null = null;

      if ((images.length > 0 || file) && !cloudinaryConfigured) {
        setError("Chưa cấu hình Cloudinary để dùng ảnh/tệp");
        return;
      }
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
      onThread(data as ThreadDTO);
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
      <span className="text-sm flex-1" style={{ color: "#a4a097" }}>Chia sẻ hoặc đặt câu hỏi...</span>
      <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
        style={{ background: "#dbeafe", color: "#0068FF" }}>Đăng bài</span>
    </div>
  );

  return (
    <div className="rounded-xl border p-4"
      style={{ background: "#ffffff", borderColor: postType === "question" ? "#f59e0b40" : "#0068FF40" }}>

      {/* Type selector */}
      <div className="flex gap-1.5 mb-3 p-1 rounded-lg" style={{ background: "#f6f5f4" }}>
        <button type="button" onClick={() => setPostType("thread")}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={postType === "thread"
            ? { background: "#ffffff", color: "#0068FF", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
            : { background: "transparent", color: "#787671" }}>
          Đăng bài
        </button>
        <button type="button" onClick={() => setPostType("question")}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
          style={postType === "question"
            ? { background: "#ffffff", color: "#b45309", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
            : { background: "transparent", color: "#787671" }}>
          🏅 Hỏi đáp (−{QUESTION_COST} xu)
        </button>
      </div>

      <div className="flex gap-3">
        <Avatar name={user.name} size={34} />
        <div className="flex-1 min-w-0">

          {/* Question title */}
          {postType === "question" && (
            <input
              maxLength={200} value={title} autoFocus
              onChange={e => { setTitle(e.target.value); setError(""); }}
              placeholder="Tiêu đề câu hỏi (ngắn gọn, rõ ý)..."
              className="w-full text-sm font-semibold rounded-lg px-3 py-2.5 outline-none mb-2"
              style={{ background: "#f6f5f4", color: "#1a1a1a", border: "none" }}
            />
          )}

          <textarea
            rows={postType === "question" ? 4 : 4}
            maxLength={2000}
            value={content}
            autoFocus={postType === "thread"}
            onChange={e => { setContent(e.target.value); setError(""); }}
            placeholder={postType === "question"
              ? "Mô tả chi tiết câu hỏi, ngữ cảnh, những gì bạn đã thử..."
              : "Chia sẻ kiến thức, kinh nghiệm, hay kể chuyện vui..."}
            className="w-full text-sm rounded-lg px-3 py-2.5 outline-none resize-none"
            style={{ background: "#f6f5f4", color: "#1a1a1a", border: "none" }}
          />

          {/* Thread-only: media + category */}
          {postType === "thread" && (
            <>
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
              <div className="flex gap-2 flex-wrap mt-3">
                {THREAD_CATS.map(c => (
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
            </>
          )}

          {/* Question-only: bounty info */}
          {postType === "question" && (
            <div className="mt-3 px-3 py-2.5 rounded-lg flex items-start gap-2"
              style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
              <span className="text-base leading-none flex-shrink-0">🪙</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: "#92400e" }}>
                  Trừ {QUESTION_COST} xu · Số dư hiện tại: {balance} xu
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#b45309" }}>
                  Người trả lời được chấp nhận sẽ nhận 20 xu thưởng. Câu hỏi được đặt ẩn danh với gia sư.
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-xs mt-2" style={{ color: "#dc2626" }}>{error}</p>}

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs" style={{ color: "#a4a097" }}>{content.length}/2000</span>
            <div className="flex gap-2">
              <button onClick={reset}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold"
                style={{ background: "#f6f5f4", color: "#787671" }}>Huỷ</button>
              <button onClick={handlePost}
                disabled={posting || uploading || !content.trim() || (postType === "question" && !title.trim())}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: postType === "question" ? "#b45309" : "#0068FF" }}>
                {uploading ? "Đang upload..." : posting
                  ? "Đang đăng..."
                  : postType === "question" ? "Đặt câu hỏi" : "Đăng bài"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── THREAD CARD ──────────────────────────────────────────────────────────────

function ThreadCard({ thread: t, onLike, onBookmark, onDelete, onOpen, currentUser }: {
  thread:      ThreadDTO;
  onLike:      (id: string) => void;
  onBookmark:  (id: string) => void;
  onDelete:    (id: string) => void;
  onOpen:      (id: string) => void;
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

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={t.author.name} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{t.author.name}</span>
              {t.author.isTeacher && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: "#fef3c7", color: "#b45309" }}>Gia sư</span>
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

      <button className="block mt-3 w-full text-left cursor-pointer" onClick={() => onOpen(t.id)}>
        <p className="text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap" style={{ color: "#37352f" }}>
          {t.content}
        </p>
        <MediaGrid urls={t.imageUrls} />
        {t.fileUrl && <FileChip url={t.fileUrl} name={t.fileName} />}
      </button>

      <div className="flex items-center gap-0.5 mt-3 pt-2" style={{ borderTop: "1px solid #f6f5f4" }}>
        <button onClick={() => onLike(t.id)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
          style={{ color: t.likedByMe ? "#dc2626" : "#a4a097" }}>
          <span className="text-base leading-none">{t.likedByMe ? "♥" : "♡"}</span>
          <span className="text-xs font-semibold">{t.likeCount}</span>
        </button>

        <button onClick={() => onOpen(t.id)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ color: "#a4a097" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-semibold">{t.replyCount}</span>
        </button>

        <div className="flex-1" />

        <button onClick={() => onBookmark(t.id)}
          className="px-2.5 py-1.5 rounded-lg transition-colors"
          title={t.bookmarkedByMe ? "Bỏ lưu" : "Lưu bài"}
          style={{ color: t.bookmarkedByMe ? "#0068FF" : "#a4a097" }}>
          {t.bookmarkedByMe
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
    </article>
  );
}

// ─── QUESTION CARD ────────────────────────────────────────────────────────────

function QuestionCard({ q, onOpen }: { q: QuestionDTO; onOpen: (id: string) => void }) {
  const answered = q.status === "answered";
  return (
    <button className="block w-full text-left" onClick={() => onOpen(q.id)}>
      <article className="rounded-xl border p-4 transition-all hover:border-amber-300"
        style={{ background: "#ffffff", borderColor: answered ? "#bbf7d0" : "#fde68a" }}>

        <div className="flex items-start gap-2.5">
          <Avatar name={q.author.name} size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{q.author.name}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: answered ? "#dcfce7" : "#fffbeb", color: answered ? "#15803d" : "#92400e" }}>
                {answered ? "✓ Đã giải" : "Đang mở"}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#fffbeb", color: "#b45309" }}>
                🪙 {q.bountyPaid} xu
              </span>
            </div>
            <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1a1a" }}>{q.title}</p>
            <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "#787671" }}>{q.content}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs flex items-center gap-1" style={{ color: "#a4a097" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {q.answerCount} câu trả lời
              </span>
              <span className="text-xs" style={{ color: "#a4a097" }}>{timeAgo(q.createdAt)}</span>
            </div>
          </div>
        </div>
      </article>
    </button>
  );
}

// ─── PAGE (inner, uses useSearchParams) ──────────────────────────────────────

function CongDongInner() {
  const { user }             = useAuth();
  const { balance }          = useWallet();
  const searchParams         = useSearchParams();
  const router               = useRouter();

  const initialTab = (searchParams.get("tab") ?? "all") as TabKey;
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const [threads, setThreads]         = useState<ThreadDTO[]>([]);
  const [questions, setQuestions]     = useState<QuestionDTO[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor]   = useState<string | null>(null);
  const [fetchError, setFetchError]   = useState(false);
  const [openThreadId, setOpenThreadId]     = useState<string | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    if (tab === "all") router.replace("/student/cong-dong");
    else router.replace(`/student/cong-dong?tab=${tab}`);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const catParam = activeTab === "all" || activeTab === "hoi-dap-qa" ? "" : `&category=${activeTab}`;
      const [threadsRes, questionsRes] = await Promise.all([
        activeTab === "hoi-dap-qa"
          ? Promise.resolve(null)
          : fetch(`/api/community/threads?limit=30${catParam}`, { credentials: "same-origin" }),
        activeTab === "hoi-dap-qa" || activeTab === "all"
          ? fetch("/api/questions", { credentials: "same-origin" })
          : Promise.resolve(null),
      ]);

      if (threadsRes) {
        if (!threadsRes.ok) throw new Error();
        const d = await threadsRes.json();
        setThreads(d.threads);
        setNextCursor(d.nextCursor);
      } else {
        setThreads([]);
        setNextCursor(null);
      }

      if (questionsRes) {
        if (!questionsRes.ok) throw new Error();
        const d = await questionsRes.json();
        setQuestions(d);
      } else {
        setQuestions([]);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const refreshSilent = useCallback(async () => {
    try {
      const catParam = activeTab === "all" || activeTab === "hoi-dap-qa" ? "" : `&category=${activeTab}`;
      if (activeTab !== "hoi-dap-qa") {
        const res = await fetch(`/api/community/threads?limit=30${catParam}`, { credentials: "same-origin" });
        if (res.ok) {
          const d = await res.json();
          const freshIds = new Set((d.threads as ThreadDTO[]).map(t => t.id));
          setThreads(prev => [...d.threads, ...prev.filter(t => !freshIds.has(t.id))]);
        }
      }
      if (activeTab === "all" || activeTab === "hoi-dap-qa") {
        const res = await fetch("/api/questions", { credentials: "same-origin" });
        if (res.ok) {
          const d = await res.json();
          setQuestions(d);
        }
      }
    } catch { /* silent */ }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(refreshSilent, 30_000);
    function onVisible() { if (document.visibilityState === "visible") refreshSilent(); }
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
      const catParam = activeTab === "all" || activeTab === "hoi-dap-qa" ? "" : `&category=${activeTab}`;
      const res  = await fetch(
        `/api/community/threads?limit=20&cursor=${encodeURIComponent(nextCursor)}${catParam}`,
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

  // Compute feed items based on active tab
  const feedItems: FeedItem[] = (() => {
    if (activeTab === "hoi-dap-qa") {
      return questions.map(q => ({ ...q, _type: "question" as const }));
    }
    if (activeTab === "all") {
      return mergeFeed(threads, questions);
    }
    return threads.map(t => ({ ...t, _type: "thread" as const }));
  })();

  const currentUser = user ? { id: user.id, role: user.role as string } : null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      <div>
        <h1 className="text-xl font-bold" style={{ color: "#1a1a1a" }}>Cộng đồng</h1>
        <p className="text-sm" style={{ color: "#787671" }}>Trao đổi, hỏi đáp và chia sẻ kinh nghiệm</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => switchTab(tab.key)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
            style={activeTab === tab.key
              ? { background: "#0068FF", color: "#ffffff" }
              : { background: "#f6f5f4", color: "#787671", border: "1px solid #e5e3df" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Post form */}
      {user && (
        <PostForm
          user={user}
          balance={balance}
          onThread={t => {
            setThreads(prev => [t, ...prev]);
            if (activeTab !== "all" && activeTab !== t.category) setActiveTab("all");
          }}
          onQuestion={q => {
            setQuestions(prev => [q, ...prev]);
            if (activeTab !== "all" && activeTab !== "hoi-dap-qa") setActiveTab("hoi-dap-qa");
          }}
        />
      )}

      {/* Fetch error */}
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

      {/* Feed */}
      {!loading && feedItems.map(item =>
        item._type === "question"
          ? <QuestionCard key={`q-${item.id}`} q={item} onOpen={setOpenQuestionId} />
          : <ThreadCard key={`t-${item.id}`} thread={item}
              onLike={handleLike} onBookmark={handleBookmark}
              onDelete={id => setThreads(prev => prev.filter(x => x.id !== id))}
              onOpen={setOpenThreadId}
              currentUser={currentUser} />
      )}

      {/* Empty */}
      {!loading && !fetchError && feedItems.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">{activeTab === "hoi-dap-qa" ? "🏅" : "💬"}</p>
          <p className="font-semibold mb-1" style={{ color: "#1a1a1a" }}>
            {activeTab === "hoi-dap-qa" ? "Chưa có câu hỏi nào" : "Chưa có bài viết nào"}
          </p>
          <p className="text-sm" style={{ color: "#787671" }}>
            {activeTab === "hoi-dap-qa"
              ? `Đặt câu hỏi chỉ mất ${QUESTION_COST} xu, người trả lời hay nhận 20 xu!`
              : "Hãy là người đầu tiên chia sẻ!"}
          </p>
        </div>
      )}

      {/* Load more (chỉ có nghĩa với thread tabs) */}
      {nextCursor && !loading && activeTab !== "hoi-dap-qa" && (
        <div className="text-center pb-4">
          <button onClick={loadMore} disabled={loadingMore}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#0068FF" }}>
            {loadingMore ? "Đang tải..." : "Tải thêm"}
          </button>
        </div>
      )}

      {/* Modals */}
      <ThreadModal
        threadId={openThreadId}
        onClose={() => setOpenThreadId(null)}
        onLikeUpdate={(id, likedByMe, likeCount) =>
          setThreads(prev => prev.map(t => t.id === id ? { ...t, likedByMe, likeCount } : t))}
        onBookmarkUpdate={(id, bookmarkedByMe) =>
          setThreads(prev => prev.map(t => t.id === id ? { ...t, bookmarkedByMe } : t))}
      />
      <QuestionModal
        questionId={openQuestionId}
        onClose={() => setOpenQuestionId(null)}
      />
    </div>
  );
}

export default function CongDongPage() {
  return (
    <Suspense>
      <CongDongInner />
    </Suspense>
  );
}
