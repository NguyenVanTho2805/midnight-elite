// "Việc của tôi" của học sinh (Figma "Vỏ — Học sinh" 11:98): danh sách bên trái, khung đọc bên phải (điện thoại: chọn một dòng thì
// hiện khung đọc, có nút ← quay lại). Dữ liệu từ /api/student/viec-cua-toi (bài tập + hạn nộp ngoài + buổi học sắp tới).
// Lỗi tải: giữ danh sách cũ, hiện dải báo lỗi có nút thử lại. Đang tải lần đầu: khung xương, không vòng xoay.
// 15/10/2026 — chuyển động lấy từ Lucian UX/UI Prompt (MIT; docs/kin/thu-vien-lucian.md): vòng tiến độ "x/y việc đã xong" ở đầu danh sách (No.014), việc vừa xong bị
// gạch ngang từ trái sang (No.014), xong hết việc cần làm thì vòng đổi màu xong + sóng lan + dòng phụ đổi chữ (No.093), dòng hiện ra theo thứ tự (No.079).
// Việc ở đây do hệ thống sinh ra (bài phải nộp, hạn nộp) nên học viên KHÔNG tự tích; chuyển động chạy khi một việc chuyển sang "đã xong" lúc danh sách làm mới
// (vd. nộp bài xong rồi quay lại tab này). Buổi học đã qua chỉ để biết, không gạch.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentTodoItem } from "@/lib/studentTodo";
import {
  ErrorStrip, ListBody, ListHead, ListRow, ListSkeleton, OutlookPanes, ReadBody, ReadEmpty, ReadHead, ReadSection,
} from "@/components/kin/shell/Outlook";
import { KinProgressRing } from "@/components/kin/ProgressRing";
import { KinSwapText } from "@/components/kin/SwapText";

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
  // Việc đã xong ở lần tải trước: dòng nào lần này mới xong thì gạch ngang chạy hoạt hình (lần tải đầu: không có dòng "vừa xong").
  const known = useRef<Map<string, boolean> | null>(null);
  const [justDone, setJustDone] = useState<Set<string>>(() => new Set());

  const load = useCallback(() => {
    fetch("/api/student/viec-cua-toi", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => {
        const next: StudentTodoItem[] = Array.isArray(d.items) ? d.items : [];
        const prev = known.current;
        known.current = new Map(next.map(i => [i.id, i.done]));
        setJustDone(prev ? new Set(next.filter(i => i.done && prev.get(i.id) === false).map(i => i.id)) : new Set());
        setItems(next);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const list = items ?? [];
  // Tiến độ chỉ đếm VIỆC (bài tập, hạn nộp): cần làm + đã xong. Buổi học sắp tới / đã qua chỉ để biết nên không tính.
  const needs = list.filter(i => i.needsAction).length;
  const doneTasks = list.filter(i => i.done && i.kind !== "buoi-hoc").length;
  const total = needs + doneTasks;
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
      <ListHead
        title="Việc của tôi"
        subtitle={<KinSwapText alt={total > 0 && needs === 0} a="Bài phải nộp và buổi sắp tới" b="Đã xong hết việc cần làm" />}
        aside={items !== null && total > 0 ? <KinProgressRing done={doneTasks} total={total} label="Việc đã xong" /> : undefined}
      />
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
                    strike={i.kind !== "buoi-hoc" && i.done ? (justDone.has(i.id) ? "draw" : "static") : undefined}
                    bloom={list.indexOf(i)}
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
