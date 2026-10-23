// KiN Pro — màn "Gói của tôi". Giá, hạn mức, số lượt AI: TẤT CẢ lấy từ bảng cấu hình (không viết cứng ở đây).
// Chưa cấu hình nhận tiền / đang chạy thử / bản xem trước → "Chưa mở bán", không bao giờ hiện số tài khoản. Thu bằng QR theo kỳ, KiN đối chiếu và mở Pro bằng tay.
// Trạng thái luôn có CHỮ (màu không nói một mình). Đang tải: khung xương. Lỗi: dải lỗi có "Thử lại".
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinCallout, KinSectionHead, KinStat, KinStatRow, KinStateCard, KinStatus, KinCopyButton } from "@/components/kin";
import { KinPage, KinPageHeader, KinPageSkeleton } from "@/components/kin/PageLayout";
import { callApi, vnd } from "@/components/tutor/shared";
import type { QuotaState, PlanConfigRow, BillingPeriod } from "@/lib/planLimits";

interface Quota { state: QuotaState; used: number; limit: number; remaining: number; pct: number }
interface OrderView {
  id: string; period: string; status: string; priceVnd: number; listPriceVnd: number; foundingDiscountPct: number; source: string;
  memoCode: string; durationDays: number; startDate: string | null; endDate: string | null; createdAt: string;
}
interface PendingView extends OrderView { qrUrl: string; account: { bankName: string; accountNo: string; accountName: string } }
interface View {
  plan: { code: "free" | "pro"; isPro: boolean; proUntil: string | null; quota: { students: Quota; aiExtract: Quota }; enforced: boolean };
  configs: { free: PlanConfigRow; pro: PlanConfigRow };
  foundingPct: number;
  sale: { open: boolean; reason: string | null; text: string | null };
  pending: PendingView | null;
  orders: OrderView[];
}

const PERIODS: { key: BillingPeriod; label: string; months: number; priceKey: "priceMonthVnd" | "priceQuarterVnd" | "priceYearVnd" }[] = [
  { key: "month", label: "1 tháng", months: 1, priceKey: "priceMonthVnd" },
  { key: "quarter", label: "3 tháng", months: 3, priceKey: "priceQuarterVnd" },
  { key: "year", label: "12 tháng", months: 12, priceKey: "priceYearVnd" },
];
const PERIOD_TEXT: Record<string, string> = { month: "1 tháng", quarter: "3 tháng", year: "12 tháng", grant: "Tặng" };
const STATUS_TEXT: Record<string, { tone: "xong" | "cho" | "mo"; text: string }> = {
  pending: { tone: "cho", text: "Đang chờ đối chiếu" }, active: { tone: "xong", text: "Đã mở Pro" }, cancelled: { tone: "mo", text: "Đã huỷ" },
};
const STATE_TEXT: Record<QuotaState, { tone: "xong" | "cho" | "loi"; text: string }> = {
  ok: { tone: "xong", text: "Còn thoải mái" },
  warn: { tone: "cho", text: "Gần đến hạn mức" },
  blocked: { tone: "loi", text: "Đã đạt hạn mức: chưa nhận thêm được" },
  over: { tone: "loi", text: "Đang vượt hạn mức Free: mọi thứ giữ nguyên, chỉ chưa nhận thêm" },
};
const BAR_COLOR: Record<QuotaState, string> = { ok: "var(--kin-tt-cham-xong)", warn: "var(--kin-tt-cham-cho)", blocked: "var(--kin-tt-chu-loi)", over: "var(--kin-tt-chu-loi)" };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

function UsageBar({ title, q, unit, name }: { title: string; q: Quota; unit: string; name: string }) {
  const st = STATE_TEXT[q.state];
  return (
    <div data-testid={`thanh-${name}`} data-state={q.state} className="py-4 border-b border-[var(--kin-vien-nhat)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{title}</p>
        <p className="text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-chinh)]" data-testid={`so-${name}`}>{q.used}/{q.limit} {unit}</p>
      </div>
      <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={q.limit} aria-valuenow={Math.min(q.used, q.limit)}
        className="mt-2 h-2 rounded-full overflow-hidden bg-[var(--kin-vien-nhat)]">
        <div className="h-full" style={{ width: `${Math.min(100, q.pct)}%`, background: BAR_COLOR[q.state] }} />
      </div>
      <p className="mt-2"><KinStatus tone={st.tone} className="!whitespace-normal">{st.text}</KinStatus></p>
    </div>
  );
}

