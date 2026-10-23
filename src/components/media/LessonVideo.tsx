"use client";

// Trình phát video bài giảng cho HỌC SINH. Nhận cột Lesson.videoUrl (chuỗi hoặc JSON mảng) và chọn cách phát AN TOÀN theo loại link
// (src/lib/mediaLink.ts): YouTube (Plyr), Vimeo / Google Drive (iframe sandbox, địa chỉ do KiN dựng lại từ mã), video tải lên KiN
// (<video> trỏ /api/media/<mã>/stream, mỗi lượt đều kiểm quyền), còn lại mở tab mới. KHÔNG bao giờ đưa nguyên link người dùng vào iframe.
// Xem tiếp từ giây đã lưu (startAt), lưu vị trí xem 30 giây một lần (PATCH /api/progress/[lessonId], không đánh dấu xong),
// tự đánh dấu xong khi xem ≥ 80%, và mở ra `control` để ô Ghi chú ghim mốc / nhảy tới mốc.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { firstPlayableVideo, parseLinkList, classifyMediaLink, type MediaLinkInfo } from "@/lib/mediaLink";
import "plyr/dist/plyr.css";

export interface PlayerControl {
  /** Giây đang xem; null khi nguồn không cho đọc (Vimeo/Drive nhúng). */
  getTime: () => number | null;
  seek: (seconds: number) => void;
}

const PLYR_CONTROLS = ["play-large", "rewind", "play", "fast-forward", "progress", "current-time", "duration", "mute", "volume", "settings", "pip", "airplay", "fullscreen"];
const SUBTITLES_KEY = "lessonSubtitlesOn";
const SAVE_EVERY_MS = 30_000;
/** Chỉ xem tiếp khi đã xem quá 5 giây (đỡ nhảy lung tung) và chưa gần hết (cách cuối ≥ 10 giây, nếu biết độ dài). */
export function resumePoint(startAt: number | null | undefined, durationSec?: number): number {
  if (!startAt || startAt < 5) return 0;
  if (durationSec && durationSec > 0 && startAt > durationSec - 10) return 0;
  return Math.floor(startAt);
}

interface Props {
  videoUrl?: string | null;
  lessonId: string;
  userEmail?: string;
  startAt?: number | null;
  onAutoComplete?: () => void;
  /** Báo ra ngoài bộ điều khiển (null khi nguồn không điều khiển được / khi huỷ). */
  onControl?: (c: PlayerControl | null) => void;
}

function saveProgress(lessonId: string, seconds: number, keepalive = false) {
  if (!(seconds >= 0)) return;
  fetch(`/api/progress/${lessonId}`, {
    method: "PATCH", credentials: "same-origin", keepalive,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ watchedSeconds: Math.floor(seconds) }),
  }).catch(() => {});
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl overflow-hidden relative" style={{ border: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" }}>{children}</div>;
}

function Empty({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-xl p-8 text-center" role="status" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <p className="text-sm font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>{title}</p>
      <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>{body}</p>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center mt-4 px-5 text-sm font-bold rounded-lg"
          style={{ minHeight: 44, background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>{cta ?? "Mở ở tab mới"}</a>
      )}
    </div>
  );
}

function Watermark({ email }: { email?: string }) {
  if (!email) return null;
  return <div className="absolute bottom-14 right-4 text-xs opacity-10 select-none pointer-events-none rotate-[-15deg] z-10" style={{ color: "var(--kin-chu-tren-nut-chinh)" }}>{email}</div>;
}

