// BU-03 P3 · S8 — Kết quả của một đề (/lop-cua-toi/de-thi/[id]/ket-qua): 5 khối + nút Xuất Excel.
//   1 Chỉ số cơ bản · 2 Phổ điểm (5 khoảng %) · 3 Tần số điểm (bước 0,5 trên thang 10) · 4 Đúng/sai theo câu (đã gộp mã đề theo variantKey) · 5 Bảng điểm theo lớp (chọn lần đầu / cuối / cao nhất).
// Chỉ khối 5 có TÊN học sinh (và chỉ gia sư chủ đề thấy); bốn khối đầu và tiêu đề trang không có tên.
// Biểu đồ vẽ bằng SVG / CSS thuần, có aria (role="img" + aria-label tóm tắt, kèm chữ số ngay cạnh), không thư viện biểu đồ.
// Dữ liệu: GET …/ket-qua, …/ket-qua/bang-diem?chon=, …/ket-qua/xuat-xlsx?chon= (hợp đồng BU-03 P3.3) + GET /api/tutor/quiz/[id] (có sẵn, chỉ để lấy tên đề).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStat, KinStatRow } from "@/components/kin/Stat";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { qfetch, type QuizDetail } from "@/components/tutor/quiz/quizClient";
import {
  CHON_LABEL, deThiDetailHref, deThiListHref, deThiSubHref, fetchBangDiem, fetchKetQua, fmtDur, fmtNum, fmtPct, variantCodeOf, xuatXlsxHref,
  type BangDiemRow, type Chon, type KetQua,
} from "./deThiClient";
import { KinSelect } from "@/components/kin/KinSelect";

