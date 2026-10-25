// "Hôm nay": một nút Bắt đầu, việc đã xếp sẵn — người dễ nản không phải tự quyết học gì.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, LEVEL_TEXT, LinkButton, PageHead, Pill, Skeleton, Stat } from "@/components/english/ui";

interface Today {
  today: string;
  profile: { targetBand: number; examDate: string | null; dailyNew: number; dailyMinutes: number; placementDone: boolean };
  examDays: number | null;
  review: { due: number; newLeft: number; newDoneToday: number };
  words: { known: number; learning: number };
  streak: { days: number; restUsedThisWeek: boolean; activeToday: boolean };
  minutesToday: number;
  week: { day: string; minutes: number }[];
  nextUnit: { id: string; label: string; bookTitle: string } | null;
  suggestions: { id: string; title: string; wordCount: number; coverage: number; level: "nhe" | "hoc" | "kho" }[];
  lastWriting: { bandLow: number | null; bandHigh: number | null } | null;
  plan: Plan;
}
interface Plan {
  hasExam: boolean; week: number; beforeWindow: boolean; afterExam: boolean;
  phase: { key: string; name: string; from: number; to: number; bandFrom: number; bandTo: number; focus: string[]; split: { tuVungNguPhap: number; docNghe: number; viet: number; deBamGio: number } };
  today: { skill: string; label: string; href: string; minutes: number; why: string };
  nextGate: { week: number; label: string; weeksAway: number; min: number; rule: string; ifFail: string } | null;
  lastMock: { listening: number | null; reading: number | null };
}

