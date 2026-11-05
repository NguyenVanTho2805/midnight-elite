// BU-02-PHẲNG — "Thêm chương": hành động PHỤ (nhóm tuỳ chọn). Lớp không cần chương vẫn dùng bình thường; chương chỉ để gom mục lại cho gọn.
// Form nhỏ một ô tên, G6 do cha gọi. Lỗi ghi tại chỗ.
"use client";
import { useState } from "react";
import { KinButton } from "@/components/kin/Button";
import { KIN_FIELD } from "@/components/kin/PageLayout";

export default function ThemChuong({ busy, onSubmit, onClose }: { busy: boolean; onSubmit: (title: string) => Promise<boolean>; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form data-gt-them-chuong className="mb-5 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-4"
      onSubmit={async ev => {
        ev.preventDefault();
        if (!title.trim()) { setErr("Hãy đặt tên cho chương."); return; }
        setErr(null);
        if (await onSubmit(title)) { setTitle(""); onClose(); }
      }}>
      <label htmlFor="gt-ten-chuong" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tên chương</label>
      <p className="text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)]">Chương chỉ để gom các mục lại cho gọn, không bắt buộc. Mục chưa nhóm vẫn nằm ở đầu danh sách.</p>
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <input id="gt-ten-chuong" autoFocus className={KIN_FIELD} value={title} maxLength={120} placeholder="Ví dụ: Hàm số" onChange={e => { setTitle(e.target.value); setErr(null); }} />
        <KinButton type="submit" loading={busy} loadingLabel="Đang thêm…">Thêm chương</KinButton>
        <KinButton type="button" variant="ghost" onClick={onClose}>Bỏ</KinButton>
      </div>
      {err && <p role="alert" data-gt-loi className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
    </form>
  );
}