export default function GoiClient() {
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BillingPeriod | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<View>("/api/tutor/goi");
    if (!r.ok) setFailed(true); else setView(r.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function buy(period: BillingPeriod) {
    if (busy) return;
    setBusy(period); setMsg(null);
    const r = await callApi<View & { created?: boolean }>("/api/tutor/goi/mua", { method: "POST", body: JSON.stringify({ period }) });
    setBusy(null);
    if (!r.ok) { setMsg(r.data.error ?? "Không tạo được yêu cầu, thử lại sau"); return; }
    setView(r.data);
    setMsg("Đã tạo mã chuyển khoản. Chuyển đúng số tiền và nội dung bên dưới.");
  }

  if (loading && !view) return <KinPageSkeleton label="Đang tải gói của bạn" stats side={false} rows={3} />;
  if (failed || !view) {
    return (
      <KinPage>
        <KinPageHeader title="Gói của tôi" />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được thông tin gói"
          status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
          actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}>
          <p>Lớp, phiếu và dữ liệu của bạn không bị ảnh hưởng. Kiểm tra kết nối rồi thử lại.</p>
        </KinStateCard>
      </KinPage>
    );
  }

  const { plan, configs, sale, pending } = view;
  const free = configs.free, pro = configs.pro;
  const planName = plan.isPro ? pro.name : free.name;

  return (
    <KinPage>
      <KinPageHeader title="Gói của tôi" sub="Gói hiện tại, mức bạn đã dùng và cách mở KiN Pro." />
      <div className="space-y-8 max-w-4xl">
        {!plan.enforced && (
          <KinCallout title="Hiện KiN chưa áp hạn mức">
            Bạn đang dùng thoải mái, không ai bị chặn. Các con số dưới đây cho biết bạn đang ở đâu so với gói Free, để bạn biết trước khi hạn mức được áp dụng.
          </KinCallout>
        )}

        <KinStatRow>
          <KinStat label="Gói hiện tại" value={<span data-testid="goi-hien-tai">{planName}</span>}
            hint={plan.isPro && plan.proUntil ? `Còn hiệu lực tới ${fmtDate(plan.proUntil)}` : "Không bao giờ hết hạn"} />
          <KinStat label="Học viên đang học" value={<span data-testid="hoc-vien">{plan.quota.students.used}/{plan.quota.students.limit}</span>} hint="Tính số em khác nhau đang học ở các lớp của bạn" />
          <KinStat label="Lượt AI trích đề tháng này" value={<span data-testid="luot-ai">còn {plan.quota.aiExtract.remaining}</span>} hint={`${plan.quota.aiExtract.used}/${plan.quota.aiExtract.limit} lượt đã dùng, tính lại đầu tháng`} />
        </KinStatRow>

        <section aria-label="Mức đã dùng">
          <KinSectionHead title="Mức bạn đã dùng" />
          <UsageBar title="Học viên đang học" q={plan.quota.students} unit="học viên" name="hoc-vien" />
          <UsageBar title="Lượt AI trích đề trong tháng" q={plan.quota.aiExtract} unit="lượt" name="ai" />
          <p className="mt-3 text-[length:var(--kin-co-small)] leading-5 text-[var(--kin-chu-mo)]">
            Hạn mức chỉ chặn việc <b>thêm mới</b>. Lớp, điểm danh, phiếu, lịch sử, xuất dữ liệu và Sổ của con luôn mở, kể cả khi vượt hạn mức hay hết hạn Pro.
          </p>
        </section>

        <section aria-label="So sánh Free và Pro">
          <KinSectionHead title="Free và KiN Pro" />
          <div role="table" aria-label="So sánh Free và KiN Pro" data-testid="so-sanh" className="text-[length:var(--kin-co-goc)]">
            <div role="row" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-3 py-3 border-b border-[var(--kin-vien-nhat)] text-[var(--kin-chu-mo)]">
              <span role="columnheader">Hạng mục</span><span role="columnheader">{free.name}</span><span role="columnheader">{pro.name}</span>
            </div>
            {COMPARE(free, pro).map(r => (
              <div role="row" key={r.k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-3 py-3 border-b border-[var(--kin-vien-nhat)] leading-5">
                <span role="rowheader" className="font-medium text-[var(--kin-chu-chinh)]">{r.k}</span>
                <span role="cell" className="text-[var(--kin-chu-phu)]">{r.free}</span>
                <span role="cell" className="text-[var(--kin-chu-phu)]">{r.pro}{r.building && <> <KinStatus tone="mo" className="!whitespace-normal">đang dựng</KinStatus></>}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[length:var(--kin-co-small)] leading-5 text-[var(--kin-chu-mo)]">
            Mục ghi “đang dựng” chưa dùng được trên KiN; KiN không bán cái chưa có.
          </p>
        </section>

        <section aria-label="Mua KiN Pro" data-testid="mua-goi">
          <KinSectionHead title={plan.isPro ? "Gia hạn KiN Pro" : "Mở KiN Pro"} />
          {!sale.open ? (
            <div className="mt-4">
              <KinCallout title={<span data-testid="chua-mo-ban">Chưa mở bán</span>}>
                KiN chưa nhận thanh toán gói. Khi mở bán, bạn sẽ thấy giá và mã chuyển khoản ngay tại đây. Hiện bạn dùng KiN như bình thường.
              </KinCallout>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {PERIODS.map(p => {
                  const list = pro[p.priceKey];
                  const price = view.foundingPct > 0 ? Math.round(list * (100 - view.foundingPct) / 100) : list;
                  return (
                    <div key={p.key} data-testid={`ky-${p.key}`} className="flex flex-col gap-2 p-4 rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-nhat)]">
                      <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{p.label}</p>
                      <p className="text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{vnd(price)}</p>
                      {view.foundingPct > 0 && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Giá sáng lập −{view.foundingPct}%, giá thường {vnd(list)}</p>}
                      {p.months > 1 && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Quy ra {vnd(Math.round(price / p.months))} mỗi tháng</p>}
                      <KinButton variant={pending?.period === p.key ? "secondary" : "primary"} loading={busy === p.key} loadingLabel="Đang tạo…" disabled={!!busy} onClick={() => void buy(p.key)}>
                        {pending?.period === p.key ? "Xem lại mã chuyển khoản" : plan.isPro ? "Gia hạn kỳ này" : "Chọn kỳ này"}
                      </KinButton>
                    </div>
                  );
                })}
              </div>
              {view.foundingPct > 0 && <p className="mt-3 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Giá sáng lập dành cho những người mua đầu tiên và được giữ trong thời hạn đã cấu hình.</p>}
              <p className="mt-3 text-[length:var(--kin-co-small)] leading-5 text-[var(--kin-chu-mo)]">
                Trả theo kỳ, không tự động trừ tiền, không dùng Coin. Gia hạn thì cộng thêm vào hạn đang có.
              </p>
            </>
          )}
          <p role="status" className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]" data-testid="thong-bao">{msg}</p>

          {sale.open && pending && (
            <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] p-4 rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-thuong)]" data-testid="khung-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pending.qrUrl} alt={`Mã QR chuyển ${vnd(pending.priceVnd)} với nội dung ${pending.memoCode}`} width={220} height={220} className="w-[220px] h-auto max-w-full" />
              <dl className="space-y-3 text-[length:var(--kin-co-goc)]">
                <div><dt className="text-[var(--kin-chu-mo)]">Số tiền</dt><dd className="font-medium tabular-nums text-[var(--kin-chu-chinh)]" data-testid="qr-so-tien">{vnd(pending.priceVnd)}</dd></div>
                <div><dt className="text-[var(--kin-chu-mo)]">Ngân hàng · chủ tài khoản</dt><dd className="text-[var(--kin-chu-chinh)]">{pending.account.bankName} · {pending.account.accountName}</dd></div>
                <div className="flex items-center gap-2"><div><dt className="text-[var(--kin-chu-mo)]">Số tài khoản</dt><dd className="font-mono text-[var(--kin-chu-chinh)]" data-testid="qr-so-tk">{pending.account.accountNo}</dd></div>
                  <KinCopyButton text={pending.account.accountNo} label="Chép số tài khoản" appearance="icon" /></div>
                <div className="flex items-center gap-2"><div><dt className="text-[var(--kin-chu-mo)]">Nội dung chuyển khoản (giữ đúng)</dt><dd className="font-mono text-[var(--kin-chu-chinh)]" data-testid="qr-noi-dung">{pending.memoCode}</dd></div>
                  <KinCopyButton text={pending.memoCode} label="Chép nội dung chuyển khoản" appearance="icon" /></div>
                <p className="leading-5 text-[var(--kin-chu-phu)]">
                  Sau khi chuyển, người của KiN đối chiếu sao kê rồi mở Pro cho bạn. Việc này làm bằng tay nên chưa tự động; hạn Pro tính từ lúc được mở.
                </p>
              </dl>
            </div>
          )}
        </section>

        {view.orders.length > 0 && (
          <section aria-label="Lịch sử mua gói">
            <KinSectionHead title="Lịch sử" />
            <ul className="divide-y divide-[var(--kin-vien-nhat)]" data-testid="lich-su">
              {view.orders.map(o => {
                const st = STATUS_TEXT[o.status] ?? STATUS_TEXT.cancelled;
                return (
                  <li key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-[length:var(--kin-co-goc)]">
                    <span className="text-[var(--kin-chu-chinh)]">{o.source === "legacy_grant" ? "Pro tặng cho người dùng hiện có" : `Pro ${PERIOD_TEXT[o.period] ?? o.period}`}
                      <span className="text-[var(--kin-chu-mo)]">{o.status === "active" && o.endDate ? ` · tới ${fmtDate(o.endDate)}` : ` · tạo ${fmtDate(o.createdAt)}`}</span></span>
                    <KinStatus tone={st.tone}>{st.text}</KinStatus>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <KinCallout title="Khi hết hạn Pro">
          Bạn về gói Free. Lớp, phiếu, điểm danh và lịch sử giữ nguyên 100%, không ẩn, không xoá. Học viên đang có vẫn học bình thường (kể cả vượt hạn mức Free); chỉ chưa
          thêm được học viên mới. Sổ của con, phiếu cho phụ huynh và xuất dữ liệu luôn mở. Học viên bấm mã mời khi lớp tạm chưa nhận thêm chỉ thấy “Lớp tạm chưa nhận thêm”.
        </KinCallout>
      </div>
    </KinPage>
  );
}

// Bảng so sánh theo tài liệu mục 8.4. Con số (học viên, lượt AI) lấy từ cấu hình; mục chưa dựng thì ghi rõ “đang dựng”.
function COMPARE(free: PlanConfigRow, pro: PlanConfigRow): { k: string; free: string; pro: string; building?: boolean }[] {
  return [
    { k: "Học viên đang học", free: `Tối đa ${free.studentLimit}`, pro: "Không giới hạn thực tế" },
    { k: "Lõi sổ lớp: lớp, lịch, điểm danh, học phí, phiếu + QR, mã mời, hồ sơ công khai", free: "Đầy đủ", pro: "Đầy đủ" },
    { k: "Sổ của con, phiếu cho phụ huynh", free: "Luôn mở", pro: "Như Free" },
    { k: "Nhắc học phí", free: "Bước 1: tin soạn sẵn, mở Zalo; công nợ và phiếu quá hạn luôn hiện", pro: "Thêm bước 2–3, lịch sử nhắc theo phiếu, gợi ý thời điểm nhắc", building: true },
    { k: "Báo cáo tháng và phiếu", free: "Tạo, duyệt, gửi bằng link; mẫu mặc định KiN", pro: "Logo, tên, màu, chữ ký; bản in/PDF; nhiều mẫu phiếu", building: true },
    { k: "Xuất dữ liệu", free: "CSV doanh thu, điểm danh, toàn bộ dữ liệu của bạn", pro: "Như Free, thêm mẫu PDF có thương hiệu", building: true },
    { k: "Thống kê", free: "Sáu chỉ số cơ bản, doanh thu theo lớp và tháng", pro: "Xu hướng chuyên cần, cảnh báo vắng liên tiếp, so sánh lớp", building: true },
    { k: "Thông báo đẩy", free: "Báo nghỉ sát giờ; khoản tiền chưa khớp", pro: "Thêm phiếu quá hạn, chưa điểm danh", building: true },
    { k: "AI trích đề", free: `${free.aiExtractPerMonth} lượt mỗi tháng`, pro: `${pro.aiExtractPerMonth} lượt mỗi tháng` },
    { k: "Hỗ trợ", free: "Nhóm Zalo / email", pro: "Hàng đợi ưu tiên", building: true },
  ];
}
