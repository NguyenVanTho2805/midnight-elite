// Chọn icon cho thẻ lợi ích (HOME-02): lưới radio 5×2, ô 44px+, nhãn chữ dưới icon, chọn bằng mũi tên. Lưu theo KHOÁ, không lưu tên component.
"use client";
import { useRef } from "react";
import { HOME_ICON_KEYS, type HomeIconKey } from "@/lib/siteContent";
import { HOME_ICONS, HOME_ICON_LABELS } from "@/components/guest/homeIcons";

export default function IconPicker({ value, onChange, name }: { value: HomeIconKey; onChange: (k: HomeIconKey) => void; name: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = HOME_ICON_KEYS.indexOf(value);
  function move(to: number) {
    const n = (to + HOME_ICON_KEYS.length) % HOME_ICON_KEYS.length;
    onChange(HOME_ICON_KEYS[n]);
    refs.current[n]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={`Icon của ${name}`} className="grid grid-cols-5 gap-2"
      onKeyDown={e => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(idx + 1); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(idx - 1); }
      }}>
      {HOME_ICON_KEYS.map((k, i) => {
        const Icon = HOME_ICONS[k], on = k === value;
        return (
          <button key={k} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-label={HOME_ICON_LABELS[k]}
            tabIndex={on ? 0 : -1} data-icon={k} onClick={() => onChange(k)}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-14 min-w-11 px-1 py-1.5 rounded-[var(--kin-bo-md)] border text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] ${on ? "border-2 border-[var(--kin-nhan-link)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)]"}`}>
            <Icon size={20} aria-hidden="true" />
            <span className="text-[length:var(--kin-co-caption)] leading-tight text-center break-words max-w-full">{HOME_ICON_LABELS[k]}</span>
            {on && <span aria-hidden="true" className="absolute top-0.5 right-1 text-[length:var(--kin-co-caption)] text-[var(--kin-nhan-link)]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
