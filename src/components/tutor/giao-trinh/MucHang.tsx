// BU-02-PHẲNG — MỘT HÀNG của danh sách phẳng (một mục = một Lesson). Khung 607:218 / 607:491 chưa đọc được trực tiếp: dựng theo mục 5.2 của đặc tả.
// 1280: [▲][▼] · chip kiểu + TÊN (+ dòng nguồn) · chip trạng thái · Sửa · nút chính theo trạng thái (Đăng / Ẩn / Hiện lại) · ⋯
// 390: xếp dọc — dòng 1 tên + chip, dòng 2 kiểu · nguồn, dòng 3 hàng nút (▲ ▼ 44×44, Sửa, nút chính, ⋯). Mọi nút cao >= 44px.
// Mục nhiều nội dung (bài cũ) hiện MỘT hàng, "n nội dung kèm" mở rộng ra thấy từng nội dung. Lỗi ghi hiện ngay dưới hàng (role=alert), không ở đâu xa.
"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";
import { viewerHref } from "@/lib/library";
import { baiHocHref } from "@/lib/tutorRoutes";
import type { GtEntry, GtGroup, GtItem } from "@/lib/giaoTrinh";
import type { LessonStatus } from "@/lib/lessonStatus";
import { ChipKieu, ChipTrangThai, KIND_LABEL } from "./ChipTrangThai";
import { KinSelect } from "@/components/kin/KinSelect";

const STORAGE_LABEL: Record<GtItem["storage"], string> = { link: "Link ngoài", kin: "Tệp trên KiN (riêng tư)", cloudinary_cu: "Tệp cũ (công khai)" };

/** Nguồn của một nội dung: nhãn + nơi lưu, không lặp chữ "KiN". */
export function sourceOf(it: GtItem): string {
  const parts = [it.label];
  if (it.storage === "kin" && !/KiN/i.test(it.label)) parts.push(STORAGE_LABEL.kin);
  if (it.storage === "cloudinary_cu") parts.push(STORAGE_LABEL.cloudinary_cu);
  return parts.filter(Boolean).join(" · ");
}