const ratio = (n: number | null | undefined): number | null => (n == null || !Number.isFinite(n) ? null : Math.min(1, Math.max(0, n))); // tỉ lệ 0–1
const dmyHm = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Khối 2: năm khoảng %, thanh ngang bằng CSS. */
function PhoDiem({ data }: { data: KetQua["distribution"] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const summary = data.map(d => `${d.label}: ${d.count} bài`).join("; ");
  return (
    <div role="img" aria-label={`Phổ điểm theo phần trăm điểm tối đa. ${summary}.`} data-ket-qua-pho-diem>
      <ul className="space-y-2">
        {data.map(d => (
          <li key={d.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 min-h-8 text-[length:var(--kin-co-goc)]">
            <span className="text-[var(--kin-chu-mo)] tabular-nums">{d.label}</span>
            <span className="h-3 rounded-full bg-[var(--kin-nen-bang)] overflow-hidden" aria-hidden>
              <span className="block h-full rounded-full bg-[var(--kin-nhan-nen)]" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-[var(--kin-chu-chinh)]">{d.count}{total > 0 ? <span className="text-[var(--kin-chu-mo)]"> bài</span> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Khối 3: cột đứng 21 bậc điểm 0..10 bước 0,5 bằng SVG. */
function TanSo({ data }: { data: KetQua["frequency"] }) {
  const steps = Array.from({ length: 21 }, (_, i) => i / 2);
  const map = new Map(data.map(d => [Math.round(d.score * 2) / 2, d.count]));
  const counts = steps.map(s => map.get(s) ?? 0);
  const max = Math.max(1, ...counts);
  const best = counts.indexOf(Math.max(...counts));
  const W = 440, H = 170, L = 8, B = 24, T = 8, bw = (W - L * 2) / 21;
  const summary = counts.some(c => c > 0)
    ? `Điểm gặp nhiều nhất là ${fmtNum(steps[best])} với ${counts[best]} bài. ${steps.filter((_, i) => counts[i] > 0).map(s => `${fmtNum(s)} điểm: ${map.get(s)} bài`).join("; ")}.`
    : "Chưa có bài nào.";
  return (
    <figure data-ket-qua-tan-so className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-[640px]" role="img" aria-label={`Tần số điểm trên thang 10, bước 0,5. ${summary}`}>
        <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke="var(--kin-vien-thuong)" strokeWidth="1" />
        {counts.map((c, i) => {
          const h = c > 0 ? Math.max(3, (c / max) * (H - B - T - 14)) : 0;
          const x = L + i * bw + 1.5;
          return (
            <g key={i}>
              {c > 0 && <rect x={x} y={H - B - h} width={bw - 3} height={h} rx="2" fill="var(--kin-nhan-nen)" />}
              {c > 0 && <text x={x + (bw - 3) / 2} y={H - B - h - 3} textAnchor="middle" fontSize="9" fill="var(--kin-chu-chinh)">{c}</text>}
              {i % 4 === 0 && <text x={x + (bw - 3) / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--kin-chu-mo)">{steps[i]}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Trục ngang: điểm (thang 10, bước 0,5). Số trên cột: số bài.{counts.some(c => c > 0) ? ` Gặp nhiều nhất: ${fmtNum(steps[best])} điểm (${counts[best]} bài).` : ""}</figcaption>
    </figure>
  );
}

function BangDiem({ id }: { id: string }) {
  const [chon, setChon] = useState<Chon>("cao-nhat");
  const [rows, setRows] = useState<BangDiemRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    void fetchBangDiem(id, chon).then(r => {
      if (!alive) return;
      if (!r.ok || !r.data) { setErr(r.error ?? "Chưa tải được bảng điểm."); return; }
      setErr(null); setRows(Array.isArray(r.data.rows) ? r.data.rows : []);
    });
    return () => { alive = false; };
  }, [id, chon, n]);
  const pick = (c: Chon) => { setRows(null); setErr(null); setChon(c); };

  return (
    <section aria-labelledby="kq-bd" className="min-w-0 space-y-4" data-ket-qua-bang-diem>
      <KinSectionHead id="kq-bd" title="Bảng điểm" aside="Có tên học sinh · chỉ cô thấy" />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 w-full sm:w-64">
          <label htmlFor="kq-chon" className={`${KIN_LABEL} mb-2`}>Tính điểm theo</label>
          <KinSelect id="kq-chon" value={chon} onChange={v => pick(v as Chon)}>
            {(Object.keys(CHON_LABEL) as Chon[]).map(c => <option key={c} value={c}>{CHON_LABEL[c]}</option>)}
          </KinSelect>
        </div>
        <a href={xuatXlsxHref(id, chon)} download className={kinButtonClass("secondary")} data-ket-qua-xlsx>Xuất Excel</a>
      </div>
      {err ? (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được bảng điểm" actions={<KinButton onClick={() => { setErr(null); setN(x => x + 1); }}>Thử lại</KinButton>}>{err}</KinStateCard>
      ) : !rows ? (
        <div aria-busy="true" aria-label="Đang tải bảng điểm" className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="kin-skel kin-skel--soft h-11 rounded" />)}</div>
      ) : rows.length === 0 ? (
        <KinEmptyState title="Chưa có bài nộp để xếp điểm">Khi học sinh nộp bài, điểm từng em hiện ở đây.</KinEmptyState>
      ) : (
        <div role="region" aria-label="Bảng điểm, cuộn ngang nếu cần" tabIndex={0} className="overflow-x-auto rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)]">
          <table className="w-full min-w-[640px] text-left text-[length:var(--kin-co-goc)]">
            <thead className="bg-[var(--kin-nen-bang)] text-[var(--kin-chu-mo)]">
              <tr>{["Học sinh", "Điểm", "Nộp lúc", "Thời gian làm", "Mã đề", "Rời màn hình"].map(h => <th key={h} scope="col" className="px-3 py-2 font-normal whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.attemptId} className="border-t border-[var(--kin-vien-nhat)] align-top">
                  <th scope="row" className="px-3 py-2 font-medium text-[var(--kin-chu-chinh)] min-w-0"><span className="break-words">{r.studentName}</span>{r.email && <span className="block font-normal text-[var(--kin-co-caption)] text-[var(--kin-chu-mo)] break-all">{r.email}</span>}</th>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtNum(r.score, 2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{dmyHm(r.submittedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDur(r.durationSec)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.variantNo != null ? variantCodeOf(r.variantNo) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.tabSwitchCount > 0 ? `${r.tabSwitchCount} lần` : "Không"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">“Rời màn hình” chỉ là số lần KiN ghi nhận, không phải lý do để trừ điểm. File Excel có đủ ba sheet: Tổng quan, Bảng điểm, Theo câu.</p>
    </section>
  );
}

export default function KetQuaDe({ id }: { id: string }) {
  const [kq, setKq] = useState<KetQua | null>(null);
  const [title, setTitle] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [gone, setGone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, q] = await Promise.all([fetchKetQua(id), qfetch<QuizDetail>("GET", `/api/tutor/quiz/${id}`)]);
    if (!r.ok || !r.data) {
      if (r.code === "IS_VARIANT") { setGone("Đây là một mã đề con, kết quả được gộp ở đề gốc. Cô mở đề gốc để xem."); return; }
      if (r.status === 403 || r.status === 404) { setGone(r.status === 403 ? "Đề này không phải của cô." : "Đề có thể đã bị xoá."); return; }
      setErr(r.error ?? "Chưa tải được kết quả."); return;
    }
    setErr(null); setGone(null); setKq(r.data); setTitle(q.ok && q.data ? q.data.exam.title : "");
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const questions = useMemo(() => (kq?.questions ?? []).slice().sort((a, b) => a.order - b.order), [kq]);
  const back = { href: deThiDetailHref(id), label: "Về đề" };

  if (gone) return <KinPage><KinEmptyState title="Không mở được kết quả" action={<Link href={deThiListHref()} className={kinButtonClass("primary")}>Về Đề thi</Link>}>{gone}</KinEmptyState></KinPage>;
  if (err) {
    return (
      <KinPage>
        <KinPageHeader title="Kết quả" back={back} />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được kết quả" actions={<KinButton onClick={() => { setErr(null); void load(); }}>Thử lại</KinButton>}>{err}</KinStateCard>
      </KinPage>
    );
  }
  if (!kq) return <KinPageSkeleton label="Đang tải kết quả" stats rows={4} side={false} />;

  const b = kq.basic;
  const heading = title ? `Kết quả · ${title}` : "Kết quả";
  const actions = <Link href={deThiSubHref(id, "cham")} className={kinButtonClass("secondary")}>Chấm và công bố điểm</Link>;

  if (b.attempts === 0) {
    return (
      <KinPage>
        <KinPageHeader title={heading} back={back} actions={actions} />
        <KinEmptyState title="Chưa có bài nộp" action={<div className="flex flex-wrap gap-3 justify-center"><Link href={deThiSubHref(id, "giao")} className={kinButtonClass("primary")}>Về màn Giao đề</Link><Link href={deThiDetailHref(id)} className={kinButtonClass("secondary")}>Về đề</Link></div>}>
          Khi học sinh nộp bài, năm khối kết quả hiện ở đây: chỉ số, phổ điểm, tần số điểm, đúng/sai theo câu và bảng điểm.
        </KinEmptyState>
        <div className="mt-8"><BangDiem id={id} /></div>
      </KinPage>
    );
  }

  return (
    <KinPage>
      <KinPageHeader title={heading} back={back} actions={actions} sub={`${b.attempts} lượt nộp · ${b.students} học sinh`} />

      <section aria-labelledby="kq-1" className="min-w-0" data-ket-qua-khoi="co-ban">
        <KinSectionHead id="kq-1" title="Chỉ số cơ bản" aside="Không có tên học sinh" />
        <KinStatRow>
          <KinStat label="Điểm trung bình" value={fmtNum(b.avg, 2)} hint="thang 10" />
          <KinStat label="Điểm giữa (trung vị)" value={fmtNum(b.median, 2)} />
          <KinStat label="Cao nhất" value={fmtNum(b.max, 2)} />
          <KinStat label="Thấp nhất" value={fmtNum(b.min, 2)} />
          <KinStat label="Tỉ lệ đạt" value={fmtPct(b.passRate)} />
          <KinStat label="Thời gian làm trung bình" value={fmtDur(b.avgDurationSec)} />
          <KinStat label="Lượt nộp" value={b.attempts} />
          <KinStat label="Số học sinh" value={b.students} />
        </KinStatRow>
      </section>

      <div className="mt-8 grid lg:grid-cols-2 gap-x-10 gap-y-8 items-start">
        <section aria-labelledby="kq-2" className="min-w-0 space-y-4" data-ket-qua-khoi="pho-diem">
          <KinSectionHead id="kq-2" title="Phổ điểm" aside="% điểm tối đa" />
          <PhoDiem data={kq.distribution} />
        </section>
        <section aria-labelledby="kq-3" className="min-w-0 space-y-4" data-ket-qua-khoi="tan-so">
          <KinSectionHead id="kq-3" title="Tần số điểm" aside="bước 0,5" />
          <TanSo data={kq.frequency} />
        </section>
      </div>

      <section aria-labelledby="kq-4" className="mt-8 min-w-0 space-y-4" data-ket-qua-khoi="theo-cau">
        <KinSectionHead id="kq-4" title="Đúng và sai theo câu" aside={kq.variants.length > 1 ? `Đã gộp ${kq.variants.length} mã đề` : undefined} />
        {kq.variants.length > 1 && <KinCallout>Mỗi câu được gộp qua các mã đề theo nội dung câu, nên câu bị đảo vị trí ở mã khác vẫn tính chung. Số thứ tự là của đề gốc.</KinCallout>}
        {questions.length === 0 ? (
          <KinEmptyState title="Chưa có số liệu theo câu">Số liệu hiện sau khi có bài nộp đã chấm.</KinEmptyState>
        ) : (
          <ul aria-label="Tỉ lệ đúng từng câu" className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] divide-y divide-[var(--kin-vien-nhat)]">
            {questions.map(q => {
              const r = ratio(q.correctRate);
              return (
                <li key={`${q.order}-${q.variantKey}`} data-ket-qua-cau={q.order} className="px-4 py-3 grid grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center">
                  <span className="font-medium text-[var(--kin-chu-chinh)]">Câu {q.order}</span>
                  <span className="min-w-0 flex items-center gap-3" role="img" aria-label={`Câu ${q.order}: ${fmtPct(q.correctRate)} đúng, ${q.answered} bài làm${q.flagged ? ", nên xem lại" : ""}`}>
                    <span className="flex-1 h-3 rounded-full bg-[var(--kin-nen-bang)] overflow-hidden" aria-hidden><span className="block h-full rounded-full bg-[var(--kin-nhan-nen)]" style={{ width: `${Math.round((r ?? 0) * 100)}%` }} /></span>
                    <span className="w-12 text-right tabular-nums text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{fmtPct(q.correctRate)}</span>
                  </span>
                  <span className="col-span-2 sm:col-span-1 sm:text-right text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] flex flex-wrap gap-x-3 sm:justify-end items-center">
                    <span>{q.answered} bài làm</span>
                    {q.avgSec != null && <span>trung bình {fmtDur(q.avgSec)}</span>}
                    {q.flagged && <KinStatus tone="cho">Nên xem lại</KinStatus>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {kq.variants.length > 1 && (
          <div className="overflow-x-auto" role="region" aria-label="Điểm theo mã đề" tabIndex={0}>
            <table className="w-full max-w-[520px] text-left text-[length:var(--kin-co-goc)]">
              <thead className="text-[var(--kin-chu-mo)]"><tr><th scope="col" className="py-2 font-normal">Mã đề</th><th scope="col" className="py-2 font-normal">Lượt nộp</th><th scope="col" className="py-2 font-normal">Điểm trung bình</th></tr></thead>
              <tbody>{kq.variants.map(v => <tr key={v.variantNo} className="border-t border-[var(--kin-vien-nhat)]"><td className="py-2">Mã đề {v.code}</td><td className="py-2 tabular-nums">{v.attempts}</td><td className="py-2 tabular-nums">{fmtNum(v.avg, 2)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-8"><BangDiem id={id} /></div>
    </KinPage>
  );
}
