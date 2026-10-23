"use client";
// KiN Pro F4 — khối "Thống kê chuyên cần nâng cao" trên trang Doanh thu của gia sư. Chỉ TRÌNH BÀY số từ /api/tutor/thong-ke-chuyen-can
// (cùng hệ số chuyên cần và dấu "chưa điểm danh khác vắng" với bảng điểm danh). Free (khi cổng BẬT): khối mờ KHÔNG chứa số nào, kèm "Có trong KiN Pro" + nút tới Gói.
// Sáu chỉ số cơ bản và doanh thu theo lớp/tháng ở phần trên trang, không bao giờ bị che.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KinButton, KinSkeleton, KinStatus } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/Button";
import { CARD_STYLE, callApi } from "@/components/tutor/shared";
import type { AttendanceInsights } from "@/lib/attendanceInsightsServer";
import type { TrendPoint } from "@/lib/attendanceInsights";

type Payload = ({ locked: true } | ({ locked: false } & AttendanceInsights));

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

function TrendList({ title, id, points, minSample, testid }: { title: string; id: string; points: TrendPoint[]; minSample: number; testid: string }) {
  return (
    <section aria-labelledby={id} data-testid={testid}>
      <h3 id={id} className="font-medium mb-2" style={{ color: "var(--kin-chu-chinh)" }}>{title}</h3>
      <ul className="rounded-xl p-4 space-y-3" style={CARD_STYLE}>
        {points.map(p => (
          <li key={p.key} data-testid={`${testid}-${p.key}`} data-rate={p.rate ?? ""} data-n={p.n} className="flex items-center gap-3">
            <span className="w-24 text-xs flex-shrink-0" style={{ color: "var(--kin-chu-phu)" }}>{p.label}</span>
            <div className="flex-1 h-2 rounded-full min-w-0" style={{ background: "var(--kin-nen-nhan)" }} aria-hidden>
              <div className="h-2 rounded-full" style={{ width: `${p.rate ?? 0}%`, background: "var(--kin-tt-cham-xong)" }} />
            </div>
            <span className="text-sm tabular-nums text-right w-28 flex-shrink-0" style={{ color: p.rate === null ? "var(--kin-chu-mo)" : "var(--kin-chu-chinh)" }}>
              {p.rate === null ? (p.n === 0 ? "Chưa có buổi" : `Chưa đủ dữ liệu (${p.n}/${minSample})`) : <><b>{p.rate}%</b> <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>· {p.n} lượt</span></>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LockedPreview() {
  // Hình minh hoạ tĩnh, KHÔNG số liệu, KHÔNG tên: dữ liệu thật không được gửi cho gia sư Free.
  return (
    <div data-testid="khoa-pro" className="relative rounded-xl overflow-hidden" style={CARD_STYLE}>
      <div aria-hidden className="p-4 space-y-3 select-none pointer-events-none" style={{ filter: "blur(5px)", opacity: 0.6 }}>
        {[88, 74, 92, 65, 80].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-20 h-3 rounded-full" style={{ background: "var(--kin-vien-nhat)" }} />
            <div className="flex-1 h-2 rounded-full" style={{ background: "var(--kin-nen-nhan)" }}><div className="h-2 rounded-full" style={{ width: `${w}%`, background: "var(--kin-tt-cham-xong)" }} /></div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center" style={{ background: "var(--kin-nen-trang)", opacity: 0.94 }}>
        <KinStatus tone="mo">Có trong KiN Pro</KinStatus>
        <p className="text-sm max-w-sm" style={{ color: "var(--kin-chu-phu)" }}>Xu hướng chuyên cần theo tuần và tháng, cảnh báo em vắng liên tiếp, so sánh các lớp của bạn.</p>
        <Link href="/lop-cua-toi/goi" className={kinButtonClass("primary")} data-testid="khoa-pro-nut">Xem gói KiN Pro</Link>
      </div>
    </div>
  );
}

export default function AdvancedAttendanceStats() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>("/api/tutor/thong-ke-chuyen-can");
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return (
    <section aria-labelledby="h-chuyen-can" data-testid="thong-ke-chuyen-can" className="space-y-4">
      <div>
        <h2 id="h-chuyen-can" className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Chuyên cần của các lớp</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>
          Tính từ bảng điểm danh bạn đã ghi, theo cùng hệ số chuyên cần. Buổi chưa điểm danh không bị tính là vắng và không tính tiền.
        </p>
      </div>
      {loading ? <div className="rounded-xl p-4" style={CARD_STYLE}><KinSkeleton widths={[100, 80, 60, 90]} /></div>
        : failed || !data ? (
          <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>
            Không tải được thống kê chuyên cần. <KinButton variant="ghost" onClick={() => void load()}>Thử lại</KinButton>
          </div>
        ) : data.locked ? <LockedPreview /> : <Body d={data} />}
    </section>
  );
}

function Body({ d }: { d: AttendanceInsights }) {
  const any = [...d.weekly, ...d.monthly].some(p => p.n > 0);
  if (d.classCount === 0) return <p className="text-sm py-2" style={{ color: "var(--kin-chu-phu)" }}>Bạn chưa có lớp nào. Tạo lớp và điểm danh vài buổi là có thống kê ở đây.</p>;
  if (!any && d.compare.rows.every(r => r.n === 0)) return <p className="text-sm py-2" style={{ color: "var(--kin-chu-phu)" }}>Chưa có buổi điểm danh nào trong 6 tháng qua nên chưa có gì để vẽ. Điểm danh vài buổi là thấy xu hướng.</p>;
  return (
    <div className="space-y-5">
      <TrendList title="Theo tuần (8 tuần gần nhất)" id="h-xh-tuan" points={d.weekly} minSample={d.minSample} testid="xh-tuan" />
      <TrendList title="Theo tháng (6 tháng gần nhất)" id="h-xh-thang" points={d.monthly} minSample={d.minSample} testid="xh-thang" />

      <section aria-labelledby="h-vang" data-testid="vang-lien-tiep">
        <h3 id="h-vang" className="font-medium mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Em vắng liên tiếp</h3>
        {d.streaks.length === 0
          ? <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Chưa có em nào vắng từ {d.streakMin} buổi liên tiếp ở các buổi đã điểm danh.</p>
          : <ul className="space-y-2">
              {d.streaks.map(s => (
                <li key={s.studentId + s.courseId} data-streak={s.streak} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={CARD_STYLE}>
                  <div className="min-w-0">
                    <p className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</p>
                    <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{s.courseName} · buổi vắng gần nhất {ddmm(s.lastAbsentKey)}</p>
                  </div>
                  <KinStatus tone="loi">Vắng {s.streak} buổi liên tiếp</KinStatus>
                </li>
              ))}
            </ul>}
        <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>Tính cả nghỉ có phép. Chỉ gia sư chủ lớp thấy tên em ở đây.</p>
      </section>

      <section aria-labelledby="h-sosanh" data-testid="so-sanh-lop">
        <h3 id="h-sosanh" className="font-medium mb-2" style={{ color: "var(--kin-chu-chinh)" }}>So sánh lớp (90 ngày gần nhất)</h3>
        <ul className="space-y-2">
          {d.compare.rows.map(r => (
            <li key={r.courseId} data-rate={r.rate ?? ""} data-n={r.n} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={CARD_STYLE}>
              <div className="min-w-0">
                <p className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{r.name}</p>
                <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{r.students} học viên đang học · {r.sessions} buổi · {r.n} lượt điểm danh</p>
              </div>
              <span className="text-sm tabular-nums" style={{ color: r.rate === null ? "var(--kin-chu-mo)" : "var(--kin-chu-chinh)" }}>
                {r.rate === null ? `Chưa đủ dữ liệu (${r.n}/${d.minSample})` : <b>{r.rate}%</b>}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>Dưới {d.minSample} lượt điểm danh thì KiN không hiện phần trăm, vì mẫu nhỏ dễ gây hiểu nhầm.</p>
      </section>
    </div>
  );
}
