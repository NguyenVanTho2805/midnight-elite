// Trạng thái rỗng: LUÔN có câu giải thích (vì sao trống) và, nếu có, một việc làm tiếp (nút/liên kết). Không minh hoạ, không "đang phát triển".
import type { ReactNode } from "react";

export function KinEmptyState({ title, children, action, className = "" }: {
  title: ReactNode;
  /** Câu giải thích: vì sao trống, bao giờ thì có. */
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div data-kin-empty role="status" className={`py-10 px-4 text-center ${className}`}>
      <p className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">{title}</p>
      {children && <p className="mt-2 mx-auto max-w-[44ch] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
