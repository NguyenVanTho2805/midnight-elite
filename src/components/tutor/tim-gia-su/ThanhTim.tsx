// BU-06 — ô tìm có gợi ý (combobox). Gõ dừng 250ms mới gọi /api/tutors/suggest, huỷ yêu cầu cũ bằng AbortController.
// Enter (không chọn dòng) = tìm theo từ khóa; chọn môn = lọc theo môn; chọn gia sư = mở hồ sơ. ↑↓ chọn dòng, Esc đóng.
"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { TutorSuggestion } from "./kieu";

export function ThanhTim({ initial, onSubmitText, onPickSubject }: {
  initial: string;
  onSubmitText: (q: string) => void;
  onPickSubject: (subject: string) => void;
}) {
  const router = useRouter();
  const uid = useId();
  const listId = `gs-goi-y-${uid}`;
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TutorSuggestion[]>([]);
  const [cur, setCur] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Khi URL đổi từ nơi khác (Xóa bộ lọc, Back) thì ô tìm theo kịp.
  useEffect(() => { Promise.resolve().then(() => setText(initial)); }, [initial]);

  useEffect(() => {
    const k = text.trim();
    if (k.length < 2) { Promise.resolve().then(() => { setItems([]); setCur(-1); }); return; }
    const ac = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/tutors/suggest?q=${encodeURIComponent(k.slice(0, 60))}`, { signal: ac.signal })
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then((d: { suggestions?: TutorSuggestion[] }) => { setItems((d.suggestions ?? []).slice(0, 8)); setCur(-1); })
        .catch(() => { /* gợi ý chỉ là phụ: lỗi thì không hiện hộp */ });
    }, 250);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [text]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  function pick(s: TutorSuggestion) {
    setOpen(false);
    if (s.kind === "subject") { setText(""); onPickSubject(s.value); }
    else router.push(`/mentor/${s.id}`);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setCur(c => Math.min(items.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur(c => Math.max(-1, c - 1)); }
    else if (e.key === "Escape") { setOpen(false); setCur(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (open && cur >= 0 && items[cur]) pick(items[cur]);
      else { setOpen(false); onSubmitText(text.trim()); }
    }
  }
  const show = open && items.length > 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <form role="search" onSubmit={e => { e.preventDefault(); setOpen(false); onSubmitText(text.trim()); }} className="flex gap-2">
        <input
          role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list" aria-label="Tìm gia sư theo tên hoặc môn"
          aria-activedescendant={show && cur >= 0 ? `${listId}-${cur}` : undefined}
          type="search" autoComplete="off" maxLength={60} placeholder="Tìm theo tên gia sư hoặc môn học"
          value={text} onChange={e => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          className="min-h-[var(--kin-cham-toi-thieu)] min-w-0 flex-1 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-4 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
        />
        <button type="submit" className="min-h-[var(--kin-cham-toi-thieu)] shrink-0 rounded-[var(--kin-bo-md)] border border-transparent bg-[var(--kin-nhan-nen)] px-5 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-chu-tren-nen)] hover:bg-[var(--kin-nhan-nen-re)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
          Tìm
        </button>
      </form>
      {show && (
        <ul id={listId} role="listbox" aria-label="Gợi ý"
          className="absolute left-0 right-0 top-full z-30 mt-1 m-0 list-none overflow-hidden rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-0">
          {items.map((s, i) => (
            <li key={s.kind === "tutor" ? `t-${s.id}` : `m-${s.value}`} id={`${listId}-${i}`} role="option" aria-selected={i === cur}
              onMouseDown={e => { e.preventDefault(); pick(s); }} onMouseEnter={() => setCur(i)}
              className="flex min-h-[var(--kin-cham-toi-thieu)] cursor-pointer items-center justify-between gap-3 px-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]"
              style={{ background: i === cur ? "var(--kin-nen-re-chuot)" : "transparent" }}>
              <span className="min-w-0 truncate">{s.label}</span>
              <span className="shrink-0 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{s.kind === "subject" ? `Môn · ${s.count} gia sư` : "Gia sư"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
