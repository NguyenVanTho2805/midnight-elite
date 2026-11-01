// BU-02 — màn Giáo trình của một lớp (/lop-cua-toi/quan-lop/[id]/giao-trinh). Figma: chưa đối chiếu (606:5, 607:218, 607:491) — dựng theo mô tả mục 5 của đặc tả + token --kin-*.
// 1600/1280: ba cột — (a) cây Phần › Chương › Bài, (b) ô tải lên chung + mục của bài đang mở theo kiểu, (c) thông tin bài.
// 390: một cột — nút "Chọn bài" mở cây, hai nút lớn trong ô tải lên, hàng mục xếp dọc, sắp xếp bằng ▲▼ 44px.
// Ba trạng thái: đang tải (khung xương), lỗi (+ Thử lại), rỗng (lớp chưa có bài: ô tải phóng lớn). Dữ liệu lấy bằng G1; không đọc tên học sinh ở đây.
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
import { viewerHref } from "@/lib/library";
import { giaoTrinhHref, contentHref } from "@/lib/tutorRoutes";
import { formatMegabytes } from "@/lib/mediaStorage";
import type { GtItem, GtLesson, ItemKind } from "@/lib/giaoTrinh";
import { formatDeadlineVn } from "@/components/media/StudentLessonPanels";
import OTaiLen from "./OTaiLen";
import { useGiaoTrinh } from "./useGiaoTrinh";

const KIND_LABEL: Record<ItemKind, string> = { video: "Video", document: "Tài liệu", assignment: "Bài tập/Azota", live: "Buổi live", exam: "Bài kiểm tra" };
const KIND_ORDER: ItemKind[] = ["video", "document", "assignment", "live"];
const STORAGE_LABEL: Record<GtItem["storage"], string> = { link: "Link ngoài", kin: "Tệp trên KiN (riêng tư)", cloudinary_cu: "Tệp cũ (công khai)" };

/** Nút ▲▼ vuông 44px. */
function Arrow({ dir, label, disabled, onClick }: { dir: "up" | "down"; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="inline-flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-[var(--kin-bo-md)] border border-transparent text-[var(--kin-chu-mo)] enabled:hover:bg-[var(--kin-nen-re-chuot)] enabled:hover:text-[var(--kin-chu-chinh)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
      <span aria-hidden>{dir === "up" ? "▲" : "▼"}</span>
    </button>
  );
}

