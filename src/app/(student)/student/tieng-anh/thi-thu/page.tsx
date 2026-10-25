// Thi thử IELTS: làm đề Listening/Reading trong sách (Cambridge IELTS…) với phiếu trả lời 40 câu bấm giờ như thi trên máy,
// dán phần đáp án ở cuối sách → app chấm, quy đổi band, so với mục tiêu. Writing/Speaking: nhập band do người chấm cho.
// Phiếu đang làm được lưu nháp trong trình duyệt (mất mạng / lỡ tải lại trang không mất bài).
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, PageHead, Pill, Skeleton, Stat } from "@/components/english/ui";
import { nowMs } from "@/components/english/clock";
import { MOCK_MINUTES, parseAnswerKey, QUESTIONS, SKILL_LABEL, type MockSkill } from "@/lib/english/mock";

type LR = "listening" | "reading";
interface MockRow { id: string; skill: MockSkill; module: string; title: string; raw: number | null; band: number; seconds: number; note: string | null; takenAt: string }
interface Overview {
  items: MockRow[]; latest: Record<MockSkill, MockRow | null>; targets: Record<MockSkill, number>; targetBand: number;
  overall: number | null; rawTargets: { listening: number | null; reading: number | null };
}
interface SheetItem { n: number; key: string; answer: string; correct: boolean }
/** Phiếu đang làm. submittedAt có giá trị = đã nộp phiếu, đang ở bước dán đáp án. */
interface Draft { skill: LR; module: "academic" | "general"; title: string; answers: string[]; startedAt: number; submittedAt?: number; keyText?: string }

