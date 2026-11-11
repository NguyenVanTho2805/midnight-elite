// BU-05 — dòng tên: tên hiển thị (15/600) + thẻ vai bằng CHỮ. Chỉ gia sư đã xác minh mới có liên kết sang hồ sơ (author.href).
import Link from "next/link";
import type { FeedAuthor } from "@/lib/communityTypes";
import { TAG_LABEL } from "./format";
import { isLinkHidden } from "@/lib/features";

// LOI-01 (rà soát): hồ sơ cộng đồng /cong-dong/ho-so/<id> bị chặn khi bảng tin ẩn (cờ CONG_DONG) → tên chỉ là chữ, không liên kết.
export function AuthorLine({ author }: { author: FeedAuthor }) {
  return (
    <span className="inline-flex items-center gap-2 flex-wrap min-w-0">
      {author.href && !isLinkHidden(author.href)
        ? <Link href={author.href} className="kc-name kc-focus hover:underline">{author.label}</Link>
        : <span className="kc-name">{author.label}</span>}
      {author.tag && <span className="kc-tag">{TAG_LABEL[author.tag]}</span>}
    </span>
  );
}