function ItemRow({ it, courseId, onRemove, busy, lessonId }: { it: GtItem; courseId: string; onRemove: () => void; busy: boolean; lessonId: string }) {
  const href = it.url ? (it.storage === "link" && /^https:\/\//.test(it.url) ? it.url : null) : null;
  const view = it.kind === "document" && it.url ? viewerHref(it.name, it.url) : null;
  const sub = [it.label, STORAGE_LABEL[it.storage]].filter(Boolean).join(" · ");
  return (
    <li data-gt-muc={it.kind} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-[var(--kin-vien-nhat)] last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words">{it.name}</p>
        <p className="text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)] break-words">{sub}</p>
        {it.broken && <p className="mt-1"><KinStatus tone="loi" className="whitespace-normal">Link cũ bị hỏng, hãy gỡ rồi dán lại</KinStatus></p>}
        {it.warning && !it.broken && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{it.warning}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {view && <Link href={view} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Xem</Link>}
        {!view && href && <a href={href} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở</a>}
        <Link href={`${giaoTrinhHref(courseId, true)}/xem/${lessonId}`} className={kinButtonClass("ghost")}>Xem như học sinh</Link>
        <KinButton type="button" variant="danger" disabled={busy} onClick={onRemove} aria-label={`Gỡ ${it.name} khỏi bài`}>Gỡ</KinButton>
      </div>
    </li>
  );
}

function LessonInfo({ lesson, courseId, onPatch, onDuplicate, onDelete, busy, examCount }: {
  lesson: GtLesson; courseId: string; busy: boolean; examCount: number;
  onPatch: (p: Record<string, unknown>, ok?: string) => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [duration, setDuration] = useState(lesson.duration ?? "");
  const deadline = formatDeadlineVn(lesson.azotaDeadline);
  const selfSubmit = lesson.items.find(i => i.kind === "assignment" && i.url == null);
  return (
    <aside aria-label="Thông tin bài" className="min-w-0 space-y-5">
      <KinSectionHead title="Thông tin bài" as="h2" />
      <div>
        <label htmlFor="gt-ten" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tên bài</label>
        <div className="mt-2 flex gap-2">
          <input id="gt-ten" className={KIN_FIELD} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} />
          <KinButton type="button" variant="secondary" disabled={busy || !title.trim() || title.trim() === lesson.title} onClick={() => onPatch({ title: title.trim() }, "Đã đổi tên bài.")}>Lưu</KinButton>
        </div>
      </div>
      <div>
        <label htmlFor="gt-tl" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Thời lượng</label>
        <div className="mt-2 flex gap-2">
          <input id="gt-tl" className={KIN_FIELD} value={duration} maxLength={40} placeholder="Ví dụ: 45 phút" onChange={e => setDuration(e.target.value)} />
          <KinButton type="button" variant="secondary" disabled={busy || duration.trim() === (lesson.duration ?? "")} onClick={() => onPatch({ duration: duration.trim() || null }, "Đã lưu thời lượng.")}>Lưu</KinButton>
        </div>
      </div>
      <div>
        <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-5 h-5 flex-shrink-0" checked={lesson.isLocked} disabled={busy} onChange={e => onPatch({ isLocked: e.target.checked }, e.target.checked ? "Đã khoá bài." : "Đã mở khoá bài.")} />
          <span>Khoá bài này<span className="block text-[var(--kin-chu-mo)]">Học sinh chưa mở được cho tới khi bạn mở khoá.</span></span>
        </label>
        <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-5 h-5 flex-shrink-0" checked={lesson.isFree} disabled={busy} onChange={e => onPatch({ isFree: e.target.checked }, e.target.checked ? "Bài này cho học thử miễn phí." : "Đã tắt học thử miễn phí.")} />
          <span>Cho học thử miễn phí<span className="block text-[var(--kin-chu-mo)]">Người chưa vào lớp xem được bài này (cần đăng nhập để mở tệp).</span></span>
        </label>
      </div>
      {deadline && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Hạn Azota: <b className="font-medium">{deadline.text}</b>{deadline.overdue ? " (đã quá hạn)" : ""}</p>}
      <div className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        <p>Bài tập tự nộp: {selfSubmit?.count ?? 0}</p>
        <Link href={contentHref(true, `/admin/khoa-hoc/${courseId}?tab=chuong-bai`)} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Soạn bài tập ở tab Chương bài</Link>
      </div>
      <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bài kiểm tra của lớp · {examCount}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={`${giaoTrinhHref(courseId, true)}/xem/${lesson.id}`} className={kinButtonClass("secondary")}>Xem như học sinh</Link>
        <KinButton type="button" variant="secondary" disabled={busy} onClick={onDuplicate}>Nhân bản bài</KinButton>
        <KinButton type="button" variant="danger" disabled={busy} onClick={onDelete}>Xoá bài</KinButton>
      </div>
    </aside>
  );
}

export default function GiaoTrinh({ courseId }: { courseId: string }) {
  const g = useGiaoTrinh(courseId);
  const { ask, dialog } = useKinConfirm();
  const [treeOpen, setTreeOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
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
  const hasLessons = g.lessons.length > 0;
  const cur = g.current;
  const firstChapterId = snap.sections[0]?.chapters[0]?.id ?? null;
  const newChapterId = cur?.chapterId ?? firstChapterId;
  const grouped = cur ? KIND_ORDER.map(k => ({ k, rows: cur.lesson.items.filter(i => i.kind === k) })).filter(x => x.rows.length) : [];

  async function removeItem(it: GtItem) {
    if (!cur) return;
    if (!(await ask({ title: "Gỡ mục này khỏi bài?", message: `“${it.name}” sẽ không còn hiện cho học sinh ở bài này. Tệp đã tải lên KiN vẫn còn trong Thư viện của bạn.`, confirmLabel: "Gỡ khỏi bài" }))) return;
    await g.removeItem(cur.lesson.id, it.key);
  }
  async function removeLesson() {
    if (!cur) return;
    if (!(await ask({ title: `Xoá bài “${cur.lesson.title}”?`, message: "Mọi mục trong bài (link, tài liệu, bài tập tự nộp) sẽ bị xoá cùng. Việc này không hoàn tác được.", confirmLabel: "Xoá bài" }))) return;
    await g.deleteLesson(cur.lesson.id);
  }

  const tree = (
    <nav aria-label="Cây bài của lớp" data-gt-cay className="min-w-0">
      {snap.sections.map((s, si) => (
        <div key={s.id} className="mb-5">
          <div className="flex items-center gap-1">
            <p className="flex-1 min-w-0 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] break-words">{s.title}</p>
            <Arrow dir="up" label={`Đưa phần “${s.title}” lên`} disabled={si === 0 || !!g.busy} onClick={() => g.move("section", s.id, -1)} />
            <Arrow dir="down" label={`Đưa phần “${s.title}” xuống`} disabled={si === snap.sections.length - 1 || !!g.busy} onClick={() => g.move("section", s.id, 1)} />
          </div>
          {s.chapters.map((c, ci) => (
            <div key={c.id} className="mt-2 pl-3 border-l border-[var(--kin-vien-nhat)]">
              <div className="flex items-center gap-1">
                <p className="flex-1 min-w-0 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] break-words">{c.title}</p>
                <Arrow dir="up" label={`Đưa chương “${c.title}” lên`} disabled={ci === 0 || !!g.busy} onClick={() => g.move("chapter", c.id, -1)} />
                <Arrow dir="down" label={`Đưa chương “${c.title}” xuống`} disabled={ci === s.chapters.length - 1 || !!g.busy} onClick={() => g.move("chapter", c.id, 1)} />
              </div>
              <ul>
                {c.lessons.map((l, li) => (
                  <li key={l.id} className="flex items-center gap-1">
                    <button type="button" aria-current={l.id === g.lessonId ? "true" : undefined} onClick={() => { g.setLessonId(l.id); setTreeOpen(false); }}
                      className={`flex-1 min-w-0 min-h-11 flex items-center justify-between gap-2 px-2 rounded-[var(--kin-bo-md)] text-left text-[length:var(--kin-co-goc)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] ${l.id === g.lessonId ? "bg-[var(--kin-nen-dang-chon)] font-medium text-[var(--kin-chu-chinh)]" : "text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
                      <span className="min-w-0 break-words">{l.title}{l.isLocked ? " (khoá)" : ""}</span>
                      <span className="flex-shrink-0 tabular-nums text-[var(--kin-chu-mo)]" aria-label={`${l.items.length} mục`}>{l.items.length}</span>
                    </button>
                    <Arrow dir="up" label={`Đưa bài “${l.title}” lên`} disabled={li === 0 || !!g.busy} onClick={() => g.move("lesson", l.id, -1)} />
                    <Arrow dir="down" label={`Đưa bài “${l.title}” xuống`} disabled={li === c.lessons.length - 1 || !!g.busy} onClick={() => g.move("lesson", l.id, 1)} />
                  </li>
                ))}
              </ul>
              {adding === c.id ? (
                <form className="mt-1 mb-2 flex gap-2" onSubmit={async ev => { ev.preventDefault(); if (await g.addLesson(c.id, addTitle)) { setAdding(null); setAddTitle(""); setTreeOpen(false); } }}>
                  <label htmlFor={`gt-bai-${c.id}`} className="sr-only">Tên bài mới trong {c.title}</label>
                  <input id={`gt-bai-${c.id}`} autoFocus className={KIN_FIELD} value={addTitle} maxLength={120} onChange={e => setAddTitle(e.target.value)} placeholder="Tên bài mới" />
                  <KinButton type="submit" loading={g.busy === `bai:${c.id}`} loadingLabel="Đang thêm…">Thêm</KinButton>
                  <KinButton type="button" variant="ghost" onClick={() => { setAdding(null); setAddTitle(""); }}>Bỏ</KinButton>
                </form>
              ) : (
                <button type="button" onClick={() => { setAdding(c.id); setAddTitle(""); }} className="min-h-11 px-2 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline">+ Bài</button>
              )}
            </div>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <KinPage>
      <KinPageHeader title="Giáo trình" sub={snap.courseName} back={back}
        actions={cur ? <Link href={`${giaoTrinhHref(courseId, true)}/xem/${cur.lesson.id}`} className={kinButtonClass("secondary")}>Xem như học sinh</Link> : undefined} />

      {g.notice && (
        <p role={g.notice.tone === "err" ? "alert" : "status"} data-gt-thong-bao className={`mb-4 text-[length:var(--kin-co-goc)] ${g.notice.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{g.notice.text}</p>
      )}

      {!hasLessons ? (
        <div className="max-w-3xl">
          <KinEmptyState title="Lớp chưa có bài nào">Dán link hoặc thả tệp đầu tiên vào ô bên dưới. KiN sẽ tự tạo Phần 1 › Chương 1 và bài đầu tiên cho bạn.</KinEmptyState>
          <OTaiLen large courseId={courseId} config={snap.config} currentLesson={null} newChapterId={newChapterId}
            onAdd={g.addItem} onUndo={(l, k) => g.removeItem(l, k)} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)_300px] gap-x-[var(--kin-cach-cot)] gap-y-[var(--kin-cach-muc)] items-start">
          <div className="min-w-0">
            <KinButton type="button" variant="secondary" block className="lg:hidden justify-between" aria-expanded={treeOpen} onClick={() => setTreeOpen(o => !o)}
              trailing={<span aria-hidden>{treeOpen ? "▲" : "▼"}</span>}>
              <span className="truncate">{treeOpen ? "Đóng danh sách bài" : `Chọn bài: ${cur?.lesson.title ?? "—"}`}</span>
            </KinButton>
            <div className={`${treeOpen ? "block mt-3" : "hidden"} lg:block`}>
              <div className="max-lg:hidden"><KinSectionHead title="Bài của lớp" as="h2" /></div>
              <div className="lg:mt-3">{tree}</div>
            </div>
          </div>

          <div className="min-w-0 space-y-[var(--kin-cach-muc)]">
            <OTaiLen courseId={courseId} config={snap.config} currentLesson={cur ? { id: cur.lesson.id, title: cur.lesson.title } : null} newChapterId={newChapterId}
              onAdd={g.addItem} onUndo={(l, k) => g.removeItem(l, k)} />

            <section aria-labelledby="gt-muc">
              <KinSectionHead id="gt-muc" title={cur ? `Mục trong bài: ${cur.lesson.title}` : "Mục trong bài"} as="h2" />
              {!cur || grouped.length === 0 ? (
                <KinEmptyState title="Bài này chưa có mục nào">Dán link hoặc thả tệp vào ô phía trên để thêm video, tài liệu, bài tập hoặc buổi live.</KinEmptyState>
              ) : (
                <div className="mt-4 space-y-5">
                  {grouped.map(({ k, rows }) => (
                    <div key={k}>
                      <h3 className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{KIND_LABEL[k]} · {rows.length}</h3>
                      <ul aria-label={KIND_LABEL[k]} className="mt-2 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">
                        {rows.map(it => <ItemRow key={it.key} it={it} courseId={courseId} lessonId={cur.lesson.id} busy={!!g.busy} onRemove={() => void removeItem(it)} />)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {snap.exams.length > 0 && (
              <section aria-labelledby="gt-kt">
                <KinSectionHead id="gt-kt" title={`Bài kiểm tra của lớp · ${snap.exams.length}`} as="h2" />
                <ul className="mt-3 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">
                  {snap.exams.map(e => (
                    <li key={e.key} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--kin-vien-nhat)] last:border-b-0">
                      <span className="min-w-0 break-words text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{e.name}</span>
                      {e.href && <Link href={e.href} className={kinButtonClass("secondary")}>Mở đề</Link>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              Kho tài liệu của bạn: đã dùng {formatMegabytes(snap.config.document.usedBytes)} / {formatMegabytes(snap.config.document.quotaBytes)}. Video chỉ là link tới nơi bạn đăng (YouTube, Drive…) trừ khi KiN bật tải video lên.
            </p>
          </div>

          {cur && <LessonInfo key={cur.lesson.id} lesson={cur.lesson} courseId={courseId} busy={!!g.busy} examCount={snap.exams.length}
            onPatch={(p, ok) => void g.patchLesson(cur.lesson.id, p, ok)} onDuplicate={() => void g.duplicateLesson(cur.chapterId, cur.lesson)} onDelete={() => void removeLesson()} />}
        </div>
      )}
      {dialog}
    </KinPage>
  );
}
