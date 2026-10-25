// Thanh module của vỏ KiN (Figma "Thanh module" 11:99 / Nút module 8:122; bo-cuc-outlook.md mục 3, 6, 8).
// Máy tính: cột trái 79px, dọc, THU ĐƯỢC (14/10/2026: nút "Thu gọn thanh bên" + phím "[", nhớ theo máy và theo tài khoản; xem railStore.ts và
// docs/kin/thiet-ke/thanh-ben-trai.md). Điện thoại: thanh dưới cao 60px (ngón cái với tới đáy), luôn hiện, không thu.
// Nút đang chọn dùng aria-current, KHÔNG dùng aria-selected (đây là điều hướng, không phải chọn trong một tập).
// Badge đỏ chỉ đếm VIỆC CẦN NGƯỜI ĐÓ RA TAY và có nhãn chữ đọc được ("3 việc cần xử lý").
// 15/10/2026 — theo Lucian UX/UI Prompt No.040 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#040 (CSS .kin-rail* ở src/app/kin-motion.css):
//   (1) trạng thái thứ ba "rộng" 220px — nhãn chữ nằm CẠNH biểu tượng, hiện lần lượt (mỗi nhãn trễ thêm 35ms), bật/tắt bằng nút ở cạnh dưới thanh;
//   (2) một vạch nổi bật dùng chung TRƯỢT (lò xo 0,5 giây) tới mục đang chọn thay cho nền từng mục tự bật/tắt. Vạch đặt thẳng lên DOM (đo offsetTop…) nên không dựng lại.
// 25/10/2026 — Figma "Nền móng" (khung con "Điều hướng", mọi màn gia sư / học sinh / quản trị) vẽ trạng thái RỘNG: thanh 272px có logo + nhãn vai, các MỤC xếp theo NHÓM
//   (tiêu đề nhóm viết hoa nhỏ), mỗi mục một biểu tượng + chữ, chân "Miễn phí ra mắt". Trạng thái này giờ là MẶC ĐỊNH ("rong", xem src/lib/railState.ts); thanh hẹp 79px ("mo")
//   và thu hẳn ("thu") vẫn chọn được. Hai bộ mục cùng nằm trong DOM và CSS chọn bộ nào hiện theo data-kin-rail trên <html> (không dựng lại, không nháy):
//   `modules` = bộ biểu tượng cho thanh hẹp (+ thanh dưới điện thoại), `groups` = bộ có nhóm cho thanh rộng. Số đo thanh rộng lấy từ Figma: nhóm cách nhau 6px, tiêu đề nhóm 11,1px,
//   mục cao 37px (44px khi màn cảm ứng) bo --kin-bo-md, biểu tượng 21px cách chữ 12px; mục đang chọn nền "đang chọn" + chữ navy đậm.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ShellIcon } from "./ShellIcon";
import { chooseRail, lastOpenRail, readRail, useRail } from "./railStore";
import { isRailShortcut, toggleRail, widenRail } from "@/lib/railState";

/** Mục của thanh rộng (nằm trong một nhóm). `active` để nơi gọi tự quyết; không có thì so đường dẫn như ModuleItem. */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: string;
  also?: string[];
  active?: boolean;
  badge?: number;
  external?: boolean;
}
export interface NavGroup { title: string; items: NavItem[] }

export interface ModuleItem {
  key: string;
  label: string;
  href?: string;
  /** Đường dẫn khác cũng coi là đang ở module này (vd. /student/bai-giang thuộc "Lớp"). */
  also?: string[];
  icon: string;
  /** Số việc cần ra tay. 0 / undefined = không hiện. */
  badge?: number;
  /** Mở thẻ <a> thường (sang tên miền khác). */
  external?: boolean;
  /** Không phải liên kết mà là nút (vd. "Khác" mở bảng). */
  onClick?: () => void;
  active?: boolean;
  controls?: string;
  expanded?: boolean;
  /** Chỉ hiện ở thanh bên (máy tính). Figma điện thoại chỉ có 4 tab; mục còn lại vào qua menu tài khoản ("Tất cả mục"). */
  desktopOnly?: boolean;
  /** Chỉ hiện ở thanh dưới (điện thoại). */
  mobileOnly?: boolean;
}

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
export const isModuleActive = (pathname: string, m: ModuleItem) =>
  m.active ?? (!!m.href && (matches(pathname, m.href) || (m.also ?? []).some(p => matches(pathname, p))));

