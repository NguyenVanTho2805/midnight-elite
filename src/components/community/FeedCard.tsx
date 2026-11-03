"use client";
// BU-05 — thẻ bài trong feed: lưới 48 | 1fr, kẻ 1px dưới, không viền quanh, không bóng. Nội dung là văn bản thuần (React tự thoát).
import Link from "next/link";
import { KinStatus } from "@/components/kin";
import type { FeedItem } from "@/lib/communityTypes";
import { ActionRow, type ActionItem } from "./ActionRow";
import { AuthorLine } from "./AuthorLine";
import { CommunityAvatar } from "./Avatar";
import { MediaGrid } from "./MediaGrid";
import { ClipIcon } from "./Icons";
import { CATEGORY_LABEL, timeAgo } from "./format";

const LONG = 420;

export function FeedCard({ item, signedIn, showCourse, onPatch }: {
  item: FeedItem;
  signedIn: boolean;
  /** Xem chung nhiều lớp: ghi rõ bài thuộc lớp nào. */
  showCourse: boolean;
  onPatch: (key: string, patch: Partial<ActionItem>) => void;
}) {
  const isQuestion = item.kind === "question";
  return (
    <article className="kc-card" data-feed-card={item.key} data-kind={item.kind}>
      <div className="kc-col1"><CommunityAvatar label={item.author.label} /></div>
      <div className="kc-body">
        {item.isPinned && <p className="kc-meta" style={{ fontWeight: 600 }}>Đã ghim</p>}
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <AuthorLine author={item.author} />
          <Link href={item.href} className="kc-meta hover:underline kc-focus"><time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time></Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="kc-tag">{CATEGORY_LABEL[item.category] ?? item.category}</span>
          {showCourse && <span className="kc-tag">{item.course ? item.course.name : "Chung"}</span>}
          {isQuestion && (item.answered ? <KinStatus tone="xong">Đã có đáp án</KinStatus> : <KinStatus tone="cho">Chưa có đáp án</KinStatus>)}
        </div>
        {isQuestion && item.title && (
          <h3 className="mt-2" style={{ fontSize: 16, lineHeight: "22px", fontWeight: 600, color: "var(--kin-chu-chinh)" }}>
            <Link href={item.href} className="kc-focus hover:underline">{item.title}</Link>
          </h3>
        )}
        <Link href={item.href} className="block mt-1 kc-focus">
          <p className="kc-text" data-clamp={item.content.length > LONG ? "" : undefined}>{item.content}</p>
          {item.content.length > LONG && <span className="kc-meta" style={{ fontWeight: 600 }}>Xem thêm</span>}
        </Link>
        <MediaGrid urls={item.imageUrls} />
        {item.fileUrl && (
          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] max-w-full">
            <ClipIcon /><span className="truncate">{item.fileName ?? "Tệp đính kèm"}</span>
          </a>
        )}
        <ActionRow item={item} signedIn={signedIn} commentHref={item.href} onPatch={p => onPatch(item.key, p)} />
      </div>
    </article>
  );
}

/** Khung xám khi tải: đúng lưới 48 | 1fr nên không nhảy bố cục. */
export function FeedSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden data-kc-skeleton>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="kc-card">
          <div className="kc-col1"><span className="kc-skel" style={{ width: 36, height: 36 }} /></div>
          <div className="kc-body flex flex-col gap-2">
            <span className="kc-skel" style={{ height: 12, width: "35%" }} />
            <span className="kc-skel" style={{ height: 12, width: "92%" }} />
            <span className="kc-skel" style={{ height: 12, width: "70%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
