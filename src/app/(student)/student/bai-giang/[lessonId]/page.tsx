"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PopupBuyRequired from "@/components/PopupBuyRequired";
import { useProgress } from "@/hooks/useProgress";
import {
  Flash, Alarm, Edit, ClipboardList, Play, Pause,
  SkipBack, SkipForward, Volume, VolumeOff, Maximize,
  FileDownload, Eye, Lock, CheckCircle,
  ChevronDown, ArrowLeft, ArrowRight,
  StickyNote,
} from "griddy-icons";

// ─── Types ───────────────────────────────────────────────────────────────────
type LessonType = "record" | "live" | "quiz" | "document";

interface Material { name: string; url: string; type?: string }

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
// enrolled=true: admin hoặc đã mua; false: xem bài free chưa mua
interface LessonContext { lesson: DBLesson; course: DBCourse; enrolled: boolean }

// API đã normalise isLocked: enrolled→false, not-enrolled→!isFree.
// Chỉ cần map 1-1, không tính lại ở frontend.
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
        isLocked:    l.isLocked,
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

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VideoPlayer({ videoUrl, userEmail, duration, onAutoComplete, lessonId }: {
  videoUrl?: string | null;
  userEmail?: string;
  duration?: string;
  onAutoComplete?: () => void;
  lessonId?: string;
}) {
  const ytId         = videoUrl ? extractYouTubeId(videoUrl) : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef   = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef      = useRef<any>(null);
  const firedRef        = useRef(false);
  const syncTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady]     = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal]     = useState(0);
  const [muted, setMuted]     = useState(false);
  const [volume, setVolume]   = useState(100);

  // Luôn dùng 1 loại player (YT.Player + control bar tự dựng) bất kể có
  // onAutoComplete hay không — trước đây đổi hẳn sang <iframe> thường khi
  // isCompleted=true khiến React unmount player cũ, video bị reset về đầu
  // đúng lúc vừa đạt 80% (mất vị trí đang xem).
  useEffect(() => {
    if (!ytId || !containerRef.current) return;
    firedRef.current = false;

    // YT.Player thay hẳn node được truyền vào bằng 1 iframe khác — nếu truyền
    // thẳng containerRef.current (node do React quản lý), lần effect chạy lại
    // thứ 2 do React Strict Mode (dev) sẽ gắn player vào 1 node đã bị thay thế
    // ở lượt trước, hỏng luôn playerRef (thiếu hẳn method như playVideo). Tạo
    // 1 node con mới, dùng-1-lần cho mỗi lượt effect để tránh việc này.
    const mountEl = document.createElement("div");
    mountEl.style.width = "100%";
    mountEl.style.height = "100%";
    containerRef.current.appendChild(mountEl);

    function createPlayer() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playerRef.current = new (window as any).YT.Player(mountEl, {
        videoId:    ytId,
        // controls:0 tắt hẳn thanh điều khiển/logo YouTube gốc — control bar
        // hiển thị cho học viên là tự dựng bên dưới, gọi qua JS API.
        playerVars: {
          rel: 0, modestbranding: 1, controls: 0, disablekb: 1,
          playsinline: 1, showinfo: 0, iv_load_policy: 3, cc_load_policy: 0,
        },
        events: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady(e: any) {
            setReady(true);
            setTotal(e.target.getDuration());
            setVolume(e.target.getVolume());
          },
          onStateChange(e: { data: number }) {
            const isPlaying = e.data === 1; // YT.PlayerState.PLAYING
            setPlaying(isPlaying);

            if (isPlaying) {
              // Đồng bộ thanh trượt/thời gian hiển thị
              syncTimerRef.current = setInterval(() => {
                if (!playerRef.current || typeof playerRef.current.getCurrentTime !== "function") return;
                setCurrent(playerRef.current.getCurrentTime());
                setTotal(playerRef.current.getDuration());
              }, 500);

              // Track 80% auto-complete
              if (onAutoComplete) {
                completeTimerRef.current = setInterval(() => {
                  if (!playerRef.current || firedRef.current) {
                    if (completeTimerRef.current) clearInterval(completeTimerRef.current);
                    return;
                  }
                  if (typeof playerRef.current.getCurrentTime !== "function" || typeof playerRef.current.getDuration !== "function") {
                    return;
                  }
                  const ratio = playerRef.current.getCurrentTime() / playerRef.current.getDuration();
                  if (ratio >= 0.8) {
                    firedRef.current = true;
                    if (completeTimerRef.current) clearInterval(completeTimerRef.current);
                    onAutoComplete?.();
                  }
                }, 2000);
              }

              // Save watchedSeconds mỗi 30 giây
              if (lessonId) {
                saveTimerRef.current = setInterval(() => {
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
              if (syncTimerRef.current)     clearInterval(syncTimerRef.current);
              if (completeTimerRef.current) clearInterval(completeTimerRef.current);
              if (saveTimerRef.current)     clearInterval(saveTimerRef.current);
            }
          },
        },
      });
    }

    let cancelled = false;

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
        if (!cancelled) createPlayer();
      };
    }

    return () => {
      cancelled = true;
      if (syncTimerRef.current)     clearInterval(syncTimerRef.current);
      if (completeTimerRef.current) clearInterval(completeTimerRef.current);
      if (saveTimerRef.current)     clearInterval(saveTimerRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
      mountEl.remove();
      setReady(false);
    };
    // onAutoComplete cố ý không nằm trong deps — chỉ đọc giá trị mới nhất qua
    // closure, không cần huỷ/tạo lại player khi cờ isCompleted đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId, lessonId]);

  function togglePlay() {
    if (!ready || !playerRef.current) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }
  function skip(delta: number) {
    if (!ready || !playerRef.current || typeof playerRef.current.getCurrentTime !== "function") return;
    const next = Math.max(0, Math.min(total, playerRef.current.getCurrentTime() + delta));
    playerRef.current.seekTo(next, true);
    setCurrent(next);
  }
  function seekTo(sec: number) {
    if (!ready || !playerRef.current) return;
    playerRef.current.seekTo(sec, true);
    setCurrent(sec);
  }
  function toggleMute() {
    if (!ready || !playerRef.current) return;
    if (muted) { playerRef.current.unMute(); setMuted(false); }
    else { playerRef.current.mute(); setMuted(true); }
  }
  function changeVolume(v: number) {
    if (!ready || !playerRef.current) return;
    playerRef.current.setVolume(v);
    setVolume(v);
    if (v === 0) { playerRef.current.mute(); setMuted(true); }
    else if (muted) { playerRef.current.unMute(); setMuted(false); }
  }
  function toggleFullscreen() {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapperRef.current.requestFullscreen();
  }

  if (ytId) {
    return (
      <div ref={wrapperRef} className="rounded-xl overflow-hidden relative bg-black"
        style={{ border: "1px solid #e5e3df" }}>
        <div className="relative" style={{ paddingBottom: "56.25%" }}>
          {/* pointer-events-none trên wrapper để click luôn đi qua control bar
              tự dựng, không lọt xuống iframe YouTube bên dưới */}
          <div className="absolute inset-0 pointer-events-none">
            <div ref={containerRef} className="w-full h-full" />
          </div>
          {userEmail && (
            <div className="absolute bottom-12 right-4 text-xs opacity-10 select-none pointer-events-none rotate-[-15deg] z-10"
              style={{ color: "#fff" }}>
              {userEmail}
            </div>
          )}
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {/* Control bar tự dựng — thay thế hoàn toàn control bar gốc của YouTube
              (đã tắt bằng controls=0) nên không còn logo/link "Watch on YouTube". */}
          <div className="absolute inset-x-0 bottom-0 z-20 px-3 py-2 flex items-center gap-2"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))" }}>
            <button type="button" onClick={() => skip(-10)} className="text-white/90 hover:text-white p-1" aria-label="Lùi 10 giây">
              <SkipBack size={18} />
            </button>
            <button type="button" onClick={togglePlay} className="text-white p-1" aria-label={playing ? "Tạm dừng" : "Phát"}>
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button type="button" onClick={() => skip(10)} className="text-white/90 hover:text-white p-1" aria-label="Tiến 10 giây">
              <SkipForward size={18} />
            </button>
            <input
              type="range" min={0} max={total || 0} step={0.5} value={current}
              onChange={e => seekTo(+e.target.value)}
              className="flex-1 accent-white h-1 cursor-pointer"
              aria-label="Thanh trượt video"
            />
            <span className="text-white/90 text-xs tabular-nums whitespace-nowrap">
              {formatTime(current)} / {formatTime(total)}
            </span>
            <button type="button" onClick={toggleMute} className="text-white/90 hover:text-white p-1" aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}>
              {muted || volume === 0 ? <VolumeOff size={18} /> : <Volume size={18} />}
            </button>
            <input
              type="range" min={0} max={100} step={1} value={muted ? 0 : volume}
              onChange={e => changeVolume(+e.target.value)}
              className="w-16 accent-white h-1 cursor-pointer hidden sm:block"
              aria-label="Âm lượng"
            />
            <button type="button" onClick={toggleFullscreen} className="text-white/90 hover:text-white p-1" aria-label="Toàn màn hình">
              <Maximize size={18} />
            </button>
          </div>
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
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: "#6B7280" }}>Tài liệu:</p>
      <div className="space-y-1.5">
        {materials.map((m, i) => (
          <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 hover:underline"
            style={{ color: "#00A63D" }}>
            <FileDownload size={16} style={{ flexShrink: 0 }} />
            <span className="text-sm font-medium truncate">{m.name}</span>
          </a>
        ))}
      </div>
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
            <span className="text-xs font-bold" style={{ color: "#92400E" }}>Lưu ý từ gia sư</span>
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

