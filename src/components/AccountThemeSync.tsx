// TK-167 — chủ đề màu (và, từ 14/10/2026, thanh bên thu/mở) lưu theo TÀI KHOẢN, không theo máy. Vào máy mới (hoặc xoá dữ liệu
// trình duyệt) thì chủ đề đã chọn trên tài khoản được kéo về và áp ngay; localStorage chỉ
// còn là bản nháp để trang không nháy sang Navy trước khi server trả lời.
// Phải nằm trong AuthProvider (cần biết ai đang đăng nhập); khách thì không gọi gì.
"use client";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { applyTheme, saveTheme } from "@/components/ThemeApplier";
import { KIN_THEMES, KIN_MODES, type KinTheme, type KinMode } from "@/lib/kinTheme";
import { parseRail } from "@/lib/railState";
import { applyRail, saveRailLocal } from "@/components/kin/shell/railStore";

/** Sự kiện phát ra khi chủ đề được kéo về từ tài khoản. */
export const THEME_SYNC_EVENT = "kin-theme-sync";

export default function AccountThemeSync() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/users/me/preferences", { credentials: "same-origin" });
        if (!r.ok || cancelled) return;
        const { preferences: p } = (await r.json()) as { preferences?: { theme?: string; mode?: string; rail?: string } };
        if (!p) return;
        // Thanh bên thu/mở cũng theo TÀI KHOẢN: tài khoản đã chọn thì máy này làm theo (máy chưa chọn gì thì giữ mặc định là hiện).
        const rail = parseRail(p.rail);
        if (rail) { applyRail(rail); saveRailLocal(rail); }
        if (!p.theme && !p.mode) return;
        const theme = (KIN_THEMES as readonly string[]).includes(p.theme ?? "") ? (p.theme as KinTheme) : null;
        const mode = (KIN_MODES as readonly string[]).includes(p.mode ?? "") ? (p.mode as KinMode) : null;
        const html = document.documentElement;
        const t = theme ?? (html.getAttribute("data-chu-de") as KinTheme | null) ?? "navy";
        const m = mode ?? (html.getAttribute("data-che-do") as KinMode | null) ?? "auto";
        applyTheme(t, m);
        saveTheme(t, m);
        // Trang đang mở (vd. trang chọn chủ đề) đã đọc lựa chọn cũ của máy lúc vào — báo để nó cập nhật theo tài khoản.
        window.dispatchEvent(new CustomEvent(THEME_SYNC_EVENT, { detail: { theme: t, mode: m } }));
      } catch { /* không có mạng: giữ chủ đề của máy */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return null;
}

/** Ghi lựa chọn chủ đề lên tài khoản (không chờ, không báo lỗi — máy đã áp rồi). Khách thì bỏ qua. */
export function saveThemeToAccount(theme: KinTheme, mode: KinMode): void {
  void fetch("/api/users/me/preferences", {
    method: "PUT", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme, mode }),
  }).catch(() => {});
}
