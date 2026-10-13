// PH-223 — soạn kế hoạch buổi 4 hoạt động. Ba chế độ xem: Soạn / Bản gia sư / Phiếu học sinh (không đáp án, không ghi chú gia sư).
// Xem trước và in dùng đúng dữ liệu đang soạn (kể cả chưa lưu); in bằng hộp thoại in của trình duyệt.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton, KinConfirm, KinTabs } from "@/components/kin";
import { CARD_STYLE, FIELD_STYLE, callApi, copyText, useNotify } from "@/components/tutor/shared";
import {
  ACTIVITY_HINT, ACTIVITY_LABEL, ANSWER_MAX, GOAL_MAX, MAX_QUESTIONS, MINUTES_MAX, NOTES_MAX, PRODUCT_MAX, QUESTION_MAX, TITLE_MAX,
  filledCount, renderStudentSheetText, renderTutorPlanText, totalMinutes, type Activity, type PlanContent,
} from "@/lib/sessionPlan";

interface Plan extends PlanContent { id: string; courseId: string; courseName: string; updatedAt: string }
type View = "soan" | "gia-su" | "hoc-sinh";

const VIEWS: { key: View; label: string }[] = [
  { key: "soan", label: "Soạn" }, { key: "gia-su", label: "Bản gia sư" }, { key: "hoc-sinh", label: "Phiếu học sinh" },
];
const dmy = (k: string | null) => (k ? `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : "");

export default function KeHoachEditorClient({ id }: { id: string }) {
  const notify = useNotify();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saved, setSaved] = useState("");          // JSON đã lưu — để biết có thay đổi chưa lưu
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("soan");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [conflict, setConflict] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const seq = useRef(0);

  const snap = (p: Plan) => JSON.stringify({ t: p.title, g: p.goal, d: p.dateKey, a: p.activities });
  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false); setConflict(false);
    const r = await callApi<{ plan: Plan }>(`/api/tutor/session-plans/${id}`);
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else { setPlan(r.data.plan); setSaved(snap(r.data.plan)); }
    setLoading(false);
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const dirty = !!plan && snap(plan) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setAct = (i: number, patch: Partial<Activity>) => setPlan(p => (p ? { ...p, activities: p.activities.map((a, j) => (j === i ? { ...a, ...patch } : a)) } : p));

  async function save() {
    if (!plan || busy) return;
    setBusy("save");
    const r = await callApi<{ plan: Plan }>(`/api/tutor/session-plans/${id}`, {
      method: "PUT", body: JSON.stringify({ title: plan.title, goal: plan.goal, dateKey: plan.dateKey, activities: plan.activities, updatedAt: plan.updatedAt }),
    });
    setBusy(null);
    if (r.status === 409) { setConflict(true); return; }
    if (!r.ok) { notify.err(r.data.error ?? "Không lưu được"); return; }
    setPlan(r.data.plan); setSaved(snap(r.data.plan));
    notify.ok("Đã lưu kế hoạch.");
  }
  async function remove() {
    if (busy) return;
    setBusy("delete");
    const r = await callApi(`/api/tutor/session-plans/${id}`, { method: "DELETE" });
    setBusy(null);
    setAskDelete(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không xoá được"); return; }
    router.push("/lop-cua-toi/ke-hoach-buoi");
  }
  async function copyText_(text: string) { if (await copyText(text)) notify.ok("Đã sao chép."); else notify.err("Không sao chép được."); }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/lop-cua-toi/ke-hoach-buoi" className="text-sm hover:underline" style={{ color: "var(--kin-chu-phu)" }}>← Kế hoạch buổi</Link>

      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={CARD_STYLE} />)}</div>
      ) : failed || !plan ? (
        <div role="alert" className="mt-4 rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>Không mở được kế hoạch này (đã bị xoá hoặc không phải của bạn). <button className="underline font-semibold" onClick={() => void load()}>Thử lại</button></div>
      ) : (
        <>
          <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{plan.title || "Kế hoạch buổi"}</h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            {plan.courseName}{plan.dateKey ? ` · ${dmy(plan.dateKey)}` : ""} · đã soạn {filledCount(plan.activities)}/4 hoạt động{totalMinutes(plan.activities) ? ` · ${totalMinutes(plan.activities)} phút` : ""}
          </p>

          {conflict && (
            <div role="alert" className="rounded-xl p-4 mt-3 text-sm" style={{ background: "var(--kin-tt-cham-cho)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>
              Kế hoạch này vừa được sửa ở nơi khác (tab hoặc máy khác). Tải lại để xem bản mới — thay đổi chưa lưu ở đây sẽ mất.{" "}
              <button className="underline font-semibold" onClick={() => void load()}>Tải lại</button>
            </div>
          )}

          <KinTabs className="mt-4" label="Chế độ xem" tabs={VIEWS} value={view} onChange={setView} />

          {view === "soan" && (
            <div className="mt-4 space-y-4">
              <section className="rounded-xl p-4 space-y-3" style={CARD_STYLE} aria-labelledby="h-chung">
                <h2 id="h-chung" className="text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Thông tin chung</h2>
                <label className="text-sm block">Tên buổi
                  <input value={plan.title} maxLength={TITLE_MAX} onChange={e => setPlan({ ...plan, title: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
                </label>
                <label className="text-sm block">Ngày dạy (không bắt buộc)
                  <input type="date" value={plan.dateKey ?? ""} onChange={e => setPlan({ ...plan, dateKey: e.target.value || null })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
                </label>
                <label className="text-sm block">Mục tiêu buổi học (học sinh thấy)
                  <textarea rows={2} value={plan.goal} maxLength={GOAL_MAX} onChange={e => setPlan({ ...plan, goal: e.target.value })} placeholder="Sau buổi này em có thể…" className="block w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
                </label>
              </section>

              {plan.activities.map((a, i) => {
                const pid = `hd-${a.key}`;
                return (
                  <section key={a.key} aria-labelledby={`${pid}-h`} className="rounded-xl p-4 space-y-3" style={CARD_STYLE}>
                    <div>
                      <h2 id={`${pid}-h`} className="text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{i + 1}. {ACTIVITY_LABEL[a.key]}</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{ACTIVITY_HINT[a.key]}</p>
                    </div>
                    <label className="text-sm block sm:max-w-[10rem]">Số phút
                      <input inputMode="numeric" value={a.minutes ?? ""} onChange={e => { const d = e.target.value.replace(/\D/g, ""); setAct(i, { minutes: d === "" ? null : Math.min(MINUTES_MAX, Number(d)) }); }}
                        className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} aria-label={`Số phút — ${ACTIVITY_LABEL[a.key]}`} />
                    </label>
                    <label className="text-sm block">Ghi chú của gia sư <span className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>(học sinh KHÔNG thấy)</span>
                      <textarea rows={3} value={a.teacherNotes} maxLength={NOTES_MAX} onChange={e => setAct(i, { teacherNotes: e.target.value })}
                        className="block w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} aria-label={`Ghi chú của gia sư — ${ACTIVITY_LABEL[a.key]}`} />
                    </label>

                    <fieldset>
                      <legend className="text-sm">Câu hỏi dẫn đường <span className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>(câu hỏi học sinh thấy; đáp án chỉ gia sư thấy)</span></legend>
                      <ul className="space-y-2 mt-1">
                        {a.questions.map((q, j) => (
                          <li key={j} className="rounded-lg p-2" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                            <input value={q.q} maxLength={QUESTION_MAX} aria-label={`Câu hỏi ${j + 1} — ${ACTIVITY_LABEL[a.key]}`} placeholder={`Câu hỏi ${j + 1}`}
                              onChange={e => setAct(i, { questions: a.questions.map((x, k) => (k === j ? { ...x, q: e.target.value } : x)) })}
                              className="block w-full px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
                            <input value={q.answer} maxLength={ANSWER_MAX} aria-label={`Đáp án câu ${j + 1} — ${ACTIVITY_LABEL[a.key]}`} placeholder="Đáp án (chỉ gia sư thấy)"
                              onChange={e => setAct(i, { questions: a.questions.map((x, k) => (k === j ? { ...x, answer: e.target.value } : x)) })}
                              className="block w-full mt-2 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
                            <button type="button" className="text-xs underline mt-1 min-h-[44px]" style={{ color: "var(--kin-chu-phu)" }}
                              aria-label={`Xoá câu hỏi ${j + 1} — ${ACTIVITY_LABEL[a.key]}`} onClick={() => setAct(i, { questions: a.questions.filter((_, k) => k !== j) })}>Xoá câu hỏi</button>
                          </li>
                        ))}
                      </ul>
                      {a.questions.length < MAX_QUESTIONS && (
                        <div className="mt-2"><KinButton variant="secondary" onClick={() => setAct(i, { questions: [...a.questions, { q: "", answer: "" }] })} aria-label={`Thêm câu hỏi — ${ACTIVITY_LABEL[a.key]}`}>+ Thêm câu hỏi</KinButton></div>
                      )}
                    </fieldset>

                    <label className="text-sm block">Sản phẩm <span className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>(học sinh làm ra / viết ra được gì — học sinh thấy)</span>
                      <input value={a.product} maxLength={PRODUCT_MAX} onChange={e => setAct(i, { product: e.target.value })} placeholder="Ví dụ: bảng giá trị và đồ thị vẽ tay"
                        className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} aria-label={`Sản phẩm — ${ACTIVITY_LABEL[a.key]}`} />
                    </label>
                  </section>
                );
              })}

              <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl px-4 py-3 flex-wrap" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
                <span role="status" className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}</span>
                <div className="flex gap-2 flex-wrap">
                  <KinButton variant="danger" disabled={!!busy} onClick={() => setAskDelete(true)}>Xoá kế hoạch</KinButton>
                  <KinButton loading={busy === "save"} disabled={!dirty} onClick={() => void save()}>Lưu kế hoạch</KinButton>
                </div>
              </div>
            </div>
          )}

          {view !== "soan" && (
            <div className="mt-4">
              {dirty && <p role="status" className="text-xs mb-2" style={{ color: "var(--kin-tt-chu-cho)" }}>Bản xem trước theo nội dung đang soạn (chưa lưu).</p>}
              <div className="flex gap-2 flex-wrap mb-3">
                <KinButton onClick={() => window.print()}>In {view === "gia-su" ? "bản gia sư" : "phiếu học sinh"}</KinButton>
                <KinButton variant="secondary" onClick={() => void copyText_(view === "gia-su" ? renderTutorPlanText(plan, { courseName: plan.courseName }) : renderStudentSheetText(plan, { courseName: plan.courseName }))}>Sao chép dạng chữ</KinButton>
              </div>
              <style>{`@media print { body * { visibility: hidden !important; } .kin-print, .kin-print * { visibility: visible !important; } .kin-print { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; background: var(--kin-nen-trang) !important; color: var(--kin-chu-chinh) !important; } }`}</style>
              {view === "gia-su" ? <TutorView plan={plan} /> : <StudentSheet plan={plan} />}
            </div>
          )}
        </>
      )}
      <KinConfirm
        open={askDelete}
        tone="nguy-hiem"
        title="Xoá kế hoạch này?"
        message="Kế hoạch bị xoá hẳn, không khôi phục được."
        confirmLabel="Xoá kế hoạch"
        cancelLabel="Giữ lại"
        loading={busy === "delete"}
        onCancel={() => setAskDelete(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function TutorView({ plan }: { plan: Plan }) {
  return (
    <article className="kin-print rounded-xl p-5" style={CARD_STYLE} aria-label="Bản gia sư">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--kin-chu-phu)" }}>Bản gia sư</p>
      <h2 className="text-lg font-bold mt-1" style={{ color: "var(--kin-chu-chinh)" }}>{plan.title}</h2>
      <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{[plan.courseName, dmy(plan.dateKey), totalMinutes(plan.activities) ? `${totalMinutes(plan.activities)} phút` : ""].filter(Boolean).join(" · ")}</p>
      {plan.goal && <p className="text-sm mt-3"><b>Mục tiêu:</b> {plan.goal}</p>}
      <ol className="mt-4 space-y-4">
        {plan.activities.map((a, i) => (
          <li key={a.key}>
            <h3 className="font-bold text-sm">{i + 1}. {ACTIVITY_LABEL[a.key]}{a.minutes ? ` (${a.minutes} phút)` : ""}</h3>
            {!a.teacherNotes && !a.questions.length && !a.product && <p className="text-sm italic" style={{ color: "var(--kin-chu-phu)" }}>Chưa soạn.</p>}
            {a.teacherNotes && <p className="text-sm mt-1 whitespace-pre-wrap"><b>Gia sư:</b> {a.teacherNotes}</p>}
            {a.questions.length > 0 && (
              <ol className="list-decimal ml-5 mt-1 text-sm space-y-1">
                {a.questions.map((q, j) => <li key={j}>{q.q}{q.answer && <span className="block text-xs" style={{ color: "var(--kin-tt-chu-xong)" }}>Đáp án: {q.answer}</span>}</li>)}
              </ol>
            )}
            {a.product && <p className="text-sm mt-1"><b>Sản phẩm:</b> {a.product}</p>}
          </li>
        ))}
      </ol>
    </article>
  );
}

function StudentSheet({ plan }: { plan: Plan }) {
  // Hoạt động chỉ có ghi chú của gia sư (không câu hỏi, không sản phẩm) thì không hiện cho học sinh.
  const shown = plan.activities.filter(a => a.questions.length || a.product);
  // Đánh số câu liên tục qua các hoạt động; tính trước để không gán lại biến trong lúc dựng giao diện.
  const firstNo = shown.map((_, i) => shown.slice(0, i).reduce((c, a) => c + a.questions.length, 0) + 1);
  return (
    <article className="kin-print rounded-xl p-5" style={CARD_STYLE} aria-label="Phiếu học sinh">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--kin-chu-phu)" }}>Phiếu học sinh</p>
      <h2 className="text-lg font-bold mt-1" style={{ color: "var(--kin-chu-chinh)" }}>{plan.title}</h2>
      <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{[plan.courseName, dmy(plan.dateKey)].filter(Boolean).join(" · ")}</p>
      <p className="text-sm mt-3">Họ và tên: ______________________________</p>
      {plan.goal && <p className="text-sm mt-3"><b>Hôm nay mình học để:</b> {plan.goal}</p>}
      {shown.length === 0 ? (
        <p className="text-sm italic mt-4" style={{ color: "var(--kin-chu-phu)" }}>Chưa có câu hỏi hay sản phẩm nào để học sinh làm.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {shown.map((a, i) => (
            <section key={a.key}>
              <h3 className="font-bold text-sm">{ACTIVITY_LABEL[a.key]}</h3>
              {a.questions.map((q, j) => <p key={j} className="text-sm mt-2">{firstNo[i] + j}. {q.q}<span className="block mt-2 border-b border-dotted" style={{ borderColor: "var(--kin-chu-mo)", height: "1.5rem" }} /></p>)}
              {a.product && <p className="text-sm mt-2"><b>Sản phẩm của em:</b> {a.product}</p>}
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
