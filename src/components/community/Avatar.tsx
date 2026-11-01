// BU-05 — avatar chữ cái đầu trên nền token trung tính (bỏ bảng 7 mã hex cũ ở page.tsx:79).
import { initialOf } from "./format";

export function CommunityAvatar({ label, size = 36 }: { label: string; size?: 36 | 72 }) {
  return (
    <span className="kc-avatar" data-size={size === 72 ? "72" : undefined} aria-hidden="true">
      {initialOf(label)}
    </span>
  );
}
