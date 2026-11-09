// HP-LOP-TRUONG — panel sửa học phí MỘT em trong MỘT tháng (mục 5.2/5.3): ô số buổi từng môn, Buổi miễn phí, Số môn (để trống = KiN tự đếm số môn có buổi),
// Đơn giá riêng, Học bổng, Giảm trừ, Ghi chú; dưới cùng MỘT DÒNG CÔNG THỨC SỐNG do máy chủ tính (PUT /dong/<em> với dryRun, không ghi gì).
// Không hộp thoại: ở máy rộng là cột bên phải, ở điện thoại là cả màn (LopBangHocPhi quyết chỗ đặt). Giao diện không tự tính tiền, chỉ chép lại số máy chủ trả.
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinMoney } from "@/components/kin/MoneyVisibility";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { callApi, useNotify } from "@/components/tutor/shared";
import BangHocPhiChu from "@/components/tutor/BangHocPhiChu";
import { normCalc, sheetErrorText, sourceText, vndText, type SheetCalc, type SheetConfig, type SheetDongResult, type SheetRow } from "@/components/tutor/bangHocPhiTypes";

const digits = (s: string) => s.replace(/[^\d]/g, "");
const asNum = (s: string) => (s === "" ? 0 : Number(s));

/** Câu công thức từ số máy chủ trả: "11 buổi × 60.000đ = 660.000đ − 50.000đ học bổng = 610.000đ". Chỉ ghép chữ, không tính. */
export function formulaText(c: SheetCalc, ro: boolean): { text: string; sourceNote: string } | null {
  if (c.billable == null || c.unitRate == null || c.gross == null || c.net == null) return null;
  const cut: string[] = [];
  if ((c.scholarship ?? 0) > 0) cut.push(`− ${vndText(c.scholarship ?? 0)} học bổng`);
  if ((c.discount ?? 0) > 0) cut.push(`− ${vndText(c.discount ?? 0)} giảm trừ`);
  const floor = c.gross - (c.scholarship ?? 0) - (c.discount ?? 0) < 0;
  const text = `${c.billable} buổi × ${vndText(c.unitRate)} = ${vndText(c.gross)}${cut.length ? ` ${cut.join(" ")}` : ""} = ${vndText(c.net)}${floor ? " (đã về 0, không giảm thêm)" : ""}`;
  const sourceNote = ro ? "đơn giá riêng của em" : c.subjectCount != null ? `bậc ${c.subjectCount} môn` : "theo bảng bậc";
  return { text, sourceNote };
}

