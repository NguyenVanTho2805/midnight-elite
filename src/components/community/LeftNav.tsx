"use client";
// BU-05 — điều hướng trái: ĐÚNG 4 mục — Bảng tin · Hỏi đáp · Lớp của tôi · Đã lưu. Không thêm mục (xếp hạng, ví, thư viện, tin tức, nhắn tin đã rút ở BU-00).
// ≥1100: cột dọc 220px · 880–1099: dải chip trên cột giữa · hẹp: dải chip dính đầu trang. "Lớp của tôi" ẩn với khách / người chưa có lớp.
import Link from "next/link";
import { useRouter } from "next/navigation";
import CommunityScopeSwitcher from "./CommunityScopeSwitcher";
import type { ScopeOption } from "./useScopeOptions";
import { loginHref } from "./format";

export type NavActive = "bang-tin" | "hoi-dap" | "lop" | "da-luu" | null;

export function LeftNav({ active, scope, options, signedIn }: {
  active: NavActive;
  scope: string;
  options: ScopeOption[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const cur = (k: NavActive) => (active === k ? "page" : undefined);
  return (
    <nav aria-label="Điều hướng Cộng đồng" className="kc-nav" data-kc-nav>
      <div className="kc-nav-list">
        <Link href="/cong-dong?tab=all" scroll={false} className="kc-nav-item kc-focus" aria-current={cur("bang-tin")}>Bảng tin</Link>
        <Link href="/cong-dong?tab=hoi-dap-qa" scroll={false} className="kc-nav-item kc-focus" aria-current={cur("hoi-dap")}>Hỏi đáp</Link>
        <CommunityScopeSwitcher
          scope={active === "lop" || scope !== "all" ? scope : "all"}
          options={options}
          onChange={s => router.push(s === "all" ? "/cong-dong?tab=all" : `/cong-dong?tab=all&scope=${encodeURIComponent(s)}`, { scroll: false })}
        />
        <Link href={signedIn ? "/cong-dong?tab=da-luu" : loginHref("/cong-dong?tab=da-luu")} scroll={false} className="kc-nav-item kc-focus" aria-current={cur("da-luu")}>Đã lưu</Link>
      </div>
    </nav>
  );
}
