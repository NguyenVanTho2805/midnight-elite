"use client";

import { useState } from "react";
import { api, type QuestionCategoryFull } from "@/lib/api";

// Chọn 1 đầu mục trong cây phân cấp KHÔNG giới hạn số tầng (vd Môn → Chương →
// Bài → Dạng bài) — thay cho SubjectField (môn, phẳng) + ô "Chủ đề" tự do cũ.
// Mỗi tầng là 1 dropdown hiện các con của tầng trước; chọn xong tầng nào thì
// tầng đó TRỞ THÀNH categoryId hiện tại (không bắt buộc đi tới lá — 1 câu hỏi
// có thể gắn vào bất kỳ đầu mục nào, "to" hay "bé"), đồng thời luôn hiện thêm
// 1 dropdown rỗng phía sau để đi sâu hơn nếu muốn. "+ Thêm đầu mục" ở mỗi
// tầng dùng cùng cơ chế toggle select↔input như SubjectField/CategoryField cũ.
export function CategoryPicker({ value, categories, onCategoriesChange, onChange, className }: {
  value: string;
  categories: QuestionCategoryFull[];
  onCategoriesChange: () => void | Promise<void>;
  onChange: (categoryId: string) => void;
  className: string;
}) {
  const [addingAt, setAddingAt] = useState<string | null>(null); // parentId đang thêm con, null = không thêm gì
  const [newName, setNewName] = useState("");

  const byId = new Map(categories.map(c => [c.id, c]));
  const byParent = new Map<string | null, QuestionCategoryFull[]>();
  for (const c of categories) {
    const key = c.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  // Chuỗi id từ gốc tới `value`
  const chain: string[] = [];
  {
    let cur = value ? byId.get(value) : undefined;
    while (cur) {
      chain.unshift(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }

  async function handleCreate(parentId: string | null) {
    if (!newName.trim()) return;
    const created = await api.questionCategories.create({ name: newName.trim(), parentId });
    await onCategoriesChange();
    onChange(created.id);
    setAddingAt(null);
    setNewName("");
  }

  const rows: { parentId: string | null; selected: string }[] = [];
  for (let i = 0; i <= chain.length; i++) {
    rows.push({ parentId: i === 0 ? null : chain[i - 1], selected: chain[i] ?? "" });
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => {
        const options = byParent.get(row.parentId) ?? [];
        if (options.length === 0 && addingAt !== row.parentId) {
          return (
            <button key={i} type="button" onClick={() => setAddingAt(row.parentId)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              + Thêm đầu mục {i === 0 ? "gốc" : "con"}
            </button>
          );
        }
        if (addingAt === row.parentId) {
          return (
            <div key={i} className="flex gap-2">
              <input autoFocus className={className} placeholder="Tên đầu mục mới..."
                value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreate(row.parentId);
                  if (e.key === "Escape") { setAddingAt(null); setNewName(""); }
                }} />
              <button type="button" onClick={() => handleCreate(row.parentId)}
                className="px-3 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0">Xong</button>
              <button type="button" onClick={() => { setAddingAt(null); setNewName(""); }}
                className="px-2 text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">Huỷ</button>
            </div>
          );
        }
        return (
          <div key={i} className="flex gap-2">
            <select className={className} value={row.selected}
              onChange={e => e.target.value === "__add__" ? setAddingAt(row.parentId) : onChange(e.target.value)}>
              <option value="">{i === 0 ? "Chọn đầu mục..." : "-- Không chọn thêm --"}</option>
              {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="__add__">+ Thêm đầu mục {i === 0 ? "gốc" : "con"} mới…</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}

// Đường dẫn hiển thị "Toán / Đại số / Hàm số" cho 1 categoryId — dùng ở nơi
// chỉ có id (vd hiển thị câu trùng lặp gợi ý từ check-duplicate).
export function categoryPath(categoryId: string, categories: QuestionCategoryFull[]): string {
  const byId = new Map(categories.map(c => [c.id, c]));
  const parts: string[] = [];
  let cur = byId.get(categoryId);
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(" / ") || "?";
}
