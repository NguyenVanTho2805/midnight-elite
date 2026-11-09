// HP-LOP-TRUONG — bước NHẬP học phí tháng từ Excel / Google Sheet (mục 4.2, 5 của đặc tả): chọn tháng → tải mẫu → dán (Google Sheet) HOẶC thả tệp .xlsx →
// XEM TRƯỚC (không ghi gì) → cô xác nhận mới ghi. Giao diện chỉ HIỂN THỊ: máy chủ phân tích lại tệp lúc xác nhận và tính lại mọi số tiền.
// Xem trước: tám trạng thái, luôn CHỮ + biểu tượng (màu chỉ làm rõ thêm); dòng không khớp / trùng tên có ô chọn em; từng em ghi rõ "Số môn" lấy từ tệp hay do KiN đếm.
// Nút xác nhận tắt khi 0 dòng ghi được, hoặc còn dòng sai / chưa chọn được em mà chưa tích "Bỏ qua"; dính đáy màn hình. Không window.confirm: nút xác nhận chính là bước xác nhận.
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { KinButton } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { KinMoney } from "@/components/kin/MoneyVisibility";
import { callApi } from "@/components/tutor/shared";
import {
  PREVIEW_ORDER, PREVIEW_STATUS, YM_RANGE_MONTHS, capFirst, currentYmVn, needsAttention, normPreview, normSheet, periodText, shiftYm, sheetErrorText, sourceText, useIsWide, vndText,
  type PreviewData, type PreviewRow, type PreviewStatus, type SheetData,
} from "@/components/tutor/bangHocPhiTypes";

const apiBase = (courseId: string) => `/api/tutor/lop/${encodeURIComponent(courseId)}/bang-hoc-phi`;
const Money = ({ n }: { n: number }) => <KinMoney>{vndText(n)}</KinMoney>;
const dash = <span className="text-[var(--kin-chu-mo)]">—</span>;
const dmy = (k: string | null) => (k && /^\d{4}-\d{2}-\d{2}/.test(k) ? `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : k ?? "");
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024)).toLocaleString("vi-VN")} KB`;
/** Chọn em chỉ cho dòng chưa tự khớp một em. */
const pickable = (s: PreviewStatus) => s === "unmatched" || s === "ambiguous";

type Meta = { state: "loading" } | { state: "error"; text: string } | { state: "notsheet" } | { state: "ok"; data: SheetData };
interface Done { written: number | null; replaced: number | null; skipped: number | null; unchanged: number | null; locked: number | null; chargesCreated: number | null; chargesUpdated: number | null; chargesRemoved: number | null; totalNet: number | null }

/** Gửi tệp (multipart) hoặc chữ dán (JSON). Không dùng callApi: nó đặt content-type JSON và làm hỏng ranh giới multipart. */
async function postSheet(url: string, fields: Record<string, unknown>, file: File | null, text: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> & { error?: string; code?: string } }> {
  try {
    let init: RequestInit;
    if (file) {
      const fd = new FormData();
      fd.set("file", file);
      for (const [k, v] of Object.entries(fields)) fd.set(k, typeof v === "string" ? v : JSON.stringify(v));
      init = { method: "POST", body: fd };
    } else {
      init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fields, text }) };
    }
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: string; code?: string };
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Lỗi kết nối, cô thử lại sau." } };
  }
}

