// LOI-05 mục 4.1 — ô tìm theo tên / môn. Enter áp ngay; dừng gõ 400 ms thì tự áp. Giá trị áp nằm trên URL (bên gọi ghi).
// Khi URL đổi KHÔNG do ô này (Xóa lọc, Quay lại), ô nhận lại giá trị mới; khi URL đổi vì chính lần áp của ô thì không giật chữ đang gõ.
"use client";
import { useEffect, useId, useRef, useState } from "react";

export const CHO_GO_MS = 400;
const Q_TOI_DA = 60;

export function OTim({ value, onApply }: { value: string; onApply: (q: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  const sent = useRef(value);
  const apply = useRef(onApply);
  useEffect(() => { apply.current = onApply; }, [onApply]);

  // URL đổi từ nơi khác ⇒ đồng bộ chữ trong ô.
  useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    setText(value);
  }, [value]);

  // Dừng gõ 400 ms ⇒ áp.
  useEffect(() => {
    const q = text.trim();
    if (q === sent.current.trim()) return;
    const t = setTimeout(() => { sent.current = q; apply.current(q); }, CHO_GO_MS);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <form role="search" className="w-full min-w-0" onSubmit={e => { e.preventDefault(); const q = text.trim(); sent.current = q; apply.current(q); }}>
      <label htmlFor={id} className="sr-only">Tìm gia sư theo tên hoặc môn</label>
      <input
        id={id} type="search" enterKeyHint="search" autoComplete="off" maxLength={Q_TOI_DA}
        placeholder="Tìm theo tên hoặc môn" value={text} onChange={e => setText(e.target.value)}
        className="min-h-[var(--kin-cham-toi-thieu)] w-full min-w-0 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-4 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
      />
    </form>
  );
}
