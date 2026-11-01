// BU-02 — Ô tải lên CHUNG của màn Giáo trình: một ô nhận cả link lẫn tệp (kéo-thả ở máy tính, hai nút lớn ở điện thoại).
//  - Dán link → nhận diện NGAY bằng routeInput (src/lib/giaoTrinh.ts): chip "Nhận diện: YouTube · sẽ thêm vào Video" hoặc lỗi đỏ tại chỗ (kèm nút chuyển ô khi biết ô đúng).
//  - Thả tệp → kiểm trước ở trình duyệt (đuôi, dung lượng, cờ video) rồi mới có yêu cầu mạng: init → tải → complete → G2. Tối đa 2 tệp cùng lúc, mỗi tệp một thanh tiến trình, huỷ được.
//  - Giới hạn ghi sẵn TRƯỚC khi chọn. Cam kết bản quyền tích một lần mỗi phiên. Giao diện tải VIDEO tệp dựng sẵn nhưng chỉ hiện khi cờ video bật (config.video.enabled; mặc định tắt ở production).
//  - Xong một mục: thông báo "Đã thêm … vào …" + Hoàn tác (gỡ qua G3). Lỗi thì ở chỗ, có Thử lại.
// Màu chỉ qua token --kin-*. Không window.confirm.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { KinButton } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD } from "@/components/kin/PageLayout";
import { routeInput, type GiaoTrinhSnapshot } from "@/lib/giaoTrinh";
import type { MediaSlot } from "@/lib/mediaLink";
import { VIDEO_UPLOAD_NOTICE, VIDEO_EXTS, formatMegabytes } from "@/lib/mediaStorage";
import { COPYRIGHT_PLEDGE_LABEL, COPYRIGHT_NOTICE } from "@/lib/classRecordings";
import type { AddResult, GtTarget } from "./useGiaoTrinh";

const SLOT_NAME: Record<MediaSlot, string> = { video: "Video", live: "Buổi live", azota: "Bài tập/Azota", document: "Tài liệu" };
const PLEDGE_KEY = "kin.gt.cam-ket";
const MAX_PARALLEL = 2;

type EntryState = "wait" | "up" | "done" | "err";
interface Entry { id: number; file: File; via: "document_file" | "video_file"; pct: number; state: EntryState; message: string | null }

export interface OTaiLenProps {
  courseId: string;
  config: GiaoTrinhSnapshot["config"];
  /** Bài đang mở (null khi lớp chưa có bài nào). */
  currentLesson: { id: string; title: string } | null;
  /** Chương nhận "Bài mới" (null khi lớp trống: máy chủ tự tạo Phần 1 › Chương 1). */
  newChapterId: string | null;
  onAdd: (target: GtTarget, url: string, name?: string, extra?: Record<string, unknown>) => Promise<AddResult>;
  onUndo: (lessonId: string, key: string) => Promise<boolean>;
  /** Lớp chưa có bài: ô phóng lớn. */
  large?: boolean;
}

// ── tải byte có thanh tiến trình, huỷ được ─────────────────────────────────────
function sendWithProgress(method: "PUT" | "POST", url: string, file: File, fields: Record<string, string> | undefined, onPct: (p: number) => void, setAbort: (f: () => void) => void): Promise<{ ok: boolean; status: number; body: Record<string, unknown>; aborted?: boolean }> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    if (method === "PUT") { x.withCredentials = true; x.setRequestHeader("Content-Type", file.type || "application/octet-stream"); }
    x.upload.onprogress = e => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => { let b: Record<string, unknown> = {}; try { b = JSON.parse(x.responseText); } catch { /* không phải JSON */ } resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, body: b }); };
    x.onerror = () => resolve({ ok: false, status: 0, body: {} });
    x.onabort = () => resolve({ ok: false, status: 0, body: {}, aborted: true });
    setAbort(() => x.abort());
    if (method === "POST") { const fd = new FormData(); Object.entries(fields ?? {}).forEach(([k, v]) => fd.append(k, v)); fd.append("file", file); x.send(fd); }
    else x.send(file);
  });
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json };
  } catch { return { ok: false, status: 0, json: {} }; }
}

const stripExt = (n: string) => n.replace(/\.[A-Za-z0-9]{1,5}$/, "");

