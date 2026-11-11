// GS-LOP-GON — cây Phần / Chương / Bài + ngăn "Thêm / Sửa bài học", CẮT từ admin/khoa-hoc/[id]/page.tsx (dùng chung cho trang quản trị và tab "Bài tập" của gia sư).
// Khác bản gốc: (1) tệp tài liệu tải NGAY khi thả (DocumentsEditor) nên không còn `pendingDocuments` / resolvePendingDocuments;
// (2) đóng ngăn không Lưu ⇒ xoá best-effort các tệp vừa tải trong phiên ngăn đó (không để tệp mồ côi); (3) `canUpload`: chỉ chủ lớp tải được (API init chặn người khác).
"use client";
import { useState, useRef } from "react";
import { SlotLinkEditor, VideoUploadBox, AzotaStatusTable } from "@/components/media/TutorLessonMedia";
import type { MediaSlot } from "@/lib/mediaLink";
import { Drawer, DrawerToggle, DelModal } from "./DrawerBaiHoc";
import { DocumentsEditor, type DocItem } from "./DocumentsEditor";
import { AssignmentEditor } from "./AssignmentEditor";
import {
  type SectionDB, type ChapterDB, type LessonDB, type PanelMode, type DelTarget, type LsForm, INIT_LS,
  parseUrls, serializeUrls, firstBadLink, parseTypes, deriveTypes, serializeTypes, TYPE_BADGE, ASSIGNMENT_BADGE, hasRealDocuments,
} from "./lessonForm";

type DragState =
  | { type: "section"; sectionIdx: number }
  | { type: "chapter"; sectionIdx: number; chapterIdx: number }
  | { type: "lesson"; sectionIdx: number; chapterIdx: number; lessonIdx: number };

function DragHandle() {
  return (
    <svg viewBox="0 0 10 16" className="w-2.5 h-4 flex-shrink-0 cursor-grab active:cursor-grabbing" fill="var(--kin-chu-mo)">
      <circle cx="3" cy="3" r="1.4"/><circle cx="7" cy="3" r="1.4"/>
      <circle cx="3" cy="8" r="1.4"/><circle cx="7" cy="8" r="1.4"/>
      <circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/>
    </svg>
  );
}

