// FE-139 — nhãn lớp trên mục kiểm duyệt cộng đồng: bài/report thuộc lớp nào, hay "Cộng đồng chung".
// Chữ luôn đi kèm màu (không chỉ màu).
export default function ClassScopeBadge({ course }: { course: { id: string; name: string } | null | undefined }) {
  return course ? (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#e0e7ff", color: "#3730a3" }} title={`Lớp: ${course.name}`}>Lớp: {course.name}</span>
  ) : (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f1f5f9", color: "#475569" }}>Cộng đồng chung</span>
  );
}

/** Lựa chọn phạm vi của bộ lọc: "all" = mọi nơi, "null" = chỉ cộng đồng chung, còn lại = id lớp. */
export type ClassScope = "all" | "null" | string;

export function ClassScopeSelect({ value, onChange, classes, id = "loc-lop" }: {
  value: ClassScope; onChange: (v: ClassScope) => void; classes: { id: string; name: string }[]; id?: string;
}) {
  return (
    <label className="text-xs font-semibold flex items-center gap-2" style={{ color: "#64748B" }} htmlFor={id}>
      Lớp
      <select id={id} aria-label="Lọc theo lớp" value={value} onChange={e => onChange(e.target.value)} className="px-3 py-2 rounded-xl text-sm min-h-[44px]"
        style={{ background: "rgba(255,255,255,0.8)", border: "1px solid #C5D0EA", color: "#1E2938" }}>
        <option value="all">Tất cả (chung + mọi lớp)</option>
        <option value="null">Chỉ cộng đồng chung</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
