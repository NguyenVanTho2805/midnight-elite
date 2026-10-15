// NV-188 — Chữa bài: gợi ý trước, đáp án sau, nhưng có điểm dừng (docs/kin/nghiep-vu/hoc-tu-khan.md).
// Ba trạng thái của một câu:
//   Chưa nộp          → câu hỏi + lựa chọn; chưa gợi ý, chưa đáp án.                      [Nộp câu này]
//   Nộp lần 1, sai    → "Chưa đúng" + MỘT gợi ý; chưa đáp án.                              [Thử lại] [Xem đáp án]
//   Lần 2 vẫn sai, hoặc bấm "Xem đáp án" → đáp án đúng + lời giải.                         [Sang câu tiếp]
// Trạng thái luôn có CHỮ đi kèm màu (đúng/sai/chưa đúng) — không chỉ dựa vào màu.
// Máy chủ quyết định mọi thứ (gợi ý/đáp án chỉ về khi tới đúng bước); component chỉ hiển thị.
// Chữa bài chỉ để học: không bao giờ đổi điểm bài thi.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MathText } from "@/components/MathText";
import type { CorrectionItem, CorrectionOverview } from "@/lib/examCorrectionServer";

type Summary = CorrectionOverview["summary"];
interface Overview { available: boolean; reason: string | null; items: CorrectionItem[]; summary: Summary }

const CARD = { background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" } as const;
const OK = "var(--kin-tt-chu-xong)", BAD = "var(--kin-tt-chu-loi)", MUTED = "var(--kin-chu-mo)", INK = "var(--kin-chu-chinh)";

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const r = await fetch(url, { credentials: "same-origin", ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}) } });
    return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T & { error?: string } };
  } catch { return { ok: false, status: 0, data: { error: "Lỗi kết nối, thử lại sau" } as T & { error?: string } }; }
}

