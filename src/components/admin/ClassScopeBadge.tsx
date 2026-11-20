import { KinSelect } from "@/components/kin/KinSelect";
// FE-139 — nhãn lớp trên mục kiểm duyệt cộng đồng: bài/report thuộc lớp nào, hay "Cộng đồng chung".
// Chữ luôn đi kèm màu (không chỉ màu).
export default function ClassScopeBadge({ course }: { course: { id: string; name: string } | null | undefined }) {
  return course ? (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-chu-tren-nhat)" }} title={`Lớp: ${course.name}`}>Lớp: {course.name}</span>
  ) : (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--kin-nen-re-chuot)", color: "var(--kin-chu-phu)" }}>Cộng đồng chung</span>
  );
}

/** Lựa chọn phạm vi của bộ lọc: "all" = mọi nơi, "null" = chỉ cộng đồng chung, còn lại = id lớp. */
export type ClassScope = "all" | "null" | string;

export function ClassScopeSelect({ value, onChange, classes, id = "loc-lop" }: {
  value: ClassScope; onChange: (v: ClassScope) => void; classes: { id: string; name: string }[]; id?: string;
}) {
  return (
    <label className="text-xs font-semibold flex items-center gap-2" style={{ color: "var(--kin-chu-mo)" }} htmlFor={id}>
      Lớp
      <KinSelect id={id} className="w-64 max-w-full" aria-label="Lọc theo lớp" value={value} onChange={v => onChange(v)}>
        <option value="all">Tất cả (chung + mọi lớp)</option>
        <option value="null">Chỉ cộng đồng chung</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </KinSelect>
    </label>
  );
}
