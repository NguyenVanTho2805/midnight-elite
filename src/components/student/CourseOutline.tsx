// Cây nội dung khoá học Phần > Chương > Bài (BU-HS-TRANG-CHU mục 5.3): MỘT component cho trang lớp (variant "page") và thanh bên bài giảng ("rail" 268px từ màn rộng, "sheet" = tờ trượt trên điện thoại).
// Chương xổ ra / thu vào (nút có aria-expanded + aria-controls, mũi tên KinChevron, thân KinFold); thụt cấp rõ bằng token khoảng cách; đếm "x/y bài" từng chương, chương học xong có chữ "Đã xong".
// Ô "Tìm bài trong lớp" lọc bằng filterOutline (bỏ dấu, hoa/thường): đang lọc thì mọi chương còn lại tự mở, đọc kết quả bằng role="status", không khớp thì nói rõ + nút "Xoá từ khoá";
// xoá từ khoá về lại đúng trạng thái mở trước đó (trạng thái mở không bị đụng tới trong lúc lọc). "Mở hết" / "Thu hết" đổi toàn bộ chương (đang lọc thì chỉ các chương còn lại).
// Bài đang học có aria-current; bài khoá aria-disabled, không bấm được và có nhãn CHỮ "Đã khoá". Phần chỉ hiện hàng tiêu đề khi khoá có >1 phần; hàng chương chỉ hiện khi phần đó có >1 chương (outlineShape).
// Trạng thái mở nằm trong component và không lưu: mặc định chỉ mở chương chứa bài đang học / bài kế (initialOpenChapters).
// Móc kiểm thử: [data-outline] (data-outline-variant), [data-outline-section], [data-outline-chapter] (+ aria-expanded), [data-outline-lesson=<id>], [data-outline-title] (chữ tiêu đề từng cấp),
// [data-outline-search], [data-outline-open-all], [data-outline-close-all], [data-outline-clear], [data-outline-status], [data-outline-nomatch].
// Tên bài dài (200 ký tự) xuống dòng, không tràn ngang; mọi hàng / nút / ô nhập cao ≥ 44px.
// LOI-03 (chỉ variant "page", rail/sheet không đổi): mỗi chương là một thẻ có viền, số thứ tự "01", "02"… đếm trong toàn lớp ([data-chapter-no]), mũi tên bên phải;
// dòng bài có biểu tượng ▷, dòng phụ `meta` ([data-lesson-meta], ví dụ "1 tài liệu · Có bài tập · Học Hôm nay · 19:30"), nhãn chữ Đã học / Học tiếp / Đang xem / Chưa học / Đã khoá;
// thanh công cụ có `heading` (dòng "Nội dung lớp: n chương · m bài") và hai nút đổi chữ "Mở rộng tất cả" / "Thu gọn tất cả" (vẫn [data-outline-open-all] / [data-outline-close-all]).
"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { KinChevron, KinFold } from "@/components/kin/Fold";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD } from "@/components/kin/PageLayout";
import { chapterNo } from "@/lib/studentLop";
import { allChapterIds, chapterProgress, filterOutline, initialOpenChapters, outlineShape, type OChapter, type OLesson, type OSection } from "@/lib/lessonOutline";

export interface OutlineLesson extends OLesson { /** Dòng phụ ("Bài tập · 15 phút") — chỉ variant "page" vẽ. */ meta?: string; isFree?: boolean }
export interface OutlineChapter extends OChapter { lessons: OutlineLesson[] }
export interface OutlineSection extends OSection { chapters: OutlineChapter[] }
export type OutlineVariant = "page" | "rail" | "sheet";

