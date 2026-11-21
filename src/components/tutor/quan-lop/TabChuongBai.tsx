// GS-LOP-GON → LOI-02 (11/11/2026) — thân tab "Bài học" của lớp gia sư: cây Phần · Chương · Bài + panel "Thêm / Sửa bài học" (cắt từ admin/khoa-hoc/[id]/page.tsx ở GS-LOP-GON).
// Khác bản gốc: (1) tệp tài liệu tải NGAY khi thả (DocumentsEditor + upload/OThaTep) nên không còn `pendingDocuments`;
// (2) đóng panel không Lưu ⇒ xoá best-effort các tệp vừa tải trong phiên panel đó (không để tệp mồ côi); (3) `canUpload`: chỉ chủ lớp tải được (API init chặn người khác).
// LOI-02 (đặc tả docs/kin/phong-ban/dac-ta/LOI-02.md mục 2.A7, 2.A8, 2.C, 4.1–4.3):
//  - Panel bỏ ô "Link phòng Zoom": zoomUrls vẫn nạp từ bài nhưng KHÔNG gửi khoá zoomUrl (PUT chỉ ghi khoá có mặt ⇒ link cũ còn nguyên; type vẫn tính cả zoomUrls ⇒ bài cũ giữ "Live").
//    Bài có Zoom cũ: một dòng chỉ đọc. Thứ tự khối: Tên → Ngày học → Trạng thái → Khoá / Học thử → Tài liệu (ô thả) → Thêm link (gập) → Zoom cũ → Azota / Bài tập tự nộp → Ghi chú → Xem như học sinh.
//  - Ngày học (giờ VN): hai ô date + time, "Bỏ ngày"; lưu `scheduledAt` (ISO hoặc null) qua PUT / POST. Nhân bản KHÔNG chép ngày (bài sao là buổi khác).
//  - Trạng thái (Đã đăng · Nháp · Ẩn) đổi bằng PATCH …/giao-trinh/trang-thai (luật G4), KHÔNG qua PUT bài. Lỗi đổi trạng thái: giữ phần đã lưu, báo riêng.
//    Bài MỚI chỉ Đã đăng · Nháp, gửi thẳng trong POST (không POST-rồi-PATCH). Nhân bản bài Nháp / Ẩn ⇒ bản sao Nháp.
//  - Hàng bài: chip CHỮ "Nháp · học sinh chưa thấy" / "Ẩn · học sinh không thấy" (TRẺ EM), chip ngày bấm được, "Sửa nhanh" (tên + ngày + giờ ngay trong hàng, Enter lưu, Esc huỷ),
//    "Chi tiết…" mở panel. Cuối chương "+ Thêm bài" cùng form một dòng (thêm nhanh = Đã đăng như cây cũ). Lớp rỗng ⇒ "Tạo chương đầu tiên".
//  - Hàng chương giữ "Giao cho giáo viên" (GiaoChoNhom, TUT-dong-giang) — trước chỉ có ở màn Giáo trình phẳng; chỉ hiện khi lớp có giáo viên bộ môn hoặc chương đã giao.
//  - 390: hàng bài 3 dòng (tên / chip / nút ≥ 44px), ẩn tay kéo; không cuộn ngang. Xoá hỏi bằng KinConfirm (không window.confirm / alert).
// SCL-G-GS (QUYET-DINH §2.2, khung Figma 731:2): ≥1024px hai cột — trái "Cần bạn xử lý" (máy chủ vẽ, `todo`) + danh sách Chương › Bài hàng mảnh có cột
//   "Video 42 phút" · "Nộp 4/12" · trạng thái chấm; phải ngăn "Sửa bài" LUÔN MỞ (Drawer inline, mở sẵn bài mới nhất). Lớp chỉ có 1 phần thì ẩn tầng Phần.
//   "+ Bài" đầu danh sách thêm vào chương mới nhất. Sửa bài TỰ LƯU (PUT như nút Lưu, không gồm trạng thái) sau 1,5 giây ngừng gõ — "Đã tự lưu lúc HH:MM".
//   Không còn nút nền navy trong cây (nút chính của màn là "+ Giao bài" ở đầu lớp). Dữ liệu Phần › Chương › Bài KHÔNG đổi.
"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { SlotLinkEditor, AzotaStatusTable } from "@/components/media/TutorLessonMedia";
import { YOUTUBE_UNLISTED_NOTE, type MediaSlot } from "@/lib/mediaLink";
import { KinButton } from "@/components/kin/Button";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinConfirm } from "@/components/kin/Confirm";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinFold, KinChevron } from "@/components/kin/Fold";
import { KinStatus, KinGradeStatus } from "@/components/kin/Status";
import { videoText, nopText } from "@/lib/lopViec";
import type { LessonStat } from "@/lib/lopViecServer";
import { parseYoutubeId, thumbUrl } from "@/lib/youtubeLink";
import { KinSelect } from "@/components/kin/KinSelect";
import { baiHocHref } from "@/lib/tutorRoutes";
import { parseVnDateTime, isoToVnParts, formatVnLessonWhen } from "@/lib/tutorLessonDate";
import { Drawer } from "./DrawerBaiHoc";
import { DocumentsEditor, type DocItem } from "./DocumentsEditor";
import { AssignmentEditor } from "./AssignmentEditor";
import GiaoChoNhom, { useGiaoVienLop } from "@/components/tutor/giao-trinh/GiaoChoNhom";
import {
  type SectionDB, type ChapterDB, type LessonDB, type PanelMode, type DelTarget, type LsForm, type LessonStatusValue, INIT_LS,
  parseUrls, serializeUrls, firstBadLink, deriveTypes, serializeTypes,
  LESSON_STATUS_OPTIONS, LESSON_STATUS_CHIP, lessonStatusOf,
} from "./lessonForm";

type DragState =
  | { type: "section"; sectionIdx: number }
  | { type: "chapter"; sectionIdx: number; chapterIdx: number }
  | { type: "lesson"; sectionIdx: number; chapterIdx: number; lessonIdx: number };

/** Form một dòng ngay trong cây: sửa nhanh một bài, hoặc thêm bài cuối chương. */
type Quick =
  | { mode: "edit"; sectionId: string; chapterId: string; lessonId: string }
  | { mode: "add"; sectionId: string; chapterId: string };

/** Luật chuyển trạng thái G4 (lessonStatus.canTransition): nháp → đăng; đăng → ẩn; ẩn → đăng / nháp. Đứng yên luôn được. */
function statusAllowed(from: LessonStatusValue, to: LessonStatusValue): boolean {
  if (from === to) return true;
  return (from === "draft" && to === "published") || (from === "published" && to === "hidden") || (from === "hidden" && (to === "published" || to === "draft"));
}

// ≥1024px: ngăn sửa nằm cạnh danh sách (inline). Máy chủ / lần vẽ đầu coi là điện thoại.
const DESKTOP_MQ = "(min-width: 1024px)";
const subscribeMq = (cb: () => void) => { const m = window.matchMedia(DESKTOP_MQ); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useDesktop = () => useSyncExternalStore(subscribeMq, () => window.matchMedia(DESKTOP_MQ).matches, () => false);
const docCount = (raw: string | null | undefined) => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v.length : 0; } catch { return 0; } };
/** Khoá so sánh của tự lưu: mọi ô của ngăn trừ trạng thái (trạng thái đổi qua PATCH khi bấm Lưu). */
const autoKey = (f: LsForm) => JSON.stringify({ ...f, status: null });
const hhmm = (d: Date) => new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(d);

/** Logo YouTube một màu (không đỏ: đỏ chỉ dành cho lỗi / quá hạn). Trang trí, đã có chữ "Link YouTube". */
function YoutubeMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="flex-shrink-0">
      <rect x="2" y="5" width="20" height="14" rx="4" fill="var(--kin-chu-chinh)" />
      <path d="M10 9v6l5-3z" fill="var(--kin-nen-trang)" />
    </svg>
  );
}

function DragHandle() {
  return (
    <svg viewBox="0 0 10 16" className="w-2.5 h-4 flex-shrink-0 cursor-grab active:cursor-grabbing" fill="var(--kin-chu-mo)" aria-hidden>
      <circle cx="3" cy="3" r="1.4"/><circle cx="7" cy="3" r="1.4"/>
      <circle cx="3" cy="8" r="1.4"/><circle cx="7" cy="8" r="1.4"/>
      <circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/>
    </svg>
  );
}

const SMALL_BTN = "inline-flex items-center justify-center min-h-11 px-3 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-phu)] font-medium transition-colors";
const BTN_LINE = `${SMALL_BTN} border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)]`;
const BTN_TEXT = `${SMALL_BTN} text-[var(--kin-nhan-link)] hover:bg-[var(--kin-nen-re-chuot)]`;
const BTN_DANGER = `${SMALL_BTN} text-[var(--kin-tt-chu-loi)] hover:bg-[var(--kin-tt-nen-loi)]`;
const ICON_BTN = "inline-flex items-center justify-center w-11 h-11 rounded-[var(--kin-bo-md)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors flex-shrink-0";
const CHIP = "inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium";
const FIELD = "w-full min-h-11 px-3 text-sm rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] outline-none focus:border-[var(--kin-nhan-link)] placeholder:text-[var(--kin-chu-mo)]";

