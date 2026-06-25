"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PopupBuyRequired from "@/components/PopupBuyRequired";
import { useProgress } from "@/hooks/useProgress";
import {
  Flash, Alarm, Edit, ClipboardList, Play,
  FileDownload, Eye, Lock, CheckCircle,
  ChevronDown, ArrowLeft, ArrowRight,
  StickyNote,
} from "griddy-icons";

// ─── Types ───────────────────────────────────────────────────────────────────
type LessonType = "record" | "live" | "quiz" | "document";

interface Material { name: string; url: string; type: "pdf" | "doc" | "xlsx" }

interface ChapterLesson {
  id: string;
  code: string;
  title: string;
  type: LessonType;
  duration?: string;
  isCompleted: boolean;
  isLocked: boolean;
  isFree: boolean;
  stats: { videos: number; materials: number; views: number };
}

interface Chapter {
  id: string;
  title: string;
  lessons: ChapterLesson[];
}

interface Section {
  id: string;
  title: string;
  chapters: Chapter[];
}

// ─── DB types từ /api/lessons/[id]/context ────────────────────────────────────
interface DBLesson {
  id: string; code: string; title: string; type: string;
  duration?: string | null; videoUrl?: string | null;
  zoomUrl?: string | null; azotaUrl?: string | null; azotaDeadline?: string | null;
  documents?: string | null; adminNote?: string | null;
  isLocked: boolean; isFree: boolean;
  statsVideos: number; statsMaterials: number; statsViews: number;
}
interface DBChapter { id: string; title: string; order: number; lessons: DBLesson[] }
interface DBSection { id: string; title: string; order: number; chapters: DBChapter[] }
interface DBCourse {
  id: string; name: string; instructor: string; price: number; originalPrice?: number | null;
  sections: DBSection[];
}