/** Lộ trình 26 tuần đếm ngược tới ngày thi: đang ở chặng nào, hôm nay học gì, mốc thi thử kế tiếp. */
function PlanCard({ plan, onSetExam }: { plan: Plan; onSetExam: () => void }) {
  if (!plan.hasExam || plan.afterExam) {
    return (
      <Card className="flex items-center justify-between gap-3 flex-wrap" aria-labelledby="h-lotrinh">
        <div>
          <h2 id="h-lotrinh" className="font-bold" style={{ color: INK.chinh }}>{plan.afterExam ? "Ngày thi đã qua" : "Đặt ngày thi để có lộ trình 26 tuần"}</h2>
          <p className="text-sm mt-1" style={{ color: INK.phu }}>App chia thời gian còn lại thành 4 chặng (Nền móng → Tăng tốc → Kỹ năng IELTS → Nước rút) và xếp sẵn kỹ năng cho từng ngày.</p>
        </div>
        <KinButton variant="secondary" onClick={onSetExam}>{plan.afterExam ? "Đặt ngày thi mới" : "Đặt ngày thi"}</KinButton>
      </Card>
    );
  }
  const g = plan.nextGate;
  const lr = [plan.lastMock.listening, plan.lastMock.reading];
  const avg = lr.every((x): x is number => x !== null) ? (lr[0]! + lr[1]!) / 2 : null;
  return (
    <Card aria-labelledby="h-lotrinh">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs" style={{ color: INK.phu }}>{plan.beforeWindow ? "Thi còn hơn 26 tuần — đang ở chặng đầu" : `Tuần ${plan.week}/26`}</p>
          <h2 id="h-lotrinh" className="font-bold text-lg" style={{ color: INK.chinh }}>Chặng {plan.phase.name} · band {plan.phase.bandFrom.toFixed(1)} → {plan.phase.bandTo.toFixed(1)}</h2>
        </div>
        <Pill tone="nhan">Tuần {plan.phase.from}–{plan.phase.to}</Pill>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div className="rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
          <p className="text-sm font-semibold" style={{ color: INK.chinh }}>Kỹ năng chính hôm nay: {plan.today.label}{plan.today.minutes ? ` · ${plan.today.minutes} phút` : ""}</p>
          <p className="text-sm mt-1 mb-2" style={{ color: INK.phu }}>{plan.today.why}</p>
          {plan.today.skill !== "nghi" && <LinkButton href={plan.today.href}>Vào {plan.today.label}</LinkButton>}
          <p className="text-xs mt-2" style={{ color: INK.mo }}>Buổi chuẩn 120 phút: ôn thẻ 20 · kỹ năng chính 50 · ngữ pháp 20 · nghe nhẹ 20.</p>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: INK.chinh }}>Trọng tâm chặng này</p>
          <ul className="text-sm mt-1 space-y-0.5 list-disc pl-5" style={{ color: INK.phu }}>
            {plan.phase.focus.map(f => <li key={f}>{f}</li>)}
          </ul>
          <p className="text-xs mt-2" style={{ color: INK.mo }}>
            Thời gian: từ vựng + ngữ pháp {plan.phase.split.tuVungNguPhap}% · đọc + nghe {plan.phase.split.docNghe}% · viết {plan.phase.split.viet}% · đề bấm giờ {plan.phase.split.deBamGio}%
          </p>
        </div>
      </div>
      {g && (
        <div className="mt-3 pt-3 border-t text-sm flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--kin-vien-nhat)", color: INK.chinh }}>
          <p>
            <strong>{g.label}</strong>{g.weeksAway === 0 ? " · tuần này" : ` · còn ${g.weeksAway} tuần`} — {g.rule} cần ≥ {g.min.toFixed(1)}.
            <span style={{ color: INK.phu }}> {avg !== null ? `Gần nhất: L ${lr[0]!.toFixed(1)} · R ${lr[1]!.toFixed(1)}.` : "Chưa có bài thi thử L/R."}</span>
          </p>
          <LinkButton href="/student/tieng-anh/thi-thu" variant={g.weeksAway === 0 ? "primary" : "secondary"}>Thi thử</LinkButton>
        </div>
      )}
    </Card>
  );
}

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function EnglishToday() {
  const [d, setD] = useState<Today | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ examDate: "", targetBand: "6.5", dailyNew: "15" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Today>("/api/english/today").then(x => { setD(x); setErr(null); setForm({ examDate: x.profile.examDate ?? "", targetBand: String(x.profile.targetBand), dailyNew: String(x.profile.dailyNew) }); })
      .catch(e => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/english/profile", { method: "PATCH", body: { examDate: form.examDate || null, targetBand: Number(form.targetBand), dailyNew: Number(form.dailyNew) } });
      setEditing(false); load();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  if (err && !d) return <ErrorLine message={err} onRetry={load} />;
  if (!d) return <Skeleton rows={4} />;

  const maxMin = Math.max(30, ...d.week.map(w => w.minutes));
  const reviewTotal = d.review.due + d.review.newLeft;

  return (
    <div className="space-y-4">
      <PageHead title="Tiếng Anh hôm nay" sub={`Mục tiêu IELTS ${d.profile.targetBand.toFixed(1)}${d.examDays !== null ? ` · còn ${d.examDays} ngày tới ngày thi` : " · chưa đặt ngày thi"}`}>
        <KinButton variant="secondary" onClick={() => setEditing(v => !v)} aria-expanded={editing}>Mục tiêu</KinButton>
      </PageHead>

      {err && <ErrorLine message={err} />}

      {editing && (
        <Card>
          <form className="grid sm:grid-cols-4 gap-3 items-end" onSubmit={e => { e.preventDefault(); void save(); }}>
            <label className="text-sm" style={{ color: INK.chinh }}>Ngày thi
              <input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} className="mt-1 w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            </label>
            <label className="text-sm" style={{ color: INK.chinh }}>Band mục tiêu
              <select value={form.targetBand} onChange={e => setForm(f => ({ ...f, targetBand: e.target.value }))} className="mt-1 w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }}>
                {["5.0", "5.5", "6.0", "6.5", "7.0", "7.5"].map(b => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label className="text-sm" style={{ color: INK.chinh }}>Từ mới mỗi ngày
              <input type="number" min={0} max={50} value={form.dailyNew} onChange={e => setForm(f => ({ ...f, dailyNew: e.target.value }))} className="mt-1 w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            </label>
            <KinButton type="submit" loading={saving} loadingLabel="Đang lưu…">Lưu</KinButton>
          </form>
        </Card>
      )}

      <PlanCard plan={d.plan} onSetExam={() => setEditing(true)} />

      {!d.profile.placementDone && (
        <Card className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold" style={{ color: INK.chinh }}>Bắt đầu bằng 5 phút kiểm tra từ vựng</h2>
            <p className="text-sm mt-1" style={{ color: INK.phu }}>App bỏ qua những từ bạn đã biết, chỉ dạy phần còn thiếu.</p>
          </div>
          <LinkButton href="/student/tieng-anh/tu-vung/xep-lop">Làm bài kiểm tra</LinkButton>
        </Card>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Chuỗi ngày học" value={`${d.streak.days} ngày`} sub={d.streak.activeToday ? "Hôm nay đã học" : "Hôm nay chưa học"} />
        <Stat label="Hôm nay" value={`${d.minutesToday} phút`} sub={`mục tiêu ${d.profile.dailyMinutes} phút`} />
        <Stat label="Từ đã biết" value={d.words.known.toLocaleString("vi-VN")} sub={`${d.words.learning} từ đang học`} />
        <Stat label="Writing gần nhất" value={d.lastWriting?.bandLow != null ? `${d.lastWriting.bandLow}–${d.lastWriting.bandHigh}` : "—"} sub="khoảng band AI ước lượng" />
      </dl>

      <div className="grid md:grid-cols-2 gap-4">
        <Card aria-labelledby="h-on">
          <h2 id="h-on" className="font-bold" style={{ color: INK.chinh }}>1 · Ôn từ</h2>
          <p className="text-sm mt-1 mb-3" style={{ color: INK.phu }}>
            {reviewTotal === 0 ? "Hết thẻ cho hôm nay. Giỏi lắm!" : `${d.review.due} thẻ đến hạn · ${d.review.newLeft} từ mới`}
          </p>
          <div className="flex gap-2 flex-wrap">
            <LinkButton href="/student/tieng-anh/tu-vung/on">{reviewTotal ? "Bắt đầu ôn" : "Mở sổ từ"}</LinkButton>
            {d.review.due > 0 && <LinkButton href="/student/tieng-anh/tu-vung/on?nhanh=1" variant="secondary">Chỉ có 10 phút</LinkButton>}
          </div>
        </Card>

        <Card aria-labelledby="h-lop">
          <h2 id="h-lop" className="font-bold" style={{ color: INK.chinh }}>2 · Lớp học từ sách</h2>
          {d.nextUnit ? (
            <>
              <p className="text-sm mt-1 mb-3" style={{ color: INK.phu }}>{d.nextUnit.bookTitle} — {d.nextUnit.label}</p>
              <LinkButton href={`/student/tieng-anh/lop-hoc/bai/${d.nextUnit.id}`}>Học tiếp</LinkButton>
            </>
          ) : (
            <>
              <p className="text-sm mt-1 mb-3" style={{ color: INK.phu }}>Thêm sách ngữ pháp/kỹ năng của bạn (PDF) để thành bài học có chấm điểm.</p>
              <LinkButton href="/student/tieng-anh/lop-hoc" variant="secondary">Mở Lớp học</LinkButton>
            </>
          )}
        </Card>
      </div>

      <Card aria-labelledby="h-doc">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="h-doc" className="font-bold" style={{ color: INK.chinh }}>3 · Bài đọc hợp sức bạn</h2>
          <Link href="/student/tieng-anh/doc" className="text-sm underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>Tất cả bài</Link>
        </div>
        {d.suggestions.length === 0 ? (
          <p className="text-sm" style={{ color: INK.phu }}>Chưa có bài nào. Vào mục Đọc để dán một bài hoặc thêm link VOA Learning English.</p>
        ) : (
          <ul className="space-y-2">
            {d.suggestions.map(s => (
              <li key={s.id}>
                <Link href={`/student/tieng-anh/doc/${s.id}`} className="flex items-center justify-between gap-3 min-h-11 rounded-[var(--kin-bo-md)] px-3 py-2" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
                  <span className="text-sm font-medium" style={{ color: INK.chinh }}>{s.title}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <Pill tone={LEVEL_TEXT[s.level].tone}>{LEVEL_TEXT[s.level].label}</Pill>
                    <span className="text-xs" style={{ color: INK.phu }}>hiểu {s.coverage}% từ</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="h-tuan">
        <h2 id="h-tuan" className="font-bold mb-3" style={{ color: INK.chinh }}>7 ngày qua</h2>
        <ol className="flex items-end gap-2 h-28" aria-label="Số phút học mỗi ngày">
          {d.week.map(w => (
            <li key={w.day} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <span className="text-xs" style={{ color: INK.phu }}>{w.minutes}</span>
              <span className="w-full rounded-t" style={{ height: `${Math.max(3, (w.minutes / maxMin) * 70)}%`, background: w.minutes ? "var(--kin-nhan-nen)" : "var(--kin-vien-nhat)" }} aria-hidden />
              <span className="text-xs" style={{ color: w.day === d.today ? INK.chinh : INK.mo }}>{WEEKDAY[new Date(w.day + "T00:00:00Z").getUTCDay()]}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs mt-2" style={{ color: INK.phu }}>Mỗi tuần được nghỉ 1 ngày mà không đứt chuỗi. Bỏ hai ngày liền mới đứt.</p>
      </Card>
    </div>
  );
}
