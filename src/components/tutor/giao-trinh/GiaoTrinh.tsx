// BU-02-PHẲNG — màn Giáo trình của một lớp (/lop-cua-toi/quan-lop/[id]/giao-trinh): DANH SÁCH PHẲNG, một cột. Khung 606:5 (607:218 máy tính, 607:491 điện thoại) chưa đọc được
// trực tiếp trong phiên dựng này: làm theo mục 5.1–5.5 của dac-ta/BU-02-PHANG.md (chữ từng nút lấy từ bản đối chiếu 05/11).
// Mỗi mục = một Lesson, có chip KIỂU + chip TRẠNG THÁI (Nháp · Đã đăng · Ẩn). Thêm thẳng vào lớp, không cần chương; "Thêm chương" là hành động phụ (nhóm tuỳ chọn).
// Mục mới ở dạng Nháp (chỉ gia sư thấy), đăng bằng một chạm. Video CHỈ gắn link YouTube: không có giao diện tải video.
// Ba trạng thái: đang tải (khung xương), lỗi (+ Thử lại), rỗng (ô tải phóng lớn, không nhắc Phần/Chương). Không đọc/hiện tên học sinh ở màn này.
"use client";
import Link from "next/link";
import { useState } from "react";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_FIELD } from "@/components/kin/PageLayout";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { giaoTrinhHref, contentHref } from "@/lib/tutorRoutes";
import { formatMegabytes } from "@/lib/mediaStorage";
import { moveEntry, type GtEntry, type GtGroup } from "@/lib/giaoTrinh";
import type { LessonStatus } from "@/lib/lessonStatus";
import OTaiLen from "./OTaiLen";
import MucHang from "./MucHang";
import NganKeoSua, { type SuaThayDoi } from "./NganKeoSua";
import ThemChuong from "./ThemChuong";
import { STATUS_LABEL } from "./ChipTrangThai";
import { useGiaoTrinh, type GtFilter } from "./useGiaoTrinh";
import GiaoChoNhom, { nhomBiKhoa, useGiaoVienLop } from "./GiaoChoNhom";

const FILTERS: { key: GtFilter; label: string }[] = [
  { key: "all", label: "Tất cả" }, { key: "draft", label: STATUS_LABEL.draft }, { key: "published", label: STATUS_LABEL.published }, { key: "hidden", label: STATUS_LABEL.hidden },
];
const EXAM_STATE_TONE: Record<string, "xong" | "cho" | "mo"> = { "Sắp mở": "cho", "Đang mở": "xong", "Đã đóng": "mo" };
const LIST_BOX = "rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden";

