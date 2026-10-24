// TK-02 — khung chung của bốn trang tài khoản (đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu) theo Figma 464:9828 / 464:9892.
// CHỈ GIAO DIỆN: tiêu đề + dòng phụ, thẻ biểu mẫu bên trái (≤520px), cột giải thích bên phải từ màn lớn; điện thoại xếp một cột, thẻ lên trước.
// Không đụng luồng xác thực, API, quy tắc mật khẩu hay mã dùng một lần: các trang tự truyền biểu mẫu của chúng vào `children`.
import type { ReactNode } from "react";

export function AuthFrame({ title, sub, aside, children }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div data-auth-frame className="kin-chu-than min-h-[calc(100vh-60px)] bg-[var(--kin-nen-trang)] px-4 md:px-10 py-8 md:py-12">
      <div className="mx-auto max-w-[1160px]">
        <h1 className="text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">{title}</h1>
        {sub && <p className="mt-1 text-[length:var(--kin-co-goc)] leading-[var(--kin-dong-goc)] text-[var(--kin-chu-mo)]">{sub}</p>}
        <div className="mt-8 grid lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-x-16 gap-y-8 items-start">
          <div className="min-w-0 w-full">{children}</div>
          {aside && <aside aria-label="Thông tin thêm" data-auth-aside className="min-w-0 space-y-6">{aside}</aside>}
        </div>
      </div>
    </div>
  );
}

/** Một mục ở cột phải: tiêu đề nhỏ + đoạn giải thích. */
export function AuthAsideBlock({ title, children, className = "" }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{title}</h2>
      {children && <div className="mt-2 text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-phu)]">{children}</div>}
    </section>
  );
}

/** Khung thẻ biểu mẫu dùng chung: viền mảnh, bo, nền mặt. */
export const AUTH_CARD = "w-full rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden";
