// Phần chạm trình duyệt của "gợi ý vỏ" (phần thuần + lý do: src/lib/signedInShell.ts). Gọi từ AuthContext mỗi khi biết ai đang đăng nhập.
import { SHELL_HINT_ATTR, SHELL_HINT_KEY, shellHintFor, type ShellKind } from "@/lib/signedInShell";

/** Ghi / xoá gợi ý ở cả <html> (CSS đọc ngay) lẫn localStorage (lần tải sau chạy SHELL_INIT_SCRIPT đọc lại). */
export function applyShellHint(kind: ShellKind | null): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (kind) html.setAttribute(SHELL_HINT_ATTR, kind); else html.removeAttribute(SHELL_HINT_ATTR);
  try {
    if (kind) localStorage.setItem(SHELL_HINT_KEY, kind); else localStorage.removeItem(SHELL_HINT_KEY);
  } catch { /* chế độ riêng tư / bị chặn: bỏ qua, lần sau chỉ là nháy khung khách một thoáng như cũ */ }
}

export function syncShellHint(user: { role: string | null; adminRole?: string | null } | null): void {
  applyShellHint(shellHintFor(user));
}