export default function CorrectionPanel({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [pickOpt, setPickOpt] = useState<string | null>(null);
  const [pickText, setPickText] = useState("");
  const [retrying, setRetrying] = useState(false); // đang ở bước 2 và bấm "Thử lại": hiện lại ô chọn
  const [reflect, setReflect] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const headRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(null);
    const r = await call<Overview>(`/api/exams/attempts/${attemptId}/correction`);
    if (!r.ok) setFailed(r.data.error ?? "Không tải được phần chữa bài"); else setData(r.data);
    setLoading(false);
  }, [attemptId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-center py-10" style={{ color: MUTED }}>Đang tải…</p>;
  if (failed) return <p role="alert" className="text-sm text-center py-10" style={{ color: BAD }}>{failed}</p>;
  if (!data) return null;
  if (!data.available) {
    return (
      <div className="rounded-xl p-4 text-sm" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
        {data.reason ?? "Chưa có chế độ chữa bài cho đề này."}
        <div className="mt-2"><button type="button" onClick={onClose} className="font-semibold underline">Quay lại xem bài làm</button></div>
      </div>
    );
  }
  if (data.items.length === 0) {
    return (
      <div className="rounded-xl p-4 text-sm" style={{ ...CARD, color: INK }}>
        Không có câu nào cần chữa — bạn đã làm đúng các câu trắc nghiệm và câu điền ngắn.
        <div className="mt-2"><button type="button" onClick={onClose} className="font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Quay lại xem bài làm</button></div>
      </div>
    );
  }

  const items = data.items;
  const item = items[Math.min(pos, items.length - 1)];
  const finished = item.state === "solved" || item.state === "revealed";
  const allDone = data.summary.remaining === 0;

  function patchItem(updated: CorrectionItem, summary: Summary) {
    setData(d => (d ? { ...d, items: d.items.map(i => (i.questionId === updated.questionId ? updated : i)), summary } : d));
  }
  async function act(body: object) {
    if (busy) return;
    setBusy(true); setErr("");
    const r = await call<{ item: CorrectionItem; summary: Summary }>(`/api/exams/attempts/${attemptId}/correction/${item.questionId}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error ?? "Không thực hiện được"); if (r.status === 409) void load(); return; }
    patchItem(r.data.item, r.data.summary);
    setRetrying(false); setPickOpt(null); setPickText("");
    if ((body as { action: string }).action === "reflect") setReflect("");
  }
  const go = (n: number) => { setPos(n); setPickOpt(null); setPickText(""); setRetrying(false); setReflect(""); setErr(""); headRef.current?.focus(); };

  const inputOpen = item.state === "new" || (item.state === "hint" && retrying);
  const canSubmit = item.type === "MC" ? !!pickOpt : pickText.trim().length > 0;

  return (
    <section aria-labelledby="chua-bai-title" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="chua-bai-title" ref={headRef} tabIndex={-1} className="text-lg font-extrabold outline-none" style={{ color: INK }}>Chữa bài</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }} aria-live="polite">
            {data.summary.total - data.summary.remaining}/{data.summary.total} câu đã xong · Chữa bài chỉ để học, không đổi điểm bài thi.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold flex-shrink-0" style={{ color: "var(--kin-nhan-link)" }}>← Xem bài làm</button>
      </div>

      <nav aria-label="Các câu cần chữa" className="flex gap-1.5 flex-wrap">
        {items.map((it, i) => {
          const done = it.state === "solved" || it.state === "revealed";
          return (
            <button key={it.questionId} type="button" onClick={() => go(i)} aria-current={i === pos ? "step" : undefined}
              aria-label={`Câu ${it.index}${done ? " — đã xong" : it.state === "hint" ? " — đang chữa" : " — chưa làm"}`}
              className="min-w-[44px] h-[44px] rounded-lg text-sm font-semibold"
              style={{ background: i === pos ? "var(--kin-nhan-nen)" : done ? "var(--kin-tt-nen-xong)" : "var(--kin-nen-bang)", color: i === pos ? "var(--kin-nhan-chu-tren-nen)" : done ? "var(--kin-tt-chu-xong)" : INK, border: "1px solid var(--kin-vien-thuong)" }}>
              {it.index}{done ? " ✓" : ""}
            </button>
          );
        })}
      </nav>

      <div className="rounded-xl p-4" style={CARD}>
        <p className="text-sm font-semibold mb-3" style={{ color: INK }}>Câu {item.index}: <MathText text={item.text} /></p>

        {item.state === "hint" && (
          <div role="status" className="rounded-lg p-3 mb-3 text-sm" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
            <strong>Chưa đúng.</strong>{" "}
            {item.hint ? <>Gợi ý: <MathText text={item.hint} /></> : null}
          </div>
        )}

        {item.type === "MC" ? (
          <div role="radiogroup" aria-label={`Lựa chọn cho câu ${item.index}`} className="space-y-2">
            {item.options.map(o => {
              const correct = finished && item.answer?.correctOptionId === o.id;
              const wrongPick = !inputOpen && item.yourOptionId === o.id && !correct && item.lastTryCorrect === false;
              const picked = inputOpen ? pickOpt === o.id : false;
              return (
                <label key={o.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
                  style={{
                    border: `2px solid ${correct ? OK : wrongPick ? BAD : picked ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)"}`,
                    background: correct ? "var(--kin-tt-nen-xong)" : wrongPick ? "var(--kin-tt-nen-loi)" : "var(--kin-nen-trang)", color: INK, cursor: inputOpen ? "pointer" : "default",
                  }}>
                  <input type="radio" name={`q-${item.questionId}`} value={o.id} disabled={!inputOpen || busy} checked={picked} onChange={() => setPickOpt(o.id)} />
                  <span className="flex-1"><MathText text={o.text} /></span>
                  {correct && <strong style={{ color: OK }}>Đáp án đúng</strong>}
                  {wrongPick && <strong style={{ color: BAD }}>Chưa đúng</strong>}
                </label>
              );
            })}
          </div>
        ) : (
          <div>
            <label htmlFor={`tl-${item.questionId}`} className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Câu trả lời của bạn</label>
            <input id={`tl-${item.questionId}`} value={inputOpen ? pickText : (item.yourText ?? "")} disabled={!inputOpen || busy} maxLength={200}
              onChange={e => setPickText(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
              style={{ border: `2px solid ${finished && item.lastTryCorrect ? OK : !inputOpen && item.lastTryCorrect === false ? BAD : "var(--kin-vien-thuong)"}`, color: INK }} />
            {!inputOpen && item.lastTryCorrect === false && <p className="text-xs mt-1 font-semibold" style={{ color: BAD }}>Chưa đúng</p>}
            {finished && item.answer?.correctText != null && <p className="text-sm mt-2" style={{ color: OK }}><strong>Đáp án đúng:</strong> <MathText text={item.answer.correctText} /></p>}
          </div>
        )}

        {finished && (
          <div role="status" className="mt-3 text-sm space-y-2">
            <p className="font-semibold" style={{ color: item.state === "solved" ? OK : INK }}>
              {item.state === "solved" ? "Chính xác!" : "Đây là đáp án đúng."}
            </p>
            {item.answer?.explanation
              ? <p className="p-3 rounded-lg" style={{ background: "var(--kin-nen-bang)", color: MUTED }}><strong>Lời giải:</strong> <MathText text={item.answer.explanation} /></p>
              : <p style={{ color: MUTED }}>Câu này chưa có lời giải chi tiết.</p>}
            {item.canReflect && (
              <div>
                <label htmlFor={`rf-${item.questionId}`} className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Bạn thử viết lại một câu: gợi ý ở trên giúp bạn ở chỗ nào? (không bắt buộc)</label>
                {item.reflection
                  ? <p className="p-3 rounded-lg" style={{ background: "var(--kin-nhan-nen-nhat)", color: INK }}>{item.reflection}</p>
                  : (
                    <div className="flex gap-2">
                      <input id={`rf-${item.questionId}`} value={reflect} maxLength={500} onChange={e => setReflect(e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-sm min-h-[44px]" style={{ border: "1px solid var(--kin-vien-thuong)", color: INK }} />
                      <button type="button" disabled={busy || !reflect.trim()} onClick={() => void act({ action: "reflect", text: reflect })} className="px-4 rounded-lg text-sm font-semibold disabled:opacity-50 min-h-[44px]" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: INK }}>Lưu</button>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        {err && <p role="alert" className="text-sm mt-3" style={{ color: BAD }}>{err}</p>}

        <div className="flex gap-2 flex-wrap mt-4">
          {inputOpen && (
            <button type="button" disabled={!canSubmit || busy} onClick={() => void act(item.type === "MC" ? { action: "submit", optionId: pickOpt } : { action: "submit", text: pickText })}
              className="px-5 rounded-lg text-sm font-bold text-white disabled:opacity-50 min-h-[44px]" style={{ background: "var(--kin-nhan-nen)" }}>
              {busy ? "Đang nộp…" : "Nộp câu này"}
            </button>
          )}
          {item.state === "hint" && !retrying && (
            <>
              <button type="button" onClick={() => { setRetrying(true); setPickOpt(null); setPickText(""); }} className="px-5 rounded-lg text-sm font-bold text-white min-h-[44px]" style={{ background: "var(--kin-nhan-nen)" }}>Thử lại</button>
              {item.canReveal && <button type="button" disabled={busy} onClick={() => void act({ action: "reveal" })} className="px-5 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-50" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: INK }}>Xem đáp án</button>}
            </>
          )}
          {finished && pos < items.length - 1 && (
            <button type="button" onClick={() => go(pos + 1)} className="px-5 rounded-lg text-sm font-bold text-white min-h-[44px]" style={{ background: "var(--kin-nhan-nen)" }}>Sang câu tiếp</button>
          )}
          {finished && pos >= items.length - 1 && allDone && (
            <button type="button" onClick={onClose} className="px-5 rounded-lg text-sm font-bold text-white min-h-[44px]" style={{ background: "var(--kin-nhan-nen)" }}>Hoàn thành</button>
          )}
        </div>
      </div>

      {allDone && (
        <p role="status" className="text-sm rounded-xl p-3" style={{ background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)", color: "var(--kin-tt-chu-xong)" }}>
          Bạn đã chữa xong {data.summary.total} câu: {data.summary.solved} câu tự làm đúng, {data.summary.revealed} câu đã xem đáp án.
        </p>
      )}
    </section>
  );
}