export interface CourseOutlineProps {
  sections: OutlineSection[];
  completedIds: ReadonlySet<string>;
  /** Bài đang xem (thanh bên bài giảng): có aria-current="page", nền nhạt + vạch trái. */
  currentId?: string | null;
  /** Bài kế sẽ học (trang lớp): tô như bài đang học, nhãn "Học tiếp". */
  nextId?: string | null;
  /** Bài xem dở: id → giây. Có thì hiện "Đang xem" (bài chưa xong). */
  watching?: Record<string, number>;
  variant: OutlineVariant;
  /** Trang lớp: bài là liên kết. Không truyền thì dùng `onSelect` (thanh bên bài giảng giữ nguyên hành vi chọn bài). */
  hrefFor?: (lessonId: string) => string;
  onSelect?: (lessonId: string) => void;
  /** Tiền tố id cho aria-controls (hai cây cùng lúc trên một trang không được trùng id). */
  idPrefix: string;
  /** Thêm vào dòng nhãn của bài (variant rail / sheet), ví dụ nhãn loại bài. */
  lessonExtra?: (lesson: OutlineLesson) => ReactNode;
  /** Chỉ variant "page": dòng tóm tắt đầu thanh công cụ (cạnh hai nút Mở rộng / Thu gọn). */
  heading?: ReactNode;
  className?: string;
}

const HEADING_CLS = "kin-chu-tieu-de font-semibold text-[var(--kin-chu-chinh)]";

