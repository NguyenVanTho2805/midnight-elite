"use client";

// Các khối phía GIA SƯ trong màn soạn bài giảng: ô dán link có nhận diện ngay (báo lỗi sớm, gợi ý loại bài, gợi ý chuyển sang ô đúng),
// tải video lên KiN (cờ + dung lượng + loại tệp báo trước, tích xác nhận bản quyền/riêng tư, thanh tiến trình),
// và bảng "đã làm / chưa làm" bài Azota. Màu chỉ qua token --kin-*.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { checkLinkForSlot, type MediaSlot } from "@/lib/mediaLink";
import { validateVideoUpload, formatMegabytes, VIDEO_UPLOAD_NOTICE, VIDEO_EXTS, type VideoUploadConfig } from "@/lib/mediaStorage";

const ctl: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)" };
const btnPrimary: React.CSSProperties = { minHeight: 44, borderRadius: 8, background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" };
const btnGhost: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)", background: "var(--kin-nen-trang)" };

export const SLOT_LABEL: Record<MediaSlot, string> = { video: "Video bài giảng", live: "Phòng Zoom (bài trực tiếp)", azota: "Bài tập Azota", document: "Tài liệu" };

// ── Ô dán link có nhận diện ─────────────────────────────────────────────────

function LinkVerdict({ value, slot, onMove }: { value: string; slot: MediaSlot; onMove?: (to: MediaSlot) => void }) {
  if (!value.trim()) return null;
  const r = checkLinkForSlot(value, slot);
  if (!r.ok) {
    return (
      <p role="alert" className="text-xs mt-1 font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>
        {r.error}
        {r.moveTo && onMove && (
          <button type="button" onClick={() => onMove(r.moveTo!)} className="ml-2 underline font-bold" style={{ color: "var(--kin-nhan-link)", minHeight: 44 }}>
            Chuyển sang ô &quot;{SLOT_LABEL[r.moveTo]}&quot;
          </button>
        )}
      </p>
    );
  }
  return (
    <p role="status" className="text-xs mt-1" style={{ color: r.warning ? "var(--kin-tt-chu-cho)" : "var(--kin-tt-chu-xong)" }}>
      <span className="font-bold">Nhận diện: {r.info?.label}</span>{r.warning ? ` · ${r.warning}` : ""}
    </p>
  );
}

export function SlotLinkEditor({ label, slot, placeholder, urls, onChange, onMove, extra }: {
  label: string; slot: MediaSlot; placeholder: string; urls: string[]; onChange: (urls: string[]) => void;
  /** Gọi khi gia sư bấm "Chuyển sang ô đúng": cha lấy link khỏi ô này và thêm vào ô `to`. */
  onMove?: (from: MediaSlot, index: number, to: MediaSlot) => void;
  extra?: React.ReactNode;
}) {
  const update = (i: number, v: string) => { const n = [...urls]; n[i] = v; onChange(n); };
  const remove = (i: number) => { const n = urls.filter((_, k) => k !== i); onChange(n.length ? n : [""]); };
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-mo)" }}>{label}</label>
      <div className="space-y-2">
        {urls.map((u, i) => (
          <div key={i}>
            <div className="flex gap-2">
              <input className="flex-1 px-3 text-sm outline-none min-w-0" style={ctl} value={u} onChange={e => update(i, e.target.value)} placeholder={placeholder} inputMode="url" aria-label={`${label} ${urls.length > 1 ? i + 1 : ""}`.trim()} />
              {urls.length > 1 && <button type="button" onClick={() => remove(i)} aria-label="Bỏ link này" className="px-3 text-sm flex-shrink-0" style={{ ...btnGhost, color: "var(--kin-tt-chu-loi)" }}>✕</button>}
            </div>
            <LinkVerdict value={u} slot={slot} onMove={onMove ? to => onMove(slot, i, to) : undefined} />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...urls, ""])} className="mt-1 text-xs font-bold px-1" style={{ minHeight: 44, color: "var(--kin-nhan-link)" }}>+ Thêm link</button>
      {extra}
    </div>
  );
}

// ── Tải video lên KiN ───────────────────────────────────────────────────────

interface MediaConfig { video: { enabled: boolean; driver: string; maxBytes: number; reason: string | null }; document: { maxBytes: number } }
type UploadState = { phase: "idle" } | { phase: "uploading"; pct: number; name: string } | { phase: "error"; message: string };

