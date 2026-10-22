// ĐX-04 (NC1-052/053) — số đo sức khoẻ sản phẩm: sáu chỉ số, mỗi chỉ số có định nghĩa và mẫu số ngay trên màn.
// Quản lý trung tâm (admin_super, admin_content), cùng quyền với /admin/pheu. Mẫu dưới 10 thì "Chưa đủ dữ liệu", không hiện phần trăm.
// Số tổng hợp để biết chỗ nào trong sản phẩm đang kẹt — không phải điểm của gia sư, không có tên người nào.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { callApi } from "@/components/tutor/shared";
import type { HealthMetricsPayload } from "@/lib/healthMetricsServer";
import {
  METRIC_DEFS, METRIC_ORDER, MIN_SAMPLE, insufficientText, percentOf, ratio, ratioText, sampleText,
  type MetricKey, type Ratio,
} from "@/lib/healthMetrics";

type Payload = HealthMetricsPayload & { minSample: number };

const vnDm = (iso: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
const vnWhen = (iso: string) => new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

export default function SoDoPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_TUTORS}>
      <SoDoContent />
    </PermissionGuard>
  );
}

function SoDoContent() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (d: number) => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>(`/api/admin/health-metrics?days=${d}`);
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(days);
  }, [load, days]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Số đo sức khoẻ sản phẩm</h1>
        <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>
          Số tổng hợp để biết chỗ nào trong sản phẩm đang kẹt. Không có tên học sinh hay gia sư, không xếp hạng. Mỗi số ghi rõ mẫu số;
          dưới {MIN_SAMPLE} mẫu thì ghi “chưa đủ dữ liệu”, không hiện phần trăm.
        </p>
      </div>

      <label className="text-xs inline-block" style={{ color: "var(--kin-chu-phu)" }}>Khoảng thời gian
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-o-nhap)", color: "var(--kin-chu-chinh)" }}>
          {[7, 30, 90].map(d => <option key={d} value={d}>{d} ngày gần nhất</option>)}
        </select>
      </label>

      {loading && !data ? (
        <div aria-busy="true" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {METRIC_ORDER.map(k => <div key={k} className="h-44 rounded-xl animate-pulse" style={{ background: "var(--kin-nen-bang)" }} />)}
        </div>
      ) : failed || !data ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          Không tải được số đo. <button className="underline font-semibold" onClick={() => void load(days)}>Thử lại</button>
        </div>
      ) : (
        <>
          <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }} data-testid="khoang">
            Khoảng {vnDm(data.since)} – {vnDm(data.generatedAt)} · tính lúc {vnWhen(data.generatedAt)}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {METRIC_ORDER.map(k => <Card key={k} k={k} data={data} />)}
          </div>
          <div className="rounded-xl p-4 text-sm" style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-chu-tren-nhat)" }}>
            Đọc bảng: số đo dùng để chọn việc tiếp theo, không phải điểm của gia sư. Ví dụ nếu “Phiếu gia sư đã mở Zalo” thấp thì sửa bước gửi phiếu trước,
            chưa cần làm ảnh chuyển khoản.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Thẻ chỉ số ──────────────────────────────────────────────────────────────────────────────────────────────
function Shell({ k, big, children }: { k: MetricKey; big: string; children: React.ReactNode }) {
  const def = METRIC_DEFS[k];
  return (
    <section aria-labelledby={`h-${k}`} data-metric={k} className="rounded-xl p-4 flex flex-col gap-1.5" style={{ background: "var(--kin-nen-bang)" }}>
      <h2 id={`h-${k}`} className="text-sm font-medium" style={{ color: "var(--kin-chu-phu)" }}>{def.title}</h2>
      <p className="text-4xl font-extrabold leading-tight" style={{ color: big === "—" ? "var(--kin-chu-mo)" : "var(--kin-chu-chinh)" }} data-testid={`so-${k}`}>{big}</p>
      {children}
      <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }} data-testid={`dn-${k}`}>{def.definition}</p>
      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Mẫu số: {def.denominator}.</p>
    </section>
  );
}
function Bar({ parts, label }: { parts: { w: number; color: string }[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-2 rounded-full overflow-hidden" style={{ background: "var(--kin-vien-nhat)" }}>
      {parts.filter(p => p.w > 0).map((p, i) => <div key={i} style={{ width: `${p.w}%`, background: p.color }} />)}
    </div>
  );
}
function Insufficient({ r, noun }: { r: Ratio; noun: string }) {
  return (
    <>
      <p className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: "var(--kin-tt-chu-cho)" }}>
        <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--kin-tt-cham-cho)" }} />Chưa đủ dữ liệu
      </p>
      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{insufficientText(r, noun)}</p>
    </>
  );
}
function RatioBody({ r, noun, extra }: { r: Ratio; noun: string; extra?: string }) {
  if (!r.enough) return <Insufficient r={r} noun={noun} />;
  return (
    <>
      <Bar parts={[{ w: percentOf(r) ?? 0, color: "var(--kin-nhan-nen)" }]} label={`${ratioText(r)} (${sampleText(r, noun)})`} />
      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{sampleText(r, noun)}{extra ? ` · ${extra}` : ""}</p>
    </>
  );
}

