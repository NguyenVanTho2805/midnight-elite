// FE-163 → BU-05 — mục "Lớp của tôi" trong điều hướng trái: một ô chọn (id="community-scope") giữa "chung" và từng lớp mình tham gia.
// BU-05: không tự gọi API nữa (CommunityFrame nạp một lần qua useScopeOptions rồi truyền xuống); khách hoặc người chưa có lớp → không vẽ gì.
//
// Giá trị `scope`: "all" = chung + các lớp của tôi · "common" = chỉ cộng đồng chung · <courseId> = một lớp (API tự kiểm thành viên).
"use client";
import type { ScopeOption } from "./useScopeOptions";

export type { ScopeOption } from "./useScopeOptions";

export default function CommunityScopeSwitcher({ scope, options, onChange }: {
  scope: string;
  options: ScopeOption[];
  onChange: (scope: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-none" data-nav-scope>
      <label htmlFor="community-scope" className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-phu)] whitespace-nowrap">Lớp của tôi</label>
      <select
        id="community-scope"
        value={scope}
        onChange={e => onChange(e.target.value)}
        className="kc-nav-select kc-focus rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]"
      >
        <option value="all">Tất cả (chung + của tôi)</option>
        <option value="common">Chỉ cộng đồng chung</option>
        {options.map(s => (
          <option key={s.id} value={s.id}>{s.role === "teacher" ? "Lớp dạy · " : "Lớp học · "}{s.name}</option>
        ))}
      </select>
    </div>
  );
}
