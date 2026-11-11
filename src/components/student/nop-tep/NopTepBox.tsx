// BU-HS-NOP-TEP — khối nộp bài bằng tệp Word/PDF (Figma chưa có: dựng theo đặc tả mục 5, token --kin-*).
//   mode "student"      : học sinh trong thẻ bài tập — vùng thả + danh sách + tiến độ + lỗi từng loại + Nộp bài (form POST → 303) + đã nộp / hết hạn / nộp lại.
//   mode "tutor_return" : gia sư trong khung chấm — vùng thả nhỏ cho "Tệp trả bài"; KHÔNG tự nộp, cha gọi ref.attach() sau khi chấm điểm xong.
// Ngoài ra xuất NopTepStudentFiles: danh sách tệp học sinh nộp (Tải xuống / Xem) cho gia sư.
// Quy tắc: không hiển thị thứ máy chủ không trả; không tự đoán hạn (lấy expiresAt máy chủ); tính năng tắt ⇒ nói rõ và để nguyên đường nộp link Azota.
// LOI-03 mục 4.3 (chỉ trình bày, mode "student"): vùng thả rộng hết thẻ, cao ≥ 200px (≥ 240px từ md), chữ chính "Kéo thả tệp Word hoặc PDF vào đây" cỡ tiêu đề,
// dòng "hoặc" + nút "Chọn tệp"; danh sách tệp + Nộp bài xếp DƯỚI vùng thả (không còn hai cột); kho chưa cấu hình ⇒ tiêu đề "Kho tệp chưa bật".
// KHÔNG đổi: giới hạn (10 MB / 3 tệp / 60 ngày), luồng tải lên / nộp (nopTepClient.ts), quy tắc trẻ em (không ảnh), vùng thả nhỏ của gia sư.
"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { KinButton } from "@/components/kin/Button";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinCallout } from "@/components/kin/Callout";
import { useKinConfirm } from "@/components/kin/useConfirm";
import {
  NOP_TEP_BASE, NOP_TEP_MSG, attachNopTepReturn, formatBytes, formatVnDate, formatVnStamp, loadNopTepList, preflightNopTep, removeNopTepFile, splitName, uploadNopTepFile,
  type NopTepFileView, type NopTepLimits, type NopTepList, type NopTepMode, type NopTepScope,
} from "./nopTepClient";

export type { NopTepMode } from "./nopTepClient";

/** Bài nộp hiện có của học sinh (lấy từ AssignmentSubmissionFull của trang — chỉ những trường khối này cần). */
export interface NopTepSubmission { submittedAt: string; fileUrl: string; fileName: string | null; gradedAt: string | null }
export interface NopTepBoxHandle {
  /** Gia sư: gắn các tệp trả bài đã tải xong vào bài nộp (gọi SAU khi chấm điểm). `message` là câu hiển thị khi lỗi. */
  attach: () => Promise<{ ok: boolean; message?: string }>;
}
export interface NopTepBoxProps {
  mode: NopTepMode;
  assignmentId: string;
  /** mode "student": bài nộp hiện có (nếu có). */
  submission?: NopTepSubmission | null;
  /** mode "tutor_return": bài nộp đang chấm. */
  submissionId?: string;
}

const NEW_PREFIX = `${NOP_TEP_BASE}/`;
const FALLBACK_LIMITS: NopTepLimits = { maxBytes: 10 * 1024 * 1024, maxFiles: 3, exts: ["docx", "pdf"], retentionDays: 60 };
const T_MO = "text-[var(--kin-chu-mo)]";
const T_CHINH = "text-[var(--kin-chu-chinh)]";
const T_LOI = "text-[var(--kin-tt-chu-loi)]";
const T_XONG = "text-[var(--kin-tt-chu-xong)]";
const SMALL = "text-[length:var(--kin-co-small)]";
const GOC = "text-[length:var(--kin-co-goc)]";
const ROW_BTN = `inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-[var(--kin-bo-md)] ${GOC} font-medium text-[var(--kin-nhan-link)] hover:bg-[var(--kin-nen-re-chuot)]`;

// ── Danh sách tệp từ máy chủ ──────────────────────────────────────────────────
type ListState = { status: "loading" } | { status: "error"; code: number } | { status: "ok"; data: NopTepList };

