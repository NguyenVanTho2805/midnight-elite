// SCL-D (P2-35): công tắc có tên và trạng thái cho trình đọc màn hình (role="switch", aria-checked, aria-label hoặc aria-labelledby),
// vùng bấm 44×44 (rãnh hiển thị vẫn 36×20), type="button" để không gửi form.
"use client";

export function Toggle({ checked, onChange, disabled, label, labelledBy }: {
  checked: boolean; onChange: () => void; disabled?: boolean;
  /** Tên đọc cho công tắc khi không có nhãn chữ bên cạnh trỏ tới bằng `labelledBy`. */
  label?: string; labelledBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onClick={onChange}
      disabled={disabled}
      className="relative inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
      <span aria-hidden className="relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200"
        style={{ background: checked ? "var(--kin-tt-chu-xong)" : "var(--kin-vien-thuong)" }}>
        <span
          className="pointer-events-none inline-block h-4 w-4 rounded-full bg-[var(--kin-nen-trang)] shadow transition-transform duration-200"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
