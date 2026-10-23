// TT-203 — vỏ của gia sư theo bố cục Outlook (Figma "Vỏ — Gia sư" 9:2): thanh module 79px bên trái (điện thoại: thanh dưới 60px)
// + dải trên 48px. Chỉ hiện module đang bật; mặc định "chế độ gọn" = Lịch + Học phí. Tắt module chỉ ẨN khỏi thanh — dữ liệu giữ nguyên.
// 13/10/2026: bỏ menu 226px + biểu tượng emoji + nhãn 9,5px; các trang không có trên thanh (Doanh thu, Báo cáo tháng, Kế hoạch buổi,
// Kiểm duyệt, Hồ sơ gia sư, Bài đăng, Cài đặt) vào qua bảng "Khác" như vỏ học sinh. Hộp việc đang ở đúng /lop-cua-toi, nên mục này
// chỉ sáng khi đúng đường dẫn đó (các trang con không làm nó sáng theo).
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { KinLogo } from "@/components/kin/KinLogo";
import { ModuleRail, type ModuleItem } from "@/components/kin/shell/ModuleRail";
import { TopDate } from "@/components/kin/shell/TopDate";
import { RailOpenButton } from "@/components/kin/shell/RailOpenButton";
import { AccountMenu } from "@/components/kin/shell/AccountMenu";
import { MorePanel, isUnder, type MoreGroup } from "@/components/kin/shell/MorePanel";
import { visibleTutorModules, type OptionalTutorModule } from "@/lib/userPreferences";

const ICON: Record<string, string> = { "hop-viec": "hop-thu", lich: "lich", lop: "lop", "bai-kt": "bai-kt", "thu-vien": "thu-vien", "hoc-phi": "hoc-phi" };
/** 4 tab của thanh dưới điện thoại theo Figma 299:116033. */
const MOBILE_KEYS = new Set(["hop-viec", "lich", "lop", "hoc-phi"]);
// Các trang /admin/* mà gia sư dùng (đề thi, ngân hàng đề, quản lớp…) chạy ngay trên tên miền chính, cùng phiên, trong vỏ này (src/lib/hostRouting.ts,
// TutorAdminFrame) — nên Bài KT / Thư viện / Lớp là liên kết nội bộ chứ không còn nhảy sang tên miền quản trị.

const MORE_BASE: MoreGroup[] = [
  { title: "Dạy học", links: [
    { label: "Tổng quan", href: "/lop-cua-toi/tong-quan" },
    { label: "Kế hoạch buổi", href: "/lop-cua-toi/ke-hoach-buoi" },
    { label: "Báo cáo tháng", href: "/lop-cua-toi/bao-cao-thang" },
    { label: "Kiểm duyệt cộng đồng", href: "/lop-cua-toi/kiem-duyet" },
  ] },
  { title: "Tiền", links: [{ label: "Doanh thu", href: "/lop-cua-toi/doanh-thu" }] },
  { title: "Giới thiệu", links: [
    { label: "Hồ sơ gia sư", href: "/lop-cua-toi/ho-so" },
    { label: "Bài đăng tìm học sinh", href: "/lop-cua-toi/bai-dang" },
  ] },
];

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
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const visible = visibleTutorModules({ modules });
  const hiddenCount = 4 - modules.length;

  const groups: MoreGroup[] = [
    ...MORE_BASE,
    { title: "Tài khoản", links: [
      { label: "Cài đặt", href: "/lop-cua-toi/cai-dat" },
      ...(hiddenCount > 0 ? [{ label: "Thêm module", href: "/lop-cua-toi/cai-dat#module" }] : []),
    ] },
  ];
  const moreActive = moreOpen || groups.some(g => g.links.some(l => isUnder(pathname, l.href) && !isUnder(pathname, "/lop-cua-toi/cai-dat")));

  const mods = visible.map<ModuleItem>(m => ({
    key: m.key, label: m.label, href: m.href, icon: ICON[m.key] ?? "viec", badge: badges[m.key],
    // Hộp việc nằm ở đúng /lop-cua-toi nên chỉ sáng khi đúng đường dẫn đó (isUnder sẽ làm nó sáng ở mọi trang con).
    active: m.key === "hop-viec" ? pathname === "/lop-cua-toi"
      : m.key === "bai-kt" ? isUnder(pathname, m.href) || isUnder(pathname, "/admin/thi-thu")   // trang Bài tập + đề thi, ngân hàng câu hỏi, ngân hàng đề (cùng một họ "bài kiểm tra")
      : m.key === "lop" ? isUnder(pathname, m.href) || isUnder(pathname, "/admin/khoa-hoc")  // quản lớp / điểm danh / học viên của lớp
      : isUnder(pathname, m.href),
    desktopOnly: !MOBILE_KEYS.has(m.key),
  }));
  // Figma có mục "Học sinh" (sau Lớp) nhưng chưa có trang riêng cho gia sư: /admin/hoc-sinh là trang quản trị và chuyển gia sư về /lop-cua-toi.
  // Không dựng mục trỏ vào đường chết; danh sách học viên hiện nằm trong từng lớp (mục Lớp). Ghi trong báo cáo: "CHƯA CÓ TÍNH NĂNG".
  const items: ModuleItem[] = [
    ...mods,
    { key: "cai-dat", label: "Cài đặt", href: "/lop-cua-toi/cai-dat", icon: "cai-dat", desktopOnly: true },
    { key: "khac", label: "Khác", icon: "khac", onClick: () => setMoreOpen(o => !o), active: moreActive, controls: "khac-bang", expanded: moreOpen, desktopOnly: true },
  ];

  return (
    <div className="md:flex min-h-screen bg-[var(--kin-nen-trang)] [--kin-top:48px] md:[--kin-top:68px]">
      <ModuleRail roleLabel="GIA SƯ" ariaLabel="Module của gia sư" modules={items} onCollapse={closeMore}
        home={{ href: "/lop-cua-toi", label: "KiN — Hộp việc của gia sư" }} footnote="Miễn phí ra mắt" />

      <div className="flex-1 min-w-0 pb-[60px] md:pb-0 relative">
        <div className="h-12 md:h-[68px] flex items-center justify-between gap-3 px-4 md:px-10 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
          <div className="flex items-center gap-1 min-w-0">
            <RailOpenButton pending={Object.values(badges).reduce((a, n) => a + (n > 0 ? n : 0), 0)} />
            <Link href="/lop-cua-toi" aria-label="KiN — Hộp việc của gia sư" className="inline-flex md:hidden"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
            {user && <p data-top-title className="hidden md:block truncate text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Sổ dạy học của {user.name}</p>}
          </div>
          <div className="flex items-center gap-3">
            <TopDate />
            {user && <AccountMenu name={user.name} email={user.email} onLogout={() => void logout()} onOpenMore={() => setMoreOpen(true)}
              links={[{ label: "Cài đặt", href: "/lop-cua-toi/cai-dat" }, { label: "Hồ sơ gia sư", href: "/lop-cua-toi/ho-so" }]} />}
          </div>
        </div>
        {children}
      </div>

      {moreOpen && <MorePanel id="khac-bang" groups={groups} onClose={closeMore} user={user} onLogout={() => void logout()} />}
    </div>
  );
}
