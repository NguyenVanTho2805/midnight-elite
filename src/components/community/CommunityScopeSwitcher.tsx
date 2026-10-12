// FE-163 — CommunityScopeSwitcher: chuyển giữa "cộng đồng chung" và cộng đồng
// của từng lớp mình tham gia ở /cong-dong (FE-117). Tách khỏi trang để dùng lại
// ở nơi khác (vd. trang cộng đồng riêng của một lớp).
//
// Giá trị `scope`: "all" = chung + các lớp của tôi · "common" = chỉ cộng đồng
// chung · <courseId> = một lớp (phải là thành viên; API tự kiểm tra).
// Tự lấy danh sách lớp từ /api/community/scope-options; khách hoặc người chưa
// có lớp nào → không vẽ gì (không có lựa chọn thì khỏi thêm nhiễu).
"use client";
import { useEffect, useState } from "react";

export interface ScopeOption { id: string; name: string; role: "student" | "teacher" }

// Query string `courseId` tương ứng với một scope (không có dấu & đứng đầu).
export function scopeToQuery(scope: string): string {
  if (scope === "all") return "";
  if (scope === "common") return "courseId=null";
  return `courseId=${encodeURIComponent(scope)}`;
}

export default function CommunityScopeSwitcher({
  scope, onChange, signedIn,
}: {
  scope: string;
  onChange: (scope: string) => void;
  signedIn: boolean;
}) {
  const [options, setOptions] = useState<ScopeOption[]>([]);

  // Nhánh "chưa đăng nhập" cũng đi qua Promise để setState không chạy đồng bộ
  // trong thân effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    const p: Promise<{ scopes?: ScopeOption[] }> = signedIn
      ? fetch("/api/community/scope-options", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : { scopes: [] }))
      : Promise.resolve({ scopes: [] });
    p.then(d => { if (!cancelled) setOptions(d.scopes ?? []); })
     .catch(() => { /* lỗi mạng: chỉ ẩn bộ chọn */ });
    return () => { cancelled = true; };
  }, [signedIn]);

  if (!signedIn || options.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="community-scope" className="text-xs font-semibold" style={{ color: "#787671" }}>Phạm vi</label>
      <select
        id="community-scope"
        value={scope}
        onChange={e => onChange(e.target.value)}
        className="text-xs font-semibold px-3 py-1.5 rounded-full"
        style={{ background: "#f6f5f4", color: "#1a1a1a", border: "1px solid #e5e3df" }}
      >
        <option value="all">Tất cả (chung + của tôi)</option>
        <option value="common">Chỉ cộng đồng chung</option>
        {options.map(s => (
          <option key={s.id} value={s.id}>
            {s.role === "teacher" ? "👨‍🏫 " : "📘 "}{s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
