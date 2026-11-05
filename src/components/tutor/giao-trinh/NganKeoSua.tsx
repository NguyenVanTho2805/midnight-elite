// BU-02-PHẲNG — ngăn kéo "Sửa" một mục. 1280: bảng bên phải 400px (nền mờ phía sau); 390: tờ toàn màn hình, nút Lưu / Đóng dính đáy.
// Sửa: tên, thời lượng, "Khoá bài", "Cho học thử miễn phí" (chỉ có tác dụng khi mục Đã đăng), nhóm; xem/gỡ từng nội dung; Xem như học sinh, Nhân bản, Xoá.
// Một nút Lưu gom thay đổi (tên/thời lượng/khoá/miễn phí → PUT /api/lessons/[id]; nhóm → G4). Trạng thái (Đăng/Ẩn) KHÔNG đổi ở đây: dùng nút trên hàng, để luật chuyển trạng thái không bị đi vòng.
// Đóng bằng nút Đóng, Esc hoặc bấm nền. Tiêu điểm vào ô Tên khi mở, trả về nút Sửa của hàng khi đóng.
"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KIN_FIELD } from "@/components/kin/PageLayout";
import { formatDeadlineVn } from "@/components/media/StudentLessonPanels";
import { contentHref, giaoTrinhHref } from "@/lib/tutorRoutes";
import type { GtEntry, GtGroup, GtItem } from "@/lib/giaoTrinh";
import { ChipKieu, ChipTrangThai } from "./ChipTrangThai";
import { NoiDungKem } from "./MucHang";

export interface SuaThayDoi { title: string; duration: string | null; isLocked: boolean; isFree: boolean; groupId: string | null }

export interface NganKeoSuaProps {
  entry: GtEntry; courseId: string; groups: GtGroup[];
  busy: boolean; error: string | null;
  onSave: (change: SuaThayDoi) => Promise<boolean>;
  onClose: () => void;
  onRemoveItem: (it: GtItem) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function NganKeoSua({ entry, courseId, groups, busy, error, onSave, onClose, onRemoveItem, onDuplicate, onDelete }: NganKeoSuaProps) {
  const uid = useId();
  const [title, setTitle] = useState(entry.title);
  const [duration, setDuration] = useState(entry.duration ?? "");
  const [isLocked, setLocked] = useState(entry.isLocked);
  const [isFree, setFree] = useState(entry.isFree);
  const [groupId, setGroupId] = useState<string>(entry.groupId ?? "");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const deadline = formatDeadlineVn(entry.azotaDeadline);
  const dirty = title.trim() !== entry.title || (duration.trim() || null) !== (entry.duration ?? null) || isLocked !== entry.isLocked || isFree !== entry.isFree || (groupId || null) !== (entry.groupId ?? null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim()) { setLocalErr("Tên mục không được để trống."); return; }
    setLocalErr(null);
    await onSave({ title: title.trim(), duration: duration.trim() || null, isLocked, isFree, groupId: groupId || null });
  }

  const err = localErr ?? error;
  return (
    <div className="fixed inset-0 z-[150] flex justify-end bg-[var(--kin-phu-hop)]" data-gt-ngan-keo-nen onMouseDown={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby={`${uid}-tieu-de`} data-gt-ngan-keo
        className="flex flex-col w-full lg:w-[400px] h-full bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-hop)]">
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 space-y-5">
          <div>
            <h2 id={`${uid}-tieu-de`} className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Sửa mục</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2"><ChipKieu kind={entry.kind} /><ChipTrangThai status={entry.status} /></div>
          </div>

          <div>
            <label htmlFor={`${uid}-ten`} className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tên mục</label>
            <input id={`${uid}-ten`} ref={titleRef} className={`${KIN_FIELD} mt-2`} value={title} maxLength={200} onChange={e => { setTitle(e.target.value); setLocalErr(null); }} />
          </div>
          <div>
            <label htmlFor={`${uid}-tl`} className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Thời lượng</label>
            <input id={`${uid}-tl`} className={`${KIN_FIELD} mt-2`} value={duration} maxLength={40} placeholder="Ví dụ: 45 phút" onChange={e => setDuration(e.target.value)} />
          </div>
          {deadline && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Hạn Azota: <b className="font-medium">{deadline.text}</b>{deadline.overdue ? " (đã quá hạn)" : ""}</p>}

          {groups.length > 0 && (
            <div>
              <label htmlFor={`${uid}-nhom`} className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Nhóm</label>
              <select id={`${uid}-nhom`} className={`${KIN_FIELD} mt-2`} value={groupId} onChange={e => setGroupId(e.target.value)}>
                <option value="">Chưa nhóm</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-5 h-5 flex-shrink-0" checked={isLocked} onChange={e => setLocked(e.target.checked)} />
              <span>Khoá bài này<span className="block text-[var(--kin-chu-mo)]">Học sinh chưa mở được cho tới khi bạn mở khoá. Chỉ có tác dụng khi mục Đã đăng.</span></span>
            </label>
            <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-5 h-5 flex-shrink-0" checked={isFree} onChange={e => setFree(e.target.checked)} />
              <span>Cho học thử miễn phí<span className="block text-[var(--kin-chu-mo)]">Người chưa vào lớp xem được mục này (cần đăng nhập để mở tệp). Chỉ có tác dụng khi mục Đã đăng.</span></span>
            </label>
          </div>

          <section aria-labelledby={`${uid}-nd`}>
            <h3 id={`${uid}-nd`} className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Nội dung kèm theo · {entry.items.length}</h3>
            <div className="mt-2">
              {entry.items.length ? <NoiDungKem items={entry.items} entryTitle={entry.title} busy={busy} onRemove={onRemoveItem} />
                : <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Mục chưa có nội dung. Dán link hoặc thả tệp vào ô ở đầu trang, chọn “Gắn vào mục có sẵn”.</p>}
            </div>
            <div className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
              <p>Bài tập tự nộp: {entry.selfSubmitCount}</p>
              <Link href={contentHref(true, `/admin/khoa-hoc/${courseId}?tab=chuong-bai`)} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Soạn bài tập ở tab Chương bài</Link>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <Link href={`${giaoTrinhHref(courseId, true)}/xem/${entry.id}`} className={kinButtonClass("secondary")}>Xem như học sinh</Link>
            <KinButton type="button" variant="secondary" disabled={busy} onClick={onDuplicate}>Nhân bản</KinButton>
            <KinButton type="button" variant="danger" disabled={busy} onClick={onDelete}>Xoá mục</KinButton>
          </div>

          {err && <p role="alert" data-gt-loi-ngan-keo className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
        </div>

        <div className="sticky bottom-0 flex gap-2 px-5 py-3 border-t border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
          <KinButton type="button" className="flex-1" loading={busy} loadingLabel="Đang lưu…" disabled={!dirty} onClick={() => void save()}>Lưu</KinButton>
          <KinButton type="button" variant="secondary" className="flex-1" onClick={onClose}>Đóng</KinButton>
        </div>
      </aside>
    </div>
  );
}
