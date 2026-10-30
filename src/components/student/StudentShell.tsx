// Vỏ của học sinh (Figma "Vỏ — Học sinh" 11:98): thanh module bên trái (điện thoại: thanh dưới) với 4 module đúng Figma
// — (23/10/2026, Figma 299:114360 + 299:116497) Việc của tôi, Lịch học, Lớp của tôi, Bài tập — cộng "Khác" cho các trang còn lại. BU-00 bước 6 (31/10/2026):
// "Khác" chỉ còn Khám phá (Gia sư, Cộng đồng, Tin tức) + Tài khoản (Hồ sơ, Học phí, Chủ đề màu, Nhập mã lớp); các lối vào khác bị ẩn, route vẫn chạy.
// Phòng thi (/student/thi-thu/<mã đề>) KHÔNG có vỏ: toàn màn hình, khoá cứng.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CoinBalance from "@/components/CoinBalance";
import NotificationBell from "@/components/NotificationBell";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { KinLogo } from "@/components/kin/KinLogo";
import { ModuleRail, type ModuleItem, type NavGroup } from "@/components/kin/shell/ModuleRail";
import { TopDate } from "@/components/kin/shell/TopDate";
import { RailOpenButton } from "@/components/kin/shell/RailOpenButton";
import { AccountMenu } from "@/components/kin/shell/AccountMenu";
import { MorePanel, isUnder, moreToNavGroup, type MoreGroup } from "@/components/kin/shell/MorePanel";

// `icon` theo Figma "Nền móng" (khung "Điều hướng" của học sinh, 25/10/2026): dùng cho thanh rộng; bảng "Khác" không vẽ biểu tượng.
// `also`: href của Cộng đồng / Tin tức là BÍ DANH chỉ chuyển tới trang công khai (mở trong khung học sinh); `also` là trang đích để mục vẫn sáng sau khi chuyển.
// BU-00 bước 6 (31/10/2026): bảng "Khác" rút từ 3 nhóm 15 mục còn 2 nhóm 7 mục — học sinh chỉ thấy việc học. Bỏ khỏi MENU (route giữ nguyên, chỉ ẩn lối vào):
// Thư viện, Tiếng Anh tự học, Thi thử, Bảng xếp hạng, Hỏi đáp, Khoá học đang mở, Lớp đang theo dõi, Tra cứu điểm chuẩn, Ví và Coin. Thi thử / Tiếng Anh
// vẫn sáng đúng module nhờ `also` của "Bài tập" (/student/thi-thu) và "Lớp của tôi" (/student/tieng-anh).
// NC2-048 (góp ý 28/10): "Hỏi đáp" là tab bên trong Cộng đồng; /student/hoi-dap vẫn chuyển tới /cong-dong?tab=hoi-dap-qa để liên kết và thông báo cũ không chết.
const MORE_GROUPS: MoreGroup[] = [
  { title: "Khám phá", links: [
    { label: "Gia sư", href: "/giang-vien", icon: "nguoi" },
    { label: "Cộng đồng", href: "/student/cong-dong", also: ["/cong-dong"], icon: "nguoi" },
    { label: "Tin tức", href: "/student/tin-tuc", also: ["/tin-tuc"], icon: "hop-thu" },
  ] },
  { title: "Tài khoản", links: [
    { label: "Hồ sơ", href: "/student/ho-so", icon: "nguoi" },
    { label: "Học phí", href: "/student/hoc-phi", icon: "hoc-phi" },
    { label: "Chủ đề màu", href: "/cai-dat/chu-de", icon: "cai-dat" },
    // Lối tắt: trang này đã thuộc module "Lớp của tôi" (`also`) nên mục này không tô sáng, để chỉ một mục sáng (như "Thêm module" bên gia sư).
    { label: "Nhập mã lớp", href: "/student/nhap-ma-lop", icon: "lop", active: false },
  ] },
];
// Chỉ các mục KHÔNG phải lối tắt mới làm nút "Khác" sáng (lối tắt `active: false` đã có module cha sáng).
const MORE_HREFS = MORE_GROUPS.flatMap(g => g.links.filter(l => l.active !== false).flatMap(l => [l.href, ...(l.also ?? [])]));
/** Phòng thi: /student/thi-thu/<mã đề> (không tính danh sách /student/thi-thu). */
export const isExamRoom = (pathname: string) => /^\/student\/thi-thu\/[^/]+/.test(pathname);

