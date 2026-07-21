"use client";

import { useState } from "react";
import { SUBJECT_GROUPS } from "@/lib/subjectTaxonomy";

// Select môn học + khả năng gõ môn hoàn toàn mới (subject là String tự do,
// không phải enum) — cùng cơ chế toggle select↔input như CategoryField ở
// src/app/(admin)/admin/thi-thu/page.tsx. Dùng chung ở form thêm/sửa câu hỏi
// ngân hàng, khối "Áp dụng cho tất cả câu" khi tạo đề, và Rút đề tự động —
// tách ra đây (thay vì để cục bộ 1 file) vì giờ đã cần y hệt ở 3 nơi.
//
// Luôn hiện 6 môn con thuộc 2 nhóm tổ hợp THPT (xem src/lib/subjectTaxonomy.ts)
// dưới dạng optgroup riêng, TRƯỚC danh sách môn đã dùng thật trong DB
// (`options`) — mục đích là hướng người soạn chọn môn con cụ thể (Lịch Sử,
// Địa Lý...) thay vì gõ chung "Xã hội"/"Tự nhiên" như trước, để Rút đề tự
// động rút cân đối được giữa các môn con.
export function SubjectField({ value, options, onChange, className }: {
  value: string; options: string[]; onChange: (v: string) => void; className: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");

  function commit() {
    if (newVal.trim()) onChange(newVal.trim());
    setAdding(false);
    setNewVal("");
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input autoFocus className={className} placeholder="Tên môn mới..."
          value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setAdding(false); setNewVal(""); } }} />
        <button type="button" onClick={commit}
          className="px-3 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0">Xong</button>
      </div>
    );
  }

  const curatedSubjects = new Set(SUBJECT_GROUPS.flatMap(g => g.subjects));
  const otherOptions = options.filter(o => !curatedSubjects.has(o));

  return (
    <select className={className} value={value}
      onChange={e => e.target.value === "__add__" ? setAdding(true) : onChange(e.target.value)}>
      <option value="">Chọn môn...</option>
      {SUBJECT_GROUPS.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </optgroup>
      ))}
      {otherOptions.length > 0 && (
        <optgroup label="Môn khác đã dùng">
          {otherOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </optgroup>
      )}
      {value && !options.includes(value) && !curatedSubjects.has(value) && <option value={value}>{value}</option>}
      <option value="__add__">+ Thêm môn mới…</option>
    </select>
  );
}