export default function BangHocPhiNhap({ courseId, courseName, ym: ymProp }: { courseId: string; courseName: string; ym: string | null }) {
  const [meta, setMeta] = useState<Meta>({ state: "loading" });
  const [tick, setTick] = useState(0);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pick, setPick] = useState<Record<number, string>>({});
  const [skipLines, setSkipLines] = useState<number[]>([]);
  const [skipErrors, setSkipErrors] = useState(false);
  const [busy, setBusy] = useState<"preview" | "confirm" | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wide = useIsWide();

  useEffect(() => {
    let alive = true;
    setMeta({ state: "loading" });
    callApi<Record<string, unknown> & { code?: string }>(`${apiBase(courseId)}${ymProp ? `?ym=${ymProp}` : ""}`).then(r => {
      if (!alive) return;
      if (r.ok) setMeta({ state: "ok", data: normSheet(r.data, ymProp ?? "") });
      else if (r.status === 409 && r.data.code === "NOT_SHEET_MODE") setMeta({ state: "notsheet" });
      else setMeta({ state: "error", text: sheetErrorText(r.status, r.data) });
    });
    return () => { alive = false; };
  }, [courseId, ymProp, tick]);

  const tabHref = (ym: string) => `/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-phi&ym=${ym}`;
  const header = (ym: string | null, sub?: string) => (
    <KinPageHeader title="Nhập học phí từ Excel hoặc Google Sheet" sub={sub ?? courseName}
      back={{ href: ym ? tabHref(ym) : `/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-phi`, label: "← Bảng học phí" }} />
  );

  if (meta.state === "loading") {
    return (
      <KinPage>
        {header(ymProp)}
        <div aria-busy="true" aria-label="Đang tải" data-bhn-state="loading" className="max-w-3xl space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-20 rounded kin-skel kin-skel--soft" />)}
        </div>
      </KinPage>
    );
  }
  if (meta.state === "error") {
    return (
      <KinPage>
        {header(ymProp)}
        <div role="alert" data-bhn-state="error" className="py-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
          {meta.text}{" "}
          <button type="button" className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={() => setTick(t => t + 1)}>Thử lại</button>
        </div>
      </KinPage>
    );
  }
  if (meta.state === "notsheet") {
    return (
      <KinPage>
        {header(ymProp)}
        <div data-bhn-state="notsheet"><KinEmptyState title="Lớp này chưa tính học phí theo bảng tháng" action={<Link href={`/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-phi`} className={kinButtonClass("secondary")}>Về tab Học phí</Link>}>
          Cách tính học phí của lớp được chọn ở tab Học phí. Lớp chưa có học phí nào thì cô bật được “Theo bảng học phí tháng” ở đó.
        </KinEmptyState></div>
      </KinPage>
    );
  }

  const data = meta.data;
  const ym = data.yearMonth;
  const cfg = data.config;
  const subjects = cfg?.subjects ?? [];
  const label = capFirst(periodText(data.period, ym));
  const unit = (data.period?.startDay ?? 1) > 1 ? "kỳ" : "tháng";
  if (!cfg) {
    return (
      <KinPage>
        {header(ym, `${courseName} · ${label}`)}
        <div data-bhn-state="empty-config"><KinEmptyState title="Cô chưa đặt bảng bậc" action={<Link href={tabHref(ym)} className={kinButtonClass("primary")}>Đặt bảng bậc ở tab Học phí</Link>}>
          Đặt bảng bậc một lần rồi mới tải mẫu và nhập được.
        </KinEmptyState></div>
      </KinPage>
    );
  }

  const roster = data.rows.filter(r => !r.left);
  const nowYm = data.currentYearMonth ?? currentYmVn();
  const minYm = shiftYm(nowYm, -YM_RANGE_MONTHS), maxYm = shiftYm(nowYm, YM_RANGE_MONTHS);
  const nhapHref = (m: string) => `/lop-cua-toi/${encodeURIComponent(courseId)}/bang-hoc-phi/nhap?ym=${m}`;
  const hasInput = file ? true : text.trim().length > 0;

  function resetPreview() { setPreview(null); setPick({}); setSkipLines([]); setSkipErrors(false); setFail(null); setDone(null); }
  function chooseFile(f: File | null) { setFile(f); setText(""); resetPreview(); }
  function clearAll() { setFile(null); setText(""); if (fileRef.current) fileRef.current.value = ""; resetPreview(); }

  /** Xem trước (không ghi gì). Máy chủ nhận cả `pick` để tính lại từng dòng sau khi cô chọn em: trạng thái, Phải đóng và tổng đều do máy chủ trả. */
  async function fetchPreview(nextPick: Record<number, string>): Promise<boolean> {
    if (busy) return false;
    setBusy("preview"); setFail(null);
    const picks: Record<string, string> = {};
    for (const [l, id] of Object.entries(nextPick)) if (id) picks[l] = id;
    const r = await postSheet(`${apiBase(courseId)}/nhap/xem-truoc`, { ym, pick: picks }, file, text);
    setBusy(null);
    if (!r.ok) { setFail(sheetErrorText(r.status, r.data)); return false; }
    setPreview(normPreview(r.data, ym));
    setPick(Object.fromEntries(Object.entries(picks).map(([l, id]) => [Number(l), id])));
    return true;
  }
  async function doPreview() {
    if (busy || !hasInput) return;
    resetPreview();
    await fetchPreview({});
  }
  async function onPick(line: number, id: string) {
    setSkipLines(c => c.filter(x => x !== line));
    await fetchPreview({ ...pick, [line]: id });
  }
  async function onSkip(line: number, checked: boolean) {
    if (!checked) { setSkipLines(c => c.filter(x => x !== line)); return; }
    setSkipLines(c => [...c, line]);
    if (pick[line]) { const next = { ...pick }; delete next[line]; await fetchPreview(next); }
  }

  // Đếm dòng để bật / tắt nút xác nhận. Chỉ ĐẾM: số dòng ghi được và tổng tiền do máy chủ trả (đã tính lại sau mỗi lần chọn em).
  const rows = preview?.rows ?? [];
  const pending = rows.filter(r => needsAttention(r.status) && !skipLines.includes(r.line));
  const writable = preview?.writable ?? 0;
  const canConfirm = !!preview && !preview.fatal && writable > 0 && (pending.length === 0 || skipErrors) && !busy;
  const whyNot = !preview || preview.fatal ? null
    : writable === 0 ? "Chưa có dòng nào ghi được."
    : pending.length > 0 && !skipErrors ? `Còn ${pending.length} dòng sai hoặc chưa chọn được em. Cô sửa tệp rồi xem trước lại, chọn em cho dòng đó, hoặc tích Bỏ qua.`
    : null;

  async function doConfirm() {
    if (!preview || !canConfirm) return;
    setBusy("confirm"); setFail(null);
    const picks: Record<string, string> = {};
    for (const [l, id] of Object.entries(pick)) if (id) picks[l] = id;
    const r = await postSheet(`${apiBase(courseId)}/nhap/xac-nhan`, { ym, fileHash: preview.fileHash, pick: picks, skipLines, skipErrors }, file, text);
    setBusy(null);
    if (!r.ok) {
      setFail(sheetErrorText(r.status, r.data));
      if (r.data.code === "FILE_CHANGED") setPreview(null);
      return;
    }
    const n = (k: string) => (typeof r.data[k] === "number" ? (r.data[k] as number) : null);
    setDone({ written: n("written"), replaced: n("replaced"), skipped: n("skipped"), unchanged: n("unchanged"), locked: n("locked"), chargesCreated: n("chargesCreated"), chargesUpdated: n("chargesUpdated"), chargesRemoved: n("chargesRemoved"), totalNet: n("totalNet") });
    setPreview(null); setPick({}); setSkipLines([]); setSkipErrors(false);
    setFile(null); setText(""); if (fileRef.current) fileRef.current.value = "";
  }

  // Em còn chọn được cho một dòng: ứng viên của máy chủ (trùng tên) hoặc cả lớp, bớt em đã được dòng khác dùng.
  const usedBy = (line: number) => new Set<string>(rows.filter(r => r.line !== line && r.studentId && r.status !== "unmatched" && r.status !== "ambiguous").map(r => r.studentId as string));
  const optionsFor = (r: PreviewRow) => {
    const used = usedBy(r.line);
    if (r.status === "ambiguous" && r.candidates.length > 0)
      return r.candidates.filter(c => !used.has(c.studentId)).map(c => ({ id: c.studentId, text: `${c.name}${c.joinedOn ? ` · vào lớp ${dmy(c.joinedOn)}` : ""}${c.tail ? ` · mã …${c.tail}` : ""}` }));
    return roster.filter(s => !used.has(s.studentId)).map(s => ({ id: s.studentId, text: s.name }));
  };

  const statusChip = (s: PreviewStatus) => <KinStatus tone={PREVIEW_STATUS[s].tone}><span aria-hidden>{PREVIEW_STATUS[s].icon}</span> {PREVIEW_STATUS[s].label}</KinStatus>;
  const select = (r: PreviewRow) => (pickable(r.status) || !!pick[r.line]) && (
    <div className="space-y-1">
      <label className={`${KIN_LABEL} text-[length:var(--kin-co-goc)]`}>
        <span className="sr-only">Chọn em cho dòng {r.line}</span>
        <select data-bhn-pick={r.line} value={pick[r.line] ?? ""} disabled={skipLines.includes(r.line) || !!busy} onChange={e => void onPick(r.line, e.target.value)} className={`${KIN_FIELD} min-w-[12rem]`}>
          <option value="">{r.status === "ambiguous" ? "Chọn đúng em…" : "Chọn em trong lớp…"}</option>
          {optionsFor(r).map(o => <option key={o.id} value={o.id}>{o.text}</option>)}
        </select>
      </label>
      {pick[r.line] && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Cô đã chọn em này cho dòng {r.line}.</p>}
      <label className="flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
        <input type="checkbox" className="size-5" checked={skipLines.includes(r.line)} disabled={!!busy} onChange={e => void onSkip(r.line, e.target.checked)} />
        Bỏ dòng này
      </label>
    </div>
  );
  const notes = (r: PreviewRow) => r.messages.length > 0 && (
    <ul className="space-y-0.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{r.messages.map((m, i) => <li key={i} className="break-words">{m}</li>)}</ul>
  );
  const netText = (r: PreviewRow) => (r.net == null ? dash : <>{r.status === "replace" && r.before != null && <><span className="text-[var(--kin-chu-mo)]"><Money n={r.before} /></span> → </>}<Money n={r.net} /></>);
  const kText = (r: PreviewRow) => (r.subjectCount == null ? dash : <>{r.subjectCount}<span className="block text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">{sourceText(r.subjectCountSource)}</span></>);
  const nameText = (r: PreviewRow) => (r.name ? <span className="break-words font-medium">{r.name}</span> : <span className="text-[var(--kin-chu-mo)]">Không có tên</span>);

  const th = "px-3 py-3 text-left font-medium text-[var(--kin-chu-mo)] align-bottom";
  const thR = "px-3 py-3 text-right font-medium text-[var(--kin-chu-mo)] align-bottom";
  const tdc = "px-3 py-3 align-top";
  const tdR = "px-3 py-3 align-top text-right tabular-nums";

  const table = (
    <div className="overflow-x-auto" data-bhn-table>
      <table className="w-full text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
        <caption className="sr-only">Xem trước học phí {label}</caption>
        <thead>
          <tr className="bg-[var(--kin-nen-bang)]">
            <th scope="col" className={th}>Dòng</th><th scope="col" className={th}>Trạng thái</th><th scope="col" className={th}>Em</th>
            {subjects.map(s => <th key={s} scope="col" className={thR}>{s}<span className="sr-only"> (số buổi)</span></th>)}
            <th scope="col" className={thR}>Số môn</th><th scope="col" className={thR}>Miễn</th><th scope="col" className={thR}>Đơn giá áp</th>
            <th scope="col" className={thR}>Học bổng</th><th scope="col" className={thR}>Giảm trừ</th><th scope="col" className={thR}>Phải đóng</th><th scope="col" className={th}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.line} data-bhn-row={r.status} className="border-t border-[var(--kin-vien-nhat)]">
              <td className={`${tdc} tabular-nums`}>{r.line}</td>
              <td className={tdc}>{statusChip(r.status)}</td>
              <td className={tdc}><div className="space-y-2">{nameText(r)}{select(r)}</div></td>
              {subjects.map(s => <td key={s} className={tdR}>{r.sessions[s] ?? 0}</td>)}
              <td className={tdR}>{kText(r)}</td>
              <td className={tdR}>{r.freeSessions ?? 0}</td>
              <td className={tdR}>{r.unitRate == null ? dash : <Money n={r.unitRate} />}</td>
              <td className={tdR}><Money n={r.scholarship ?? 0} /></td>
              <td className={tdR}><Money n={r.discount ?? 0} /></td>
              <td className={`${tdR} font-medium`}>{netText(r)}</td>
              <td className={`${tdc} max-w-[22rem]`}>{notes(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const cards = (
    <ul className="space-y-3" data-bhn-cards aria-label={`Xem trước học phí ${label}`}>
      {rows.map(r => (
        <li key={r.line} data-bhn-card={r.status} className="p-4 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] space-y-2">
          <div className="flex items-center justify-between gap-3">{statusChip(r.status)}<span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] tabular-nums">Dòng {r.line}</span></div>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-[length:var(--kin-co-body)]">{nameText(r)}</p>
            <p className="text-right text-[length:var(--kin-co-tieu-de)] font-medium tabular-nums flex-shrink-0">{netText(r)}</p>
          </div>
          <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] break-words">
            {subjects.filter(s => (r.sessions[s] ?? 0) > 0).map(s => `${s} ${r.sessions[s]}`).join(" · ") || "Chưa có buổi nào"}
            {(r.freeSessions ?? 0) > 0 ? ` · miễn ${r.freeSessions} buổi` : ""}
          </p>
          {r.subjectCount != null && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{r.subjectCount} môn, {sourceText(r.subjectCountSource) ?? "theo bảng bậc"}</p>}
          {r.unitRate != null && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đơn giá <Money n={r.unitRate} />{(r.scholarship ?? 0) > 0 ? <> · học bổng <Money n={r.scholarship ?? 0} /></> : null}{(r.discount ?? 0) > 0 ? <> · giảm trừ <Money n={r.discount ?? 0} /></> : null}</p>}
          {notes(r)}
          {select(r)}
        </li>
      ))}
    </ul>
  );

  const fileError = fail && !preview;
  const periodNav = (
    <nav aria-label={`Chọn ${unit}`} className="flex items-center justify-between md:justify-start gap-2 flex-wrap">
      {ym > minYm
        ? <Link href={nhapHref(shiftYm(ym, -1))} aria-label={`Nhập ${unit} trước`} className={`${kinButtonClass("secondary")} min-w-11`}>←<span className="hidden sm:inline"> {capFirst(unit)} trước</span></Link>
        : <span aria-disabled="true" className={`${kinButtonClass("secondary")} opacity-45`}>←<span className="hidden sm:inline"> {capFirst(unit)} trước</span></span>}
      <span aria-current="date" data-bhn-ky className="px-2 min-h-11 inline-flex flex-1 md:flex-none items-center justify-center text-center font-medium">{label}</span>
      {ym < maxYm
        ? <Link href={nhapHref(shiftYm(ym, 1))} aria-label={`Nhập ${unit} sau`} className={`${kinButtonClass("secondary")} min-w-11`}><span className="hidden sm:inline">{capFirst(unit)} sau </span>→</Link>
        : <span aria-disabled="true" className={`${kinButtonClass("secondary")} opacity-45`}><span className="hidden sm:inline">{capFirst(unit)} sau </span>→</span>}
    </nav>
  );

  return (
    <KinPage>
      {header(ym, `${courseName} · ${label}`)}
      <div className="max-w-5xl space-y-[var(--kin-cach-muc)]">
        {periodNav}
        <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Nhập sai thì chưa mất gì: KiN cho cô xem trước, chỉ ghi khi cô bấm xác nhận. Học phí đã vào phiếu không bị ghi đè.</p>

        {done && (
          <div role="status" data-bhn-done>
            <KinCallout tone="nhan" title="Đã ghi học phí">
              Đã ghi {done.written ?? 0} dòng{done.replaced ? `, trong đó ${done.replaced} dòng thay số cũ` : ""}{done.skipped ? `, bỏ qua ${done.skipped} dòng` : ""}{done.unchanged ? `, ${done.unchanged} dòng không đổi` : ""}{done.locked ? `, ${done.locked} dòng đã vào phiếu nên giữ nguyên` : ""}.
              {done.totalNet != null && <> Tổng Phải đóng <Money n={done.totalNet} />.</>}{" "}
              <Link href={tabHref(ym)} className="underline text-[var(--kin-nhan-link)] inline-flex items-center min-h-11">Xem bảng học phí</Link>
            </KinCallout>
          </div>
        )}

        <section aria-labelledby="bhn-mau">
          <KinSectionHead id="bhn-mau" title="1. Tải mẫu Excel" />
          <div className="pt-4 space-y-3">
            <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
              Mẫu đã có sẵn tên từng em và cột cho các môn: {subjects.join(", ")}. Cô chỉ điền số buổi, buổi miễn phí, đơn giá riêng, học bổng, giảm trừ. Cột Số môn để trống thì KiN đếm số môn có buổi trong {unit}.
            </p>
            <a href={`${apiBase(courseId)}/mau?ym=${ym}`} download className={`${kinButtonClass("secondary")} w-full sm:w-auto`}>Tải mẫu Excel</a>
          </div>
        </section>

        <section aria-labelledby="bhn-nhap">
          <KinSectionHead id="bhn-nhap" title="2. Dán từ Google Sheet hoặc thả tệp" />
          <div className="pt-4 grid gap-5 md:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="bhn-text" className={`${KIN_LABEL} mb-2`}>Dán từ Google Sheet</label>
              <textarea id="bhn-text" value={text} disabled={!!file} rows={7} onChange={e => { setText(e.target.value); resetPreview(); }}
                placeholder="Chọn cả bảng trong Google Sheet (kể cả dòng tiêu đề), sao chép rồi dán vào đây." className={`${KIN_FIELD} py-2 leading-5`} />
            </div>
            <div className="min-w-0">
              <label htmlFor="bhn-file" className={`${KIN_LABEL} mb-2`}>Hoặc chọn tệp .xlsx</label>
              <DropZone onFiles={fs => chooseFile(fs[0] ?? null)} className="rounded-[var(--kin-bo-md)] border border-dashed border-[var(--kin-vien-o-nhap)] p-4 space-y-3">
                <input id="bhn-file" ref={fileRef} type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={e => chooseFile(e.target.files?.[0] ?? null)} className={`${KIN_FIELD} py-2`} />
                <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Hoặc thả tệp vào khung này. Tệp .xlsx, .csv, .tsv hoặc .txt, tối đa 1 MB và 300 dòng.</p>
                {file && (
                  <p data-bhn-file className="flex items-center justify-between gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                    <span className="min-w-0 break-words">Đã chọn: {file.name} ({kb(file.size)})</span>
                    <button type="button" className="min-h-11 px-2 underline text-[var(--kin-nhan-link)] flex-shrink-0" onClick={clearAll}>Bỏ tệp</button>
                  </p>
                )}
              </DropZone>
            </div>
          </div>
          <div className="pt-4">
            <KinButton disabled={!hasInput} loading={busy === "preview"} loadingLabel="Đang đọc…" onClick={() => void doPreview()} className="w-full sm:w-auto">Xem trước</KinButton>
          </div>
        </section>

        {fileError && (
          <div role="alert" data-bhn-fail className="space-y-3">
            <KinCallout title="Chưa ghi gì"><span className="break-words">{fail}</span></KinCallout>
            <KinButton variant="secondary" onClick={clearAll}>Chọn tệp khác</KinButton>
          </div>
        )}

        {preview && (
          <section aria-labelledby="bhn-xt" data-bhn-preview className="space-y-4">
            <KinSectionHead id="bhn-xt" title="3. Xem trước (chưa ghi gì)" />
            {preview.fatal ? (
              <div role="alert" data-bhn-fatal className="space-y-3">
                <KinCallout title="Tệp bị từ chối, chưa ghi gì"><span className="break-words">{preview.fatal}</span></KinCallout>
                {preview.columns.blocking.length > 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Cột chưa khớp môn nào của lớp: {preview.columns.blocking.join(", ")}. Cô thêm môn vào bảng bậc hoặc xoá cột đó khỏi tệp.</p>}
                <KinButton variant="secondary" onClick={clearAll}>Chọn tệp khác</KinButton>
              </div>
            ) : (
              <>
                <ul data-bhn-counts aria-label="Tóm tắt xem trước" className="flex flex-wrap gap-x-5 gap-y-2 text-[length:var(--kin-co-goc)]">
                  {PREVIEW_ORDER.filter(s => (preview.counts[s] ?? 0) > 0).map(s => (
                    <li key={s} data-bhn-count={s}>{statusChip(s)}<span className="sr-only">:</span> <span className="tabular-nums font-medium">{preview.counts[s]}</span></li>
                  ))}
                </ul>
                {(preview.columns.matched.length > 0 || preview.columns.ignored.length > 0) && (
                  <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)] break-words">
                    {preview.columns.matched.length > 0 ? `Cột đã nhận: ${preview.columns.matched.join(", ")}.` : ""}{preview.columns.ignored.length > 0 ? ` Cột bỏ qua (trống): ${preview.columns.ignored.join(", ")}.` : ""}
                  </p>
                )}
                {preview.columns.blocking.length > 0 && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">Cột chưa khớp môn nào của lớp: {preview.columns.blocking.join(", ")}.</p>}
                {preview.columns.missingSubjects.length > 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tệp không có cột môn: {preview.columns.missingSubjects.join(", ")}. KiN coi các môn đó là 0 buổi.</p>}
                {preview.exampleLines.length > 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Dòng ví dụ của bảng mẫu ({preview.exampleLines.map(l => `dòng ${l}`).join(", ")}) được bỏ qua.</p>}
                {preview.messages.map((m, i) => <p key={i} className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{m}</p>)}
                {rows.length === 0
                  ? <KinEmptyState title="Tệp không có dòng nào để đọc">Cô kiểm tra tệp có dòng tiêu đề và dữ liệu, hoặc dùng mẫu Excel ở bước 1.</KinEmptyState>
                  : wide ? table : cards}
                {preview.rosterNotInFile.length > 0 && (
                  <details className="text-[length:var(--kin-co-goc)]" data-bhn-roster>
                    <summary className="inline-flex items-center min-h-11 cursor-pointer text-[var(--kin-nhan-link)] underline">{preview.rosterNotInFile.length} em trong lớp không có trong tệp (không đổi gì)</summary>
                    <p className="pt-1 text-[var(--kin-chu-mo)] break-words">{preview.rosterNotInFile.map(x => x.name).join(", ")}</p>
                  </details>
                )}

                {pending.length > 0 && (
                  <label className="flex items-start gap-3 min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                    <input type="checkbox" data-bhn-skip className="mt-0.5 size-5" checked={skipErrors} onChange={e => setSkipErrors(e.target.checked)} />
                    <span>Bỏ qua {pending.length} dòng sai hoặc chưa chọn được em, ghi các dòng còn lại.</span>
                  </label>
                )}
              </>
            )}
          </section>
        )}

        {fail && preview && !preview.fatal && <p role="alert" data-bhn-fail className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{fail}</p>}

        {preview && !preview.fatal && (
          <div data-bhn-bar className="sticky bottom-[68px] md:bottom-4 z-10 bg-[var(--kin-nen-trang)] border-t border-[var(--kin-vien-nhat)] py-3 space-y-2">
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" data-bhn-footer>
              Sẽ ghi <b className="tabular-nums">{writable}</b> dòng{writable > 0 && <> · Tổng Phải đóng <Money n={preview.totalNet} /></>}
            </p>
            {whyNot && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-bhn-why>{whyNot}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <KinButton data-bhn-confirm disabled={!canConfirm} loading={busy === "confirm"} loadingLabel="Đang ghi…" onClick={() => void doConfirm()} className="w-full sm:w-auto">Xác nhận ghi {writable} dòng</KinButton>
              <KinButton variant="secondary" disabled={busy === "confirm"} onClick={clearAll} className="w-full sm:w-auto">Chọn tệp khác</KinButton>
            </div>
          </div>
        )}
      </div>
    </KinPage>
  );
}