export default function GiaoTrinh({ courseId }: { courseId: string }) {
  const g = useGiaoTrinh(courseId);
  const gv = useGiaoVienLop(courseId);
  const { ask, dialog } = useKinConfirm();
  const [addingGroup, setAddingGroup] = useState(false);
  const [pageMenu, setPageMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const back = { href: `/lop-cua-toi/${courseId}`, label: "← Lớp" };

  if (g.load.phase === "loading") return <KinPageSkeleton label="Đang tải giáo trình" rows={5} />;
  if (g.load.phase === "error") {
    const forbidden = g.load.status === 403 || g.load.status === 404;
    return (
      <KinPage>
        <KinPageHeader title="Giáo trình" back={back} />
        <div className="max-w-xl">
          <KinStateCard tone="loi" kicker={forbidden ? "Không mở được" : "Lỗi · Có thể thử lại"} title={g.load.message}
            status={<KinStatus tone="loi">{forbidden ? "Không có dữ liệu của lớp này" : "Chưa tải được giáo trình"}</KinStatus>}
            actions={<>{!forbidden && <KinButton type="button" onClick={() => void g.reload()}>Thử lại</KinButton>}<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Về danh sách lớp</Link></>}>
            {forbidden ? "Giáo trình chỉ mở cho gia sư đang dạy lớp này." : "Dữ liệu của bạn vẫn an toàn. Thử lại sau ít giây."}
          </KinStateCard>
        </div>
      </KinPage>
    );
  }

  const snap = g.load.snap;
  const entries = g.entries;
  const groups = snap.groups;
  const filter = g.filter;
  const visible = filter === "all" ? entries : entries.filter(e => e.status === filter);
  const groupIds = new Set(groups.map(x => x.id));
  const ungrouped = visible.filter(e => e.groupId == null || !groupIds.has(e.groupId));
  const publishable = entries.filter(e => e.status === "draft" && e.publishBlock == null);
  const canReorder = filter === "all";
  const first = entries[0] ?? null;
  const busy = !!g.busy;
  const rowNote = (id: string) => (g.notice?.forId === id ? { tone: g.notice.tone, text: g.notice.text } : null);
  const pageNotice = g.notice && !g.notice.forId ? g.notice : null;

  async function setStatus(e: GtEntry, to: LessonStatus) {
    if (to === "published" && e.isFree && !(await ask({
      title: `Đăng “${e.title}”?`,
      message: "Mục này đang cho học thử miễn phí: người chưa vào lớp cũng sẽ thấy khi bạn đăng.",
      confirmLabel: "Đăng mục này", tone: "thuong",
    }))) return;
    const text = to === "published" ? (e.status === "hidden" ? `Đã hiện lại “${e.title}” cho học sinh.` : `Đã đăng “${e.title}”. Học sinh đã vào lớp thấy mục này.`)
      : to === "hidden" ? `Đã ẩn “${e.title}”. Học sinh không còn thấy mục này, tiến độ của họ vẫn được giữ.` : `Đã đưa “${e.title}” về Nháp.`;
    await g.setStatus(e.id, to, text);
  }
  async function publishAll() {
    const free = publishable.filter(e => e.isFree).length;
    if (free > 0 && !(await ask({
      title: `Đăng ${publishable.length} mục Nháp?`,
      message: `Có ${free} mục đang cho học thử miễn phí: người chưa vào lớp cũng sẽ thấy các mục đó.`,
      confirmLabel: "Đăng tất cả", tone: "thuong",
    }))) return;
    await g.publishMany(publishable.map(e => e.id));
  }
  async function removeEntry(e: GtEntry) {
    if (!(await ask({
      title: `Xoá mục “${e.title}”?`,
      message: "Mọi nội dung trong mục (link, tài liệu, bài tập tự nộp) sẽ bị xoá cùng. Việc này không hoàn tác được. Chỉ muốn học sinh không thấy nữa? Dùng Ẩn: không mất gì.",
      confirmLabel: "Xoá mục",
    }))) return;
    if (await g.deleteEntry(e.id)) g.setEditId(null);
  }
  async function ungroup(grp: GtGroup) {
    if (!(await ask({
      title: `Bỏ nhóm “${grp.title}”?`,
      message: "Các mục trong nhóm vẫn còn, chuyển về “Chưa nhóm”. Chỉ nhóm bị xoá.",
      confirmLabel: "Bỏ nhóm", tone: "thuong",
    }))) return;
    await g.ungroup(grp.id);
  }
  async function saveEdit(e: GtEntry, c: SuaThayDoi) {
    const fields = c.title !== e.title || c.duration !== (e.duration ?? null) || c.isLocked !== e.isLocked || c.isFree !== e.isFree;
    if (fields && !(await g.patchLesson(e.id, { title: c.title, duration: c.duration, isLocked: c.isLocked, isFree: c.isFree }, `Đã lưu “${c.title}”.`))) return false;
    if (c.groupId !== (e.groupId ?? null) && !(await g.moveToGroup(e.id, c.groupId))) return false;
    g.setEditId(null);
    return true;
  }
  async function removeContent(e: GtEntry, key: string, name: string) {
    if (!(await ask({ title: "Gỡ nội dung này khỏi mục?", message: `“${name}” sẽ không còn hiện cho học sinh ở mục này. Tệp đã tải lên KiN vẫn còn trong Thư viện của bạn.`, confirmLabel: "Gỡ khỏi mục" }))) return;
    await g.removeItem(e.id, key);
  }

  const renderRows = (list: GtEntry[]) => (
    <ul aria-label="Các mục" className={LIST_BOX}>
      {list.map(e => (
        <MucHang key={e.id} entry={e} courseId={courseId} groups={groups}
          canUp={canReorder && moveEntry(entries, e.id, -1).ok} canDown={canReorder && moveEntry(entries, e.id, 1).ok}
          busy={busy} note={rowNote(e.id)}
          onMove={dir => void g.move(e.id, dir)} onEdit={() => g.setEditId(e.id)} onSetStatus={to => void setStatus(e, to)}
          onDuplicate={() => void g.duplicateEntry(e)} onDelete={() => void removeEntry(e)} onMoveGroup={gid => void g.moveToGroup(e.id, gid)} />
      ))}
    </ul>
  );

  const headerActions = (
    <>
      <div className="max-md:hidden flex items-center gap-3">
        <KinButton type="button" variant="secondary" aria-expanded={addingGroup} onClick={() => setAddingGroup(a => !a)}>Thêm chương</KinButton>
        {first && <Link href={`${giaoTrinhHref(courseId, true)}/xem/${first.id}`} className={kinButtonClass("secondary")}>Xem như học sinh</Link>}
      </div>
      <KinButton type="button" variant="secondary" className="md:hidden" aria-expanded={pageMenu} aria-label="Thêm thao tác của trang" onClick={() => setPageMenu(m => !m)}><span aria-hidden>⋯</span></KinButton>
    </>
  );

  const empty = entries.length === 0 && groups.length === 0;
  const showGroupHeads = groups.length > 0;

  return (
    <KinPage>
      <KinPageHeader title="Giáo trình" sub={snap.courseName} back={back} actions={headerActions} />

      {pageMenu && (
        <div data-gt-menu-trang className="md:hidden mb-4 flex flex-col gap-2">
          <KinButton type="button" variant="secondary" onClick={() => { setAddingGroup(true); setPageMenu(false); }}>Thêm chương</KinButton>
          {first && <Link href={`${giaoTrinhHref(courseId, true)}/xem/${first.id}`} className={kinButtonClass("secondary")}>Xem như học sinh</Link>}
        </div>
      )}

      {pageNotice && (
        <p role={pageNotice.tone === "err" ? "alert" : "status"} data-gt-thong-bao className={`mb-4 text-[length:var(--kin-co-goc)] ${pageNotice.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{pageNotice.text}</p>
      )}

      {addingGroup && <ThemChuong busy={g.busy === "nhom:moi"} onSubmit={g.createGroup} onClose={() => setAddingGroup(false)} />}

      <div className={empty ? "max-w-3xl" : "max-w-[960px] space-y-[var(--kin-cach-muc)]"}>
        {empty && <KinEmptyState key="gt-rong" title="Lớp chưa có mục nào">Dán link YouTube hoặc thả tệp đầu tiên. Mục mới ở dạng Nháp, bạn đăng khi sẵn sàng.</KinEmptyState>}
        <OTaiLen key="gt-o-tai" large={empty} courseId={courseId} config={snap.config} entries={entries} onAdd={g.addItem}
          onUndo={i => (i.createdLesson ? g.deleteEntry(i.lessonId) : g.removeItem(i.lessonId, i.key))} />
        {!empty && (
          <>

          <section aria-labelledby="gt-ds">
            <KinSectionHead id="gt-ds" title={`Các mục · ${entries.length}`} as="h2" />
            <p data-gt-nhac-nhap className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Mục Nháp và Ẩn chỉ gia sư thấy. Học sinh chỉ thấy mục Đã đăng.</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Lọc theo trạng thái" className="flex gap-2 overflow-x-auto max-w-full">
                {FILTERS.map(f => {
                  const n = f.key === "all" ? entries.length : snap.counts[f.key];
                  return (
                    <KinButton key={f.key} type="button" variant={filter === f.key ? "primary" : "secondary"} aria-pressed={filter === f.key} onClick={() => g.setFilter(f.key)} data-gt-loc={f.key}>
                      {f.label} {n}
                    </KinButton>
                  );
                })}
              </div>
              {publishable.length > 0 && (
                <KinButton type="button" variant="secondary" loading={g.busy === "tt:lo"} loadingLabel="Đang đăng…" disabled={busy} onClick={() => void publishAll()}>Đăng tất cả mục Nháp ({publishable.length})</KinButton>
              )}
            </div>
            {!canReorder && <p className="mt-2 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Đang lọc theo trạng thái. Chọn “Tất cả” để đổi thứ tự bằng mũi tên.</p>}

            <div className="mt-4 space-y-5">
              {visible.length === 0 && (groups.length === 0 || filter !== "all") ? (
                <KinEmptyState title={`Chưa có mục ${STATUS_LABEL[filter === "all" ? "draft" : filter].toLowerCase()} nào`}
                  action={<KinButton type="button" variant="secondary" onClick={() => g.setFilter("all")}>Xem tất cả mục</KinButton>}>
                  Chọn “Tất cả” để thấy mọi mục của lớp.
                </KinEmptyState>
              ) : (
                <>
                  {ungrouped.length > 0 && (
                    <div data-gt-khoi="chua-nhom">
                      {showGroupHeads && <h3 className="mb-2 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Chưa nhóm · {ungrouped.length}</h3>}
                      {renderRows(ungrouped)}
                    </div>
                  )}
                  {groups.map(grp => {
                    const rows = visible.filter(e => e.groupId === grp.id);
                    if (filter !== "all" && rows.length === 0) return null;
                    const tid = (grp as GtGroup & { teacherId?: string | null }).teacherId;
                    const khoa = nhomBiKhoa(gv, tid);
                    return (
                      <fieldset key={grp.id} disabled={khoa} data-gt-khoi="nhom" data-gt-nhom={grp.id} data-gt-nhom-khoa={khoa ? "1" : undefined} className="min-w-0 border-0 p-0 m-0">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {renaming === grp.id ? (
                            <form className="flex flex-1 min-w-0 flex-col sm:flex-row gap-2" onSubmit={async ev => { ev.preventDefault(); if (await g.renameGroup(grp.id, renameTitle)) setRenaming(null); }}>
                              <label htmlFor={`gt-doi-ten-${grp.id}`} className="sr-only">Tên mới của nhóm {grp.title}</label>
                              <input id={`gt-doi-ten-${grp.id}`} autoFocus className={KIN_FIELD} value={renameTitle} maxLength={120} onChange={e => setRenameTitle(e.target.value)} />
                              <KinButton type="submit" loading={g.busy === `nhom:${grp.id}`} loadingLabel="Đang lưu…">Lưu tên</KinButton>
                              <KinButton type="button" variant="ghost" onClick={() => setRenaming(null)}>Bỏ</KinButton>
                            </form>
                          ) : (
                            <>
                              <h3 className="flex-1 min-w-0 break-words text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{grp.title} · {rows.length}</h3>
                              <KinButton type="button" variant="ghost" disabled={busy} onClick={() => { setRenaming(grp.id); setRenameTitle(grp.title); }} aria-label={`Đổi tên nhóm ${grp.title}`}>Đổi tên</KinButton>
                              <KinButton type="button" variant="ghost" disabled={busy} onClick={() => void ungroup(grp)} aria-label={`Bỏ nhóm ${grp.title}`}>Bỏ nhóm</KinButton>
                            </>
                          )}
                        </div>
                        <div className="mb-2"><GiaoChoNhom courseId={courseId} chapterId={grp.id} teacherId={tid} info={gv} onChanged={() => g.reload({ silent: true })} /></div>
                        {rows.length ? renderRows(rows) : <p className="px-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Nhóm này chưa có mục. Dùng “Chuyển nhóm” ở một mục để đưa vào đây.</p>}
                      </fieldset>
                    );
                  })}
                </>
              )}
            </div>
          </section>

          {snap.exams.length > 0 && (
            <section aria-labelledby="gt-kt">
              <KinSectionHead id="gt-kt" title={`Bài kiểm tra của lớp · ${snap.exams.length}`} as="h2" />
              <ul className={`mt-3 ${LIST_BOX}`}>
                {snap.exams.map(x => {
                  const href = x.href ? (x.href.startsWith("/admin") ? contentHref(true, x.href) : x.href) : null;
                  const tone = EXAM_STATE_TONE[x.label];
                  return (
                    <li key={x.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--kin-vien-nhat)] last:border-b-0">
                      <div className="min-w-0 flex flex-wrap items-center gap-x-2">
                        <span className="min-w-0 break-words text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{x.name}</span>
                        {tone && <KinStatus tone={tone}>{x.label}</KinStatus>}
                      </div>
                      {href && <Link href={href} className={kinButtonClass("secondary")} aria-label={`Mở đề ${x.name}`}>Mở đề</Link>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            Kho tài liệu của bạn: đã dùng {formatMegabytes(snap.config.document.usedBytes)} / {formatMegabytes(snap.config.document.quotaBytes)}.
          </p>
          </>
        )}
      </div>

      {g.editing && (
        <NganKeoSua key={g.editing.id} entry={g.editing} courseId={courseId} groups={groups} busy={busy}
          error={g.notice?.tone === "err" && g.notice.forId === g.editing.id ? g.notice.text : null}
          onSave={c => saveEdit(g.editing as GtEntry, c)} onClose={() => g.setEditId(null)}
          onRemoveItem={it => void removeContent(g.editing as GtEntry, it.key, it.name)}
          onDuplicate={() => void g.duplicateEntry(g.editing as GtEntry)} onDelete={() => void removeEntry(g.editing as GtEntry)} />
      )}
      {dialog}
    </KinPage>
  );
}