export default function BangHocPhiDong({ courseId, ym, periodLabel, config, row, readOnly = false, onSaved, onClose }: {
  courseId: string; ym: string; periodLabel: string; config: SheetConfig; row: SheetRow; readOnly?: boolean;
  onSaved: () => void; onClose: () => void;
}) {
  const notify = useNotify();
  const { ask, dialog } = useKinConfirm();
  const locked = row.locked || readOnly;
  const [sessions, setSessions] = useState<Record<string, string>>(() => Object.fromEntries(config.subjects.map(s => [s, row.filled && (row.sessions[s] ?? 0) > 0 ? String(row.sessions[s]) : ""])));
  const [free, setFree] = useState(row.freeSessions ? String(row.freeSessions) : "");
  // Số môn: chỉ điền sẵn khi lần ghi trước là "file" (cô tự ghi); "counted" = để trống cho KiN đếm.
  const [count, setCount] = useState(row.filled && row.subjectCountSource === "file" && row.subjectCount != null ? String(row.subjectCount) : "");
  const [rate, setRate] = useState(row.rateOverride != null ? String(row.rateOverride) : "");
  const [hb, setHb] = useState(row.scholarship ? String(row.scholarship) : "");
  const [gt, setGt] = useState(row.discount ? String(row.discount) : "");
  const [note, setNote] = useState(row.note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "del" | null>(null);
  const [live, setLive] = useState<{ state: "idle" | "load" | "ok" | "err"; calc?: SheetCalc; error?: string; warnings?: string[] }>({ state: "idle" });
  const headRef = useRef<HTMLHeadingElement>(null);
  const seq = useRef(0);
  const url = `/api/tutor/lop/${encodeURIComponent(courseId)}/bang-hoc-phi/dong/${encodeURIComponent(row.studentId)}`;

  const body = useMemo(() => ({
    yearMonth: ym,
    sessions: Object.fromEntries(config.subjects.map(s => [s, asNum(sessions[s] ?? "")])),
    subjectCount: count === "" ? null : Number(count),
    freeSessions: asNum(free), rateOverride: rate === "" ? null : Number(rate),
    scholarship: asNum(hb), discount: asNum(gt), ...(note.trim() ? { note: note.trim() } : {}),
  }), [ym, config.subjects, sessions, count, free, rate, hb, gt, note]);
  const anySessions = config.subjects.some(s => asNum(sessions[s] ?? "") > 0);

  useEffect(() => { headRef.current?.focus(); headRef.current?.scrollIntoView({ block: "start" }); }, []);

  // Dòng công thức sống: hỏi máy chủ (dryRun) sau khi cô ngừng gõ ~0,4 giây; chỉ nhận kết quả của lần hỏi mới nhất.
  useEffect(() => {
    if (!anySessions || locked) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLive(l => ({ ...l, state: "load" }));
      const r = await callApi<Record<string, unknown>>(url, { method: "PUT", body: JSON.stringify({ ...body, dryRun: true }) });
      if (mine !== seq.current) return;
      if (!r.ok) { setLive({ state: "err", error: sheetErrorText(r.status, r.data) }); return; }
      const d = r.data as Record<string, unknown>;
      const inner = typeof d.row === "object" && d.row !== null ? d.row : d;
      const w = (d.warnings ?? (inner as Record<string, unknown>).warnings ?? d.messages);
      setLive({ state: "ok", calc: normCalc(inner), warnings: Array.isArray(w) ? w.filter((x): x is string => typeof x === "string") : [] });
    }, 400);
    return () => clearTimeout(t);
  }, [body, anySessions, url, locked]);

  async function save() {
    if (busy || locked) return;
    if (!anySessions && asNum(free) === 0) { setErr("Cô nhập số buổi của ít nhất một môn."); return; }
    setBusy("save"); setErr(null);
    const r = await callApi<{ code?: string } & SheetDongResult>(url, { method: "PUT", body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) { setErr(sheetErrorText(r.status, r.data)); return; }
    // Máy chủ trả 200 cả khi KHÔNG ghi (số không đổi, hoặc dryRun): chỉ nói "Đã lưu" khi applied === true.
    if (r.data.applied === true) { notify.ok("Đã lưu học phí của em."); onSaved(); return; }
    if (r.data.unchanged === true) { notify.info("Số liệu không đổi so với lần ghi trước."); onSaved(); return; }
    setErr("Chưa lưu được học phí của em, cô thử lại nhé.");
  }
  async function remove() {
    if (busy || locked) return;
    const ok = await ask({
      title: "Gỡ học phí tháng này của em?",
      message: "Học phí tháng này của em sẽ bị xoá khỏi bảng, khoản phí chưa vào phiếu cũng được gỡ. Cô nhập lại được bất cứ lúc nào.",
      confirmLabel: "Gỡ học phí", cancelLabel: "Giữ lại", tone: "nguy-hiem",
    });
    if (!ok) return;
    setBusy("del"); setErr(null);
    const r = await callApi<{ code?: string }>(`${url}?ym=${encodeURIComponent(ym)}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { setErr(sheetErrorText(r.status, r.data)); return; }
    notify.ok("Đã gỡ học phí của em.");
    onSaved();
  }

  const f = formulaText(live.calc ?? normCalc({}), rate !== "");
  const num = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { setter(digits(e.target.value)); setErr(null); };
  const src = live.state === "ok" ? sourceText(live.calc?.subjectCountSource ?? null) : null;

  return (
    <section aria-labelledby="bh-dong-t" data-bh-dong className="space-y-5">
      <KinSectionHead id="bh-dong-t" title={<span ref={headRef} tabIndex={-1} className="outline-none break-words">{row.name}</span>} aside={<button type="button" onClick={onClose} className="min-h-11 px-2 underline text-[var(--kin-nhan-link)]">Đóng</button>} />
      <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học phí {periodLabel}{row.left ? " · em đã rời lớp" : ""}</p>

      {locked && (
        <KinCallout title={readOnly ? "Chỉ xem" : "Đã vào phiếu"}>
          {readOnly ? "Chủ lớp nhập và sửa học phí ở bảng này." : "Học phí em này đã vào phiếu nên không sửa ở bảng được. Cô sửa số tiền ngay trên phiếu (Học phí và đối soát)."}
        </KinCallout>
      )}

      <fieldset disabled={locked} className="space-y-5 min-w-0">
        <legend className="sr-only">Số buổi từng môn</legend>
        <div className="grid grid-cols-2 gap-4">
          {config.subjects.map(s => (
            <label key={s} className={`${KIN_LABEL} min-w-0`}><span className="block break-words">{s} (buổi)</span>
              <input inputMode="numeric" value={sessions[s] ?? ""} onChange={num(v => setSessions(c => ({ ...c, [s]: v })))} placeholder="0" className={`${KIN_FIELD} mt-2`} />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className={KIN_LABEL}>Buổi miễn phí
            <input inputMode="numeric" value={free} onChange={num(setFree)} placeholder="0" className={`${KIN_FIELD} mt-2`} />
          </label>
          <label className={KIN_LABEL}>Số môn
            <input inputMode="numeric" value={count} onChange={num(setCount)} placeholder="Tự đếm" className={`${KIN_FIELD} mt-2`} />
          </label>
        </div>
        <p data-bh-nguon-so-mon className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          {count !== ""
            ? "Cô ghi số môn nên KiN dùng đúng số này để chọn bậc."
            : "Để trống thì KiN đếm số môn có buổi trong tháng để chọn bậc."}
          {src ? ` Lần tính này: ${src}.` : row.filled && row.subjectCountSource ? ` Lần ghi trước: ${sourceText(row.subjectCountSource)}.` : ""}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
          <label className={KIN_LABEL}>Đơn giá riêng (đ một buổi)
            <input inputMode="numeric" value={rate} onChange={num(setRate)} placeholder="Để trống = theo bậc" className={`${KIN_FIELD} mt-2`} />
          </label>
          <label className={KIN_LABEL}>Học bổng (đ)
            <input inputMode="numeric" value={hb} onChange={num(setHb)} placeholder="0" className={`${KIN_FIELD} mt-2`} />
          </label>
          <label className={KIN_LABEL}>Giảm trừ (đ)
            <input inputMode="numeric" value={gt} onChange={num(setGt)} placeholder="0" className={`${KIN_FIELD} mt-2`} />
          </label>
        </div>
        <label className={KIN_LABEL}>Ghi chú (tuỳ chọn)
          <input value={note} maxLength={300} onChange={e => { setNote(e.target.value); setErr(null); }} className={`${KIN_FIELD} mt-2`} />
        </label>
      </fieldset>

      <div role="status" aria-live="polite" data-bh-cong-thuc className="rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-nhan)] px-4 py-3 min-h-[4.5rem]">
        <p className="text-[length:var(--kin-co-caption)] uppercase tracking-[0.04em] text-[var(--kin-chu-mo)]">Phải đóng theo bảng</p>
        {!anySessions
          ? <p className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Cô nhập số buổi để thấy học phí.</p>
          : live.state === "err"
            ? <p className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{live.error}</p>
            : f && live.state !== "idle"
              ? <>
                  <p className="pt-1 text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-chinh)] tabular-nums break-words"><KinMoney>{f.text}</KinMoney></p>
                  <p className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tính theo {f.sourceNote}.{live.state === "load" ? " Đang tính lại…" : ""}</p>
                </>
              : <p className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tính…</p>}
        {live.state === "ok" && live.calc?.net === 0 && <p className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">Phải đóng 0đ nên KiN không tạo khoản phí cho em này.</p>}
        {(live.warnings ?? []).map((w, i) => <p key={i} className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)] break-words"><BangHocPhiChu text={w} /></p>)}
      </div>

      {err && <p role="alert" data-bh-loi className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      {!locked && (
        <div className="flex gap-2 flex-wrap">
          <KinButton loading={busy === "save"} loadingLabel="Đang lưu…" disabled={busy === "del"} onClick={() => void save()}>Lưu học phí</KinButton>
          {row.filled && <KinButton variant="danger" loading={busy === "del"} loadingLabel="Đang gỡ…" disabled={busy === "save"} onClick={() => void remove()}>Gỡ học phí tháng này</KinButton>}
          <KinButton variant="ghost" onClick={onClose}>Huỷ</KinButton>
        </div>
      )}
      {dialog}
    </section>
  );
}
