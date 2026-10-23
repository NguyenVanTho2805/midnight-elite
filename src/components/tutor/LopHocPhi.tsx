// HP-15/HP-16/HP-17 — tab "Học phí" của một lớp tạo theo kiểu mới (theo buổi / giờ / khoá): đơn giá hiện hành, lịch sử đơn giá,
// ĐỔI ĐƠN GIÁ CÓ NGÀY HIỆU LỰC kèm XEM TRƯỚC tác động, và đơn giá riêng từng em. Số tiền do máy chủ tính (planReprice); ở đây chỉ hiển thị.
// Lớp cách cũ (mặc định) không dùng màn này: giữ nguyên lối vào Học phí và đối soát.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { callApi, useNotify } from "@/components/tutor/shared";
import { FEE_MODE_LABEL, FEE_RATE_FROM_START, FEE_RATE_UNIT, isNewFeeMode, pickClassRate, pickStudentRate, type FeeMode } from "@/lib/tuitionFee";

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
const dmy = (k: string) => (k === FEE_RATE_FROM_START ? "khi tạo lớp" : `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`);

interface Overview {
  feeMode: FeeMode;
  classRates: Array<{ id: string; rate: number; sessionMinutes: number | null; effectiveFrom: string; note: string | null }>;
  studentRates: Array<{ id: string; studentId: string; rate: number; effectiveFrom: string; note: string | null }>;
  students: Array<{ id: string; name: string }>;
  today: string;
}
interface Plan {
  changedCount: number; beforeTotal: number; afterTotal: number; delta: number; frozenCount: number; frozenTotal: number; unresolvedCount: number; studentIds: string[];
}
interface Preview { plan: Plan; perCourse: { pendingStudents: number; beforeEach: number | null; afterEach: number | null } | null }