const DRAFT_KEY = "kin-eng-mock-draft";
const inputCls = "w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border";
const inputStyle = { borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" } as const;
const SECTIONS: Record<LR, { label: string; from: number; to: number }[]> = {
  listening: [{ label: "Part 1", from: 1, to: 10 }, { label: "Part 2", from: 11, to: 20 }, { label: "Part 3", from: 21, to: 30 }, { label: "Part 4", from: 31, to: 40 }],
  reading: [{ label: "Passage 1", from: 1, to: 13 }, { label: "Passage 2", from: 14, to: 26 }, { label: "Passage 3", from: 27, to: 40 }],
};

function loadDraft(): Draft | null {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? (JSON.parse(raw) as Draft) : null; } catch { return null; }
}
function saveDraft(d: Draft | null) {
  try { if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); } catch { /* chế độ riêng tư: bỏ qua */ }
}
const fmtClock = (sec: number) => `${sec < 0 ? "-" : ""}${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, "0")}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Phiếu trả lời 40 câu, chia theo Part / Passage như đề thật. */
function AnswerGrid({ skill, values, onChange, label, readOnly, marks }: {
  skill: LR; values: string[]; onChange?: (i: number, v: string) => void; label: string; readOnly?: boolean; marks?: (boolean | null)[];
}) {
  return (
    <div className="space-y-4">
      {SECTIONS[skill].map(sec => (
        <fieldset key={sec.label}>
          <legend className="text-sm font-semibold mb-2" style={{ color: INK.chinh }}>{sec.label} · câu {sec.from}–{sec.to}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: sec.to - sec.from + 1 }, (_, k) => sec.from + k).map(n => {
              const mark = marks?.[n - 1];
              return (
                <label key={n} className="flex items-center gap-2 text-sm" style={{ color: INK.chinh }}>
                  <span className="w-7 text-right font-semibold tabular-nums">{n}</span>
                  <input value={values[n - 1] ?? ""} readOnly={readOnly} aria-label={`${label} câu ${n}`} autoComplete="off" spellCheck={false} autoCapitalize="off"
                    onChange={e => onChange?.(n - 1, e.target.value)}
                    className={inputCls} style={{ ...inputStyle, ...(readOnly ? { background: "var(--kin-nen-bang)" } : {}), ...(mark === false ? { borderColor: "var(--kin-tt-vien-loi)" } : {}) }} />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function ResultView({ result, title, skill, targets, onBack }: {
  result: { raw: number; band: number; items: SheetItem[]; seconds: number }; title: string; skill: LR; targets: Overview | null; onBack: () => void;
}) {
  const target = targets?.targets[skill];
  const rawTarget = targets?.rawTargets[skill];
  const wrong = result.items.filter(i => !i.correct);
  return (
    <div className="space-y-4">
      <PageHead title={`Kết quả: ${title}`} sub={`${SKILL_LABEL[skill]} · làm trong ${Math.round(result.seconds / 60)} phút`} />
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Số câu đúng" value={`${result.raw}/40`} sub={rawTarget != null ? `mục tiêu ≥ ${Math.min(40, rawTarget + 1)} câu (an toàn)` : undefined} />
        <Stat label="Band quy đổi" value={result.band.toFixed(1)} sub={target != null ? `mục tiêu ${target.toFixed(1)}` : undefined} />
        <Stat label="Câu sai" value={wrong.length} sub={wrong.length ? "xem bên dưới" : "không sai câu nào"} />
      </dl>
      <p className="text-xs" style={{ color: INK.mo }}>Band quy đổi theo bảng xấp xỉ phổ biến; đề thật có thể lệch ±0.5 tuỳ độ khó.</p>
      {wrong.length > 0 && (
        <Card aria-labelledby="h-sai">
          <h2 id="h-sai" className="font-bold mb-2" style={{ color: INK.chinh }}>Câu sai — đối chiếu lại với đề</h2>
          <ul className="divide-y divide-[var(--kin-vien-nhat)]">
            {wrong.map(i => (
              <li key={i.n} className="py-2 text-sm flex gap-3 flex-wrap" style={{ color: INK.chinh }}>
                <span className="font-semibold w-14">Câu {i.n}</span>
                <span>Bạn ghi: {i.answer ? <s style={{ color: "var(--kin-tt-chu-loi)" }}>{i.answer}</s> : <span style={{ color: INK.mo }}>bỏ trống</span>}</span>
                <span>Đáp án: <strong>{i.key}</strong></span>
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2" style={{ color: INK.phu }}>Mẹo: với câu sai, mở lại transcript/bài đọc, tìm đúng câu chứa đáp án và ghi vì sao mình bỏ lỡ (từ đồng nghĩa, bẫy, chính tả…).</p>
        </Card>
      )}
      <KinButton onClick={onBack}>Về danh sách thi thử</KinButton>
    </div>
  );
}

export default function MockTests() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "setup" | "sheet" | "key" | "result" | "manual">("list");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [setup, setSetup] = useState<{ skill: LR; module: "academic" | "general"; title: string }>({ skill: "reading", module: "academic", title: "" });
  const [now, setNow] = useState(0);
  const [keyText, setKeyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ raw: number; band: number; items: SheetItem[]; seconds: number } | null>(null);
  const [detail, setDetail] = useState<{ id: string; items: SheetItem[] } | null>(null);
  const [manual, setManual] = useState<{ skill: "writing" | "speaking"; title: string; band: string; note: string }>({ skill: "writing", title: "", band: "6.0", note: "" });

  // Lần tải đầu: nếu có phiếu đang làm dở từ lần trước (nháp trong trình duyệt) thì mở lại đúng chỗ.
  const restored = useRef(false);
  const load = useCallback(() => {
    api<Overview>("/api/english/mock").then(d => {
      setOv(d); setErr(null);
      if (restored.current) return;
      restored.current = true;
      const dr = loadDraft();
      if (dr) { setDraft(dr); setView(dr.submittedAt ? "key" : "sheet"); setKeyText(dr.keyText ?? ""); }
    }).catch(e => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  // Đồng hồ: chỉ chạy khi đang làm phiếu.
  useEffect(() => {
    if (view !== "sheet") return;
    const first = setTimeout(() => setNow(nowMs()), 0);
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [view]);

  const update = (d: Draft) => { setDraft(d); saveDraft(d); };

  const start = () => {
    const d: Draft = { skill: setup.skill, module: setup.module, title: setup.title.trim() || `Đề ${SKILL_LABEL[setup.skill]}`, answers: Array(QUESTIONS).fill(""), startedAt: nowMs() };
    update(d); setKeyText(""); setResult(null); setView("sheet");
  };

  const parsed = useMemo(() => parseAnswerKey(keyText), [keyText]);
  const missing = parsed.map((k, i) => (k ? null : i + 1)).filter((x): x is number => x !== null);

  // Thời gian làm bài tính tới lúc nộp phiếu (không tính lúc dán đáp án).
  const submitSheet = () => {
    if (!draft) return;
    update({ ...draft, submittedAt: nowMs() });
    setView("key");
  };
  const changeKey = (text: string) => { setKeyText(text); if (draft) update({ ...draft, keyText: text }); };

  const grade = async () => {
    if (!draft || missing.length) return;
    setBusy(true); setErr(null);
    try {
      const seconds = Math.round(((draft.submittedAt ?? nowMs()) - draft.startedAt) / 1000);
      const r = await api<{ raw: number; band: number; items: SheetItem[]; seconds: number }>("/api/english/mock", {
        body: { skill: draft.skill, module: draft.module, title: draft.title, answers: draft.answers, keyText: parsed.map((k, i) => `${i + 1} ${k}`).join("\n"), seconds },
      });
      setResult(r); setView("result"); saveDraft(null); load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const saveManual = async () => {
    setBusy(true); setErr(null);
    try {
      await api("/api/english/mock", { body: { skill: manual.skill, title: manual.title.trim() || (manual.skill === "writing" ? "Writing chấm ngoài" : "Speaking nói thử"), band: Number(manual.band), note: manual.note } });
      setManual(m => ({ ...m, title: "", note: "" })); setView("list"); load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await api(`/api/english/mock/${id}`, { method: "DELETE" }); if (detail?.id === id) setDetail(null); load(); } catch (e) { setErr((e as Error).message); }
  };
  const openDetail = async (id: string) => {
    if (detail?.id === id) { setDetail(null); return; }
    try { const d = await api<{ items: SheetItem[] }>(`/api/english/mock/${id}`); setDetail({ id, items: d.items }); } catch (e) { setErr((e as Error).message); }
  };

  // ── Phiếu đang làm ────────────────────────────────────────────────────────
  if (view === "sheet" && draft) {
    const limit = MOCK_MINUTES[draft.skill] * 60;
    const left = now ? limit - Math.round((now - draft.startedAt) / 1000) : limit;
    const filled = draft.answers.filter(a => a.trim()).length;
    return (
      <div className="space-y-4">
        <PageHead title={draft.title} sub={`${SKILL_LABEL[draft.skill]}${draft.skill === "reading" ? (draft.module === "general" ? " · General Training" : " · Academic") : ""} · làm đề trong sách, ghi đáp án vào phiếu`}>
          <span className="inline-flex items-center min-h-11 px-3 rounded-[var(--kin-bo-md)] font-mono text-lg font-bold" role="timer" aria-label="Thời gian còn lại"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: left < 0 ? "var(--kin-tt-chu-loi)" : INK.chinh }}>
            {fmtClock(left)}
          </span>
        </PageHead>
        {left < 0 && <p role="status" className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>Hết giờ. Thi thật sẽ thu bài lúc này — nộp phiếu để biết điểm đúng giờ.</p>}
        <Card>
          <AnswerGrid skill={draft.skill} values={draft.answers} label="Đáp án của bạn"
            onChange={(i, v) => { const a = draft.answers.slice(); a[i] = v; update({ ...draft, answers: a }); }} />
        </Card>
        <div className="flex gap-2 flex-wrap items-center">
          <KinButton onClick={submitSheet}>Nộp phiếu ({filled}/40 câu)</KinButton>
          <KinButton variant="secondary" onClick={() => { saveDraft(null); setDraft(null); setView("list"); }}>Bỏ bài này</KinButton>
        </div>
      </div>
    );
  }

  // ── Dán đáp án ────────────────────────────────────────────────────────────
  if (view === "key" && draft) {
    return (
      <div className="space-y-4">
        <PageHead title={`Chấm: ${draft.title}`} sub="Dán phần đáp án (Answer key) của đề này ở cuối sách. Mỗi câu một dòng là chắc nhất, vd 1 TRUE · 2 B · 3 (the) river." />
        {err && <ErrorLine message={err} />}
        <Card>
          <label className="text-sm block" style={{ color: INK.chinh }}>Đáp án của sách
            <textarea value={keyText} onChange={e => changeKey(e.target.value)} rows={8} spellCheck={false} placeholder={"1 TRUE\n2 NOT GIVEN\n3 B\n4 cars / vehicles"}
              className="mt-1 w-full px-3 py-2 rounded-[var(--kin-bo-md)] border font-mono text-sm" style={inputStyle} />
          </label>
          <p className="text-sm mt-2" role="status" style={{ color: missing.length ? "var(--kin-tt-chu-cho)" : "var(--kin-tt-chu-xong)" }}>
            {missing.length === QUESTIONS ? "Chưa có đáp án nào." : missing.length ? `Đọc được ${QUESTIONS - missing.length}/40 câu — còn thiếu câu ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}. Sửa trực tiếp ở bảng dưới.` : "Đọc đủ 40 đáp án. Kiểm tra nhanh rồi bấm Chấm."}
          </p>
        </Card>
        {missing.length < QUESTIONS && (
          <Card>
            <h2 className="font-bold mb-3" style={{ color: INK.chinh }}>Đáp án app đọc được (sửa nếu sai)</h2>
            <AnswerGrid skill={draft.skill} values={parsed} label="Đáp án của sách"
              onChange={(i, v) => { const k = parsed.slice(); k[i] = v; changeKey(k.map((x, j) => `${j + 1} ${x}`).join("\n")); }} />
          </Card>
        )}
        <div className="flex gap-2 flex-wrap">
          <KinButton onClick={grade} disabled={missing.length > 0} loading={busy} loadingLabel="Đang chấm…">Chấm điểm</KinButton>
          <KinButton variant="secondary" onClick={() => { update({ ...draft, submittedAt: undefined }); setView("sheet"); }}>Quay lại phiếu</KinButton>
        </div>
      </div>
    );
  }

  if (view === "result" && result && draft) {
    return <ResultView result={result} title={draft.title} skill={draft.skill} targets={ov} onBack={() => { setDraft(null); setResult(null); setView("list"); }} />;
  }

  // ── Danh sách + bắt đầu ──────────────────────────────────────────────────
  if (err && !ov) return <ErrorLine message={err} onRetry={load} />;
  if (!ov) return <Skeleton rows={3} />;

  return (
    <div className="space-y-4">
      <PageHead title="Thi thử IELTS" sub={`Mục tiêu tổng ${ov.targetBand.toFixed(1)}: kéo điểm ở Listening/Reading (chấm khách quan), giữ Writing/Speaking.`}>
        <KinButton onClick={() => { setSetup(s => ({ ...s, skill: "listening" })); setView("setup"); }}>Làm đề Listening</KinButton>
        <KinButton onClick={() => { setSetup(s => ({ ...s, skill: "reading" })); setView("setup"); }}>Làm đề Reading</KinButton>
        <KinButton variant="secondary" onClick={() => setView("manual")}>Nhập band Writing/Speaking</KinButton>
      </PageHead>
      {err && <ErrorLine message={err} />}

      {view === "setup" && (
        <Card aria-labelledby="h-batdau">
          <h2 id="h-batdau" className="font-bold mb-2" style={{ color: INK.chinh }}>Làm đề {SKILL_LABEL[setup.skill]} ({MOCK_MINUTES[setup.skill]} phút)</h2>
          <form className="grid sm:grid-cols-[2fr_1fr_auto] gap-2 items-end" onSubmit={e => { e.preventDefault(); start(); }}>
            <label className="text-sm" style={{ color: INK.chinh }}>Tên đề
              <input value={setup.title} onChange={e => setSetup(s => ({ ...s, title: e.target.value }))} placeholder="vd Cambridge 18 — Test 2" className={`mt-1 ${inputCls}`} style={inputStyle} />
            </label>
            {setup.skill === "reading" ? (
              <label className="text-sm" style={{ color: INK.chinh }}>Dạng
                <select value={setup.module} onChange={e => setSetup(s => ({ ...s, module: e.target.value as "academic" | "general" }))} className={`mt-1 ${inputCls}`} style={inputStyle}>
                  <option value="academic">Academic</option>
                  <option value="general">General Training</option>
                </select>
              </label>
            ) : <span />}
            <KinButton type="submit">Bắt đầu bấm giờ</KinButton>
          </form>
          <p className="text-xs mt-3" style={{ color: INK.phu }}>
            Mở đề trong sách (hoặc file PDF + audio), làm bài và ghi đáp án vào phiếu trong app. Hết giờ app nhắc nhưng không khoá, để bạn biết mình chậm bao nhiêu.
          </p>
        </Card>
      )}

      {view === "manual" && (
        <Card aria-labelledby="h-nhap">
          <h2 id="h-nhap" className="font-bold mb-2" style={{ color: INK.chinh }}>Nhập band Writing / Speaking</h2>
          <form className="grid sm:grid-cols-4 gap-2 items-end" onSubmit={e => { e.preventDefault(); void saveManual(); }}>
            <label className="text-sm" style={{ color: INK.chinh }}>Kỹ năng
              <select value={manual.skill} onChange={e => setManual(m => ({ ...m, skill: e.target.value as "writing" | "speaking" }))} className={`mt-1 ${inputCls}`} style={inputStyle}>
                <option value="writing">Writing</option>
                <option value="speaking">Speaking</option>
              </select>
            </label>
            <label className="text-sm" style={{ color: INK.chinh }}>Band
              <select value={manual.band} onChange={e => setManual(m => ({ ...m, band: e.target.value }))} className={`mt-1 ${inputCls}`} style={inputStyle}>
                {Array.from({ length: 17 }, (_, i) => (1 + i * 0.5).toFixed(1)).map(b => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label className="text-sm sm:col-span-2" style={{ color: INK.chinh }}>Ai chấm / ghi chú
              <input value={manual.note} onChange={e => setManual(m => ({ ...m, note: e.target.value }))} placeholder="vd cô X chấm, bài Task 2 về giáo dục" className={`mt-1 ${inputCls}`} style={inputStyle} />
            </label>
            <label className="text-sm sm:col-span-3" style={{ color: INK.chinh }}>Tên bài
              <input value={manual.title} onChange={e => setManual(m => ({ ...m, title: e.target.value }))} placeholder="vd Cambridge 18 Test 2 — Writing" className={`mt-1 ${inputCls}`} style={inputStyle} />
            </label>
            <KinButton type="submit" loading={busy} loadingLabel="Đang lưu…">Lưu</KinButton>
          </form>
          <p className="text-xs mt-3" style={{ color: INK.phu }}>Điểm AI ở mục Viết chỉ là khoảng ước lượng. Ở đây nên nhập band do người thật chấm (giáo viên, bạn đã 7.0+), mỗi tháng 1–2 bài.</p>
        </Card>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(["listening", "reading", "writing", "speaking"] as MockSkill[]).map(k => (
          <Stat key={k} label={SKILL_LABEL[k]} value={ov.latest[k] ? ov.latest[k]!.band.toFixed(1) : "—"}
            sub={`mục tiêu ${ov.targets[k].toFixed(1)}${(k === "listening" || k === "reading") && ov.rawTargets[k] != null ? ` · ≥ ${Math.min(40, ov.rawTargets[k]! + 1)}/40 câu` : ""}`} />
        ))}
        <Stat label="Band tổng ước tính" value={ov.overall != null ? ov.overall.toFixed(1) : "—"} sub={ov.overall != null ? `mục tiêu ${ov.targetBand.toFixed(1)}` : "cần đủ 4 kỹ năng"} />
      </dl>

      <Card aria-labelledby="h-lichsu">
        <h2 id="h-lichsu" className="font-bold mb-2" style={{ color: INK.chinh }}>Lịch sử thi thử</h2>
        {ov.items.length === 0 ? (
          <p className="text-sm" style={{ color: INK.phu }}>Chưa có bài nào. Mốc gợi ý: thi thử ở tuần 6, 14 và 22 của lộ trình, rồi mỗi tuần một đề ở chặng Nước rút.</p>
        ) : (
          <ul className="divide-y divide-[var(--kin-vien-nhat)]">
            {ov.items.map(m => (
              <li key={m.id} className="py-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm" style={{ color: INK.chinh }}>
                    <span className="font-semibold">{m.title}</span>
                    <span className="ml-2" style={{ color: INK.phu }}>{SKILL_LABEL[m.skill]} · {fmtDate(m.takenAt)}{m.raw != null ? ` · ${m.raw}/40 câu` : ""}{m.note ? ` · ${m.note}` : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={m.band >= ov.targets[m.skill] ? "xong" : "cho"}>Band {m.band.toFixed(1)}{m.band >= ov.targets[m.skill] ? " · đạt mục tiêu" : ""}</Pill>
                    {m.raw != null && <button type="button" className="text-sm underline min-h-11 px-1" style={{ color: "var(--kin-nhan-link)" }} onClick={() => openDetail(m.id)} aria-expanded={detail?.id === m.id}>{detail?.id === m.id ? "Ẩn phiếu" : "Xem phiếu"}</button>}
                    <button type="button" className="text-sm underline min-h-11 px-1" style={{ color: INK.mo }} onClick={() => remove(m.id)}>Xoá</button>
                  </div>
                </div>
                {detail?.id === m.id && detail.items.length > 0 && (
                  <div className="mt-2">
                    <AnswerGrid skill={m.skill as LR} values={detail.items.map(i => i.correct ? i.answer : `${i.answer || "—"} → ${i.key}`)} label="Phiếu" readOnly marks={detail.items.map(i => i.correct)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
