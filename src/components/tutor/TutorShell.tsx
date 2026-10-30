// TT-203 — vỏ của gia sư theo bố cục Outlook (Figma "Vỏ — Gia sư" 9:2): thanh module 79px bên trái (điện thoại: thanh dưới 60px)
// + dải trên 48px. Chỉ hiện module đang bật; mặc định (BU-00, 25/10/2026) = ĐỦ module, gia sư tự tắt bớt ở Cài đặt ("chế độ gọn" = Lịch + Học phí
// là lựa chọn tường minh `modules: []`). Tắt module chỉ ẨN khỏi thanh — dữ liệu giữ nguyên.
// 13/10/2026: bỏ menu 226px + biểu tượng emoji + nhãn 9,5px; các trang không có trên thanh (Doanh thu, Báo cáo tháng, Kế hoạch buổi,
// Kiểm duyệt, Hồ sơ gia sư, Bài đăng, Cài đặt) vào qua bảng "Khác" như vỏ học sinh. Hộp việc đang ở đúng /lop-cua-toi, nên mục này
// chỉ sáng khi đúng đường dẫn đó (các trang con không làm nó sáng theo).
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { KinLogo } from "@/components/kin/KinLogo";
import { ModuleRail, type ModuleItem, type NavGroup, type NavItem } from "@/components/kin/shell/ModuleRail";
import { TopDate } from "@/components/kin/shell/TopDate";
import { RailOpenButton } from "@/components/kin/shell/RailOpenButton";
import NotificationBell from "@/components/NotificationBell";
import { AccountMenu } from "@/components/kin/shell/AccountMenu";
import { MorePanel, isUnder, moreToNavGroup, type MoreGroup } from "@/components/kin/shell/MorePanel";
import { KinCallout } from "@/components/kin/Callout";
import { OPTIONAL_TUTOR_MODULES, visibleTutorModules, type OptionalTutorModule } from "@/lib/userPreferences";
import { TUTOR_PENDING_PATH } from "@/lib/tutorGate";

const ICON: Record<string, string> = { "hop-viec": "hop-thu", lich: "lich", lop: "lop", "bai-kt": "bai-kt", "thu-vien": "thu-vien", "hoc-phi": "hoc-phi" };
/** 4 tab của thanh dưới điện thoại theo Figma 299:116033. */
const MOBILE_KEYS = new Set(["hop-viec", "lich", "lop", "hoc-phi"]);
// BU-00 bước 3 (31/10/2026): trang đề thi / ngân hàng / quản lớp của gia sư nằm ở /lop-cua-toi/de-thi*, /lop-cua-toi/quan-lop* (bí danh của
// /admin/thi-thu*, /admin/khoa-hoc* — src/lib/tutorRoutes.ts), chạy trong chính vỏ này; gia sư không còn vào /admin/* (proxy 307 sang bí danh).

// `icon` theo Figma "Nền móng" (khung "Điều hướng" của gia sư, 25/10/2026): dùng cho thanh rộng; bảng "Khác" không vẽ biểu tượng.
const MORE_BASE: MoreGroup[] = [
  { title: "Dạy học", links: [
    { label: "Tổng quan", href: "/lop-cua-toi/tong-quan", icon: "bao-cao" },
    { label: "Kế hoạch buổi", href: "/lop-cua-toi/ke-hoach-buoi", icon: "lich" },
    { label: "Báo cáo tháng", href: "/lop-cua-toi/bao-cao-thang", icon: "bao-cao" },
    { label: "Sổ điểm", href: "/lop-cua-toi/so-diem", icon: "bai-kt" },
    { label: "Kiểm duyệt cộng đồng", href: "/lop-cua-toi/kiem-duyet", icon: "kiem-duyet" },
  ] },
  { title: "Tiền", links: [{ label: "Doanh thu", href: "/lop-cua-toi/doanh-thu", icon: "hoc-phi" }] },
  { title: "Giới thiệu", links: [
    { label: "Hồ sơ gia sư", href: "/lop-cua-toi/ho-so", icon: "nguoi" },
    { label: "Bài đăng tìm học sinh", href: "/lop-cua-toi/bai-dang", icon: "hop-thu" },
  ] },
];

// BU-00 bước 5 (31/10/2026): vỏ gia sư CHỜ DUYỆT — cùng khung (thanh trái / thanh dưới + dải trên) nhưng thanh chỉ 3 mục, nhãn vai "CHỜ DUYỆT", không bảng "Khác",
// không số đếm, và một băng "Hồ sơ gia sư đang chờ duyệt" trên vùng nội dung. Cài đặt trỏ thẳng /cai-dat/chu-de vì /lop-cua-toi/cai-dat (module, nhắc lịch, kết nối)
// chỉ có nghĩa khi đã dạy.
const PENDING_ITEMS: ModuleItem[] = [
  { key: "cho-duyet", label: "Trạng thái hồ sơ", href: TUTOR_PENDING_PATH, icon: "nguoi" },
  { key: "ho-tro", label: "Liên hệ hỗ trợ", href: "/lop-cua-toi/ho-tro", icon: "khac" },
  { key: "cai-dat", label: "Cài đặt", href: "/cai-dat/chu-de", icon: "cai-dat" },
];

