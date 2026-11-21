// TT-203 — vỏ của gia sư theo bố cục Outlook (Figma "Vỏ — Gia sư" 9:2): thanh module 79px bên trái (điện thoại: thanh dưới 60px)
// + dải trên 48px. Chỉ hiện module đang bật; mặc định (BU-00 31/10/2026, theo quyết định chủ 25/10) = ĐỦ module, gia sư tự tắt bớt ở Cài đặt ("chế độ gọn" = Lịch + Học phí
// là lựa chọn tường minh `modules: []`). Tắt module chỉ ẨN khỏi thanh — dữ liệu giữ nguyên.
// 13/10/2026: bỏ menu 226px + biểu tượng emoji + nhãn 9,5px; các trang không có trên thanh (Doanh thu, Báo cáo tháng,
// Kiểm duyệt, Hồ sơ gia sư, Bài đăng, Cài đặt) vào qua bảng "Khác" như vỏ học sinh.
// GS-LOP-GON (09/11/2026): "Kế hoạch buổi" (soạn giáo án SessionPlan, KHÔNG phải chốt buổi / sinh học phí) không còn lối vào ở thanh bên và bảng "Khác";
// route /lop-cua-toi/ke-hoach-buoi* vẫn chạy, vào từ Lịch ("Soạn kế hoạch buổi này") và trang chi tiết buổi.
// Hộp việc đang ở đúng /lop-cua-toi, nên mục này
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
import { KinSkipLink, KinSkipTarget } from "@/components/kin/shell/SkipLink";
import NotificationBell from "@/components/NotificationBell";
import { AccountMenu } from "@/components/kin/shell/AccountMenu";
import { MorePanel, isUnder, moreToNavGroup, type MoreGroup } from "@/components/kin/shell/MorePanel";
import { KinCallout } from "@/components/kin/Callout";
import { OPTIONAL_TUTOR_MODULES, shownTutorModules, tutorModuleAllowed, type OptionalTutorModule } from "@/lib/userPreferences";
import { TUTOR_PENDING_PATH } from "@/lib/tutorGate";
import { featureOn, isLinkHidden, visibleLinks } from "@/lib/features";
import { landingPath, TUTOR_HOME_NO_INBOX } from "@/lib/landing";
import { ADMIN_HOST } from "@/lib/hostRouting";
import { classBase } from "@/lib/tutorClassRoutes";
import { groupByOwner } from "@/lib/lopViec";

/** SCL-G-GS: Hộp việc dạy học (chờ chấm · chờ duyệt · xin vào lớp, gom mọi lớp). KHÔNG theo cờ HOP_VIEC — cờ đó là Hộp việc cũ có học phí ở /lop-cua-toi. */
export const TUTOR_INBOX_PATH = "/lop-cua-toi/hop-viec";
/** Một lớp trên thanh "Lớp của bạn" (lấy ở máy chủ: src/lib/lopViecServer.ts loadRailClasses). */
export interface ShellClass { id: string; name: string; color: string; students: number; ownerName?: string | null }

const ICON: Record<string, string> = { "hop-viec": "hop-thu", lich: "lich", lop: "lop", "bai-kt": "bai-kt", "thu-vien": "thu-vien", "hoc-phi": "hoc-phi" };
// SCL-G-GS: thanh dưới điện thoại là 3 mục cố định (Hộp việc / Lớp / Tôi) — trước đây 4 tab theo Figma 299:116033.
// BU-00 bước 3 (31/10/2026): trang đề thi / ngân hàng / quản lớp của gia sư nằm ở /lop-cua-toi/de-thi*, /lop-cua-toi/quan-lop* (bí danh của
// /admin/thi-thu*, /admin/khoa-hoc* — src/lib/tutorRoutes.ts), chạy trong chính vỏ này; gia sư không còn vào /admin/* (proxy 307 sang bí danh).