function YouTubePlayer({ info, lessonId, userEmail, startAt, onAutoComplete, onControl }: Props & { info: MediaLinkInfo }) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const firedRef = useRef(false);
  const onDoneRef = useRef(onAutoComplete);
  const startRef = useRef(startAt);
  // Component chỉ dựng ở trình duyệt (trang tải dữ liệu bài xong mới render nó) nên đọc localStorage ngay khi khởi tạo là an toàn.
  const [subtitlesOn, setSubtitlesOn] = useState(() => { try { return localStorage.getItem(SUBTITLES_KEY) === "1"; } catch { return false; } });
  const subRef = useRef(subtitlesOn);
  useEffect(() => { onDoneRef.current = onAutoComplete; subRef.current = subtitlesOn; startRef.current = startAt; });
  const ytId = info.id;

  function applyCaptions(on: boolean) {
    const yt = playerRef.current?.embed;
    if (!yt) return;
    try { if (on) yt.loadModule("captions"); else yt.unloadModule("captions"); } catch { /* module chưa sẵn sàng */ }
  }
  function toggleSubtitles() {
    const next = !subtitlesOn;
    setSubtitlesOn(next);
    try { localStorage.setItem(SUBTITLES_KEY, next ? "1" : "0"); } catch { /* bỏ qua */ }
    applyCaptions(next);
  }

  useEffect(() => {
    if (!ytId || !elRef.current) return;
    firedRef.current = false;
    let destroyed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    import("plyr").then(({ default: PlyrCtor }) => {
      if (destroyed || !elRef.current) return;
      const player = new PlyrCtor(elRef.current, { controls: PLYR_CONTROLS, settings: ["speed"], iconUrl: "/plyr.svg", youtube: { rel: 0, modestbranding: 1, noCookie: true } });
      playerRef.current = player;
      onControl?.({ getTime: () => (Number.isFinite(player.currentTime) ? player.currentTime : null), seek: (s: number) => { try { player.currentTime = s; player.play(); } catch { /* chưa sẵn sàng */ } } });
      let resumed = false;
      player.on("ready", () => applyCaptions(subRef.current));
      player.on("loadedmetadata", () => {
        if (resumed) return; resumed = true;
        const at = resumePoint(startRef.current, player.duration);
        if (at > 0) player.currentTime = at;
      });
      player.on("timeupdate", () => {
        if (firedRef.current || !onDoneRef.current || !(player.duration > 0)) return;
        if (player.currentTime / player.duration >= 0.8) { firedRef.current = true; onDoneRef.current(); }
      });
      player.on("pause", () => saveProgress(lessonId, player.currentTime));
      timer = setInterval(() => { if (player.playing) saveProgress(lessonId, player.currentTime); }, SAVE_EVERY_MS);
    });
    return () => {
      destroyed = true;
      if (timer) clearInterval(timer);
      const p = playerRef.current;
      if (p && Number.isFinite(p.currentTime) && p.currentTime > 0) saveProgress(lessonId, p.currentTime, true);
      p?.destroy?.(); playerRef.current = null;
      onControl?.(null);
    };
    // Cố ý chỉ phụ thuộc mã video + bài: đổi startAt/onAutoComplete không được dựng lại player (sẽ giật về đầu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId, lessonId]);

  return (
    <Frame>
      <div ref={elRef} data-plyr-provider="youtube" data-plyr-embed-id={ytId ?? ""} />
      <button type="button" onClick={toggleSubtitles} aria-pressed={subtitlesOn} title={subtitlesOn ? "Tắt phụ đề" : "Bật phụ đề"}
        className="absolute top-3 right-3 z-20 px-3 rounded-lg text-xs font-bold"
        style={{ minHeight: 44, minWidth: 44, ...(subtitlesOn ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" } : { background: "rgba(0,0,0,0.55)", color: "var(--kin-nhan-chu-tren-nen)" }) }}>
        {subtitlesOn ? "Phụ đề: bật" : "Phụ đề: tắt"}
      </button>
      <Watermark email={userEmail} />
    </Frame>
  );
}

function StoredVideo({ info, lessonId, userEmail, startAt, onAutoComplete, onControl }: Props & { info: MediaLinkInfo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const firedRef = useRef(false);
  const lastSaved = useRef(0);
  const [failed, setFailed] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const src = `/api/media/${info.id}/stream`;

  useEffect(() => {
    firedRef.current = false;
    const v = ref.current;
    onControl?.({ getTime: () => (v && Number.isFinite(v.currentTime) ? v.currentTime : null), seek: (s: number) => { if (v) { v.currentTime = s; void v.play().catch(() => {}); } } });
    return () => {
      if (v && v.currentTime > 0) saveProgress(lessonId, v.currentTime, true);
      onControl?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.id, lessonId, retry]);

  if (failed !== null) {
    return (
      <div className="rounded-xl p-8 text-center" role="alert" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <p className="text-sm font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>{failed === 403 ? "Video này dành cho học sinh của lớp" : "Không phát được video"}</p>
        <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>{failed === 403 ? "Bạn chưa vào lớp có bài này." : failed === 401 ? "Phiên đăng nhập đã hết. Hãy đăng nhập lại." : "Kiểm tra mạng rồi thử lại. Nếu vẫn lỗi, nhờ gia sư kiểm tra video."}</p>
        {failed !== 403 && <button type="button" onClick={() => setRetry(n => n + 1)} className="mt-4 px-5 text-sm font-bold rounded-lg" style={{ minHeight: 44, background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>Thử lại</button>}
      </div>
    );
  }
  return (
    <Frame>
      <video key={retry} ref={ref} src={src} controls playsInline preload="metadata" controlsList="nodownload" className="w-full block" style={{ background: "var(--kin-chu-chinh)", aspectRatio: "16 / 9" }}
        onLoadedMetadata={e => { const at = resumePoint(startAt, e.currentTarget.duration); if (at > 0) e.currentTarget.currentTime = at; }}
        onTimeUpdate={e => {
          const v = e.currentTarget;
          if (!firedRef.current && onAutoComplete && v.duration > 0 && v.currentTime / v.duration >= 0.8) { firedRef.current = true; onAutoComplete(); }
          if (Math.abs(v.currentTime - lastSaved.current) >= SAVE_EVERY_MS / 1000 && !v.paused) { lastSaved.current = v.currentTime; saveProgress(lessonId, v.currentTime); }
        }}
        onPause={e => { lastSaved.current = e.currentTarget.currentTime; saveProgress(lessonId, e.currentTarget.currentTime); }}
        onError={() => { fetch(src, { method: "GET", headers: { Range: "bytes=0-0" }, credentials: "same-origin" }).then(r => setFailed(r.status === 206 || r.ok ? 500 : r.status)).catch(() => setFailed(0)); }} />
      <Watermark email={userEmail} />
    </Frame>
  );
}

export function LessonVideo(props: Props) {
  const { videoUrl, onControl } = props;
  const links = useMemo(() => parseLinkList(videoUrl), [videoUrl]);
  const main = useMemo(() => firstPlayableVideo(videoUrl), [videoUrl]);
  const others = useMemo(() => links.map(classifyMediaLink).filter(i => i.ok && i.url !== main?.url), [links, main]);
  const controllable = main?.kind === "youtube" || main?.kind === "upload";
  useEffect(() => { if (!controllable) onControl?.(null); }, [controllable, onControl]);

  if (!links.length) return <Empty title="Video chưa được cập nhật" body="Gia sư chưa gắn video cho bài này. Bạn xem tài liệu và bài tập bên dưới trước nhé." />;
  if (!main) return <Empty title="Link video chưa đọc được" body="Link gia sư gắn chưa đúng hoặc không phải loại KiN phát được. Hãy nhắn gia sư kiểm tra lại link." />;

  let player: React.ReactNode;
  if (main.kind === "youtube") player = <YouTubePlayer {...props} info={main} />;
  else if (main.kind === "upload") player = <StoredVideo {...props} info={main} />;
  else if ((main.kind === "vimeo" || main.kind === "drive") && main.embedUrl) {
    player = (
      <div className="space-y-2">
        <Frame>
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <iframe title="Video bài giảng" src={main.embedUrl} className="absolute inset-0 w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" allowFullScreen />
          </div>
          <Watermark email={props.userEmail} />
        </Frame>
        <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Video {main.label} không lưu được chỗ bạn đã xem. Xem xong, bấm &quot;Đánh dấu xong&quot; bên dưới.</p>
      </div>
    );
  } else player = <Empty title={`Video nằm trên ${main.label}`} body="KiN chưa nhúng được video này. Bấm để mở ở tab mới." href={main.url} cta="Mở video" />;

  return (
    <div className="space-y-3">
      {player}
      {main.warning && main.kind !== "upload" && <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{main.warning}</p>}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Video khác của bài">
          {others.map((o, i) => (
            <a key={i} href={o.kind === "upload" ? `/api/media/${o.id}/stream` : o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 text-xs font-semibold rounded-lg"
              style={{ minHeight: 44, border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-nhan-link)" }}>Video khác · {o.label}</a>
          ))}
        </div>
      )}
    </div>
  );
}
