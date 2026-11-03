"use client";
// BU-05 — thân trang /cong-dong: tiêu đề, lời báo từ form khách, ô soạn (hoặc ô hỏi của khách), hàng chủ đề, feed.
// Tab / lớp lấy từ địa chỉ (máy chủ đọc searchParams rồi truyền xuống); đổi tab = đổi địa chỉ (liên kết cũ ?tab=hoi-dap-qa vẫn đúng).
import Link from "next/link";
import { KinButton, KinStatus } from "@/components/kin";
import { useAuth } from "@/contexts/AuthContext";
import { CommunityFrame, useCommunityFrame } from "./CommunityFrame";
import { Composer } from "./Composer";
import { FeedList } from "./FeedList";
import { FeedSkeleton } from "./FeedCard";
import { GuestQuestionForm } from "./GuestQuestionForm";
import { UnansweredStrip } from "./RightRail";
import type { NavActive } from "./LeftNav";
import { useFeed } from "./useFeed";
import { guestErrorText, loginHref } from "./format";
import { KinEmptyState, kinButtonClass } from "@/components/kin";

export type HomeTab = "all" | "hoi-dap" | "kinh-nghiem" | "tai-lieu" | "goc-vui" | "da-luu";

const TOPICS: { tab: HomeTab; label: string }[] = [
  { tab: "all", label: "Tất cả" }, { tab: "kinh-nghiem", label: "Chia sẻ" }, { tab: "tai-lieu", label: "Tài liệu" }, { tab: "goc-vui", label: "Góc vui" },
];

function navActive(tab: HomeTab, scope: string): NavActive {
  if (tab === "da-luu") return "da-luu";
  if (tab === "hoi-dap") return "hoi-dap";
  if (scope !== "all" && scope !== "common") return "lop";
  return "bang-tin";
}

export function CommunityHome(props: { tab: HomeTab; scope: string; daGui: boolean; loi: string | null; guestOpen: boolean }) {
  return (
    <CommunityFrame active={navActive(props.tab, props.scope)} scope={props.scope}>
      <HomeBody {...props} />
    </CommunityFrame>
  );
}

function HomeBody({ tab, scope, daGui, loi, guestOpen }: { tab: HomeTab; scope: string; daGui: boolean; loi: string | null; guestOpen: boolean }) {
  const { user, isLoading } = useAuth();
  const { sidebar, scopes } = useCommunityFrame();
  const saved = tab === "da-luu";
  const feed = useFeed({ tab: saved ? "all" : tab, scope, saved, enabled: !saved || !!user });
  const loiText = guestErrorText(loi);
  const showChips = !saved && tab !== "hoi-dap";
  const q = (t: HomeTab) => `/cong-dong?tab=${t}${scope !== "all" ? `&scope=${encodeURIComponent(scope)}` : ""}`;

  return (
    <div>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <h1 className="text-[length:var(--kin-co-tieu-de)] font-semibold text-[var(--kin-chu-chinh)]">Cộng đồng</h1>
        {feed.status === "ok" && <KinButton variant="ghost" onClick={() => void feed.reload()}>Bài mới</KinButton>}
      </div>

      {daGui && (
        <div role="status" className="mx-4 mb-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-3" data-kc-notice="da-gui">
          <KinStatus tone="xong">Đã nhận. Câu hỏi sẽ hiện sau khi được duyệt.</KinStatus>
        </div>
      )}
      {loiText && (
        <div role="alert" className="mx-4 mb-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-3" data-kc-notice="loi">
          <KinStatus tone="loi">{loiText}</KinStatus>
        </div>
      )}

      {!saved && (
        isLoading ? <div className="kc-card" aria-hidden><div className="kc-col1"><span className="kc-skel" style={{ width: 36, height: 36 }} /></div><span className="kc-skel" style={{ height: 14, width: "55%", alignSelf: "center" }} /></div>
          : user ? <Composer userName={user.name} scopes={scopes} onPosted={feed.prepend} />
          : <GuestQuestionForm open={guestOpen} />
      )}

      <UnansweredStrip data={sidebar} />

      {showChips && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2" role="group" aria-label="Chủ đề" style={{ scrollbarWidth: "none" }}>
          {TOPICS.map(t => (
            <Link key={t.tab} href={q(t.tab)} scroll={false} aria-current={tab === t.tab ? "page" : undefined} className="kc-nav-item kc-focus">{t.label}</Link>
          ))}
        </div>
      )}

      {saved && isLoading ? <FeedSkeleton />
        : saved && !user ? (
          <KinEmptyState title="Đăng nhập để xem bài đã lưu." action={<Link href={loginHref("/cong-dong?tab=da-luu")} className={kinButtonClass("primary")}>Đăng nhập</Link>}>
            Bài bạn lưu sẽ nằm ở đây, trên mọi thiết bị.
          </KinEmptyState>
        ) : <FeedList key={`${tab}|${scope}`} feed={feed} tab={tab} scope={scope} saved={saved} signedIn={!!user} />}
    </div>
  );
}
