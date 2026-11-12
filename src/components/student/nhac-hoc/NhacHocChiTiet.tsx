// LOI-04 mục 5 — panel chi tiết một nhắc việc (KHÔNG modal): máy tính = cột phải 400px; điện thoại = thay danh sách trong trang (?muc=<id>, nút "← Nhắc học").
// Mỗi ô LƯU KHI RỜI Ô (blur) bằng PATCH /api/student/nhac-hoc/<id> — chỉ gửi khoá vừa đổi. Kiểm ở trình duyệt bằng ĐÚNG hàm của máy chủ (cleanNhacPatch / normalizeTag /
// cleanTags, src/lib/nhacHoc.ts) nên hai bên báo cùng một lỗi. Lỗi / hết giờ ⇒ trang cha tải lại danh sách từ máy chủ, panel báo lỗi TẠI CHỖ và giữ nguyên chữ em đang gõ;
// không bao giờ kẹt "Đang lưu…", không báo "Đã lưu" khi máy chủ chưa nhận.
// Ghi chú là dữ liệu riêng: không đưa vào title trang, không console.log. Link trong ghi chú vẽ bằng React từ noteSegments (chỉ http(s), tab mới, noopener noreferrer).
// Gắn lớp/bài: lớp từ GET /api/student/lop (lớp em đang học), bài từ GET /api/courses/<id> — chỉ bài Đã đăng (isLearnerVisible). Máy chủ kiểm lại (checkAttach).
// Móc kiểm thử: aside[data-nhac-chi-tiet=<id>], [data-nhac-luu], [data-nhac-tieu-de], [data-nhac-ghi-chu], [data-nhac-ghi-chu-xem], [data-nhac-ngay], [data-nhac-gio],
// [data-nhac-the-o], [data-nhac-the-chip=<tag>], [data-nhac-gan-lop], [data-nhac-gan-bai], [data-nhac-xong-chi-tiet], [data-nhac-xoa], [data-nhac-quay-lai].
"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { kinButtonClass } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinCharRing, useAutoGrow } from "@/components/kin/AutoGrow";
import { KinSelect, type KinSelectOption } from "@/components/kin/KinSelect";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { isLearnerVisible } from "@/lib/lessonStatus";
import type { ThuVienResp } from "@/lib/studentLop";
import {
  NHAC_NOTE_MAX, NHAC_TAG_LEN_MAX, NHAC_TITLE_MAX,
  cleanNhacPatch, cleanTags, dueLabel, isOverdue, normalizeTag, noteSegments,
  type NhacItem,
} from "@/lib/nhacHoc";
import { NHAC_API, nhacFetch } from "./api";

const GOC = "text-[length:var(--kin-co-goc)]";
const ERR = `mt-1 ${GOC} text-[var(--kin-tt-chu-loi)]`;
type Field = "title" | "note" | "due" | "tags" | "lop" | "done";
type SaveState = { k: "" } | { k: "dang-luu" } | { k: "da-luu" } | { k: "loi"; text: string };

/** Ô tròn "Xong" dùng chung (hàng danh sách + panel): input checkbox thật 44×44 (trong suốt) đè lên vòng tròn vẽ bằng token. */
export function NhacDoneBox({ checked, disabled, label, onChange, hook }: { checked: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void; hook?: Record<string, string> }) {
  return (
    <span className="relative flex-shrink-0 inline-flex items-center justify-center w-11 h-11">
      <input type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={e => onChange(e.target.checked)} {...hook}
        className="peer absolute inset-0 m-0 w-11 h-11 opacity-0 cursor-pointer disabled:cursor-wait" />
      <span aria-hidden className="pointer-events-none inline-flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 border-[var(--kin-vien-o-nhap)] text-[length:var(--kin-co-small)] leading-none text-[var(--kin-nhan-chu-tren-nen)] peer-checked:bg-[var(--kin-nhan-nen)] peer-checked:border-[var(--kin-nhan-nen)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--kin-nhan-link)] peer-disabled:opacity-60">
        {checked ? "✓" : ""}
      </span>
    </span>
  );
}

