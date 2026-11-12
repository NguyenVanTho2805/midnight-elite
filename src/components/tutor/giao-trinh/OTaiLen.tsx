// BU-02-PHẲNG — Ô tải lên CHUNG của màn Giáo trình: một ô nhận cả link lẫn tệp (kéo-thả ở máy tính, hai nút lớn ở điện thoại).
//  - MỖI link hoặc tệp = MỘT MỤC MỚI trong lớp (thả 3 tệp ⇒ 3 mục). Không cần chương, không đặt tên bài trước. Mục mới ở dạng NHÁP; công tắc "Đăng ngay" đăng thẳng.
//  - Tuỳ chọn "Gắn vào mục có sẵn" (một video + tài liệu kèm theo) thay cho mục mới.
//  - Dán link → nhận diện NGAY bằng routeInput: chip "Nhận diện: YouTube ✓ · sẽ thêm vào Video" hoặc lỗi đỏ tại chỗ. Video CHỈ là link YouTube: ở đây KHÔNG có giao diện tải video
//    (không ô xác nhận video, không đuôi video trong `accept`); thả tệp .mp4 → lỗi tại chỗ, không có yêu cầu mạng.
//  - Thả tệp → kiểm trước ở trình duyệt (đuôi, dung lượng, hạn mức) rồi mới có yêu cầu mạng: init → tải → complete → G2. Tối đa 2 tệp cùng lúc, mỗi tệp một thanh tiến trình, huỷ được.
//    Hàng chờ ngay dưới ô là các hàng "Đang tải" (chỉ ở trình duyệt, không lưu); xong thì thành mục Nháp trong danh sách.
//  - Giới hạn ghi sẵn TRƯỚC khi chọn. Cam kết bản quyền tích một lần mỗi phiên. Xong một mục: "Đã thêm …" + Hoàn tác. Lỗi thì ở chỗ, có Thử lại.
// Màu chỉ qua token --kin-*. Không window.confirm.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useTaiLenTep, canRetryEntry } from "@/components/tutor/upload/useTaiLenTep";
import { KinButton } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD } from "@/components/kin/PageLayout";
import { routeInput, type GiaoTrinhSnapshot, type GtEntry } from "@/lib/giaoTrinh";
import type { MediaSlot } from "@/lib/mediaLink";
import { formatMegabytes } from "@/lib/mediaStorage";
import { COPYRIGHT_PLEDGE_LABEL, COPYRIGHT_NOTICE } from "@/lib/classRecordings";
import type { AddResult, GtTarget } from "./useGiaoTrinh";
import { ChipTrangThai } from "./ChipTrangThai";
import { KinSelect } from "@/components/kin/KinSelect";

/** Mục (kiểu) mà link sẽ thành; khớp nhãn kiểu trên hàng. */
const SLOT_NAME: Record<MediaSlot, string> = { video: "Video", live: "Buổi live", azota: "Bài tập", document: "Tài liệu" };
/** Dải nguồn NHẬN ĐƯỢC (bỏ Vimeo: video chỉ nhận link YouTube; Zoom ở đây là link buổi live). */
const SOURCES = ["YouTube", "Google Drive", "Zoom (phòng học)", "Meet", "Azota", "Google Form", "PDF", "Word", "Excel", "PowerPoint", "Ảnh"];
const PLEDGE_KEY = "kin.gt.cam-ket";

export interface AddedInfo { lessonId: string; key: string; createdLesson: boolean }

export interface OTaiLenProps {
  courseId: string;
  config: GiaoTrinhSnapshot["config"];
  /** Các mục hiện có (cho lựa chọn "Gắn vào mục có sẵn"). */
  entries: GtEntry[];
  onAdd: (target: GtTarget, url: string, name?: string, extra?: { publish?: boolean }) => Promise<AddResult>;
  /** Hoàn tác: mục vừa tạo ⇒ xoá mục; nội dung gắn thêm ⇒ gỡ nội dung đó. */
  onUndo: (info: AddedInfo) => Promise<boolean>;
  /** Lớp chưa có mục nào: ô phóng lớn. */
  large?: boolean;
  /** LOI-07: người xem được tải tệp lên KiN không. /api/media/document/init chỉ nhận CHỦ lớp (403 với đồng giảng / bộ môn) ⇒ false: chỉ còn dán link,
   *  không ô chọn tệp; thả tệp vào ô báo tại chỗ, không có yêu cầu mạng (cam kết bản quyền vẫn hiện: nó nói cả về link). Mặc định true. */
  allowFiles?: boolean;
}

