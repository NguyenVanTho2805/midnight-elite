// Sổ từ: từ đang học / đã biết, đổi trạng thái, kèm nguồn dữ liệu NGSL/NAWL (CC BY-SA).
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, LinkButton, PageHead, Pill, Skeleton } from "@/components/english/ui";
import { speak } from "@/components/english/speech";

interface Row { wordId: string; status: string; source: string; context: string | null; contextVi: string | null; word: { lemma: string; list: string; meaningVi: string | null; pos: string | null } }
const TABS = [{ k: "learning", l: "Đang học" }, { k: "known", l: "Đã biết" }, { k: "ignored", l: "Bỏ qua" }] as const;
const LIST_LABEL: Record<string, string> = { ngsl: "NGSL", sup: "NGSL", nawl: "Học thuật", own: "Tự bắt" };

export default function WordsPage() {
  const [tab, setTab] = useState<"learning" | "known" | "ignored">("learning");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: Row[]; counts: Record<string, number> } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ items: Row[]; counts: Record<string, number> }>(`/api/english/words?status=${tab}&q=${encodeURIComponent(q)}`).then(d => { setData(d); setErr(null); }).catch(e => setErr(e.message));
  }, [tab, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const setStatus = async (wordId: string, status: string) => {
    try { await api("/api/english/words", { method: "PATCH", body: { wordId, status } }); load(); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <PageHead title="Từ vựng" sub="Xương sống: NGSL (2.801 từ thông dụng) + NAWL (959 từ học thuật), cộng từ bạn bắt được khi đọc.">
        <LinkButton href="/student/tieng-anh/tu-vung/on">Ôn thẻ</LinkButton>
        <LinkButton href="/student/tieng-anh/tu-vung/xep-lop" variant="secondary">Kiểm tra lại từ vựng</LinkButton>
      </PageHead>
      <div className="flex gap-2 flex-wrap items-center">
        {TABS.map(t => (
          <KinButton key={t.k} variant={tab === t.k ? "primary" : "secondary"} onClick={() => setTab(t.k)} aria-pressed={tab === t.k}>
            {t.l}{data?.counts[t.k] !== undefined ? ` (${data.counts[t.k]})` : ""}
          </KinButton>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm từ…" aria-label="Tìm từ"
          className="min-h-11 px-3 rounded-[var(--kin-bo-md)] border flex-1 min-w-[160px]" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
      </div>
      {err && <ErrorLine message={err} onRetry={load} />}
      {!data ? <Skeleton /> : data.items.length === 0 ? (
        <Card><p className="text-sm" style={{ color: INK.phu }}>Chưa có từ nào ở mục này.</p></Card>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {data.items.map(r => (
            <li key={r.wordId} className="rounded-[var(--kin-bo-md)] p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button type="button" onClick={() => speak(r.word.lemma)} className="font-bold text-left" style={{ color: INK.chinh }}>{r.word.lemma}</button>
                  {r.word.pos && <span className="text-xs ml-2" style={{ color: INK.mo }}>{r.word.pos}</span>}
                  <p className="text-sm" style={{ color: INK.phu }}>{r.contextVi ?? r.word.meaningVi ?? "—"}</p>
                </div>
                <Pill>{LIST_LABEL[r.word.list] ?? r.word.list}</Pill>
              </div>
              {r.context && <p className="text-xs mt-1 italic" style={{ color: INK.mo }}>{r.context}</p>}
              <div className="flex gap-2 mt-2">
                {r.status !== "known" && <button type="button" className="text-xs underline min-h-11" style={{ color: "var(--kin-nhan-link)" }} onClick={() => setStatus(r.wordId, "known")}>Đã biết rồi</button>}
                {r.status !== "learning" && <button type="button" className="text-xs underline min-h-11" style={{ color: "var(--kin-nhan-link)" }} onClick={() => setStatus(r.wordId, "learning")}>Học lại</button>}
                {r.status === "learning" && <button type="button" className="text-xs underline min-h-11" style={{ color: INK.mo }} onClick={() => setStatus(r.wordId, "ignored")}>Bỏ qua từ này</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs" style={{ color: INK.mo }}>
        Danh sách từ: New General Service List & New Academic Word List — Browne, C., Culligan, B. & Phillips, J., giấy phép CC BY-SA 4.0 (newgeneralservicelist.org).
      </p>
    </div>
  );
}