// ─── Left Sidebar (HSA-style) ────────────────────────────────────────────────
function LeftCourseSidebar({ sections, currentId, onSelect, completedIds, courseId, courseName, isOpen, onToggle, mobile = false }: {
  sections: Section[]; currentId: string;
  onSelect: (l: ChapterLesson) => void;
  completedIds: Set<string>;
  courseId: string; courseName: string;
  isOpen: boolean; onToggle: () => void;
  mobile?: boolean;
}) {
  const [openSections, setOpenSections] = useState(() => new Set(
    sections.filter(s => s.chapters.some(c => c.lessons.some(l => l.id === currentId))).map(s => s.id)
  ));

  function toggleSection(id: string) {
    setOpenSections(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const allLessons = useMemo(() => sections.flatMap(s => s.chapters.flatMap(c => c.lessons)), [sections]);
  const completedCount = allLessons.filter(l => completedIds.has(l.id)).length;
  const pct = Math.round(completedCount * 100 / Math.max(allLessons.length, 1));

  return (
    <div className={mobile ? "flex flex-col w-full" : "hidden xl:flex flex-shrink-0"}>
      {/* Panel */}
      <div
        className="flex flex-col overflow-hidden transition-all duration-250"
        style={mobile ? { width: "100%", background: "#ffffff" } : {
          width: isOpen ? 268 : 0,
          borderRight: isOpen ? "1px solid #e5e3df" : "none",
          background: "#ffffff",
          position: "sticky",
          top: 64,
          height: "calc(100vh - 64px)",
        }}>
        {(isOpen || mobile) && (
          <div className={mobile ? "w-full flex flex-col" : "w-[268px] flex flex-col h-full"}>
            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid #e5e3df" }}>
              <Link href={`/student/hoc-tap?course=${courseId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold mb-3 hover:opacity-70 transition-opacity"
                style={{ color: "#787671" }}>
                ← Khóa học
              </Link>
              <p className="text-sm font-extrabold leading-snug line-clamp-2" style={{ color: "#1E2938" }}>{courseName}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#e5e3df" }}>
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: "#0068FF" }} />
                </div>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#787671" }}>
                  {completedCount}/{allLessons.length}
                </span>
              </div>
            </div>

            {/* Section list */}
            <div className="flex-1 overflow-y-auto">
              {sections.map((section) => {
                const lessons = section.chapters.flatMap(c => c.lessons);
                const done    = lessons.filter(l => completedIds.has(l.id)).length;
                const secOpen = openSections.has(section.id);
                return (
                  <div key={section.id}>
                    {/* Section header */}
                    <button onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
                      style={{ background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold uppercase tracking-wide leading-tight" style={{ color: "#1E2938" }}>
                          {section.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{done}/{lessons.length} bài</p>
                      </div>
                      <ChevronDown size={13} style={{ color: "#9CA3AF", transform: secOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                    </button>

                    {secOpen && (
                      <div>
                        {section.chapters.map((chapter, ci) => (
                          <div key={chapter.id}>
                            {/* Chapter sub-label (only if >1 chapter in section) */}
                            {section.chapters.length > 1 && (
                              <div className="px-4 py-1.5" style={{ background: "#fafaf9", borderBottom: "1px solid #f0ede9" }}>
                                <p className="text-xs font-semibold" style={{ color: "#9CA3AF" }}>
                                  {ci + 1}. {chapter.title}
                                </p>
                              </div>
                            )}
                            {chapter.lessons.map((lesson) => {
                              const isCurrent = lesson.id === currentId;
                              const isDone    = completedIds.has(lesson.id);
                              return (
                                <button key={lesson.id}
                                  onClick={() => onSelect(lesson)}
                                  disabled={lesson.isLocked}
                                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors"
                                  style={{
                                    background: isCurrent ? "#EFF6FF" : "transparent",
                                    borderLeft: isCurrent ? "3px solid #0068FF" : "3px solid transparent",
                                    borderBottom: "1px solid #f0ede9",
                                    opacity: lesson.isLocked ? 0.55 : 1,
                                    cursor: lesson.isLocked ? "not-allowed" : "pointer",
                                  }}>
                                  {/* Circle */}
                                  <div className="flex-shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
                                    style={{
                                      borderColor: isDone ? "#00A63D" : isCurrent ? "#0068FF" : "#d1d5db",
                                      background: isDone ? "#00A63D" : isCurrent ? "#0068FF" : "transparent",
                                    }}>
                                    {isDone && (
                                      <svg viewBox="0 0 10 8" width="8" height="8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                    {!isDone && isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    {lesson.isLocked && <Lock size={8} style={{ color: "#9CA3AF" }} />}
                                  </div>

                                  {/* Text */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs leading-snug"
                                      style={{ color: isCurrent ? "#0068FF" : "#37352f", fontWeight: isCurrent ? 700 : 500 }}>
                                      {lesson.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <TypeBadge type={lesson.type} small />
                                      {lesson.stats.views > 0 && (
                                        <span className="text-xs flex items-center gap-0.5" style={{ color: "#c8c4be" }}>
                                          <Eye size={9} />{lesson.stats.views.toLocaleString()}
                                        </span>
                                      )}
                                      {lesson.isFree && !lesson.isLocked && (
                                        <span className="text-xs font-bold px-1.5 rounded-full" style={{ background: "#d1fae5", color: "#00A63D" }}>FREE</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Toggle tab — desktop only */}
      {!mobile && (
        <button onClick={onToggle}
          className="flex-shrink-0 self-start mt-10 flex items-center justify-center rounded-r-lg text-sm font-bold transition-colors hover:bg-[#e5e3df]"
          style={{
            width: 16, height: 48,
            background: "#f6f5f4",
            border: "1px solid #e5e3df",
            borderLeft: "none",
            color: "#787671",
            writingMode: "horizontal-tb",
          }}>
          {isOpen ? "‹" : "›"}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonPage({ params: paramsPromise }: { params: Promise<{ lessonId: string }> }) {
  const params = React.use(paramsPromise);
  const router = useRouter();
  const [showBuyPopup, setShowBuyPopup] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { completedIds, markComplete, unmarkComplete } = useProgress();

  useEffect(() => {
    const saved = localStorage.getItem("lessonSidebar");
    if (saved !== null) setSidebarOpen(saved === "1");
  }, []);

  function toggleSidebar() {
    setSidebarOpen(v => {
      localStorage.setItem("lessonSidebar", v ? "0" : "1");
      return !v;
    });
  }

  const [ctx, setCtx]               = useState<LessonContext | null>(null);
  const [ctxStatus, setCtxStatus]   = useState<number | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  useEffect(() => {
    setCtxLoading(true);
    setCtx(null);
    setCtxStatus(null);
    fetch(`/api/lessons/${params.lessonId}/context`)
      .then(async r => {
        setCtxStatus(r.status);
        return r.ok ? r.json() : null;
      })
      .then(data => setCtx(data))
      .catch(() => setCtxStatus(500))
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
    const isForbidden = ctxStatus === 403;
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: isForbidden ? "#FFF7ED" : "#f6f5f4" }}>
          {isForbidden
            ? <Lock size={28} style={{ color: "#FE9900" }} />
            : <FileDownload size={28} style={{ color: "#9CA3AF" }} />
          }
        </div>
        <div>
          <p className="text-lg font-extrabold mb-1" style={{ color: "#1E2938" }}>
            {isForbidden ? "Bài học này yêu cầu mua khóa học" : "Không tìm thấy bài học"}
          </p>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>
            {isForbidden
              ? "Bạn chưa đăng ký khóa học này. Vui lòng mua khóa học để truy cập."
              : "Bài học không tồn tại hoặc đã bị xóa."}
          </p>
        </div>
        <div className="flex gap-3">
          {isForbidden ? (
            <Link href="/khoa-hoc"
              className="px-4 py-2 text-sm font-bold text-white rounded-xl"
              style={{ background: "#FE9900" }}>
              Xem các khóa học
            </Link>
          ) : (
            <Link href="/student"
              className="px-4 py-2 text-sm font-bold text-white rounded-xl"
              style={{ background: "#0068FF" }}>
              ← Về trang học
            </Link>
          )}
          <Link href="/student"
            className="px-4 py-2 text-sm font-semibold rounded-xl"
            style={{ border: "1px solid #e5e3df", color: "#787671" }}>
            Tổng quan
          </Link>
        </div>
      </div>
    );
  }

  const dbLesson  = ctx.lesson;
  const dbCourse  = ctx.course;
  const enrolled  = ctx.enrolled;

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

  function handleSelectLesson(l: ChapterLesson) {
    if (l.isLocked) { setShowBuyPopup(true); return; }
    router.push(`/student/bai-giang/${l.id}`);
  }

  const completedCount = allLessons.filter(l => completedIds.has(l.id)).length;
  const isCompleted    = completedIds.has(params.lessonId);

  return (
    <div className="-mx-4 md:-mx-8 -my-6">
      {showBuyPopup && (
        <PopupBuyRequired
          courseName={dbCourse.name}
          price={dbCourse.price}
          originalPrice={dbCourse.originalPrice ?? 0}
          trialLessonsLeft={0}
          onClose={() => setShowBuyPopup(false)}
        />
      )}

      {/* Full-width flex layout: sidebar + content */}
      <div className="flex min-h-screen">

        {/* ── LEFT SIDEBAR (desktop only) ── */}
        <LeftCourseSidebar
          sections={sections}
          currentId={lesson.id}
          onSelect={handleSelectLesson}
          completedIds={completedIds}
          courseId={dbCourse.id}
          courseName={dbCourse.name}
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
        />

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0 px-4 md:px-6 py-5 space-y-4">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "#9CA3AF" }}>
            <Link href="/student" style={{ color: "#0068FF" }}>Tổng quan</Link>
            <span>/</span>
            <Link href={`/student/hoc-tap?course=${dbCourse.id}`} style={{ color: "#0068FF" }}>{dbCourse.name}</Link>
            <span>/</span>
            <span style={{ color: "#1E2938" }} className="truncate max-w-[200px]">{lesson.title}</span>
          </div>

          {/* Content by type */}
          {lesson.type === "record" && (
            <VideoPlayer
              videoUrl={videoUrl}
              duration={lesson.duration}
              lessonId={params.lessonId}
              onAutoComplete={!isCompleted ? () => markComplete(params.lessonId) : undefined}
            />
          )}
          {lesson.type === "live"     && <LiveContent zoomUrl={lesson.zoomUrl ?? undefined} />}
          {lesson.type === "quiz"     && <QuizContent azotaUrl={lesson.azotaUrl ?? undefined} deadline={lesson.azotaDeadline} />}
          {lesson.type === "document" && <QuizContent />}

          {/* Lesson info */}
          <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
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

          {/* Bài tập */}
          {lesson.type !== "quiz" && (
            <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
                <Edit size={14} style={{ color: "#FE9900" }} />
                <span className="text-xs font-bold" style={{ color: "#FE9900" }}>Bài tập</span>
              </div>
              <div className="p-4"><TabBaiTap azotaUrl={lesson.azotaUrl ?? undefined} deadline={lesson.azotaDeadline} /></div>
            </div>
          )}

          {/* Tài liệu */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
              <FileDownload size={14} style={{ color: "#0068FF" }} />
              <span className="text-xs font-bold" style={{ color: "#0068FF" }}>Tài liệu</span>
            </div>
            <div className="p-4"><TabTaiLieu materials={lesson.materials} /></div>
          </div>

          {/* Ghi chú */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#e5e3df" }}>
              <StickyNote size={14} style={{ color: "#6B7280" }} />
              <span className="text-xs font-bold" style={{ color: "#6B7280" }}>Ghi chú</span>
            </div>
            <div className="p-4"><TabGhiChu lessonId={params.lessonId} adminNote={dbLesson.adminNote} /></div>
          </div>

          {/* Security */}
          <div className="rounded-xl p-3" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#00A63D" }} />
              <span className="text-xs font-semibold" style={{ color: "#00A63D" }}>Đang theo dõi phiên học</span>
            </div>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Heartbeat · Thiết bị 1/2 · AES-128</p>
          </div>

          {/* Prev / Next */}
          <div className="flex gap-3 pb-6">
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
      </div>

      {/* Mobile outline toggle */}
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
              <LeftCourseSidebar
                sections={sections} currentId={lesson.id}
                onSelect={(l) => { handleSelectLesson(l); setOutlineOpen(false); }}
                completedIds={completedIds}
                courseId={dbCourse.id} courseName={dbCourse.name}
                isOpen={true} onToggle={() => setOutlineOpen(false)}
                mobile
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