export function TabChuongBai({ courseSlug, initialSections, canUpload = false }: { courseSlug: string; initialSections: SectionDB[]; /** Chỉ chủ lớp tải được tệp lên KiN (API init trả 403 với người khác). */ canUpload?: boolean }) {
  const [sections, setSections] = useState<SectionDB[]>(initialSections);
  const [expanded, setExpanded] = useState<{ sections: Set<string>; chapters: Set<string> }>({
    sections: new Set(initialSections.map(s => s.id)),
    chapters: new Set(initialSections.flatMap(s => s.chapters.map(c => c.id))),
  });
  const [panel,       setPanel]      = useState<PanelMode>({ type: "none" });
  const [del,         setDel]        = useState<DelTarget>(null);
  const [toast,       setToast]      = useState("");
  const [saving,      setSaving]     = useState(false);
  const [title,       setTitle]      = useState("");
  const [ls,          setLs]         = useState<LsForm>(INIT_LS);
  const [dragItem,    setDragItem]   = useState<DragState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const prevSections = useRef<SectionDB[]>([]);
  // Mã tệp vừa tải lên trong phiên ngăn đang mở (để xoá nếu đóng không Lưu / bỏ khỏi danh sách), và có tệp đang lên không.
  const sessionUploads = useRef<string[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2500); }

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
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác"); } });
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
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác"); } });
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
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác"); } });
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
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi di chuyển chương"); } });
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
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi di chuyển bài học"); } });
  }

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
        });
        newLessons.push(nl);
      }
      setSections(p => p.map(s => s.id === sectionId
        ? { ...s, chapters: [...s.chapters, { ...newCh, lessons: newLessons }] } : s));
      setExpanded(p => ({ ...p, chapters: new Set([...p.chapters, newCh.id]) }));
      flash(`Đã sao chép chương "${ch.title}"`);
    } catch (e: unknown) {
      flash((e as Error).message ?? "Lỗi sao chép chương");
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
      });
      setSections(p => p.map(s => s.id === sectionId
        ? { ...s, chapters: s.chapters.map(c => c.id === chapterId
            ? { ...c, lessons: [...c.lessons, nl] } : c) } : s));
      flash(`Đã sao chép bài "${l.title}"`);
    } catch (e: unknown) {
      flash((e as Error).message ?? "Lỗi sao chép bài");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  function toggleSec(id: string) {
    setExpanded(p => { const s = new Set(p.sections); s.has(id) ? s.delete(id) : s.add(id); return { ...p, sections: s }; });
  }
  function toggleCh(id: string) {
    setExpanded(p => { const c = new Set(p.chapters); c.has(id) ? c.delete(id) : c.add(id); return { ...p, chapters: c }; });
  }

  // ── Open helpers ──
  function openAddSection() { setTitle(""); setPanel({ type: "add-section" }); }
  function openEditSection(sectionId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    setTitle(s.title);
    setPanel({ type: "edit-section", sectionId });
  }
  function openAddChapter(sectionId: string) { setTitle(""); setPanel({ type: "add-chapter", sectionId }); }
  function openEditChapter(sectionId: string, chapterId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    setTitle(c.title);
    setPanel({ type: "edit-chapter", sectionId, chapterId });
  }
  function openAddLesson(sectionId: string, chapterId: string) { sessionUploads.current = []; setLs(INIT_LS); setPanel({ type: "add-lesson", sectionId, chapterId }); }
  function openEditLesson(sectionId: string, chapterId: string, lessonId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    const l = c.lessons.find(x => x.id === lessonId)!;
    sessionUploads.current = [];
    setLs({
      title: l.title,
      videoUrls: parseUrls(l.videoUrl), zoomUrls: parseUrls(l.zoomUrl),
      azotaUrls: parseUrls(l.azotaUrl), azotaDeadline: l.azotaDeadline ?? "",
      duration: l.duration ?? "", isLocked: l.isLocked, isFree: l.isFree,
      documentsRaw: l.documents ?? "[]",
      adminNote: l.adminNote ?? "",
    });
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

  async function apiPost<T>(url: string, body: unknown): Promise<T> {
    const { res, data } = await safeFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      throw new Error((data.error as string) ?? (data.detail as string) ?? `Lỗi ${res.status}`);
    }
    return data as T;
  }
  async function apiPut(url: string, body: unknown): Promise<void> {
    const { res, data } = await safeFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      throw new Error((data.error as string) ?? `Lỗi ${res.status}`);
    }
  }

  // ── Đóng ngăn / dọn tệp mồ côi ──
  // Tệp tài liệu lên NGAY khi thả (đã `complete`), nên đóng ngăn mà không Lưu sẽ để lại FileAsset không thuộc bài nào. Không có API quét nền:
  // xoá best-effort tại đây (lỗi xoá bị bỏ qua); phần còn sót vẫn nằm ở "Thư viện của tôi" và tính vào hạn mức.
  function discardUploads(keepIn?: string) {
    const ids = sessionUploads.current; sessionUploads.current = [];
    for (const id of ids) {
      if (keepIn && keepIn.includes(`/api/media/${id}/file`)) continue;
      void fetch(`/api/media/document/${id}`, { method: "DELETE", credentials: "same-origin" }).catch(() => {});
    }
  }
  function closePanel() { discardUploads(); setPanel({ type: "none" }); }

  // ── Save panel (calls API) ──
  // Danh sách tài liệu chuẩn hoá (đã gồm cả tệp tải lên lúc thả lẫn link dán).
  function documentsJson(): string {
    const existing: DocItem[] = (() => { try { return JSON.parse(ls.documentsRaw || "[]"); } catch { return []; } })();
    return JSON.stringify(existing);
  }

  async function savePanel() {
    if (panel.type === "none") return;
    setSaving(true);
    try {
      if (panel.type === "add-section") {
        if (!title.trim()) return;
        const section = await apiPost<SectionDB>(`/api/courses/${courseSlug}/sections`, { title: title.trim() });
        setSections(p => [...p, { ...section, chapters: [] }]);
        setExpanded(p => ({ ...p, sections: new Set([...p.sections, section.id]) }));
        flash(`Đã thêm phần "${section.title}"`);

      } else if (panel.type === "edit-section") {
        if (!title.trim()) return;
        await apiPut(`/api/sections/${panel.sectionId}`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId ? { ...s, title: title.trim() } : s));
        flash("Đã cập nhật tên phần");

      } else if (panel.type === "add-chapter") {
        if (!title.trim()) return;
        const chapter = await apiPost<ChapterDB>(`/api/sections/${panel.sectionId}/chapters`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: [...s.chapters, { ...chapter, lessons: [] }] } : s));
        setExpanded(prev => ({ ...prev, chapters: new Set([...prev.chapters, chapter.id]) }));
        flash(`Đã thêm chương "${chapter.title}"`);

      } else if (panel.type === "edit-chapter") {
        if (!title.trim()) return;
        await apiPut(`/api/chapters/${panel.chapterId}`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === panel.chapterId ? { ...c, title: title.trim() } : c) } : s));
        flash("Đã cập nhật chương");

      } else if (panel.type === "add-lesson") {
        if (!ls.title.trim()) return;
        { const bad = firstBadLink(ls); if (bad) { alert(bad); return; } }
        const documents = documentsJson();
        const lesson = await apiPost<LessonDB>(`/api/chapters/${panel.chapterId}/lessons`, {
          title: ls.title.trim(), type: serializeTypes(deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls)),
          videoUrl: serializeUrls(ls.videoUrls), zoomUrl: serializeUrls(ls.zoomUrls),
          azotaUrl: serializeUrls(ls.azotaUrls), azotaDeadline: ls.azotaDeadline || null,
          duration: ls.duration || null, isLocked: ls.isLocked, isFree: ls.isFree,
          documents, adminNote: ls.adminNote || null,
        });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === panel.chapterId
            ? { ...c, lessons: [...c.lessons, lesson] } : c) } : s));
        flash(`Đã thêm bài "${lesson.title}"`);

      } else if (panel.type === "edit-lesson") {
        { const bad = firstBadLink(ls); if (bad) { alert(bad); return; } }
        const vUrl = serializeUrls(ls.videoUrls);
        const zUrl = serializeUrls(ls.zoomUrls);
        const aUrl = serializeUrls(ls.azotaUrls);
        const documents = documentsJson();
        await apiPut(`/api/lessons/${panel.lessonId}`, {
          title: ls.title.trim(), type: serializeTypes(deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls)), videoUrl: vUrl, zoomUrl: zUrl, azotaUrl: aUrl,
          azotaDeadline: ls.azotaDeadline || null,
          duration: ls.duration || null, isLocked: ls.isLocked, isFree: ls.isFree,
          documents, adminNote: ls.adminNote || null,
        });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === panel.chapterId
            ? { ...c, lessons: c.lessons.map(l => l.id === panel.lessonId
              ? { ...l, title: ls.title.trim(), type: serializeTypes(deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls)) as LessonDB["type"], videoUrl: vUrl,
                  zoomUrl: zUrl, azotaUrl: aUrl, azotaDeadline: ls.azotaDeadline || null,
                  duration: ls.duration || null, isLocked: ls.isLocked, isFree: ls.isFree,
                  documents, adminNote: ls.adminNote || null }
              : l) }
            : c) }
          : s));
        flash("Đã cập nhật bài học");
      }
      // Đã lưu: tệp đã bị bỏ khỏi danh sách trước khi lưu thì xoá, tệp còn trong bài thì giữ.
      if (panel.type.includes("lesson")) discardUploads(ls.documentsRaw);
      setPanel({ type: "none" });
    } catch (e) {
      alert("Lỗi: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete (calls API) ──
  async function delConfirm() {
    if (!del) return;
    try {
      if (del.kind === "section") {
        const res = await fetch(`/api/sections/${del.sectionId}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Lỗi ${res.status}`); }
        setSections(p => p.filter(s => s.id !== del.sectionId));
      } else if (del.kind === "chapter") {
        const res = await fetch(`/api/chapters/${del.chapterId}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Lỗi ${res.status}`); }
        setSections(p => p.map(s => s.id === del.sectionId
          ? { ...s, chapters: s.chapters.filter(c => c.id !== del.chapterId) } : s));
      } else if (del.kind === "lesson") {
        const res = await fetch(`/api/lessons/${del.lessonId}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Lỗi ${res.status}`); }
        setSections(p => p.map(s => s.id === del.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === del.chapterId
            ? { ...c, lessons: c.lessons.filter(l => l.id !== del.lessonId) } : c) }
          : s));
      }
      flash("Đã xoá thành công");
    } catch (e) {
      alert("Lỗi: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setDel(null);
    }
  }

  async function toggleLessonLock(sectionId: string, chapterId: string, lessonId: string, current: boolean) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    const l = c.lessons.find(x => x.id === lessonId)!;
    await fetch(`/api/lessons/${lessonId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !current }),
    }).catch(() => {});
    setSections(p => p.map(sec => sec.id !== sectionId ? sec : {
      ...sec, chapters: sec.chapters.map(ch => ch.id !== chapterId ? ch : {
        ...ch, lessons: ch.lessons.map(le => le.id !== lessonId ? le : { ...le, isLocked: !current }),
      }),
    }));
    void l;
  }

  // Gia sư dán nhầm ô: lấy link khỏi ô hiện tại, đưa sang ô đúng (cùng một thao tác, không gõ lại).
  function moveLink(from: MediaSlot, index: number, to: MediaSlot) {
    const keyOf = (sl: MediaSlot) => (sl === "video" ? "videoUrls" : sl === "live" ? "zoomUrls" : sl === "azota" ? "azotaUrls" : null);
    const fk = keyOf(from), tk = keyOf(to);
    if (!fk || !tk) { flash("Link tài liệu hãy thêm ở mục Tài liệu đính kèm bên dưới."); return; }
    setLs(f => {
      const src = [...f[fk]]; const [link] = src.splice(index, 1);
      const dst = [...f[tk].filter(u => u.trim()), link];
      return { ...f, [fk]: src.length ? src : [""], [tk]: dst };
    });
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

  const totals = { ch: sections.reduce((a, s) => a + s.chapters.length, 0), ls: sections.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.lessons.length, 0), 0) };

  return (
    <div>
      <Drawer open={panelIsOpen} title={panelTitle} onClose={closePanel} onSave={savePanel} saving={saving} busy={uploadBusy && isLsPanel}>
        {isTitlePanel && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <span className="text-red-500 mr-0.5">*</span>
              {panel.type.includes("section") ? "Tên phần" : "Tên chương"}
            </label>
            <input className={inp} value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && savePanel()}
              placeholder={panel.type.includes("section") ? "VD: PHẦN 1: TƯ DUY ĐỊNH LƯỢNG" : "VD: Chương 1: Đại số cơ bản"} />
          </div>
        )}
        {isLsPanel && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><span className="text-red-500 mr-0.5">*</span>Tên bài học</label>
              <input className={inp} value={ls.title}
                onChange={e => setLs(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && savePanel()}
                placeholder="VD: Buổi 1: Hệ phương trình" />
            </div>
            <DrawerToggle checked={ls.isLocked} onChange={() => setLs(f => ({ ...f, isLocked: !f.isLocked }))} label="Khoá bài (yêu cầu đăng ký)" />
            <DrawerToggle checked={ls.isFree} onChange={() => setLs(f => ({ ...f, isFree: !f.isFree }))} label="Học thử miễn phí" />
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Video & Links</p>
              <div className="space-y-4">
                <SlotLinkEditor
                  label="Link video bài giảng (YouTube, Vimeo, Google Drive)"
                  slot="video"
                  placeholder="https://youtube.com/watch?v=..."
                  urls={ls.videoUrls}
                  onChange={urls => setLs(f => ({ ...f, videoUrls: urls }))}
                  onMove={moveLink}
                  extra={<VideoUploadBox courseId={courseSlug} onUploaded={link => setLs(f => ({ ...f, videoUrls: [...f.videoUrls.filter(u => u.trim()), link] }))} />}
                />
                <SlotLinkEditor
                  label="Link phòng Zoom (cho bài trực tiếp)"
                  slot="live"
                  placeholder="https://zoom.us/j/..."
                  urls={ls.zoomUrls}
                  onChange={urls => setLs(f => ({ ...f, zoomUrls: urls }))}
                  onMove={moveLink}
                />
                <SlotLinkEditor
                  label="Link bài Azota (không bắt buộc)"
                  slot="azota"
                  placeholder="https://azota.vn/..."
                  urls={ls.azotaUrls}
                  onChange={urls => setLs(f => ({ ...f, azotaUrls: urls }))}
                  onMove={moveLink}
                />
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs text-gray-400">Loại bài:</span>
                  {deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls).map(t => {
                    const tb = TYPE_BADGE[t];
                    return <span key={t} className="px-2 py-0.5 text-xs rounded-full font-semibold" style={{ background: tb.bg, color: tb.color }}>{tb.label}</span>;
                  })}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Deadline Azota</label>
                  <input type="datetime-local" className={inp} value={ls.azotaDeadline} onChange={e => setLs(f => ({ ...f, azotaDeadline: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Thời lượng (VD: 45:00)</label>
                  <input className={inp} value={ls.duration} onChange={e => setLs(f => ({ ...f, duration: e.target.value }))} placeholder="45:00" />
                </div>
              </div>
            </div>
            <DocumentsEditor
              value={ls.documentsRaw}
              onChange={v => setLs(f => ({ ...f, documentsRaw: v }))}
              courseId={courseSlug}
              canUpload={canUpload}
              onAssetUploaded={id => { sessionUploads.current.push(id); }}
              onBusyChange={setUploadBusy}
            />
            {panel.type === "edit-lesson" && ls.azotaUrls.some(u => u.trim()) && (
              <AzotaStatusTable lessonId={panel.lessonId} />
            )}
            {panel.type === "edit-lesson" && (
              <AssignmentEditor lessonId={panel.lessonId} />
            )}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 pb-1 border-b border-gray-100">
                Ghi chú cho học viên
              </p>
              <p className="text-xs text-gray-400 mb-2">Lưu ý, hướng dẫn, hoặc thông báo hiển thị với học viên khi xem bài này.</p>
              <textarea
                className={inp + " resize-none"}
                rows={4}
                placeholder="VD: Học viên cần đọc lý thuyết chương 3 trước khi làm bài này. Nộp bài trước 23:59 ngày 31/05."
                value={ls.adminNote}
                onChange={e => setLs(f => ({ ...f, adminNote: e.target.value }))}
              />
            </div>
          </>
        )}
      </Drawer>

      <DelModal target={del} onClose={() => setDel(null)} onConfirm={delConfirm} />

      {toast && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--kin-chu-tren-nut-chinh)] flex items-center gap-2" style={{ background: "var(--kin-tt-chu-xong)" }}>
          <svg viewBox="0 0 10 8" className="w-4 h-4 flex-shrink-0"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">{sections.length} phần · {totals.ch} chương · {totals.ls} bài</p>
        <button onClick={openAddSection}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
          + Thêm phần
        </button>
      </div>

      <div className="space-y-3">
        {sections.map((section, si) => (
          <div key={section.id || `s-${si}`}
            className="border rounded-xl overflow-hidden transition-colors"
            style={{
              borderColor: dragOverKey === `s-${section.id}` ? "var(--kin-tt-chu-xong)" : "var(--kin-vien-thuong)",
              boxShadow: dragItem?.type === "section" && dragItem.sectionIdx === si ? "0 4px 16px rgba(0,0,0,0.12)" : undefined,
            }}
            draggable
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
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--kin-tt-nen-xong)" }}>
              <DragHandle />
              <button onClick={() => toggleSec(section.id)} className="text-green-700 text-xs flex-shrink-0">
                {expanded.sections.has(section.id) ? "▼" : "▶"}
              </button>
              <span className="text-sm font-bold flex-1 min-w-0 truncate" style={{ color: "var(--kin-tt-chu-xong)" }}>{section.title}</span>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openAddChapter(section.id)} className="px-2.5 py-1 text-xs rounded-lg font-medium" style={{ background: "var(--kin-nhan-nen)", color: "white" }}>+ Chương</button>
                <button onClick={() => openEditSection(section.id)} className="px-2.5 py-1 text-xs rounded-lg font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">Sửa</button>
                <button onClick={() => setDel({ kind: "section", sectionId: section.id, label: section.title })}
                  className="px-2.5 py-1 text-xs rounded-lg font-medium border border-red-200 text-red-500 hover:bg-red-50">Xóa</button>
              </div>
            </div>

            {expanded.sections.has(section.id) && (
              <div>
                {section.chapters.length === 0 && (
                  <div className="px-6 py-5 text-center">
                    <p className="text-sm text-gray-400 mb-1">Chưa có chương nào.</p>
                    <button onClick={() => openAddChapter(section.id)} className="text-sm text-green-600 hover:underline font-medium">+ Thêm chương đầu tiên</button>
                  </div>
                )}
                {section.chapters.map((chapter, ci) => (
                  <div key={chapter.id || `${section.id}-c-${ci}`}
                    className="border-t border-gray-100 transition-colors"
                    style={{ background: dragOverKey === `c-${chapter.id}` ? "var(--kin-nhan-nen-nhat)" : undefined }}
                    draggable
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
                    <div className="flex items-center gap-2 pl-8 pr-4 py-2.5 bg-[var(--kin-nen-trang)] hover:bg-gray-50 transition-colors">
                      <DragHandle />
                      <button onClick={() => toggleCh(chapter.id)} className="text-gray-400 text-xs flex-shrink-0">
                        {expanded.chapters.has(chapter.id) ? "▼" : "▶"}
                      </button>
                      <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{chapter.title}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{chapter.lessons.length} bài</span>
                      <button onClick={() => openEditChapter(section.id, chapter.id)} className="p-1 text-gray-400 hover:text-blue-600 text-xs transition-colors">Sửa</button>
                      <button onClick={() => setDel({ kind: "chapter", sectionId: section.id, chapterId: chapter.id, label: chapter.title })}
                        className="p-1 text-red-300 hover:text-red-500 text-xs transition-colors">Xóa</button>
                    </div>
                    {expanded.chapters.has(chapter.id) && (
                      <div>
                        {chapter.lessons.length === 0 && (
                          <div className="px-10 py-3 text-center">
                            <span className="text-xs text-gray-400">Chưa có bài học. </span>
                            <button onClick={() => openAddLesson(section.id, chapter.id)} className="text-xs text-blue-500 hover:underline font-medium">Thêm bài đầu tiên</button>
                          </div>
                        )}
                        {chapter.lessons.map((lesson, li) => {
                          const lessonTypes = parseTypes(lesson.type);
                          return (
                            <div key={lesson.id || `${chapter.id}-l-${li}`}
                              className="flex items-center gap-3 pl-12 pr-4 py-2.5 transition-colors"
                              style={{
                                borderTop: "1px dashed var(--kin-vien-thuong)",
                                background: dragOverKey === `l-${lesson.id}` ? "var(--kin-tt-nen-xong)" : undefined,
                              }}
                              draggable
                              onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragItem({ type: "lesson", sectionIdx: si, chapterIdx: ci, lessonIdx: li }); }}
                              onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragItem?.type === "lesson") setDragOverKey(`l-${lesson.id}`); }}
                              onDrop={e => {
                                e.preventDefault(); e.stopPropagation();
                                if (dragItem?.type === "lesson" && !(dragItem.sectionIdx === si && dragItem.chapterIdx === ci && dragItem.lessonIdx === li)) moveLessonAcross(dragItem.sectionIdx, dragItem.chapterIdx, dragItem.lessonIdx, si, ci, li);
                                setDragItem(null); setDragOverKey(null);
                              }}
                              onDragEnd={() => { setDragItem(null); setDragOverKey(null); }}
                            >
                              <DragHandle />
                              <span className="flex-1 text-sm font-medium text-gray-800 min-w-0 truncate">{lesson.title}</span>
                              {lesson.isFree && <span className="px-1.5 py-0.5 text-xs rounded font-medium flex-shrink-0" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>FREE</span>}
                              {lesson.videoUrl && <span className="px-1.5 py-0.5 text-xs rounded font-medium flex-shrink-0" style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-chu-tren-nhat)" }}>YT</span>}
                              {lesson.duration && <span className="text-xs text-gray-400 flex-shrink-0">{lesson.duration}</span>}
                              {lessonTypes.map(t => { const tb = TYPE_BADGE[t] ?? TYPE_BADGE.record; return <span key={t} className="px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0" style={{ background: tb.bg, color: tb.color }}>{tb.label}</span>; })}
                              {!lessonTypes.includes("document") && hasRealDocuments(lesson.documents) && (
                                <span className="px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0" style={{ background: TYPE_BADGE.document.bg, color: TYPE_BADGE.document.color }}>{TYPE_BADGE.document.label}</span>
                              )}
                              {!!lesson._count?.assignments && (
                                <span className="px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0" style={{ background: ASSIGNMENT_BADGE.bg, color: ASSIGNMENT_BADGE.color }}>
                                  {lesson._count.assignments} Bài tập
                                </span>
                              )}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => toggleLessonLock(section.id, chapter.id, lesson.id, lesson.isLocked)}
                                  className="p-1.5 rounded hover:bg-blue-50 transition-colors"
                                  title={lesson.isLocked ? "Mở khoá" : "Khoá bài"}
                                  style={{ color: lesson.isLocked ? "var(--kin-chu-mo)" : "var(--kin-nhan-link)" }}>
                                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                                    <rect x="3" y="7.5" width="10" height="6.5" rx="1.2"/>
                                    <path d={lesson.isLocked ? "M5.5 7.5V5.5a2.5 2.5 0 015 0v2" : "M5.5 7.5V5.5a2.5 2.5 0 015 0"}/>
                                  </svg>
                                </button>
                                <button onClick={() => openEditLesson(section.id, chapter.id, lesson.id)}
                                  className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="Sửa" style={{ color: "var(--kin-nhan-link)" }}>
                                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 2l3 3-8 8H3v-3z"/>
                                  </svg>
                                </button>
                                <button onClick={() => duplicateLesson(section.id, chapter.id, lesson.id)} disabled={saving}
                                  className="p-1.5 rounded hover:bg-green-50 transition-colors disabled:opacity-40" title="Sao chép bài" style={{ color: "var(--kin-tt-chu-xong)" }}>
                                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="5" y="5" width="8" height="9" rx="1.2"/><path d="M3 11V3a1 1 0 011-1h8"/>
                                  </svg>
                                </button>
                                <button onClick={() => setDel({ kind: "lesson", sectionId: section.id, chapterId: chapter.id, lessonId: lesson.id, label: lesson.title })}
                                  className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Xoá" style={{ color: "var(--kin-tt-chu-loi)" }}>
                                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 4.5h10M6 4.5V3h4v1.5M5.5 4.5v7.5a1 1 0 001 1h3a1 1 0 001-1V4.5"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex flex-wrap items-center gap-2 pl-8 pr-4 py-3" style={{ borderTop: "1px dashed var(--kin-vien-thuong)", background: "var(--kin-nen-bang)" }}>
                          <button onClick={() => openAddLesson(section.id, chapter.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: "var(--kin-nhan-nen)" }}>
                            + Thêm bài học
                          </button>
                          <button
                            onClick={() => chapter.lessons.length > 0 && duplicateLesson(section.id, chapter.id, chapter.lessons[chapter.lessons.length - 1].id)}
                            disabled={saving || chapter.lessons.length === 0}
                            title={chapter.lessons.length === 0 ? "Chưa có bài học để sao chép" : "Sao chép bài học cuối"}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)", color: "var(--kin-tt-chu-xong)" }}>
                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="5" y="5" width="8" height="9" rx="1.2"/><path d="M3 11V3a1 1 0 011-1h8"/>
                            </svg>
                            Sao chép bài học
                          </button>
                          <button onClick={() => openAddChapter(section.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: "var(--kin-nhan-nen)" }}>
                            + Thêm chương
                          </button>
                          <button onClick={() => duplicateChapter(section.id, chapter.id)} disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                            style={{ background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)", color: "var(--kin-tt-chu-xong)" }}>
                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="5" y="5" width="8" height="9" rx="1.2"/><path d="M3 11V3a1 1 0 011-1h8"/>
                            </svg>
                            Sao chép chương
                          </button>
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
        <button onClick={openAddSection}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors">
          + Thêm phần mới
        </button>
      </div>
    </div>
  );
}