// `preview` (BU-00 bước 4, 31/10/2026): quản trị cấp 1 / cấp nội dung "xem thử" khu học sinh — băng mỏng trên cùng nói rõ đang xem thử, kèm đường về /admin
// (proxy đưa sang tên miền quản trị). Không truyền thì tự nhận theo vai: role admin (gia sư không còn tới đây — AuthGuard đẩy về Hộp việc) = đang xem thử.
export default function StudentShell({ children, preview }: { children: ReactNode; preview?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const showPreview = preview ?? user?.role === "admin";
  const [badge, setBadge] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const exam = isExamRoom(pathname);

  const loadBadge = useCallback(() => {
    fetch("/api/student/viec-cua-toi?badge=1", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.badge === "number") setBadge(d.badge); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (exam) return;
    loadBadge();
    const onFocus = () => loadBadge();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname, exam, loadBadge]);

  const closeMore = useCallback(() => setMoreOpen(false), []);
  if (exam) return <>{children}</>;

  const moreActive = moreOpen || MORE_HREFS.some(h => isUnder(pathname, h));
  const modules: ModuleItem[] = [
    { key: "viec", label: "Việc của tôi", href: "/student/viec-cua-toi", icon: "viec", badge },
    { key: "lich", label: "Lịch học", href: "/student/lich-hoc", icon: "lich" },
    // `also` có /student/tieng-anh (BU-00 bước 6): Tiếng Anh tự học rời menu "Khác" nhưng trang đó vẫn có mục sáng.
    { key: "lop", label: "Lớp của tôi", href: "/student/hoc-tap", also: ["/student/bai-giang", "/student/nhap-ma-lop", "/student/tieng-anh", "/lop-cua-toi"], icon: "lop" },
    { key: "bai-tap", label: "Bài tập", href: "/student/bai-tap", also: ["/student/thi-thu"], icon: "bai-kt" },
    { key: "khac", label: "Khác", icon: "khac", onClick: () => setMoreOpen(o => !o), active: moreActive && !isUnder(pathname, "/student/thi-thu"), controls: "khac-bang", expanded: moreOpen, desktopOnly: true },
  ];

  // Thanh RỘNG (Figma "Điều hướng"): nhóm đầu = bốn module, các nhóm còn lại là chính danh sách của bảng "Khác".
  const wide: NavGroup[] = [
    { title: "Làm việc hằng ngày", items: modules.filter(m => m.key !== "khac").map(m => ({ key: m.key, label: m.label, href: m.href ?? "/student/viec-cua-toi", icon: m.key === "viec" ? "hop-thu" : m.icon, also: m.also, badge: m.badge })) },
    ...MORE_GROUPS.map(moreToNavGroup),
  ];

  return (
    <div className="md:flex min-h-screen bg-[var(--kin-nen-trang)] [--kin-top:48px] md:[--kin-top:68px]">
      <ModuleRail roleLabel="HỌC SINH" ariaLabel="Module của học sinh" modules={modules} groups={wide} onCollapse={closeMore}
        home={{ href: "/student/viec-cua-toi", label: "KiN — Việc của tôi" }} footnote="Miễn phí ra mắt" />

      <div className="flex-1 min-w-0 pb-[60px] md:pb-0 relative">
        {showPreview && (
          <div data-admin-preview role="status" className="min-h-9 flex items-center justify-center gap-2 px-4 text-[length:var(--kin-co-small)] bg-[var(--kin-nen-nhan)] text-[var(--kin-chu-chinh)] border-b border-[var(--kin-vien-nhat)]">
            <span>Đang xem thử giao diện học sinh</span>
            <span aria-hidden>·</span>
            <a href="/admin" className="font-semibold underline text-[var(--kin-nhan-link)] min-h-9 inline-flex items-center">Về bảng quản trị</a>
          </div>
        )}
        <VerifyEmailBanner />
        <div className="h-12 md:h-[68px] flex items-center justify-between gap-3 px-4 md:px-10 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
          <div className="flex items-center gap-1 min-w-0">
            <RailOpenButton pending={badge} />
            <Link href="/student/viec-cua-toi" aria-label="KiN — Việc của tôi" className="inline-flex md:hidden"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
            <p data-top-title className="hidden md:block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Không gian học tập</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <TopDate />
            <CoinBalance />
            <NotificationBell />
            {user && <AccountMenu name={user.name} email={user.email} onLogout={() => void logout()} onOpenMore={() => setMoreOpen(true)}
              links={[{ label: "Hồ sơ", href: "/student/ho-so" }, { label: "Học phí", href: "/student/hoc-phi" }, { label: "Chủ đề màu", href: "/cai-dat/chu-de" }]} />}
          </div>
        </div>
        {children}
      </div>

      {moreOpen && <MorePanel id="khac-bang" groups={MORE_GROUPS} onClose={closeMore} user={user} onLogout={() => void logout()} />}
    </div>
  );
}