function putWithProgress(url: string, file: File, onPct: (p: number) => void): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.withCredentials = true;
    x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    x.upload.onprogress = e => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => { let b: Record<string, unknown> = {}; try { b = JSON.parse(x.responseText); } catch { /* không phải JSON */ } resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, body: b }); };
    x.onerror = () => resolve({ ok: false, status: 0, body: {} });
    x.send(file);
  });
}

function postFormWithProgress(url: string, fields: Record<string, string>, file: File, onPct: (p: number) => void): Promise<{ ok: boolean; status: number }> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    fd.append("file", file);
    x.open("POST", url);
    x.upload.onprogress = e => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => resolve({ ok: x.status >= 200 && x.status < 300, status: x.status });
    x.onerror = () => resolve({ ok: false, status: 0 });
    x.send(fd);
  });
}

export function VideoUploadBox({ courseId, onUploaded }: { courseId: string; onUploaded: (link: string, fileName: string) => void }) {
  const [cfg, setCfg] = useState<MediaConfig | null>(null);
  const [cfgErr, setCfgErr] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [st, setSt] = useState<UploadState>({ phase: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCfg = useCallback(() => {
    fetch("/api/media/config", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: MediaConfig) => setCfg(d))
      .catch(() => setCfgErr(true));
  }, []);
  useEffect(() => { loadCfg(); }, [loadCfg]);

  if (cfgErr) {
    return <div role="alert" className="text-xs mt-2 flex items-center gap-2 flex-wrap" style={{ color: "var(--kin-tt-chu-loi)" }}>Chưa kiểm tra được tính năng tải video. <button type="button" onClick={() => { setCfgErr(false); loadCfg(); }} className="px-3 font-bold" style={btnGhost}>Thử lại</button></div>;
  }
  if (!cfg) return <p className="text-xs mt-2" role="status" style={{ color: "var(--kin-chu-mo)" }}>Đang kiểm tra tính năng tải video…</p>;
  if (!cfg.video.enabled) {
    return <p className="text-xs mt-2" role="status" style={{ color: "var(--kin-chu-mo)" }}>{cfg.video.reason ?? "Tải video lên đang tắt. Hãy dán link YouTube, Vimeo hoặc Google Drive."}</p>;
  }
  const vcfg: VideoUploadConfig = { enabled: true, driver: cfg.video.driver as VideoUploadConfig["driver"], maxBytes: cfg.video.maxBytes, reason: null };

  async function start(file: File) {
    const pre = validateVideoUpload({ name: file.name, size: file.size, type: file.type }, vcfg);
    if (!pre.ok) { setSt({ phase: "error", message: pre.error }); return; }
    if (!confirmed) { setSt({ phase: "error", message: "Hãy tích ô xác nhận bên trên trước khi tải video." }); return; }
    setSt({ phase: "uploading", pct: 0, name: file.name });
    try {
      const ir = await fetch("/api/media/video/init", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, fileName: file.name, size: file.size, mimeType: file.type, confirmedNotice: true }) });
      const init = await ir.json().catch(() => ({}));
      if (!ir.ok) { setSt({ phase: "error", message: init.error ?? "Chưa tải được. Hãy thử lại." }); return; }
      const onPct = (pct: number) => setSt({ phase: "uploading", pct, name: file.name });
      if (init.driver === "local") {
        const pr = await putWithProgress(init.upload.url, file, onPct);
        if (!pr.ok) { setSt({ phase: "error", message: (pr.body.error as string) ?? (pr.status === 0 ? "Mất kết nối khi đang tải. Hãy thử lại." : "Tải video thất bại. Hãy thử lại.") }); return; }
      } else {
        const pr = await postFormWithProgress(init.upload.url, init.upload.fields, file, onPct);
        if (!pr.ok) { setSt({ phase: "error", message: pr.status === 0 ? "Mất kết nối khi đang tải. Hãy thử lại." : "Kho video từ chối tệp này. Hãy thử lại." }); return; }
        const cr = await fetch("/api/media/video/complete", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: init.assetId }) });
        const done = await cr.json().catch(() => ({}));
        if (!cr.ok) { setSt({ phase: "error", message: done.error ?? "Chưa chốt được video. Hãy thử lại." }); return; }
      }
      setSt({ phase: "idle" });
      onUploaded(init.link as string, file.name);
    } catch { setSt({ phase: "error", message: "Mất kết nối. Hãy thử lại." }); }
  }

  const uploading = st.phase === "uploading";
  return (
    <div className="mt-3 p-3 space-y-2" style={{ border: "1px dashed var(--kin-vien-thuong)", borderRadius: 12, background: "var(--kin-nen-bang)" }}>
      <p className="text-xs font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{VIDEO_UPLOAD_NOTICE.title}</p>
      <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: "var(--kin-chu-mo)" }}>
        {VIDEO_UPLOAD_NOTICE.lines.map(l => <li key={l}>{l}</li>)}
      </ul>
      <label className="flex items-start gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--kin-chu-chinh)", minHeight: 44 }}>
        <input type="checkbox" checked={confirmed} disabled={uploading} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" style={{ width: 20, height: 20 }} />
        <span>{VIDEO_UPLOAD_NOTICE.confirmLabel}</span>
      </label>
      <input ref={fileRef} type="file" accept={VIDEO_EXTS.map(e => "." + e).join(",") + ",video/*"} className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void start(f); }} />
      <button type="button" disabled={uploading || !confirmed} onClick={() => fileRef.current?.click()} className="px-5 text-sm font-bold" style={{ ...btnPrimary, opacity: uploading || !confirmed ? 0.5 : 1 }}>
        {uploading ? "Đang tải video…" : "Tải video từ máy lên"}
      </button>
      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Nhận {VIDEO_EXTS.map(e => "." + e).join(", ")} · tối đa {formatMegabytes(vcfg.maxBytes)}.</p>
      {st.phase === "uploading" && (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={st.pct} aria-label={`Đang tải ${st.name}`}>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--kin-vien-thuong)" }}><div className="h-full" style={{ width: `${st.pct}%`, background: "var(--kin-nhan-nen)", transition: "width .2s" }} /></div>
          <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>{st.name} · {st.pct}%</p>
        </div>
      )}
      {st.phase === "error" && <p role="alert" className="text-xs font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{st.message}</p>}
    </div>
  );
}