const OWNER_ONLY_FILES = "Chỉ chủ lớp tải tệp lên KiN được. Bạn dán link (YouTube, Google Drive…) vào ô trên nhé.";

export default function OTaiLen({ courseId, config, entries: lessons, onAdd, onUndo, large, allowFiles = true }: OTaiLenProps) {
  const [text, setText] = useState("");
  const [attachTo, setAttachTo] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [pledge, setPledge] = useState(false);
  const [drag, setDrag] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [boxError, setBoxError] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; warning: string | null; undo: AddedInfo | null } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const live = useRef(true);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { live.current = true; try { if (sessionStorage.getItem(PLEDGE_KEY) === "1") setPledge(true); } catch { /* không có sessionStorage */ } return () => { live.current = false; }; }, []);
  const setPledgeSaved = (v: boolean) => { setPledge(v); try { sessionStorage.setItem(PLEDGE_KEY, v ? "1" : "0"); } catch { /* bỏ qua */ } };

  // Mục được chọn để gắn thêm đã biến mất (xoá, hoàn tác) ⇒ coi như "Mục mới".
  const attach = attachTo && lessons.some(l => l.id === attachTo) ? attachTo : "";
  const recognised = useMemo(() => (text.trim() ? routeInput({ text }, config) : null), [text, config]);
  const targetNow = useCallback((): GtTarget => (attach ? { kind: "entry", lessonId: attach } : { kind: "new" }), [attach]);
  const attachTitle = lessons.find(l => l.id === attach)?.title ?? "mục đã chọn";

  function announce(r: AddResult, itemName: string) {
    if (!live.current) return;
    if (!r.ok) { setBoxError(r.error ?? "Chưa thêm được."); return; }
    setBoxError(null);
    if (r.duplicate) { setDone({ text: `“${itemName}” đã có rồi, không thêm lần nữa.`, warning: null, undo: null }); return; }
    const where = r.createdLesson ? (publishNow ? " thành mục mới, đã đăng cho học sinh" : " thành mục mới ở dạng Nháp") : ` vào “${attachTitle}”`;
    setDone({ text: `Đã thêm “${itemName}”${where}.`, warning: r.warning ?? null, undo: r.lessonId && r.key ? { lessonId: r.lessonId, key: r.key, createdLesson: !!r.createdLesson } : null });
  }

  // ── Dán link ────────────────────────────────────────────────────────────────
  async function submitLink() {
    const t = text.trim();
    if (!t || linkBusy) return;
    const rec = routeInput({ text: t }, config);
    if (!rec.ok) { setBoxError(rec.error); return; }
    setLinkBusy(true); setBoxError(null); setDone(null);
    const r = await onAdd(targetNow(), t, rec.suggestedName || undefined, { publish: publishNow && !attach });
    if (!live.current) return;
    setLinkBusy(false);
    announce(r, rec.suggestedName || rec.label);
    if (r.ok) setText("");
  }

  // ── Thả / chọn tệp ──────────────────────────────────────────────────────────
  // Hàng đợi tải (kiểm → init → gửi → complete, tối đa 2 tệp, huỷ / thử lại) nằm ở hook dùng chung với ngăn "Thêm bài học" (upload/useTaiLenTep.ts).
  const up = useTaiLenTep({
    courseId, config, pledge,
    onUploaded: async (link, name) => {
      const r = await onAdd(targetNow(), link, name, { publish: publishNow && !attach });
      announce(r, name);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? "Chưa thêm được." };
    },
  });
  const { queue, cancel, retry, dismiss } = up;
  function enqueue(list: FileList | File[]) {
    setBoxError(null); setDone(null);
    const r = up.enqueue(list);
    if (r.needPledge) setBoxError("Hãy tích ô cam kết bản quyền bên dưới trước khi tải tệp lên.");
  }

  async function undo() {
    if (!done?.undo || undoBusy) return;
    setUndoBusy(true);
    const ok = await onUndo(done.undo);
    if (!live.current) return;
    setUndoBusy(false);
    setDone(ok ? { text: "Đã hoàn tác, mục vừa thêm đã được gỡ.", warning: null, undo: null } : null);
    if (!ok) setBoxError("Chưa hoàn tác được. Gỡ ở danh sách bên dưới.");
  }

  function onDrop(ev: DragEvent<HTMLDivElement>) {
    ev.preventDefault(); setDrag(false);
    const dropped = ev.dataTransfer.files;
    if (dropped && dropped.length) {
      if (!allowFiles) { setDone(null); setBoxError(OWNER_ONLY_FILES); return; }
      enqueue(dropped); return;
    }
    const t = ev.dataTransfer.getData("text/uri-list") || ev.dataTransfer.getData("text/plain");
    if (t) { setText(t.split("\n")[0].trim()); inputRef.current?.focus(); }
  }

  const doc = config.document;
  const exts = doc.exts.map(x => x.toUpperCase()).join(", ");
  const left = Math.max(0, doc.quotaBytes - doc.usedBytes);
  const accept = doc.enabled ? doc.exts.map(x => "." + x).join(",") : "";
  const busyFiles = queue.some(e => e.state === "up" || e.state === "wait");

  return (
    <section aria-labelledby="gt-o-tai" data-gt-o-tai className={`rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] ${large ? "p-6 md:p-10" : "p-4 md:p-5"}`}>
      <h2 id="gt-o-tai" className="font-medium text-[var(--kin-chu-chinh)] text-[length:var(--kin-co-tieu-de)]">Thêm mục vào lớp</h2>
      <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        {allowFiles ? <>
          <span className="max-md:hidden">Kéo thả tệp vào đây, hoặc dán link. Mỗi link hoặc tệp là một mục mới.</span>
          <span className="md:hidden">Dán link hoặc chọn tệp từ máy. Mỗi link hoặc tệp là một mục mới.</span>
        </> : <>Dán link vào ô dưới. Mỗi link là một mục mới.</>}
      </p>
      <p data-gt-gioi-han className="mt-1 text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)]">
        {!allowFiles
          ? <span data-gt-chi-chu-lop>Tải tệp lên KiN chỉ dành cho chủ lớp. Tài liệu: dán link Google Drive. </span>
          : doc.enabled
            ? <>{exts} · tối đa {formatMegabytes(doc.maxBytes)} mỗi tệp · còn {formatMegabytes(left)} trong kho của bạn. </>
            : <>{doc.reason ?? "Chưa bật tải tệp lên KiN. Hãy dán link Google Drive."} </>}
        <b className="font-medium">Video: dán link YouTube.</b>
      </p>
      <p data-gt-nguon className="mt-1 text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)]">Nhận được: {SOURCES.join(" · ")}</p>

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
                <KinStatus tone="xong" className="whitespace-normal">Nhận diện: {recognised.label} ✓ · sẽ thêm vào {SLOT_NAME[recognised.slot]}</KinStatus>
                {recognised.warning && <p className="mt-1 text-[var(--kin-tt-chu-cho)]">{recognised.warning}</p>}
              </>
            ) : (
              <div data-gt-nhan-dien-loi>
                <KinStatus tone="loi" className="whitespace-normal">{recognised.error}</KinStatus>
                {recognised.moveTo && <p data-gt-goi-y className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Gợi ý: link này hợp với {SLOT_NAME[recognised.moveTo]}. KiN tự chọn kiểu theo loại link, nên hãy kiểm tra lại link đã dán.</p>}
              </div>
            )}
          </div>
        )}

        {allowFiles && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" multiple accept={accept || undefined} className="hidden" aria-label="Chọn tệp từ máy"
              onChange={e => { const l = e.target.files; if (l) enqueue(l); e.target.value = ""; }} />
            <KinButton type="button" variant="secondary" className="max-md:flex-1" onClick={() => fileRef.current?.click()}>Chọn tệp từ máy</KinButton>
            <KinButton type="button" variant="secondary" className="md:hidden flex-1" onClick={() => { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: "center" }); }}>Dán link</KinButton>
          </div>
        )}
      </div>

      {lessons.length > 0 && (
        <div className="mt-4">
          <label htmlFor="gt-gan-vao" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Thêm thành</label>
          <KinSelect id="gt-gan-vao" data-gt-gan-vao className="mt-1" value={attach} onChange={v => setAttachTo(v)}>
            <option value="">Mục mới (mặc định)</option>
            <optgroup label="Gắn vào mục có sẵn">
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </optgroup>
          </KinSelect>
        </div>
      )}

      <div className="mt-2">
        <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] cursor-pointer">
          <input type="checkbox" data-gt-dang-ngay checked={publishNow && !attach} disabled={!!attach} onChange={e => setPublishNow(e.target.checked)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
          <span>Đăng ngay cho học sinh<span className="block text-[var(--kin-chu-mo)]">{attach ? "Mục có sẵn giữ nguyên trạng thái của nó." : "Tắt thì mục mới ở dạng Nháp, chỉ bạn thấy. Bạn đăng khi sẵn sàng."}</span></span>
        </label>
        <label className="flex items-start gap-3 min-h-11 py-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] cursor-pointer">
          <input type="checkbox" checked={pledge} onChange={e => setPledgeSaved(e.target.checked)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
          <span>{COPYRIGHT_PLEDGE_LABEL}</span>
        </label>
        <p className="text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-mo)]">{COPYRIGHT_NOTICE}</p>
      </div>

      {boxError && <p role="alert" data-gt-loi className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{boxError}</p>}

      {queue.length > 0 && (
        <ul aria-label="Tệp đang tải lên" data-gt-hang-doi className="mt-4 space-y-3">
          {queue.map(e => (
            <li key={e.id} data-gt-tep={e.state} className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words">
                    <span className="min-w-0 break-words">{e.file.name}</span>
                    {(e.state === "wait" || e.state === "up") && <ChipTrangThai status="uploading" />}
                  </p>
                  <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{formatMegabytes(e.file.size)}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {(e.state === "up" || e.state === "wait") && <KinButton type="button" variant="secondary" onClick={() => cancel(e.id)} aria-label={`Huỷ tải ${e.file.name}`}>Huỷ</KinButton>}
                  {canRetryEntry(e) && <KinButton type="button" variant="secondary" onClick={() => retry(e.id)}>Thử lại</KinButton>}
                  {(e.state === "err" || e.state === "done") && <KinButton type="button" variant="ghost" onClick={() => dismiss(e.id)} aria-label={`Đóng thông báo về ${e.file.name}`}>Đóng</KinButton>}
                </div>
              </div>
              {(e.state === "up" || e.state === "wait") && (
                <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={e.pct} aria-label={`Đang tải ${e.file.name}`}>
                  <div className="h-2 rounded-[var(--kin-bo-tron)] overflow-hidden bg-[var(--kin-vien-nhat)]"><div className="h-full bg-[var(--kin-nhan-nen)]" style={{ width: `${e.pct}%`, transition: "width .2s" }} /></div>
                  <p className="mt-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{e.state === "wait" ? "Đang chờ tới lượt…" : `Đang tải lên… ${e.pct}%`}</p>
                </div>
              )}
              {e.state === "done" && <p className="mt-2"><KinStatus tone="xong">Đã thêm vào danh sách</KinStatus></p>}
              {e.state === "err" && <p role="alert" data-gt-loi-tep className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{e.message}</p>}
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
