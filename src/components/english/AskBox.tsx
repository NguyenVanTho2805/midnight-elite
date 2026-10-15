// Ô "Hỏi sách": câu trả lời chỉ dựa trên sách của chính người học, kèm trích dẫn unit + trang để tự mở sách kiểm tra.
"use client";
import Link from "next/link";
import { useState } from "react";
import { KinButton } from "@/components/kin";
import { api, INK } from "./ui";

interface Citation { n: number; bookId: string; unitId: string | null; bookTitle: string; unitLabel: string | null; pageNo: number; excerpt: string }
interface Answer { found: boolean; answer: string; citations: Citation[] }

export default function AskBox({ bookId, unitId, placeholder }: { bookId?: string; unitId?: string; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<{ q: string; a: Answer }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ask = async () => {
    const question = q.trim();
    if (question.length < 3 || busy) return;
    setBusy(true); setErr(null);
    try {
      const a = await api<Answer>("/api/english/ask", { body: { question, bookId, unitId } });
      setHistory(h => [{ q: question, a }, ...h]); setQ("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void ask(); }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder ?? "vd: Khi nào dùng present perfect thay vì past simple?"} aria-label="Câu hỏi về sách"
          className="flex-1 min-w-0 min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
        <KinButton type="submit" loading={busy} loadingLabel="Đang tìm trong sách…" disabled={q.trim().length < 3}>Hỏi</KinButton>
      </form>
      {err && <p role="alert" className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>{err}</p>}
      {history.map((h, i) => (
        <div key={i} className="rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
          <p className="text-sm font-semibold" style={{ color: INK.chinh }}>{h.q}</p>
          <p className="text-sm mt-1 whitespace-pre-line" style={{ color: h.a.found ? INK.chinh : INK.phu }}>{h.a.answer}</p>
          {h.a.citations.length > 0 && (
            <ul className="mt-2 space-y-1">
              {h.a.citations.map(c => (
                <li key={c.n} className="text-xs" style={{ color: INK.phu }}>
                  [{c.n}] {c.unitId ? <Link href={`/student/tieng-anh/lop-hoc/bai/${c.unitId}`} className="underline" style={{ color: "var(--kin-nhan-link)" }}>{c.unitLabel ?? c.bookTitle}</Link> : c.bookTitle}, trang {c.pageNo} — “{c.excerpt}…”
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