/** Ô chọn lớp + bài để gắn. Tải lớp khi panel mở; tải bài khi đã chọn lớp. Lỗi tải: câu + Thử lại, không chặn các ô khác. */
function GanLopBai({ item, onSave, busy }: { item: NhacItem; onSave: (patch: Record<string, unknown>) => void; busy: boolean }) {
  const lopLabel = useId(), baiLabel = useId();
  const [classes, setClasses] = useState<{ id: string; name: string }[] | null>(null);
  const [classErr, setClassErr] = useState("");
  const [tickC, setTickC] = useState(0);
  const courseId = item.lop?.courseId ?? "";
  const [lessons, setLessons] = useState<{ key: string; list: { id: string; title: string }[] } | null>(null);
  const [lessonErr, setLessonErr] = useState("");
  const [tickL, setTickL] = useState(0);

  useEffect(() => {
    let live = true;
    void nhacFetch<ThuVienResp>("/api/student/lop").then(r => {
      if (!live) return;
      if (r.ok) { setClasses(Array.isArray(r.data.classes) ? r.data.classes.map(c => ({ id: c.id, name: c.name })) : []); setClassErr(""); }
      else setClassErr("Không tải được danh sách lớp.");
    });
    return () => { live = false; };
  }, [tickC]);

  useEffect(() => {
    if (!courseId) return;
    let live = true;
    type L = { id: string; title: string; status?: unknown };
    type C = { sections?: { chapters?: { lessons?: L[] }[] }[] };
    void nhacFetch<C>(`/api/courses/${encodeURIComponent(courseId)}`).then(r => {
      if (!live) return;
      if (!r.ok) { setLessonErr("Không tải được danh sách bài."); return; }
      const list = (r.data.sections ?? []).flatMap(s => (s.chapters ?? []).flatMap(c => c.lessons ?? []))
        .filter(l => l && typeof l.id === "string" && isLearnerVisible(l.status)).map(l => ({ id: l.id, title: String(l.title ?? "") }));
      setLessons({ key: courseId, list }); setLessonErr("");
    });
    return () => { live = false; };
  }, [courseId, tickL]);

  const classOpts: KinSelectOption[] = [{ value: "", label: "Không gắn lớp" }, ...(classes ?? []).map(c => ({ value: c.id, label: c.name }))];
  // Mục gắn lớp mà danh sách lớp chưa có (đang tải) ⇒ vẫn hiện đúng tên lớp trên nút.
  if (courseId && !classOpts.some(o => o.value === courseId) && item.lop) classOpts.push({ value: courseId, label: item.lop.courseName });
  const shownLessons = lessons && lessons.key === courseId ? lessons.list : null;
  const lessonOpts: KinSelectOption[] = [{ value: "", label: "Cả lớp, không chọn bài" }, ...(shownLessons ?? []).map(l => ({ value: l.id, label: l.title }))];
  const lessonId = item.lop?.lessonId ?? "";
  if (lessonId && !lessonOpts.some(o => o.value === lessonId) && item.lop?.lessonTitle) lessonOpts.push({ value: lessonId, label: item.lop.lessonTitle });

  return (
    <div className="space-y-3">
      <div>
        <span id={lopLabel} className={KIN_LABEL}>Gắn lớp</span>
        {classes === null && !classErr ? (
          <p role="status" className={`mt-1 ${GOC} text-[var(--kin-chu-mo)]`}>Đang tải lớp…</p>
        ) : classErr ? (
          <p className={`mt-1 flex flex-wrap items-center gap-2 ${GOC} text-[var(--kin-tt-chu-loi)]`}>{classErr}
            <button type="button" onClick={() => { setClassErr(""); setClasses(null); setTickC(t => t + 1); }} className="min-h-11 px-2 font-semibold text-[var(--kin-nhan-link)] underline">Thử lại</button></p>
        ) : (
          <div data-nhac-gan-lop className="mt-1">
            <KinSelect aria-labelledby={lopLabel} value={courseId} options={classOpts} disabled={busy}
              onChange={v => { if (v !== courseId) onSave({ courseId: v || null, lessonId: null }); }} />
            {classes && classes.length === 0 && <p className={`mt-1 ${GOC} text-[var(--kin-chu-mo)]`}>Bạn chưa vào lớp nào nên chưa gắn được.</p>}
          </div>
        )}
      </div>
      {courseId && (
        <div>
          <span id={baiLabel} className={KIN_LABEL}>Gắn bài (không bắt buộc)</span>
          {lessonErr ? (
            <p className={`mt-1 flex flex-wrap items-center gap-2 ${GOC} text-[var(--kin-tt-chu-loi)]`}>{lessonErr}
              <button type="button" onClick={() => { setLessonErr(""); setTickL(t => t + 1); }} className="min-h-11 px-2 font-semibold text-[var(--kin-nhan-link)] underline">Thử lại</button></p>
          ) : shownLessons === null ? (
            <p role="status" className={`mt-1 ${GOC} text-[var(--kin-chu-mo)]`}>Đang tải bài…</p>
          ) : (
            <div data-nhac-gan-bai className="mt-1">
              <KinSelect aria-labelledby={baiLabel} value={lessonId} options={lessonOpts} disabled={busy}
                onChange={v => { if (v !== lessonId) onSave({ courseId, lessonId: v || null }); }} />
            </div>
          )}
        </div>
      )}
      {item.lop && (
        <Link href={item.lop.href} data-nhac-mo-lop className={`inline-flex items-center min-h-11 ${GOC} font-medium text-[var(--kin-nhan-link)] underline [overflow-wrap:anywhere]`}>
          Mở {item.lop.lessonTitle ?? item.lop.courseName} →
        </Link>
      )}
    </div>
  );
}

