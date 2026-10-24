// Chọn học sinh ĐÃ CÓ (đã học một lớp khác của chính gia sư) để thêm vào lớp: dùng ở wizard tạo lớp (LO-03) và nút "Thêm học sinh" trong chi tiết lớp (LO-09).
// Chỉ liệt kê em của gia sư (GET /api/tutor/hoc-sinh). Em mới, chưa từng học với gia sư: vào lớp bằng mã mời — KiN không thu thêm dữ liệu trẻ ở bước này.
"use client";
import { useEffect, useMemo, useState } from "react";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { KIN_FIELD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { jfetch } from "@/components/tutor/studentUi";

interface Row { userId: string; name: string; courseId: string; courseName: string; status: "active" | "suspended" }

export default function StudentPicker({ excludeCourseId, selected, onChange, max }: { excludeCourseId?: string; selected: string[]; onChange: (ids: string[]) => void; max: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const load = () => { void jfetch("/api/tutor/hoc-sinh").then(r => { if (r.ok) { setRows(r.json.students as Row[]); setErr(false); } else setErr(true); }); };
  useEffect(load, []);

  const people = useMemo(() => {
    const inCourse = new Set((rows ?? []).filter(r => r.courseId === excludeCourseId).map(r => r.userId));
    const m = new Map<string, { userId: string; name: string; classes: string[] }>();
    for (const r of rows ?? []) {
      if (r.status !== "active" || inCourse.has(r.userId) || r.courseId === excludeCourseId) continue;
      const cur = m.get(r.userId) ?? { userId: r.userId, name: r.name, classes: [] };
      cur.classes.push(r.courseName); m.set(r.userId, cur);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [rows, excludeCourseId]);
  const needle = q.trim().toLowerCase();
  const shown = people.filter(p => !needle || p.name.toLowerCase().includes(needle));
  const sel = new Set(selected);
  const toggle = (id: string) => {
    if (sel.has(id)) onChange(selected.filter(x => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };

  if (err) return <ErrorStrip message="Không tải được danh sách học sinh của cô." onRetry={load} />;
  if (rows === null) return <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải danh sách học sinh…</p>;
  if (people.length === 0) {
    return (
      <KinEmptyState title="Chưa có em nào để thêm từ lớp khác">
        Danh sách này chỉ có em đã học một lớp khác của cô. Em mới thì cô gửi mã mời, em tự vào lớp.
      </KinEmptyState>
    );
  }
  return (
    <div>
      <label className="block">
        <span className="block mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tìm trong học sinh của cô</span>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nhập tên em…" className={KIN_FIELD} />
      </label>
      <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" aria-live="polite">Đã chọn {selected.length} em{selected.length >= max ? ` (tối đa ${max})` : ""}.</p>
      {shown.length === 0 ? <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Không có em nào khớp.</p> : (
        <ul className="mt-3 max-h-80 overflow-y-auto border border-[var(--kin-vien-nhat)] rounded-[var(--kin-bo-md)]" aria-label="Học sinh có thể thêm">
          {shown.map(p => (
            <li key={p.userId} data-picker-row className={`${KIN_TABLE_ROW} !p-0`}>
              <label className="flex items-center gap-3 min-h-11 px-[var(--kin-kc-6)] py-2 cursor-pointer">
                <input type="checkbox" checked={sel.has(p.userId)} onChange={() => toggle(p.userId)} disabled={!sel.has(p.userId) && selected.length >= max} className="size-5 shrink-0" />
                <span className="min-w-0"><span className="block text-[var(--kin-chu-chinh)] break-words">{p.name}</span><span className="block text-[var(--kin-chu-mo)] break-words">{p.classes.join(", ")}</span></span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
