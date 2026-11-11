"use client";
// BU-05 — chi tiết bài toàn trang kiểu Threads: bài chính, đường dọc nối xuống các trả lời, trả lời lồng 1 cấp, ô trả lời cố định cuối.
// Ba trạng thái: đang tải · "Không tìm thấy bài viết" (không tồn tại / đã xoá / chờ duyệt / ngoài lớp — cùng một màn, không lộ) · lỗi + Thử lại.
// Khách đọc được; Thích / Lưu / Báo cáo / Bình luận dẫn tới đăng nhập rồi quay lại đúng bài này.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton, KinStateCard, KinStatus, kinButtonClass, useKinConfirm } from "@/components/kin";
import { useAuth } from "@/contexts/AuthContext";
import type { ReplyNode, ThreadDetail } from "@/lib/communityTypes";
import { ActionRow, type ActionItem } from "./ActionRow";
import { AuthorLine } from "./AuthorLine";
import { CommunityFrame } from "./CommunityFrame";
import "./community.css";
import { ClipIcon } from "./Icons";
import { MediaGrid } from "./MediaGrid";
import { ReplyForm, ReplyTree } from "./ReplyTree";
import { ThreadCol } from "./ThreadLine";
import { CATEGORY_LABEL, loginHref, readError, timeAgo } from "./format";

type View = { s: "loading" } | { s: "notfound" } | { s: "error" } | { s: "ok"; t: ThreadDetail };

function mapNode(list: ReplyNode[], id: string, fn: (n: ReplyNode) => ReplyNode): ReplyNode[] {
  return list.map(n => (n.id === id ? fn(n) : { ...n, children: n.children.map(c => (c.id === id ? fn(c) : c)) }));
}
function countAll(list: ReplyNode[]): number { return list.reduce((a, n) => a + 1 + n.children.length, 0); }

// LOI-01: `bare` = bảng tin cộng đồng đang ẩn, chỉ còn câu hỏi trong lớp — không khung Cộng đồng (thanh trái / cột phải dẫn vào bảng tin), nút quay lại là `backHref`.
type Back = { href: string; label: string };
const COMMUNITY_BACK: Back = { href: "/cong-dong", label: "Cộng đồng" };

export function ThreadDetailView({ id, bare = false, backHref, backLabel }: { id: string; bare?: boolean; backHref?: string; backLabel?: string }) {
  const back: Back = backHref ? { href: backHref, label: backLabel ?? "Quay lại" } : COMMUNITY_BACK;
  if (bare) {
    return (
      <div className="kc-root" data-kc-root data-kc-bare>
        <div className="mx-auto max-w-[680px] min-w-0"><Inner id={id} back={back} /></div>
      </div>
    );
  }
  return (
    <CommunityFrame active={null}>
      <Inner id={id} back={back} />
    </CommunityFrame>
  );
}