/** Nút "⋯" của hàng bài: Sao chép bài · Xoá bài. Đóng khi bấm ngoài / Esc / chọn. */
function LessonMenu({ title, onCopy, onDelete, disabled }: { title: string; onCopy: () => void; onDelete: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={box} className="relative" onKeyDown={e => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } }}>
      <button ref={btn} type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={`Thêm thao tác cho bài "${title}"`}
        className={`${ICON_BTN} text-[var(--kin-chu-mo)]`}>⋯</button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-44 max-w-[calc(100vw-2rem)] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] py-1 shadow-[var(--kin-bong-noi)]">
          <button type="button" role="menuitem" disabled={disabled} onClick={() => { setOpen(false); onCopy(); }}
            className="flex w-full min-h-11 items-center px-3 text-left text-sm text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] disabled:opacity-45">Sao chép bài</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full min-h-11 items-center px-3 text-left text-sm text-[var(--kin-tt-chu-loi)] hover:bg-[var(--kin-tt-nen-loi)]">Xoá bài</button>
        </div>
      )}
    </div>
  );
}

export function TabChuongBai({ courseSlug, initialSections, canUpload = false, stats = {}, todo }: {
  courseSlug: string; initialSections: SectionDB[];
  /** Chỉ chủ lớp tải được tệp lên KiN (API init trả 403 với người khác). */ canUpload?: boolean;
  /** SCL-G-GS: số liệu nộp bài theo bài (cột "Nộp x/y"). */ stats?: Record<string, LessonStat>;
  /** SCL-G-GS: khối "Cần bạn xử lý" của lớp, đầu cột trái. */ todo?: ReactNode;
}) {
  const desktop = useDesktop();
  const [sections, setSections] = useState<SectionDB[]>(initialSections);
  const [expanded, setExpanded] = useState<{ sections: Set<string>; chapters: Set<string> }>({
    sections: new Set(initialSections.map(s => s.id)),
    chapters: new Set(initialSections.flatMap(s => s.chapters.map(c => c.id))),
  });
  const [panel,       setPanel]      = useState<PanelMode>({ type: "none" });
  const [del,         setDel]        = useState<DelTarget>(null);
  const [deleting,    setDeleting]   = useState(false);
  const [toast,       setToast]      = useState<{ text: string; tone: "xong" | "loi" } | null>(null);
  const [saving,      setSaving]     = useState(false);
  const [title,       setTitle]      = useState("");
  const [ls,          setLs]         = useState<LsForm>(INIT_LS);
  const [origStatus,  setOrigStatus] = useState<LessonStatusValue>("published");
  const [panelErr,    setPanelErr]   = useState<string | null>(null);
  const [statusNote,  setStatusNote] = useState<string | null>(null);
  const [dateErr,     setDateErr]    = useState<string | null>(null);
  const [linksOpen,   setLinksOpen]  = useState(false);
  const [dragItem,    setDragItem]   = useState<DragState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [quick,       setQuick]      = useState<Quick | null>(null);
  const [qTitle,      setQTitle]     = useState("");
  const [qDate,       setQDate]      = useState("");
  const [qTime,       setQTime]      = useState("");
  const [qErr,        setQErr]       = useState<string | null>(null);
  const [qSaving,     setQSaving]    = useState(false);
  const [creatingFirst, setCreatingFirst] = useState(false);
  const prevSections = useRef<SectionDB[]>([]);
  // Mã tệp vừa tải lên trong phiên panel đang mở (để xoá nếu đóng không Lưu / bỏ khỏi danh sách), và có tệp đang lên không.
  const sessionUploads = useRef<string[]>([]);
  // Q2 chủ chốt (14/11): "Lưu và thêm bài tập" — bài mới lưu xong panel KHÔNG đóng mà thành "Sửa bài học" để soạn bài tập ngay trên cùng màn.
  const stayAfterAdd = useRef(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gv = useGiaoVienLop(courseSlug);
  // Tự lưu (chỉ "Sửa bài học"): `autoBase` = khoá của lần lưu cuối; khác thì chờ 1,5 giây rồi PUT.
  const autoBase = useRef("");
  const autoBusy = useRef(false);
  const [autoSave, setAutoSave] = useState<{ phase: "cho" | "dang" | "xong" | "loi"; at?: string }>({ phase: "cho" });
  /** Sau khi giao chương: đọc lại teacherId của các chương (một lần tải lớp, không đụng phần khác của cây). */
  async function reloadChapterTeachers() {
    const r = await fetch(`/api/courses/${encodeURIComponent(courseSlug)}`, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
    if (!r || !r.ok) return;
    const c = await r.json().catch(() => null) as { sections?: SectionDB[] } | null;
    const map = new Map<string, string | null>();
    for (const s of c?.sections ?? []) for (const ch of s.chapters) map.set(ch.id, ch.teacherId ?? null);
    setSections(p => p.map(s => ({ ...s, chapters: s.chapters.map(ch => map.has(ch.id) ? { ...ch, teacherId: map.get(ch.id) } : ch) })));
  }

  function flash(text: string, tone: "xong" | "loi" = "xong") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), tone === "loi" ? 6000 : 2500);
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function reorderSections(fromIdx: number, toIdx: number) {
    prevSections.current = sections;
    const arr = [...sections];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setSections(arr);
    const items = arr.map((s, i) => ({ id: s.id, order: i + 1 }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "section", items }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác", "loi"); } });
  }

  function reorderChapters(sectionIdx: number, fromIdx: number, toIdx: number) {
    prevSections.current = sections;
    const arr = sections.map((s, si) => {
      if (si !== sectionIdx) return s;
      const chs = [...s.chapters];
      const [moved] = chs.splice(fromIdx, 1);
      chs.splice(toIdx, 0, moved);
      return { ...s, chapters: chs };
    });
    setSections(arr);
    const items = arr[sectionIdx].chapters.map((c, i) => ({ id: c.id, order: i + 1 }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chapter", items }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác", "loi"); } });
  }

  function reorderLessons(sectionIdx: number, chapterIdx: number, fromIdx: number, toIdx: number) {
    prevSections.current = sections;
    const arr = sections.map((s, si) => {
      if (si !== sectionIdx) return s;
      return {
        ...s,
        chapters: s.chapters.map((c, ci) => {
          if (ci !== chapterIdx) return c;
          const lss = [...c.lessons];
          const [moved] = lss.splice(fromIdx, 1);
          lss.splice(toIdx, 0, moved);
          return { ...c, lessons: lss };
        }),
      };
    });
    setSections(arr);
    const items = arr[sectionIdx].chapters[chapterIdx].lessons.map((l, i) => ({ id: l.id, order: i + 1 }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lesson", items }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác", "loi"); } });
  }

  function moveChapterAcross(fromSI: number, fromCI: number, toSI: number, toCI: number) {
    if (fromSI === toSI) { reorderChapters(fromSI, fromCI, toCI); return; }
    prevSections.current = sections;
    const arr = sections.map(s => ({ ...s, chapters: [...s.chapters] }));
    const [moved] = arr[fromSI].chapters.splice(fromCI, 1);
    arr[toSI].chapters.splice(toCI, 0, moved);
    setSections(arr);
    const fromItems = arr[fromSI].chapters.map((c, i) => ({ id: c.id, order: i + 1 }));
    const toItems   = arr[toSI].chapters.map((c, i) => ({ id: c.id, order: i + 1, ...(c.id === moved.id ? { parentId: arr[toSI].id } : {}) }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chapter", items: [...fromItems, ...toItems] }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi di chuyển chương", "loi"); } });
  }

  function moveLessonAcross(fromSI: number, fromCI: number, fromLI: number, toSI: number, toCI: number, toLI: number) {
    if (fromSI === toSI && fromCI === toCI) { reorderLessons(fromSI, fromCI, fromLI, toLI); return; }
    prevSections.current = sections;
    const arr = sections.map(s => ({ ...s, chapters: s.chapters.map(c => ({ ...c, lessons: [...c.lessons] })) }));
    const [moved] = arr[fromSI].chapters[fromCI].lessons.splice(fromLI, 1);
    arr[toSI].chapters[toCI].lessons.splice(toLI, 0, moved);
    setSections(arr);
    const fromItems = arr[fromSI].chapters[fromCI].lessons.map((l, i) => ({ id: l.id, order: i + 1 }));
    const toItems   = arr[toSI].chapters[toCI].lessons.map((l, i) => ({ id: l.id, order: i + 1, ...(l.id === moved.id ? { parentId: arr[toSI].chapters[toCI].id } : {}) }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lesson", items: [...fromItems, ...toItems] }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi di chuyển bài học", "loi"); } });
  }

  // Nhân bản: KHÔNG chép scheduledAt (bài sao là buổi khác). Link Zoom cũ được chép theo (giữ nguyên nội dung bài gốc).
  // TRẺ EM: bài gốc Nháp / Ẩn ⇒ bản sao là Nháp (gửi thẳng trong POST — POST chỉ nhận "draft"), không để bản sao thành Đã đăng cho học sinh thấy ngay.
  const copyStatus = (l: LessonDB) => (lessonStatusOf(l.status) === "published" ? {} : { status: "draft" as const });
  async function duplicateChapter(sectionId: string, chapterId: string) {
    const sec = sections.find(s => s.id === sectionId)!;
    const ch  = sec.chapters.find(c => c.id === chapterId)!;
    setSaving(true);
    try {
      const newCh = await apiPost<ChapterDB>(`/api/sections/${sectionId}/chapters`, { title: `${ch.title} (bản sao)` });
      const newLessons: LessonDB[] = [];
      for (const l of ch.lessons) {
        const nl = await apiPost<LessonDB>(`/api/chapters/${newCh.id}/lessons`, {
          title: l.title, type: l.type,
          videoUrl: l.videoUrl, zoomUrl: l.zoomUrl, azotaUrl: l.azotaUrl,
          azotaDeadline: l.azotaDeadline, duration: l.duration,
          isLocked: l.isLocked, isFree: l.isFree,
          documents: l.documents, adminNote: l.adminNote,
          ...copyStatus(l),
        });
        newLessons.push(nl);
      }
      setSections(p => p.map(s => s.id === sectionId
        ? { ...s, chapters: [...s.chapters, { ...newCh, lessons: newLessons }] } : s));
      setExpanded(p => ({ ...p, chapters: new Set([...p.chapters, newCh.id]) }));
      flash(`Đã sao chép chương "${ch.title}"`);
    } catch (e: unknown) {
      flash((e as Error).message ?? "Lỗi sao chép chương", "loi");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateLesson(sectionId: string, chapterId: string, lessonId: string) {
    const sec = sections.find(s => s.id === sectionId)!;
    const ch  = sec.chapters.find(c => c.id === chapterId)!;
    const l   = ch.lessons.find(x => x.id === lessonId)!;
    setSaving(true);
    try {
      const nl = await apiPost<LessonDB>(`/api/chapters/${chapterId}/lessons`, {
        title: `${l.title} (bản sao)`, type: l.type,
        videoUrl: l.videoUrl, zoomUrl: l.zoomUrl, azotaUrl: l.azotaUrl,
        azotaDeadline: l.azotaDeadline, duration: l.duration,
        isLocked: l.isLocked, isFree: l.isFree,
        documents: l.documents, adminNote: l.adminNote,
        ...copyStatus(l),
      });
      setSections(p => p.map(s => s.id === sectionId
        ? { ...s, chapters: s.chapters.map(c => c.id === chapterId
            ? { ...c, lessons: [...c.lessons, nl] } : c) } : s));
      flash(`Đã sao chép bài "${l.title}"`);
    } catch (e: unknown) {
      flash((e as Error).message ?? "Lỗi sao chép bài", "loi");
    } finally {
      setSaving(false);
    }
  }

  function toggleSec(id: string) {
    setExpanded(p => { const s = new Set(p.sections); if (s.has(id)) s.delete(id); else s.add(id); return { ...p, sections: s }; });
  }
  function toggleCh(id: string) {
    setExpanded(p => { const c = new Set(p.chapters); if (c.has(id)) c.delete(id); else c.add(id); return { ...p, chapters: c }; });
  }

  // ── Mở panel ──
  function resetPanelNotes() { setPanelErr(null); setStatusNote(null); setDateErr(null); }
  function openAddSection() { resetPanelNotes(); setTitle(""); setPanel({ type: "add-section" }); }
  function openEditSection(sectionId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    resetPanelNotes(); setTitle(s.title);
    setPanel({ type: "edit-section", sectionId });
  }
  function openAddChapter(sectionId: string) { resetPanelNotes(); setTitle(""); setPanel({ type: "add-chapter", sectionId }); }
  function openEditChapter(sectionId: string, chapterId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    resetPanelNotes(); setTitle(c.title);
    setPanel({ type: "edit-chapter", sectionId, chapterId });
  }
  function openAddLesson(sectionId: string, chapterId: string, prefill?: { title: string; date: string; time: string }) {
    sessionUploads.current = []; resetPanelNotes();
    setLs({ ...INIT_LS, title: prefill?.title ?? "", scheduledDate: prefill?.date ?? "", scheduledTime: prefill?.time ?? "" });
    setOrigStatus("published"); setLinksOpen(false);
    setPanel({ type: "add-lesson", sectionId, chapterId });
  }
  function openEditLesson(sectionId: string, chapterId: string, lessonId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    const l = c.lessons.find(x => x.id === lessonId)!;
    sessionUploads.current = []; resetPanelNotes(); setQuick(null);
    const when = isoToVnParts(l.scheduledAt);
    const st = lessonStatusOf(l.status);
    const videoUrls = parseUrls(l.videoUrl), azotaUrls = parseUrls(l.azotaUrl);
    const form: LsForm = {
      title: l.title,
      videoUrls, zoomUrls: parseUrls(l.zoomUrl),
      azotaUrls, azotaDeadline: l.azotaDeadline ?? "",
      duration: l.duration ?? "", isLocked: l.isLocked, isFree: l.isFree,
      documentsRaw: l.documents ?? "[]",
      adminNote: l.adminNote ?? "",
      scheduledDate: when.date, scheduledTime: when.time, status: st,
    };
    setLs(form);
    setOrigStatus(st);
    autoBase.current = autoKey(form);
    setAutoSave({ phase: "cho" });
    setLinksOpen(false); // SCL-D: "Tuỳ chọn khác" gập sẵn — ngăn chỉ còn Tên · Video · Tài liệu.
    setPanel({ type: "edit-lesson", sectionId, chapterId, lessonId });
  }

  // Helper: throw nếu response không OK (tránh dùng error response như data thật)
  async function safeFetch(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON response */ }
    return { res, data };
  }
  const errOf = (res: Response, data: Record<string, unknown>) =>
    res.status === 401 ? "Phiên đăng nhập hết hạn. Cô đăng nhập lại rồi thử lại." : ((data.error as string) ?? (data.detail as string) ?? `Lỗi ${res.status}`);

  async function apiPost<T>(url: string, body: unknown): Promise<T> {
    const { res, data } = await safeFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(errOf(res, data));
    return data as T;
  }
  async function apiPut(url: string, body: unknown): Promise<void> {
    const { res, data } = await safeFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(errOf(res, data));
  }
  /** Đổi trạng thái MỘT bài qua G5. null = đã đổi; chuỗi = câu lỗi (máy chủ). */
  async function patchStatus(lessonId: string, status: LessonStatusValue): Promise<string | null> {
    try {
      const { res, data } = await safeFetch(`/api/tutor/lop/${encodeURIComponent(courseSlug)}/giao-trinh/trang-thai`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonIds: [lessonId], status }),
      });
      if (!res.ok) return errOf(res, data);
      const skipped = Array.isArray(data.skipped) ? (data.skipped as { id: string; reason: string }[]) : [];
      const s = skipped.find(x => x.id === lessonId);
      return s && s.reason !== "Đã ở trạng thái này." ? s.reason : null;
    } catch { return "Mất kết nối."; }
  }
  const setLessonLocal = (sectionId: string, chapterId: string, lessonId: string, patch: Partial<LessonDB>) =>
    setSections(p => p.map(s => s.id !== sectionId ? s : {
      ...s, chapters: s.chapters.map(c => c.id !== chapterId ? c : { ...c, lessons: c.lessons.map(l => l.id === lessonId ? { ...l, ...patch } : l) }),
    }));
  const addLessonLocal = (sectionId: string, chapterId: string, lesson: LessonDB) =>
    setSections(p => p.map(s => s.id !== sectionId ? s : { ...s, chapters: s.chapters.map(c => c.id !== chapterId ? c : { ...c, lessons: [...c.lessons, lesson] }) }));

  // ── Đóng panel / dọn tệp mồ côi ──
  // Tệp tài liệu lên NGAY khi thả (đã `complete`), nên đóng panel mà không Lưu sẽ để lại FileAsset không thuộc bài nào. Không có API quét nền:
  // xoá best-effort tại đây (lỗi xoá bị bỏ qua); phần còn sót vẫn nằm ở "Thư viện của tôi" và tính vào hạn mức.
  function discardUploads(keepIn?: string) {
    const ids = sessionUploads.current; sessionUploads.current = [];
    for (const id of ids) {
      if (keepIn && keepIn.includes(`/api/media/${id}/file`)) continue;
      void fetch(`/api/media/document/${id}`, { method: "DELETE", credentials: "same-origin" }).catch(() => {});
    }
  }
  function closePanel() { discardUploads(); setPanel({ type: "none" }); }

  // Danh sách tài liệu chuẩn hoá (tệp tải lên lúc thả + tài liệu cũ dạng link).
  function documentsJson(f: LsForm = ls): string {
    const existing: DocItem[] = (() => { try { return JSON.parse(f.documentsRaw || "[]"); } catch { return []; } })();
    return JSON.stringify(existing);
  }

  /** Thân PUT / POST của một bài từ ô của ngăn (dùng chung nút Lưu và tự lưu). */
  function buildLesson(f: LsForm) {
    if (!f.title.trim()) return { ok: false as const, field: "title", error: "Nhập tên bài học." };
    const when = parseVnDateTime(f.scheduledDate, f.scheduledTime);
    if (!when.ok) return { ok: false as const, field: "date", error: when.error };
    const bad = firstBadLink(f);
    if (bad) return { ok: false as const, field: "link", error: bad };
    const type = serializeTypes(deriveTypes(f.videoUrls, f.zoomUrls, f.azotaUrls)); // zoomUrls cũ vẫn tính ⇒ bài cũ giữ nhãn "Live"
    // KHÔNG có khoá zoomUrl: PUT chỉ ghi khoá có mặt ⇒ link Zoom cũ còn nguyên; POST bài mới không có Zoom.
    const common = {
      title: f.title.trim(), type, videoUrl: serializeUrls(f.videoUrls), azotaUrl: serializeUrls(f.azotaUrls), azotaDeadline: f.azotaDeadline || null,
      duration: f.duration || null, isLocked: f.isLocked, isFree: f.isFree, documents: documentsJson(f), adminNote: f.adminNote || null,
      scheduledAt: when.iso,
    };
    return { ok: true as const, common, type, when };
  }

  // Máy tính: ngăn "Sửa bài" luôn mở ⇒ lần đầu thấy màn rộng thì mở sẵn bài cuối của chương mới nhất (chương cuối có bài).
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!desktop || autoOpened.current || panel.type !== "none") return;
    autoOpened.current = true;
    for (let si = sections.length - 1; si >= 0; si--) for (let ci = sections[si].chapters.length - 1; ci >= 0; ci--) {
      const ch = sections[si].chapters[ci];
      if (ch.lessons.length) { openEditLesson(sections[si].id, ch.id, ch.lessons[ch.lessons.length - 1].id); return; }
    }
  }, [desktop]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ một lần, khi màn rộng xuất hiện

  // Tự lưu bài đang sửa: không khi đang Lưu tay / còn tệp đang lên / ô chưa hợp lệ (nút Lưu sẽ báo lỗi đúng chỗ).
  useEffect(() => {
    if (panel.type !== "edit-lesson" || saving || uploadBusy) return;
    const key = autoKey(ls);
    if (key === autoBase.current) return;
    const target = panel;
    const t = setTimeout(async () => {
      if (autoBusy.current) return;
      const b = buildLesson(ls);
      if (!b.ok) return;
      autoBusy.current = true; setAutoSave({ phase: "dang" });
      try {
        await apiPut(`/api/lessons/${target.lessonId}`, b.common);
        autoBase.current = key;
        setLessonLocal(target.sectionId, target.chapterId, target.lessonId, { ...b.common, type: b.type as LessonDB["type"] });
        discardUploads(ls.documentsRaw); // tệp còn trong bài nay đã gắn vào bài; tệp đã bỏ khỏi danh sách thì xoá
        setAutoSave({ phase: "xong", at: hhmm(new Date()) });
      } catch { setAutoSave({ phase: "loi" }); }
      finally { autoBusy.current = false; }
    }, 1500);
    return () => clearTimeout(t);
  }, [ls, panel, saving, uploadBusy]); // eslint-disable-line react-hooks/exhaustive-deps -- hàm gọi API ổn định theo courseSlug

  async function savePanel() {
    if (panel.type === "none") return;
    setPanelErr(null); setStatusNote(null);
    setSaving(true);
    try {
      if (panel.type === "add-section" || panel.type === "edit-section" || panel.type === "add-chapter" || panel.type === "edit-chapter") {
        if (!title.trim()) { setPanelErr(panel.type.includes("section") ? "Nhập tên phần." : "Nhập tên chương."); return; }
      }
      if (panel.type === "add-section") {
        const section = await apiPost<SectionDB>(`/api/courses/${courseSlug}/sections`, { title: title.trim() });
        setSections(p => [...p, { ...section, chapters: [] }]);
        setExpanded(p => ({ ...p, sections: new Set([...p.sections, section.id]) }));
        flash(`Đã thêm phần "${section.title}"`);

      } else if (panel.type === "edit-section") {
        await apiPut(`/api/sections/${panel.sectionId}`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId ? { ...s, title: title.trim() } : s));
        flash("Đã cập nhật tên phần");

      } else if (panel.type === "add-chapter") {
        const chapter = await apiPost<ChapterDB>(`/api/sections/${panel.sectionId}/chapters`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: [...s.chapters, { ...chapter, lessons: [] }] } : s));
        setExpanded(prev => ({ ...prev, chapters: new Set([...prev.chapters, chapter.id]) }));
        flash(`Đã thêm chương "${chapter.title}"`);

      } else if (panel.type === "edit-chapter") {
        await apiPut(`/api/chapters/${panel.chapterId}`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === panel.chapterId ? { ...c, title: title.trim() } : c) } : s));
        flash("Đã cập nhật chương");

      } else if (panel.type === "add-lesson" || panel.type === "edit-lesson") {
        const b = buildLesson(ls);
        if (!b.ok) {
          if (b.field === "date") { setDateErr(b.error); setLinksOpen(true); } else setPanelErr(b.error);
          return;
        }
        const { common, type, when } = b;
        if (panel.type === "add-lesson") {
          // Bài mới: trạng thái đi THẲNG trong POST (Đã đăng / Nháp), KHÔNG PATCH sau — POST-rồi-PATCH sang Ẩn để lộ bài cho học sinh nếu PATCH hỏng.
          // Ô Trạng thái của bài mới không có "Ẩn" (API chặn Nháp → Ẩn nên cũng không tạo Nháp trước được); muốn chưa hiện thì chọn Nháp.
          const lesson = await apiPost<LessonDB>(`/api/chapters/${panel.chapterId}/lessons`, { ...common, ...(ls.status === "published" ? {} : { status: "draft" as const }) });
          addLessonLocal(panel.sectionId, panel.chapterId, lesson);
          discardUploads(ls.documentsRaw);
          flash(stayAfterAdd.current ? `Đã lưu bài "${lesson.title}". Thêm bài tập ngay bên dưới.` : `Đã thêm bài "${lesson.title}"`);
          if (ls.status !== "published" && lessonStatusOf(lesson.status) !== "draft") {
            // Máy chủ cũ bỏ qua "draft": báo thật, panel thành "Sửa bài học" để cô thấy bài đang Đã đăng.
            const got = lessonStatusOf(lesson.status);
            setStatusNote("Đã lưu bài, chưa đặt được trạng thái Nháp — bài đang Đã đăng. Cô đổi sang Ẩn nếu chưa muốn học sinh thấy.");
            setOrigStatus(got); setLs(f => ({ ...f, status: got })); setLinksOpen(true);
            autoBase.current = autoKey(ls); setAutoSave({ phase: "cho" });
            setPanel({ type: "edit-lesson", sectionId: panel.sectionId, chapterId: panel.chapterId, lessonId: lesson.id });
            return;
          }
          if (stayAfterAdd.current) {
            setOrigStatus(lessonStatusOf(lesson.status)); setLinksOpen(true);
            autoBase.current = autoKey(ls); setAutoSave({ phase: "cho" });
            setPanel({ type: "edit-lesson", sectionId: panel.sectionId, chapterId: panel.chapterId, lessonId: lesson.id });
            requestAnimationFrame(() => document.querySelector("[data-bai-tap-cua-bai]")?.scrollIntoView({ block: "start", behavior: "smooth" }));
            return;
          }
          setPanel({ type: "none" });
          return;
        }
        await apiPut(`/api/lessons/${panel.lessonId}`, common);
        setLessonLocal(panel.sectionId, panel.chapterId, panel.lessonId, {
          ...common, type: type as LessonDB["type"], scheduledAt: when.iso,
        });
        const lessonId = panel.lessonId, from = origStatus;
        flash("Đã cập nhật bài học");
        // Đã lưu: tệp đã bị bỏ khỏi danh sách trước khi lưu thì xoá, tệp còn trong bài thì giữ.
        discardUploads(ls.documentsRaw);
        if (ls.status !== from) {
          const err = await patchStatus(lessonId, ls.status);
          if (err) {
            // Giữ phần đã lưu; panel ở lại (đã thành "Sửa bài học") để cô thấy câu lỗi và thử đổi lại.
            setStatusNote(`Đã lưu bài, chưa đổi được trạng thái: ${err}`);
            setOrigStatus(from); setLs(f => ({ ...f, status: from })); setLinksOpen(true);
            setPanel({ type: "edit-lesson", sectionId: panel.sectionId, chapterId: panel.chapterId, lessonId });
            return;
          }
          setLessonLocal(panel.sectionId, panel.chapterId, lessonId, { status: ls.status });
        }
        setPanel({ type: "none" });
        return;
      }
      setPanel({ type: "none" });
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : "Chưa lưu được. Cô thử lại sau ít giây.");
    } finally {
      stayAfterAdd.current = false;
      setSaving(false);
    }
  }

  // ── Xoá (hỏi bằng KinConfirm) ──
  async function delConfirm() {
    if (!del) return;
    setDeleting(true);
    try {
      const url = del.kind === "section" ? `/api/sections/${del.sectionId}` : del.kind === "chapter" ? `/api/chapters/${del.chapterId}` : `/api/lessons/${del.lessonId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Lỗi ${res.status}`); }
      if (del.kind === "section") setSections(p => p.filter(s => s.id !== del.sectionId));
      else if (del.kind === "chapter") setSections(p => p.map(s => s.id === del.sectionId ? { ...s, chapters: s.chapters.filter(c => c.id !== del.chapterId) } : s));
      else setSections(p => p.map(s => s.id === del.sectionId
        ? { ...s, chapters: s.chapters.map(c => c.id === del.chapterId ? { ...c, lessons: c.lessons.filter(l => l.id !== del.lessonId) } : c) } : s));
      flash("Đã xoá");
    } catch (e) {
      flash(`Chưa xoá được: ${e instanceof Error ? e.message : "lỗi không rõ"}`, "loi");
    } finally {
      setDeleting(false);
      setDel(null);
    }
  }

  // Gia sư dán nhầm ô: lấy link khỏi ô hiện tại, đưa sang ô đúng (cùng một thao tác, không gõ lại). Ô Zoom đã bỏ ⇒ không chuyển vào / ra "live".
  function moveLink(from: MediaSlot, index: number, to: MediaSlot) {
    if (from === "live" || to === "live") { flash("Không còn ô Zoom riêng.", "loi"); return; }
    const keyOf = (sl: MediaSlot) => (sl === "video" ? "videoUrls" : sl === "azota" ? "azotaUrls" : null);
    const fk = keyOf(from), tk = keyOf(to);
    if (!fk || !tk) { flash("Tài liệu hãy thả tệp vào ô Tài liệu ở trên.", "loi"); return; }
    if (to === "azota") { flash("Link Azota không gắn vào video bài. Bỏ link này khỏi ô video.", "loi"); return; } // SCL-D: ô Azota đã ẩn
    setLs(f => {
      const src = [...f[fk]]; const [link] = src.splice(index, 1);
      const dst = [...f[tk].filter(u => u.trim()), link];
      return { ...f, [fk]: src.length ? src : [""], [tk]: dst };
    });
  }

  // ── Sửa nhanh / thêm nhanh trong cây ──
  function openQuickEdit(sectionId: string, chapterId: string, l: LessonDB) {
    const when = isoToVnParts(l.scheduledAt);
    setQTitle(l.title); setQDate(when.date); setQTime(when.time); setQErr(null);
    setQuick({ mode: "edit", sectionId, chapterId, lessonId: l.id });
  }
  function openQuickAdd(sectionId: string, chapterId: string) {
    setQTitle(""); setQDate(""); setQTime(""); setQErr(null);
    setExpanded(p => ({ ...p, sections: new Set([...p.sections, sectionId]), chapters: new Set([...p.chapters, chapterId]) }));
    setQuick({ mode: "add", sectionId, chapterId });
  }
  async function saveQuick() {
    if (!quick || qSaving) return;
    if (!qTitle.trim()) { setQErr("Nhập tên bài."); return; }
    const when = parseVnDateTime(qDate, qTime);
    if (!when.ok) { setQErr(when.error); return; }
    setQSaving(true); setQErr(null);
    try {
      if (quick.mode === "edit") {
        await apiPut(`/api/lessons/${quick.lessonId}`, { title: qTitle.trim(), scheduledAt: when.iso });
        setLessonLocal(quick.sectionId, quick.chapterId, quick.lessonId, { title: qTitle.trim(), scheduledAt: when.iso });
        flash("Đã lưu bài");
      } else {
        const lesson = await apiPost<LessonDB>(`/api/chapters/${quick.chapterId}/lessons`, { title: qTitle.trim(), type: "document", scheduledAt: when.iso });
        addLessonLocal(quick.sectionId, quick.chapterId, lesson);
        flash(`Đã thêm bài "${lesson.title}"`);
      }
      setQuick(null);
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Chưa lưu được. Cô thử lại.");
    } finally {
      setQSaving(false);
    }
  }
  function quickKey(e: ReactKeyboardEvent<HTMLFormElement>) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQuick(null); }
  }

  /** Lớp rỗng: tạo phần "Nội dung lớp" + chương "Chương 1" rồi mở hàng thêm bài. */
  async function createFirstChapter() {
    setCreatingFirst(true);
    try {
      const section = await apiPost<SectionDB>(`/api/courses/${courseSlug}/sections`, { title: "Nội dung lớp" });
      const chapter = await apiPost<ChapterDB>(`/api/sections/${section.id}/chapters`, { title: "Chương 1" });
      setSections(p => [...p, { ...section, chapters: [{ ...chapter, lessons: [] }] }]);
      setExpanded(p => ({ sections: new Set([...p.sections, section.id]), chapters: new Set([...p.chapters, chapter.id]) }));
      setQTitle(""); setQDate(""); setQTime(""); setQErr(null);
      setQuick({ mode: "add", sectionId: section.id, chapterId: chapter.id });
    } catch (e) {
      flash(`Chưa tạo được chương: ${e instanceof Error ? e.message : "lỗi không rõ"}`, "loi");
    } finally {
      setCreatingFirst(false);
    }
  }

  // Hàm vẽ (KHÔNG phải component lồng: component lồng bị dựng lại mỗi lần gõ ⇒ mất tiêu điểm ô nhập).
  function renderQuickForm(chapterId: string) {
    const add = quick?.mode === "add";
    const idp = `q-${chapterId}`;
    return (
      <form data-sua-nhanh={add ? "them" : "sua"} onKeyDown={quickKey} onSubmit={e => { e.preventDefault(); void saveQuick(); }}
        className="flex flex-col gap-2 lg:flex-row lg:items-start" aria-label={add ? "Thêm bài nhanh" : "Sửa nhanh bài học"}>
        <div className="min-w-0 lg:flex-1">
          <label htmlFor={`${idp}-ten`} className="sr-only">Tên bài</label>
          <input id={`${idp}-ten`} autoFocus className={FIELD} value={qTitle} onChange={e => setQTitle(e.target.value)} placeholder="Tên bài, VD: Buổi 3: Hàm số bậc hai" />
        </div>
        <div className="flex min-w-0 gap-2">
          <label htmlFor={`${idp}-ngay`} className="sr-only">Ngày học</label>
          <input id={`${idp}-ngay`} type="date" className={`${FIELD} min-w-0 flex-1 lg:w-40`} value={qDate} onChange={e => setQDate(e.target.value)} />
          <label htmlFor={`${idp}-gio`} className="sr-only">Giờ học</label>
          <input id={`${idp}-gio`} type="time" className={`${FIELD} min-w-0 flex-1 lg:w-28`} value={qTime} onChange={e => setQTime(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <KinButton type="submit" loading={qSaving} loadingLabel="Đang lưu…">Lưu</KinButton>
          <KinButton type="button" variant="secondary" onClick={() => setQuick(null)}>Huỷ</KinButton>
          {add && quick && (
            <KinButton type="button" variant="ghost" onClick={() => { const q = quick; setQuick(null); openAddLesson(q.sectionId, q.chapterId, { title: qTitle, date: qDate, time: qTime }); }}>Chi tiết…</KinButton>
          )}
        </div>
        {qErr && <p role="alert" data-sua-nhanh-loi className="text-xs font-semibold text-[var(--kin-tt-chu-loi)] lg:basis-full">{qErr}</p>}
      </form>
    );
  }

  const panelIsOpen = panel.type !== "none";
  const isTitlePanel = panel.type.includes("section") || panel.type.includes("chapter");
  const isLsPanel    = panel.type.includes("lesson");
  const panelTitle   = {
    "add-section":    "Thêm phần mới",
    "edit-section":   "Sửa phần",
    "add-chapter":    "Thêm chương mới",
    "edit-chapter":   "Sửa chương",
    "add-lesson":     "Thêm bài học",
    "edit-lesson":    "Sửa bài học",
    none: "",
  }[panel.type];
  // Bài mới: chỉ Đã đăng · Nháp (không "Ẩn" — xem savePanel). Sửa bài: đủ ba, mục không chuyển được theo luật G4 thì khoá.
  const statusOptions = panel.type === "add-lesson"
    ? LESSON_STATUS_OPTIONS.filter(o => o.value !== "hidden")
    : LESSON_STATUS_OPTIONS.map(o => ({ ...o, disabled: panel.type === "edit-lesson" ? !statusAllowed(origStatus, o.value) : false }));
  const hasOldZoom = ls.zoomUrls.some(u => u.trim());

  // Chương mới nhất (chương cuối của phần cuối có chương): "+ Bài" đầu danh sách thêm vào đây.
  const newest = (() => {
    for (let si = sections.length - 1; si >= 0; si--) { const chs = sections[si].chapters; if (chs.length) return { sectionId: sections[si].id, chapter: chs[chs.length - 1] }; }
    return null;
  })();
  const onePart = sections.length === 1; // lớp chỉ một phần ⇒ ẩn tầng Phần
  const totals = { ch: sections.reduce((a, s) => a + s.chapters.length, 0), ls: sections.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.lessons.length, 0), 0) };
  const delKind = del?.kind === "section" ? "phần" : del?.kind === "chapter" ? "chương" : "bài học";

  return (
    <div data-bai-hoc className="min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-8 lg:items-start">
      <div className="lg:order-2 min-w-0">
      <Drawer open={panelIsOpen} title={panelTitle} onClose={closePanel} onSave={savePanel} saving={saving} busy={uploadBusy && isLsPanel}
        inline={desktop} closeLabel={panel.type === "edit-lesson" ? "Đóng" : "Huỷ"}
        empty={<p data-ngan-trong className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Chọn một bài ở danh sách bên trái để sửa tên, link YouTube và tài liệu. Bài đang sửa tự lưu.</p>}
        menu={desktop && panel.type === "edit-lesson" ? (() => { const pl = panel; const l = sections.find(x => x.id === pl.sectionId)?.chapters.find(x => x.id === pl.chapterId)?.lessons.find(x => x.id === pl.lessonId);
          return l ? <LessonMenu title={l.title} disabled={saving} onCopy={() => void duplicateLesson(pl.sectionId, pl.chapterId, pl.lessonId)}
            onDelete={() => setDel({ kind: "lesson", sectionId: pl.sectionId, chapterId: pl.chapterId, lessonId: pl.lessonId, label: l.title })} /> : null; })() : null}>
        {panelErr && <p role="alert" data-panel-loi className="rounded-[var(--kin-bo-md)] border border-[var(--kin-tt-vien-loi)] bg-[var(--kin-tt-nen-loi)] px-3 py-2 text-sm font-medium text-[var(--kin-tt-chu-loi)]">{panelErr}</p>}
        {panel.type === "edit-lesson" && (
          <p role="status" data-tu-luu={autoSave.phase} className="flex items-center gap-1.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
            {autoSave.phase === "xong" && <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="flex-shrink-0"><circle cx="8" cy="8" r="7" fill="var(--kin-tt-cham-xong)" /><path d="m5 8.2 2 2 4-4.4" stroke="var(--kin-nen-trang)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            {autoSave.phase === "xong" ? `Đã tự lưu lúc ${autoSave.at}` : autoSave.phase === "dang" ? "Đang tự lưu…" : autoSave.phase === "loi" ? "Chưa tự lưu được. Bạn bấm Lưu để thử lại." : "Bài tự lưu sau mỗi lần sửa."}
          </p>
        )}
        {statusNote && <p role="status" data-trang-thai-loi className="rounded-[var(--kin-bo-md)] border border-[var(--kin-tt-vien-cho)] bg-[var(--kin-tt-nen-cho)] px-3 py-2 text-sm font-medium text-[var(--kin-tt-chu-cho)]">{statusNote}</p>}
        {isTitlePanel && (
          <div>
            <label htmlFor="tcb-ten" className="block text-sm font-medium text-[var(--kin-chu-chinh)] mb-1.5">
              <span className="text-[var(--kin-tt-chu-loi)] mr-0.5">*</span>
              {panel.type.includes("section") ? "Tên phần" : "Tên chương"}
            </label>
            <input id="tcb-ten" className={FIELD} value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void savePanel(); }}
              placeholder={panel.type.includes("section") ? "VD: PHẦN 1: TƯ DUY ĐỊNH LƯỢNG" : "VD: Chương 1: Đại số cơ bản"} />
          </div>
        )}
        {isLsPanel && (
          <>
            <div>
              <label htmlFor="ls-ten" className="block text-sm font-medium text-[var(--kin-chu-chinh)] mb-1.5"><span className="text-[var(--kin-tt-chu-loi)] mr-0.5">*</span>Tên bài học</label>
              <input id="ls-ten" className={FIELD} value={ls.title}
                onChange={e => setLs(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") void savePanel(); }}
                placeholder="VD: Buổi 1: Hệ phương trình" />
            </div>

            {/* SCL-D (P2-3): ngăn chỉ còn 3 phần — Tên · Link YouTube · Tài liệu. Drive, Azota, Khoá bài, Học thử không còn hiện (dữ liệu cũ giữ nguyên,
                PUT vẫn gửi lại đúng giá trị đã nạp). Ngày học, trạng thái, bài tập, ghi chú vào mục gập "Tuỳ chọn khác". */}
            <div data-video-bai>
              <SlotLinkEditor
                label="Link YouTube"
                icon={<YoutubeMark />}
                slot="video"
                placeholder="https://youtube.com/watch?v=..."
                urls={ls.videoUrls}
                onChange={urls => setLs(f => ({ ...f, videoUrls: urls }))}
                onMove={moveLink}
              />
              <p data-youtube-luu-y className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Để video ở chế độ Không công khai là đủ. {YOUTUBE_UNLISTED_NOTE}</p>
              {/* Xem trước: KiN không gọi YouTube — ảnh nhỏ dựng từ mã video; thời lượng là ô "Thời lượng" của bài (nếu có). */}
              {ls.videoUrls.map(u => parseYoutubeId(u)).filter((id): id is string => !!id).map(id => (
                <div key={id} data-xem-truoc-youtube className="mt-3 flex items-center gap-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-bang)] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl(id)} alt="" loading="lazy" width={120} height={68} className="h-[68px] w-[120px] flex-shrink-0 rounded-[var(--kin-bo-md)] object-cover bg-[var(--kin-vien-nhat)]" />
                  <div className="min-w-0">
                    <p className="font-medium text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{ls.title.trim() || "Video YouTube"}</p>
                    <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{ls.duration.trim() ? videoText(id, ls.duration) : "Video YouTube"} · học sinh xem ngay trong bài</p>
                  </div>
                </div>
              ))}
            </div>

            <DocumentsEditor
              value={ls.documentsRaw}
              onChange={v => setLs(f => ({ ...f, documentsRaw: v }))}
              courseId={courseSlug}
              canUpload={canUpload}
              onAssetUploaded={id => { sessionUploads.current.push(id); }}
              onBusyChange={setUploadBusy}
            />

            <div data-tuy-chon>
              <button type="button" onClick={() => setLinksOpen(o => !o)} aria-expanded={linksOpen} aria-controls="ls-tuy-chon" data-open={linksOpen ? "" : undefined}
                className="flex w-full min-h-11 items-center justify-between gap-2 border-b border-[var(--kin-vien-nhat)] text-left text-sm font-semibold text-[var(--kin-chu-chinh)]">
                <span>Tuỳ chọn khác: ngày học, trạng thái, bài tập, ghi chú</span>
                <KinChevron open={linksOpen} />
              </button>
              <KinFold open={linksOpen} id="ls-tuy-chon">
                <div className="space-y-5 pt-3">
                  <fieldset data-ngay-hoc>
                    <legend className="block text-sm font-medium text-[var(--kin-chu-chinh)] mb-1.5">Ngày học (giờ Việt Nam)</legend>
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="ls-ngay" className="sr-only">Ngày học</label>
                      <input id="ls-ngay" type="date" className={`${FIELD} min-w-0 flex-1 basis-36`} value={ls.scheduledDate}
                  onChange={e => { setDateErr(null); setLs(f => ({ ...f, scheduledDate: e.target.value })); }} />
                      <label htmlFor="ls-gio" className="sr-only">Giờ học</label>
                      <input id="ls-gio" type="time" className={`${FIELD} min-w-0 flex-1 basis-24`} value={ls.scheduledTime}
                  onChange={e => { setDateErr(null); setLs(f => ({ ...f, scheduledTime: e.target.value })); }} />
                      {(ls.scheduledDate || ls.scheduledTime) && (
                  <button type="button" className={BTN_TEXT} onClick={() => { setDateErr(null); setLs(f => ({ ...f, scheduledDate: "", scheduledTime: "" })); }}>Bỏ ngày</button>
                      )}
                    </div>
                    {dateErr && <p role="alert" data-ngay-loi className="mt-1.5 text-xs font-semibold text-[var(--kin-tt-chu-loi)]">{dateErr}</p>}
                  </fieldset>

                  <div>
                    <p id="ls-trang-thai-nhan" className="block text-sm font-medium text-[var(--kin-chu-chinh)] mb-1.5">Trạng thái</p>
                    <KinSelect id="ls-trang-thai" aria-labelledby="ls-trang-thai-nhan" value={ls.status} options={statusOptions}
                      onChange={v => setLs(f => ({ ...f, status: v as LessonStatusValue }))} />
                    <p className="mt-1 text-xs text-[var(--kin-chu-mo)]">
                      {ls.status === "published" ? "Học sinh của lớp thấy bài này." : ls.status === "draft" ? "Nháp · học sinh chưa thấy." : "Ẩn · học sinh không thấy."}
                      {panel.type === "edit-lesson" && origStatus === "published" && " Bài đã đăng không đưa về Nháp được — dùng Ẩn."}
                    </p>
                    {panel.type === "add-lesson" && <p data-goi-y-nhap className="mt-0.5 text-xs text-[var(--kin-chu-mo)]">Bài mới chưa muốn hiện thì chọn Nháp.</p>}
                  </div>

                  {hasOldZoom && (
                    <p data-zoom-cu className="rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] px-3 py-2 text-xs text-[var(--kin-chu-mo)]">Bài này có link phòng Zoom cũ — học sinh vẫn thấy.</p>
                  )}

                  {panel.type === "edit-lesson" && ls.azotaUrls.some(u => u.trim()) && (
                    <AzotaStatusTable lessonId={panel.lessonId} />
                  )}
                  <div data-bai-tap-cua-bai className="scroll-mt-4">
                    {panel.type === "edit-lesson" ? (
                      <AssignmentEditor lessonId={panel.lessonId} />
                    ) : (
                      <div className="rounded-[var(--kin-bo-md)] border border-dashed border-[var(--kin-vien-thuong)] px-3 py-3">
                        <p className="text-sm font-semibold text-[var(--kin-chu-chinh)]">Bài tập của bài</p>
                        <p className="mt-1 text-xs text-[var(--kin-chu-mo)]">Bài tập gắn với bài, nên cần lưu bài trước. Bấm nút dưới: bài được lưu và màn này mở sẵn phần thêm bài tập.</p>
                        <button type="button" data-luu-them-bai-tap disabled={saving || uploadBusy || !ls.title.trim()}
                          onClick={() => { stayAfterAdd.current = true; void savePanel(); }}
                          className={`mt-3 ${kinButtonClass("secondary")}`}>{saving ? "Đang lưu…" : "Lưu và thêm bài tập"}</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="ls-ghi-chu" className="block text-sm font-semibold text-[var(--kin-chu-chinh)] mb-2 pb-1 border-b border-[var(--kin-vien-nhat)]">
                      Ghi chú cho học viên
                    </label>
                    <p className="text-xs text-[var(--kin-chu-mo)] mb-2">Lưu ý, hướng dẫn, hoặc thông báo hiển thị với học viên khi xem bài này.</p>
                    <textarea
                      id="ls-ghi-chu"
                      className={FIELD + " resize-none py-2.5"}
                      rows={4}
                      placeholder="VD: Học viên cần đọc lý thuyết chương 3 trước khi làm bài này. Nộp bài trước 23:59 ngày 31/05."
                      value={ls.adminNote}
                      onChange={e => setLs(f => ({ ...f, adminNote: e.target.value }))}
                    />
                  </div>
                  {panel.type === "edit-lesson" && (
                    <Link href={`${baiHocHref(courseSlug)}/giao-trinh/xem/${encodeURIComponent(panel.lessonId)}`} target="_blank" rel="noopener noreferrer" data-xem-nhu-hoc-sinh
                      className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--kin-nhan-link)] underline">Xem như học sinh ↗</Link>
                  )}
                </div>
              </KinFold>
            </div>
          </>
        )}
      </Drawer>
      </div>

      <div className="lg:order-1 min-w-0">
      {todo}
      <KinConfirm open={!!del} tone="nguy-hiem" title={`Xoá ${delKind}?`} confirmLabel="Xoá" loading={deleting} loadingLabel="Đang xoá…"
        message={del ? <>Xoá <strong>&quot;{del.label}&quot;</strong>{del.kind !== "lesson" ? " sẽ xoá toàn bộ nội dung bên trong." : "."} Không thể hoàn tác.</> : null}
        onConfirm={delConfirm} onCancel={() => { if (!deleting) setDel(null); }} />

      {toast && (
        <p role={toast.tone === "loi" ? "alert" : "status"} data-tcb-toast={toast.tone}
          className={`mb-4 rounded-[var(--kin-bo-md)] border px-4 py-2.5 text-sm font-semibold ${toast.tone === "loi"
            ? "border-[var(--kin-tt-vien-loi)] bg-[var(--kin-tt-nen-loi)] text-[var(--kin-tt-chu-loi)]"
            : "border-[var(--kin-tt-vien-xong)] bg-[var(--kin-tt-nen-xong)] text-[var(--kin-tt-chu-xong)]"}`}>
          {toast.text}
        </p>
      )}

      {sections.length === 0 ? (
        <KinEmptyState title="Lớp chưa có bài học"
          action={<KinButton type="button" onClick={() => void createFirstChapter()} loading={creatingFirst} loadingLabel="Đang tạo…">Tạo chương đầu tiên</KinButton>}>
          Tạo chương rồi thêm bài: tên bài, ngày học và tài liệu — ngay tại trang này.
        </KinEmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 mb-3">
            <div className="min-w-0">
              <h2 className="text-[length:var(--kin-co-tieu-de)] font-semibold text-[var(--kin-chu-chinh)]">Bài học</h2>
              <p data-bai-hoc-tong className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{sections.length} phần · {totals.ch} chương · {totals.ls} bài</p>
            </div>
            {newest && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]">Thêm vào {newest.chapter.title}</span>
                <button type="button" data-them-bai-dau onClick={() => openQuickAdd(newest.sectionId, newest.chapter.id)} className={BTN_LINE} aria-label={`Thêm bài vào ${newest.chapter.title}`}>+ Bài</button>
                <button type="button" onClick={() => openAddChapter(newest.sectionId)} className={BTN_TEXT}>+ Chương</button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {sections.map((section, si) => (
              <div key={section.id || `s-${si}`} data-phan
                className={onePart ? "border-t border-[var(--kin-vien-thuong)]" : "border rounded-[var(--kin-bo-lg)] transition-colors"}
                style={onePart ? undefined : {
                  borderColor: dragOverKey === `s-${section.id}` ? "var(--kin-tt-chu-xong)" : "var(--kin-vien-thuong)",
                  boxShadow: dragItem?.type === "section" && dragItem.sectionIdx === si ? "var(--kin-bong-noi)" : undefined,
                }}
                draggable={!quick && !onePart}
                onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragItem({ type: "section", sectionIdx: si }); }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragItem?.type === "section" || dragItem?.type === "chapter") setDragOverKey(`s-${section.id}`); }}
                onDrop={e => {
                  e.preventDefault(); e.stopPropagation();
                  if (dragItem?.type === "section" && dragItem.sectionIdx !== si) reorderSections(dragItem.sectionIdx, si);
                  else if (dragItem?.type === "chapter" && dragItem.sectionIdx !== si) moveChapterAcross(dragItem.sectionIdx, dragItem.chapterIdx, si, sections[si].chapters.length);
                  setDragItem(null); setDragOverKey(null);
                }}
                onDragEnd={() => { setDragItem(null); setDragOverKey(null); }}
              >
                {!onePart && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-t-[var(--kin-bo-lg)] px-2 sm:px-4 py-1.5 bg-[var(--kin-nen-bang)]">
                  <span className="hidden sm:inline-flex"><DragHandle /></span>
                  <button type="button" onClick={() => toggleSec(section.id)} aria-expanded={expanded.sections.has(section.id)} aria-label={`${expanded.sections.has(section.id) ? "Thu gọn" : "Mở"} phần ${section.title}`}
                    className={`${ICON_BTN} text-xs text-[var(--kin-chu-phu)]`}>
                    {expanded.sections.has(section.id) ? "▼" : "▶"}
                  </button>
                  <span className="text-[length:var(--kin-co-goc)] font-semibold flex-1 min-w-[8rem] break-words text-[var(--kin-chu-chinh)]">{section.title}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => openAddChapter(section.id)} className={BTN_LINE}>+ Chương</button>
                    <button type="button" onClick={() => openEditSection(section.id)} className={BTN_LINE}>Sửa</button>
                    <button type="button" onClick={() => setDel({ kind: "section", sectionId: section.id, label: section.title })} className={BTN_DANGER}>Xoá</button>
                  </div>
                </div>}

                {(onePart || expanded.sections.has(section.id)) && (
                  <div>
                    {section.chapters.length === 0 && (
                      <div className="px-4 py-5 text-center">
                        <p className="text-sm text-[var(--kin-chu-mo)] mb-1">Chưa có chương nào.</p>
                        <button type="button" onClick={() => openAddChapter(section.id)} className={BTN_TEXT}>+ Thêm chương đầu tiên</button>
                      </div>
                    )}
                    {section.chapters.map((chapter, ci) => (
                      <div key={chapter.id || `${section.id}-c-${ci}`} data-chuong
                        className="border-t border-[var(--kin-vien-nhat)] transition-colors"
                        style={{ background: dragOverKey === `c-${chapter.id}` ? "var(--kin-nhan-nen-nhat)" : undefined }}
                        draggable={!quick}
                        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragItem({ type: "chapter", sectionIdx: si, chapterIdx: ci }); }}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragItem?.type === "chapter" || dragItem?.type === "lesson") setDragOverKey(`c-${chapter.id}`); }}
                        onDrop={e => {
                          e.preventDefault(); e.stopPropagation();
                          if (dragItem?.type === "chapter" && !(dragItem.sectionIdx === si && dragItem.chapterIdx === ci)) moveChapterAcross(dragItem.sectionIdx, dragItem.chapterIdx, si, ci);
                          else if (dragItem?.type === "lesson" && !(dragItem.sectionIdx === si && dragItem.chapterIdx === ci)) moveLessonAcross(dragItem.sectionIdx, dragItem.chapterIdx, dragItem.lessonIdx, si, ci, sections[si].chapters[ci].lessons.length);
                          setDragItem(null); setDragOverKey(null);
                        }}
                        onDragEnd={() => { setDragItem(null); setDragOverKey(null); }}
                      >
                        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 pl-2 ${onePart ? "sm:pl-3" : "sm:pl-8"} pr-2 sm:pr-4 py-1 bg-[var(--kin-nen-bang)]`}>
                          <span className="hidden sm:inline-flex"><DragHandle /></span>
                          <button type="button" onClick={() => toggleCh(chapter.id)} aria-expanded={expanded.chapters.has(chapter.id)} aria-label={`${expanded.chapters.has(chapter.id) ? "Thu gọn" : "Mở"} chương ${chapter.title}`}
                            className={`${ICON_BTN} text-xs text-[var(--kin-chu-mo)]`}>
                            {expanded.chapters.has(chapter.id) ? "▼" : "▶"}
                          </button>
                          <span className="text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-chu-chinh)] flex-1 min-w-[8rem] break-words">{chapter.title}</span>
                          <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] flex-shrink-0">{chapter.lessons.length} bài</span>
                          <button type="button" onClick={() => openEditChapter(section.id, chapter.id)} className={BTN_TEXT}>Sửa</button>
                          <button type="button" onClick={() => setDel({ kind: "chapter", sectionId: section.id, chapterId: chapter.id, label: chapter.title })} className={BTN_DANGER}>Xoá</button>
                        </div>
                        {gv.phase === "ready" && (gv.assignable.length > 0 || !!chapter.teacherId) && (
                          <div className="pl-3 sm:pl-[4.5rem] pr-2 sm:pr-4 pb-2">
                            <GiaoChoNhom courseId={courseSlug} chapterId={chapter.id} teacherId={chapter.teacherId ?? null} assignedTo="owner" info={gv} onChanged={reloadChapterTeachers} />
                          </div>
                        )}
                        {expanded.chapters.has(chapter.id) && (
                          <div>
                            {chapter.lessons.length === 0 && !(quick?.mode === "add" && quick.chapterId === chapter.id) && (
                              <p className="px-4 sm:px-12 py-3 text-xs text-[var(--kin-chu-mo)]">Chưa có bài học trong chương này.</p>
                            )}
                            {chapter.lessons.map((lesson, li) => {
                              const st = stats[lesson.id];
                              const nop = nopText(st);
                              const docs = docCount(lesson.documents);
                              const current = panel.type === "edit-lesson" && panel.lessonId === lesson.id;
                              const editingHere = quick?.mode === "edit" && quick.lessonId === lesson.id;
                              const when = formatVnLessonWhen(lesson.scheduledAt);
                              const stChip = LESSON_STATUS_CHIP[lesson.status ?? "published"];
                              return (
                                <div key={lesson.id || `${chapter.id}-l-${li}`} data-bai={lesson.id} aria-current={current ? "true" : undefined}
                                  className={`pl-3 ${onePart ? "sm:pl-6" : "sm:pl-12"} pr-2 sm:pr-4 py-1.5 min-h-14 border-t border-[var(--kin-vien-nhat)] transition-colors`}
                                  style={{ background: dragOverKey === `l-${lesson.id}` ? "var(--kin-tt-nen-xong)" : current ? "var(--kin-nen-dang-chon)" : undefined }}
                                  draggable={!quick}
                                  onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragItem({ type: "lesson", sectionIdx: si, chapterIdx: ci, lessonIdx: li }); }}
                                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragItem?.type === "lesson") setDragOverKey(`l-${lesson.id}`); }}
                                  onDrop={e => {
                                    e.preventDefault(); e.stopPropagation();
                                    if (dragItem?.type === "lesson" && !(dragItem.sectionIdx === si && dragItem.chapterIdx === ci && dragItem.lessonIdx === li)) moveLessonAcross(dragItem.sectionIdx, dragItem.chapterIdx, dragItem.lessonIdx, si, ci, li);
                                    setDragItem(null); setDragOverKey(null);
                                  }}
                                  onDragEnd={() => { setDragItem(null); setDragOverKey(null); }}
                                >
                                  {editingHere ? renderQuickForm(chapter.id) : (
                                    <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4">
                                      <div className="flex min-w-0 items-start gap-2 lg:flex-1">
                                        <span className="hidden sm:inline-flex self-center"><DragHandle /></span>
                                        <div className="min-w-0">
                                          {/* Bấm tên bài = mở ngăn sửa (máy tính: cột phải; điện thoại: hộp thoại). */}
                                          <button type="button" data-bai-ten onClick={() => openEditLesson(section.id, chapter.id, lesson.id)} aria-label={`Chi tiết bài ${lesson.title}`}
                                            className="min-h-11 text-left text-[length:var(--kin-co-body)] font-medium leading-6 text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere] hover:underline">{lesson.title}</button>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                        {stChip && <span data-bai-trang-thai={lesson.status} className={`${CHIP} border border-[var(--kin-tt-vien-cho)] bg-[var(--kin-tt-nen-cho)] text-[var(--kin-tt-chu-cho)]`}>{stChip}</span>}
                                        {when && (
                                          <button type="button" data-bai-ngay onClick={() => openQuickEdit(section.id, chapter.id, lesson)} aria-label={`Ngày học ${when} — sửa nhanh`}
                                            className={`${CHIP} min-h-11 border border-[var(--kin-nhan-vien)] bg-[var(--kin-nhan-nen-nhat)] text-[var(--kin-nhan-chu-tren-nhat)] tabular-nums`}>{when}</button>
                                        )}
                                        {lesson.isFree && <span className={`${CHIP} bg-[var(--kin-tt-nen-xong)] text-[var(--kin-tt-chu-xong)]`}>Học thử</span>}
                                        {docs > 0 && <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{docs} tài liệu</span>}
                                        {!!lesson._count?.assignments && <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{lesson._count.assignments} bài tập</span>}
                                          </div>
                                        </div>
                                      </div>
                                      <div data-bai-cot className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] tabular-nums lg:justify-end">
                                        <span data-cot-video>{videoText(lesson.videoUrl, lesson.duration)}</span>
                                        {nop && <span data-cot-nop>{nop}</span>}
                                        {st && st.pending > 0 ? <KinGradeStatus state="cho-cham">Chờ chấm {st.pending}</KinGradeStatus>
                                          : st && st.total > 0 && st.submitted >= st.total ? <KinStatus tone="xong">Đã chấm hết</KinStatus>
                                          : st && st.total > st.submitted ? <KinGradeStatus state="chua-nop">{st.total - st.submitted} chưa nộp</KinGradeStatus> : null}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1">
                                        <button type="button" onClick={() => openQuickEdit(section.id, chapter.id, lesson)} className={BTN_TEXT}>Sửa nhanh</button>
                                        <LessonMenu title={lesson.title} disabled={saving}
                                          onCopy={() => void duplicateLesson(section.id, chapter.id, lesson.id)}
                                          onDelete={() => setDel({ kind: "lesson", sectionId: section.id, chapterId: chapter.id, lessonId: lesson.id, label: lesson.title })} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div className={`pl-3 ${onePart ? "sm:pl-6" : "sm:pl-12"} pr-2 sm:pr-4 py-1 border-t border-[var(--kin-vien-nhat)]`}>
                              {quick?.mode === "add" && quick.chapterId === chapter.id ? renderQuickForm(chapter.id) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={() => openQuickAdd(section.id, chapter.id)} className={BTN_TEXT} data-them-bai>+ Thêm bài</button>
                                  <button type="button" onClick={() => openAddChapter(section.id)} className={BTN_TEXT}>+ Thêm chương</button>
                                  <button type="button" onClick={() => void duplicateChapter(section.id, chapter.id)} disabled={saving} className={`${BTN_TEXT} disabled:opacity-45`}>Sao chép chương</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <button type="button" onClick={openAddSection}
              className="w-full min-h-11 rounded-xl text-sm font-semibold border-2 border-dashed border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-mo)] hover:border-[var(--kin-nhan-link)] hover:text-[var(--kin-nhan-link)] transition-colors">
              + Thêm phần mới
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
