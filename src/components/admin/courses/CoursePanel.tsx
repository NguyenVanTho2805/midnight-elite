// CAT-02 — panel "Sửa nhanh" một khoá. KHÔNG có ô sửa giá: giá chỉ hiện một dòng chỉ đọc + liên kết sang trang khoá.
// Lưu = PUT /api/courses/[id] chỉ với các trường đã đổi trong {name, adminName, category, instructor, status, capacity, classStatus}
// (không bao giờ gửi price / originalPrice / lessons / hours). Xoá/Sao chép dùng API có sẵn; xoá xác nhận ngay trong panel.
"use client";
import { useState } from "react";
import Link from "next/link";
import { KinButton, KinStatus, KIN_FIELD, KIN_LABEL } from "@/components/kin";
import { SidePanel } from "@/components/admin/panel/SidePanel";
import { formatPrice } from "./CourseTable";
import type { CatalogRow } from "./CourseFilters";

export type CoursePatch = Partial<Pick<CatalogRow, "name" | "adminName" | "category" | "status" | "classStatus" | "capacity">> & { instructor?: string };

const CLASS_OPTS: { v: CatalogRow["classStatus"]; t: string }[] = [
  { v: "open", t: "Đang nhận" }, { v: "closed", t: "Đã đóng" }, { v: "paused", t: "Tạm ngừng" },
];

