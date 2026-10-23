// ĐX-04 (NC1-052/053) — số đo sức khoẻ sản phẩm: sáu chỉ số, mỗi chỉ số có định nghĩa và mẫu số ngay trên màn.
// Quản lý trung tâm (admin_super, admin_content), cùng quyền với /admin/pheu. Mẫu dưới 10 thì "Chưa đủ dữ liệu", không hiện phần trăm.
// Số tổng hợp để biết chỗ nào trong sản phẩm đang kẹt — không phải điểm của gia sư, không có tên người nào.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton, KinCallout, KinSectionHead, KinSkeleton, KinStat, KinStateCard, KinStatRow, KinStatus } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { callApi } from "@/components/tutor/shared";
import type { HealthMetricsPayload } from "@/lib/healthMetricsServer";
import {
  ACTIVATION_ORDER, METRIC_DEFS, METRIC_ORDER, MIN_SAMPLE, hoursText, insufficientText, percentOf, ratio, ratioText, sampleText,
  type MetricKey, type Ratio,
} from "@/lib/healthMetrics";

type Payload = HealthMetricsPayload & { minSample: number };

// "22/10" và "06:03 22/10" theo giờ Việt Nam. Intl.DateTimeFormat("vi-VN", { day, month }) ra "22-10" (gạch ngang), nên ghép từ các phần ngày / tháng / giờ.
const vnParts = (iso: string) => {
  const o: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(new Date(iso))) o[p.type] = p.value;
  return o;
};
const vnDm = (iso: string) => { const p = vnParts(iso); return `${p.day}/${p.month}`; };
const vnWhen = (iso: string) => { const p = vnParts(iso); return `${p.hour}:${p.minute} ${p.day}/${p.month}`; };

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
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-9 font-medium text-[var(--kin-chu-chinh)]">Số đo sức khoẻ sản phẩm</h1>
          <p className="mt-2 max-w-[68ch] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
            Số tổng hợp để biết chỗ nào trong sản phẩm đang kẹt. Không có tên học sinh hay gia sư, không xếp hạng. Mỗi số ghi rõ mẫu số;
            dưới {MIN_SAMPLE} mẫu thì ghi “chưa đủ dữ liệu”, không hiện phần trăm.
          </p>
        </div>
        <label className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Khoảng thời gian
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="block mt-1 px-3 min-h-[44px] rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-goc)] bg-[var(--kin-nen-trang)] border border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-chinh)]">
            {[7, 30, 90].map(d => <option key={d} value={d}>{d} ngày gần nhất</option>)}
          </select>
        </label>
      </header>

      {loading && !data ? (
        <KinStateCard busy kicker="Đang tải" title="Đang tính số đo" note="Giữ vị trí nội dung, không hiển thị số liệu tạm như dữ liệu thật.">
          <p>Đang lấy số liệu {days} ngày gần nhất, vui lòng chờ một chút.</p>
          <KinSkeleton className="mt-4" />
        </KinStateCard>
      ) : failed || !data ? (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được số đo"
          status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
          actions={<KinButton variant="secondary" onClick={() => void load(days)}>Thử lại</KinButton>}>
          <p>Không tải được số đo. Kiểm tra kết nối rồi thử lại; dữ liệu trên hệ thống không bị mất.</p>
        </KinStateCard>
      ) : (
        <>
          <KinStatRow>
            <KinStat label="Gia sư có buổi đã dạy" value={data.tutors.teaching} hint={`Trên ${data.tutors.tutors} gia sư đang hiện công khai`} />
            <KinStat label={`Gia sư đăng ký · ${data.days} ngày`} value={data.activation.registered} hint="Theo ngày tạo tài khoản" />
            <KinStat label={`Phiếu học phí đã gửi · ${data.days} ngày`} value={data.invoices.zaloOpened.d} hint="Chỉ đếm phiếu, không đếm tiền" />
            <KinStat label={`Khoản tiền về · ${data.days} ngày`} value={data.bank.total} hint={`Tự gạch ${data.bank.auto}, chờ gia sư ${data.bank.pending}`} />
          </KinStatRow>
          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]" data-testid="khoang">
            Khoảng {vnDm(data.since)} – {vnDm(data.generatedAt)} · tính lúc {vnWhen(data.generatedAt)}
          </p>
          <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {METRIC_ORDER.map(k => <Card key={k} k={k} data={data} />)}
          </div>
          <div>
            <KinSectionHead title={<span data-testid="nhom-gia-su-moi">Gia sư mới vào</span>} aside={`${data.activation.registered} gia sư đăng ký`} />
            <p className="mt-3 max-w-[72ch] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
              {data.activation.registered} gia sư đăng ký trong {data.days} ngày gần nhất. Mỗi thẻ chỉ tính gia sư đã đăng ký đủ lâu để có thể đạt mốc; gia sư mới vào hôm nay chưa bị tính là “bỏ”.
            </p>
          </div>
          <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVATION_ORDER.map(k => <Card key={k} k={k} data={data} />)}
          </div>
          <KinCallout title="Đọc bảng">
            Số đo dùng để chọn việc tiếp theo, không phải điểm của gia sư. Ví dụ nếu “Phiếu gia sư đã mở Zalo” thấp thì sửa bước gửi phiếu trước,
            chưa cần làm ảnh chuyển khoản.
          </KinCallout>
        </>
      )}
    </div>
  );
}

// ─── Thẻ chỉ số ──────────────────────────────────────────────────────────────────────────────────────────────
function Shell({ k, big, children }: { k: MetricKey; big: string; children: React.ReactNode }) {
  const def = METRIC_DEFS[k];
  return (
    <section aria-labelledby={`h-${k}`} data-metric={k} className="flex flex-col gap-2 py-6 border-t border-[var(--kin-vien-nhat)]">
      <h2 id={`h-${k}`} className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{def.title}</h2>
      <p className={`text-[22px] leading-7 font-medium tabular-nums ${big === "—" ? "text-[var(--kin-chu-mo)]" : "text-[var(--kin-chu-chinh)]"}`} data-testid={`so-${k}`}>{big}</p>
      {children}
      <p className="text-[length:var(--kin-co-small)] leading-5 text-[var(--kin-chu-phu)]" data-testid={`dn-${k}`}>{def.definition}</p>
      <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Mẫu số: {def.denominator}.</p>
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
      <KinStatus tone="cho">Chưa đủ dữ liệu</KinStatus>
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
  if (k === "actClass" || k === "actTeach") {
    const act = data.activation, r = k === "actClass" ? act.classIn24h : act.taughtIn7d, c = k === "actClass" ? act.cohort24 : act.cohort7;
    return (
      <Shell k={k} big={ratioText(r)}>
        <RatioBody r={r} noun="gia sư" extra={`đăng ký từ ${vnDm(c.from)} đến ${vnDm(c.to)}`} />
      </Shell>
    );
  }
  if (k === "actMedian") {
    const m = data.activation.firstClassHours;
    return (
      <Shell k={k} big={hoursText(m.hours)}>
        {m.enough
          ? <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Trung vị của {m.n} gia sư đã có lớp</p>
          : (
            <>
              <KinStatus tone="cho">Chưa đủ dữ liệu</KinStatus>
              <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{m.n} gia sư đã có lớp · cần từ {MIN_SAMPLE} mới hiện con số</p>
            </>
          )}
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