// ── Bảng đã làm / chưa làm bài Azota ────────────────────────────────────────

interface AzotaRow { userId: string; name: string | null; done: boolean; kind: string | null; link: string | null; submittedAt: string | null }
interface AzotaStatus { total: number; done: number; rows: AzotaRow[] }

export function AzotaStatusTable({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<AzotaStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchIt = useCallback(() => {
    fetch(`/api/lessons/${lessonId}/azota-status`, { credentials: "same-origin", cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `Lỗi ${r.status}`); return r.json(); })
      .then((d: AzotaStatus) => { setData(d); setErr(null); })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [lessonId]);
  useEffect(() => { fetchIt(); }, [fetchIt]);

  return (
    <section aria-label="Học sinh đã làm bài Azota">
      <p className="text-sm font-semibold mb-2 pb-1" style={{ color: "var(--kin-chu-chinh)", borderBottom: "1px solid var(--kin-vien-nhat)" }}>
        Ai đã làm bài Azota{data ? ` · ${data.done}/${data.total}` : ""}
      </p>
      {loading ? <p className="text-xs" role="status" style={{ color: "var(--kin-chu-mo)" }}>Đang tải…</p>
        : err ? <div role="alert" className="text-xs flex items-center gap-2 flex-wrap" style={{ color: "var(--kin-tt-chu-loi)" }}>{err}<button type="button" onClick={() => { setLoading(true); fetchIt(); }} className="px-3 font-bold" style={btnGhost}>Thử lại</button></div>
        : !data || data.rows.length === 0 ? <p className="text-xs" role="status" style={{ color: "var(--kin-chu-mo)" }}>Lớp chưa có học sinh nào đang theo học.</p>
        : (
          <ul className="space-y-1.5">
            {data.rows.map(r => (
              <li key={r.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-xs" style={{ border: "1px solid var(--kin-vien-nhat)", borderRadius: 8 }}>
                <span className="font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{r.name ?? "Học sinh"}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--kin-nhan-link)" }}>Xem link</a>}
                  <span className="font-bold px-2 py-0.5 rounded-full" style={r.done ? { background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" } : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>{r.done ? "Đã làm" : "Chưa làm"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>KiN chỉ biết em tự báo đã làm; điểm Azota vẫn xem trên Azota.</p>
    </section>
  );
}
