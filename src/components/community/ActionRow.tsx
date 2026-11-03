"use client";
// BU-05 — hàng hành động Thích · Bình luận · Lưu · Báo cáo (Hướng A: chữ + biểu tượng + số đếm, không chỉ màu).
// Cao 36px ở chuột (≥880 vùng nội dung), 44px ở 390; "Báo cáo" nằm dưới dấu … ở vùng hẹp. Khách bấm Thích/Lưu/Báo cáo → đăng nhập rồi quay lại đúng chỗ.
// Câu hỏi cũ (source "question") chưa có API thích/lưu/báo cáo: chỉ hiện "Bình luận" (đếm trả lời).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton } from "@/components/kin";
import type { FeedItem } from "@/lib/communityTypes";
import { BookmarkIcon, CommentIcon, FlagIcon, HeartIcon, MoreIcon } from "./Icons";
import { loginHref, readError } from "./format";

export type ActionItem = Pick<FeedItem, "id" | "source" | "likeCount" | "replyCount" | "likedByMe" | "bookmarkedByMe" | "isOwn">;

export function ActionRow({ item, signedIn, onPatch, commentHref, onComment }: {
  item: ActionItem;
  signedIn: boolean;
  onPatch: (patch: Partial<ActionItem>) => void;
  /** Thẻ trong danh sách: liên kết tới trang bài. */
  commentHref?: string;
  /** Trang chi tiết: đưa con trỏ xuống ô trả lời. */
  onComment?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"like" | "save" | null>(null);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportErr, setReportErr] = useState("");

  const isThread = item.source === "thread";

  function needLogin(): boolean {
    if (signedIn) return false;
    router.push(loginHref());
    return true;
  }

  async function toggle(kind: "like" | "save") {
    if (needLogin() || busy) return;
    setBusy(kind); setErr("");
    try {
      const res = await fetch(`/api/community/threads/${item.id}/${kind === "like" ? "like" : "bookmark"}`, { method: "POST", credentials: "same-origin" });
      if (res.status === 401) { router.push(loginHref()); return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(res.status === 404 ? "Bài viết không còn nữa." : (d.error ?? "Chưa thực hiện được. Thử lại nhé.")); return; }
      onPatch(kind === "like" ? { likedByMe: !!d.likedByMe, likeCount: Number(d.likeCount) } : { bookmarkedByMe: !!d.bookmarkedByMe });
    } catch { setErr("Mất kết nối. Thử lại nhé."); } finally { setBusy(null); }
  }

  function openReport() {
    if (needLogin()) return;
    setMenu(false); setReportOpen(true);
  }

  async function sendReport() {
    if (sending) return;
    if (!reason.trim()) { setReportErr("Bạn cho biết lý do giúp mình nhé."); return; }
    setSending(true); setReportErr("");
    try {
      const res = await fetch(`/api/community/threads/${item.id}/report`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.status === 401) { router.push(loginHref()); return; }
      const d = await readError(res);
      if (res.ok || d.code === "already_reported") { setReported(true); setReportOpen(false); return; }
      setReportErr(d.error ?? "Chưa gửi được báo cáo.");
    } catch { setReportErr("Mất kết nối. Thử lại nhé."); } finally { setSending(false); }
  }

  const comment = commentHref
    ? <Link href={signedIn ? commentHref : loginHref(commentHref)} className="kc-act" data-act="comment"><CommentIcon /><span>Bình luận</span><span className="tabular-nums">{item.replyCount}</span></Link>
    : <button type="button" className="kc-act" data-act="comment" onClick={() => (signedIn ? onComment?.() : needLogin())}><CommentIcon /><span>Bình luận</span><span className="tabular-nums">{item.replyCount}</span></button>;

  const canReport = isThread && !item.isOwn;

  return (
    <div>
      <div className="kc-actions" role="group" aria-label="Hành động với bài viết">
        {isThread && (
          <button type="button" className="kc-act" data-act="like" aria-pressed={item.likedByMe} disabled={busy === "like"} onClick={() => toggle("like")}>
            <HeartIcon /><span>Thích</span><span className="tabular-nums">{item.likeCount}</span>
          </button>
        )}
        {comment}
        {isThread && (
          <button type="button" className="kc-act" data-act="save" aria-pressed={item.bookmarkedByMe} disabled={busy === "save"} onClick={() => toggle("save")}>
            <BookmarkIcon /><span>Lưu</span>
          </button>
        )}
        {canReport && (reported
          ? <span className="kc-act kc-act-report" role="status" style={{ cursor: "default" }}><FlagIcon /><span>Đã báo cáo</span></span>
          : <button type="button" className="kc-act kc-act-report" data-act="report" aria-expanded={reportOpen} onClick={openReport}><FlagIcon /><span>Báo cáo</span></button>)}
        {canReport && !reported && (
          <button type="button" className="kc-act kc-act-more" aria-label="Thêm" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}><MoreIcon /></button>
        )}
      </div>
      {menu && (
        <div role="menu" className="mt-1 inline-flex flex-col rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
          <button type="button" role="menuitem" className="kc-act" onClick={openReport}><FlagIcon /><span>Báo cáo</span></button>
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      {reported && <p role="status" className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Đã nhận báo cáo của bạn. Cảm ơn bạn đã giúp cộng đồng sạch hơn.</p>}
      {reportOpen && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]" htmlFor={`report-${item.id}`}>Lý do báo cáo</label>
          <textarea id={`report-${item.id}`} rows={3} maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setReportErr(""); }}
            className="w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] p-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" />
          {reportErr && <p role="alert" className="text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">{reportErr}</p>}
          <div className="flex gap-2">
            <KinButton variant="secondary" loading={sending} loadingLabel="Đang gửi…" onClick={sendReport}>Gửi báo cáo</KinButton>
            <KinButton variant="ghost" onClick={() => { setReportOpen(false); setReportErr(""); }}>Huỷ</KinButton>
          </div>
        </div>
      )}
    </div>
  );
}