function dbToLocalSections(dbSections: DBSection[], completedIds: Set<string>): Section[] {
  return dbSections.map(s => ({
    id: s.id,
    title: s.title,
    chapters: s.chapters.map(c => ({
      id: c.id,
      title: c.title,
      lessons: c.lessons.map(l => ({
        id:          l.id,
        code:        l.code,
        title:       l.title,
        type:        l.type as LessonType,
        duration:    l.duration ?? undefined,
        isCompleted: completedIds.has(l.id),
        isLocked:    l.isLocked && !completedIds.has(l.id),
        isFree:      l.isFree,
        stats: { videos: l.statsVideos, materials: l.statsMaterials, views: l.statsViews },
      })),
    })),
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<LessonType, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  record:   { label: "Record",   color: "#0068FF", bg: "#dbeafe", Icon: Play },
  live:     { label: "LIVE",     color: "#00A63D", bg: "#d1fae5", Icon: Flash },
  quiz:     { label: "Bài Tập",     color: "#FE9900", bg: "#fef3c7", Icon: Edit },
  document: { label: "Tài liệu", color: "#6B7280", bg: "#f3f4f6", Icon: ClipboardList },
};

function TypeBadge({ type, small }: { type: LessonType; small?: boolean }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full ${small ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1"}`}
      style={{ background: cfg.bg, color: cfg.color }}>
      <cfg.Icon size={small ? 10 : 12} />
      {cfg.label}
    </span>
  );
}

// ─── Content area by type ─────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function VideoPlayer({ videoUrl, userEmail, duration, onAutoComplete, lessonId }: {
  videoUrl?: string | null;
  userEmail?: string;
  duration?: string;
  onAutoComplete?: () => void;
  lessonId?: string;
}) {
  const ytId        = videoUrl ? extractYouTubeId(videoUrl) : null;
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef   = useRef<any>(null);
  const firedRef    = useRef(false);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ytId || !onAutoComplete || !containerRef.current) return;
    firedRef.current = false;

    function createPlayer() {
      if (!containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playerRef.current = new (window as any).YT.Player(containerRef.current, {
        videoId:    ytId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange(e: { data: number }) {
            if (e.data === 1) { // playing
              // Track 80% auto-complete
              timerRef.current = setInterval(() => {
                if (!playerRef.current || firedRef.current) {
                  clearInterval(timerRef.current!);
                  return;
                }
                if (typeof playerRef.current.getCurrentTime !== "function" || typeof playerRef.current.getDuration !== "function") {
                  return;
                }
                const ratio = playerRef.current.getCurrentTime() / playerRef.current.getDuration();
                if (ratio >= 0.8) {
                  firedRef.current = true;
                  clearInterval(timerRef.current!);
                  onAutoComplete?.();
                }
              }, 2000);

              // Save watchedSeconds mỗi 30 giây
              if (lessonId) {
                saveRef.current = setInterval(() => {
                  if (!playerRef.current || typeof playerRef.current.getCurrentTime !== "function") return;
                  const secs = Math.floor(playerRef.current.getCurrentTime());
                  fetch(`/api/progress/${lessonId}`, {
                    method:      "PATCH",
                    credentials: "same-origin",
                    headers:     { "Content-Type": "application/json" },
                    body:        JSON.stringify({ watchedSeconds: secs }),
                  }).catch(() => {});
                }, 30_000);
              }
            } else {
              if (timerRef.current) clearInterval(timerRef.current);
              if (saveRef.current)  clearInterval(saveRef.current);
            }
          },
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.YT?.Player) {
      createPlayer();
    } else {
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script");
        s.id  = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
      // Queue callbacks thay vì overwrite — tránh conflict nếu nhiều VideoPlayer
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        createPlayer();
      };
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveRef.current)  clearInterval(saveRef.current);
      playerRef.current?.destroy?.();
    };
  }, [ytId, onAutoComplete, lessonId]);

  if (ytId) {
    return (
      <div className="rounded-xl overflow-hidden relative"
        style={{ border: "1px solid #e5e3df" }}>
        <div className="relative" style={{ paddingBottom: "56.25%" }}>
          {onAutoComplete
            ? <div ref={containerRef} className="absolute inset-0 w-full h-full" />
            : <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                title="Video bài giảng"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
          }
          {userEmail && (
            <div className="absolute bottom-8 right-4 text-xs opacity-10 select-none pointer-events-none rotate-[-15deg] z-10"
              style={{ color: "#000" }}>
              {userEmail}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "#0a0a0a", border: "1px solid #e5e3df" }}>
      <div className="relative" style={{ paddingBottom: "56.25%" }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(100,100,100,0.5)" }}>
            <span className="text-3xl text-white ml-1">▶</span>
          </div>
          <p className="text-white text-xs opacity-50">Video chưa được cập nhật</p>
        </div>
        {userEmail && (
          <div className="absolute top-3 right-3 text-xs opacity-10 select-none pointer-events-none rotate-[-15deg]"
            style={{ color: "#fff" }}>
            {userEmail}
          </div>
        )}
      </div>
      {duration && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#111" }}>
          <span className="text-xs text-gray-400">Thời lượng: {duration}</span>
        </div>
      )}
    </div>
  );
}

