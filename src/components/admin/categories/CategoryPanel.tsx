// CAT-02 — panel bên của danh mục: thêm mới, đổi tên, Lên/Xuống, 5 khoá đầu, xoá (tắt khi còn khoá, kèm lý do bằng chữ).
// Tên đổi sẽ cập nhật khoá của MỌI gia sư (làm ở máy chủ); đổi sang tên đã có → 409, hiện ngay dưới ô.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { KinButton, KIN_FIELD, KIN_LABEL } from "@/components/kin";
import { SidePanel } from "@/components/admin/panel/SidePanel";
import type { CategoryRow } from "./CategoryList";

export type PanelMode = { type: "add" } | { type: "edit"; id: string };

interface MiniCourse { id: string; name: string; category: string }

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export function CategoryPanel({ mode, row, index, count, hrefFor, onClose, onCreated, onRenamed, onDeleted, onMove }: {
  mode: PanelMode;
  row: CategoryRow | null;
  index: number;
  count: number;
  hrefFor: (adminPath: string) => string;
  onClose: () => void;
  onCreated: (c: CategoryRow) => void;
  onRenamed: (id: string, name: string, slug: string) => void;
  onDeleted: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const isAdd = mode.type === "add";
  const [name, setName] = useState(row?.name ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<MiniCourse[] | null>(null);

  const catName = row?.name;
  useEffect(() => {
    if (!catName) return;
    let live = true;
    fetch("/api/admin/khoa-hoc", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : { rows: [] }))
      .then(d => { if (live) setPreview(((d.rows ?? []) as MiniCourse[]).filter(c => c.category === catName)); })
      .catch(() => { if (live) setPreview([]); });
    return () => { live = false; };
  }, [catName]);

  async function save() {
    const v = name.trim();
    setError("");
    if (!v) { setError("Tên danh mục không được để trống."); return; }
    if (v.length > 60) { setError("Tên danh mục tối đa 60 ký tự."); return; }
    if (!isAdd && row && v === row.name) { onClose(); return; }
    setSaving(true);
    try {
      const r = isAdd ? await call("/api/admin/danh-muc", "POST", { name: v }) : await call(`/api/admin/danh-muc/${row!.id}`, "PUT", { name: v });
      if (!r.ok) {
        setError(r.status === 409 ? "Đã có danh mục tên này." : (r.data.error as string) || "Không lưu được. Thử lại nhé.");
        return;
      }
      const c = r.data.category as { id: string; name: string; slug: string } | undefined;
      if (isAdd && c) onCreated({ id: c.id, name: c.name, slug: c.slug, total: 0, shown: 0, hidden: 0 });
      else if (!isAdd && row) onRenamed(row.id, c?.name ?? v, c?.slug ?? row.slug);
    } catch { setError("Mất kết nối, chưa lưu được."); } finally { setSaving(false); }
  }

  async function remove() {
    if (!row) return;
    setDeleting(true); setError("");
    try {
      const r = await call(`/api/admin/danh-muc/${row.id}`, "DELETE");
      if (!r.ok) { setError((r.data.error as string) || "Không xoá được."); return; }
      onDeleted(row.id);
    } catch { setError("Mất kết nối, chưa xoá được."); } finally { setDeleting(false); }
  }

  const hasCourses = (row?.total ?? 0) > 0;

  return (
    <SidePanel
      open onClose={onClose}
      title={isAdd ? "Thêm danh mục" : row?.name ?? "Danh mục"}
      subtitle={isAdd ? "Danh mục mới nằm cuối danh sách; kéo hoặc dùng Lên/Xuống để đặt vị trí." : `${row?.slug ?? ""}`}
      footer={
        <div className="flex gap-3">
          <KinButton loading={saving} loadingLabel="Đang lưu…" onClick={save}>{isAdd ? "Thêm danh mục" : "Lưu tên"}</KinButton>
          <KinButton variant="secondary" disabled={saving} onClick={onClose}>Huỷ</KinButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="cat-name" className={`${KIN_LABEL} mb-2`}>Tên danh mục</label>
          <input id="cat-name" className={KIN_FIELD} value={name} maxLength={60} autoFocus={isAdd}
            aria-invalid={error ? true : undefined} aria-describedby={error ? "cat-err" : undefined}
            onChange={e => { setName(e.target.value); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
          {error && <p id="cat-err" role="alert" data-panel-error className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>}
          {!isAdd && <p className="mt-2 text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)]">Đổi tên sẽ cập nhật khoá học của tất cả gia sư. Mã đường dẫn ({row?.slug}) tự tạo từ tên, không sửa tay.</p>}
        </div>

        {!isAdd && row && (
          <>
            <div>
              <p className={`${KIN_LABEL} mb-2`}>Vị trí <span className="text-[var(--kin-chu-mo)]">({index + 1}/{count}; trang công khai theo thứ tự này)</span></p>
              <div className="flex gap-3">
                <KinButton variant="secondary" disabled={index <= 0} onClick={() => onMove(row.id, -1)}>Lên</KinButton>
                <KinButton variant="secondary" disabled={index >= count - 1} onClick={() => onMove(row.id, 1)}>Xuống</KinButton>
              </div>
            </div>

            <div>
              <p className={`${KIN_LABEL} mb-2`}>{row.total} khoá · {row.shown} hiển thị · {row.hidden} ẩn</p>
              {preview === null ? (
                <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải danh sách khoá…</p>
              ) : preview.length === 0 ? (
                <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa có khoá nào dùng danh mục này.</p>
              ) : (
                <ul className="flex flex-col">
                  {preview.slice(0, 5).map(c => (
                    <li key={c.id}><Link href={hrefFor(`/admin/khoa-hoc/${c.id}`)} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] hover:underline break-words">{c.name}</Link></li>
                  ))}
                </ul>
              )}
              {row.total > 0 && (
                <Link href={hrefFor(`/admin/khoa-hoc?kythi=${encodeURIComponent(row.name)}`)} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Xem tất cả {row.total} khoá →</Link>
              )}
            </div>

            <div className="pt-4 border-t border-[var(--kin-vien-nhat)]">
              {hasCourses ? (
                <div data-delete-blocked>
                  <KinButton variant="danger" disabled>Xoá danh mục</KinButton>
                  <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">
                    Còn {row.total} khoá — chuyển sang danh mục khác trước (chọn các khoá rồi “Đổi kỳ thi”).{" "}
                    <Link href={hrefFor(`/admin/khoa-hoc?kythi=${encodeURIComponent(row.name)}`)} className="text-[var(--kin-nhan-link)] underline">Mở danh sách đã lọc</Link>
                  </p>
                </div>
              ) : confirmDel ? (
                <div data-del-confirm className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-4 flex flex-col gap-3">
                  <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-tt-chu-loi)]">Xoá danh mục “{row.name}”? Danh mục này không còn khoá nào.</p>
                  <div className="flex gap-3 flex-wrap">
                    <KinButton variant="danger-solid" loading={deleting} loadingLabel="Đang xoá…" onClick={remove}>Xoá danh mục</KinButton>
                    <KinButton variant="secondary" disabled={deleting} onClick={() => setConfirmDel(false)}>Giữ lại</KinButton>
                  </div>
                </div>
              ) : (
                <KinButton variant="danger" onClick={() => setConfirmDel(true)}>Xoá danh mục</KinButton>
              )}
            </div>
          </>
        )}
      </div>
    </SidePanel>
  );
}
