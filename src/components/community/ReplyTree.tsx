"use client";
// BU-05 — cây trả lời kiểu Threads: cột đường thread 48px, avatar 36px, trả lời con thụt đúng 48px, CHỈ 1 cấp
// (nút "Trả lời" dưới một trả lời con vẫn gắn vào cha gốc). Trả lời đã xoá mềm còn con → một dòng mờ "Trả lời đã bị xoá" giữ chỗ đường.
// Gia sư (đã xác minh) có thẻ "Gia sư" và liên kết hồ sơ; "Chọn là đúng" chỉ hiện khi người xem có quyền (canAccept từ máy chủ).
import { useRef, useState } from "react";
import { KinButton, KinStatus } from "@/components/kin";
import { uploadMany } from "@/lib/cloudinary";
import type { ReplyNode } from "@/lib/communityTypes";
import { AuthorLine } from "./AuthorLine";
import { ImagePicker } from "./ImagePicker";
import { MediaGrid } from "./MediaGrid";
import { ThreadCol } from "./ThreadLine";
import { HeartIcon, CommentIcon } from "./Icons";
import { MAX_REPLY, timeAgo } from "./format";

export type ReplyHandlers = {
  signedIn: boolean;
  /** Người xem được chọn đáp án (chỉ có nghĩa với câu hỏi). */
  canAccept: boolean;
  onReplyTo: (rootId: string, label: string) => void;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onAccept: (id: string) => void;
};

function ReplyRow({ node, rootId, line, h }: { node: ReplyNode; rootId: string; line: boolean; h: ReplyHandlers }) {
  if (node.deleted) {
    return (
      <div className="kc-card" data-flat id={`r-${node.id}`} data-kc-reply="deleted">
        <ThreadCol label="" line={line} ghost />
        <p className="kc-body kc-meta" style={{ fontStyle: "italic", paddingTop: 8 }}>Trả lời đã bị xoá</p>
      </div>
    );
  }
  return (
    <div className="kc-card" data-flat id={`r-${node.id}`} data-kc-reply={node.isAccepted ? "accepted" : "reply"}>
      <ThreadCol label={node.author.label} line={line} />
      <div className="kc-body">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <AuthorLine author={node.author} />
          <time className="kc-meta" dateTime={node.createdAt}>{timeAgo(node.createdAt)}</time>
        </div>
        {node.isAccepted && <div className="mt-1"><KinStatus tone="xong">Đáp án đúng</KinStatus></div>}
        <p className="kc-text mt-1">{node.content}</p>
        <MediaGrid urls={node.imageUrls} />
        <div className="kc-actions" role="group" aria-label="Hành động với trả lời">
          <button type="button" className="kc-act" aria-pressed={node.likedByMe} data-act="reply-like" onClick={() => h.onLike(node.id)}>
            <HeartIcon /><span>Thích</span><span className="tabular-nums">{node.likeCount}</span>
          </button>
          <button type="button" className="kc-act" data-act="reply-to" onClick={() => h.onReplyTo(rootId, node.author.label)}>
            <CommentIcon /><span>Trả lời</span>
          </button>
          {h.canAccept && !node.isAccepted && (
            <button type="button" className="kc-act" data-act="accept" onClick={() => h.onAccept(node.id)}>Chọn là đúng</button>
          )}
          {node.isOwn && <button type="button" className="kc-act" data-act="reply-delete" onClick={() => h.onDelete(node.id)}>Xoá</button>}
        </div>
      </div>
    </div>
  );
}

export function ReplyTree({ replies, handlers }: { replies: ReplyNode[]; handlers: ReplyHandlers }) {
  return (
    <div data-kc-replies>
      {replies.map((r, i) => (
        <div key={r.id}>
          <ReplyRow node={r} rootId={r.id} line={r.children.length > 0} h={handlers} />
          {r.children.length > 0 && (
            <div className="kc-reply-indent">
              {r.children.map((c, k) => <ReplyRow key={c.id} node={c} rootId={r.id} line={k < r.children.length - 1} h={handlers} />)}
            </div>
          )}
          {i < replies.length - 1 && <div aria-hidden style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }} />}
        </div>
      ))}
    </div>
  );
}

/** Ô trả lời: một nút đặc "Gửi". `replyTo` có giá trị → đang trả lời một bình luận (gắn vào cha gốc). */
export function ReplyForm({ userName, replyTo, onCancelTarget, onSubmit, inputRef }: {
  userName: string;
  replyTo: { rootId: string; label: string } | null;
  onCancelTarget: () => void;
  onSubmit: (content: string, imageUrls: string[], parentReplyId: string | null) => Promise<string | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "upload" | "post">("idle");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const cache = useRef(new Map<File, string>());

  async function send() {
    if (lock.current) return;
    if (!text.trim()) { setError("Hãy viết nội dung trả lời."); return; }
    lock.current = true; setError("");
    try {
      let urls: string[] = [];
      if (images.length) {
        setPhase("upload");
        urls = await Promise.all(images.map(async f => {
          const hit = cache.current.get(f);
          if (hit) return hit;
          const [u] = await uploadMany([f], "community/images");
          cache.current.set(f, u);
          return u;
        }));
      }
      setPhase("post");
      const err = await onSubmit(text.trim(), urls, replyTo?.rootId ?? null);
      if (err) { setError(err); return; }
      setText(""); setImages([]); cache.current.clear();
    } catch (e) {
      setError(e instanceof TypeError ? "Mất kết nối. Bạn thử lại nhé." : "Chưa gửi được. Bạn thử lại nhé.");
    } finally { setPhase("idle"); lock.current = false; }
  }

  const busy = phase !== "idle";
  return (
    <form className="kc-card" data-flat data-kc-reply-form onSubmit={e => { e.preventDefault(); void send(); }} style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
      <ThreadCol label={userName} line={false} />
      <div className="kc-body flex flex-col gap-2">
        {replyTo && (
          <p className="kc-meta flex items-center gap-2 flex-wrap">
            <span>Đang trả lời {replyTo.label}</span>
            <button type="button" className="kc-act" onClick={onCancelTarget}>Bỏ</button>
          </p>
        )}
        <textarea ref={inputRef} aria-label="Nội dung trả lời" rows={3} maxLength={MAX_REPLY} value={text}
          onChange={e => { setText(e.target.value); setError(""); }} placeholder="Viết trả lời…"
          className="w-full resize-none rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2.5 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)]" />
        <ImagePicker files={images} onChange={setImages} max={2} disabled={busy} />
        {error && <p role="alert" className="text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="kc-meta tabular-nums">{text.length}/{MAX_REPLY}</span>
          <KinButton type="submit" loading={busy} loadingLabel={phase === "upload" ? "Đang tải ảnh…" : "Đang gửi…"}>Gửi</KinButton>
        </div>
      </div>
    </form>
  );
}
