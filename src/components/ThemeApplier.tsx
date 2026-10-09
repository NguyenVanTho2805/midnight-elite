// TK-167 (09/10/2026) — áp dụng chủ đề KiN theo lựa chọn người dùng.
//
// Lưu trong localStorage để không chờ server khi chuyển trang (tránh
// nháy sang Navy mặc định rồi chuyển sang chủ đề của user). Khi có
// bảng User.preferences sau sẽ sync chéo client-server.
//
// 5 chủ đề: navy, co-vit, man, ca-phe, muc.
// 3 chế độ: sang, toi, auto (auto = theo máy, bỏ data-che-do).
"use client";
import { useEffect } from "react";

export const KIN_THEMES = ["navy", "co-vit", "man", "ca-phe", "muc"] as const;
export const KIN_MODES  = ["auto", "sang", "toi"] as const;
export type KinTheme = (typeof KIN_THEMES)[number];
export type KinMode  = (typeof KIN_MODES)[number];

const KEY_THEME = "kin.chu-de";
const KEY_MODE  = "kin.che-do";
const DEFAULT_THEME: KinTheme = "navy";
const DEFAULT_MODE:  KinMode  = "auto";

export function readSavedTheme(): { theme: KinTheme; mode: KinMode } {
  if (typeof window === "undefined") return { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
  try {
    const t = localStorage.getItem(KEY_THEME) as KinTheme | null;
    const m = localStorage.getItem(KEY_MODE)  as KinMode  | null;
    return {
      theme: t && (KIN_THEMES as readonly string[]).includes(t) ? t : DEFAULT_THEME,
      mode:  m && (KIN_MODES as readonly string[]).includes(m)  ? m : DEFAULT_MODE,
    };
  } catch {
    return { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
  }
}

export function applyTheme(theme: KinTheme, mode: KinMode): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-chu-de", theme);
  if (mode === "auto") {
    html.removeAttribute("data-che-do");
  } else {
    html.setAttribute("data-che-do", mode);
  }
}

export function saveTheme(theme: KinTheme, mode: KinMode): void {
  try {
    localStorage.setItem(KEY_THEME, theme);
    localStorage.setItem(KEY_MODE,  mode);
  } catch { /* storage disabled, bỏ qua */ }
}

export function ThemeApplier() {
  useEffect(() => {
    const { theme, mode } = readSavedTheme();
    applyTheme(theme, mode);
  }, []);
  return null;
}