function useNopTepList(scope: NopTepScope) {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const subId = scope.mode === "tutor_return" ? scope.submissionId : "";
  const { mode, assignmentId } = scope;
  // `fetchOnce` chỉ đặt state SAU khi mạng trả lời (đúng chỗ cho effect); `load` thêm bước "đang tải" cho nút Thử lại.
  const fetchOnce = useCallback((keepOld: boolean) =>
    loadNopTepList(mode === "student" ? { mode, assignmentId } : { mode, assignmentId, submissionId: subId })
      .then(r => setState(prev => (r.ok ? { status: "ok", data: r.data } : keepOld && prev.status === "ok" ? prev : { status: "error", code: r.status }))),
  [mode, assignmentId, subId]);
  const load = useCallback(async (silent = false) => {
    if (!silent) setState({ status: "loading" });
    await fetchOnce(silent);
  }, [fetchOnce]);
  useEffect(() => { void fetchOnce(false); }, [fetchOnce]);
  return { state, load };
}

// ── Tải lên nhiều tệp (trạng thái cục bộ) ─────────────────────────────────────
type ItemState = "dang-tai" | "kiem-tra" | "san-sang" | "loi";
interface LocalItem {
  key: string; file: File | null; name: string; size: number; state: ItemState; pct: number;
  message?: string; retryable?: boolean; fileId?: string;
}
let seq = 0;
const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

function useUploads(scope: NopTepScope, limits: NopTepLimits, onUploaded: (fileId: string, key: string, drop: (key: string) => void) => Promise<void> | void, onDisabled: () => void) {
  const [items, setItems] = useState<LocalItem[]>([]);
  const itemsRef = useRef<LocalItem[]>([]);
  const aborts = useRef(new Map<string, () => void>());
  const hooksRef = useRef({ onUploaded, onDisabled });
  useEffect(() => { hooksRef.current = { onUploaded, onDisabled }; });

  const apply = useCallback((fn: (prev: LocalItem[]) => LocalItem[]) => { itemsRef.current = fn(itemsRef.current); setItems(itemsRef.current); }, []);
  const patch = useCallback((key: string, p: Partial<LocalItem>) => apply(prev => prev.map(i => i.key === key ? { ...i, ...p } : i)), [apply]);

  const drop = useCallback((key: string) => apply(prev => prev.filter(i => i.key !== key)), [apply]);

  const scopeRef = useRef(scope);
  useEffect(() => { scopeRef.current = scope; });

  const run = useCallback(async (key: string, file: File) => {
    const res = await uploadNopTepFile(file, scopeRef.current, {
      onStage: s => patch(key, { state: s === "check" ? "kiem-tra" : "dang-tai" }),
      onProgress: pct => patch(key, { pct }),
      setAbort: f => { aborts.current.set(key, f); },
    });
    aborts.current.delete(key);
    if (!res.ok) {
      if (res.aborted) return;
      if (res.kind === "disabled") hooksRef.current.onDisabled();
      patch(key, { state: "loi", message: res.message, retryable: res.retryable });
      return;
    }
    patch(key, { state: "san-sang", fileId: res.fileId, pct: 100 });
    await hooksRef.current.onUploaded(res.fileId, key, drop);
  }, [patch, drop]);

  /** `existing` = số tệp ĐÃ có chỗ trong bộ này ngoài các tệp đang chọn (vd tệp nháp đã tải từ trước). */
  const addFiles = useCallback((files: File[], existing: number) => {
    let active = existing + itemsRef.current.filter(i => i.state !== "loi").length;
    const fresh: LocalItem[] = [];
    const starts: LocalItem[] = [];
    for (const file of files) {
      const base = { key: newKey(), file, name: file.name, size: file.size, pct: 0 };
      if (active >= limits.maxFiles) { fresh.push({ ...base, state: "loi", message: NOP_TEP_MSG.too_many, retryable: false }); continue; }
      const pre = preflightNopTep(file, limits);
      if (pre) { fresh.push({ ...base, state: "loi", message: pre.message, retryable: false }); continue; }
      active++;
      const it: LocalItem = { ...base, state: "dang-tai" };
      fresh.push(it); starts.push(it);
    }
    apply(prev => [...prev, ...fresh]);
    for (const it of starts) if (it.file) void run(it.key, it.file);
  }, [apply, limits, run]);

  const retry = useCallback((key: string) => {
    const it = itemsRef.current.find(i => i.key === key);
    if (!it?.file) return;
    patch(key, { state: "dang-tai", pct: 0, message: undefined });
    void run(key, it.file);
  }, [patch, run]);

  const dismiss = useCallback((key: string) => {
    aborts.current.get(key)?.();
    const it = itemsRef.current.find(i => i.key === key);
    apply(prev => prev.filter(i => i.key !== key));
    if (it?.fileId) void removeNopTepFile(it.fileId);
  }, [apply]);
  const clearAll = useCallback(() => {
    for (const it of itemsRef.current) { aborts.current.get(it.key)?.(); if (it.fileId) void removeNopTepFile(it.fileId); }
    apply(() => []);
  }, [apply]);
  const clearReady = useCallback(() => apply(prev => prev.filter(i => i.state !== "san-sang")), [apply]);

  useEffect(() => {
    const map = aborts.current;
    return () => { map.forEach(f => f()); };
  }, []);

  return { items, itemsRef, addFiles, retry, drop, dismiss, clearAll, clearReady };
}

