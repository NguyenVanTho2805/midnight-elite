// GS-LOP-GON — "Tài liệu đính kèm" của ngăn Thêm / Sửa bài học. Trước đây chỉ có ô tên + dán link Drive và dòng "Tải tệp lên: dùng tab Giáo trình (sắp có)".
// Nay có VÙNG KÉO THẢ thật (Word, PDF, ảnh…; nhiều tệp): thả hoặc "Chọn tệp từ máy" ⇒ tải NGAY (init → gửi byte có tiến trình → complete, cùng đường với ô tải của màn Giáo trình,
// hook dùng chung upload/useTaiLenTep) ⇒ xong thành một dòng tài liệu của bài (link `/api/media/<mã>/file` trong JSON `documents`, lưu cùng bài; máy chủ gắn tệp vào bài lúc lưu).
// Dán link Google Drive vẫn còn, là lối phụ. Kho tắt (document.enabled=false) ⇒ hiện nguyên văn lý do, khung thả khoá, vẫn dán link được.
// VIDEO tệp vẫn bị chặn (chỉ dán link YouTube): KHÔNG đọc config.video, không có đuôi video trong `accept`; thả .mp4 ⇒ lỗi tại chỗ, không có yêu cầu mạng.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { KinButton } from "@/components/kin/Button";
import { COPYRIGHT_NOTICE, COPYRIGHT_PLEDGE_LABEL } from "@/lib/classRecordings";
import { checkLinkForSlot } from "@/lib/mediaLink";
import { MAX_DOCUMENTS_PER_LESSON, formatMegabytes } from "@/lib/mediaStorage";
import type { GtConfig } from "@/lib/giaoTrinh";
import { useTaiLenTep, canRetryEntry } from "@/components/tutor/upload/useTaiLenTep";

export interface DocItem { name: string; url: string; type?: string }

export function detectType(url: string, name: string): string {
  if (/docs\.google\.com\/document/i.test(url))      return "doc";
  if (/docs\.google\.com\/spreadsheets/i.test(url))  return "xls";
  if (/docs\.google\.com\/presentation/i.test(url))  return "ppt";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext))                          return "pdf";
  if (["doc","docx"].includes(ext))                   return "doc";
  if (["xls","xlsx"].includes(ext))                   return "xls";
  if (["ppt","pptx"].includes(ext))                   return "ppt";
  return "file";
}

const TYPE_COLOR: Record<string, string> = {
  pdf: "var(--kin-tt-chu-loi)", doc: "var(--kin-nhan-nen)", xls: "var(--kin-tt-chu-xong)", ppt: "var(--kin-tt-chu-cho)", file: "var(--kin-chu-mo)",
};

function DocBadge({ type }: { type: string }) {
  const t = type ?? "file";
  return (
    <span className="w-8 h-8 rounded flex items-center justify-center text-[var(--kin-chu-tren-nut-chinh)] text-[length:var(--kin-co-caption)] font-black flex-shrink-0 uppercase"
      style={{ background: TYPE_COLOR[t] ?? "var(--kin-chu-mo)" }}>
      {t}
    </span>
  );
}

const PLEDGE_KEY = "kin.gt.cam-ket"; // cùng khoá với ô tải của màn Giáo trình: tích một lần mỗi phiên
const KIN_FILE_RE = /^\/api\/media\/[A-Za-z0-9_-]+\/file$/;

type Cfg = { state: "loading" } | { state: "error" } | { state: "ok"; document: GtConfig["document"] };

const parseDocs = (raw: string): DocItem[] => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