function Card({ k, data }: { k: MetricKey; data: Payload }) {
  const inv = data.invoices;
  if (k === "zaloOpened") return <Shell k={k} big={ratioText(inv.zaloOpened)}><RatioBody r={inv.zaloOpened} noun="phiếu đã gửi" /></Shell>;
  if (k === "parentViewed") return <Shell k={k} big={ratioText(inv.parentViewed)}><RatioBody r={inv.parentViewed} noun="phiếu đã mở Zalo có link riêng" /></Shell>;
  if (k === "paidIn14") {
    return (
      <Shell k={k} big={ratioText(inv.paidIn14)}>
        <RatioBody r={inv.paidIn14} noun="phiếu" extra={`lứa gửi từ ${vnDm(inv.paidCohort.from)} đến ${vnDm(inv.paidCohort.to)}`} />
      </Shell>
    );
  }
  if (k === "timely") {
    const t = data.timeliness;
    return (
      <Shell k={k} big={ratioText(t)}>
        <RatioBody r={t} noun="buổi đã điểm danh" extra={t.unmeasured > 0 ? `${t.unmeasured} buổi chỉ có “Có phép” tự sinh, không đo` : undefined} />
      </Shell>
    );
  }
  if (k === "tutors") {
    const a = data.tutors;
    return (
      <Shell k={k} big={`${a.teaching} / ${a.tutors}`}>
        {ratio(a.teaching, a.tutors).enough
          ? <Bar parts={[{ w: a.tutors > 0 ? (a.teaching / a.tutors) * 100 : 0, color: "var(--kin-nhan-nen)" }]} label={`${a.teaching} trên ${a.tutors} gia sư có buổi đã dạy`} />
          : <p className="text-xs" style={{ color: "var(--kin-tt-chu-cho)" }}>Chưa đủ dữ liệu · cần từ {MIN_SAMPLE} gia sư mới vẽ thanh</p>}
        <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{a.teaching} có ít nhất 1 buổi đã dạy · {a.invoicing} gửi ít nhất 1 phiếu (trong {data.days} ngày)</p>
      </Shell>
    );
  }
  // bank
  const b = data.bank;
  const w = (n: number) => (b.total > 0 ? (n / b.total) * 100 : 0);
  return (
    <Shell k={k} big={`${b.total} khoản`}>
      {b.total > 0 && (
        <Bar label={`Tự gạch ${b.auto}, chờ gia sư ${b.pending}, ghi tay ${b.manual}`} parts={[
          { w: w(b.auto), color: "var(--kin-tt-cham-xong)" }, { w: w(b.pending), color: "var(--kin-tt-cham-cho)" },
          { w: w(b.manual + b.resolved + b.ignored + b.other), color: "var(--kin-tt-cham-trung-tinh)" },
        ]} />
      )}
      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }} data-testid="tien-chi-tiet">
        Tự gạch {b.auto} · Chờ gia sư {b.pending} · Ghi tay {b.manual}{b.resolved + b.ignored > 0 ? ` · Gia sư đã xử lý ${b.resolved} · Bỏ qua ${b.ignored}` : ""}
      </p>
      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }} data-testid="tien-cho-lau">
        {b.oldestPendingDays === null ? "Hiện không có khoản nào đang chờ gia sư." : `Khoản đang chờ lâu nhất: ${b.oldestPendingDays} ngày.`}
      </p>
      {b.autoRate.enough
        ? <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Tự gạch {ratioText(b.autoRate)} ({sampleText(b.autoRate, "khoản SePay")})</p>
        : <p className="text-xs" style={{ color: "var(--kin-tt-chu-cho)" }}>Tỉ lệ tự gạch: chưa đủ dữ liệu ({insufficientText(b.autoRate, "khoản SePay")})</p>}
    </Shell>
  );
}