// ── Mảnh giao diện ────────────────────────────────────────────────────────────
function ActionBtn({ children, onClick, hook, disabled }: { children: ReactNode; onClick: () => void; hook?: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={ROW_BTN} {...(hook ? { [hook]: "" } : {})}>{children}</button>;
}

function FileRow({ id, name, extFallback, detail, tone = "mo", state, pct, busy, error, actions }: {
  id?: string; name: string; extFallback?: string; detail?: ReactNode; tone?: "mo" | "xong" | "loi"; state: string;
  pct?: number | null; busy?: boolean; error?: string; actions?: ReactNode;
}) {
  const { stem, ext } = splitName(name);
  const tag = (ext.replace(".", "") || extFallback || "").slice(0, 4).toUpperCase();
  const toneCls = tone === "xong" ? T_XONG : tone === "loi" ? T_LOI : T_MO;
  return (
    <li data-nop-tep-hang="" data-trang-thai={state} {...(id ? { "data-tep-id": id } : {})} aria-busy={busy ? true : undefined}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 min-h-14 px-3 py-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
      <span aria-hidden className="flex-shrink-0 w-10 h-10 grid place-items-center rounded-[var(--kin-bo-sm)] bg-[var(--kin-nen-nhan)] text-[length:var(--kin-co-caption)] font-medium text-[var(--kin-chu-mo-tren-nen-nhan)]">{tag || "TỆP"}</span>
      <div className="min-w-0 flex-1 basis-40">
        <p title={name} data-nop-tep-ten="" className={`flex min-w-0 ${GOC} ${T_CHINH}`}>
          <span className="truncate">{stem}</span><span className="flex-shrink-0">{ext}</span>
        </p>
        {detail && <p className={`mt-0.5 ${SMALL} ${toneCls}`}>{detail}</p>}
        {typeof pct === "number" && (
          <div role="progressbar" aria-label="Tiến độ tải lên" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            className="mt-1.5 h-1.5 rounded-full overflow-hidden bg-[var(--kin-vien-thuong)]">
            <div className="h-full bg-[var(--kin-nhan-nen)]" style={{ width: `${pct}%` }} />
          </div>
        )}
        {error && <p role="alert" data-nop-tep-loi="" className={`mt-1 ${SMALL} ${T_LOI}`}>{error}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1 ml-auto">{actions}</div>}
    </li>
  );
}

function LocalRow({ it, onRetry, onDismiss }: { it: LocalItem; onRetry: () => void; onDismiss: () => void }) {
  const size = formatBytes(it.size);
  const base = { name: it.name, id: it.fileId, state: it.state };
  if (it.state === "loi") {
    return <FileRow {...base} detail={`${size ? size + " · " : ""}Không dùng được`} tone="loi" error={it.message}
      actions={<>{it.retryable && <ActionBtn onClick={onRetry} hook="data-nop-tep-thu-lai">Thử lại</ActionBtn>}<ActionBtn onClick={onDismiss} hook="data-nop-tep-bo">Bỏ tệp</ActionBtn></>} />;
  }
  if (it.state === "san-sang") {
    return <FileRow {...base} detail={`${size ? size + " · " : ""}Đã kiểm tra, sẵn sàng`} tone="xong" actions={<ActionBtn onClick={onDismiss} hook="data-nop-tep-bo">Bỏ tệp</ActionBtn>} />;
  }
  const label = it.state === "kiem-tra" ? "Đang kiểm tra tệp…" : it.pct > 0 ? `Đang tải lên… ${it.pct}%` : "Đang chuẩn bị…";
  return <FileRow {...base} detail={`${size ? size + " · " : ""}${label}`} busy pct={it.state === "kiem-tra" ? 100 : it.pct}
    actions={<ActionBtn onClick={onDismiss} hook="data-nop-tep-bo">Bỏ tệp</ActionBtn>} />;
}

function Zone({ onFiles, compact, describedBy, disabled }: { onFiles: (f: File[]) => void; compact?: boolean; describedBy?: string; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const stop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <>
      <input ref={input} type="file" accept=".docx,.pdf" multiple hidden tabIndex={-1} data-nop-tep-input=""
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) onFiles(fs); }} />
      <button type="button" data-nop-tep-vung-tha="" data-keo-qua={over ? "co" : "khong"} disabled={disabled} aria-describedby={describedBy}
        onClick={() => input.current?.click()}
        onDragEnter={e => { stop(e); if (disabled) return; depth.current++; setOver(true); }}
        onDragLeave={e => { stop(e); depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); }}
        onDragOver={stop}
        onDrop={e => { stop(e); depth.current = 0; setOver(false); if (disabled) return; const fs = Array.from(e.dataTransfer.files ?? []); if (fs.length) onFiles(fs); }}
        className={`w-full flex flex-col items-center justify-center gap-3 px-4 py-5 text-center rounded-[var(--kin-bo-xl)] border-2 transition-colors ${compact ? "min-h-24" : "min-h-[200px] md:min-h-[240px]"} ${over
          ? "border-solid border-[var(--kin-nhan-nen)] bg-[var(--kin-nhan-nen-nhat)]"
          : "border-dashed border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
        {compact ? (
          <span className={`${GOC} font-medium ${T_CHINH}`}>{over ? "Thả tệp vào đây" : "Kéo tệp Word hoặc PDF vào đây"}</span>
        ) : (
          <>
            <span data-nop-tep-chu-chinh="" className={`text-[length:var(--kin-co-tieu-de)] leading-6 font-medium ${T_CHINH}`}>{over ? "Thả tệp vào đây" : "Kéo thả tệp Word hoặc PDF vào đây"}</span>
            <span aria-hidden className={`${GOC} ${T_MO}`}>hoặc</span>
          </>
        )}
        <span data-nop-tep-chon="" className={`${kinButtonClass("secondary")} pointer-events-none`}>Chọn tệp</span>
      </button>
    </>
  );
}

function Caption({ id, limits, extra }: { id: string; limits: NopTepLimits; extra?: string }) {
  const mb = Math.round(limits.maxBytes / (1024 * 1024));
  return (
    <p id={id} data-nop-tep-chu-thich="" className={`mt-2 ${SMALL} ${T_MO}`}>
      {`Word hoặc PDF, dưới ${mb} MB. Không nhận ảnh hay video. Tệp được lưu ${limits.retentionDays} ngày rồi tự xoá.`}
      {` Tối đa ${limits.maxFiles} tệp.`}{extra ? ` ${extra}` : ""}
    </p>
  );
}

function Skeleton() {
  return <div aria-busy="true" aria-label="Đang tải khối nộp bài" className="kin-skel kin-skel--soft h-[200px] md:h-[240px] rounded" />;
}
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" data-nop-tep-loi-tai="" className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-tt-vien-loi)] bg-[var(--kin-tt-nen-loi)]">
      <p className={`flex-1 min-w-0 ${GOC} ${T_LOI} font-medium`}>Không tải được khối nộp bài. Kiểm tra mạng rồi thử lại.</p>
      <KinButton type="button" variant="secondary" onClick={onRetry}>Thử lại</KinButton>
    </div>
  );
}
function DisabledNote({ title = "Tính năng nộp tệp chưa bật" }: { title?: string }) {
  return (
    <div role="status" data-nop-tep-chua-bat="">
      <KinCallout title={title}>Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota.</KinCallout>
    </div>
  );
}

function DownloadLinks({ f, withView }: { f: NopTepFileView; withView?: boolean }) {
  return (
    <>
      {withView && f.ext === "pdf" && <a href={`${f.href}?xem=1`} target="_blank" rel="noopener noreferrer" data-nop-tep-xem="" className={ROW_BTN}>Xem</a>}
      <a href={f.href} download data-nop-tep-tai="" className={kinButtonClass("secondary")}>Tải xuống</a>
    </>
  );
}

function expiredText(days: number) { return `Tệp đã được xoá sau ${days} ngày; điểm và nhận xét vẫn giữ.`; }

// ── Học sinh ──────────────────────────────────────────────────────────────────
function StudentBox({ assignmentId, submission }: { assignmentId: string; submission?: NopTepSubmission | null }) {
  const scope = useMemo<NopTepScope>(() => ({ mode: "student", assignmentId }), [assignmentId]);
  const { state, load } = useNopTepList(scope);
  const [forcedOff, setForcedOff] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { ask, dialog } = useKinConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const capId = `nt-cap-${assignmentId}`;

  const limits = state.status === "ok" ? state.data.limits : FALLBACK_LIMITS;
  const uploads = useUploads(scope, limits, async (_id, key, drop) => { await load(true); drop(key); }, () => setForcedOff(true));

  // Quay lại bằng nút Back (bfcache) thì form có thể còn ở trạng thái "Đang nộp…": mở khoá và đọc lại danh sách.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { setSubmitting(false); void load(true); } };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [load]);

  if (state.status === "loading") return <section data-nop-tep="student" data-trang-thai="dang-tai"><Skeleton /></section>;
  if (state.status === "error") return <section data-nop-tep="student" data-trang-thai="loi-tai"><LoadError onRetry={() => void load()} /></section>;

  const list = state.data;
  const sub = submission ?? null;
  const mine = list.files.filter(f => f.kind === "student" && (f.status === "ready" || f.expired));
  const submitted = mine.filter(f => f.submitted);
  const drafts = mine.filter(f => !f.submitted && !f.expired);
  const tutorFiles = list.files.filter(f => f.kind === "tutor_return" && f.submitted);
  const submittedAt = sub?.submittedAt ?? list.submission?.submittedAt ?? null;
  const graded = sub ? sub.gradedAt !== null : list.submission?.graded === true;
  const hasSub = submittedAt !== null;
  const legacy = sub !== null && !sub.fileUrl.startsWith(NEW_PREFIX);
  const enabled = list.enabled && !forcedOff;

  const items = uploads.items;
  const uploading = items.filter(i => i.state === "dang-tai" || i.state === "kiem-tra").length;
  const readyCount = drafts.length + items.filter(i => i.state === "san-sang").length;
  const composing = enabled && (!hasSub || resubmitting || drafts.length > 0 || items.length > 0);
  const canSubmit = readyCount >= 1 && uploading === 0 && !submitting;
  const allExpired = !legacy && submitted.length > 0 && submitted.every(f => f.expired);
  const needConfirm = hasSub && (graded || tutorFiles.length > 0);

  async function removeDraft(id: string) { await removeNopTepFile(id); await load(true); }
  async function cancelResubmit() {
    uploads.clearAll();
    await Promise.all(drafts.map(d => removeNopTepFile(d.id)));
    setResubmitting(false);
    await load(true);
  }
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (!canSubmit) { e.preventDefault(); return; }
    if (needConfirm && !confirmed.current) {
      e.preventDefault();
      void ask({ title: "Nộp lại bài đã chấm?", message: "Nộp lại sẽ xoá điểm, nhận xét và tệp gia sư đã trả. Gia sư sẽ chấm lại.", confirmLabel: "Nộp lại", tone: "thuong" }).then(ok => {
        if (!ok) return;
        confirmed.current = true;
        formRef.current?.requestSubmit();
      });
      return;
    }
    confirmed.current = false;
    setSubmitting(true); // để trình duyệt tự gửi form (POST rồi 303); nút khoá ngay để không bấm đúp
  }

  const trang = !enabled && !hasSub ? "tat"
    : composing ? (uploading > 0 ? "dang-tai-len" : readyCount + items.length > 0 ? "da-chon" : "trong")
    : allExpired ? "het-han" : "da-nop";
  const hint = uploading > 0 ? "Đang tải tệp lên… Đợi xong rồi bấm Nộp bài."
    : readyCount === 0 ? "Chọn ít nhất 1 tệp."
    : `${readyCount} tệp sẵn sàng. Bấm Nộp bài để gửi cho gia sư.`;

  const draftRows = drafts.map(f => (
    <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="san-sang" tone="xong" detail={`${formatBytes(f.sizeBytes)}${f.sizeBytes != null ? " · " : ""}Đã kiểm tra, sẵn sàng`}
      actions={<ActionBtn onClick={() => void removeDraft(f.id)} hook="data-nop-tep-bo">Bỏ tệp</ActionBtn>} />
  ));
  const localRows = items.map(it => <LocalRow key={it.key} it={it} onRetry={() => uploads.retry(it.key)} onDismiss={() => uploads.dismiss(it.key)} />);

  const composeBlock = composing && (
    <div className="@container" data-nop-tep-soan="">
      {hasSub && (
        <p className={`mb-3 ${SMALL} ${T_MO}`}>Bạn đã nộp bài trước đó. Nộp lại sẽ thay bài cũ{needConfirm ? ", xoá điểm và nhận xét" : ""}.</p>
      )}
      {/* Một cột: vùng thả rộng hết thẻ → chú thích giới hạn → tệp đã chọn (tiến độ, lỗi tại chỗ) → Nộp bài. */}
      <div className="grid gap-4">
        <div>
          <Zone onFiles={fs => uploads.addFiles(fs, drafts.length)} describedBy={capId} />
          <Caption id={capId} limits={limits} />
        </div>
        <div>
          {(draftRows.length > 0 || localRows.length > 0) && <ul aria-label="Tệp đã chọn" className="space-y-2 mb-3">{draftRows}{localRows}</ul>}
          <form ref={formRef} method="post" action={`/api/student/nop-bai/${encodeURIComponent(assignmentId)}/nop`} onSubmit={onSubmit} data-nop-tep-form="">
            <div className="flex flex-wrap items-center gap-3">
              <KinButton type="submit" variant="primary" loading={submitting} loadingLabel="Đang nộp…" disabled={!canSubmit} data-nop-tep-nop="" className="w-full sm:w-auto">Nộp bài</KinButton>
              {hasSub && <KinButton type="button" variant="ghost" onClick={() => void cancelResubmit()} disabled={submitting} data-nop-tep-huy="">Huỷ nộp lại</KinButton>}
            </div>
            <p role="status" aria-live="polite" data-nop-tep-tom-tat="" className={`mt-2 ${SMALL} ${T_MO}`}>{submitting ? "Đang gửi bài cho gia sư…" : hint}</p>
          </form>
          <KinCallout className="mt-3"><span data-nop-tep-canh-bao="">Đừng ghi thông tin cá nhân không cần thiết vào bài (số điện thoại, địa chỉ nhà, ảnh có mặt người).</span></KinCallout>
        </div>
      </div>
    </div>
  );

  const submittedBlock = hasSub && !composing && (
    <div data-nop-tep-da-nop="">
      <p role="status" className={`${GOC} font-medium ${T_XONG}`}>
        {`Đã nộp lúc ${formatVnStamp(submittedAt)}.`}
      </p>
      <p className={`mt-0.5 ${SMALL} ${T_MO}`}>{graded ? "Gia sư đã chấm bài này." : "Gia sư sẽ chấm và nhận xét."}</p>

      {legacy && sub ? (
        <ul aria-label="Bài đã nộp" className="mt-3 space-y-2">
          {/* Bài nộp cũ không qua kho riêng tư: nộp tệp (có fileName, URL công khai) hoặc link Azota (không có fileName). Giữ nguyên, chỉ ghi nhãn. */}
          <FileRow name={sub.fileName || "Link bài làm"} extFallback={sub.fileName ? "" : "LINK"} state="tep-cu" detail={sub.fileName ? "Tệp cũ (lưu công khai)" : "Link bài làm đã nộp"}
            actions={<a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" data-nop-tep-tai="" className={kinButtonClass("secondary")}>{sub.fileName ? "Mở tệp" : "Mở link"}</a>} />
        </ul>
      ) : allExpired ? (
        <p role="status" data-nop-tep-het-han="" className={`mt-3 px-4 py-3 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] ${GOC} ${T_MO}`}>{expiredText(list.limits.retentionDays)}</p>
      ) : submitted.length > 0 ? (
        <ul aria-label="Bài đã nộp" className="mt-3 space-y-2">
          {submitted.map(f => f.expired ? (
            <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="het-han" detail={expiredText(list.limits.retentionDays)} />
          ) : (
            <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="da-nop" detail={<span data-nop-tep-han="">{`${formatBytes(f.sizeBytes)}${f.sizeBytes != null ? " · " : ""}Hết hạn tải sau ${formatVnDate(f.expiresAt)}; sau đó tệp bị xoá, điểm và nhận xét vẫn giữ.`}</span>}
              actions={<DownloadLinks f={f} withView />} />
          ))}
        </ul>
      ) : null}

      {tutorFiles.length > 0 && (
        <div className="mt-4" data-nop-tep-tep-tra="">
          <p className={`${GOC} font-medium ${T_CHINH}`}>Tệp gia sư trả bài</p>
          <ul aria-label="Tệp gia sư trả bài" className="mt-2 space-y-2">
            {tutorFiles.map(f => f.expired
              ? <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="het-han" detail={expiredText(list.limits.retentionDays)} />
              : <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="da-tra" detail={`${formatBytes(f.sizeBytes)}${f.sizeBytes != null ? " · " : ""}Hết hạn tải sau ${formatVnDate(f.expiresAt)}`} actions={<DownloadLinks f={f} withView />} />)}
          </ul>
        </div>
      )}

      {enabled && (
        <div className="mt-4">
          <KinButton type="button" variant="secondary" onClick={() => setResubmitting(true)} data-nop-tep-nop-lai="">Nộp lại bài</KinButton>
        </div>
      )}
    </div>
  );

  return (
    <section data-nop-tep="student" data-trang-thai={trang} aria-busy={uploading > 0 || submitting ? true : undefined} className="mt-1">
      {dialog}
      {!enabled && <DisabledNote title="Kho tệp chưa bật" />}
      {composeBlock}
      {submittedBlock}
    </section>
  );
}

// ── Gia sư trả bài ────────────────────────────────────────────────────────────
const TutorReturnBox = forwardRef<NopTepBoxHandle, { assignmentId: string; submissionId: string }>(function TutorReturnBox({ assignmentId, submissionId }, ref) {
  const scope = useMemo<NopTepScope>(() => ({ mode: "tutor_return", assignmentId, submissionId }), [assignmentId, submissionId]);
  const { state, load } = useNopTepList(scope);
  const [forcedOff, setForcedOff] = useState(false);
  const [removeMsg, setRemoveMsg] = useState<string | null>(null);
  const { ask, dialog } = useKinConfirm();
  const capId = `nt-cap-tra-${submissionId}`;
  const limits = state.status === "ok" ? state.data.limits : FALLBACK_LIMITS;
  const uploads = useUploads(scope, limits, () => undefined, () => setForcedOff(true));
  const { itemsRef, clearReady } = uploads;
  const draftIdsRef = useRef<string[]>([]);
  useEffect(() => {
    draftIdsRef.current = state.status === "ok" ? state.data.files.filter(f => f.kind === "tutor_return" && !f.submitted && f.status === "ready" && !f.expired).map(f => f.id) : [];
  }, [state]);

  useImperativeHandle(ref, () => ({
    attach: async () => {
      const its = itemsRef.current;
      if (its.some(i => i.state === "dang-tai" || i.state === "kiem-tra")) return { ok: false, message: "Tệp trả bài còn đang tải lên. Đợi tải xong rồi bấm gửi lại." };
      const ids = [...new Set([...its.filter(i => i.state === "san-sang" && i.fileId).map(i => i.fileId as string), ...draftIdsRef.current])];
      if (ids.length === 0) return { ok: true };
      const r = await attachNopTepReturn(submissionId, ids);
      if (!r.ok) return { ok: false, message: "Điểm đã gửi, chưa đính kèm được tệp. Thử lại." };
      clearReady();
      await load(true);
      return { ok: true };
    },
  }), [itemsRef, clearReady, load, submissionId]);

  if (state.status === "loading") return <section data-nop-tep="tutor_return" data-trang-thai="dang-tai"><div aria-busy="true" aria-label="Đang tải khối trả bài" className="kin-skel kin-skel--soft h-24 rounded" /></section>;
  if (state.status === "error") return <section data-nop-tep="tutor_return" data-trang-thai="loi-tai"><LoadError onRetry={() => void load()} /></section>;

  const list = state.data;
  const enabled = list.enabled && !forcedOff;
  const localIds = new Set(uploads.items.map(i => i.fileId).filter(Boolean));
  const attached = list.files.filter(f => f.kind === "tutor_return" && f.submitted && !localIds.has(f.id));
  // Bản nháp tệp trả bài CỦA CHÍNH GIA SƯ từ lần mở trước (máy chủ trả submitted:false): vẫn chiếm hạn mức 3 tệp và sẽ được gắn khi bấm gửi.
  const serverDrafts = list.files.filter(f => f.kind === "tutor_return" && !f.submitted && f.status === "ready" && !f.expired && !localIds.has(f.id));

  async function removeAttached(f: NopTepFileView) {
    const ok = await ask({ title: "Gỡ tệp trả bài này?", message: "Học sinh sẽ không còn thấy tệp này. Điểm và nhận xét giữ nguyên.", confirmLabel: "Gỡ tệp" });
    if (!ok) return;
    const r = await removeNopTepFile(f.id);
    setRemoveMsg(r.ok ? null : (r.message || "Chưa gỡ được tệp. Thử lại sau ít phút."));
    await load(true);
  }

  return (
    <section data-nop-tep="tutor_return" data-trang-thai={!enabled ? "tat" : uploads.items.length || attached.length || serverDrafts.length ? "co-tep" : "trong"} aria-labelledby={`nt-tra-h-${submissionId}`}>
      {dialog}
      <h3 id={`nt-tra-h-${submissionId}`} className={`${GOC} font-medium ${T_CHINH}`}>Tệp trả bài (tuỳ chọn)</h3>
      {!enabled ? (
        <div className="mt-2"><DisabledNote /></div>
      ) : (
        <>
          <div className="mt-2">
            <Zone compact onFiles={fs => uploads.addFiles(fs, serverDrafts.length)} describedBy={capId} />
            <Caption id={capId} limits={limits} extra="Tệp được gửi cùng điểm khi bấm Gửi điểm & phản hồi." />
          </div>
          {(uploads.items.length > 0 || serverDrafts.length > 0) && (
            <ul aria-label="Tệp trả bài đã chọn" className="mt-3 space-y-2">
              {serverDrafts.map(f => (
                <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="san-sang" tone="xong" detail={`${formatBytes(f.sizeBytes)}${f.sizeBytes != null ? " · " : ""}Đã kiểm tra, sẵn sàng`}
                  actions={<ActionBtn onClick={() => void removeNopTepFile(f.id).then(() => load(true))} hook="data-nop-tep-bo">Bỏ tệp</ActionBtn>} />
              ))}
              {uploads.items.map(it => <LocalRow key={it.key} it={it} onRetry={() => uploads.retry(it.key)} onDismiss={() => uploads.dismiss(it.key)} />)}
            </ul>
          )}
        </>
      )}
      {attached.length > 0 && (
        <div className="mt-4" data-nop-tep-tep-tra="">
          <p className={`${SMALL} ${T_MO}`}>Đã trả cho học sinh</p>
          <ul aria-label="Tệp đã trả cho học sinh" className="mt-2 space-y-2">
            {attached.map(f => f.expired
              ? <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="het-han" detail={expiredText(list.limits.retentionDays)} />
              : <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="da-tra" detail={`${formatBytes(f.sizeBytes)}${f.sizeBytes != null ? " · " : ""}Hết hạn tải sau ${formatVnDate(f.expiresAt)}`}
                  actions={<><DownloadLinks f={f} withView /><ActionBtn onClick={() => void removeAttached(f)} hook="data-nop-tep-go">Gỡ tệp</ActionBtn></>} />)}
          </ul>
          {removeMsg && <p role="alert" className={`mt-2 ${SMALL} ${T_LOI}`}>{removeMsg}</p>}
        </div>
      )}
    </section>
  );
});

// ── Gia sư xem tệp học sinh nộp ───────────────────────────────────────────────
/** Danh sách tệp học sinh đã nộp cho MỘT bài nộp (thay "Mở bài nộp gốc"). Tên tệp đã được máy chủ ẩn/đổi nếu người xem không được thấy tên. */
export function NopTepStudentFiles({ assignmentId, submissionId }: { assignmentId: string; submissionId: string }) {
  const scope = useMemo<NopTepScope>(() => ({ mode: "tutor_return", assignmentId, submissionId }), [assignmentId, submissionId]);
  const { state, load } = useNopTepList(scope);
  if (state.status === "loading") return <div aria-busy="true" aria-label="Đang tải tệp của học sinh" data-nop-tep-ds="dang-tai" className="kin-skel kin-skel--soft h-14 rounded" />;
  if (state.status === "error") return <div data-nop-tep-ds="loi-tai"><LoadError onRetry={() => void load()} /></div>;
  const files = state.data.files.filter(f => f.kind === "student" && (f.status === "ready" || f.expired));
  const days = state.data.limits.retentionDays;
  if (files.length === 0) return <p data-nop-tep-ds="trong" className={`${GOC} ${T_MO}`}>Bài nộp này chưa có tệp.</p>;
  if (files.every(f => f.expired)) return <p role="status" data-nop-tep-ds="het-han" data-nop-tep-het-han="" className={`px-4 py-3 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] ${GOC} ${T_MO}`}>{expiredText(days)}</p>;
  return (
    <div data-nop-tep-ds="co-tep">
      <ul aria-label="Tệp học sinh đã nộp" className="space-y-2">
        {files.map(f => f.expired
          ? <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="het-han" detail={expiredText(days)} />
          : <FileRow key={f.id} id={f.id} name={f.name} extFallback={f.ext} state="da-nop" detail={`${formatBytes(f.sizeBytes)}${f.sizeBytes != null ? " · " : ""}Hết hạn tải sau ${formatVnDate(f.expiresAt)}`} actions={<DownloadLinks f={f} withView />} />)}
      </ul>
      <p className={`mt-2 ${SMALL} ${T_MO}`}>Khi mở tệp Word trên máy, hãy bật chế độ xem bảo vệ (Protected View) của Word.</p>
    </div>
  );
}

// ── Cửa vào ───────────────────────────────────────────────────────────────────
export const NopTepBox = forwardRef<NopTepBoxHandle, NopTepBoxProps>(function NopTepBox(props, ref) {
  if (props.mode === "tutor_return") {
    if (!props.submissionId) return null;
    return <TutorReturnBox ref={ref} assignmentId={props.assignmentId} submissionId={props.submissionId} />;
  }
  return <StudentBox assignmentId={props.assignmentId} submission={props.submission} />;
});

export default NopTepBox;
