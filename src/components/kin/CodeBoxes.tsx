// Ô nhập mã 6 số (Figma "Nhập mã 6 số" 32:27): sáu ô riêng, tự nhảy ô, dán cả mã, Backspace lùi ô.
// Trình duyệt/điện thoại gợi ý mã từ tin nhắn qua autoComplete="one-time-code" (đặt ở ô đầu).
// Chuyển động (15/10/2026) theo Lucian UX/UI Prompt #026 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#026 (CSS .kin-code* ở src/app/kin-motion.css):
// chữ số vừa nhập nảy lên từ dưới; đủ 6 số đang kiểm tra (`disabled`) thì sáu ô nhấp nhô thành sóng; `ok` thì sáu ô lần lượt chuyển màu xong; `invalid` thì cả hàng lắc đầu.
"use client";
import { useEffect, useRef, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from "react";
import { replayClass } from "@/lib/replayClass";

export interface CodeBoxesProps {
  value: string;
  onChange: (v: string) => void;
  /** Viền đỏ (mã vừa nhập sai) + cả hàng lắc đầu một lần. */
  invalid?: boolean;
  /** Mã đúng (đang chờ chuyển trang): sáu ô lần lượt chuyển sang màu xong. */
  ok?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Gọi khi đủ 6 số (bấm hoặc dán). */
  onComplete?: (v: string) => void;
  length?: number;
}

export const CodeBoxes = function CodeBoxes({ value, onChange, invalid, ok, disabled, autoFocus, onComplete, length = 6 }: CodeBoxesProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const row = useRef<HTMLDivElement>(null);
  const prevValue = useRef(value);
  const prevInvalid = useRef(false);
  // Ô nào VỪA có chữ số (trước trống, nay có) thì phát hiệu ứng nảy — dán cả mã thì cả sáu ô nảy.
  useEffect(() => {
    for (let i = 0; i < length; i++) if (!prevValue.current[i] && value[i]) replayClass(refs.current[i], "kin-code-pop");
    prevValue.current = value;
  }, [value, length]);
  // Vừa chuyển sang "sai" thì cả hàng lắc một lần.
  useEffect(() => {
    if (invalid && !prevInvalid.current) replayClass(row.current, "kin-code-shake");
    prevInvalid.current = !!invalid;
  }, [invalid]);
  const state = ok ? "ok" : disabled && value.length === length ? "check" : invalid ? "bad" : "idle";
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const set = (next: string) => {
    const v = next.replace(/\D/g, "").slice(0, length);
    onChange(v);
    if (v.length === length) onComplete?.(v);
  };

  function onInput(i: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) {
      // xoá ô i
      set(value.slice(0, i) + value.slice(i + 1));
      return;
    }
    if (digits.length > 1) {
      // gõ nhanh / trình duyệt điền cả mã vào một ô
      set((value.slice(0, i) + digits).slice(0, length));
      focusAt(Math.min(length - 1, i + digits.length));
      return;
    }
    set(value.slice(0, i) + digits + value.slice(i + 1));
    focusAt(i + 1);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i]) { e.preventDefault(); set(value.slice(0, Math.max(0, i - 1))); focusAt(i - 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); focusAt(i + 1); }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    set(digits);
    focusAt(Math.min(length - 1, digits.length));
  }

  return (
    <div ref={row} className="kin-code kin-m flex gap-2" data-state={state} role="group" aria-label={`Mã ${length} số`}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          value={value[i] ?? ""}
          onChange={e => onInput(i, e.target.value)}
          onKeyDown={e => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={e => e.currentTarget.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Chữ số ${i + 1} của mã`}
          aria-invalid={invalid ? true : undefined}
          style={{ "--i": i } as CSSProperties}
          className={[
            "kin-code-cell min-w-0 flex-1 h-14 rounded-[var(--kin-bo-sm)] border-[1.5px] border-solid text-center font-semibold text-[length:var(--kin-co-h4)]",
            "text-[var(--kin-chu-chinh)] bg-[var(--kin-nen-bang)] disabled:opacity-60",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]",
            invalid ? "border-[var(--kin-tt-chu-loi)]" : "border-[var(--kin-vien-o-nhap)] focus:border-[var(--kin-nhan-link)]",
          ].join(" ")}
        />
      ))}
    </div>
  );
};
