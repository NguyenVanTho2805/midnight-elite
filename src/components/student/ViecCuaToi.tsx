// "Việc của tôi" của học sinh (Figma "Vỏ — Học sinh" 11:98): danh sách bên trái, khung đọc bên phải (điện thoại: chọn một dòng thì
// hiện khung đọc, có nút ← quay lại). Dữ liệu từ /api/student/viec-cua-toi (bài tập + hạn nộp ngoài + buổi học sắp tới).
// Lỗi tải: giữ danh sách cũ, hiện dải báo lỗi có nút thử lại. Đang tải lần đầu: khung xương, không vòng xoay.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentTodoItem } from "@/lib/studentTodo";
import {
  ErrorStrip, ListBody, ListHead, ListRow, ListSkeleton, OutlookPanes, ReadBody, ReadEmpty, ReadHead, ReadSection,
} from "@/components/kin/shell/Outlook";

const GROUPS: { key: "can-lam" | "sap-toi" | "da-xong"; label: string }[] = [
  { key: "can-lam", label: "Cần làm" },
  { key: "sap-toi", label: "Sắp tới" },
  { key: "da-xong", label: "Đã xong" },
];
const groupOf = (i: StudentTodoItem) => (i.needsAction ? "can-lam" : i.done ? "da-xong" : "sap-toi");

export default function ViecCuaToi() {
  const [items, setItems] = useState<StudentTodoItem[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readOpen, setReadOpen] = useState(false);
  const focusRow = useRef<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/student/viec-cua-toi", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setItems(Array.isArray(d.items) ? d.items : []); setError(false); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const list = items ?? [];
  // Dòng đang chọn: giữ nguyên nếu còn trong danh sách mới, không thì rơi về dòng đầu.
  const current = list.find(i => i.id === selectedId) ?? list[0] ?? null;

  useEffect(() => {
    if (!focusRow.current) return;
    const el = document.getElementById(`viec-${focusRow.current}`);
    focusRow.current = null;
    el?.focus();
  }, [current?.id]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    if (list.length === 0) return;
    e.preventDefault();
    const at = Math.max(0, list.findIndex(i => i.id === current?.id));
    const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
    focusRow.current = list[next].id;
    setSelectedId(list[next].id);
  };

  const select = (id: string) => { setSelectedId(id); setReadOpen(true); };

  const listPane = (
    <>
      <ListHead title="Việc của tôi" subtitle="Bài phải nộp và buổi sắp tới" />
      {error && <ErrorStrip message="Không tải được danh sách." onRetry={load} />}
      {items === null && !error ? (
        <ListSkeleton rows={5} />
      ) : (
        <ListBody label="Việc của tôi" onKeyDown={onKeyDown}>
          {list.length === 0 && items !== null && (
            <p className="px-[14px] py-6 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Chưa có việc nào cần làm.</p>
          )}
          {GROUPS.map(g => {
            const rows = list.filter(i => groupOf(i) === g.key);
            if (rows.length === 0) return null;
            return (
              <div key={g.key} role="group" aria-label={g.label}>
                <p aria-hidden className="px-[14px] pt-3 pb-1 text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.09em] text-[var(--kin-chu-mo)]">{g.label}</p>
                {rows.map(i => (
                  <ListRow
                    key={i.id}
                    id={`viec-${i.id}`}
                    selected={current?.id === i.id}
                    onSelect={() => select(i.id)}
                    title={i.title}
                    when={i.when}
                    subtitle={i.subtitle}
                    status={i.status}
                    strong={i.needsAction}
                  />
                ))}
              </div>
            );
          })}
        </ListBody>
      )}
    </>
  );

  const readPane = current ? (
    <>
      <ReadHead title={current.detail.heading} meta={current.detail.meta} commands={current.detail.commands} onBack={() => setReadOpen(false)} />
      <ReadBody>
        {current.detail.sections.map(s => <ReadSection key={s.title} title={s.title} text={s.text} />)}
      </ReadBody>
    </>
  ) : (
    <ReadEmpty
      title={items === null ? "Đang tải…" : "Bạn đã xong hết"}
      text={items === null ? undefined : "Bài tập mới, hạn nộp và buổi học sắp tới sẽ hiện ở đây."}
    />
  );

  return <OutlookPanes list={listPane} read={readPane} open={readOpen && !!current} />;
}