export default function CourseOutline({ sections, completedIds, currentId, nextId, watching, variant, hrefFor, onSelect, idPrefix, lessonExtra, heading, className = "" }: CourseOutlineProps) {
  const page = variant === "page";
  const shape = useMemo(() => outlineShape(sections), [sections]);
  const original = useMemo(() => {
    const m = new Map<string, OutlineChapter>();
    for (const s of sections) for (const c of s.chapters) m.set(c.id, c);
    return m;
  }, [sections]);
  const hasChapterRows = sections.some(s => shape.showChapterIn[s.id]);
  // Số thứ tự chương (variant page): đếm trên các hàng chương của CẢ lớp theo cây gốc, nên lọc / tìm không làm đổi số.
  const chapterNoOf = useMemo(() => {
    const m = new Map<string, string>();
    let i = 0;
    for (const s of sections) if (shape.showChapterIn[s.id]) for (const c of s.chapters) m.set(c.id, chapterNo(i++));
    return m;
  }, [sections, shape]);

  const [open, setOpen] = useState<Set<string>>(() => initialOpenChapters(sections, { currentId, nextId }));
  const [query, setQuery] = useState("");
  const [closedInFilter, setClosedInFilter] = useState<Set<string>>(() => new Set());
  const filtered = useMemo(() => filterOutline(sections, query), [sections, query]);
  const filtering = "openChapterIds" in filtered;
  const shown = filtered.sections as OutlineSection[];

  // Đổi bài đang xem (bấm sang bài khác trong thanh bên) → chương chứa bài đó mở ra. Chỉnh trạng thái ngay trong lúc vẽ (cách React khuyên), không cần effect.
  const [seenCurrent, setSeenCurrent] = useState(currentId);
  if (currentId !== seenCurrent) {
    setSeenCurrent(currentId);
    const hit = currentId ? sections.flatMap(s => s.chapters).find(c => c.lessons.some(l => l.id === currentId)) : undefined;
    if (hit && !open.has(hit.id)) setOpen(new Set(open).add(hit.id));
  }

  const isOpen = (id: string) => (filtering ? !closedInFilter.has(id) : open.has(id));
  const toggle = (id: string) => {
    if (filtering) setClosedInFilter(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    else setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const openAll = () => (filtering ? setClosedInFilter(new Set()) : setOpen(new Set(allChapterIds(sections))));
  const closeAll = () => (filtering ? setClosedInFilter(new Set(filtered.openChapterIds)) : setOpen(new Set()));
  const onQuery = (v: string) => { setQuery(v); setClosedInFilter(new Set()); };

  const noMatch = filtering && filtered.matchedLessons === 0;
  const statusText = !filtering ? "" : noMatch ? "Không tìm thấy bài nào." : `Tìm thấy ${filtered.matchedLessons} bài trong ${filtered.matchedChapters} chương.`;
  const treeId = `${idPrefix}-cay`;

  // Thụt cấp theo token: phần (o0) < chữ chương (o1 + mũi tên) < bài (o2 = o1 + 32px). Trang lớp thụt sâu hơn ở màn rộng, hẹp lại ở 390px.
  const indent = page
    ? "[--o0:var(--kin-kc-5)] [--o1:var(--kin-kc-5)] [--o2:calc(var(--kin-kc-5)_+_var(--kin-kc-9))] md:[--o0:var(--kin-kc-6)] md:[--o1:var(--kin-kc-8)] md:[--o2:calc(var(--kin-kc-8)_+_var(--kin-kc-9))]"
    : "[--o0:var(--kin-kc-6)] [--o1:var(--kin-kc-6)] [--o2:calc(var(--kin-kc-6)_+_var(--kin-kc-9))]";

  const lessonRow = (l: OutlineLesson, inChapter: boolean) => {
    const done = completedIds.has(l.id);
    const isCur = l.id === currentId;
    const isNext = !isCur && l.id === nextId;
    const locked = !!l.isLocked;
    const lit = isCur || isNext;
    const pad = inChapter ? "pl-[var(--o2)]" : "pl-[var(--o1)]";
    const base = `flex w-full text-left min-h-11 pr-[var(--kin-kc-6)] py-[var(--kin-kc-4)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] ${pad}`
      + (lit ? " bg-[var(--kin-nen-nhan)] shadow-[inset_3px_0_0_0_var(--kin-nhan-nen)]" : "");
    const aria = { "aria-current": isCur ? ("page" as const) : isNext ? ("step" as const) : undefined };

    let inner: ReactNode;
    if (page) {
      const label = done ? <KinStatus tone="xong">Đã học</KinStatus> : locked ? <KinStatus tone="mo">Đã khoá</KinStatus> : isNext ? <KinStatus tone="cho">Học tiếp</KinStatus>
        : watching && l.id in watching ? <KinStatus tone="cho">Đang xem</KinStatus> : <KinStatus tone="mo">Chưa học</KinStatus>;
      inner = (
        <span className="flex w-full items-start gap-3 min-h-9">
          <span aria-hidden className="mt-0.5 flex-shrink-0 text-[length:var(--kin-co-phu)] leading-5 text-[var(--kin-chu-mo)]">▷</span>
          <span className="min-w-0 flex-1">
            <span data-outline-title className={`block leading-5 [overflow-wrap:anywhere] ${lit ? "font-semibold" : ""} text-[var(--kin-chu-chinh)]`}>{l.title}</span>
            {l.meta && <span data-lesson-meta className="mt-1 block leading-5 text-[var(--kin-chu-mo)] [overflow-wrap:anywhere]">{l.meta}</span>}
          </span>
          <span className="flex-shrink-0">{label}</span>
        </span>
      );
    } else {
      inner = (
        <span className="flex w-full items-start gap-3">
          <span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2"
            style={{ borderColor: done ? "var(--kin-tt-chu-xong)" : isCur ? "var(--kin-nhan-nen)" : "var(--kin-vien-o-nhap)", background: done ? "var(--kin-tt-chu-xong)" : isCur ? "var(--kin-nhan-nen)" : "transparent" }}>
            {done && <svg viewBox="0 0 10 8" width="8" height="8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--kin-chu-tren-nut-chinh)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span className="min-w-0 flex-1">
            <span data-outline-title className={`block leading-snug [overflow-wrap:anywhere] ${isCur ? "font-bold text-[var(--kin-nhan-link)]" : "font-medium text-[var(--kin-chu-phu)]"}`}>{l.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {lessonExtra?.(l)}
              {locked ? <KinStatus tone="mo">Đã khoá</KinStatus>
                : done ? <KinStatus tone="xong">Đã xong</KinStatus>
                : watching && l.id in watching ? <KinStatus tone="cho">Đang xem</KinStatus> : null}
              {l.isFree && !locked && <span className="text-[length:var(--kin-co-caption)] font-bold text-[var(--kin-tt-chu-xong)]">FREE</span>}
            </span>
          </span>
        </span>
      );
    }

    // Bài khoá: không phải liên kết, không bấm được; vẫn là một hàng đọc được với nhãn chữ "Đã khoá".
    if (locked) return <li key={l.id}><div role="link" aria-disabled="true" data-outline-lesson={l.id} data-locked="" className={`${base} opacity-70 cursor-not-allowed`}>{inner}</div></li>;
    if (hrefFor) return <li key={l.id}><Link href={hrefFor(l.id)} data-outline-lesson={l.id} {...aria} className={`${base} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`}>{inner}</Link></li>;
    return <li key={l.id}><button type="button" onClick={() => onSelect?.(l.id)} data-outline-lesson={l.id} {...aria} className={`${base} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`}>{inner}</button></li>;
  };

  const openAllLabel = page ? "Mở rộng tất cả" : "Mở hết";
  const closeAllLabel = page ? "Thu gọn tất cả" : "Thu hết";
  const searchBox = (
    <div className={`relative min-w-0 flex-1 ${page ? "md:col-span-2 md:row-start-2" : ""}`}>
      <label htmlFor={`${idPrefix}-tim`} className="sr-only">Tìm bài trong lớp</label>
      <input id={`${idPrefix}-tim`} data-outline-search type="search" value={query} autoComplete="off" maxLength={100}
        placeholder="Gõ tên bài hoặc tên chương" aria-describedby={`${idPrefix}-trang-thai`}
        onChange={e => onQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape" && query) onQuery(""); }}
        className={`${KIN_FIELD} pr-16 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden`} />
      {query !== "" && !noMatch && (
        <button type="button" data-outline-clear aria-label="Xoá ô tìm kiếm" onClick={() => onQuery("")}
          className="absolute right-0 top-0 h-11 min-w-11 px-3 text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-nhan-link)] hover:underline">Xoá</button>
      )}
    </div>
  );
  const allButtons = hasChapterRows && (
    <div className={`flex gap-3 ${page ? "md:col-start-2 md:row-start-1" : ""}`}>
      <button type="button" data-outline-open-all onClick={openAll} className={`${kinButtonClass("secondary")} flex-1 md:flex-none`}>{openAllLabel}</button>
      <button type="button" data-outline-close-all onClick={closeAll} className={`${kinButtonClass("secondary")} flex-1 md:flex-none`}>{closeAllLabel}</button>
    </div>
  );
  const toolbar = (
    <div data-outline-toolbar className={`${page ? "sticky top-0 md:static z-10 pb-3 pt-1" : variant === "sheet" ? "sticky top-0 z-10 pb-3 pt-1 px-[var(--kin-kc-5)]" : "flex-shrink-0 px-[var(--kin-kc-5)] pb-3 pt-3"} bg-[var(--kin-nen-trang)]`}>
      {page ? (
        // Trang lớp: điện thoại = tóm tắt → ô tìm → hai nút (cạnh nhau, dưới ô tìm); màn rộng = [tóm tắt | hai nút] rồi ô tìm cả hàng dưới.
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          {heading && <div className="min-w-0 md:col-start-1 md:row-start-1">{heading}</div>}
          {searchBox}
          {allButtons}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {searchBox}
          {allButtons}
        </div>
      )}
      <p id={`${idPrefix}-trang-thai`} role="status" data-outline-status className={statusText ? "mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" : "sr-only"}>{statusText}</p>
    </div>
  );

  const tree = noMatch ? (
    <div data-outline-nomatch>
      <KinEmptyState title={<>Không có bài nào khớp “{query.trim()}”.</>} action={<button type="button" data-outline-clear onClick={() => onQuery("")} className={kinButtonClass("secondary")}>Xoá từ khoá</button>}>
        Thử gõ ít chữ hơn, hoặc chỉ một phần tên bài hay tên chương.
      </KinEmptyState>
    </div>
  ) : (
    <div id={treeId} data-outline-tree>
      {shown.map(s => {
        const origLessons = (sections.find(x => x.id === s.id)?.chapters ?? []).flatMap(c => c.lessons);
        const secDone = origLessons.filter(l => completedIds.has(l.id)).length;
        const chaptered = !!shape.showChapterIn[s.id];
        return (
          <section key={s.id} data-outline-section={s.id}>
            {shape.showSection && (
              <h3 className="flex min-h-12 items-center justify-between gap-3 border-y border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-bang)] pl-[var(--o0)] pr-[var(--kin-kc-6)] py-[var(--kin-kc-3)]">
                <span data-outline-title className={`min-w-0 text-[length:var(--kin-co-goc)] [overflow-wrap:anywhere] ${HEADING_CLS}`}>{s.title}</span>
                <span className="flex-shrink-0 text-[length:var(--kin-co-goc)] font-normal text-[var(--kin-chu-mo)]">{secDone}/{origLessons.length} bài</span>
              </h3>
            )}
            {s.chapters.map(c => {
              if (!chaptered) return <ul key={c.id}>{c.lessons.map(l => lessonRow(l, false))}</ul>;
              const prog = chapterProgress(original.get(c.id) ?? c, completedIds);
              const expanded = isOpen(c.id);
              const panelId = `${idPrefix}-ch-${c.id}`;
              if (page) {
                const no = chapterNoOf.get(c.id) ?? "";
                return (
                  <div key={c.id} data-outline-chapter-wrap={c.id} className="mt-3 overflow-hidden rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
                    <h4>
                      <button type="button" data-outline-chapter={c.id} aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(c.id)}
                        className={`flex w-full min-h-14 items-center justify-between gap-3 pl-[var(--o1)] pr-[var(--kin-kc-6)] py-[var(--kin-kc-4)] text-left hover:bg-[var(--kin-nen-re-chuot)] transition-colors ${expanded ? "border-b border-[var(--kin-vien-nhat)]" : ""}`}>
                        <span className="flex min-w-0 items-baseline gap-2">
                          {no && <span data-chapter-no={no} className="flex-shrink-0 text-[length:var(--kin-co-goc)] font-semibold tabular-nums text-[var(--kin-nhan-link)]">{no}</span>}
                          <span data-outline-title className="min-w-0 text-[length:var(--kin-co-goc)] font-semibold [overflow-wrap:anywhere] text-[var(--kin-chu-chinh)]">{c.title}</span>
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-x-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                          <span className="flex flex-wrap items-center justify-end gap-x-2">
                            <span className="tabular-nums">{prog.done}/{prog.total} bài</span>
                            {prog.complete && <span data-outline-done className="font-semibold text-[var(--kin-tt-chu-xong)]">Đã xong</span>}
                          </span>
                          <KinChevron open={expanded} />
                        </span>
                      </button>
                    </h4>
                    <KinFold open={expanded} id={panelId}><ul className="[&>li:last-child>*]:border-b-0">{c.lessons.map(l => lessonRow(l, true))}</ul></KinFold>
                  </div>
                );
              }
              return (
                <div key={c.id} data-outline-chapter-wrap={c.id}>
                  <h4>
                    <button type="button" data-outline-chapter={c.id} aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(c.id)}
                      className="flex w-full min-h-11 items-center justify-between gap-3 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] pl-[var(--o1)] pr-[var(--kin-kc-6)] py-[var(--kin-kc-3)] text-left hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex-shrink-0 text-[var(--kin-chu-mo)]"><KinChevron open={expanded} /></span>
                        <span data-outline-title className={`min-w-0 text-[length:var(--kin-co-goc)] font-medium [overflow-wrap:anywhere] ${expanded ? "text-[var(--kin-chu-chinh)]" : "text-[var(--kin-chu-phu)]"}`}>{c.title}</span>
                      </span>
                      <span className="flex flex-shrink-0 flex-wrap items-center justify-end gap-x-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                        <span>{prog.done}/{prog.total} bài</span>
                        {prog.complete && <span data-outline-done className="font-semibold text-[var(--kin-tt-chu-xong)]">Đã xong</span>}
                      </span>
                    </button>
                  </h4>
                  <KinFold open={expanded} id={panelId}><ul>{c.lessons.map(l => lessonRow(l, true))}</ul></KinFold>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );

  // Rail: vùng cây cuộn riêng, thanh công cụ đứng yên; sheet: cả tờ cuộn ở ngoài, thanh công cụ dính đầu tờ; page: cuộn theo trang.
  return (
    <div data-outline data-outline-variant={variant} className={`${indent} min-w-0 ${variant === "rail" ? "flex min-h-0 flex-col" : ""} ${className}`}>
      {toolbar}
      {variant === "rail" ? <div className="min-h-0 flex-1 overflow-y-auto">{tree}</div> : tree}
    </div>
  );
}