/** Danh sách nội dung của một mục (Xem / Mở; `onRemove` có thì có nút Gỡ, dùng trong ngăn kéo Sửa). */
export function NoiDungKem({ items, entryTitle, busy, onRemove }: { items: GtItem[]; entryTitle: string; busy?: boolean; onRemove?: (it: GtItem) => void }) {
  return (
    <ul aria-label={`Nội dung của mục ${entryTitle}`} data-gt-noi-dung className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
      {items.map(it => {
        const href = it.url && it.storage === "link" && /^https:\/\//.test(it.url) ? it.url : null;
        const view = it.kind === "document" && it.url ? viewerHref(it.name, it.url) : null;
        return (
          <li key={it.key} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 border-b border-[var(--kin-vien-nhat)] last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words">{it.name}</p>
              <p className="text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)] break-words">
                {KIND_LABEL[it.kind]}{it.url == null ? (it.count != null ? ` · ${it.count}` : "") : ` · ${sourceOf(it)}`}
              </p>
              {it.broken && <p className="mt-1"><KinStatus tone="loi" className="whitespace-normal">Link cũ bị hỏng, hãy gỡ rồi dán lại</KinStatus></p>}
              {it.warning && !it.broken && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{it.warning}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {view && <Link href={view} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Xem</Link>}
              {!view && href && <a href={href} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở</a>}
              {onRemove && it.url != null && <KinButton type="button" variant="danger" disabled={busy} onClick={() => onRemove(it)} aria-label={`Gỡ ${it.name} khỏi mục`}>Gỡ</KinButton>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Nút ▲▼ vuông 44px; tên truy cập nói rõ mục nào, đi hướng nào. */
function Arrow({ dir, title, disabled, onClick }: { dir: "up" | "down"; title: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={dir === "up" ? `Đưa mục “${title}” lên` : `Đưa mục “${title}” xuống`} disabled={disabled} onClick={onClick}
      className="inline-flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] text-[var(--kin-chu-mo)] enabled:hover:bg-[var(--kin-nen-re-chuot)] enabled:hover:text-[var(--kin-chu-chinh)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
      <span aria-hidden>{dir === "up" ? "▲" : "▼"}</span>
    </button>
  );
}

export interface MucHangProps {
  entry: GtEntry; courseId: string; groups: GtGroup[];
  canUp: boolean; canDown: boolean;
  /** Đang có thao tác ghi khác (khoá nút, tránh bấm chồng). */
  busy: boolean;
  /** Lỗi/thông tin của riêng hàng này, hiện ngay dưới hàng. */
  note: { tone: "ok" | "err"; text: string } | null;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  /** Nút chính theo trạng thái: Nháp → published ("Đăng"), Đã đăng → hidden ("Ẩn"), Ẩn → published ("Hiện lại"). Cha lo hỏi xác nhận khi cần. */
  onSetStatus: (to: LessonStatus) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveGroup: (groupId: string | null) => void;
}

const PRIMARY: Record<LessonStatus, { to: LessonStatus; label: string }> = {
  draft: { to: "published", label: "Đăng" },
  published: { to: "hidden", label: "Ẩn" },
  hidden: { to: "published", label: "Hiện lại" },
};

export default function MucHang({ entry: e, courseId, groups, canUp, canDown, busy, note, onMove, onEdit, onSetStatus, onDuplicate, onDelete, onMoveGroup }: MucHangProps) {
  const uid = useId();
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(false);
  const first = e.items.find(i => i.url != null) ?? e.items[0];
  const extra = e.items.filter(i => i.url != null).length - 1;
  const primary = PRIMARY[e.status];
  const blocked = primary.to === "published" && e.publishBlock != null;
  const reasonId = `${uid}-ly-do`;
  const broken = e.items.some(i => i.broken);
  const warn = e.items.find(i => i.warning && !i.broken)?.warning ?? null;

  return (
    <li data-gt-muc={e.kind} data-gt-trang-thai={e.status} data-gt-id={e.id} className="border-b border-[var(--kin-vien-nhat)] last:border-b-0">
      <div className="flex flex-col md:flex-row md:items-center gap-x-3 gap-y-2 px-4 py-3 min-h-14">
        <div className="order-1 md:order-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ChipKieu kind={e.kind} />
            <p className="min-w-0 break-words text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]" data-gt-ten>{e.title}</p>
            <ChipTrangThai status={e.status} />
          </div>
          <p className="mt-1 text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)] break-words">
            {first ? (first.url != null ? sourceOf(first) : KIND_LABEL[first.kind]) : "Chưa có nội dung"}
            {extra > 0 && <> · +{extra} nội dung kèm</>}
            {e.selfSubmitCount > 0 && <> · Bài tập tự nộp: {e.selfSubmitCount}</>}
            {e.isLocked && <> · Đang khoá</>}
            {e.isFree && <> · Cho học thử miễn phí</>}
          </p>
          {broken && <p className="mt-1"><KinStatus tone="loi" className="whitespace-normal">Có link cũ bị hỏng, hãy mở Sửa để gỡ rồi dán lại</KinStatus></p>}
          {warn && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{warn}</p>}
          {e.status === "draft" && e.publishBlock && <p id={reasonId} data-gt-ly-do className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{e.publishBlock}</p>}
          {e.status === "published" && e.publishBlock && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">Mục đang đăng nhưng chưa có nội dung.</p>}
          {extra > 0 && (
            <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
              className="inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline">
              {open ? "Thu gọn nội dung" : `Xem ${extra + 1} nội dung`}
            </button>
          )}
        </div>

        <div className="order-2 flex flex-wrap items-center gap-2 md:contents">
          <div className="flex gap-2 md:order-1 md:flex-shrink-0">
            <Arrow dir="up" title={e.title} disabled={!canUp || busy} onClick={() => onMove(-1)} />
            <Arrow dir="down" title={e.title} disabled={!canDown || busy} onClick={() => onMove(1)} />
          </div>
          <div className="flex flex-wrap items-center gap-2 md:order-3 md:flex-shrink-0">
            <KinButton type="button" variant="secondary" disabled={busy} onClick={onEdit} aria-label={`Sửa mục “${e.title}”`}>Sửa</KinButton>
            <KinButton type="button" variant={e.status === "draft" ? "primary" : "secondary"} disabled={busy || blocked} aria-describedby={blocked ? reasonId : undefined}
              onClick={() => onSetStatus(primary.to)} aria-label={`${primary.label} mục “${e.title}”`}>{primary.label}</KinButton>
            <KinButton type="button" variant="ghost" aria-expanded={more} aria-label={`Thêm thao tác cho mục “${e.title}”`} onClick={() => setMore(m => !m)}>
              <span aria-hidden>⋯</span>
            </KinButton>
          </div>
        </div>
      </div>

      {open && <div className="px-4 pb-3"><NoiDungKem items={e.items} entryTitle={e.title} /></div>}

      {more && (
        <div data-gt-them-thao-tac className="mx-4 mb-3 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2">
          <Link href={`${baiHocHref(courseId)}/giao-trinh/xem/${e.id}`} className={kinButtonClass("secondary")}>Xem như học sinh</Link>
          <KinButton type="button" variant="secondary" disabled={busy} onClick={onDuplicate}>Nhân bản</KinButton>
          {e.status === "hidden" && <KinButton type="button" variant="secondary" disabled={busy} onClick={() => onSetStatus("draft")}>Đưa về Nháp</KinButton>}
          {groups.length > 0 && (
            <div className="min-w-0 sm:w-56">
              <label htmlFor={`${uid}-nhom`} className="block text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Chuyển nhóm</label>
              <KinSelect id={`${uid}-nhom`} value={e.groupId ?? ""} disabled={busy} onChange={v => onMoveGroup(v || null)}>
                <option value="">Chưa nhóm</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </KinSelect>
            </div>
          )}
          <KinButton type="button" variant="danger" disabled={busy} onClick={onDelete}>Xoá mục</KinButton>
        </div>
      )}

      {note && <p role={note.tone === "err" ? "alert" : "status"} data-gt-ghi-chu-hang={note.tone} className={`mx-4 mb-3 text-[length:var(--kin-co-goc)] ${note.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{note.text}</p>}
    </li>
  );
}
