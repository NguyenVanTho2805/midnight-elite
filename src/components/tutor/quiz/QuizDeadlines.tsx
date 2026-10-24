// QZ — "Điều chỉnh thời hạn riêng" (Figma 521:5150, tab thứ ba): đặt hạn nộp riêng cho từng học sinh mà KHÔNG đổi lịch chung của đề.
// Dữ liệu: /api/tutor/quiz-cham/[examId]/han-rieng (chỉ gia sư chủ đề, chỉ học sinh trong lớp của cô). Chữ nói thật quy tắc: quá hạn riêng thì
// học sinh không BẮT ĐẦU lượt mới; lượt đang làm dở vẫn làm nốt. Giờ theo giờ Việt Nam.
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KIN_FIELD, KIN_LABEL, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { KinButton } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus } from "@/components/kin/Status";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { deadlineRowLabel, DEADLINE_NOTE_MAX } from "@/lib/quizDeadline";
import { qfetch } from "./quizClient";

interface Student { userId: string; name: string; dueAt: string | null; note: string | null }
interface Data { enrolledKnown: boolean; shared: { date: string; time: string; duration: string }; students: Student[] }

export default function QuizDeadlines({ examId, onChanged }: { examId: string; onChanged?: () => void }) {
  const base = `/api/tutor/quiz-cham/${examId}/han-rieng`;
  const { ask, dialog } = useKinConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dateKey, setDateKey] = useState("");
  const [time, setTime] = useState("20:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"set" | "clear" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await qfetch<Data>("GET", base);
    if (!r.ok || !r.data) { setErr(r.error); return; }
    setErr(null); setData(r.data);
  }, [base]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const withDue = data?.students.filter(s => s.dueAt) ?? [];
  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function apply() {
    if (picked.size === 0) { setMsg({ ok: false, text: "Chọn ít nhất một học sinh." }); return; }
    if (!dateKey) { setMsg({ ok: false, text: "Chọn ngày hạn nộp." }); return; }
    setBusy("set"); setMsg(null);
    const r = await qfetch<{ count: number }>("POST", base, { action: "set", userIds: [...picked], dateKey, time, note });
    setBusy(null);
    if (!r.ok || !r.data) { setMsg({ ok: false, text: r.error ?? "Chưa lưu được." }); return; }
    // Nạp lại danh sách TRƯỚC khi báo "Đã đặt": nếu báo trước, người dùng thấy lời báo kèm danh sách cũ (chưa có "Hạn riêng: …").
    setPicked(new Set()); await load(); onChanged?.();
    setMsg({ ok: true, text: `Đã đặt hạn riêng cho ${r.data.count} học sinh. Lịch chung của đề không đổi.` });
  }
  async function clear() {
    const ids = [...picked].filter(id => data?.students.find(s => s.userId === id)?.dueAt);
    if (ids.length === 0) { setMsg({ ok: false, text: "Trong các em đã chọn chưa em nào có hạn riêng để bỏ." }); return; }
    if (!(await ask({ title: `Bỏ hạn riêng của ${ids.length} học sinh?`, message: "Các em đó quay về theo lịch chung của đề. Bài đã làm không đổi.", confirmLabel: "Bỏ hạn riêng" }))) return;
    setBusy("clear"); setMsg(null);
    const r = await qfetch<{ count: number }>("POST", base, { action: "clear", userIds: ids });
    setBusy(null);
    if (!r.ok || !r.data) { setMsg({ ok: false, text: r.error ?? "Chưa bỏ được." }); return; }
    setPicked(new Set()); await load(); onChanged?.(); // nạp lại trước rồi mới báo, cùng lý do như trên
    setMsg({ ok: true, text: `Đã bỏ hạn riêng của ${r.data.count} học sinh.` });
  }

  if (err && !data) return <div className="mt-6"><ErrorStrip message={err} onRetry={() => void load()} /></div>;
  if (!data) return <div aria-busy="true" aria-label="Đang tải hạn riêng" className="mt-6 space-y-3"><div className="kin-skel kin-skel--soft h-[64px] rounded" /><div className="kin-skel kin-skel--soft h-[64px] rounded" /></div>;

  return (
    <section className="mt-6 space-y-8" aria-labelledby="qd-h">
      {dialog}
      <KinCallout title="Hạn riêng không đổi lịch chung của đề">
        Lịch chung: mở {data.shared.date} lúc {data.shared.time}, làm trong {data.shared.duration}. Em có hạn riêng thì không bắt đầu được lượt mới sau hạn đó; lượt đang làm dở vẫn làm nốt. Giờ theo giờ Việt Nam. Em không có hạn riêng thì theo lịch chung như trước.
      </KinCallout>

      {!data.enrolledKnown ? (
        <KinEmptyState title="Quiz chưa gắn với lớp của cô">Gắn quiz với một lớp của cô ở tab “Đáp án và phát hành” thì danh sách học sinh hiện ở đây.</KinEmptyState>
      ) : data.students.length === 0 ? (
        <KinEmptyState title="Lớp chưa có học sinh đang học">Khi có học sinh vào lớp, cô đặt hạn riêng cho từng em ở đây.</KinEmptyState>
      ) : (
        <>
          <div>
            <KinSectionHead id="qd-h" title="Chọn học sinh" aside={`${picked.size}/${data.students.length} đã chọn`} />
            <div className="mt-2 flex flex-wrap gap-2">
              <KinButton variant="ghost" onClick={() => setPicked(new Set(data.students.map(s => s.userId)))}>Chọn cả lớp</KinButton>
              <KinButton variant="ghost" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>Bỏ chọn</KinButton>
            </div>
            <ul className="mt-2" aria-label="Học sinh trong lớp">
              {data.students.map(s => (
                <li key={s.userId} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
                  <label className="flex items-center gap-3 min-h-11 min-w-0 text-[var(--kin-chu-chinh)]">
                    <input type="checkbox" className="w-5 h-5" checked={picked.has(s.userId)} onChange={() => toggle(s.userId)} />
                    <span className="min-w-0 break-words">{s.name}</span>
                  </label>
                  <span className="text-[length:var(--kin-co-goc)]">
                    {s.dueAt ? <KinStatus tone={new Date(s.dueAt) > now ? "cho" : "mo"}>Hạn riêng: {deadlineRowLabel(new Date(s.dueAt), now)}</KinStatus> : <span className="text-[var(--kin-chu-mo)]">Theo lịch chung</span>}
                    {s.note && <span className="block text-[var(--kin-chu-mo)] break-words">{s.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <form className="max-w-[560px] space-y-4" onSubmit={e => { e.preventDefault(); void apply(); }} aria-label="Đặt hạn riêng">
            <KinSectionHead title="Đặt hạn riêng cho các em đã chọn" />
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="qd-date" className={`${KIN_LABEL} mb-2`}>Ngày hạn nộp</label><input id="qd-date" type="date" className={KIN_FIELD} value={dateKey} onChange={e => setDateKey(e.target.value)} /></div>
              <div><label htmlFor="qd-time" className={`${KIN_LABEL} mb-2`}>Giờ hạn nộp</label><input id="qd-time" type="time" className={KIN_FIELD} value={time} onChange={e => setTime(e.target.value)} /></div>
            </div>
            <div><label htmlFor="qd-note" className={`${KIN_LABEL} mb-2`}>Ghi chú cho cô (không bắt buộc, học sinh không thấy)</label><input id="qd-note" className={KIN_FIELD} value={note} maxLength={DEADLINE_NOTE_MAX} onChange={e => setNote(e.target.value)} /></div>
            <div className="flex flex-wrap gap-3">
              <KinButton type="submit" loading={busy === "set"} loadingLabel="Đang lưu…" disabled={busy !== null}>Đặt hạn riêng</KinButton>
              <KinButton type="button" variant="secondary" onClick={() => void clear()} loading={busy === "clear"} loadingLabel="Đang bỏ…" disabled={busy !== null || withDue.length === 0}>Bỏ hạn riêng của các em đã chọn</KinButton>
            </div>
            <p role="status" className={`text-[length:var(--kin-co-goc)] ${msg && !msg.ok ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-mo)]"}`}>{msg?.text ?? ""}</p>
          </form>
        </>
      )}
    </section>
  );
}
