// BU-05 — cột 48px của kiểu Threads: avatar 36px ở giữa cột, bên dưới là đường dọc 1px nối tới avatar người trả lời kế tiếp.
import { CommunityAvatar } from "./Avatar";

export function ThreadCol({ label, line, ghost }: { label: string; line: boolean; ghost?: boolean }) {
  return (
    <div className="kc-col1">
      {ghost ? <span className="kc-avatar" style={{ visibility: "hidden" }} aria-hidden="true" /> : <CommunityAvatar label={label} />}
      {line && <span className="kc-line" aria-hidden="true" data-kc-line />}
    </div>
  );
}