export default function LopHocPhi({ courseId, feeMode }: { courseId: string; feeMode: FeeMode }) {
  const notify = useNotify();
  const [ov, setOv] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isNewFeeMode(feeMode)) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false);
    callApi<Overview>(`/api/courses/${courseId}/fee-rates`).then(r => {
      if (!alive) return;
      if (!r.ok) setFailed(true); else setOv(r.data);
    });
    return () => { alive = false; };
  }, [courseId, feeMode, tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);

  if (!isNewFeeMode(feeMode)) {
    return (
      <section className="max-w-xl">
        <KinSectionHead title="Học phí và đối soát" />
        <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          Lớp này tính học phí theo số buổi trong tháng, như cách cô đang dùng. Lập phiếu có mã, theo dõi tiền vào, nhận tiền thẳng vào tài khoản của cô.
        </p>
        <Link href="/lop-cua-toi/hoc-phi" className={`${kinButtonClass("secondary")} mt-4`}>Mở Học phí</Link>
      </section>
    );
  }
  if (failed) {
    return (
      <div role="alert" className="py-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
        Không tải được đơn giá của lớp.{" "}
        <button className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={reload}>Thử lại</button>
      </div>
    );
  }
  if (!ov) return <div aria-busy="true" aria-label="Đang tải đơn giá" className="h-32 rounded kin-skel kin-skel--soft" />;

  const cur = pickClassRate(ov.classRates, ov.today);
  const unit = FEE_RATE_UNIT[feeMode];
  const nameOf = (id: string) => ov.students.find(s => s.id === id)?.name ?? "Học sinh đã rời lớp";

  return (
    <div className="space-y-[var(--kin-cach-muc)] max-w-3xl">
      <section aria-labelledby="hp-hien-hanh">
        <KinSectionHead id="hp-hien-hanh" title="Cách tính hiện tại" aside={FEE_MODE_LABEL[feeMode]} />
        <p className="pt-4 text-[length:var(--kin-co-tieu-de)] font-medium tabular-nums text-[var(--kin-chu-chinh)]">
          {cur ? `${vnd(cur.rate)} ${unit.replace("đ ", "")}` : "Chưa có đơn giá"}
          {cur?.sessionMinutes ? <span className="text-[length:var(--kin-co-goc)] font-normal text-[var(--kin-chu-mo)]"> · mỗi buổi {cur.sessionMinutes} phút</span> : null}
        </p>
        <p className="pt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          {feeMode === "per_course"
            ? "Tính một lần cho mỗi em, vào phiếu đầu tiên sau khi em vào lớp."
            : "Tự sinh khi cô điểm danh em có mặt hoặc đi muộn. Buổi có phép, vắng hoặc dùng buổi bù không sinh thêm tiền."}
          {" "}Phiếu đã chốt không đổi khi cô đổi đơn giá.
        </p>
        <Link href="/lop-cua-toi/hoc-phi" className={`${kinButtonClass("secondary")} mt-4`}>Mở Học phí và đối soát</Link>
      </section>

      <RateForm title="Đổi đơn giá cả lớp" idp="hp-lop" feeMode={feeMode} today={ov.today}
        initial={{ rate: cur?.rate ?? 0, minutes: cur?.sessionMinutes ?? 90 }}
        run={async (b, apply) => callApi<Preview & { error?: string }>(`/api/courses/${courseId}/fee-rates`, { method: "POST", body: JSON.stringify({ action: apply ? "set_class" : "preview_class", ...b }) })}
        onApplied={() => { notify.ok("Đã đổi đơn giá."); reload(); }} />

      <section aria-labelledby="hp-lich-su">
        <KinSectionHead id="hp-lich-su" title="Lịch sử đơn giá" />
        <ul className="pt-3">
          {ov.classRates.map(r => (
            <li key={r.id} className="py-3 border-b border-[var(--kin-vien-nhat)] flex justify-between gap-3 flex-wrap text-[length:var(--kin-co-goc)]">
              <span className="text-[var(--kin-chu-chinh)]">Từ {dmy(r.effectiveFrom)}{cur && r.effectiveFrom === cur.effectiveFrom ? " · đang áp dụng" : ""}</span>
              <span className="tabular-nums text-[var(--kin-chu-chinh)]">{vnd(r.rate)} {unit.replace("đ ", "")}{r.sessionMinutes ? ` · ${r.sessionMinutes} phút/buổi` : ""}</span>
              {r.note && <span className="w-full text-[var(--kin-chu-mo)]">{r.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hp-rieng">
        <KinSectionHead id="hp-rieng" title="Đơn giá riêng từng em" aside="Tuỳ chọn" />
        {ov.studentRates.length === 0 ? (
          <div className="pt-3"><KinEmptyState title="Chưa có em nào có đơn giá riêng">Mọi em trong lớp dùng đơn giá cả lớp. Cô có thể đặt đơn giá riêng cho từng em ở dưới (ví dụ giảm cho em khó khăn).</KinEmptyState></div>
        ) : (
          <ul className="pt-3">
            {ov.studentRates.map(r => {
              const active = pickStudentRate(ov.studentRates.filter(x => x.studentId === r.studentId), ov.today);
              return (
                <li key={r.id} className="py-3 border-b border-[var(--kin-vien-nhat)] flex justify-between items-center gap-3 flex-wrap text-[length:var(--kin-co-goc)]">
                  <span className="text-[var(--kin-chu-chinh)]">{nameOf(r.studentId)} · từ {dmy(r.effectiveFrom)}{active?.effectiveFrom === r.effectiveFrom ? " · đang áp dụng" : ""}</span>
                  <span className="tabular-nums text-[var(--kin-chu-chinh)]">{vnd(r.rate)} {unit.replace("đ ", "")}</span>
                  <StudentRemove courseId={courseId} row={r} onDone={() => { notify.ok("Đã xoá mốc đơn giá riêng."); reload(); }} />
                </li>
              );
            })}
          </ul>
        )}
        <StudentRateForm courseId={courseId} ov={ov} feeMode={feeMode} onApplied={() => { notify.ok("Đã lưu đơn giá riêng."); reload(); }} />
      </section>
    </div>
  );
}

function PlanView({ p, perCourse }: { p: Plan; perCourse: Preview["perCourse"] }) {
  return (
    <div role="status" aria-live="polite"><KinCallout title="Xem trước tác động (chưa lưu gì)">
      <ul className="space-y-1">
        <li>{p.changedCount} dòng học phí chưa vào phiếu sẽ đổi{p.changedCount > 0 ? `: tổng ${vnd(p.beforeTotal)} → ${vnd(p.afterTotal)} (${p.delta >= 0 ? "+" : "−"}${vnd(Math.abs(p.delta))})` : ""}.</li>
        <li>{p.frozenCount} dòng đã vào phiếu ({vnd(p.frozenTotal)}) <b>không đổi</b>.</li>
        {p.unresolvedCount > 0 && <li>{p.unresolvedCount} dòng không tính lại được (thiếu đơn giá hoặc thời lượng), giữ nguyên.</li>}
        {perCourse && <li>{perCourse.pendingStudents} em chưa bị tính học phí cả khoá{perCourse.beforeEach != null && perCourse.afterEach != null ? `: mỗi em ${vnd(perCourse.beforeEach)} → ${vnd(perCourse.afterEach)}` : ""}.</li>}
      </ul>
    </KinCallout></div>
  );
}

function RateForm({ title, idp, feeMode, today, initial, run, onApplied }: {
  title: string; idp: string; feeMode: FeeMode; today: string; initial: { rate: number; minutes: number };
  run: (b: Record<string, unknown>, apply: boolean) => Promise<{ ok: boolean; data: Preview & { error?: string } }>; onApplied: () => void;
}) {
  const [rate, setRate] = useState(initial.rate ? String(initial.rate) : "");
  const [minutes, setMinutes] = useState(String(initial.minutes || 90));
  const [from, setFrom] = useState(today);
  const [note, setNote] = useState("");
  const [prev, setPrev] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"prev" | "set" | null>(null);
  const body = () => ({ rate: Number(rate), effectiveFrom: from, note, ...(feeMode === "per_hour" ? { sessionMinutes: Number(minutes) } : {}) });
  const dirty = () => setPrev(null);

  async function go(apply: boolean) {
    setBusy(apply ? "set" : "prev"); setErr(null);
    const r = await run(body(), apply);
    setBusy(null);
    if (!r.ok) { setErr(r.data.error ?? "Không thực hiện được"); return; }
    if (apply) { setPrev(null); onApplied(); } else setPrev(r.data);
  }
  return (
    <section aria-labelledby={`${idp}-t`}>
      <KinSectionHead id={`${idp}-t`} title={title} aside="Có hiệu lực từ ngày" />
      <div className="pt-5 grid sm:grid-cols-2 gap-5">
        <label className={KIN_LABEL}>Đơn giá mới ({isNewFeeMode(feeMode) ? FEE_RATE_UNIT[feeMode] : ""})
          <input inputMode="numeric" value={rate} onChange={e => { setRate(e.target.value.replace(/[^\d]/g, "")); dirty(); }} className={`${KIN_FIELD} mt-2`} />
        </label>
        <label className={KIN_LABEL}>Có hiệu lực từ ngày
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); dirty(); }} className={`${KIN_FIELD} mt-2`} />
        </label>
        {feeMode === "per_hour" && (
          <label className={KIN_LABEL}>Một buổi dài (phút)
            <input inputMode="numeric" value={minutes} onChange={e => { setMinutes(e.target.value.replace(/[^\d]/g, "")); dirty(); }} className={`${KIN_FIELD} mt-2`} />
          </label>
        )}
        <label className={`${KIN_LABEL} sm:col-span-2`}>Ghi chú (tuỳ chọn)
          <input value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: tăng giá từ học kỳ 2" className={`${KIN_FIELD} mt-2`} />
        </label>
      </div>
      {err && <p role="alert" className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <div className="pt-4 flex gap-2 flex-wrap">
        <KinButton variant="secondary" loading={busy === "prev"} disabled={!rate || !from} onClick={() => void go(false)}>Xem trước tác động</KinButton>
      </div>
      {prev && (
        <div className="pt-4 space-y-3">
          <PlanView p={prev.plan} perCourse={prev.perCourse} />
          <div className="flex gap-2 flex-wrap">
            <KinButton variant="ghost" onClick={() => setPrev(null)}>Giữ nguyên</KinButton>
            <KinButton loading={busy === "set"} onClick={() => void go(true)}>Áp dụng đơn giá mới</KinButton>
          </div>
        </div>
      )}
    </section>
  );
}

function StudentRateForm({ courseId, ov, feeMode, onApplied }: { courseId: string; ov: Overview; feeMode: FeeMode; onApplied: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(ov.today);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"prev" | "set" | null>(null);
  const dirty = () => setPrev(null);
  async function go(apply: boolean) {
    setBusy(apply ? "set" : "prev"); setErr(null);
    const r = await callApi<Preview & { error?: string }>(`/api/courses/${courseId}/fee-rates`, {
      method: "POST", body: JSON.stringify({ action: apply ? "set_student" : "preview_student", studentId, rate: Number(rate), effectiveFrom: from }),
    });
    setBusy(null);
    if (!r.ok) { setErr(r.data.error ?? "Không thực hiện được"); return; }
    if (apply) { setPrev(null); setRate(""); onApplied(); } else setPrev(r.data);
  }
  return (
    <div className="pt-5">
      <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Đặt đơn giá riêng cho một em</p>
      <div className="pt-3 grid sm:grid-cols-3 gap-5">
        <label className={KIN_LABEL}>Học sinh
          <select value={studentId} onChange={e => { setStudentId(e.target.value); dirty(); }} className={`${KIN_FIELD} mt-2`}>
            <option value="">Chọn em…</option>
            {ov.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className={KIN_LABEL}>Đơn giá ({isNewFeeMode(feeMode) ? FEE_RATE_UNIT[feeMode] : ""})
          <input inputMode="numeric" value={rate} onChange={e => { setRate(e.target.value.replace(/[^\d]/g, "")); dirty(); }} className={`${KIN_FIELD} mt-2`} />
        </label>
        <label className={KIN_LABEL}>Từ ngày
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); dirty(); }} className={`${KIN_FIELD} mt-2`} />
        </label>
      </div>
      {err && <p role="alert" className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <div className="pt-4"><KinButton variant="secondary" loading={busy === "prev"} disabled={!studentId || !rate || !from} onClick={() => void go(false)}>Xem trước tác động</KinButton></div>
      {prev && (
        <div className="pt-4 space-y-3">
          <PlanView p={prev.plan} perCourse={prev.perCourse} />
          <div className="flex gap-2 flex-wrap">
            <KinButton variant="ghost" onClick={() => setPrev(null)}>Giữ nguyên</KinButton>
            <KinButton loading={busy === "set"} onClick={() => void go(true)}>Lưu đơn giá riêng</KinButton>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRemove({ courseId, row, onDone }: { courseId: string; row: { studentId: string; effectiveFrom: string }; onDone: () => void }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  return (
    <KinButton variant="ghost" loading={busy} onClick={async () => {
      setBusy(true);
      const r = await callApi<{ error?: string }>(`/api/courses/${courseId}/fee-rates`, { method: "POST", body: JSON.stringify({ action: "set_student", studentId: row.studentId, rate: null, effectiveFrom: row.effectiveFrom }) });
      setBusy(false);
      if (!r.ok) notify.err(r.data.error ?? "Không xoá được"); else onDone();
    }}>Xoá mốc này</KinButton>
  );
}