// `icon` theo Figma "Nền móng" (khung "Điều hướng" của gia sư, 25/10/2026): dùng cho thanh rộng; bảng "Khác" không vẽ biểu tượng.
// LOI-01 (11/11/2026): mục dẫn vào phần đang ẩn (src/lib/features.ts) bị lọc — "Kiểm duyệt cộng đồng" khi Cộng đồng ẩn (Hộp việc vẫn dẫn tới khi có báo cáo bài trong lớp).
// `groups` luôn đủ 4 nhóm theo thứ tự (kể cả nhóm rỗng) để `wide` bên dưới tách đúng; DG: nhóm rỗng bị lọc SAU đó (thanh rộng, bảng "Khác").
const MORE_ALL: MoreGroup[] = [
  { title: "Dạy học", links: [
    { label: "Báo cáo tháng", href: "/lop-cua-toi/bao-cao-thang", icon: "bao-cao" },
    { label: "Sổ điểm", href: "/lop-cua-toi/so-diem", icon: "bai-kt" },
    { label: "Kiểm duyệt cộng đồng", href: "/lop-cua-toi/kiem-duyet", icon: "kiem-duyet" },
  ] },
  { title: "Tiền", links: [{ label: "Doanh thu", href: "/lop-cua-toi/doanh-thu", icon: "hoc-phi" }] },
  { title: "Giới thiệu", links: [
    { label: "Hồ sơ gia sư", href: "/lop-cua-toi/ho-so", icon: "nguoi" },
    { label: "Bài đăng tìm học sinh", href: "/lop-cua-toi/bai-dang", icon: "hop-thu" },
    // B6 GS-09 (08/11/2026): trước đây chỉ vào được từ nút trên trang Học sinh (gắn module Lớp) nên tắt Lớp là mất lối vào.
    { label: "Yêu cầu tìm gia sư", href: "/lop-cua-toi/yeu-cau", icon: "nguoi" },
  ] },
];
const MORE_BASE: MoreGroup[] = MORE_ALL.map(g => ({ ...g, links: visibleLinks(g.links) }));

// BU-00 bước 5 (31/10/2026): vỏ gia sư CHỜ DUYỆT — cùng khung (thanh trái / thanh dưới + dải trên) nhưng thanh chỉ 3 mục, nhãn vai "CHỜ DUYỆT", không bảng "Khác",
// không số đếm, và một băng "Hồ sơ gia sư đang chờ duyệt" trên vùng nội dung. Cài đặt trỏ thẳng /cai-dat/chu-de vì /lop-cua-toi/cai-dat (module, nhắc lịch, kết nối)
// chỉ có nghĩa khi đã dạy.
const PENDING_ITEMS: ModuleItem[] = [
  { key: "cho-duyet", label: "Trạng thái hồ sơ", href: TUTOR_PENDING_PATH, icon: "nguoi" },
  // B2: đây là MỘT đường duy nhất của vỏ chờ duyệt tới /ho-tro (đã bỏ dấu hỏi trên đỉnh và liên kết trong băng); trang Trạng thái hồ sơ còn nút riêng.
  { key: "ho-tro", label: "Liên hệ hỗ trợ", href: "/lop-cua-toi/ho-tro", icon: "khac" },
  { key: "cai-dat", label: "Cài đặt", href: "/cai-dat/chu-de", icon: "cai-dat" },
];