export function DocumentsEditor({ value, onChange, courseId, canUpload, onAssetUploaded, onBusyChange }: {
  value: string; onChange: (v: string) => void;
  /** Lớp nhận tệp (init chỉ nhận chủ lớp). */
  courseId: string;
  /** false ⇒ không phải chủ lớp (vd quản trị xem): không có khung thả, vẫn dán link. */
  canUpload: boolean;
  /** Tệp vừa tải xong (mã FileAsset) — nơi bọc dùng để xoá nếu đóng ngăn không Lưu. */
  onAssetUploaded?: (assetId: string) => void;
  /** Còn tệp đang lên / chờ ⇒ true (khoá nút Lưu của ngăn). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const docs = parseDocs(value);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  const [newName, setNewName] = useState("");
  const [newUrl,  setNewUrl]  = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pledge, setPledge] = useState(false);
  const [cfg, setCfg] = useState<Cfg>({ state: "loading" });
  const fileRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { if (sessionStorage.getItem(PLEDGE_KEY) === "1") setPledge(true); } catch { /* không có sessionStorage */ } }, []);
  const setPledgeSaved = (v: boolean) => { setPledge(v); try { sessionStorage.setItem(PLEDGE_KEY, v ? "1" : "0"); } catch { /* bỏ qua */ } };

  // Một lần cho cả ngăn: kho tệp bật hay tắt (chỉ đọc khối document, không đọc video).
  const loadCfg = useCallback(() => {
    setCfg({ state: "loading" });
    fetch("/api/media/config", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { if (!d?.document) throw new Error("no document"); setCfg({ state: "ok", document: d.document as GtConfig["document"] }); })
      .catch(() => setCfg({ state: "error" }));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (canUpload) loadCfg(); }, [canUpload, loadCfg]);

  // Ghi vào JSON documents qua `latest` (không qua `docs` của lần vẽ này): hai tệp xong gần nhau không được ghi đè nhau.
  function save(list: DocItem[]) { const v = JSON.stringify(list); latest.current = v; onChange(v); }
  function append(item: DocItem) { save([...parseDocs(latest.current), item]); }

  const upCfg: GtConfig = { document: cfg.state === "ok" ? cfg.document : { enabled: false, reason: null, maxBytes: 0, quotaBytes: 0, usedBytes: 0, exts: [] } };
  const up = useTaiLenTep({
    courseId, config: upCfg, pledge,
    onUploaded: (link, name, meta) => {
      if (parseDocs(latest.current).length >= MAX_DOCUMENTS_PER_LESSON) return { ok: false, error: `Mỗi bài tối đa ${MAX_DOCUMENTS_PER_LESSON} tài liệu.` };
      append({ name, url: link, type: detectType(link, name) });
      onAssetUploaded?.(meta.assetId);
      return { ok: true };
    },
  });
  useEffect(() => { onBusyChange?.(up.busy); }, [up.busy, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  const clearQueue = up.clear;
  useEffect(() => () => clearQueue(), []); // eslint-disable-line react-hooks/exhaustive-deps -- huỷ các tệp còn đang lên khi ngăn đóng

  const inflight = up.queue.filter(e => e.state === "wait" || e.state === "up").length;

  function onFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    setProblem(null);
    if (docs.length + inflight + arr.length > MAX_DOCUMENTS_PER_LESSON) { setProblem(`Mỗi bài tối đa ${MAX_DOCUMENTS_PER_LESSON} tài liệu.`); return; }
    const r = up.enqueue(arr);
    if (r.needPledge) setProblem("Hãy tích ô cam kết bản quyền trước khi tải tệp lên.");
  }

  function add() {
    if (!newName.trim() || !newUrl.trim()) return;
    if (docs.length + inflight >= MAX_DOCUMENTS_PER_LESSON) { setProblem(`Mỗi bài tối đa ${MAX_DOCUMENTS_PER_LESSON} tài liệu.`); return; }
    const chk = checkLinkForSlot(newUrl, "document");
    if (!chk.ok) { setProblem(chk.error); return; }
    setProblem(null);
    const url = chk.info?.url ?? newUrl.trim();
    save([...docs, { name: newName.trim(), url, type: detectType(url, newName.trim()) }]);
    setNewName(""); setNewUrl("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= docs.length) return;
    const n = [...docs]; [n[i], n[j]] = [n[j], n[i]]; save(n);
  }
  function remove(i: number) { save(docs.filter((_, idx) => idx !== i)); }

  const inp = "px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-[var(--kin-nen-trang)] min-h-11";
  const ready = cfg.state === "ok" && cfg.document.enabled;
  const d = cfg.state === "ok" ? cfg.document : null;
  const accept = ready && d ? d.exts.map(x => "." + x).join(",") : undefined;

  return (
    <div data-tai-lieu>
      <p className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Tài liệu đính kèm</p>

      {(docs.length > 0 || up.queue.length > 0) && (
        <div className="space-y-2 mb-3">
          {docs.map((doc, i) => (
            <div key={`doc-${i}`} data-tai-lieu-hang className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50">
              <DocBadge type={detectType(doc.url, doc.name)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400 truncate">{KIN_FILE_RE.test(doc.url) ? "Tệp tải lên KiN" : doc.url}</p>
              </div>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Đưa "${doc.name}" lên trên`}
                className="text-xs px-2 rounded flex-shrink-0 disabled:opacity-30" style={{ minHeight: 44, minWidth: 44, color: "var(--kin-chu-mo)" }}>▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === docs.length - 1} aria-label={`Đưa "${doc.name}" xuống dưới`}
                className="text-xs px-2 rounded flex-shrink-0 disabled:opacity-30" style={{ minHeight: 44, minWidth: 44, color: "var(--kin-chu-mo)" }}>▼</button>
              <button type="button" onClick={() => remove(i)} aria-label={`Bỏ "${doc.name}"`}
                className="text-xs px-2 rounded flex-shrink-0" style={{ minHeight: 44, minWidth: 44, color: "var(--kin-tt-chu-loi)" }}>✕</button>
            </div>
          ))}
          {up.queue.filter(e => e.state !== "done").map(e => (
            <div key={`q-${e.id}`} data-tai-lieu-tep={e.state} className="p-2.5 rounded-lg border border-dashed" style={{ borderColor: "var(--kin-nhan-vien)", background: "var(--kin-nhan-nen-nhat)" }}>
              <div className="flex items-center gap-2">
                <DocBadge type={detectType(e.file.name, e.file.name)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 break-words">{e.file.name}</p>
                  <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{formatMegabytes(e.file.size)}</p>
                </div>
                {(e.state === "wait" || e.state === "up") && <KinButton type="button" variant="secondary" onClick={() => up.cancel(e.id)} aria-label={`Huỷ tải ${e.file.name}`}>Huỷ</KinButton>}
                {canRetryEntry(e) && <KinButton type="button" variant="secondary" onClick={() => up.retry(e.id)}>Thử lại</KinButton>}
                {e.state === "err" && <KinButton type="button" variant="ghost" onClick={() => up.dismiss(e.id)} aria-label={`Đóng thông báo về ${e.file.name}`}>Đóng</KinButton>}
              </div>
              {(e.state === "wait" || e.state === "up") && (
                <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={e.pct} aria-label={`Đang tải ${e.file.name}`}>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--kin-vien-nhat)" }}><div className="h-full" style={{ width: `${e.pct}%`, background: "var(--kin-nhan-nen)", transition: "width .2s" }} /></div>
                  <p className="mt-1 text-xs" style={{ color: "var(--kin-chu-mo)" }}>{e.state === "wait" ? "Đang chờ tới lượt…" : `Đang tải lên… ${e.pct}%`}</p>
                </div>
              )}
              {e.state === "err" && <p role="alert" data-tai-lieu-loi-tep className="mt-2 text-xs font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{e.message}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Vùng tải tệp lên KiN: 5 trạng thái — đang kiểm / lỗi kiểm / kho tắt / không phải chủ lớp / sẵn sàng. */}
      {!canUpload ? (
        <div data-tai-lieu-khung="khong-chu" className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-center mb-3" style={{ color: "var(--kin-chu-mo)" }}>
          Chỉ chủ lớp tải tệp lên KiN. Bạn vẫn dán link được.
        </div>
      ) : cfg.state === "loading" ? (
        <div data-tai-lieu-khung="dang-kiem" role="status" aria-busy className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-center mb-3" style={{ color: "var(--kin-chu-mo)" }}>Đang kiểm kho tệp…</div>
      ) : cfg.state === "error" ? (
        <div data-tai-lieu-khung="loi" role="alert" className="rounded-xl border border-dashed p-4 text-sm text-center mb-3 flex flex-col items-center gap-2" style={{ borderColor: "var(--kin-tt-chu-loi)", color: "var(--kin-tt-chu-loi)" }}>
          <span>Chưa kiểm được kho tệp. Cô vẫn dán link được.</span>
          <KinButton type="button" variant="secondary" onClick={loadCfg}>Thử lại</KinButton>
        </div>
      ) : !ready ? (
        <div data-tai-lieu-khung="tat" className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-center mb-3" style={{ color: "var(--kin-chu-mo)", background: "var(--kin-nen-bang)" }}>
          <p data-tai-lieu-ly-do>{d?.reason ?? "Tải tệp lên KiN chưa bật."}</p>
          <p className="mt-1 text-xs">Cô vẫn dán link Google Drive ở dưới được.</p>
        </div>
      ) : (
        <DropZone onFiles={onFiles} className="rounded-xl mb-3">
          <div data-tai-lieu-khung="san-sang" data-tai-lieu-tha className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--kin-vien-o-nhap)" }}>
            <p className="text-sm font-semibold text-gray-700">Kéo thả tệp Word, PDF hoặc ảnh vào đây</p>
            <p className="mt-1 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
              {d!.exts.map(x => x.toUpperCase()).join(", ")} · tối đa {formatMegabytes(d!.maxBytes)} mỗi tệp · tối đa {MAX_DOCUMENTS_PER_LESSON} tài liệu mỗi bài
            </p>
            <input ref={fileRef} type="file" multiple accept={accept} className="hidden" aria-label="Chọn tệp tài liệu từ máy"
              onChange={e => { const l = e.target.files; if (l) onFiles(l); e.target.value = ""; }} />
            <KinButton type="button" variant="secondary" className="mt-3" onClick={() => fileRef.current?.click()}>Chọn tệp từ máy</KinButton>
            <label className="mt-3 flex items-start gap-3 min-h-11 py-2 text-left text-xs leading-5 cursor-pointer" style={{ color: "var(--kin-chu-chinh)" }}>
              <input type="checkbox" data-tai-lieu-cam-ket checked={pledge} onChange={e => setPledgeSaved(e.target.checked)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span>{COPYRIGHT_PLEDGE_LABEL}</span>
            </label>
            <p data-tai-lieu-nhac className="text-xs text-left" style={{ color: "var(--kin-chu-mo)" }}>Tệp sẽ hiện cho học sinh của lớp ngay khi bài được lưu.</p>
          </div>
        </DropZone>
      )}

      <div className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>Hoặc dán link tài liệu</p>
        <input className={inp + " w-full"} placeholder="Tên tài liệu (VD: File Lý thuyết, File BTVN...)"
          value={newName} onChange={e => setNewName(e.target.value)} />

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input className={inp + " flex-1 min-w-0 w-full"} placeholder="Dán link Google Drive..."
            value={newUrl} onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()} />
          <button type="button" onClick={add} disabled={!newName.trim() || !newUrl.trim()}
            className="px-4 min-h-11 rounded-lg text-xs font-semibold text-white disabled:opacity-40 flex-shrink-0"
            style={{ background: "var(--kin-nhan-nen)" }}>
            + Thêm link
          </button>
        </div>
      </div>

      <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>
        Link Google Drive: chia sẻ &quot;Bất kỳ ai có liên kết&quot; · tối đa {MAX_DOCUMENTS_PER_LESSON} tài liệu mỗi bài. Video: chỉ dán link YouTube.
      </p>
      {/* MD-11: chữ cam kết bản quyền (CẦN LUẬT SƯ DUYỆT — xem COPYRIGHT_TEXT_NEEDS_LAWYER_REVIEW). */}
      <p data-copyright-notice className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>Khi thêm tài liệu hoặc link, bạn xác nhận: {COPYRIGHT_PLEDGE_LABEL} {COPYRIGHT_NOTICE}</p>
      {problem && <p role="status" data-loi className="text-xs mt-1 font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{problem}</p>}
      {docs.length === 0 && up.queue.length === 0 && (
        <p className="text-xs text-gray-400 mt-2 text-center">Chưa có tài liệu đính kèm.</p>
      )}
    </div>
  );
}
