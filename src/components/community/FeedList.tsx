"use client";
// BU-05 — danh sách feed với đủ ba trạng thái: đang tải (khung xám đúng lưới 48|1fr) · rỗng (có lời và liên kết đi tiếp) · lỗi (+ Thử lại 44px).
import Link from "next/link";
import { KinButton, KinEmptyState, KinStateCard, kinButtonClass } from "@/components/kin";
import type { FeedItem } from "@/lib/communityTypes";
import { FeedCard, FeedSkeleton } from "./FeedCard";
import type { useFeed } from "./useFeed";
import { loginHref } from "./format";

type Feed = ReturnType<typeof useFeed>;

function emptyCopy(tab: string, scope: string, saved: boolean, signedIn: boolean) {
  if (saved) return { title: "Bạn chưa lưu bài nào.", body: "Bấm Lưu ở bài bạn muốn đọc lại. Bài đã lưu sẽ nằm ở đây.", link: { href: "/cong-dong?tab=all", label: "Xem Bảng tin" } };
  if (scope !== "all" && scope !== "common") return { title: "Lớp này chưa có bài viết.", body: "Khi thầy cô hoặc các bạn trong lớp đăng bài, bài sẽ hiện ở đây.", link: { href: "/cong-dong?tab=all", label: "Xem Bảng tin chung" } };
  if (tab === "hoi-dap") return { title: "Chưa có câu hỏi.", body: "Khi có người đặt câu hỏi, câu hỏi sẽ hiện ở đây để mọi người cùng trả lời.", link: signedIn ? { href: "/cong-dong?tab=all", label: "Xem Bảng tin" } : { href: loginHref("/cong-dong?tab=hoi-dap-qa"), label: "Đăng nhập để đặt câu hỏi" } };
  return { title: "Chưa có bài viết. Hãy là người đầu tiên chia sẻ.", body: "Một câu hỏi hay hay một mẹo học nhỏ đều giúp được bạn khác.", link: signedIn ? { href: "/cong-dong?tab=hoi-dap-qa", label: "Xem Hỏi đáp" } : { href: loginHref("/cong-dong"), label: "Đăng nhập để chia sẻ" } };
}

// LOI-01: `exit` = bảng tin chung đang ẩn (chỉ còn hỏi đáp trong lớp) — mọi lối "Về / Xem Bảng tin chung" đổi thành lối về trang của người xem.
export function FeedList({ feed, tab, scope, saved, signedIn, exit }: { feed: Feed; tab: string; scope: string; saved: boolean; signedIn: boolean; exit?: { href: string; label: string } }) {
  if (feed.status === "loading") return <div role="status" aria-busy="true" aria-label="Đang tải bài viết"><FeedSkeleton /></div>;

  if (feed.status === "error") {
    if (feed.failure === "not_member") {
      return (
        <div className="p-4"><KinStateCard tone="loi" kicker="Không xem được" title="Bạn không còn là thành viên của lớp này."
          actions={<Link href={exit?.href ?? "/cong-dong?tab=all"} className={kinButtonClass("secondary")}>{exit?.label ?? "Về Bảng tin chung"}</Link>} /></div>
      );
    }
    return (
      <div className="p-4"><KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được"
        actions={
          feed.failure === "unauthorized"
            ? <Link href={loginHref()} className={kinButtonClass("secondary")}>Đăng nhập lại</Link>
            : <KinButton variant="secondary" onClick={() => void feed.reload()}>Thử lại</KinButton>
        }>
        {feed.failure === "network" ? "Mất kết nối mạng. Kiểm tra mạng rồi thử lại nhé." : "Có trục trặc khi lấy bài viết. Bạn thử lại sau ít giây nhé."}
      </KinStateCard></div>
    );
  }

  const all: FeedItem[] = [...feed.pinned, ...feed.items];
  if (all.length === 0) {
    const c = exit
      ? { title: "Lớp này chưa có câu hỏi nào.", body: "Em có chỗ nào chưa hiểu thì viết ở ô phía trên. Gia sư và các bạn trong lớp sẽ thấy và trả lời.", link: exit }
      : emptyCopy(tab, scope, saved, signedIn);
    return <KinEmptyState title={c.title} action={<Link href={c.link.href} className={kinButtonClass("secondary")}>{c.link.label}</Link>}>{c.body}</KinEmptyState>;
  }

  const showCourse = scope === "all" && signedIn;
  return (
    <div data-kc-feed>
      {all.map(it => <FeedCard key={it.key} item={it} signedIn={signedIn} showCourse={showCourse && !!it.course} onPatch={feed.patch} />)}
      {feed.nextCursor && (
        <div className="flex flex-col items-center gap-2 p-4">
          {feed.more === "error" && <p role="alert" className="text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">Chưa tải thêm được.</p>}
          <KinButton variant="secondary" loading={feed.more === "loading"} loadingLabel="Đang tải…" onClick={() => void feed.loadMore()}>
            {feed.more === "error" ? "Thử lại" : "Xem thêm bài"}
          </KinButton>
        </div>
      )}
    </div>
  );
}
