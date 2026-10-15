"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  CAT_MAP, timeAgo, Avatar, MediaGrid, Lightbox, ReplyCard, ReplyForm, ReportPanel, useThreadDetail,
} from "@/components/community/ThreadDetailShared";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { KinBookmark } from "@/components/kin/Bookmark";

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
  const router   = useRouter();

  const [mounted, setMounted]         = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef  = useRef<HTMLDivElement>(null);

  function requireLogin() {
    onClose();
    router.push(`/dang-nhap?redirect=/cong-dong/${threadId}`);
  }

  const {
    thread, loading, notFound, fetchError, refetch,
    liking, handleLike,
    bookmarking, handleBookmark,
    handleReplyLike, handleReplyDelete,
    replyText, setReplyText, replyImages, setReplyImages, replying, replyUploading, replyError, handleReply,
    reporting, setReporting, reportReason, setReportReason, reportSending, reportDone, reportError, handleReport, cancelReport,
  } = useThreadDetail(threadId, {
    onRequireLogin: requireLogin,
    hasUser:        !!user,
    onLikeChange:     onLikeUpdate,
    onBookmarkChange: onBookmarkUpdate,
  });

  useEffect(() => { setMounted(true); }, []);

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

  async function submitReply() {
    const ok = await handleReply();
    if (ok) {
      setTimeout(() => {
        replyRef.current?.focus();
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }


  if (!threadId || !mounted) return null;

  const cat = thread ? (CAT_MAP[thread.category] ?? { label: thread.category, color: "var(--kin-chu-mo)", bg: "var(--kin-nen-bang)" }) : null;
  const hasError = fetchError || notFound;

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
            background: "var(--kin-nen-trang)",
            maxHeight: "92dvh",
            animation: "modalSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: "var(--kin-vien-thuong)" }} />
          </div>

          {/* Sticky header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--kin-chu-phu)" }}>Bài viết</span>
              {cat && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all hover:bg-gray-100"
              style={{ color: "var(--kin-chu-mo)" }}>✕</button>
          </div>

          {/* Scrollable body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">

            {/* Loading skeleton */}
            {loading && (
              <div className="p-5 space-y-3">
                {[85, 70, 90, 60, 75].map((w, i) => (
                  <div key={i} className="h-4 rounded-lg animate-pulse"
                    style={{ background: "var(--kin-vien-thuong)", width: `${w}%` }} />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && hasError && (
              <div className="p-8 text-center">
                <p className="text-2xl mb-3">⚠️</p>
                <p className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>
                  {notFound ? "Không tìm thấy bài viết" : "Không thể tải bài viết"}
                </p>
                {!notFound && (
                  <button onClick={refetch}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: "var(--kin-nhan-nen)" }}>Thử lại</button>
                )}
              </div>
            )}

            {/* Content */}
            {!loading && !hasError && thread && (
              <div className="p-5 space-y-4">

                {thread.isPinned && (
                  <p className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>📌 Ghim bởi Admin</p>
                )}

                {/* Author */}
                <div className="flex items-center gap-2.5">
                  <Avatar name={thread.author.name} size={38} />
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{thread.author.name}</span>
                      {thread.author.isTeacher && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>Gia sư</span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{timeAgo(thread.createdAt)}</p>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>
                  {thread.content}
                </p>

                {thread.imageUrls.length > 0 && (
                  <MediaGrid urls={thread.imageUrls} onClick={i => setLightboxIdx(i)} />
                )}

                {thread.fileUrl && (
                  <a href={thread.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>
                    📎 <span className="truncate max-w-[220px]">{thread.fileName ?? "Tệp đính kèm"}</span>
                  </a>
                )}

                {/* Actions */}
                <div className="pt-3 flex items-center gap-0.5" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
                  <button onClick={handleLike} disabled={liking}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
                    style={{ color: thread.likedByMe ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-mo)" }}>
                    <span className="text-lg leading-none">{thread.likedByMe ? "♥" : "♡"}</span>
                    <span className="font-semibold">{thread.likeCount}</span>
                  </button>

                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm" style={{ color: "var(--kin-chu-mo)" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="font-medium">{thread.replyCount} trả lời</span>
                  </span>

                  <div className="flex-1" />

                  <KinBookmark on={thread.bookmarkedByMe} onToggle={handleBookmark} busy={bookmarking} />

                  <KinCopyButton size="sm" label="Chia sẻ — sao chép liên kết bài viết" text={() => `${window.location.origin}/cong-dong/${thread.id}`} />

                  {user && user.id !== thread.author.id && (
                    <button onClick={() => setReporting(p => !p)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      title="Báo cáo bài viết"
                      style={{ color: reporting ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-mo)" }}>🚩</button>
                  )}
                </div>

                <ReportPanel
                  reporting={reporting} reportReason={reportReason} setReportReason={setReportReason}
                  reportSending={reportSending} reportDone={reportDone} reportError={reportError}
                  onSubmit={handleReport} onCancel={cancelReport}
                />

                {/* Replies divider */}
                {thread.replies.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: "var(--kin-vien-thuong)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>
                      {thread.replies.length} trả lời
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--kin-vien-thuong)" }} />
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
                  <ReplyForm
                    user={user} threadAuthorName={thread.author.name}
                    replyText={replyText} setReplyText={setReplyText}
                    replyImages={replyImages} setReplyImages={setReplyImages}
                    replyError={replyError} uploading={replyUploading} replying={replying}
                    onSubmit={submitReply} wrapperBg="var(--kin-nen-bang)" textareaBg="var(--kin-nen-trang)" inputRef={replyRef}
                  />
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