export default function NhacHocChiTiet({ item, todayKey, now, onSaved, onDeleted, onFailed, onClose }: {
  item: NhacItem;
  todayKey: string;
  now: Date;
  onSaved: (it: NhacItem) => void;
  onDeleted: (id: string) => void;
  /** Ghi lỗi / hết giờ ⇒ trang cha tải lại danh sách từ máy chủ. */
  onFailed: () => Promise<void> | void;
  onClose: () => void;
}) {
  const ids = useId();
  const id = (s: string) => `${ids}-${s}`;
  const [title, setTitle] = useState(item.title);
  const [note, setNote] = useState(item.note ?? "");
  const [noteEdit, setNoteEdit] = useState(!item.note);
  const [date, setDate] = useState(item.dueDate ?? "");
  const [time, setTime] = useState(item.dueTime ?? "");
  const [tagDraft, setTagDraft] = useState("");
  const [errs, setErrs] = useState<Partial<Record<Field, string>>>({});
  const [save, setSave] = useState<SaveState>({ k: "" });
  const [busy, setBusy] = useState<Partial<Record<Field, boolean>>>({});
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const { ask, dialog } = useKinConfirm();
  useAutoGrow(noteRef, note, 320);
  // Điện thoại (nút "← Nhắc học" đang hiện): chi tiết thay danh sách ⇒ cuộn về đầu trang. Máy tính: chỉ chuyển tiêu điểm vào panel.
  useEffect(() => {
    if (backRef.current?.offsetParent) window.scrollTo({ top: 0 });
    headRef.current?.focus({ preventScroll: true });
  }, []);

  const setErr = useCallback((f: Field, msg: string) => setErrs(e => ({ ...e, [f]: msg })), []);

  const doSave = useCallback(async (patch: Record<string, unknown>, f: Field): Promise<boolean> => {
    const c = cleanNhacPatch(patch, todayKey);
    if (!c.ok) { setErr(f, c.error); return false; }
    setErr(f, ""); setBusy(b => ({ ...b, [f]: true })); setSave({ k: "dang-luu" });
    const r = await nhacFetch<{ item?: NhacItem }>(`${NHAC_API}/${encodeURIComponent(item.id)}`, { method: "PATCH", body: patch });
    setBusy(b => ({ ...b, [f]: false }));
    if (r.ok && r.data.item) { onSaved(r.data.item); setSave({ k: "da-luu" }); return true; }
    const msg = r.ok ? "Chưa lưu được, thử lại nhé." : r.error;
    setErr(f, msg); setSave({ k: "loi", text: msg });
    await onFailed();
    return false;
  }, [item.id, todayKey, onSaved, onFailed, setErr]);

  const saveTitle = () => { if (title !== item.title) void doSave({ title }, "title"); };
  const saveNote = async () => {
    const next = note.replace(/\s+$/, "") ? note : null;
    if ((next ?? "") === (item.note ?? "")) { if (next) setNoteEdit(false); return; }
    const ok = await doSave({ note: next }, "note");
    if (ok && next) setNoteEdit(false);
  };
  const saveDue = (d: string, t: string) => {
    // Có giờ mà xoá ngày ⇒ cleanNhacPatch chặn tại chỗ ("Có giờ hẹn thì cần chọn ngày."), không gửi.
    if (d === (item.dueDate ?? "") && t === (item.dueTime ?? "")) { setErr("due", ""); return; }
    void doSave({ dueDate: d || null, dueTime: t || null }, "due");
  };
  const addTag = () => {
    const raw = tagDraft.trim();
    if (!raw) return;
    const t = normalizeTag(raw);
    if (!t) { setErr("tags", `Thẻ không hợp lệ: chỉ dùng chữ, số, "-" hoặc "_", tối đa ${NHAC_TAG_LEN_MAX} ký tự.`); return; }
    if (item.tags.includes(t)) { setTagDraft(""); setErr("tags", ""); return; }
    const c = cleanTags([...item.tags, t]); // > NHAC_TAGS_MAX thẻ ⇒ đúng chữ lỗi của máy chủ
    if (!c.ok) { setErr("tags", c.error); return; }
    setTagDraft("");
    void doSave({ tags: c.value }, "tags");
  };
  const removeTag = (t: string) => void doSave({ tags: item.tags.filter(x => x !== t) }, "tags");

  async function remove() {
    if (!(await ask({ title: "Xoá nhắc việc này?", message: "Xoá rồi thì không lấy lại được.", confirmLabel: "Xoá" }))) return;
    setBusy(b => ({ ...b, done: true })); setSave({ k: "dang-luu" });
    const r = await nhacFetch<{ ok?: boolean }>(`${NHAC_API}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    setBusy(b => ({ ...b, done: false }));
    if (r.ok) { onDeleted(item.id); return; }
    setSave({ k: "loi", text: r.error === "Chưa lưu được, thử lại nhé." ? "Chưa xoá được, thử lại nhé." : r.error });
    await onFailed();
  }

  const overdue = isOverdue(item, now);
  const label = dueLabel(item, now);
  const anyBusy = Object.values(busy).some(Boolean);

  return (
    <section data-nhac-chi-tiet={item.id} aria-labelledby={id("h")} className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <button type="button" ref={backRef} data-nhac-quay-lai onClick={onClose} className={`@min-[720px]:hidden -ml-2 inline-flex items-center min-h-11 px-2 ${GOC} font-semibold text-[var(--kin-nhan-link)]`}>← Nhắc học</button>
        <h2 id={id("h")} ref={headRef} tabIndex={-1} className="@max-[720px]:sr-only text-[length:var(--kin-co-tieu-de)] font-semibold leading-6 text-[var(--kin-chu-chinh)] outline-none">Chi tiết nhắc việc</h2>
        <div className="flex items-center gap-2">
          <p data-nhac-luu role="status" aria-live="polite" className={`${GOC} whitespace-nowrap`}>
            {save.k === "dang-luu" ? <KinStatus tone="mo">Đang lưu…</KinStatus> : save.k === "da-luu" ? <KinStatus tone="xong">Đã lưu</KinStatus> : save.k === "loi" ? <KinStatus tone="loi">Chưa lưu được</KinStatus> : null}
          </p>
          <button type="button" onClick={onClose} className={`${kinButtonClass("ghost")} @max-[720px]:hidden`}>Đóng</button>
        </div>
      </div>
      {save.k === "loi" && <p role="alert" data-nhac-luu-loi className={ERR}>{save.text}</p>}
      {(label || overdue) && (
        <p className={`mt-1 flex flex-wrap items-center gap-2 ${GOC} text-[var(--kin-chu-mo)]`}>
          {overdue && <KinStatus tone="loi">Quá hạn</KinStatus>}
          <span>{overdue ? label.replace(/^Quá hạn · /, "") : label}</span>
        </p>
      )}

      <div className="mt-4 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={id("title")} className={KIN_LABEL}>Tiêu đề</label>
            <KinCharRing count={title.length} max={NHAC_TITLE_MAX} />
          </div>
          <input id={id("title")} data-nhac-tieu-de value={title} onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
            aria-invalid={errs.title ? true : undefined} aria-describedby={errs.title ? id("title-err") : undefined}
            className={`${KIN_FIELD} mt-1 text-[length:var(--kin-co-body)]`} />
          {errs.title && <p id={id("title-err")} role="alert" className={ERR}>{errs.title}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={id("note")} className={KIN_LABEL}>Ghi chú</label>
            {noteEdit && <KinCharRing count={note.length} max={NHAC_NOTE_MAX} />}
          </div>
          {noteEdit ? (
            <textarea id={id("note")} ref={noteRef} data-nhac-ghi-chu value={note} rows={3} onChange={e => setNote(e.target.value)} onBlur={() => void saveNote()}
              placeholder="Ghi việc cần nhớ, dán link tài liệu…" aria-invalid={errs.note ? true : undefined}
              className={`${KIN_FIELD} mt-1 py-2 leading-6 resize-none`} />
          ) : (
            <div className="mt-1">
              <div id={id("note")} data-nhac-ghi-chu-xem className={`rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] px-3 py-2 ${GOC} leading-6 text-[var(--kin-chu-chinh)] whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                {noteSegments(item.note).map((s, i) => s.kind === "link"
                  ? <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[var(--kin-nhan-link)] underline">{s.text}</a>
                  : <span key={i}>{s.text}</span>)}
              </div>
              <button type="button" data-nhac-sua-ghi-chu onClick={() => { setNoteEdit(true); requestAnimationFrame(() => noteRef.current?.focus()); }}
                className={`mt-1 inline-flex items-center min-h-11 px-1 ${GOC} text-[var(--kin-nhan-link)] underline`}>Sửa ghi chú</button>
            </div>
          )}
          {errs.note && <p role="alert" className={ERR}>{errs.note}</p>}
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className={KIN_LABEL}>Ngày</span>
              <input type="date" data-nhac-ngay value={date} onChange={e => setDate(e.target.value)} onBlur={() => saveDue(date, time)} className={`${KIN_FIELD} mt-1`} />
            </label>
            <label className="block min-w-0">
              <span className={KIN_LABEL}>Giờ (không bắt buộc)</span>
              <input type="time" data-nhac-gio value={time} onChange={e => setTime(e.target.value)} onBlur={() => saveDue(date, time)} className={`${KIN_FIELD} mt-1`} />
            </label>
          </div>
          {(date || time) && (
            <button type="button" data-nhac-bo-hen onClick={() => { setDate(""); setTime(""); saveDue("", ""); }}
              className={`mt-1 inline-flex items-center min-h-11 px-1 ${GOC} text-[var(--kin-nhan-link)] underline`}>Bỏ hẹn ngày</button>
          )}
          {errs.due && <p role="alert" data-nhac-loi-hen className={ERR}>{errs.due}</p>}
          <p className={`mt-1 ${GOC} leading-5 text-[var(--kin-chu-mo)]`}>KiN nhắc trong chuông thông báo lúc 7 giờ sáng ngày đến hạn, không báo đúng giờ hẹn.</p>
        </div>

        <div>
          <label htmlFor={id("tag")} className={KIN_LABEL}>Thẻ</label>
          {item.tags.length > 0 && (
            <ul aria-label="Thẻ của nhắc việc" className="mt-1 flex flex-wrap gap-2">
              {item.tags.map(t => (
                <li key={t} data-nhac-the-chip={t} className={`inline-flex items-center gap-1 pl-3 rounded-[var(--kin-bo-tron)] bg-[var(--kin-nen-nhan)] ${GOC} text-[var(--kin-chu-chinh)]`}>
                  #{t}
                  <button type="button" onClick={() => removeTag(t)} disabled={busy.tags} aria-label={`Gỡ thẻ #${t}`} className="inline-flex items-center justify-center w-11 h-11 rounded-full text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]">×</button>
                </li>
              ))}
            </ul>
          )}
          <input id={id("tag")} data-nhac-the-o value={tagDraft} readOnly={busy.tags} onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => { if ((e.key === "Enter" || e.key === ",") && !e.nativeEvent.isComposing) { e.preventDefault(); addTag(); } }}
            onBlur={addTag} placeholder="Gõ thẻ rồi Enter, ví dụ toan" className={`${KIN_FIELD} mt-2`} />
          {errs.tags && <p role="alert" data-nhac-loi-the className={ERR}>{errs.tags}</p>}
        </div>

        <GanLopBai item={item} busy={!!busy.lop} onSave={patch => void doSave(patch, "lop")} />
        {errs.lop && <p role="alert" data-nhac-loi-lop className={`-mt-3 ${ERR}`}>{errs.lop}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--kin-vien-nhat)]">
          <label className={`inline-flex items-center gap-1 ${GOC} text-[var(--kin-chu-chinh)]`}>
            <NhacDoneBox checked={!!item.doneAt} disabled={!!busy.done} label="Xong" hook={{ "data-nhac-xong-chi-tiet": "" }}
              onChange={v => void doSave({ done: v }, "done")} />
            <span aria-hidden>Xong</span>
          </label>
          <button type="button" data-nhac-xoa onClick={() => void remove()} disabled={anyBusy} className={kinButtonClass("danger")}>Xoá</button>
        </div>
        {errs.done && <p role="alert" className={ERR}>{errs.done}</p>}

        <p className={`${GOC} leading-5 text-[var(--kin-chu-mo)]`}>Ghi chú chỉ mình bạn xem. Đừng ghi mật khẩu hay số điện thoại vào đây.</p>
      </div>
      {dialog}
    </section>
  );
}
