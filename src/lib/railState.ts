// Trạng thái THU / MỞ của thanh bên trái (14/10/2026). Thuần (không đụng DOM) để test từng quy tắc; phần chạm DOM + lưu trữ nằm ở
// src/components/kin/shell/railStore.ts. Thiết kế đầy đủ: docs/kin/thiet-ke/thanh-ben-trai.md.
//
// Ba trạng thái, chỉ ở máy tính (≥768px): "rong" = thanh bên rộng 272px có nhóm và nhãn chữ (MẶC ĐỊNH từ 25/10/2026, Figma "Nền móng" khung "Điều hướng"),
// "mo" = thanh hẹp 79px chỉ biểu tượng (trước đây là mặc định; người dùng chọn thu hẹp thì được nhớ), "thu" = thụt vào hẳn (0px, có nút mở ở dải trên).
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
/** Bề rộng mặc định khi người dùng chưa chọn gì (máy này và tài khoản này). */
export const DEFAULT_RAIL: RailOpen = "rong";
/** Bề rộng để mở lại: đúng cái đã dùng lần trước; giá trị lạ / chưa có → mặc định (rộng). */
export const reopenRail = (last: unknown): RailOpen => (last === "mo" ? "mo" : DEFAULT_RAIL);
/** Đổi giữa rộng 272px ⇄ hẹp 79px khi đang mở; đang thu thì không đổi. */
export const widenRail = (s: RailState): RailState => (s === "mo" ? "rong" : s === "rong" ? "mo" : s);

/**
 * Chạy TRƯỚC khi trình duyệt vẽ trang (chèn ở layout gốc): đặt data-kin-rail lên <html> ngay (đã lưu "thu" / "mo" / "rong" thì đúng giá trị đó, chưa lưu hoặc giá trị lạ thì
 * mặc định "rong"), CSS dựng đúng bề rộng thanh từ khung hình đầu tiên. Không có nó, thanh bên sẽ hiện ra rồi mới đổi bề rộng mỗi lần tải trang. Một dòng, không chứa
 * "</script", không ném lỗi khi trình duyệt chặn localStorage (khi đó vẫn đặt mặc định).
 */
export const RAIL_INIT_SCRIPT = `(function(){var v="rong";try{var s=localStorage.getItem(${JSON.stringify(RAIL_KEY)});if(s==="thu"||s==="mo"||s==="rong")v=s}catch(e){}document.documentElement.setAttribute(${JSON.stringify(RAIL_ATTR)},v)})()`;

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