function LiveContent({ zoomUrl }: { zoomUrl?: string | null }) {
  return (
    <div className="rounded-xl p-10 text-center"
      style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      <div className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-4"
        style={{ background: "#00A63D" }}>
        <Flash size={36} style={{ color: "white" }} />
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3"
        style={{ background: "#d1fae5", color: "#00A63D" }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#00A63D" }} />
        Buổi học LIVE
      </div>
      <h2 className="text-xl font-extrabold mb-2" style={{ color: "#1E2938" }}>
        Buổi học sắp diễn ra
      </h2>
      <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
        Buổi học sẽ diễn ra trực tiếp qua Zoom. Link phòng sẽ hiển thị 15 phút trước giờ học.
      </p>
      {zoomUrl ? (
        <a href={zoomUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block px-8 py-3 font-bold text-white text-sm"
          style={{ background: "#00A63D", borderRadius: "8px" }}>
          Vào phòng Zoom →
        </a>
      ) : (
        <button disabled className="px-8 py-3 rounded-lg font-bold text-sm"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#9CA3AF" }}>
          Chưa đến giờ học
        </button>
      )}
    </div>
  );
}

function QuizContent({ azotaUrl, deadline }: { azotaUrl?: string; deadline?: string }) {
  return (
    <div className="rounded-xl p-10 text-center"
      style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      <div className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-4"
        style={{ background: "#FE9900" }}>
        <Edit size={36} style={{ color: "white" }} />
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3"
        style={{ background: "#fef3c7", color: "#FE9900" }}>
        <Alarm size={12} /> Bài kiểm tra Azota
      </div>
      {deadline && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4 mx-2"
          style={{ background: "#fee2e2", color: "#dc2626" }}>
          <Alarm size={11} /> Deadline: {deadline}
        </div>
      )}
      <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
        Bài kiểm tra sẽ mở trong tab mới trên nền tảng Azota. Đảm bảo nộp bài trước deadline.
      </p>
      {azotaUrl ? (
        <a href={azotaUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block px-8 py-3 font-bold text-white text-sm"
          style={{ background: "#FE9900", borderRadius: "8px" }}>
          Làm bài trên Azota →
        </a>
      ) : (
        <button disabled className="px-8 py-3 rounded-lg font-bold text-sm"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#9CA3AF" }}>
          Chưa có link bài
        </button>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function TabTaiLieu({ materials }: { materials: Material[] }) {
  if (!materials.length) return (
    <div className="text-center py-8">
      <FileDownload size={28} style={{ color: "#c8c4be", margin: "0 auto 8px" }} />
      <p className="text-sm" style={{ color: "#9CA3AF" }}>Chưa có tài liệu đính kèm.</p>
    </div>
  );
  const extColor: Record<string, string> = { pdf: "#dc2626", doc: "#0068FF", xlsx: "#00A63D" };
  return (
    <div className="space-y-2">
      {materials.map((m, i) => (
        <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-xl hover:opacity-80 transition-opacity"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white"
            style={{ background: extColor[m.type] ?? "#6B7280" }}>
            {m.type.toUpperCase()}
          </div>
          <p className="text-sm font-semibold flex-1 truncate" style={{ color: "#1E2938" }}>{m.name}</p>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
            style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#0068FF" }}>
            <FileDownload size={13} /> Tải
          </div>
        </a>
      ))}
    </div>
  );
}

function TabBaiTap({ azotaUrl, deadline }: { azotaUrl?: string; deadline?: string }) {
  if (!azotaUrl) return <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Bài học này không có bài kiểm tra.</p>;
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4 flex items-center justify-between gap-4"
        style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
        <div>
          <p className="font-semibold text-sm" style={{ color: "#1E2938" }}>Quiz — Xử lý số liệu</p>
          {deadline && <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#dc2626" }}><Alarm size={11} /> Deadline: {deadline}</p>}
        </div>
        <a href={azotaUrl} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 px-4 py-2 text-xs font-bold text-white"
          style={{ background: "#FE9900", borderRadius: "8px" }}>
          Làm bài →
        </a>
      </div>
    </div>
  );
}

function TabGhiChu({ lessonId, adminNote }: { lessonId: string; adminNote?: string | null }) {
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/lesson-notes/${lessonId}`)
      .then(res => res.ok ? res.json() : { text: "" })
      .then(data => { if (!cancelled) setNote(data.text ?? ""); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lessonId]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/lesson-notes/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setNote("");
    await fetch(`/api/lesson-notes/${lessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
  }

  return (
    <div className="space-y-4">
      {adminNote && (
        <div className="rounded-xl p-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">📌</span>
            <span className="text-xs font-bold" style={{ color: "#92400E" }}>Lưu ý từ giáo viên</span>
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#78350F" }}>{adminNote}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: "#6B7280" }}>Ghi chú cá nhân (chỉ bạn thấy)</p>
        <textarea
          value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          rows={5} placeholder={loading ? "Đang tải ghi chú..." : "Ghi chú của bạn về bài học này..."}
          disabled={loading}
          className="w-full p-4 rounded-xl text-sm resize-none outline-none"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }}
        />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={handleSave} disabled={loading || saving}
            className="px-5 py-2 text-sm font-bold transition-all"
            style={{ background: saved ? "#00A63D" : "#0068FF", borderRadius: "8px", color: "white", opacity: saving ? 0.7 : 1 }}>
            {saved ? "✓ Đã lưu" : saving ? "Đang lưu..." : "Lưu ghi chú"}
          </button>
          {note && (
            <button onClick={handleClear}
              className="text-xs" style={{ color: "#9CA3AF" }}>
              Xoá
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type ScheduleItem = { type: LessonType; subject: string; topic: string; time: string; date: string };
function TabLich({ items }: { items: ScheduleItem[] }) {
  if (!items.length) return <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Không có sự kiện liên quan.</p>;
  return (
    <div className="space-y-2">
      {items.map((e: ScheduleItem, i: number) => {
        const cfg = TYPE_CONFIG[e.type];
        return (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: cfg.bg }}>
              <cfg.Icon size={17} style={{ color: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: "#1E2938" }}>{e.topic}</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>{e.date} · {e.time}</p>
            </div>
            <TypeBadge type={e.type} small />
          </div>
        );
      })}
    </div>
  );
}

// ─── Sidebar: 3-level outline ─────────────────────────────────────────────────
function CourseOutline({ sections, currentId, onSelect, completedIds = new Set() }: {
  sections: Section[];
  currentId: string;
  onSelect: (l: ChapterLesson) => void;
  completedIds?: Set<string>;
}) {
  const initialSections = useMemo(() => new Set(
    sections.filter(s => s.chapters.some(c => c.lessons.some(l => l.id === currentId))).map(s => s.id)
  ), [sections, currentId]);

  const initialChapters = useMemo(() => new Set(
    sections.flatMap(s => s.chapters).filter(c => c.lessons.some(l => l.id === currentId)).map(c => c.id)
  ), [sections, currentId]);

  const [openSections, setOpenSections] = useState<Set<string>>(initialSections);
  const [openChapters, setOpenChapters] = useState<Set<string>>(initialChapters);

  function toggleSection(id: string) {
    setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleChapter(id: string) {
    setOpenChapters(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function sectionProgress(s: Section) {
    const all = s.chapters.flatMap(c => c.lessons);
    return { done: all.filter(l => completedIds.has(l.id)).length, total: all.length };
  }

  return (
    <div className="space-y-1.5">
      {sections.map((section) => {
        const { done, total } = sectionProgress(section);
        const isOpen = openSections.has(section.id);
        return (
          <div key={section.id} className="rounded-xl overflow-hidden"
            style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            {/* Section header */}
            <button onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide leading-tight" style={{ color: "#1E2938" }}>
                  {section.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{done}/{total} bài · {Math.round(done * 100 / Math.max(total, 1))}%</p>
              </div>
              <ChevronDown size={16} style={{ color: "#9CA3AF", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
            </button>

            {/* Progress bar */}
            <div className="h-0.5 mx-4" style={{ background: "#e5e3df" }}>
              <div className="h-0.5 rounded-full" style={{ width: `${done * 100 / Math.max(total, 1)}%`, background: "#0068FF" }} />
            </div>

            {isOpen && (
              <div className="pb-2">
                {section.chapters.map((chapter) => {
                  const isChOpen = openChapters.has(chapter.id);
                  return (
                    <div key={chapter.id} className="mt-1.5 mx-2">
                      {/* Chapter header */}
                      <button onClick={() => toggleChapter(chapter.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left"
                        style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                        <p className="flex-1 text-xs font-bold truncate" style={{ color: "#4B5563" }}>{chapter.title}</p>
                        <ChevronDown size={13} style={{ color: "#9CA3AF", transform: isChOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                      </button>

                      {isChOpen && (
                        <div className="mt-1 space-y-0.5 pl-1">
                          {chapter.lessons.map((lesson) => {
                            const isCurrent = lesson.id === currentId;
                            const cfg = TYPE_CONFIG[lesson.type];
                            return (
                              <button key={lesson.id}
                                onClick={() => onSelect(lesson)}
                                disabled={lesson.isLocked}
                                className="w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all"
                                style={{
                                  background: isCurrent ? "#f6f5f4" : "transparent",
                                  borderLeft: isCurrent ? "3px solid #0068FF" : "3px solid transparent",
                                  opacity: lesson.isLocked ? 0.5 : 1,
                                  cursor: lesson.isLocked ? "not-allowed" : "pointer",
                                }}>
                                {/* Status icon */}
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{ background: completedIds.has(lesson.id) ? "#d1fae5" : isCurrent ? "#0068FF" : cfg.bg }}>
                                  {lesson.isLocked
                                    ? <Lock size={11} style={{ color: "#9CA3AF" }} />
                                    : completedIds.has(lesson.id)
                                      ? <CheckCircle size={11} style={{ color: "#065f46" }} />
                                      : <cfg.Icon size={11} style={{ color: isCurrent ? "white" : cfg.color }} />
                                  }
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-xs leading-snug font-semibold truncate"
                                    style={{ color: isCurrent ? "#0068FF" : lesson.isLocked ? "#9CA3AF" : "#1E2938" }}>
                                    {lesson.title}
                                  </p>

                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <TypeBadge type={lesson.type} small />
                                    {lesson.duration && <span className="text-xs" style={{ color: "#9CA3AF" }}>{lesson.duration}</span>}
                                    {lesson.isFree && !lesson.isLocked && (
                                      <span className="text-xs font-bold px-1.5 py-0 rounded-full" style={{ background: "#d1fae5", color: "#00A63D" }}>FREE</span>
                                    )}
                                  </div>

                                  {(lesson.stats.videos > 0 || lesson.stats.materials > 0 || lesson.stats.views > 0) && (
                                    <div className="flex items-center gap-2 mt-1">
                                      {lesson.stats.videos > 0 && (
                                        <span className="text-xs flex items-center gap-0.5" style={{ color: "#c8c4be" }}>
                                          <Play size={9} />{lesson.stats.videos}
                                        </span>
                                      )}
                                      {lesson.stats.materials > 0 && (
                                        <span className="text-xs flex items-center gap-0.5" style={{ color: "#c8c4be" }}>
                                          <FileDownload size={9} />{lesson.stats.materials}
                                        </span>
                                      )}
                                      {lesson.stats.views > 0 && (
                                        <span className="text-xs flex items-center gap-0.5" style={{ color: "#c8c4be" }}>
                                          <Eye size={9} />{lesson.stats.views.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonPage({ params: paramsPromise }: { params: Promise<{ lessonId: string }> }) {
  const params = React.use(paramsPromise);
  const router = useRouter();
  const [showBuyPopup, setShowBuyPopup] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const { completedIds, markComplete, unmarkComplete } = useProgress();

  const [ctx, setCtx]           = useState<{ lesson: DBLesson; course: DBCourse } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  useEffect(() => {
    setCtxLoading(true);
    setCtx(null);
    fetch(`/api/lessons/${params.lessonId}/context`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setCtx(data))
      .catch(() => {})
      .finally(() => setCtxLoading(false));
  }, [params.lessonId]);

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#0068FF", animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-lg font-bold" style={{ color: "#1E2938" }}>Không tìm thấy bài học</p>
        <Link href="/student/hoc-tap" className="px-4 py-2 text-sm font-bold text-white"
          style={{ background: "#0068FF", borderRadius: "8px" }}>← Về khóa học</Link>
      </div>
    );
  }

  const dbLesson = ctx.lesson;
  const dbCourse = ctx.course;

  const sections   = dbToLocalSections(dbCourse.sections, completedIds);
  const allLessons = sections.flatMap(s => s.chapters.flatMap(c => c.lessons));
  const lessonIdx  = allLessons.findIndex(l => l.id === params.lessonId);
  const rawLesson  = allLessons[lessonIdx] ?? allLessons[0];
  const prevLesson = lessonIdx > 0 ? allLessons[lessonIdx - 1] : null;
  const nextLesson = lessonIdx < allLessons.length - 1 ? allLessons[lessonIdx + 1] : null;

  const lesson = {
    ...rawLesson,
    teacherName:     dbCourse.instructor,
    views:           rawLesson?.stats.views ?? 0,
    materials:       (() => { try { return JSON.parse(dbLesson.documents ?? "[]") as Material[]; } catch { return [] as Material[]; } })(),
    azotaUrl:        dbLesson.azotaUrl ?? null,
    azotaDeadline:   dbLesson.azotaDeadline ?? "",
    zoomUrl:         dbLesson.zoomUrl ?? null,
    note:            "",
    relatedSchedule: [] as Array<{ type: LessonType; subject: string; topic: string; time: string; date: string }>,
    prevLesson,
    nextLesson,
  };

  const videoUrl = dbLesson.videoUrl ?? null;

  const cfg = TYPE_CONFIG[lesson.type];

  function handleSelectLesson(l: ChapterLesson) {
    if (l.isLocked) { setShowBuyPopup(true); return; }
    router.push(`/student/bai-giang/${l.id}`);
  }

  const completedCount = allLessons.filter(l => completedIds.has(l.id)).length;
  const isCompleted    = completedIds.has(params.lessonId);

  return (
    <div className="space-y-4">
      {showBuyPopup && (
        <PopupBuyRequired
          courseName={dbCourse.name}
          price={dbCourse.price}
          originalPrice={dbCourse.originalPrice ?? 0}
          trialLessonsLeft={0}
          onClose={() => setShowBuyPopup(false)}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "#9CA3AF" }}>
        <Link href="/student" style={{ color: "#0068FF" }}>Tổng quan</Link>
        <span>/</span>
        <Link href={`/student/hoc-tap?course=${dbCourse.id}`} style={{ color: "#0068FF" }}>{dbCourse.name}</Link>
        <span>/</span>
        <span style={{ color: "#1E2938" }} className="truncate max-w-[200px]">{lesson.title}</span>
      </div>

      {/* Desktop layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── LEFT: Main content ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Content by type */}
          {lesson.type === "record" && (
            <VideoPlayer
              videoUrl={videoUrl}
              duration={lesson.duration}
              lessonId={params.lessonId}
              onAutoComplete={!isCompleted ? () => markComplete(params.lessonId) : undefined}
            />
          )}
          {lesson.type === "live"   && <LiveContent zoomUrl={lesson.zoomUrl ?? undefined} />}
          {lesson.type === "quiz"   && <QuizContent azotaUrl={lesson.azotaUrl ?? undefined} deadline={lesson.azotaDeadline} />}
          {lesson.type === "document" && <QuizContent />}

          {/* Lesson info */}
          <div className="rounded-xl p-5"
            style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <TypeBadge type={lesson.type} />
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: "#f6f5f4", color: "#787671" }}>
                    {lesson.code}
                  </span>
                </div>
                <h1 className="text-xl font-extrabold leading-snug" style={{ color: "#1E2938" }}>{lesson.title}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs" style={{ color: "#9CA3AF" }}>
                  {lesson.teacherName && <span>{lesson.teacherName}</span>}
                  {lesson.duration && <span className="flex items-center gap-1"><Play size={11} />{lesson.duration}</span>}
                  <span className="flex items-center gap-1"><Eye size={11} />{lesson.views?.toLocaleString()} lượt xem</span>
                  {lesson.materials.length > 0 && <span className="flex items-center gap-1"><FileDownload size={11} />{lesson.materials.length} tài liệu</span>}
                </div>
              </div>
              {/* Mark complete button */}
              <button
                onClick={() => isCompleted ? unmarkComplete(params.lessonId) : markComplete(params.lessonId)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: isCompleted ? "#D1FAE5" : "#f6f5f4",
                  border: `1px solid ${isCompleted ? "#86efac" : "#e5e3df"}`,
                  color: isCompleted ? "#065F46" : "#9CA3AF",
                }}>
                <CheckCircle size={14} />
                {isCompleted ? "Đã hoàn thành ✓" : "Đánh dấu xong"}
              </button>
            </div>
          </div>

          {/* Sections — luôn hiển thị cả 3, không cần chọn tab */}
          <div className="space-y-3">
            {/* Bài tập */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
                <Edit size={14} style={{ color: "#FE9900" }} />
                <span className="text-xs font-bold" style={{ color: "#FE9900" }}>Bài tập</span>
              </div>
              <div className="p-4">
                <TabBaiTap azotaUrl={lesson.azotaUrl ?? undefined} deadline={lesson.azotaDeadline} />
              </div>
            </div>

            {/* Tài liệu */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
                <FileDownload size={14} style={{ color: "#0068FF" }} />
                <span className="text-xs font-bold" style={{ color: "#0068FF" }}>Tài liệu</span>
              </div>
              <div className="p-4">
                <TabTaiLieu materials={lesson.materials} />
              </div>
            </div>

            {/* Ghi chú */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
                <StickyNote size={14} style={{ color: "#6B7280" }} />
                <span className="text-xs font-bold" style={{ color: "#6B7280" }}>Ghi chú</span>
              </div>
              <div className="p-4">
                <TabGhiChu lessonId={params.lessonId} adminNote={dbLesson.adminNote} />
              </div>
            </div>
          </div>

          {/* Prev / Next navigation */}
          <div className="flex gap-3">
            {prevLesson ? (
              <Link href={`/student/bai-giang/${prevLesson.id}`}
                className="flex-1 p-4 rounded-xl text-left"
                style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                <p className="text-xs mb-1 flex items-center gap-1" style={{ color: "#9CA3AF" }}>
                  <ArrowLeft size={12} /> Bài trước
                </p>
                <p className="text-sm font-semibold truncate" style={{ color: "#1E2938" }}>{prevLesson.title}</p>
                <TypeBadge type={prevLesson.type} small />
              </Link>
            ) : <div className="flex-1" />}
            {nextLesson ? (
              <Link href={`/student/bai-giang/${nextLesson.id}`}
                className="flex-1 p-4 rounded-xl text-right"
                style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                <p className="text-xs mb-1 flex items-center gap-1 justify-end" style={{ color: "#9CA3AF" }}>
                  Bài tiếp <ArrowRight size={12} />
                </p>
                <p className="text-sm font-semibold truncate" style={{ color: "#1E2938" }}>{nextLesson.title}</p>
                <div className="flex justify-end mt-1"><TypeBadge type={nextLesson.type} small /></div>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-4">

          {/* Progress summary */}
          <div className="rounded-xl p-4"
            style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#1E2938" }}>Tiến độ khóa học</p>
            <p className="text-xs mb-2" style={{ color: "#9CA3AF" }}>{completedCount}/{allLessons.length} bài hoàn thành</p>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e3df" }}>
              <div className="h-2 rounded-full" style={{ width: `${completedCount * 100 / Math.max(allLessons.length, 1)}%`, background: "#0068FF" }} />
            </div>
          </div>

          {/* 3-level Course Outline */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
              <p className="text-sm font-extrabold" style={{ color: "#1E2938" }}>Nội dung khóa học</p>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <CourseOutline sections={sections} currentId={lesson.id} onSelect={handleSelectLesson} completedIds={completedIds} />
            </div>
          </div>

          {/* Unlock CTA */}
          <button onClick={() => setShowBuyPopup(true)}
            className="w-full py-3 text-sm font-bold text-white"
            style={{ background: "#FE9900", borderRadius: "8px" }}>
            Mở khóa toàn bộ khóa học
          </button>

          {/* Security */}
          <div className="rounded-xl p-3"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#00A63D" }} />
              <span className="text-xs font-semibold" style={{ color: "#00A63D" }}>Đang theo dõi phiên học</span>
            </div>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Heartbeat · Thiết bị 1/2 · AES-128</p>
          </div>
        </div>
      </div>

      {/* Mobile outline toggle (fixed bottom bar) */}
      <div className="xl:hidden fixed bottom-20 right-4 z-40">
        <button onClick={() => setOutlineOpen(v => !v)}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
          style={{ background: "#0068FF" }}>
          <StickyNote size={22} />
        </button>
      </div>

      {outlineOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOutlineOpen(false)} />
          <div className="relative rounded-t-3xl p-4 max-h-[75vh] flex flex-col"
            style={{ background: "#ffffff", borderTop: "1px solid #e5e3df" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-extrabold" style={{ color: "#1E2938" }}>Nội dung khóa học</p>
              <button onClick={() => setOutlineOpen(false)} className="text-sm" style={{ color: "#9CA3AF" }}>✕ Đóng</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <CourseOutline sections={sections} currentId={lesson.id} onSelect={(l) => { handleSelectLesson(l); setOutlineOpen(false); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