function Inner({ id, back }: { id: string; back: Back }) {
  const router = useRouter();
  const { user } = useAuth();
  const { ask, dialog } = useKinConfirm();
  const [view, setView] = useState<View>({ s: "loading" });
  const [replyTo, setReplyTo] = useState<{ rootId: string; label: string } | null>(null);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setView({ s: "loading" });
    try {
      const res = await fetch(`/api/community/threads/${id}`, { credentials: "same-origin", cache: "no-store", signal });
      if (res.status === 404 || res.status === 403) { setView({ s: "notfound" }); return; }
      if (!res.ok) { setView({ s: "error" }); return; }
      setView({ s: "ok", t: (await res.json()) as ThreadDetail });
    } catch (e) { if ((e as Error)?.name !== "AbortError") setView({ s: "error" }); }
  }, [id]);
  useEffect(() => { const ac = new AbortController(); void Promise.resolve().then(() => load(ac.signal)); return () => ac.abort(); }, [load]);

  // Mở thẳng một trả lời (#r-<id>) từ thông báo.
  useEffect(() => {
    if (view.s !== "ok" || !location.hash.startsWith("#r-")) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [view.s]);

  const setThread = (fn: (t: ThreadDetail) => ThreadDetail) => setView(v => (v.s === "ok" ? { s: "ok", t: fn(v.t) } : v));
  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(""), 4000); };
  const toLogin = () => router.push(loginHref());

  async function likeReply(rid: string) {
    if (!user) { toLogin(); return; }
    try {
      const res = await fetch(`/api/community/replies/${rid}/like`, { method: "POST", credentials: "same-origin" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { flash(d.error ?? "Chưa thích được trả lời này."); return; }
      setThread(t => ({ ...t, replies: mapNode(t.replies, rid, n => ({ ...n, likedByMe: !!d.likedByMe, likeCount: Number(d.likeCount) })) }));
    } catch { flash("Mất kết nối. Thử lại nhé."); }
  }

  async function deleteReply(rid: string) {
    if (!(await ask({ title: "Xoá trả lời này?", message: "Các trả lời bên dưới vẫn được giữ lại.", confirmLabel: "Xoá trả lời" }))) return;
    try {
      const res = await fetch(`/api/community/replies/${rid}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) { flash((await readError(res)).error ?? "Chưa xoá được."); return; }
      setThread(t => ({ ...t, replies: mapNode(t.replies, rid, n => ({ ...n, deleted: true, content: "", imageUrls: [] })) }));
    } catch { flash("Mất kết nối. Thử lại nhé."); }
  }

  async function acceptReply(rid: string) {
    try {
      const res = await fetch(`/api/community/threads/${id}/accept-reply`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replyId: rid }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { flash(d.error ?? "Chưa chọn được đáp án."); return; }
      const acc: string = d.acceptedReplyId ?? rid;
      setThread(t => {
        const mark = (n: ReplyNode): ReplyNode => ({ ...n, isAccepted: n.id === acc, children: n.children.map(mark) });
        return { ...t, acceptedReplyId: acc, answered: true, replies: t.replies.map(mark) };
      });
    } catch { flash("Mất kết nối. Thử lại nhé."); }
  }

  async function submitReply(content: string, imageUrls: string[], parentReplyId: string | null): Promise<string | null> {
    const res = await fetch(`/api/community/threads/${id}/reply`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, imageUrls, ...(parentReplyId ? { parentReplyId } : {}) }),
    });
    if (res.status === 401) { toLogin(); return "Bạn cần đăng nhập để trả lời."; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error ?? "Chưa gửi được trả lời.";
    const node = d as ReplyNode;
    setThread(t => ({
      ...t, replyCount: t.replyCount + 1,
      replies: parentReplyId
        ? t.replies.map(r => (r.id === parentReplyId ? { ...r, children: [...r.children, { ...node, children: [] }] } : r))
        : [...t.replies, { ...node, children: [] }],
    }));
    setReplyTo(null);
    return null;
  }

  if (view.s === "loading") {
    return (
      <div role="status" aria-busy="true" aria-label="Đang tải bài viết" data-kc-skeleton>
        <div className="kc-card" aria-hidden>
          <div className="kc-col1"><span className="kc-skel" style={{ width: 36, height: 36 }} /></div>
          <div className="kc-body flex flex-col gap-2">
            <span className="kc-skel" style={{ height: 12, width: "35%" }} />
            <span className="kc-skel" style={{ height: 12, width: "92%" }} />
            <span className="kc-skel" style={{ height: 12, width: "80%" }} />
            <span className="kc-skel" style={{ height: 12, width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }
  if (view.s === "notfound") {
    return <div className="p-4"><KinStateCard as="h1" kicker="Không tìm thấy" title="Không tìm thấy bài viết"
      actions={<Link href={back.href} className={kinButtonClass("secondary")}>{back === COMMUNITY_BACK ? "Về Cộng đồng" : back.label}</Link>}>
      Bài viết có thể đã bị xoá, đang chờ duyệt hoặc không còn trong phạm vi bạn xem được.</KinStateCard></div>;
  }
  if (view.s === "error") {
    return <div className="p-4"><KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được"
      actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}>
      Có trục trặc khi lấy bài viết. Bạn thử lại sau ít giây nhé.</KinStateCard></div>;
  }

  const t = view.t;
  const isQuestion = t.kind === "question";
  const hasReplies = t.replies.length > 0;
  const item: ActionItem = { id: t.id, source: "thread", likeCount: t.likeCount, replyCount: t.replyCount || countAll(t.replies), likedByMe: t.likedByMe, bookmarkedByMe: t.bookmarkedByMe, isOwn: t.isOwn };

  return (
    <div>
      {dialog}
      <div className="px-4 pt-2">
        <Link href={back.href} className="kc-focus inline-flex min-h-11 items-center text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-phu)] hover:underline">← {back.label}</Link>
      </div>
      <article className="kc-card" data-flat data-kc-thread={t.id}>
        <ThreadCol label={t.author.label} line={hasReplies} />
        <div className="kc-body">
          {t.isPinned && <p className="kc-meta" style={{ fontWeight: 600 }}>Đã ghim</p>}
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <AuthorLine author={t.author} />
            <time className="kc-meta" dateTime={t.createdAt}>{timeAgo(t.createdAt)}</time>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="kc-tag">{CATEGORY_LABEL[t.category] ?? t.category}</span>
            {t.course && <span className="kc-tag">{t.course.name}</span>}
            {isQuestion && (t.answered ? <KinStatus tone="xong">Đã có đáp án</KinStatus> : <KinStatus tone="cho">Chưa có đáp án</KinStatus>)}
          </div>
          {isQuestion && t.title && <h1 className="mt-2" style={{ fontSize: 20, lineHeight: "28px", fontWeight: 600, color: "var(--kin-chu-chinh)" }}>{t.title}</h1>}
          <p className="kc-text mt-2">{t.content}</p>
          <MediaGrid urls={t.imageUrls} />
          {t.fileUrl && (
            <a href={t.fileUrl} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] max-w-full">
              <ClipIcon /><span className="truncate">{t.fileName ?? "Tệp đính kèm"}</span>
            </a>
          )}
          <ActionRow item={item} signedIn={!!user}
            onPatch={p => setThread(x => ({ ...x, ...p }))}
            onComment={() => inputRef.current?.focus()} />
        </div>
      </article>

      {notice && <p role="status" className="px-4 pb-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">{notice}</p>}
      <div style={{ borderTop: "1px solid var(--kin-vien-thuong)" }} />

      {hasReplies
        ? <ReplyTree replies={t.replies} handlers={{
            signedIn: !!user, canAccept: isQuestion && t.canAccept,
            onReplyTo: (rootId, label) => { if (!user) { toLogin(); return; } setReplyTo({ rootId, label }); window.setTimeout(() => inputRef.current?.focus(), 0); },
            onLike: likeReply, onDelete: deleteReply, onAccept: acceptReply,
          }} />
        : <p className="px-4 py-6 text-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa có trả lời nào.{user ? " Bạn là người đầu tiên nhé." : ""}</p>}

      {user
        ? <ReplyForm userName={user.name} replyTo={replyTo} onCancelTarget={() => setReplyTo(null)} onSubmit={submitReply} inputRef={inputRef} />
        : (
          <div className="flex items-center justify-between gap-3 flex-wrap p-4" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Đăng nhập để trả lời bài viết này.</p>
            <Link href={loginHref(`/cong-dong/${id}`)} className={kinButtonClass("primary")}>Đăng nhập</Link>
          </div>
        )}
    </div>
  );
}