export function CoursePanel({ row, categories, isTeacher, hrefFor, onClose, onSaved, onRemoved, onDuplicated }: {
  row: CatalogRow;
  categories: string[];
  isTeacher: boolean;
  hrefFor: (adminPath: string) => string;
  onClose: () => void;
  onSaved: (id: string, patch: CoursePatch) => void;
  onRemoved: (id: string) => void;
  onDuplicated: () => void;
}) {
  // Panel được dựng lại (key = slug) khi đổi khoá, nên state khởi tạo từ row là đủ.
  const [name, setName] = useState(row.name);
  const [adminName, setAdminName] = useState(row.adminName);
  const [category, setCategory] = useState(row.category);
  const [instructor, setInstructor] = useState(row.tutor.name);
  const [status, setStatus] = useState(row.status);
  const [classStatus, setClassStatus] = useState(row.classStatus);
  const [unlimited, setUnlimited] = useState(row.capacity == null);
  const [capacity, setCapacity] = useState(row.capacity == null ? "" : String(row.capacity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState<"" | "dup" | "del">("");

  const catOptions = categories.includes(category) || !category ? categories : [category, ...categories];

  async function save() {
    setError("");
    const body: Record<string, unknown> = {};
    const patch: CoursePatch = {};
    if (name.trim() !== row.name) { body.name = name.trim(); patch.name = name.trim(); }
    if (adminName.trim() !== row.adminName) { body.adminName = adminName.trim(); patch.adminName = adminName.trim(); }
    if (category !== row.category) { body.category = category; patch.category = category; }
    if (instructor.trim() !== row.tutor.name) { body.instructor = instructor.trim(); patch.instructor = instructor.trim(); }
    if (status !== row.status) { body.status = status; patch.status = status; }
    if (classStatus !== row.classStatus) { body.classStatus = classStatus; patch.classStatus = classStatus; }
    let cap: number | null = null;
    if (!unlimited) {
      const n = Number(capacity);
      if (capacity.trim() === "" || !Number.isInteger(n) || n < 0) { setError("Sức chứa phải là số nguyên từ 0 trở lên, hoặc chọn “Không giới hạn”."); return; }
      cap = n;
    }
    if (cap !== row.capacity) { body.capacity = cap; patch.capacity = cap; }
    if (!name.trim()) { setError("Tên công khai không được để trống."); return; }
    if (Object.keys(body).length === 0) { onClose(); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/courses/${row.id}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError((data as { error?: string }).error || "Không lưu được. Thử lại nhé."); return; }
      onSaved(row.id, patch);
    } catch {
      setError("Mất kết nối, chưa lưu được. Kiểm tra mạng rồi thử lại.");
    } finally { setSaving(false); }
  }

  async function duplicate() {
    setBusy("dup"); setError("");
    try {
      const res = await fetch(`/api/courses/${row.id}/duplicate`, { method: "POST", credentials: "same-origin" });
      if (!res.ok) { setError("Sao chép thất bại. Thử lại nhé."); return; }
      onDuplicated();
    } catch { setError("Mất kết nối, chưa sao chép được."); } finally { setBusy(""); }
  }

  async function remove() {
    setBusy("del"); setError("");
    try {
      const res = await fetch(`/api/courses/${row.id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error || "Xoá không được. Thử lại nhé."); return; }
      onRemoved(row.id);
    } catch { setError("Mất kết nối, chưa xoá được."); } finally { setBusy(""); }
  }

  const created = row.createdAt ? new Date(row.createdAt).toLocaleDateString("vi-VN") : "";

  return (
    <SidePanel
      open
      onClose={onClose}
      title={row.name}
      subtitle={`${row.id}${created ? ` · tạo ngày ${created}` : ""}`}
      footer={
        <div className="flex gap-3">
          <KinButton variant="primary" loading={saving} loadingLabel="Đang lưu…" onClick={save}>Lưu</KinButton>
          <KinButton variant="secondary" disabled={saving} onClick={onClose}>Huỷ</KinButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div><label htmlFor="cp-name" className={`${KIN_LABEL} mb-2`}>Tên công khai</label>
          <input id="cp-name" className={KIN_FIELD} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label htmlFor="cp-admin" className={`${KIN_LABEL} mb-2`}>Tên nội bộ</label>
          <input id="cp-admin" className={KIN_FIELD} value={adminName} onChange={e => setAdminName(e.target.value)} /></div>
        <div><label htmlFor="cp-cat" className={`${KIN_LABEL} mb-2`}>Kỳ thi</label>
          <select id="cp-cat" className={`${KIN_FIELD} bg-[var(--kin-nen-trang)]`} value={category} onChange={e => setCategory(e.target.value)}>
            {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div><label htmlFor="cp-ins" className={`${KIN_LABEL} mb-2`}>Gia sư hiển thị</label>
          <input id="cp-ins" className={KIN_FIELD} value={instructor} onChange={e => setInstructor(e.target.value)} /></div>

        <div>
          <p className={`${KIN_LABEL} mb-2`}>Hiển thị trên website</p>
          <button type="button" role="switch" aria-checked={status} onClick={() => setStatus(s => !s)}
            className="inline-flex items-center gap-3 min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)]">
            <KinStatus tone={status ? "xong" : "mo"}>{status ? "Đang hiển thị trên website" : "Đang ẩn khỏi website"}</KinStatus>
            <span className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Bấm để đổi</span>
          </button>
          <p className="mt-2 text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)]">Ẩn khoá chỉ gỡ khỏi trang công khai; học viên đã ghi danh vẫn học bình thường.</p>
        </div>

        <fieldset>
          <legend className={`${KIN_LABEL} mb-2`}>Trạng thái lớp</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Trạng thái lớp">
            {CLASS_OPTS.map(o => (
              <button key={o.v} type="button" role="radio" aria-checked={classStatus === o.v} onClick={() => setClassStatus(o.v)}
                className={`min-h-11 px-4 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] ${classStatus === o.v ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]"}`}>
                {o.t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)]">“Đã đóng” chỉ ngừng nhận học viên mới, không ẩn khoá.</p>
        </fieldset>

        <div>
          <label htmlFor="cp-cap" className={`${KIN_LABEL} mb-2`}>Sức chứa <span className="text-[var(--kin-chu-mo)]">(đang có {row.enrolled} học viên)</span></label>
          <div className="flex items-center gap-3 flex-wrap">
            <input id="cp-cap" inputMode="numeric" className={`${KIN_FIELD} w-32`} value={unlimited ? "" : capacity} disabled={unlimited}
              onChange={e => setCapacity(e.target.value.replace(/[^\d]/g, ""))} />
            <label className="inline-flex items-center gap-2 min-h-11 cursor-pointer text-[length:var(--kin-co-goc)]">
              <input type="checkbox" className="w-5 h-5 accent-[var(--kin-nhan-nen)]" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} />
              Không giới hạn
            </label>
          </div>
        </div>

        <p data-course-price className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">
          Giá: <b className="tabular-nums text-[var(--kin-chu-chinh)]">{formatPrice(row.price)}</b> —{" "}
          <Link href={hrefFor(`/admin/khoa-hoc/${row.id}`)} className="text-[var(--kin-nhan-link)] underline">đổi ở trang khoá học →</Link>
        </p>

        {error && <p role="alert" data-panel-error className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-tt-chu-loi)]">{error}</p>}

        <div className="pt-4 border-t border-[var(--kin-vien-nhat)] flex flex-col gap-1">
          <Link href={hrefFor(`/admin/khoa-hoc/${row.id}`)} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] hover:underline">Mở trang quản khoá</Link>
          {isTeacher && <Link href={`/lop-cua-toi/${row.id}`} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] hover:underline">Mở lớp (mã mời, học viên)</Link>}
          <button type="button" onClick={duplicate} disabled={busy !== ""} className="inline-flex items-center min-h-11 text-left text-[var(--kin-nhan-link)] hover:underline disabled:opacity-50">
            {busy === "dup" ? "Đang sao chép…" : "Sao chép khoá"}
          </button>
          {confirmDel ? (
            <div data-del-confirm className="mt-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-4 flex flex-col gap-3">
              <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-tt-chu-loi)]">Xoá vĩnh viễn khoá này cùng toàn bộ chương, bài học và tài liệu? Không hoàn tác được.</p>
              <div className="flex gap-3 flex-wrap">
                <KinButton variant="danger-solid" loading={busy === "del"} loadingLabel="Đang xoá…" onClick={remove}>Xoá vĩnh viễn khoá và toàn bộ bài học</KinButton>
                <KinButton variant="secondary" disabled={busy === "del"} onClick={() => setConfirmDel(false)}>Giữ lại</KinButton>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className="inline-flex items-center min-h-11 text-left text-[var(--kin-tt-chu-loi)] hover:underline">Xoá khoá học</button>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
