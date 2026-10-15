// Tiến độ: thước đo THẬT thay cho XP ảo — giờ học so với kế hoạch, số từ đã nhớ chắc, độ chính xác chép chính tả,
// điểm thi thử theo thời gian, và Sổ lỗi (mọi câu làm sai mà chưa làm lại đúng).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Card, ErrorLine, INK, LinkButton, PageHead, Progress, Skeleton, Stat } from "@/components/english/ui";

interface Week { start: string; minutes: number; byModule: Record<string, number>; activeDays: number; dictation: { correct: number; total: number } }
interface ErrItem { exerciseId: string; instruction: string | null; prompt: string; yourAnswer: string; answers: string[]; explanation: string | null; at: string }
interface Data {
  today: string; targetBand: number;
  hours: { total: number; planned: number; last7: number; weekTargetMinutes: number };
  weeks: Week[];
  vocab: { known: number; learning: number; mature: number; reviews30: number; retention: number | null };
  mocks: { skill: string; band: number; raw: number | null; title: string; takenAt: string }[];
  writings: { createdAt: string; bandLow: number | null; bandHigh: number | null; taskType: string }[];
  errors: { total: number; redoDue: number; groups: { key: string; label: string; href: string; items: ErrItem[] }[] };
}

const MODULE_LABEL: Record<string, string> = { "tu-vung": "Từ vựng", doc: "Đọc", nghe: "Nghe", "lop-hoc": "Lớp học", viet: "Viết", "thi-thu": "Thi thử" };
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Band thi thử Listening & Reading theo thời gian. Mỗi đường có nhãn chữ ở cuối (màu không nói một mình). */
function MockChart({ mocks, targetBand }: { mocks: Data["mocks"]; targetBand: number }) {
  const series = (["listening", "reading"] as const).map(k => ({ k, pts: mocks.filter(m => m.skill === k) }));
  const all = mocks.filter(m => m.skill === "listening" || m.skill === "reading");
  if (all.length === 0) return <p className="text-sm" style={{ color: INK.phu }}>Chưa có bài thi thử Listening/Reading. Làm đề đầu tiên ở mục Thi thử IELTS.</p>;
  const W = 480, H = 240, L = 30, R = 96, T = 16, B = 28;
  const t0 = Date.parse(all[0].takenAt), t1 = Math.max(Date.parse(all.at(-1)!.takenAt), t0 + 86400_000);
  const lo = Math.max(1, Math.floor(Math.min(targetBand - 2, ...all.map(m => m.band)))), hi = 9;
  const x = (t: string) => L + ((Date.parse(t) - t0) / (t1 - t0)) * (W - L - R);
  const y = (b: number) => T + ((hi - b) / (hi - lo)) * (H - T - B);
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Band thi thử Listening và Reading theo thời gian" className="w-full h-auto">
      {ticks.map(b => (
        <g key={b}>
          <line x1={L} x2={W - R} y1={y(b)} y2={y(b)} stroke="var(--kin-vien-nhat)" />
          <text x={L - 8} y={y(b) + 4} textAnchor="end" fontSize="12" fill="var(--kin-chu-mo)">{b}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(targetBand)} y2={y(targetBand)} stroke="var(--kin-chu-phu)" strokeDasharray="4 4" />
      <text x={W - R + 8} y={y(targetBand) + 4} fontSize="12" fill="var(--kin-chu-phu)">mục tiêu {targetBand.toFixed(1)}</text>
      {series.map(({ k, pts }) => pts.length > 0 && (
        <g key={k}>
          <polyline fill="none" strokeWidth="2" stroke={k === "listening" ? "var(--kin-nhan-nen)" : "var(--kin-chu-phu)"} points={pts.map(p => `${x(p.takenAt)},${y(p.band)}`).join(" ")} />
          {pts.map((p, i) => (
            <circle key={i} cx={x(p.takenAt)} cy={y(p.band)} r="4" fill={k === "listening" ? "var(--kin-nhan-nen)" : "var(--kin-chu-phu)"}>
              <title>{`${k === "listening" ? "Listening" : "Reading"} ${p.band.toFixed(1)} — ${p.title}`}</title>
            </circle>
          ))}
          <text x={x(pts.at(-1)!.takenAt) + 8} y={y(pts.at(-1)!.band) + (k === "listening" ? -6 : 14)} fontSize="13" fontWeight="600" fill="var(--kin-chu-chinh)">
            {k === "listening" ? "L" : "R"} {pts.at(-1)!.band.toFixed(1)}
          </text>
        </g>
      ))}
      <text x={L} y={H - 8} fontSize="12" fill="var(--kin-chu-mo)">{ddmm(all[0].takenAt.slice(0, 10))}</text>
      <text x={W - R} y={H - 8} textAnchor="end" fontSize="12" fill="var(--kin-chu-mo)">{ddmm(all.at(-1)!.takenAt.slice(0, 10))}</text>
    </svg>
  );
}

export default function ProgressPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { api<Data>("/api/english/progress").then(x => { setD(x); setErr(null); }).catch(e => setErr(e.message)); }, []);
  useEffect(load, [load]);

  if (err && !d) return <ErrorLine message={err} onRetry={load} />;
  if (!d) return <Skeleton rows={4} />;

  const maxWeek = Math.max(d.hours.weekTargetMinutes, ...d.weeks.map(w => w.minutes), 1);
  const recent = d.weeks.slice(-4);
  const modules = [...new Set(recent.flatMap(w => Object.keys(w.byModule)))];
  const dict = d.weeks.filter(w => w.dictation.total > 0);

  return (
    <div className="space-y-4">
      <PageHead title="Tiến độ" sub="Đo bằng thứ thật: giờ học, từ đã nhớ chắc, điểm thi thử — không có điểm thưởng ảo." />

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Tổng giờ học" value={`${d.hours.total} giờ`} sub={`kế hoạch 26 tuần: ${d.hours.planned} giờ`} />
        <Stat label="7 ngày qua" value={`${d.hours.last7} giờ`} sub={`mục tiêu ${Math.round((d.hours.weekTargetMinutes / 60) * 10) / 10} giờ/tuần`} />
        <Stat label="Từ nhớ chắc" value={d.vocab.mature.toLocaleString("vi-VN")} sub={`${d.vocab.known.toLocaleString("vi-VN")} đã biết · ${d.vocab.learning} đang học`} />
        <Stat label="Tỉ lệ nhớ khi ôn" value={d.vocab.retention != null ? `${d.vocab.retention}%` : "—"} sub={`${d.vocab.reviews30} lượt ôn / 30 ngày · mục tiêu 85–90%`} />
      </dl>
      <Progress value={(d.hours.total / Math.max(1, d.hours.planned)) * 100} label={`Đã học ${d.hours.total}/${d.hours.planned} giờ của lộ trình`} />

      <Card aria-labelledby="h-tuan">
        <h2 id="h-tuan" className="font-bold mb-3" style={{ color: INK.chinh }}>Phút học mỗi tuần (12 tuần)</h2>
        <ol className="flex items-end gap-1.5 h-40" aria-label="Số phút học mỗi tuần">
          {d.weeks.map(w => (
            <li key={w.start} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
              <span className="text-[10px] sm:text-xs" style={{ color: INK.phu }}>{w.minutes}</span>
              <span className="w-full rounded-t" aria-hidden
                style={{ height: `${Math.max(2, (w.minutes / maxWeek) * 75)}%`, background: w.minutes >= d.hours.weekTargetMinutes ? "var(--kin-nhan-nen)" : w.minutes ? "var(--kin-chu-mo)" : "var(--kin-vien-nhat)" }} />
              <span className="text-[10px] sm:text-xs" style={{ color: INK.mo }}>{ddmm(w.start)}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs mt-2" style={{ color: INK.phu }}>Cột đậm = tuần đạt mục tiêu {d.hours.weekTargetMinutes} phút (6 buổi). Ngày ghi dưới cột là thứ Hai đầu tuần.</p>
        {modules.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <table className="text-sm w-full">
              <caption className="text-left text-xs mb-1" style={{ color: INK.phu }}>Phút theo kỹ năng, 4 tuần gần nhất</caption>
              <thead><tr style={{ color: INK.phu }}><th className="text-left font-medium py-1 pr-3">Kỹ năng</th>{recent.map(w => <th key={w.start} className="text-right font-medium py-1 px-2">{ddmm(w.start)}</th>)}</tr></thead>
              <tbody>
                {modules.map(m => (
                  <tr key={m} className="border-t" style={{ borderColor: "var(--kin-vien-nhat)", color: INK.chinh }}>
                    <td className="py-1 pr-3">{MODULE_LABEL[m] ?? m}</td>
                    {recent.map(w => <td key={w.start} className="text-right py-1 px-2 tabular-nums">{w.byModule[m] ?? 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card aria-labelledby="h-mock">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 id="h-mock" className="font-bold" style={{ color: INK.chinh }}>Thi thử Listening / Reading</h2>
            <Link href="/student/tieng-anh/thi-thu" className="text-sm underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>Thi thử</Link>
          </div>
          <MockChart mocks={d.mocks} targetBand={d.targetBand} />
        </Card>
        <Card aria-labelledby="h-nghe">
          <h2 id="h-nghe" className="font-bold mb-2" style={{ color: INK.chinh }}>Chép chính tả: tỉ lệ từ nghe đúng</h2>
          {dict.length === 0 ? <p className="text-sm" style={{ color: INK.phu }}>Chưa có bài chép chính tả nào.</p> : (
            <ul className="space-y-2">
              {dict.map(w => <li key={w.start}><Progress value={(w.dictation.correct / w.dictation.total) * 100} label={`Tuần ${ddmm(w.start)} · ${w.dictation.total} từ`} /></li>)}
            </ul>
          )}
          <h3 className="font-semibold mt-4 mb-1 text-sm" style={{ color: INK.chinh }}>Writing (khoảng band AI ước lượng)</h3>
          {d.writings.length === 0 ? <p className="text-sm" style={{ color: INK.phu }}>Chưa có bài viết nào.</p> : (
            <ul className="text-sm space-y-0.5" style={{ color: INK.phu }}>
              {d.writings.slice(-6).map((w, i) => <li key={i}>{ddmm(w.createdAt.slice(0, 10))} · {w.taskType === "task2" ? "Task 2" : w.taskType === "task1" ? "Task 1" : "Đoạn văn"} · {w.bandLow != null ? `${w.bandLow}–${w.bandHigh}` : "—"}</li>)}
            </ul>
          )}
        </Card>
      </div>

      <Card aria-labelledby="h-soloi">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h2 id="h-soloi" className="font-bold" style={{ color: INK.chinh }}>Sổ lỗi · {d.errors.total} câu chưa làm lại đúng (60 ngày)</h2>
          {d.errors.redoDue > 0 && <LinkButton href="/student/tieng-anh/tu-vung/on">Làm lại {d.errors.redoDue} câu đến hạn</LinkButton>}
        </div>
        <p className="text-xs mb-3" style={{ color: INK.phu }}>Câu ngữ pháp làm sai tự vào hàng ôn và quay lại sau 1 ngày. Nhóm nhiều lỗi nhất đứng đầu — đó là chỗ nên học lại.</p>
        {d.errors.groups.length === 0 ? <p className="text-sm" style={{ color: INK.phu }}>Không còn câu sai nào. Giỏi lắm!</p> : (
          <ul className="space-y-2">
            {d.errors.groups.map(g => (
              <li key={g.key}>
                <details className="rounded-[var(--kin-bo-md)] px-3 py-2" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
                  <summary className="cursor-pointer min-h-11 flex items-center justify-between gap-3 text-sm font-medium" style={{ color: INK.chinh }}>
                    <span>{g.label}</span><span style={{ color: INK.phu }}>{g.items.length} câu</span>
                  </summary>
                  <ul className="mt-2 space-y-3">
                    {g.items.slice(0, 15).map(it => (
                      <li key={it.exerciseId} className="text-sm">
                        {it.instruction && <p className="text-xs" style={{ color: INK.phu }}>{it.instruction}</p>}
                        <p className="whitespace-pre-line" style={{ color: INK.chinh }}>{it.prompt}</p>
                        <p className="mt-0.5"><span style={{ color: INK.phu }}>Bạn: </span><s style={{ color: "var(--kin-tt-chu-loi)" }}>{it.yourAnswer || "(trống)"}</s>
                          <span className="ml-3" style={{ color: INK.phu }}>Đúng: </span><strong style={{ color: INK.chinh }}>{it.answers.join(" · ")}</strong></p>
                        {it.explanation && <p className="text-xs mt-0.5" style={{ color: INK.phu }}>{it.explanation}</p>}
                      </li>
                    ))}
                  </ul>
                  <Link href={g.href} className="text-sm underline min-h-11 inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>Mở lại bài này</Link>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
