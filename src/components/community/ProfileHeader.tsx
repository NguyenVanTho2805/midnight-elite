// BU-05 — đầu hồ sơ công khai kiểu Instagram: dải nền token (chưa có ảnh bìa — BU-06), avatar chữ cái 72px, tên, thẻ vai, môn dạy, giới thiệu,
// hai số THẬT (bài viết, câu trả lời), nút viền "Xem hồ sơ gia sư". Không có nút theo dõi, không có nút nhắn, không thông tin liên hệ.
import Link from "next/link";
import { kinButtonClass } from "@/components/kin";
import type { ProfileData } from "@/lib/communityTypes";
import { CommunityAvatar } from "./Avatar";
import { TAG_LABEL } from "./format";

export function ProfileHeader({ profile }: { profile: ProfileData["profile"] }) {
  return (
    <header data-kc-profile-head>
      <div aria-hidden style={{ height: 96, background: "var(--kin-nen-bang)" }} />
      <div className="px-4 pb-4" style={{ marginTop: -36 }}>
        <div style={{ display: "inline-block", borderRadius: "var(--kin-bo-tron)", border: "3px solid var(--kin-nen-trang)", background: "var(--kin-nen-trang)" }}>
          <CommunityAvatar label={profile.label} size={72} />
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <h1 style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600, color: "var(--kin-chu-chinh)" }}>{profile.label}</h1>
          {profile.tag && <span className="kc-tag">{TAG_LABEL[profile.tag]}</span>}
        </div>
        {profile.subjects.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Môn dạy">
            {profile.subjects.map(s => <li key={s} className="kc-tag">{s}</li>)}
          </ul>
        )}
        {profile.bio && <p className="kc-text mt-3">{profile.bio}</p>}
        <dl className="mt-3 flex gap-6 text-[length:var(--kin-co-goc)]">
          <div className="flex gap-1.5"><dd className="font-semibold tabular-nums text-[var(--kin-chu-chinh)]">{profile.postCount}</dd><dt className="text-[var(--kin-chu-mo)]">bài viết</dt></div>
          <div className="flex gap-1.5"><dd className="font-semibold tabular-nums text-[var(--kin-chu-chinh)]">{profile.answerCount}</dd><dt className="text-[var(--kin-chu-mo)]">câu trả lời</dt></div>
        </dl>
        {profile.isSelf && <p className="mt-3 kc-meta">Đây là cách mọi người nhìn thấy hồ sơ của bạn.</p>}
        <div className="mt-4"><Link href={`/mentor/${profile.id}`} className={kinButtonClass("secondary")}>Xem hồ sơ gia sư</Link></div>
      </div>
    </header>
  );
}
