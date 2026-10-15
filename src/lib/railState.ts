// Trạng thái THU / MỞ của thanh bên trái (14/10/2026). Thuần (không đụng DOM) để test từng quy tắc; phần chạm DOM + lưu trữ nằm ở
// src/components/kin/shell/railStore.ts. Thiết kế đầy đủ: docs/kin/thiet-ke/thanh-ben-trai.md.
//
// Hai trạng thái, chỉ ở máy tính (≥768px): "mo" = hiện (mặc định, 79px đúng Figma), "thu" = thụt vào hẳn (0px, có nút mở ở dải trên).
// Điện thoại luôn có thanh dưới, không thu được. Thanh KHÔNG bao giờ tự thu: chỉ thu khi người dùng chủ động.
export const RAIL_KEY = "kin.thanh-ben";
export const RAIL_ATTR = "data-kin-rail";
/** Bề rộng MỞ dùng gần nhất ("mo" | "rong"): thu rồi mở lại (phím "[" hay nút mở) thì về đúng bề rộng đó chứ không về 79px. */
export const RAIL_OPEN_KEY = "kin.thanh-ben-truoc";

export type RailState = "mo" | "rong" | "thu";
export type RailOpen = "mo" | "rong";

export const parseRail = (v: unknown): RailState | null => (v === "mo" || v === "rong" || v === "thu" ? v : null);
/** Phím "[": thu ⇄ mở. (Mở về đâu — 79px hay 220px — do reopenRail quyết.) */
export const toggleRail = (s: RailState): RailState => (s === "thu" ? "mo" : "thu");
/** Bề rộng để mở lại: đúng cái đã dùng lần trước; giá trị lạ / chưa có → 79px. */
export const reopenRail = (last: unknown): RailOpen => (last === "rong" ? "rong" : "mo");
/** Đổi giữa hẹp 79px ⇄ rộng 220px khi đang mở; đang thu thì không đổi. */
export const widenRail = (s: RailState): RailState => (s === "mo" ? "rong" : s === "rong" ? "mo" : s);

/**
 * Chạy TRƯỚC khi trình duyệt vẽ trang (chèn ở layout gốc): đã lưu "thu" / "rong" thì đặt data-kin-rail lên <html> ngay, CSS ẩn (hoặc nới) thanh luôn từ khung hình
 * đầu tiên. Không có nó, thanh bên sẽ hiện ra rồi mới thụt vào mỗi lần tải trang. Một dòng, không chứa "</script", không ném lỗi khi
 * trình duyệt chặn localStorage.
 */
export const RAIL_INIT_SCRIPT = `try{var v=localStorage.getItem(${JSON.stringify(RAIL_KEY)});if(v==="thu"||v==="rong")document.documentElement.setAttribute(${JSON.stringify(RAIL_ATTR)},v)}catch(e){}`;

export interface KeyInfo {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  target: { tagName?: string; isContentEditable?: boolean; role?: string | null } | null;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const TYPING_ROLES = new Set(["textbox", "combobox", "searchbox", "spinbutton"]);

/** Phím "[" bật/tắt thanh bên — trừ khi đang gõ chữ (không nuốt ký tự), có phím bổ trợ (nhường phím tắt của trình duyệt), đang dùng bộ gõ, hoặc giữ phím. */
export function isRailShortcut(e: KeyInfo): boolean {
  if (e.key !== "[" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.repeat) return false;
  const t = e.target;
  if (!t) return true;
  if (TYPING_TAGS.has((t.tagName ?? "").toUpperCase()) || t.isContentEditable || TYPING_ROLES.has(t.role ?? "")) return false;
  return true;
}
