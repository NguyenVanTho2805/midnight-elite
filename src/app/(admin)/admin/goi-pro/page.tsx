// KiN Pro — cấu hình gói (admin_super, quyền MANAGE_REVENUE): hạn mức, giá, cài đặt tặng Pro / giá sáng lập, số đo "đếm bóng", danh sách yêu cầu mua và nút kích hoạt.
// Thu theo kỳ bằng QR chuyển khoản; admin đối chiếu sao kê rồi bấm kích hoạt (cộng dồn hạn, ghi audit). KHÔNG Coin, KHÔNG tự động trừ tiền.
// Công tắc cưỡng chế là biến môi trường KIN_PLAN_ENFORCE (đặt trên máy chủ), trang này chỉ HIỆN trạng thái, không bật tắt được.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinCallout, KinSectionHead, KinSkeleton, KinStat, KinStatRow, KinStateCard, KinStatus, useKinConfirm } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { callApi, vnd } from "@/components/tutor/shared";
import type { PlanConfigRow, PlanSettings, QuotaState } from "@/lib/planLimits";

interface AdminOrder {
  id: string; userName: string; userEmail: string; period: string; status: string; source: string; priceVnd: number; listPriceVnd: number;
  foundingDiscountPct: number; memoCode: string; durationDays: number; startDate: string | null; endDate: string | null; createdAt: string; bankRef: string | null;
}
interface AdminPayment { id: string; amount: number; content: string; matchedCode: string | null; orderId: string | null; providerTxId: string; reason: string | null; reasonText: string; occurredAt: string; createdAt: string }
interface Payload {
  configs: { free: PlanConfigRow; pro: PlanConfigRow };
  settings: PlanSettings;
  defaults: PlanSettings;
  enforced: boolean;
  sale: { open: boolean; reason: string | null; prefix: string; configured: boolean };
  measure: { freeLimit: number; tutors: number; byState: Record<QuotaState, number>; maxStudents: number; shadowWouldBlock30d: number; enforcedBlocked30d: number; aiExtractThisMonth: number; proNow: number };
  webhook: { enabled: boolean; reason: string | null };
  payments: AdminPayment[];
  orders: AdminOrder[];
}

const SALE_REASON: Record<string, string> = {
  "no-config": "Chưa đặt tài khoản nhận tiền (KINPRO_BANK_BIN, KINPRO_ACCOUNT_NO, KINPRO_ACCOUNT_NAME)",
  preview: "Đang là bản xem trước: không bán gói ở đây",
  trial: "Cờ chạy thử đang bật: KiN miễn phí giai đoạn chạy thử",
};
const HOOK_REASON: Record<string, string> = {
  "no-key": "Chưa đặt khoá KINPRO_SEPAY_API_KEY (từ 16 ký tự)",
  "no-config": "Chưa đặt tài khoản nhận tiền KINPRO_*",
  preview: "Bản xem trước: webhook tắt",
  "prefix-clash": "Tiền tố mã dễ nhầm với mã phiếu học phí (KIN + 5 ký tự), hãy đổi KINPRO_CODE_PREFIX",
};
const PERIOD_TEXT: Record<string, string> = { month: "1 tháng", quarter: "3 tháng", year: "12 tháng", grant: "Tặng" };
const STATUS: Record<string, { tone: "xong" | "cho" | "mo"; text: string }> = {
  pending: { tone: "cho", text: "Đang chờ đối chiếu" }, active: { tone: "xong", text: "Đã kích hoạt" }, cancelled: { tone: "mo", text: "Đã huỷ" },
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export default function GoiProPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_REVENUE}>
      <GoiProContent />
    </PermissionGuard>
  );
}

const FIELD = "block w-full mt-1 px-3 min-h-[44px] rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-goc)] bg-[var(--kin-nen-trang)] border border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-chinh)]";

