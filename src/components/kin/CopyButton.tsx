// Nút sao chép có dấu tích. Chuyển động theo Lucian UX/UI Prompt #008 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#008
// (CSS .kin-copy* ở src/app/kin-motion.css). Bấm → chép vào bộ nhớ tạm (src/lib/clipboard.ts, có đường lui) → hai ô vuông vẽ lại thành dấu tích,
// bong bóng "Đã sao chép" nảy lên, 1,8 giây sau trở về như cũ. Chép lỗi thì bong bóng đỏ "Không sao chép được".
// Trình đọc màn hình nghe qua vùng role="status" (bong bóng chỉ là hình, aria-hidden).
//   appearance="icon"   : nút vuông chỉ có biểu tượng (44px; size="sm" = 32px cho hàng thao tác dày) (đặt cạnh một giá trị: số tài khoản, mã…); `label` là tên đọc cho trình đọc màn hình.
//   appearance="button" : KinButton có biểu tượng + chữ; chữ đổi thành `copiedLabel` khi xong.
//   appearance="chip"   : nút nhỏ kiểu thanh công cụ (icon + chữ, chữ xám); `className` do nơi dùng đặt.
"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { KinButton, type KinButtonVariant } from "./Button";

type Phase = "idle" | "done" | "fail";
const HOLD_MS = 1800;

function Icon() {
  return (
    <span className="kin-copy-ico" aria-hidden="true">
      <svg className="cp" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>
      <svg className="ok" viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2L18.5 8" /></svg>
    </span>
  );
}

export interface KinCopyButtonProps {
  /** Chuỗi cần chép, hoặc hàm trả chuỗi (gọi lúc bấm: vd. dựng link từ window.location). */
  text: string | (() => string);
  /** Tên hành động cho trình đọc màn hình, vd. "Chép số tài khoản". */
  label: string;
  appearance?: "icon" | "button" | "chip";
  /** Chỉ cho appearance="icon": "sm" = 32px, vừa hàng thao tác dày (cộng đồng); mặc định 44px. */
  size?: "md" | "sm";
  /** Chữ cạnh biểu tượng (kiểu button / chip). */
  children?: ReactNode;
  copiedLabel?: string;
  failedLabel?: string;
  /** Kiểu của KinButton khi appearance="button". */
  buttonVariant?: KinButtonVariant;
  /** Báo kết quả cho nơi dùng (vd. bật thêm toast, ghi nhận). */
  onResult?: (ok: boolean) => void;
  className?: string;
}

export function KinCopyButton({
  text, label, appearance = "icon", size = "md", children, copiedLabel = "Đã sao chép", failedLabel = "Không sao chép được",
  buttonVariant = "secondary", onResult, className = "",
}: KinCopyButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []); // rời trang thì dọn hẹn giờ

  const run = useCallback(async () => {
    const ok = await copyToClipboard(typeof text === "function" ? text() : text);
    if (timer.current) clearTimeout(timer.current);
    setPhase(ok ? "done" : "fail");
    timer.current = setTimeout(() => setPhase("idle"), HOLD_MS);
    onResult?.(ok);
  }, [text, onResult]);

  const say = phase === "done" ? copiedLabel : phase === "fail" ? failedLabel : "";
  const live = <span className="sr-only" role="status" aria-live="polite">{say}</span>;

  if (appearance === "button") {
    return (
      <span className="kin-copy kin-m" data-copy={phase}>
        <KinButton variant={buttonVariant} onClick={run} leading={<Icon />} >
          {phase === "done" ? copiedLabel : children ?? label}
        </KinButton>
        {live}
      </span>
    );
  }
  if (appearance === "chip") {
    return (
      <span className="kin-copy kin-m" data-copy={phase}>
        <button type="button" onClick={run} className={className}
          style={{ color: phase === "done" ? "var(--kin-tt-chu-xong)" : phase === "fail" ? "var(--kin-tt-chu-loi)" : undefined }}>
          <Icon />
          <span>{phase === "done" ? copiedLabel : phase === "fail" ? failedLabel : children ?? label}</span>
        </button>
        {live}
      </span>
    );
  }
  return (
    <span className={`kin-copy kin-m ${className}`} data-copy={phase}>
      <button type="button" onClick={run} aria-label={label} title={label} className={size === "sm" ? "kin-copy-btn kin-copy-btn--sm" : "kin-copy-btn"}><Icon /></button>
      <span className="kin-copy-tip" aria-hidden="true">{phase === "fail" ? failedLabel : copiedLabel}</span>
      {live}
    </span>
  );
}
