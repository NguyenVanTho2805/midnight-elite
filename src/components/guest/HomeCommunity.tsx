// Trang chủ — khối bảng tin "Cộng đồng đang nói gì". Dùng lại useFeed + FeedCard (BU-05), chỉ bài CHUNG (scope=common) và 5 bài đầu, cho cả khách lẫn học sinh (mặt tiền công khai:
// không bao giờ hiện bài của lớp). Chỉ tên hiển thị rút gọn do máy chủ trả; không ô soạn bài, không ô hỏi, không nhắn riêng; bài của khách đang chờ duyệt không có trong kết quả.
// Khách bấm Thích / Lưu / Bình luận → ActionRow chuyển sang /dang-nhap?redirect=%2F. `aside` = cột phải (khối Quiz); không truyền thì bảng tin canh giữa một cột 600px.
// Ba trạng thái: đang tải (khung xám đúng lưới 48|1fr) · rỗng (có lời và liên kết đi tiếp) · lỗi (nói là LỖI + Thử lại 44px).
"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { KinButton, KinEmptyState, KinStateCard, kinButtonClass } from "@/components/kin";
import { FeedCard, FeedSkeleton } from "@/components/community/FeedCard";
import { useFeed } from "@/components/community/useFeed";
import "@/components/community/community.css";

const HOME_FEED_SIZE = 5;

export default function HomeCommunity({ aside }: { aside?: ReactNode }) {
  const { user } = useAuth();
  const feed = useFeed({ tab: "all", scope: "common", saved: false, limit: HOME_FEED_SIZE });
  const list = [...feed.pinned, ...feed.items].slice(0, HOME_FEED_SIZE);
  const state = feed.status === "loading" ? "loading" : feed.status === "error" ? "error" : list.length === 0 ? "empty" : "ok";

  return (
    <section aria-labelledby="home-cong-dong" data-home-block="community" data-home-state={state} className="bg-[var(--kin-nen-trang)] py-10">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-4">
          <div className="min-w-0">
            <h2 id="home-cong-dong" className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight text-[var(--kin-chu-chinh)]">Cộng đồng đang nói gì</h2>
            <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Bài mới nhất từ gia sư và các bạn. Xem tự do, không cần tài khoản.</p>
          </div>
          <Link href="/cong-dong" data-home-feed-all className="inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-nhan-link)] underline whitespace-nowrap">Xem tất cả bài viết →</Link>
        </div>

        <div className={aside ? "grid gap-8 lg:grid-cols-[minmax(0,600px)_minmax(0,360px)] lg:justify-center lg:items-start" : "mx-auto max-w-[600px]"}>
          <div className="kc-root min-w-0" data-home-feed>
            {state === "loading" && <div role="status" aria-busy="true" aria-label="Đang tải bảng tin" data-home-skeleton><FeedSkeleton rows={3} /></div>}

            {state === "error" && (
              <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được bảng tin"
                actions={<KinButton variant="secondary" onClick={() => void feed.reload()}>Thử lại</KinButton>}>
                {feed.failure === "network" ? "Mất kết nối mạng. Kiểm tra mạng rồi thử lại nhé." : "Có trục trặc khi lấy bài viết. Bạn thử lại sau ít giây nhé."}
              </KinStateCard>
            )}

            {state === "empty" && (
              <KinEmptyState title="Chưa có bài viết nào." action={<Link href="/cong-dong" className={kinButtonClass("secondary")}>Mở Cộng đồng</Link>}>
                Khi gia sư hoặc các bạn đăng bài, bài mới sẽ hiện ở đây.
              </KinEmptyState>
            )}

            {state === "ok" && list.map(it => <FeedCard key={it.key} item={it} signedIn={!!user} showCourse={false} onPatch={feed.patch} />)}
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}
