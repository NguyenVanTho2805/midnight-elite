"use client";

import { useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  CAT_MAP, timeAgo, Avatar, MediaGrid, Lightbox, ReplyCard, ReplyForm, ReportPanel, useThreadDetail,
} from "@/components/community/ThreadDetailShared";

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router   = useRouter();

  const [copied, setCopied]           = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  function requireLogin() {
    router.push(`/dang-nhap?redirect=/cong-dong/${id}`);
  }

  const {
    thread, loading, notFound, fetchError, refetch,
    liking, likeError, handleLike,
    bookmarking, handleBookmark,
    handleReplyLike, handleReplyDelete,
    replyText, setReplyText, replyImages, setReplyImages, replying, replyUploading, replyError, handleReply,
    reporting, setReporting, reportReason, setReportReason, reportSending, reportDone, reportError, handleReport, cancelReport,
  } = useThreadDetail(id, { onRequireLogin: requireLogin, hasUser: !!user });

  async function submitReply() {
    const ok = await handleReply();
    if (ok) setTimeout(() => replyRef.current?.focus(), 50);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/cong-dong/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {[100, 80, 60, 90, 70].map((w, i) => (
        <div key={i} className="h-4 rounded animate-pulse" style={{ background: "var(--hairline)", width: `${w}%` }} />
      ))}
    </div>
  );

  if (fetchError) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-3xl mb-3">⚠️</p>
      <h1 className="font-bold text-lg mb-1" style={{ color: "var(--ink)" }}>Không thể tải bài viết</h1>
      <p className="text-sm mb-5" style={{ color: "var(--steel)" }}>Lỗi kết nối hoặc server. Vui lòng thử lại.</p>
      <button onClick={refetch}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#5645d4" }}>
        Thử lại
      </button>
    </div>
  );

  if (notFound || !thread) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-3xl mb-3">💬</p>
      <h1 className="font-bold text-lg mb-1" style={{ color: "var(--ink)" }}>Không tìm thấy bài viết</h1>
      <p className="text-sm mb-5" style={{ color: "var(--steel)" }}>Bài viết đã bị xoá hoặc không tồn tại</p>
      <Link href="/cong-dong"
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white inline-block"
        style={{ background: "#5645d4" }}>← Quay lại Cộng đồng</Link>
    </div>
  );

  const cat = CAT_MAP[thread.category] ?? { label: thread.category, color: "var(--steel)", bg: "var(--surface)" };

  return (
    <>
      {lightboxIdx !== null && (
        <Lightbox urls={thread.imageUrls} initial={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Back */}
        <Link href="/cong-dong" className="flex items-center gap-1.5 text-sm font-medium w-fit"
          style={{ color: "var(--steel)" }}>← Cộng đồng</Link>

        {/* Thread card */}
        <div className="rounded-xl border p-5"
          style={{ background: "var(--canvas)", borderColor: thread.isPinned ? "var(--brand-purple-300)" : "var(--hairline)" }}>

          {thread.isPinned && (
            <p className="text-xs font-semibold mb-3" style={{ color: "#5645d4" }}>📌 Ghim bởi Admin</p>
          )}

          {/* Author */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Avatar name={thread.author.name} size={38} />
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{thread.author.name}</span>
                  {thread.author.isTeacher && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: "#fef3c7", color: "#b45309" }}>Gia sư</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "var(--stone)" }}>{timeAgo(thread.createdAt)}</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
          </div>

          {/* Content */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--charcoal)" }}>
            {thread.content}
          </p>

          {thread.imageUrls.length > 0 && (
            <MediaGrid urls={thread.imageUrls} onClick={i => setLightboxIdx(i)} />
          )}

          {thread.fileUrl && (
            <a href={thread.fileUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mt-3"
              style={{ background: "var(--surface)", color: "var(--charcoal)", border: "1px solid var(--hairline)" }}>
              <span>📎</span>
              <span className="truncate max-w-[220px]">{thread.fileName ?? "Tệp đính kèm"}</span>
            </a>
          )}

          {/* Actions */}
          <div className="pt-4 mt-4" style={{ borderTop: "1px solid var(--hairline)" }}>
            <div className="flex items-center gap-1">
              {/* Like */}
              <button onClick={handleLike} disabled={liking}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
                style={{ color: thread.likedByMe ? "#dc2626" : "var(--stone)" }}>
                <span className="text-lg leading-none">{thread.likedByMe ? "♥" : "♡"}</span>
                <span className="font-semibold">{thread.likeCount}</span>
              </button>

              {/* Reply count */}
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm" style={{ color: "var(--stone)" }}>
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
                style={{ color: thread.bookmarkedByMe ? "#5645d4" : "var(--stone)" }}>
                {thread.bookmarkedByMe
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-3.5L5 22V4z"/></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-3.5L5 22V4z"/></svg>
                }
              </button>

              {/* Share */}
              <button onClick={copyLink}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: copied ? "#16a34a" : "var(--stone)" }}>
                {copied
                  ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Đã sao chép</>
                  : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>Chia sẻ</>
                }
              </button>

              {user && user.id !== thread.author.id && (
                <button onClick={() => setReporting(p => !p)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  title="Báo cáo bài viết"
                  style={{ color: reporting ? "#dc2626" : "var(--stone)" }}>🚩</button>
              )}
            </div>
            {likeError && <p className="text-xs mt-1.5" style={{ color: "#dc2626" }}>{likeError}</p>}
          </div>

          {reporting && (
            <div className="mt-3">
              <ReportPanel
                reporting={reporting} reportReason={reportReason} setReportReason={setReportReason}
                reportSending={reportSending} reportDone={reportDone} reportError={reportError}
                onSubmit={handleReport} onCancel={cancelReport}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        {thread.replies.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--hairline)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--stone)" }}>{thread.replies.length} trả lời</span>
            <div className="flex-1 h-px" style={{ background: "var(--hairline)" }} />
          </div>
        )}

        {/* Replies */}
        <div className="space-y-4">
          {thread.replies.map(r => (
            <ReplyCard key={r.id} r={r} onLike={handleReplyLike} onDelete={handleReplyDelete} />
          ))}
        </div>

        {/* Reply form (logged in) */}
        {user ? (
          <ReplyForm
            user={user} threadAuthorName={thread.author.name}
            replyText={replyText} setReplyText={setReplyText}
            replyImages={replyImages} setReplyImages={setReplyImages}
            replyError={replyError} uploading={replyUploading} replying={replying}
            onSubmit={submitReply} wrapperBg="var(--canvas)" textareaBg="var(--surface)" inputRef={replyRef}
          />
        ) : (
          <div className="rounded-xl border p-4 flex items-center justify-between gap-3"
            style={{ background: "var(--canvas)", borderColor: "var(--hairline)" }}>
            <p className="text-sm" style={{ color: "var(--steel)" }}>Đăng nhập để trả lời bài viết này</p>
            <Link href={`/dang-nhap?redirect=/cong-dong/${id}`}
              className="flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#5645d4" }}>
              Đăng nhập
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