function Badge({ n, mobile }: { n: number; mobile: boolean }) {
  return (
    <span className={`kin-badge-dem absolute top-[3px] ${mobile ? "left-[calc(50%+4px)]" : "left-[40px]"}`} aria-label={`${n} việc cần xử lý`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function ModuleRail({ roleLabel, modules, groups, ariaLabel, children, onCollapse, home, footnote }: {
  roleLabel: string;
  modules: ModuleItem[];
  /** Các mục xếp theo nhóm cho thanh RỘNG (Figma "Điều hướng" 272px). Không truyền thì thanh rộng không có gì để hiện, nên mọi vỏ đều truyền. */
  groups?: NavGroup[];
  ariaLabel: string;
  /** Hiện dưới cùng thanh module trên máy tính (vd. nút cài đặt). */
  children?: ReactNode;
  /** Gọi khi người dùng thu thanh (vd. để đóng bảng "Khác" đang neo vào thanh). */
  onCollapse?: () => void;
  /** Logo KiN ở đầu thanh (Figma: logo đứng đầu cột trái), dẫn về trang đầu của vai. */
  home?: { href: string; label: string };
  /** Dòng chữ nhỏ cuối thanh (Figma: "Miễn phí ra mắt"). */
  footnote?: string;
}) {
  const pathname = usePathname();
  const [rail] = useRail();
  const itemsRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLSpanElement>(null);

  // Đặt vạch nổi bật dưới mục đang chọn (đo thẳng từ DOM, ghi vào biến CSS). Chạy sau MỌI lần vẽ: rẻ, và bắt được cả đổi đường dẫn / đổi bề rộng thanh.
  const place = useCallback(() => {
    const box = itemsRef.current, hl = hlRef.current;
    if (!box || !hl) return;
    const el = box.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el) { delete hl.dataset.on; box.removeAttribute("data-hl"); return; }
    hl.style.setProperty("--x", `${el.offsetLeft}px`);
    hl.style.setProperty("--y", `${el.offsetTop}px`);
    hl.style.setProperty("--w", `${el.offsetWidth}px`);
    hl.style.setProperty("--h", `${el.offsetHeight}px`);
    hl.dataset.on = "1";
    box.dataset.hl = "1";
  }, []);
  useLayoutEffect(() => { place(); });
  // Chỉ bật chuyển động SAU khung hình đầu (không thì vạch trượt từ góc lúc trang vừa hiện).
  useEffect(() => {
    const id = requestAnimationFrame(() => { if (hlRef.current) hlRef.current.dataset.anim = "1"; });
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const box = itemsRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place());
    ro.observe(box);
    return () => ro.disconnect();
  }, [place]);

  const widen = () => { chooseRail(widenRail(readRail())); onCollapse?.(); }; // bảng "Khác" (neo cạnh thanh hẹp) đóng khi đổi bề rộng

  // Thu: tiêu điểm sang nút "Mở thanh bên" ở dải trên. (Thanh bị ẩn nên nút bấm vừa rồi mất tiêu điểm; không chuyển thì bàn phím rơi về đầu trang.)
  const collapse = () => {
    chooseRail("thu");
    onCollapse?.();
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-rail-open]")?.focus());
  };

  // Phím "[" bật/tắt, chỉ ở máy tính và khi không đang gõ chữ. Đăng ký ở đây (mỗi vỏ có đúng một thanh) nên phòng thi — không có vỏ — cũng không bắt phím này.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      const t = e.target as HTMLElement | null;
      if (!isRailShortcut({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: e.isComposing, repeat: e.repeat, target: t && { tagName: t.tagName, isContentEditable: t.isContentEditable, role: t.getAttribute?.("role") } })) return;
      e.preventDefault();
      const next = toggleRail(readRail());
      if (next === "thu") { chooseRail("thu"); onCollapse?.(); } else chooseRail(lastOpenRail()); // mở lại về đúng bề rộng đã dùng (79px hoặc 220px)
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCollapse]);

  const renderItem = (m: ModuleItem, mobile: boolean, index = 0) => {
    const active = isModuleActive(pathname, m);
    const cls = mobile
      ? "relative flex-1 min-w-0 min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-caption)] tracking-[0.02em]"
      : "kin-rail-it relative w-[66px] min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-[var(--kin-bo-sm)] pt-2 pb-[6px] px-0 text-[length:var(--kin-co-caption)] tracking-[-0.01em]";
    const style = {
      background: active ? "var(--kin-nen-nhan)" : mobile ? "var(--kin-nen-re-chuot)" : "transparent",
      color: active ? "var(--kin-nhan-diem)" : "var(--kin-chu-mo)",
      fontWeight: 600,
      "--i": index,
    } as CSSProperties;
    const inner = (
      <>
        <ShellIcon name={m.icon} />
        <span className="kin-rail-lab truncate max-w-full leading-tight">{m.label}</span>
        {m.badge && m.badge > 0 ? <Badge n={m.badge} mobile={mobile} /> : null}
      </>
    );
    const common = { className: `${cls} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`, style, "aria-current": active ? ("page" as const) : undefined };
    if (m.onClick) {
      return <button key={m.key} type="button" onClick={m.onClick} data-khac-nut aria-haspopup="dialog" aria-expanded={m.expanded ?? false} aria-controls={m.controls} {...common}>{inner}</button>;
    }
    return m.external || !m.href?.startsWith("/")
      ? <a key={m.key} href={m.href} {...common}>{inner}</a>
      : <Link key={m.key} href={m.href} {...common}>{inner}</Link>;
  };

  const renderWide = (m: NavItem) => {
    const active = m.active ?? (matches(pathname, m.href.split("#")[0]) || (m.also ?? []).some(p => matches(pathname, p)));
    const cls = "kin-rail-wi flex items-center gap-3 min-h-[37px] [@media(pointer:coarse)]:min-h-11 px-3 py-2 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-small)] leading-5 transition-colors hover:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";
    const style: CSSProperties = {
      background: active ? "var(--kin-nen-dang-chon)" : undefined,
      color: active ? "var(--kin-th-navy)" : "var(--kin-chu-chinh)",
      fontWeight: active ? 600 : 500,
    };
    const inner = (
      <>
        <ShellIcon name={m.icon} />
        <span className="min-w-0 flex-1 truncate">{m.label}</span>
        {m.badge && m.badge > 0 ? <span className="kin-badge-dem flex-shrink-0" aria-label={`${m.badge} việc cần xử lý`}>{m.badge > 99 ? "99+" : m.badge}</span> : null}
      </>
    );
    return m.external || !m.href.startsWith("/")
      ? <a key={m.key} href={m.href} className={cls} style={style} aria-current={active ? "page" : undefined}>{inner}</a>
      : <Link key={m.key} href={m.href} className={cls} style={style} aria-current={active ? "page" : undefined}>{inner}</Link>;
  };

  return (
    <>
      {/* Máy tính. Khung ngoài đổi bề rộng 272px (rộng, mặc định) ⇄ 79px (hẹp) ⇄ 0 (thu) — CSS .kin-rail-wrap ở kin-tokens.css / kin-motion.css, theo data-kin-rail trên <html>. */}
      <div id="kin-rail" className="kin-rail-wrap hidden md:block flex-shrink-0">
        <nav aria-label={ariaLabel}
          className="kin-rail-nav kin-m flex flex-col items-center gap-[2px] w-[79px] px-[6px] py-[10px] sticky top-0 h-screen overflow-y-auto bg-[var(--kin-nen-bang)] border-r border-[var(--kin-vien-thuong)]">
          {home && (
            <Link href={home.href} aria-label={home.label} data-rail-home className="kin-rail-home flex items-center justify-center min-h-11 w-[66px] mt-1 mb-3 rounded-[var(--kin-bo-sm)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
              <span className="kin-chu-logo leading-none" style={{ fontSize: "var(--kin-rail-logo, var(--kin-co-h4))", color: "var(--kin-nhan-chu-tren-nhat, var(--kin-th-navy))" }}>KiN</span>
              {/* Chỉ thanh rộng: nhãn vai cạnh logo như Figma ("GIA SƯ" / "HỌC SINH" / "QUẢN TRỊ"). Trình đọc màn hình đã có <p> sr-only bên dưới. */}
              <span aria-hidden className="kin-rail-tag">{roleLabel}</span>
            </Link>
          )}
          {/* Vai trò: Figma không in nhãn này; giữ cho trình đọc màn hình và bài kiểm (sr-only). */}
          <p className={home ? "kin-rail-role sr-only" : "kin-rail-role text-[length:var(--kin-co-caption)] font-semibold tracking-[0.02em] text-[var(--kin-chu-mo)] text-center mb-[10px]"}>{roleLabel}</p>
          <div ref={itemsRef} className="kin-rail-items relative flex flex-col items-center gap-[2px] w-full">
            <span ref={hlRef} aria-hidden className="kin-rail-hl" />
            {modules.filter(m => !m.mobileOnly).map((m, i) => renderItem(m, false, i))}
          </div>
          {groups && (
            <div className="kin-rail-groups kin-chu-than w-full flex-col gap-[6px]">
              {groups.map(g => (
                <div key={g.title} role="group" aria-label={g.title} className="flex flex-col gap-[2px] pt-[10px]">
                  <p aria-hidden className="kin-rail-gh h-4 text-[length:var(--kin-co-caption)] leading-4 font-semibold uppercase text-[var(--kin-chu-mo)]">{g.title}</p>
                  {g.items.map(renderWide)}
                </div>
              ))}
            </div>
          )}
          <button type="button" data-rail-close onClick={collapse}
            aria-label="Thu gọn thanh bên" aria-expanded={rail !== "thu"} aria-controls="kin-rail" title="Thu gọn thanh bên (phím [)"
            className="kin-rail-close self-center w-[66px] min-h-11 mt-1 flex items-center justify-center rounded-[var(--kin-bo-sm)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-re-chuot)] hover:text-[var(--kin-chu-chinh)] transition-colors">
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /><path d="M16 10l-2 2 2 2" />
            </svg>
          </button>
          {children && <div className="mt-auto pt-3 flex flex-col items-center gap-1">{children}</div>}
          {footnote && <p data-rail-footnote className={`kin-rail-foot ${children ? "mt-3" : "mt-auto"} pt-3 w-[66px] border-t border-[var(--kin-vien-thuong)] text-center text-[length:var(--kin-co-caption)] leading-tight text-[var(--kin-chu-mo)]`}>{footnote}</p>}

          <button type="button" data-rail-widen onClick={widen} aria-pressed={rail === "rong"}
            aria-label={rail === "rong" ? "Thu hẹp thanh bên" : "Mở rộng thanh bên có nhãn chữ"} title={rail === "rong" ? "Thu hẹp thanh bên" : "Mở rộng thanh bên có nhãn chữ"}
            className="kin-rail-wide">
            <svg aria-hidden viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </nav>
      </div>
      <nav aria-label={ariaLabel}
        className="md:hidden fixed bottom-0 inset-x-0 h-[60px] flex items-center gap-2 px-2 z-30 bg-[var(--kin-nen-trang)] border-t border-[var(--kin-vien-thuong)]">
        {modules.filter(m => !m.desktopOnly).map((m, i) => renderItem(m, true, i))}
      </nav>
    </>
  );
}
