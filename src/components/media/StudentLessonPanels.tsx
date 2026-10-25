"use client";

// Các khối của trang bài giảng phía HỌC SINH: tài liệu (xem thử + tải về), bài Azota (link + hạn + "Em đã làm xong" + dán link bài làm),
// ghi chú theo mốc thời gian. Màu chỉ qua token --kin-*; mọi khối có đủ trạng thái đang tải / lỗi (Thử lại) / rỗng.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { parseLinkList, classifyMediaLink, parseDeadlineVn, planDocumentPreview, fileExtOf, validateWorkLink, extractNoteStamps, appendStampLine, formatStamp } from "@/lib/mediaLink";
import { viewerHref } from "@/lib/library";
import type { PlayerControl } from "./LessonVideo";

const card: React.CSSProperties = { background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", borderRadius: 12 };
const btnPrimary: React.CSSProperties = { minHeight: 44, background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", borderRadius: 8 };
const btnGhost: React.CSSProperties = { minHeight: 44, border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)", borderRadius: 8, background: "var(--kin-nen-trang)" };

export interface LessonMaterial { name: string; url: string; type?: string }

/** documents lưu là chuỗi JSON mảng; hỏng/không phải mảng → rỗng (không làm trắng trang). */
export function parseMaterials(raw: string | null | undefined): LessonMaterial[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((m): m is LessonMaterial => !!m && typeof (m as LessonMaterial).url === "string" && typeof (m as LessonMaterial).name === "string");
  } catch { return []; }
}

// ── Tài liệu ────────────────────────────────────────────────────────────────

export function DocumentRows({ materials }: { materials: LessonMaterial[] }) {
  if (!materials.length) {
    return <p className="text-sm text-center py-8" role="status" style={{ color: "var(--kin-chu-mo)" }}>Chưa có tài liệu đính kèm cho bài này.</p>;
  }
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--kin-chu-mo)" }}>Tài liệu buổi học ({materials.length})</p>
      <ul className="space-y-2">
        {materials.map((m, i) => {
          const plan = planDocumentPreview(m.url);
          const ext = fileExtOf(m.url);
          const previewable = plan.mode === "iframe" || plan.mode === "image";
          const note = plan.mode === "none" ? "Đường dẫn tài liệu chưa đúng" : previewable ? (ext ? ext.toUpperCase() : "Xem trước được") : (plan.reason ?? "Mở ở tab mới");
          return (
            <li key={i} className="flex items-center gap-3 px-4 py-3" style={card}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{m.name}</p>
                <p className="text-xs truncate" style={{ color: "var(--kin-chu-mo)" }}>{note}</p>
              </div>
              {plan.mode !== "none" && (
                <a href={viewerHref(m.name, m.url)} target="_blank" rel="noopener noreferrer" aria-label={`${previewable ? "Xem thử" : "Mở"} ${m.name}`}
                  className="inline-flex items-center justify-center px-4 text-xs font-bold flex-shrink-0" style={btnGhost}>{previewable ? "Xem thử" : "Mở ở tab mới"}</a>
              )}
              {plan.downloadHref && (
                <a href={plan.downloadHref} download={m.name} rel="noopener noreferrer" aria-label={`Tải về ${m.name}`}
                  className="inline-flex items-center justify-center px-4 text-xs font-bold flex-shrink-0" style={btnPrimary}>Tải về</a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Azota ───────────────────────────────────────────────────────────────────

interface DoneState { done: boolean; kind: string | null; link: string | null; submittedAt: string | null }

export function formatDeadlineVn(raw: string | null | undefined): { text: string; overdue: boolean } | null {
  const d = parseDeadlineVn(raw);
  if (!d) return (raw ?? "").trim() ? { text: (raw ?? "").trim(), overdue: false } : null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map(x => [x.type, x.value]));
  const text = `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
  return { text, overdue: d.getTime() < Date.now() };
}

export function AzotaPanel({ lessonId, azotaUrl, deadline, canSubmit }: { lessonId: string; azotaUrl: string | null | undefined; deadline?: string | null; canSubmit: boolean }) {
  const links = useMemo(() => parseLinkList(azotaUrl).map(classifyMediaLink).filter(i => i.ok), [azotaUrl]);
  const dl = formatDeadlineVn(deadline);
  const [state, setState] = useState<DoneState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [workLink, setWorkLink] = useState("");

  const fetchState = useCallback(() => {
    fetch(`/api/lessons/${lessonId}/azota-done`, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: DoneState) => setState(d))
      .catch(() => setLoadErr(true))
      .finally(() => setLoading(false));
  }, [lessonId]);
  const load = () => { setLoading(true); setLoadErr(false); fetchState(); };
  const hasLinks = links.length > 0;
  useEffect(() => { if (hasLinks) fetchState(); }, [hasLinks, fetchState]);

  if (!links.length) {
    // Có điền link nhưng không hợp lệ (ví dụ javascript:): nói thật cho em biết, KHÔNG dựng nút/link. Rỗng hẳn thì để trang cha tự báo.
    if (!(azotaUrl ?? "").trim()) return null;
    return <p className="text-sm text-center py-8 rounded-xl" role="status" data-testid="azota-invalid" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>Link bài Azota không hợp lệ, hãy báo gia sư.</p>;
  }

  async function markDone() {
    setMsg(null);
    if (workLink.trim()) {
      const w = validateWorkLink(workLink);
      if (!w.ok) { setMsg({ ok: false, text: w.error ?? "Link bài làm chưa đúng." }); return; }
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/lessons/${lessonId}/azota-done`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workLink.trim() ? { linkUrl: workLink.trim() } : {}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Chưa lưu được. Hãy thử lại." }); return; }
      setState({ done: true, kind: d.kind, link: d.link, submittedAt: d.submittedAt });
      setWorkLink("");
      setMsg({ ok: true, text: "Đã ghi nhận là em đã làm xong." });
    } catch { setMsg({ ok: false, text: "Mất kết nối. Hãy thử lại." }); } finally { setBusy(false); }
  }

  async function undo() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/lessons/${lessonId}/azota-done`, { method: "DELETE", credentials: "same-origin" });
      if (!r.ok) { setMsg({ ok: false, text: "Chưa bỏ đánh dấu được. Hãy thử lại." }); return; }
      setState({ done: false, kind: null, link: null, submittedAt: null });
    } catch { setMsg({ ok: false, text: "Mất kết nối. Hãy thử lại." }); } finally { setBusy(false); }
  }

  const done = !!state?.done;
  return (
    <section className="p-4 space-y-3" style={card} aria-label="Bài Azota">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Bài Azota</p>
          {dl && <p className="text-xs mt-0.5" style={{ color: dl.overdue ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-mo)" }}>Hạn nộp: {dl.text}{dl.overdue ? " · đã quá hạn" : ""}</p>}
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full" role="status"
          style={done ? { background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" } : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
          {loading ? "Đang tải…" : done ? "Em đã làm xong" : "Chưa làm"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-5 text-sm font-bold" style={btnPrimary}>
            {links.length > 1 ? `Làm bài ${i + 1} trên Azota` : "Làm bài trên Azota"}
          </a>
        ))}
      </div>

      {loadErr ? (
        <div role="alert" className="text-sm flex items-center gap-3 flex-wrap" style={{ color: "var(--kin-tt-chu-loi)" }}>
          Chưa lấy được trạng thái bài làm.
          <button type="button" onClick={load} className="px-4 text-xs font-bold" style={btnGhost}>Thử lại</button>
        </div>
      ) : canSubmit && !loading && (
        <div className="space-y-2 pt-1">
          {done && state?.link && (
            <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Link bài làm em đã gửi: <a href={state.link} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--kin-nhan-link)" }}>{state.link}</a></p>
          )}
          <label className="block text-xs font-semibold" htmlFor={`azota-link-${lessonId}`} style={{ color: "var(--kin-chu-mo)" }}>Link bài làm trên Azota (không bắt buộc)</label>
          <input id={`azota-link-${lessonId}`} type="url" inputMode="url" value={workLink} onChange={e => { setWorkLink(e.target.value); setMsg(null); }} placeholder="https://azota.vn/…"
            className="w-full px-3 text-sm outline-none" style={{ minHeight: 44, borderRadius: 8, border: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)" }} />
          <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>KiN chỉ lưu link, không nhận ảnh bài làm. Gia sư chỉ thấy em đã làm hay chưa.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={markDone} className="px-5 text-sm font-bold" style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Đang lưu…" : done ? "Cập nhật" : "Em đã làm xong"}
            </button>
            {done && <button type="button" disabled={busy} onClick={undo} className="px-4 text-sm font-semibold" style={btnGhost}>Bỏ đánh dấu</button>}
          </div>
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className="text-xs font-semibold" style={{ color: msg.ok ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>{msg.text}</p>}
    </section>
  );
}

// ── Ghi chú theo mốc thời gian ──────────────────────────────────────────────

export function StampedNotes({ lessonId, adminNote, control }: { lessonId: string; adminNote?: string | null; control?: PlayerControl | null }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  const fetchNote = useCallback(() => {
    fetch(`/api/lesson-notes/${lessonId}`, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => setNote(d.text ?? ""))
      .catch(() => setLoadErr(true))
      .finally(() => setLoading(false));
  }, [lessonId]);
  const load = () => { setLoading(true); setLoadErr(false); fetchNote(); };
  useEffect(() => { fetchNote(); }, [fetchNote]);

  async function put(text: string) {
    setSaving(true); setSaveErr(false);
    try {
      const r = await fetch(`/api/lesson-notes/${lessonId}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error(String(r.status));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { setSaveErr(true); } finally { setSaving(false); }
  }

  function pin() {
    const t = control?.getTime() ?? null;
    if (t === null) { setPinMsg("Video này không cho đọc thời điểm đang xem. Bạn gõ mốc dạng [12:30] vào ghi chú."); return; }
    setPinMsg(null); setSaved(false);
    setNote(n => appendStampLine(n, t));
  }

  const stamps = extractNoteStamps(note);
  const canSeek = !!control;

  return (
    <div className="space-y-4">
      {adminNote && (
        <div className="rounded-xl p-4" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "var(--kin-tt-chu-cho)" }}>Lưu ý từ gia sư</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--kin-tt-chu-cho)" }}>{adminNote}</p>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <label htmlFor={`note-${lessonId}`} className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>Ghi chú của em (chỉ em thấy)</label>
          <button type="button" onClick={pin} className="px-4 text-xs font-bold" style={btnGhost}>Ghim mốc đang xem</button>
        </div>
        {loadErr ? (
          <div role="alert" className="text-sm flex items-center gap-3 flex-wrap" style={{ color: "var(--kin-tt-chu-loi)" }}>
            Chưa tải được ghi chú. <button type="button" onClick={load} className="px-4 text-xs font-bold" style={btnGhost}>Thử lại</button>
          </div>
        ) : (
          <textarea id={`note-${lessonId}`} value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} rows={5} disabled={loading}
            placeholder={loading ? "Đang tải ghi chú…" : "Ghi chú về bài này. Bấm “Ghim mốc đang xem” để thêm một dòng [phút:giây]."}
            className="w-full p-4 rounded-xl text-sm resize-none outline-none" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
        )}
        {pinMsg && <p role="status" className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>{pinMsg}</p>}
        {stamps.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-2" aria-label="Các mốc đã ghim">
            {stamps.map(s => (
              <li key={s.line}>
                <button type="button" disabled={!canSeek} onClick={() => control?.seek(s.seconds)} title={canSeek ? "Nhảy tới mốc này" : "Mở video để nhảy tới mốc"}
                  className="px-3 text-xs font-semibold" style={{ ...btnGhost, opacity: canSeek ? 1 : 0.7 }}>
                  <span className="font-bold" style={{ color: "var(--kin-nhan-link)" }}>{formatStamp(s.seconds)}</span>{s.text ? ` · ${s.text.slice(0, 40)}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3 mt-3">
          <button type="button" onClick={() => put(note)} disabled={loading || loadErr || saving} className="px-5 text-sm font-bold" style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
            {saved ? "Đã lưu" : saving ? "Đang lưu…" : "Lưu ghi chú"}
          </button>
          {note && <button type="button" onClick={() => { setNote(""); put(""); }} className="px-3 text-xs" style={{ minHeight: 44, color: "var(--kin-chu-mo)" }}>Xoá hết</button>}
        </div>
        {saveErr && <p role="alert" className="text-xs mt-2 font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>Chưa lưu được ghi chú. Hãy thử lại.</p>}
      </div>
    </div>
  );
}
