// FE-163 → BU-05 — mục "Lớp của tôi" trong điều hướng trái: chọn giữa "chung" và từng lớp mình tham gia.
// 07/11: bỏ ô chọn thả xuống (chữ bị cắt "Tất cả (chung…", hộp thả hệ điều hành xấu) → danh sách nút chọn một (radiogroup), mỗi lựa chọn hiện đủ chữ.
// BU-05: không tự gọi API (CommunityFrame nạp một lần qua useScopeOptions rồi truyền xuống); khách hoặc người chưa có lớp → không vẽ gì.
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
  const items: { value: string; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "common", label: "Chỉ chung" },
    ...options.map(s => ({ value: s.id, label: `${s.role === "teacher" ? "Dạy · " : "Học · "}${s.name}` })),
  ];
  return (
    <div className="kc-nav-group" data-nav-scope>
      <span id="community-scope-label" className="kc-nav-group-label">Lớp của tôi</span>
      <div role="radiogroup" aria-labelledby="community-scope-label" id="community-scope" className="kc-nav-group-items">
        {items.map(it => (
          <button key={it.value} type="button" role="radio" aria-checked={scope === it.value} title={it.label}
            onClick={() => onChange(it.value)} className="kc-nav-item kc-focus kc-nav-scope-item">
            <span className="kc-nav-scope-text">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