export default function TutorShell({
  modules, badges, pending = false, manage, classes, inbox, children,
}: {
  /** SCL-G-GS: lớp cho nhóm "Lớp của bạn" của thanh rộng (Chủ nhiệm: mọi lớp, nhóm theo gia sư). Vắng (trang khách) = không vẽ nhóm. */
  classes?: ShellClass[];
  /** Số việc cần ra tay của Hộp việc (badge). */
  inbox?: number;
  /** Module tuỳ chọn gia sư đã bật. `undefined` = chưa chọn = đủ module (BU-00); `[]` = chế độ gọn tường minh. */
  modules?: OptionalTutorModule[];
  /** Số việc đang chờ theo module (chỉ đếm việc cần gia sư ra tay). */
  badges: Record<string, number>;
  /** Gia sư chờ duyệt (BU-00 bước 5): thanh 3 mục, không "Khác", không số đếm, có băng chờ duyệt. */
  pending?: boolean;
  /** SCL-B (Q1): có mặt = Chủ nhiệm (quản trị trung tâm) đứng lớp — thanh chỉ module Lớp + nhóm "Quản lý" (địa chỉ tuyệt đối sang tên miền admin, src/lib/adminNav.ts). */
  manage?: { label: string; href: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  if (pending) return <PendingShell user={user} onLogout={() => void logout()}>{children}</PendingShell>;
  // LOI-01: module Lịch rời thanh khi phần Lịch đang ẩn (chỉ gỡ lối vào: /lop-cua-toi/lich vẫn chạy, Hộp việc còn dòng báo nghỉ / buổi bù / nhắc lịch trỏ vào đó).
  // Module Thư viện (/thu-vien = "Thư viện của tôi" của gia sư) KHÔNG lọc ở đây: cờ Thư viện chỉ ẩn thư viện CHUNG.
  // DG (14/11/2026): Hộp việc / Học phí rời thanh khi cờ HOP_VIEC / HOC_PHI tắt (mặc định) — cùng một chỗ quyết với Lịch (userPreferences.tutorModuleAllowed).
  const head = !!manage; // Chủ nhiệm: trang riêng của một gia sư (Hộp việc, Lịch, Học phí, Học sinh…) không mở cho vai này (tutorGate allowAdmin)
  const visible = shownTutorModules({ modules }).filter(m => !head || m.key === "lop");
  // Số module tuỳ chọn đang ẨN = tuỳ chọn không có mặt trong `visible` (không tính từ độ dài `modules`, vì `undefined` nghĩa là đủ module).
  // Module ẩn theo CỜ không tính: gia sư không bật lại được ở Cài đặt nên không mời "Thêm module".
  const hiddenCount = OPTIONAL_TUTOR_MODULES.filter(k => tutorModuleAllowed(k) && !visible.some(m => m.key === k)).length;
  const home = head ? TUTOR_HOME_NO_INBOX : landingPath("admin", "teacher");
  const homeLabel = head ? "KiN — Lớp của trung tâm" : featureOn("HOP_VIEC") ? "KiN — Hộp việc của gia sư" : "KiN — Lớp của gia sư";

  // B1: Hộp việc là trang chủ duy nhất; "Tổng quan" chỉ còn trong bảng Khác khi gia sư đã tắt Hộp việc (khi đó đó là lối duy nhất tới các con số).
  const hopViecOn = visible.some(m => m.key === "hop-viec");
  const groups: MoreGroup[] = head ? [{ title: "Quản lý", links: manage ?? [] }] : [
    // DG: "Tổng quan" đi cùng cờ HOP_VIEC (route /lop-cua-toi/tong-quan chặn khi cờ tắt) — chỉ thêm khi gia sư TỰ tắt module Hộp việc lúc cờ đang mở.
    ...MORE_BASE.map((g, i) => i === 0 && !hopViecOn && !isLinkHidden("/lop-cua-toi/tong-quan")
      ? { ...g, links: [{ label: "Tổng quan", href: "/lop-cua-toi/tong-quan", icon: "bao-cao" }, ...g.links] }
      : g),
    { title: "Tài khoản", links: visibleLinks([
      { label: "Gói của tôi", href: "/lop-cua-toi/goi", icon: "hoc-phi" },
      { label: "Cài đặt", href: "/lop-cua-toi/cai-dat", icon: "cai-dat" },
      ...(hiddenCount > 0 ? [{ label: "Thêm module", href: "/lop-cua-toi/cai-dat#module", icon: "cai-dat" }] : []),
    ]) },
  ];
  // DG: nhóm hết mục (Dạy học khi Sổ điểm / Báo cáo tháng / Kiểm duyệt cùng ẩn; Tiền khi Doanh thu ẩn) không vẽ tiêu đề rỗng.
  const panelGroups = groups.filter(g => g.links.length > 0);
  const moreActive = moreOpen || groups.some(g => g.links.some(l => isUnder(pathname, l.href) && !isUnder(pathname, "/lop-cua-toi/cai-dat")));

  const mods = visible.map<ModuleItem>(m => ({
    key: m.key, label: m.label, href: m.href, icon: ICON[m.key] ?? "viec", badge: badges[m.key],
    // Hộp việc nằm ở đúng /lop-cua-toi nên chỉ sáng khi đúng đường dẫn đó (isUnder sẽ làm nó sáng ở mọi trang con).
    active: m.key === "hop-viec" ? pathname === "/lop-cua-toi"
      : m.key === "bai-kt" ? isUnder(pathname, m.href) || isUnder(pathname, "/lop-cua-toi/de-thi")   // trang Bài tập + đề thi, ngân hàng câu hỏi, ngân hàng đề (cùng một họ "bài kiểm tra")
      : m.key === "lop" ? isUnder(pathname, m.href) || isUnder(pathname, "/lop-cua-toi/quan-lop")  // quản lớp / điểm danh / học viên của lớp
      : isUnder(pathname, m.href),
    desktopOnly: true,
  }));
  // Mục "Học sinh" (Figma 299:113083) đứng ngay sau Lớp khi Lớp bật. B6 GS-09 (08/11/2026): KHÔNG còn phụ thuộc module Lớp — tắt Lớp vẫn thấy Học sinh
  // (đứng cuối các module), vì Yêu cầu tìm gia sư và hồ sơ học sinh vào từ đó. Trang riêng của gia sư (/lop-cua-toi/hoc-sinh), không dùng /admin/hoc-sinh.
  const studentItem: ModuleItem = { key: "hoc-sinh", label: "Học sinh", href: "/lop-cua-toi/hoc-sinh", icon: "nguoi", active: isUnder(pathname, "/lop-cua-toi/hoc-sinh") || isUnder(pathname, "/lop-cua-toi/yeu-cau"), desktopOnly: true };
  // SCL-C (P1-1): Chủ nhiệm quản lý điểm mọi lớp — Sổ điểm đứng ngay sau Lớp (gia sư thấy Sổ điểm ở nhóm "Dạy học" như cũ).
  const soDiemItem: ModuleItem = { key: "so-diem", label: "Sổ điểm", href: "/lop-cua-toi/so-diem", icon: "bai-kt", active: isUnder(pathname, "/lop-cua-toi/so-diem") };
  const withStudents = head ? [...mods, soDiemItem] : mods.some(m => m.key === "lop")
    ? mods.flatMap<ModuleItem>(m => m.key === "lop" ? [m, studentItem] : [m])
    : [...mods, studentItem];
  // Thanh RỘNG (Figma "Điều hướng"): "Làm việc hằng ngày" = các module đang bật (trừ Học phí); Học phí đứng chung nhóm "Tiền" với Doanh thu; các nhóm còn lại là chính
  // danh sách của bảng "Khác". Module bị tắt vẫn chỉ ẩn khỏi thanh (dữ liệu giữ nguyên) nên nhóm đầu có thể ngắn hơn Figma.
  // SCL-G-GS (QUYET-DINH §3.4): "Hộp việc" đầu thanh; Hộp việc cũ theo cờ HOP_VIEC (module "hop-viec", có học phí) còn bật thì thanh máy tính giữ mục cũ, không nhân đôi.
  const inboxItem: ModuleItem = { key: "viec-lop", label: "Hộp việc", href: TUTOR_INBOX_PATH, icon: "hop-thu", badge: inbox, active: pathname === TUTOR_INBOX_PATH };
  const onClass = (classes ?? []).find(c => isUnder(pathname, classBase(c.id)));
  const classNav: NavItem[] = (classes ?? []).map(c => ({ key: `lop-${c.id}`, label: c.name, href: classBase(c.id), icon: "lop", dot: c.color, count: c.students, ownerName: c.ownerName, active: c === onClass }));
  const newClass: NavItem = { key: "tao-lop", label: "Tạo lớp mới", href: "/lop-cua-toi/lop/tao", icon: "them", active: pathname === "/lop-cua-toi/lop/tao" };
  const classGroups: NavGroup[] = !classes ? [] : head
    ? [...groupByOwner(classNav).map(g => ({ title: g.title, items: g.items, classes: true })), ...(classNav.length ? [] : [{ title: "Lớp của trung tâm", items: [], classes: true }])]
    : [{ title: "Lớp của bạn", items: [...classNav, newClass], classes: true }];
  // Trên thanh rộng, lớp đang mở sáng ở nhóm "Lớp của bạn" ⇒ mục "Lớp" không sáng thêm (chỉ một mục aria-current).
  const asNav = (m: ModuleItem): NavItem => ({ key: m.key, label: m.label, href: m.href ?? "/lop-cua-toi", icon: m.icon, active: m.key === "lop" && onClass ? false : m.active, badge: m.badge });
  const oldInbox = withStudents.some(m => m.key === "hop-viec");
  const daily = [...(oldInbox ? [] : [inboxItem]), ...withStudents];
  const [dayTeach, money, intro, account] = groups.map(moreToNavGroup);
  const wide: NavGroup[] = head ? [{ title: "Dạy học", items: daily.map(asNav) }, ...classGroups, dayTeach].filter(g => g.items.length > 0 || g.classes) : [
    { title: "Làm việc hằng ngày", items: daily.filter(m => m.key !== "hoc-phi").map(asNav) },
    ...classGroups,
    dayTeach,
    { title: money.title, items: [...withStudents.filter(m => m.key === "hoc-phi").map(asNav), ...money.items] },
    intro,
    account,
  ].filter(g => g.items.length > 0);
  // SCL-G-GS (QUYET-DINH §3.4, gia sư điện thoại): thanh dưới ĐÚNG 3 mục Hộp việc / Lớp / Tôi; các module còn lại vào qua "Tôi" (bảng Khác, nhóm "Dạy học" chỉ điện thoại).
  const items: ModuleItem[] = [
    ...daily.map(m => ({ ...m, desktopOnly: m.key !== "viec-lop" })),
    // B2: bỏ mục "Cài đặt" lẻ (trùng nhóm Tài khoản của thanh rộng + menu tài khoản).
    { key: "khac", label: "Khác", icon: "khac", onClick: () => setMoreOpen(o => !o), active: moreActive, controls: "khac-bang", expanded: moreOpen, desktopOnly: true },
    { key: "lop-m", label: "Lớp", href: "/lop-cua-toi/lop", icon: "lop", active: isUnder(pathname, "/lop-cua-toi/lop") || isUnder(pathname, "/lop-cua-toi/quan-lop") || isUnder(pathname, "/lop-cua-toi/so-diem"), mobileOnly: true },
    { key: "toi", label: "Tôi", icon: "nguoi", onClick: () => setMoreOpen(o => !o), active: moreActive, controls: "khac-bang", expanded: moreOpen, mobileOnly: true },
  ];
  const mobileTeach: MoreGroup[] = [{ title: "Làm việc hằng ngày", links: daily.filter(m => m.key !== "viec-lop" && m.key !== "lop" && m.href).map(m => ({ label: m.label, href: m.href!, icon: m.icon })) }].filter(g => g.links.length > 0);

  return (
    // kin-chu-than: chữ thân Inter như ảnh Figma các màn gia sư (trước đó thừa kế Be Vietnam Pro của <body>, rộng hơn nên dòng xuống hàng khác Figma).
    <div className="kin-chu-than md:flex min-h-screen bg-[var(--kin-nen-trang)] [--kin-top:48px] md:[--kin-top:68px]">
      <KinSkipLink />
      <ModuleRail roleLabel={head ? "CHỦ NHIỆM" : "GIA SƯ"} ariaLabel="Module của gia sư" modules={items} groups={wide} onCollapse={closeMore}
        home={{ href: home, label: homeLabel }} footnote="Miễn phí ra mắt" />

      <div className="flex-1 min-w-0 pb-[60px] md:pb-0 relative">
        <div className="h-12 md:h-[68px] flex items-center justify-between gap-3 px-4 md:px-10 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
          <div className="flex items-center gap-1 min-w-0">
            <RailOpenButton pending={Object.values(badges).reduce((a, n) => a + (n > 0 ? n : 0), 0)} />
            <Link href={home} aria-label={homeLabel} className="inline-flex md:hidden"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
            {user && <p data-top-title className="hidden md:block truncate text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Sổ dạy học của {user.name}</p>}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <TopDate />
            {/* HV-11: chuông thông báo (dùng lại thông báo có sẵn) + dấu hỏi trợ giúp dẫn tới trang Liên hệ hỗ trợ. */}
            <NotificationBell />
            {!head && <Link href="/lop-cua-toi/ho-tro" aria-label="Trợ giúp" title="Trợ giúp" data-help-link
              className="inline-flex flex-shrink-0 items-center justify-center w-11 h-11 rounded-lg border border-[var(--kin-vien-thuong)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-bang)] hover:text-[var(--kin-chu-chinh)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9.5" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9" /><path d="M12 17.2h.01" />
              </svg>
            </Link>}
            {user && <AccountMenu name={user.name} email={user.email} onLogout={() => void logout()}
              links={head
                ? [{ label: "Trang quản trị", href: `https://${ADMIN_HOST}/admin` }, { label: "Trang chủ KiN", href: "/" }]
                : [{ label: "Cài đặt", href: "/lop-cua-toi/cai-dat" }, { label: "Hồ sơ gia sư", href: "/lop-cua-toi/ho-so" }, { label: "Trang chủ KiN", href: "/" }]} />}
          </div>
        </div>
        <KinSkipTarget />
        {children}
      </div>

      {moreOpen && <MorePanel id="khac-bang" groups={panelGroups} mobileGroups={mobileTeach} onClose={closeMore} user={user} onLogout={() => void logout()} />}
    </div>
  );
}

function PendingShell({ user, onLogout, children }: { user: { name: string; email: string } | null; onLogout: () => void; children: React.ReactNode }) {
  const wide: NavGroup[] = [{ title: "Hồ sơ gia sư", items: PENDING_ITEMS.map(m => ({ key: m.key, label: m.label, href: m.href ?? TUTOR_PENDING_PATH, icon: m.icon })) }];
  return (
    <div data-tutor-pending-shell className="kin-chu-than md:flex min-h-screen bg-[var(--kin-nen-trang)] [--kin-top:48px] md:[--kin-top:68px]">
      <KinSkipLink />
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
            {user && <AccountMenu name={user.name} email={user.email} onLogout={onLogout}
              links={[{ label: "Trạng thái hồ sơ", href: TUTOR_PENDING_PATH }, { label: "Sửa hồ sơ", href: "/lop-cua-toi/ho-so" }, { label: "Chủ đề màu", href: "/cai-dat/chu-de" }]} />}
          </div>
        </div>
        <KinSkipTarget />
        {/* Băng chờ duyệt: chữ nói rõ trạng thái (không chỉ màu), một liên kết đi tiếp. */}
        <div data-tutor-pending-band className="mx-4 md:mx-10 mt-4">
          <KinCallout title="Hồ sơ gia sư đang chờ duyệt">
            KiN sẽ báo khi duyệt xong. Trong lúc chờ, bạn xem được trạng thái hồ sơ và gửi câu hỏi cho KiN ở mục Liên hệ hỗ trợ bên thanh điều hướng.
          </KinCallout>
        </div>
        {children}
      </div>
    </div>
  );
}
