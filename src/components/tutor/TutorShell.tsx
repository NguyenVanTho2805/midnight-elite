// TT-203 — vỏ của gia sư. Menu trái (máy tính) / thanh dưới (điện thoại, ngón cái với tới đáy).
// Chỉ hiện module đang bật: mặc định chế độ gọn = Lịch + Học phí; còn lại bật ở Cài đặt → Module
// hiển thị hoặc nút "+ Thêm". Tắt module chỉ ẨN khỏi thanh bên — dữ liệu giữ nguyên.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleTutorModules, type OptionalTutorModule } from "@/lib/userPreferences";

const ICON: Record<string, string> = { "hop-viec": "📥", lich: "🗓", lop: "👥", "bai-kt": "📝", "thu-vien": "📚", "hoc-phi": "💳" };

export default function TutorShell({
  modules, badges, children,
}: {
  /** Module tuỳ chọn gia sư đã bật. */
  modules: OptionalTutorModule[];
  /** Số việc đang chờ theo module (chỉ đếm việc cần gia sư ra tay). */
  badges: Record<string, number>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = visibleTutorModules({ modules });
  const hiddenCount = 4 - modules.length;
  const isActive = (href: string) => (href === "/lop-cua-toi" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  const itemStyle = (active: boolean) => ({
    background: active ? "var(--kin-nen-nhan)" : "transparent",
    color: active ? "var(--kin-th-navy)" : "var(--kin-chu-chinh)",
    fontWeight: active ? 600 : 500,
  } as const);

  const Badge = ({ n }: { n: number }) => n > 0
    ? <span className="kin-badge-dem" aria-label={`${n} việc cần xử lý`}>{n > 99 ? "99+" : n}</span>
    : null;

  const link = (m: { key: string; href: string; label: string }, cls: string, extra: React.ReactNode) => {
    const props = { className: cls, style: itemStyle(isActive(m.href)), "aria-current": isActive(m.href) ? ("page" as const) : undefined };
    // Module quản lý bài/đề nằm ở trang quản trị (khác tên miền): dùng thẻ <a> thường để trình duyệt chuyển hẳn sang.
    return m.href.startsWith("/admin")
      ? <a key={m.key} href={m.href} {...props}>{extra}</a>
      : <Link key={m.key} href={m.href} {...props}>{extra}</Link>;
  };

  return (
    <div className="md:flex min-h-screen" style={{ background: "var(--kin-nen-trang)" }}>
      <nav aria-label="Module của gia sư"
        className="hidden md:flex flex-col w-[226px] flex-shrink-0 p-3 gap-1 sticky top-0 h-screen overflow-y-auto"
        style={{ background: "var(--kin-nen-bang)", borderRight: "1px solid var(--kin-vien-thuong)" }}>
        <p className="px-3 py-2 text-lg font-bold" style={{ color: "var(--kin-chu-chinh)" }}>KiN</p>
        {items.map(m => link(m, "flex items-center gap-3 px-3 rounded-lg min-h-[44px] text-sm",
          <>
            <span aria-hidden>{ICON[m.key]}</span>
            <span className="flex-1">{m.label}</span>
            <Badge n={badges[m.key] ?? 0} />
          </>))}
        <div className="mt-auto pt-3 flex flex-col gap-1" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
          {hiddenCount > 0 && (
            <Link href="/lop-cua-toi/cai-dat#module" className="flex items-center gap-3 px-3 rounded-lg min-h-[44px] text-sm" style={{ color: "var(--kin-nhan-link)" }}>
              <span aria-hidden>＋</span> Thêm module
            </Link>
          )}
          <Link href="/lop-cua-toi/cai-dat" className="flex items-center gap-3 px-3 rounded-lg min-h-[44px] text-sm" style={itemStyle(isActive("/lop-cua-toi/cai-dat"))}>
            <span aria-hidden>⚙</span> Cài đặt
          </Link>
        </div>
      </nav>

      <div className="flex-1 min-w-0 pb-[68px] md:pb-0">{children}</div>

      <nav aria-label="Module của gia sư"
        className="md:hidden fixed bottom-0 inset-x-0 h-[60px] flex z-30"
        style={{ background: "var(--kin-nen-bang)", borderTop: "1px solid var(--kin-vien-thuong)" }}>
        {items.map(m => link(m, "relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[9.5px] min-h-[44px]",
          <>
            <span aria-hidden className="text-[21px] leading-none">{ICON[m.key]}</span>
            <span className="truncate max-w-full px-1">{m.label}</span>
            {(badges[m.key] ?? 0) > 0 && <span className="absolute top-1 right-[22%]"><Badge n={badges[m.key]} /></span>}
          </>))}
        <Link href="/lop-cua-toi/cai-dat" aria-label="Cài đặt" className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[9.5px] min-h-[44px]"
          style={itemStyle(isActive("/lop-cua-toi/cai-dat"))}>
          <span aria-hidden className="text-[21px] leading-none">⚙</span>
          <span>Cài đặt</span>
        </Link>
      </nav>
    </div>
  );
}
