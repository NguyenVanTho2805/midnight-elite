// BU-11 — điểm 0-10 và % hoàn thành BTVN của từng em ở buổi này (không bắt buộc). Nằm dưới bảng điểm danh.
// Chỉ gia sư và phụ huynh của ĐÚNG em đó thấy; học sinh không thấy. Em chưa có đồng ý phạm vi “điểm từng buổi” thì không ghi được:
// hàng đó ghi rõ lý do và dẫn tới hồ sơ riêng để xác nhận đồng ý trước.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD } from "@/components/kin/PageLayout";
import { SCORE_MAX, parsePct, parseScore, pctChip } from "@/lib/sessionScore";
import { jfetch } from "@/components/tutor/studentUi";

interface Row { userId: string; name: string; canRecord: boolean; reason: "no_profile" | "no_consent" | null; profileId: string | null; score: number | null; homeworkPct: number | null }
const show = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export default function DiemBuoi({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [vals, setVals] = useState<Record<string, { s: string; p: string }>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const apply = useCallback((r: Awaited<ReturnType<typeof jfetch>>) => {
    if (!r.ok) { setError(true); return; }
    const list = r.json.roster as Row[];
    setRows(list); setError(false); setDirty(new Set());
    setVals(Object.fromEntries(list.map(x => [x.userId, { s: show(x.score), p: x.homeworkPct === null ? "" : String(x.homeworkPct) }])));
  }, []);
  const url = `/api/attendance-sessions/${sessionId}/diem`;
  const reload = useCallback(() => { jfetch(url).then(apply); }, [url, apply]);
  useEffect(() => { let alive = true; jfetch(url).then(r => { if (alive) apply(r); }); return () => { alive = false; }; }, [url, apply]);

  const edit = (id: string, k: "s" | "p", v: string) => { setVals(p => ({ ...p, [id]: { ...p[id], [k]: v } })); setDirty(p => new Set(p).add(id)); setMsg(null); };
  const invalid = (id: string) => { const v = vals[id]; return !!v && (!parseScore(v.s).ok || !parsePct(v.p).ok); };

  async function save() {
    setSaving(true); setMsg(null);
    const scores = [...dirty].map(id => ({ userId: id, score: vals[id].s.trim() === "" ? null : vals[id].s, homeworkPct: vals[id].p.trim() === "" ? null : vals[id].p }));
    const r = await jfetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scores }) });
    setSaving(false);
    if (r.ok) { setMsg({ tone: "ok", text: `Đã lưu điểm cho ${r.json.count} em.` }); reload(); } else setMsg({ tone: "err", text: r.json?.error ?? "Chưa lưu được, thử lại nhé." });
  }

  return (
    <section data-diem-buoi aria-labelledby="diem-buoi-h" className="mt-6">
      <h3 id="diem-buoi-h" className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Điểm từng buổi (không bắt buộc)</h3>
      <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Điểm 0 đến {SCORE_MAX} và phần trăm hoàn thành bài tập về nhà. Chỉ bạn và phụ huynh của đúng em đó xem được; học sinh không thấy.</p>
      {error ? (
        <p role="alert" className="mt-2 text-[var(--kin-tt-chu-loi)]">Không tải được điểm buổi. <button type="button" onClick={reload} className="underline min-h-11">Thử lại</button></p>
      ) : rows === null ? (
        <p aria-busy="true" className="mt-2 text-[var(--kin-chu-mo)]">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[var(--kin-chu-mo)]">Lớp chưa có em nào đang học.</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-[var(--kin-vien-nhat)]">
            {rows.map(r => (
              <li key={r.userId} data-diem-row className="py-3 flex flex-wrap items-center gap-3">
                <span className="basis-full sm:basis-48 min-w-0 break-words text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{r.name}</span>
                {r.canRecord ? (
                  <>
                    <label className="flex items-center gap-2 text-[length:var(--kin-co-goc)]">Điểm
                      <input inputMode="decimal" aria-label={`Điểm của ${r.name}`} value={vals[r.userId]?.s ?? ""} onChange={e => edit(r.userId, "s", e.target.value)} className={`${KIN_FIELD} w-24 tabular-nums`} placeholder="0 – 10" />
                    </label>
                    <label className="flex items-center gap-2 text-[length:var(--kin-co-goc)]">BTVN %
                      <input inputMode="numeric" aria-label={`Phần trăm hoàn thành BTVN của ${r.name}`} value={vals[r.userId]?.p ?? ""} onChange={e => edit(r.userId, "p", e.target.value)} className={`${KIN_FIELD} w-24 tabular-nums`} placeholder="0 – 100" />
                    </label>
                    {invalid(r.userId) ? <KinStatus tone="loi">Điểm 0 đến {SCORE_MAX} (bước 0,25), BTVN số nguyên 0 đến 100</KinStatus>
                      : r.homeworkPct !== null && !dirty.has(r.userId) ? <KinStatus tone={pctChip(r.homeworkPct).tone}>{pctChip(r.homeworkPct).text}</KinStatus> : null}
                  </>
                ) : (
                  <span className="flex flex-wrap items-center gap-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                    <KinStatus tone="cho">{r.reason === "no_profile" ? "Chưa có hồ sơ riêng và đồng ý" : "Thiếu đồng ý ghi điểm"}</KinStatus>
                    <Link href={r.profileId ? `/lop-cua-toi/hoc-sinh/${r.profileId}` : `/lop-cua-toi/hoc-sinh/them?userId=${r.userId}`} className="inline-flex items-center min-h-11 underline text-[var(--kin-nhan-link)]">
                      {r.profileId ? "Mở hồ sơ để xác nhận" : "Tạo hồ sơ riêng"}
                    </Link>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <KinButton variant="secondary" onClick={save} disabled={dirty.size === 0 || [...dirty].some(invalid)} loading={saving} loadingLabel="Đang lưu...">Lưu điểm buổi</KinButton>
            {msg && <span role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-tt-chu-xong)]"}>{msg.text}</span>}
          </div>
        </>
      )}
    </section>
  );
}