export default function TutorShell({
  modules, badges, pending = false, children,
}: {
  /** Module tuỳ chọn gia sư đã bật. `undefined` = chưa chọn = đủ module (BU-00); `[]` = chế độ gọn tường minh. */
  modules?: OptionalTutorModule[];
  /** Số việc đang chờ theo module (chỉ đếm việc cần gia sư ra tay). */
  badges: Record<string, number>;
  /** Gia sư chờ duyệt (BU-00 bước 5): thanh 3 mục, không "Khác", không số đếm, có băng chờ duyệt. */
  pending?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  if (pending) return <PendingShell user={user} onLogout={() => void logout()}>{children}</PendingShell>;
  const visible = visibleTutorModules({ modules });
  // Số module tuỳ chọn đang ẨN = tuỳ chọn không có mặt trong `visible` (không tính từ độ dài `modules`, vì `undefined` nghĩa là đủ module).
  const hiddenCount = OPTIONAL_TUTOR_MODULES.filter(k => !visible.some(m => m.key === k)).length;

  const groups: MoreGroup[] = [
    ...MORE_BASE,
    { title: "Tài khoản", links: [
      { label: "Gói của tôi", href: "/lop-cua-toi/goi", icon: "hoc-phi" },
      { label: "Liên hệ hỗ trợ", href: "/lop-cua-toi/ho-tro", icon: "khac" },
      { label: "Cài đặt", href: "/lop-cua-toi/cai-dat", icon: "cai-dat" },
      ...(hiddenCount > 0 ? [{ label: "Thêm module", href: "/lop-cua-toi/cai-dat#module", icon: "cai-dat" }] : []),
    ] },
  ];
  const moreActive = moreOpen || groups.some(g => g.links.some(l => isUnder(pathname, l.href) && !isUnder(pathname, "/lop-cua-toi/cai-dat")));

  const mods = visible.map<ModuleItem>(m => ({
    key: m.key, label: m.label, href: m.href, icon: ICON[m.key] ?? "viec", badge: badges[m.key],
    // Hộp việc nằm ở đúng /lop-cua-toi nên chỉ sáng khi đúng đường dẫn đó (isUnder sẽ làm nó sáng ở mọi trang con).
    active: m.key === "hop-viec" ? pathname === "/lop-cua-toi"
      : m.key === "bai-kt" ? isUnder(pathname, m.href) || isUnder(pathname, "/lop-cua-toi/de-thi")   // trang Bài tập + đề thi, ngân hàng câu hỏi, ngân hàng đề (cùng một họ "bài kiểm tra")
      : m.key === "lop" ? isUnder(pathname, m.href) || isUnder(pathname, "/lop-cua-toi/quan-lop")  // quản lớp / điểm danh / học viên của lớp
      : isUnder(pathname, m.href),
    desktopOnly: !MOBILE_KEYS.has(m.key),
  }));
  // Mục "Học sinh" (Figma 299:113083) đứng ngay sau Lớp và đi cùng module Lớp: Lớp bật thì Học sinh hiện. Trang riêng của gia sư
  // (/lop-cua-toi/hoc-sinh), chỉ học sinh thuộc lớp của mình; không dùng /admin/hoc-sinh (trang quản trị).
  const withStudents = mods.flatMap<ModuleItem>(m => m.key === "lop"
    ? [m, { key: "hoc-sinh", label: "Học sinh", href: "/lop-cua-toi/hoc-sinh", icon: "nguoi", desktopOnly: true }]
    : [m]);
  // Thanh RỘNG (Figma "Điều hướng"): "Làm việc hằng ngày" = các module đang bật (trừ Học phí); Học phí đứng chung nhóm "Tiền" với Doanh thu; các nhóm còn lại là chính
  // danh sách của bảng "Khác". Module bị tắt vẫn chỉ ẩn khỏi thanh (dữ liệu giữ nguyên) nên nhóm đầu có thể ngắn hơn Figma.
  const asNav = (m: ModuleItem): NavItem => ({ key: m.key, label: m.label, href: m.href ?? "/lop-cua-toi", icon: m.icon, active: m.active, badge: m.badge });
  const [dayTeach, money, intro, account] = groups.map(moreToNavGroup);
  const wide: NavGroup[] = [
    { title: "Làm việc hằng ngày", items: withStudents.filter(m => m.key !== "hoc-phi").map(asNav) },
    dayTeach,
    { title: money.title, items: [...withStudents.filter(m => m.key === "hoc-phi").map(asNav), ...money.items] },
    intro,
    account,
  ];
  const items: ModuleItem[] = [
    ...withStudents,
    { key: "cai-dat", label: "Cài đặt", href: "/lop-cua-toi/cai-dat", icon: "cai-dat", desktopOnly: true },
    { key: "khac", label: "Khác", icon: "khac", onClick: () => setMoreOpen(o => !o), active: moreActive, controls: "khac-bang", expanded: moreOpen, desktopOnly: true },
  ];

  return (
    // kin-chu-than: chữ thân Inter như ảnh Figma các màn gia sư (trước đó thừa kế Be Vietnam Pro của <body>, rộng hơn nên dòng xuống hàng khác Figma).
    <div className="kin-chu-than md:flex min-h-screen bg-[var(--kin-nen-trang)] [--kin-top:48px] md:[--kin-top:68px]">
      <ModuleRail roleLabel="GIA SƯ" ariaLabel="Module của gia sư" modules={items} groups={wide} onCollapse={closeMore}
        home={{ href: "/lop-cua-toi", label: "KiN — Hộp việc của gia sư" }} footnote="Miễn phí ra mắt" />

      <div className="flex-1 min-w-0 pb-[60px] md:pb-0 relative">
        <div className="h-12 md:h-[68px] flex items-center justify-between gap-3 px-4 md:px-10 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
          <div className="flex items-center gap-1 min-w-0">
            <RailOpenButton pending={Object.values(badges).reduce((a, n) => a + (n > 0 ? n : 0), 0)} />
            <Link href="/lop-cua-toi" aria-label="KiN — Hộp việc của gia sư" className="inline-flex md:hidden"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
            {user && <p data-top-title className="hidden md:block truncate text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Sổ dạy học của {user.name}</p>}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <TopDate />
            {/* HV-11: chuông thông báo (dùng lại thông báo có sẵn) + dấu hỏi trợ giúp dẫn tới trang Liên hệ hỗ trợ. */}
            <NotificationBell />
            <Link href="/lop-cua-toi/ho-tro" aria-label="Trợ giúp" title="Trợ giúp" data-help-link
              className="inline-flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg border border-[var(--kin-vien-thuong)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-bang)] hover:text-[var(--kin-chu-chinh)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9.5" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9" /><path d="M12 17.2h.01" />
              </svg>
            </Link>
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

function PendingShell({ user, onLogout, children }: { user: { name: string; email: string } | null; onLogout: () => void; children: React.ReactNode }) {
  const wide: NavGroup[] = [{ title: "Hồ sơ gia sư", items: PENDING_ITEMS.map(m => ({ key: m.key, label: m.label, href: m.href ?? TUTOR_PENDING_PATH, icon: m.icon })) }];
  return (
    <div data-tutor-pending-shell className="kin-chu-than md:flex min-h-screen bg-[var(--kin-nen-trang)] [--kin-top:48px] md:[--kin-top:68px]">
      <ModuleRail roleLabel="CHỜ DUYỆT" ariaLabel="Module của gia sư" modules={PENDING_ITEMS} groups={wide}
        home={{ href: TUTOR_PENDING_PATH, label: "KiN — Hồ sơ gia sư đang chờ duyệt" }} footnote="Miễn phí ra mắt" />

      <div className="flex-1 min-w-0 pb-[60px] md:pb-0 relative">
        <div className="h-12 md:h-[68px] flex items-center justify-between gap-3 px-4 md:px-10 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
          <div className="flex items-center gap-1 min-w-0">
            <RailOpenButton pending={0} />
            <Link href={TUTOR_PENDING_PATH} aria-label="KiN — Hồ sơ gia sư đang chờ duyệt" className="inline-flex md:hidden"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
            {user && <p data-top-title className="hidden md:block truncate text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Hồ sơ gia sư của {user.name}</p>}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <TopDate />
            <NotificationBell />
            <Link href="/lop-cua-toi/ho-tro" aria-label="Trợ giúp" title="Trợ giúp" data-help-link
              className="inline-flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg border border-[var(--kin-vien-thuong)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-bang)] hover:text-[var(--kin-chu-chinh)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9.5" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9" /><path d="M12 17.2h.01" />
              </svg>
            </Link>
            {user && <AccountMenu name={user.name} email={user.email} onLogout={onLogout}
              links={[{ label: "Trạng thái hồ sơ", href: TUTOR_PENDING_PATH }, { label: "Sửa hồ sơ", href: "/lop-cua-toi/ho-so" }, { label: "Chủ đề màu", href: "/cai-dat/chu-de" }]} />}
          </div>
        </div>
        {/* Băng chờ duyệt: chữ nói rõ trạng thái (không chỉ màu), một liên kết đi tiếp. */}
        <div data-tutor-pending-band className="mx-4 md:mx-10 mt-4">
          <KinCallout title="Hồ sơ gia sư đang chờ duyệt">
            KiN sẽ báo khi duyệt xong. Trong lúc chờ, bạn xem được trạng thái hồ sơ và gửi câu hỏi cho KiN ở <Link href="/lop-cua-toi/ho-tro" className="underline text-[var(--kin-nhan-link)]">Liên hệ hỗ trợ</Link>.
          </KinCallout>
        </div>
        {children}
      </div>
    </div>
  );
}