function NumField({ label, value, onChange, testid }: { label: string; value: number; onChange: (n: number) => void; testid: string }) {
  return (
    <label className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{label}
      <input type="number" inputMode="numeric" min={0} value={Number.isFinite(value) ? value : 0} data-testid={testid} className={FIELD}
        onChange={e => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
    </label>
  );
}

function GoiProContent() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [free, setFree] = useState<PlanConfigRow | null>(null);
  const [pro, setPro] = useState<PlanConfigRow | null>(null);
  const [set, setSet] = useState<PlanSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const { ask, dialog } = useKinConfirm();

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>("/api/admin/pro");
    if (!r.ok) setFailed(true);
    else { setData(r.data); setFree(r.data.configs.free); setPro(r.data.configs.pro); setSet(r.data.settings); }
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save() {
    if (!free || !pro || !set) return;
    setBusy("save"); setMsg(null);
    const r = await callApi("/api/admin/pro/config", { method: "PUT", body: JSON.stringify({ plans: [free, pro], settings: set }) });
    setBusy(null);
    if (!r.ok) { setMsg(r.data.error ?? "Không lưu được"); return; }
    setMsg("Đã lưu cấu hình. Giá mới chỉ áp cho yêu cầu tạo từ bây giờ; yêu cầu đã tạo giữ giá đã chụp.");
    void load();
  }
  async function act(o: AdminOrder, action: "activate" | "cancel") {
    const ok = await ask(action === "activate"
      ? { title: "Kích hoạt Pro cho yêu cầu này?", message: `${o.userName} · ${PERIOD_TEXT[o.period]} · ${vnd(o.priceVnd)} · nội dung ${o.memoCode}. Chỉ bấm khi đã thấy tiền về đúng số và đúng nội dung trong sao kê. Hạn được cộng dồn vào hạn đang có.`, confirmLabel: "Kích hoạt", tone: "thuong" }
      : { title: "Huỷ yêu cầu này?", message: `${o.userName} · ${o.memoCode}. Yêu cầu bị huỷ không mở Pro.`, confirmLabel: "Huỷ yêu cầu" });
    if (!ok) return;
    setBusy(o.id); setMsg(null);
    const body = JSON.stringify({ bankRef: refs[o.id] ?? "" });
    const r = action === "activate"
      ? await callApi(`/api/admin/pro/orders/${o.id}/activate`, { method: "POST", body })
      : await callApi(`/api/admin/pro/orders/${o.id}/cancel`, { method: "POST", body });
    setBusy(null);
    setMsg(r.ok ? (action === "activate" ? "Đã kích hoạt và cộng dồn hạn." : "Đã huỷ yêu cầu.") : (r.data.error ?? "Không thực hiện được"));
    void load();
  }
  async function resolvePayment(p: AdminPayment) {
    const ok = await ask({ title: "Đánh dấu đã xử lý khoản này?", message: `${vnd(p.amount)} · giao dịch ${p.providerTxId}. Việc này chỉ đổi nhãn trong sổ: KiN không hoàn tiền và không kích hoạt gì. Chỉ bấm khi bạn đã xử lý xong ở ngân hàng hoặc đã kích hoạt tay.`, confirmLabel: "Đã xử lý", tone: "thuong" });
    if (!ok) return;
    setBusy(p.id); setMsg(null);
    const r = await callApi(`/api/admin/pro/payments/${p.id}/resolve`, { method: "POST" });
    setBusy(null);
    setMsg(r.ok ? "Đã đánh dấu đã xử lý." : (r.data.error ?? "Không thực hiện được"));
    void load();
  }
  async function grant() {
    const ok = await ask({ title: "Tặng Pro cho mọi gia sư hiện có?", message: `Mỗi gia sư được tặng ${data?.settings.legacyTrialDays ?? 0} ngày Pro, một lần. Không có tiền đi qua. Quyền đang có của họ không thay đổi.`, confirmLabel: "Tặng Pro", tone: "thuong" });
    if (!ok) return;
    setBusy("grant"); setMsg(null);
    const r = await callApi<{ granted: number; skipped: number; days: number }>("/api/admin/pro/grant-legacy", { method: "POST" });
    setBusy(null);
    setMsg(r.ok ? `Đã tặng ${r.data.days} ngày Pro cho ${r.data.granted} gia sư (${r.data.skipped} người đã được tặng trước đó).` : (r.data.error ?? "Không thực hiện được"));
    void load();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <header className="min-w-0">
        <h1 className="text-[28px] leading-9 font-medium text-[var(--kin-chu-chinh)]">Gói KiN Pro</h1>
        <p className="mt-2 max-w-[68ch] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          Hạn mức, giá và yêu cầu mua. Thu theo kỳ bằng QR chuyển khoản, bạn đối chiếu sao kê rồi kích hoạt; không Coin, không tự động trừ tiền.
        </p>
      </header>

      {loading && !data ? (
        <KinStateCard busy kicker="Đang tải" title="Đang tải cấu hình gói"><KinSkeleton className="mt-2" /></KinStateCard>
      ) : failed || !data || !free || !pro || !set ? (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được cấu hình gói"
          status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
          actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}>
          <p>Không tải được. Dữ liệu trên hệ thống không bị mất.</p>
        </KinStateCard>
      ) : (
        <>
          <KinStatRow>
            <KinStat label="Cổng hạn mức" value={<span data-testid="cong">{data.enforced ? "Đang BẬT" : "Đang TẮT"}</span>}
              hint={data.enforced ? "Chỉ chặn tạo mới" : "Không ai bị chặn, chỉ đếm bóng để đo"} />
            <KinStat label="Bán gói" value={<span data-testid="ban">{data.sale.open ? "Đang mở" : "Chưa mở bán"}</span>}
              hint={data.sale.open ? `Tiền tố mã ${data.sale.prefix}` : (data.sale.reason ? SALE_REASON[data.sale.reason] : undefined)} />
            <KinStat label="Tự kích hoạt (SePay)" value={<span data-testid="hook">{data.webhook.enabled ? "Đang bật" : "Đang tắt"}</span>}
              hint={data.webhook.enabled ? "Đúng mã và đúng số tiền thì tự cộng hạn" : (data.webhook.reason ? HOOK_REASON[data.webhook.reason] : undefined)} />
            <KinStat label="Gia sư đang Pro" value={data.measure.proNow} hint={`Trên ${data.measure.tutors} gia sư`} />
            <KinStat label="Lượt AI trích đề tháng này" value={data.measure.aiExtractThisMonth} hint="Tổng, không có tên người" />
          </KinStatRow>

          <KinCallout title="Cách bật cưỡng chế">
            Đặt biến môi trường <b>KIN_PLAN_ENFORCE=1</b> trên máy chủ rồi triển khai lại. Để trống hoặc khác “1” là TẮT. Bản xem trước luôn tắt. Đặt tài khoản nhận tiền bằng
            KINPRO_BANK_BIN, KINPRO_ACCOUNT_NO, KINPRO_ACCOUNT_NAME (và tuỳ chọn KINPRO_CODE_PREFIX). Thiếu thì màn Gói ghi “Chưa mở bán”. Muốn tự kích hoạt khi tiền về, đặt thêm KINPRO_SEPAY_API_KEY (khoá API ở SePay, từ 16 ký tự) và trỏ webhook SePay tới /api/webhooks/sepay-pro.
          </KinCallout>

          <section aria-label="Số đo">
            <KinSectionHead title="Đo trước, thu sau" aside={`Nếu áp trần Free ${data.measure.freeLimit} cho mọi gia sư`} />
            <KinStatRow className="mt-4">
              <KinStat label="Còn thoải mái" value={<span data-testid="do-ok">{data.measure.byState.ok}</span>} hint="Dưới 80% hạn mức" />
              <KinStat label="Gần hạn mức" value={<span data-testid="do-warn">{data.measure.byState.warn}</span>} hint="Từ 80%" />
              <KinStat label="Đạt hạn mức" value={<span data-testid="do-blocked">{data.measure.byState.blocked}</span>} hint="Bằng đúng trần" />
              <KinStat label="Vượt hạn mức" value={<span data-testid="do-over">{data.measure.byState.over}</span>} hint={`Nhiều nhất ${data.measure.maxStudents} học viên`} />
            </KinStatRow>
            <p className="mt-3 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
              30 ngày qua: cổng tắt nhưng sẽ chặn {data.measure.shadowWouldBlock30d} lần; cổng bật và đã chặn {data.measure.enforcedBlocked30d} lần.
            </p>
          </section>

          <section aria-label="Cấu hình">
            <KinSectionHead title="Hạn mức và giá" />
            <div className="mt-4 grid gap-8 md:grid-cols-2">
              {[{ c: free, set: setFree, k: "free" }, { c: pro, set: setPro, k: "pro" }].map(({ c, set: setC, k }) => (
                <fieldset key={k} className="space-y-3 min-w-0">
                  <legend className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)] pb-2">{c.name}</legend>
                  <NumField label={k === "pro" ? "Trần học viên (chống lạm dụng)" : "Học viên đang học tối đa"} value={c.studentLimit} testid={`${k}-hoc-vien`} onChange={n => setC({ ...c, studentLimit: n })} />
                  <NumField label="Lượt AI trích đề mỗi tháng" value={c.aiExtractPerMonth} testid={`${k}-ai`} onChange={n => setC({ ...c, aiExtractPerMonth: n })} />
                  {k === "pro" && (
                    <>
                      <NumField label="Giá 1 tháng (đ)" value={c.priceMonthVnd} testid="pro-gia-thang" onChange={n => setC({ ...c, priceMonthVnd: n })} />
                      <NumField label="Giá 3 tháng (đ)" value={c.priceQuarterVnd} testid="pro-gia-quy" onChange={n => setC({ ...c, priceQuarterVnd: n })} />
                      <NumField label="Giá 12 tháng (đ)" value={c.priceYearVnd} testid="pro-gia-nam" onChange={n => setC({ ...c, priceYearVnd: n })} />
                    </>
                  )}
                </fieldset>
              ))}
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumField label="Số ngày Pro tặng gia sư hiện có" value={set.legacyTrialDays} testid="cd-tang" onChange={n => setSet({ ...set, legacyTrialDays: n })} />
              <NumField label="Giá sáng lập: giảm (%)" value={set.foundingDiscountPct} testid="cd-giam" onChange={n => setSet({ ...set, foundingDiscountPct: n })} />
              <NumField label="Số suất giá sáng lập" value={set.foundingSlots} testid="cd-suat" onChange={n => setSet({ ...set, foundingSlots: n })} />
              <NumField label="Khoá giá sáng lập (tháng)" value={set.foundingMonths} testid="cd-thang" onChange={n => setSet({ ...set, foundingMonths: n })} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <KinButton loading={busy === "save"} loadingLabel="Đang lưu…" onClick={() => void save()} data-testid="luu-cau-hinh">Lưu cấu hình</KinButton>
              <KinButton variant="secondary" loading={busy === "grant"} loadingLabel="Đang tặng…" onClick={() => void grant()} data-testid="tang-pro">Tặng Pro cho gia sư hiện có</KinButton>
            </div>
          </section>

          <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]" data-testid="thong-bao">{msg}</p>

          <section aria-label="Khoản tiền cần duyệt tay">
            <KinSectionHead title="Khoản tiền cần duyệt tay" aside={`${data.payments.length} khoản`} />
            {data.payments.length === 0 ? (
              <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-testid="tien-rong">Không có khoản nào. Tiền về đúng mã và đúng số thì tự kích hoạt; sai số tiền, sai mã hoặc đã kích hoạt rồi thì hiện ở đây để bạn đối chiếu. KiN không tự hoàn tiền.</p>
            ) : (
              <ul className="divide-y divide-[var(--kin-vien-nhat)]" data-testid="tien-cho-duyet">
                {data.payments.map(p => (
                  <li key={p.id} data-payment={p.id} data-reason={p.reason ?? ""} className="py-4 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center text-[length:var(--kin-co-goc)]">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--kin-chu-chinh)] tabular-nums">{vnd(p.amount)} <span className="font-normal text-[var(--kin-chu-mo)]">· về lúc {fmt(p.occurredAt)}</span></p>
                      <p className="text-[var(--kin-chu-mo)] break-words">{p.content || "Không có nội dung"}</p>
                    </div>
                    <div className="min-w-0">
                      <KinStatus tone="cho">{p.reasonText}</KinStatus>
                      <p className="mt-1 font-mono text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] break-all">{p.matchedCode ?? "Không có mã"}</p>
                    </div>
                    <KinButton variant="secondary" disabled={busy === p.id} onClick={() => void resolvePayment(p)} data-testid={`da-xu-ly-${p.providerTxId}`}>Đã xử lý</KinButton>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Yêu cầu mua">
            <KinSectionHead title="Yêu cầu mua Pro" aside={`${data.orders.filter(o => o.status === "pending").length} đang chờ`} />
            {data.orders.length === 0 ? (
              <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-testid="rong">Chưa có yêu cầu nào. Khi gia sư chọn kỳ ở mục Gói của tôi, yêu cầu sẽ hiện ở đây kèm nội dung chuyển khoản để bạn đối chiếu sao kê.</p>
            ) : (
              <ul className="divide-y divide-[var(--kin-vien-nhat)]" data-testid="yeu-cau">
                {data.orders.map(o => {
                  const st = STATUS[o.status] ?? STATUS.cancelled;
                  return (
                    <li key={o.id} data-order={o.id} data-status={o.status} className="py-4 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center text-[length:var(--kin-co-goc)]">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--kin-chu-chinh)] break-words">{o.userName} <span className="font-normal text-[var(--kin-chu-mo)]">{o.userEmail}</span></p>
                        <p className="text-[var(--kin-chu-mo)]">{o.source === "legacy_grant" ? "Tặng cho người dùng hiện có" : `Pro ${PERIOD_TEXT[o.period] ?? o.period}`} · tạo {fmt(o.createdAt)}
                          {o.endDate ? ` · tới ${fmt(o.endDate)}` : ""}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-[var(--kin-chu-chinh)] break-all">{o.memoCode}</p>
                        <p className="tabular-nums text-[var(--kin-chu-phu)]">{vnd(o.priceVnd)}{o.foundingDiscountPct > 0 ? ` (giá sáng lập −${o.foundingDiscountPct}%, giá thường ${vnd(o.listPriceVnd)})` : ""}</p>
                        <KinStatus tone={st.tone}>{st.text}</KinStatus>
                      </div>
                      {o.status === "pending" && (
                        <div className="flex flex-col gap-2 md:items-end">
                          <input aria-label={`Mã giao dịch ngân hàng (tuỳ chọn) cho ${o.memoCode}`} placeholder="Mã giao dịch ngân hàng (tuỳ chọn)" value={refs[o.id] ?? ""}
                            onChange={e => setRefs(m => ({ ...m, [o.id]: e.target.value }))} className={FIELD + " md:w-64"} />
                          <div className="flex gap-2">
                            <KinButton disabled={busy === o.id} onClick={() => void act(o, "activate")} data-testid={`kich-hoat-${o.memoCode}`}>Kích hoạt</KinButton>
                            <KinButton variant="secondary" disabled={busy === o.id} onClick={() => void act(o, "cancel")}>Huỷ</KinButton>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
      {dialog}
    </div>
  );
}