export default function OTaiLen({ courseId, config, currentLesson, newChapterId, onAdd, onUndo, large }: OTaiLenProps) {
  const [text, setText] = useState("");
  const [destPick, setDest] = useState<"current" | "new">("current");
  const [newTitle, setNewTitle] = useState("");
  const [pledge, setPledge] = useState(false);
  const [videoOk, setVideoOk] = useState(false);
  const [drag, setDrag] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [boxError, setBoxError] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; warning: string | null; undo: { lessonId: string; key: string } | null } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<number, File>());
  const aborts = useRef(new Map<number, () => void>());
  const nextId = useRef(1);
  const batchTarget = useRef<GtTarget | null>(null);
  const addChain = useRef<Promise<unknown>>(Promise.resolve());
  const live = useRef(true);
  const started = useRef(new Set<number>());
  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { live.current = true; try { if (sessionStorage.getItem(PLEDGE_KEY) === "1") setPledge(true); } catch { /* không có sessionStorage */ } return () => { live.current = false; }; }, []);
  const setPledgeSaved = (v: boolean) => { setPledge(v); try { sessionStorage.setItem(PLEDGE_KEY, v ? "1" : "0"); } catch { /* bỏ qua */ } };
  // Lớp chưa có bài đang mở thì chỉ còn "Bài mới"
  const dest: "current" | "new" = currentLesson ? destPick : "new";

  const recognised = useMemo(() => (text.trim() ? routeInput({ text }, config) : null), [text, config]);
  const lessonName = dest === "new" ? (newTitle.trim() || "bài mới") : (currentLesson?.title ?? "bài mới");

  const targetNow = useCallback((suggested: string): GtTarget => {
    if (dest === "current" && currentLesson) return { kind: "lesson", lessonId: currentLesson.id };
    return { kind: "new", chapterId: newChapterId, title: newTitle.trim() || suggested.trim().slice(0, 120) || "Bài mới" };
  }, [dest, currentLesson, newChapterId, newTitle]);

  function announce(r: AddResult, itemName: string, lessonTitle: string) {
    if (!live.current) return;
    if (!r.ok) { setBoxError(r.error ?? "Chưa thêm được."); return; }
    setBoxError(null);
    if (r.duplicate) { setDone({ text: `“${itemName}” đã có trong ${lessonTitle}, không thêm lần nữa.`, warning: null, undo: null }); return; }
    setDone({ text: `Đã thêm “${itemName}” vào ${lessonTitle}.`, warning: r.warning ?? null, undo: r.lessonId && r.key ? { lessonId: r.lessonId, key: r.key } : null });
  }

  // ── Dán link ────────────────────────────────────────────────────────────────
  async function submitLink() {
    const t = text.trim();
    if (!t || linkBusy) return;
    const rec = routeInput({ text: t }, config);
    if (!rec.ok) { setBoxError(rec.error); return; }
    setLinkBusy(true); setBoxError(null); setDone(null);
    const suggested = rec.ok ? rec.suggestedName : "";
    const target = targetNow(suggested);
    const r = await onAdd(target, t, suggested || undefined);
    if (!live.current) return;
    setLinkBusy(false);
    announce(r, suggested || (rec.ok ? rec.label : "link"), target.kind === "lesson" ? lessonName : (target.title));
    if (r.ok) { setText(""); if (r.createdLesson) { setDest("current"); setNewTitle(""); } }
  }

  // ── Thả / chọn tệp ──────────────────────────────────────────────────────────
  function enqueue(list: FileList | File[]) {
    setBoxError(null); setDone(null);
    const arr = Array.from(list);
    if (!arr.length) return;
    if (!pledge) { setBoxError("Hãy tích ô cam kết bản quyền bên dưới trước khi tải tệp lên."); return; }
    const added: Entry[] = [];
    for (const f of arr) {
      const id = nextId.current++;
      const rec = routeInput({ file: { name: f.name, size: f.size, type: f.type } }, config);
      if (!rec.ok) { added.push({ id, file: f, via: "document_file", pct: 0, state: "err", message: rec.error }); files.current.set(id, f); continue; }
      if (rec.via === "video_file" && !videoOk) { added.push({ id, file: f, via: "video_file", pct: 0, state: "err", message: "Hãy tích ô xác nhận video bên dưới trước khi tải video." }); files.current.set(id, f); continue; }
      files.current.set(id, f);
      added.push({ id, file: f, via: rec.via === "video_file" ? "video_file" : "document_file", pct: 0, state: "wait", message: null });
    }
    // Cả lô cùng một đích: nếu là "Bài mới" thì tệp đầu tạo bài, các tệp sau vào chính bài đó (xem runOne).
    if (!entriesRef.current.some(e => e.state === "wait" || e.state === "up")) batchTarget.current = null;
    setEntries(prev => [...prev, ...added]);
  }

  const patch = useCallback((id: number, p: Partial<Entry>) => { if (live.current) setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...p } : e))); }, []);

  const runOne = useCallback(async (e: Entry) => {
    const file = files.current.get(e.id);
    if (!file) return;
    const isVideo = e.via === "video_file";
    const fail = (message: string) => patch(e.id, { state: "err", message });
    patch(e.id, { state: "up", pct: 0, message: null });
    try {
      const init = await postJson(isVideo ? "/api/media/video/init" : "/api/media/document/init", { courseId, fileName: file.name, size: file.size, mimeType: file.type, confirmedNotice: true });
      if (!init.ok) { fail((init.json.error as string) ?? (init.status === 0 ? "Mất kết nối. Hãy thử lại." : "Chưa tải được. Hãy thử lại.")); return; }
      const up = init.json.upload as { method?: "PUT" | "POST"; url: string; fields?: Record<string, string> };
      const driver = init.json.driver as string;
      const method: "PUT" | "POST" = up.method ?? (driver === "local" ? "PUT" : "POST");
      const pr = await sendWithProgress(method, up.url, file, up.fields, p => patch(e.id, { pct: p }), f => aborts.current.set(e.id, f));
      aborts.current.delete(e.id);
      if (pr.aborted) { patch(e.id, { state: "err", message: "Đã huỷ." }); return; }
      if (!pr.ok) { fail((pr.body.error as string) ?? (pr.status === 0 ? "Mất kết nối khi đang tải. Hãy thử lại." : "Kho từ chối tệp này. Hãy thử lại.")); return; }
      let link = init.json.link as string;
      let name = stripExt(file.name);
      if (!isVideo || driver !== "local") {
        const cr = await postJson(isVideo ? "/api/media/video/complete" : "/api/media/document/complete", { assetId: init.json.assetId });
        if (!cr.ok) { fail((cr.json.error as string) ?? "Chưa chốt được tệp. Hãy thử lại."); return; }
        if (!isVideo) { link = (cr.json.link as string) ?? link; name = (cr.json.name as string) ?? file.name; }
      }
      // Thêm vào bài: nối đuôi để hai tệp cùng "Bài mới" không tạo hai bài.
      const job = addChain.current.then(async (): Promise<AddResult> => {
        const target = batchTarget.current ?? targetNow(stripExt(file.name));
        const r = await onAdd(target, link, name);
        if (r.ok && target.kind === "new" && r.lessonId) { batchTarget.current = { kind: "lesson", lessonId: r.lessonId }; if (live.current) { setDest("current"); setNewTitle(""); } }
        announce(r, name, target.kind === "lesson" ? (currentLesson && target.lessonId === currentLesson.id ? currentLesson.title : "bài đã chọn") : target.title);
        return r;
      });
      addChain.current = job.catch(() => undefined);
      const res = await job;
      if (res.ok) patch(e.id, { state: "done", pct: 100, message: null });
      else patch(e.id, { state: "err", message: res.error ?? "Chưa thêm được." });
    } catch { fail("Mất kết nối. Hãy thử lại."); }
  }, [courseId, onAdd, patch, targetNow, currentLesson]);

  // Bơm hàng đợi: tối đa MAX_PARALLEL tệp cùng lúc
  useEffect(() => {
    const running = entries.filter(e => e.state === "up").length;
    const waiting = entries.filter(e => e.state === "wait");
    for (const e of waiting.slice(0, Math.max(0, MAX_PARALLEL - running))) { if (started.current.has(e.id)) continue; started.current.add(e.id); patch(e.id, { state: "up" }); void runOne(e); }
  }, [entries, patch, runOne]);

  function cancel(id: number) {
    const abort = aborts.current.get(id);
    if (abort) abort();
    else patch(id, { state: "err", message: "Đã huỷ." });
  }
  function retry(id: number) { started.current.delete(id); patch(id, { state: "wait", pct: 0, message: null }); }
  function dismiss(id: number) { files.current.delete(id); setEntries(prev => prev.filter(e => e.id !== id)); }

  async function undo() {
    if (!done?.undo || undoBusy) return;
    setUndoBusy(true);
    const ok = await onUndo(done.undo.lessonId, done.undo.key);
    if (!live.current) return;
    setUndoBusy(false);
    setDone(ok ? { text: "Đã hoàn tác, mục vừa thêm đã được gỡ.", warning: null, undo: null } : null);
    if (!ok) setBoxError("Chưa hoàn tác được. Gỡ mục ở danh sách bên dưới.");
  }

  function onDrop(ev: DragEvent<HTMLDivElement>) {
    ev.preventDefault(); setDrag(false);
    const dropped = ev.dataTransfer.files;
    if (dropped && dropped.length) { enqueue(dropped); return; }
    const t = ev.dataTransfer.getData("text/uri-list") || ev.dataTransfer.getData("text/plain");
    if (t) { setText(t.split("\n")[0].trim()); inputRef.current?.focus(); }
  }

  const doc = config.document, vid = config.video;
  const exts = doc.exts.map(x => x.toUpperCase()).join(", ");
  const left = Math.max(0, doc.quotaBytes - doc.usedBytes);
  const accept = [...(doc.enabled ? doc.exts.map(x => "." + x) : []), ...(vid.enabled ? VIDEO_EXTS.map(x => "." + x) : [])].join(",");
  const busyFiles = entries.some(e => e.state === "up" || e.state === "wait");

  return (
    <section aria-labelledby="gt-o-tai" data-gt-o-tai className={`rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] ${large ? "p-6 md:p-10" : "p-4 md:p-5"}`}>
      <h2 id="gt-o-tai" className={`font-medium text-[var(--kin-chu-chinh)] text-[length:var(--kin-co-tieu-de)]`}>
        Thêm vào bài{currentLesson && dest === "current" ? `: ${currentLesson.title}` : ""}
      </h2>
      <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        <span className="max-md:hidden">Kéo thả tệp vào đây, hoặc dán link YouTube / Drive / Zoom / Azota…</span>
        <span className="md:hidden">Dán link YouTube / Drive / Zoom / Azota… hoặc chọn tệp từ máy.</span>
      </p>
      <p data-gt-gioi-han className="mt-1 text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)]">
        {doc.enabled
          ? <>{exts} · tối đa {formatMegabytes(doc.maxBytes)} mỗi tệp · còn {formatMegabytes(left)} trong kho của bạn. </>
          : <>{doc.reason ?? "Chưa bật tải tệp lên KiN. Hãy dán link Google Drive."} </>}
        {vid.enabled ? <>Video: dán link hoặc tải tệp (tối đa {formatMegabytes(vid.maxBytes)}).</> : <>Video: dán link YouTube (Không công khai), Vimeo hoặc Drive.</>}
      </p>

      <div
        data-gt-vung-tha
        onDragOver={ev => { ev.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        className={`mt-4 rounded-[var(--kin-bo-md)] md:border md:border-dashed p-0 md:p-4 ${drag ? "md:border-[var(--kin-nhan-nen)] md:bg-[var(--kin-nen-nhan)]" : "md:border-[var(--kin-vien-o-nhap)]"}`}>
        <label htmlFor="gt-link" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Dán link</label>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <input id="gt-link" ref={inputRef} type="url" inputMode="url" autoComplete="off" value={text} onChange={e => { setText(e.target.value); setBoxError(null); setDone(null); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void submitLink(); } }} placeholder="https://…" className={KIN_FIELD} />
          <KinButton type="button" onClick={() => void submitLink()} loading={linkBusy} loadingLabel="Đang thêm…" disabled={!text.trim() || (recognised ? !recognised.ok : false)}>Thêm link</KinButton>
        </div>

        {recognised && (
          <div data-gt-nhan-dien className="mt-2 text-[length:var(--kin-co-goc)]" aria-live="polite">
            {recognised.ok ? (
              <>
                <KinStatus tone="xong" className="whitespace-normal">Nhận diện: {recognised.label} · sẽ thêm vào {SLOT_NAME[recognised.slot]}</KinStatus>
                {recognised.warning && <p className="mt-1 text-[var(--kin-tt-chu-cho)]">{recognised.warning}</p>}
              </>
            ) : (
              <div role="alert">
                <KinStatus tone="loi" className="whitespace-normal">{recognised.error}</KinStatus>
                {recognised.moveTo && <p data-gt-goi-y className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Gợi ý: link này hợp với mục {SLOT_NAME[recognised.moveTo]}. KiN tự chọn mục theo loại link, nên hãy kiểm tra lại link đã dán.</p>}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" multiple accept={accept || undefined} className="hidden" aria-label="Chọn tệp từ máy"
            onChange={e => { const l = e.target.files; if (l) enqueue(l); e.target.value = ""; }} />
          <KinButton type="button" variant="secondary" className="max-md:flex-1" onClick={() => fileRef.current?.click()}>Chọn tệp từ máy</KinButton>
          <KinButton type="button" variant="secondary" className="md:hidden flex-1" onClick={() => { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: "center" }); }}>Dán link</KinButton>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Thêm vào</legend>
        <div className="mt-1 flex flex-wrap gap-x-5">
          {currentLesson && (
            <label className="inline-flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)] cursor-pointer">
              <input type="radio" name="gt-dest" checked={dest === "current"} onChange={() => setDest("current")} className="w-5 h-5" />
              <span>Bài đang mở</span>
            </label>
          )}
          <label className="inline-flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)] cursor-pointer">
            <input type="radio" name="gt-dest" checked={dest === "new"} onChange={() => setDest("new")} className="w-5 h-5" />
            <span>Bài mới</span>
          </label>
        </div>
        {dest === "new" && (
          <div className="mt-1">
            <label htmlFor="gt-ten-bai" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tên bài mới (để trống thì KiN lấy theo tên link hoặc tệp)</label>
            <input id="gt-ten-bai" value={newTitle} maxLength={120} onChange={e => setNewTitle(e.target.value)} className={`${KIN_FIELD} mt-1`} placeholder="Ví dụ: Phương trình bậc hai" />
            {!currentLesson && <p className="mt-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">KiN tự tạo Phần 1 › Chương 1 khi bạn thêm mục đầu tiên.</p>}
          </div>
        )}
      </fieldset>

      <div className="mt-2">
        <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] cursor-pointer">
          <input type="checkbox" checked={pledge} onChange={e => setPledgeSaved(e.target.checked)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
          <span>{COPYRIGHT_PLEDGE_LABEL}</span>
        </label>
        <p className="text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)]">{COPYRIGHT_NOTICE}</p>
        {vid.enabled && (
          <div data-gt-video-xac-nhan className="mt-2">
            <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{VIDEO_UPLOAD_NOTICE.title}</p>
            <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] cursor-pointer">
              <input type="checkbox" checked={videoOk} onChange={e => setVideoOk(e.target.checked)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span>{VIDEO_UPLOAD_NOTICE.confirmLabel}</span>
            </label>
          </div>
        )}
      </div>

      {boxError && <p role="alert" data-gt-loi className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{boxError}</p>}

      {entries.length > 0 && (
        <ul aria-label="Tệp đang tải lên" data-gt-hang-doi className="mt-4 space-y-3">
          {entries.map(e => (
            <li key={e.id} data-gt-tep={e.state} className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words">{e.file.name}</p>
                  <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{formatMegabytes(e.file.size)}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {(e.state === "up" || e.state === "wait") && <KinButton type="button" variant="secondary" onClick={() => cancel(e.id)}>Huỷ</KinButton>}
                  {e.state === "err" && !/^Đã huỷ/.test(e.message ?? "") && e.message && !/loại|đuôi|vượt giới hạn|rỗng|không nhận/i.test(e.message) && <KinButton type="button" variant="secondary" onClick={() => retry(e.id)}>Thử lại</KinButton>}
                  {(e.state === "err" || e.state === "done") && <KinButton type="button" variant="ghost" onClick={() => dismiss(e.id)}>Đóng</KinButton>}
                </div>
              </div>
              {(e.state === "up" || e.state === "wait") && (
                <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={e.pct} aria-label={`Đang tải ${e.file.name}`}>
                  <div className="h-2 rounded-[var(--kin-bo-tron)] overflow-hidden bg-[var(--kin-vien-nhat)]"><div className="h-full bg-[var(--kin-nhan-nen)]" style={{ width: `${e.pct}%`, transition: "width .2s" }} /></div>
                  <p className="mt-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{e.state === "wait" ? "Đang chờ tới lượt…" : `Đang tải lên… ${e.pct}%`}</p>
                </div>
              )}
              {e.state === "done" && <p className="mt-2"><KinStatus tone="xong">Đã thêm vào bài</KinStatus></p>}
              {e.state === "err" && <p role="alert" className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{e.message}</p>}
            </li>
          ))}
        </ul>
      )}
      {busyFiles && <p className="sr-only" role="status">Đang tải tệp lên</p>}

      {done && (
        <div role="status" data-gt-da-them className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] border-l-2 border-[var(--kin-vien-thuong)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words">{done.text}</p>
            {done.warning && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{done.warning}</p>}
          </div>
          {done.undo && <KinButton type="button" variant="secondary" loading={undoBusy} loadingLabel="Đang hoàn tác…" onClick={() => void undo()}>Hoàn tác</KinButton>}
        </div>
      )}
    </section>
  );
}
