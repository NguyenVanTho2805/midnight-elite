// FE-137 — doanh thu nền tảng theo sổ Coin thật (BE-074/075).
// Doanh thu = Coin gia sư trả để mua VIP (1 Coin = 1 VND). Học viên học miễn
// phí và học phí đi thẳng từ phụ huynh sang gia sư qua VietQR — KiN không giữ
// tiền nên các khoản đó không xuất hiện ở đây.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChartBar, ClipboardList } from "griddy-icons";
import PermissionGuard from "@/components/PermissionGuard";
import RevenueByTutorTable, { type TutorRevenueRow } from "@/components/admin/RevenueByTutorTable";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { formatVnd, presetRange, toCsv, vnDateKey } from "@/lib/revenue";

interface Analytics {
  range: { from: string | null; toExclusive: string | null };
  totals: {
    vipRevenue: number; refunds: number; netVipRevenue: number; topupTotal: number;
    vipPurchases: number; activeVipTutors: number; tutorCount: number;
    classCount: number; activeStudents: number; coinOutstanding: number;
  };
  byMonth: { month: string; vipRevenue: number; vipCount: number; topup: number }[];
  byPlan:  { planCode: string; name: string; count: number; revenue: number }[];
  byTutor: TutorRevenueRow[];
  transactions: { id: string; tutorId: string; tutorName: string; planCode: string; amount: number; createdAt: string }[];
}

const CARD = { background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px var(--kin-nen-trang)" } as const;

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div role="status" className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
      style={{ background: ok ? "#16a34a" : "#dc2626" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

export default function DoanhThuPage() {
  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  // Mỗi lần tải tăng số thứ tự; kết quả của request cũ (về chậm hơn request mới
  // khi người dùng đổi ngày liên tục) bị bỏ, không ghi đè trạng thái mới.
  const reqSeq = useRef(0);
  const rangeInvalid = !!from && !!to && from > to;

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async (f: string, t: string) => {
    await Promise.resolve();
    const seq = ++reqSeq.current;
    setLoading(true); setFailed(false);
    try {
      const qs = new URLSearchParams();
      if (f) qs.set("from", f);
      if (t) qs.set("to", t);
      const r = await fetch(`/api/admin/analytics${qs.size ? `?${qs}` : ""}`, { credentials: "same-origin" });
      const d = await r.json().catch(() => ({}));
      if (seq !== reqSeq.current) return; // đã có request mới hơn
      if (!r.ok) { setFailed(true); showToast(d.error ?? "Lỗi tải dữ liệu doanh thu", false); return; }
      setData(d);
    } catch {
      if (seq === reqSeq.current) { setFailed(true); showToast("Lỗi kết nối, thử lại sau", false); }
    } finally { if (seq === reqSeq.current) setLoading(false); }
  }, [showToast]);

  useEffect(() => {
    if (rangeInvalid) { reqSeq.current++; return; } // không gửi khoảng ngày đảo ngược; bỏ request đang bay
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(from, to);
  }, [load, from, to, rangeInvalid]);

  function preset(kind: "month" | "30d" | "all") {
    const r = presetRange(kind, new Date());
    setFrom(r.from); setTo(r.to);
  }

  const monthMax = useMemo(() => Math.max(...(data?.byMonth ?? []).map(m => m.vipRevenue), 1), [data]);
  const planMax  = useMemo(() => Math.max(...(data?.byPlan ?? []).map(p => p.revenue), 1), [data]);
  const rangeLabel = from || to ? `${from || "…"} → ${to || "nay"}` : "Toàn thời gian";

  function download(name: string, rows: Array<Array<string | number>>) {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function exportTransactions() {
    if (!data) return;
    download(`doanh-thu-vip-${vnDateKey(new Date())}.csv`, [
      ["Gia sư", "Gói", "Số tiền (đ)", "Ngày mua (giờ VN)"],
      ...data.transactions.map(t => [t.tutorName, data.byPlan.find(p => p.planCode === t.planCode)?.name ?? t.planCode, t.amount, vnDateKey(new Date(t.createdAt))]),
    ]);
    showToast(`Đã xuất ${data.transactions.length} giao dịch`);
  }
  function exportTutors() {
    if (!data) return;
    download(`doanh-thu-theo-gia-su-${vnDateKey(new Date())}.csv`, [
      ["Gia sư", "Email", "Số lớp", "Số học viên", "VIP đã trả (đ)", "Số lần mua", "VIP đến"],
      ...data.byTutor.map(t => [t.name, t.email, t.classes, t.students, t.vipRevenue, t.vipPurchases, t.vipUntil ? vnDateKey(new Date(t.vipUntil)) : ""]),
    ]);
    showToast(`Đã xuất ${data.byTutor.length} gia sư`);
  }

  const T = data?.totals;
  const cards = [
    { label: "Doanh thu VIP (ròng)", value: T ? formatVnd(T.netVipRevenue) : "—", sub: T ? `${T.vipPurchases} lượt mua${T.refunds ? ` · hoàn ${formatVnd(T.refunds)}` : ""}` : "", color: "var(--kin-nhan-link)" },
    { label: "Gia sư đang VIP", value: T ? `${T.activeVipTutors}/${T.tutorCount}` : "—", sub: "trên tổng số gia sư đã duyệt", color: "#00A63D" },
    { label: "Coin đã nạp", value: T ? formatVnd(T.topupTotal) : "—", sub: "trong khoảng đã chọn", color: "#0EA5E9" },
    { label: "Coin đang trong ví", value: T ? formatVnd(T.coinOutstanding) : "—", sub: "toàn bộ người dùng, tại thời điểm xem", color: "#FE9900" },
  ];

  return (
    <PermissionGuard required={PERMISSIONS.VIEW_REVENUE}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <div className="space-y-6 overflow-y-auto" style={{ height: "calc(100vh - 104px)" }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Doanh thu</h1>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: "#6B7280" }}>
              Doanh thu là Coin gia sư trả để mua gói VIP (1 Coin = 1 VND). Học phí phụ huynh chuyển thẳng cho gia sư qua VietQR, KiN không giữ nên không tính ở đây.
            </p>
          </div>
          <button onClick={() => load(from, to)}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 active:scale-[0.97]"
            style={{ background: "#F0F5FF", boxShadow: "4px 4px 8px #C5D0EA,-4px -4px 8px var(--kin-nen-trang)", color: "var(--kin-nhan-link)" }}>
            ↺ Tải lại
          </button>
        </div>

        {/* Khoảng ngày */}
        <div className="flex items-end gap-3 flex-wrap" role="group" aria-label="Khoảng thời gian">
          <label className="text-xs" style={{ color: "#6B7280" }}>Từ ngày
            <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
              className="block mt-1 px-3 py-1.5 rounded-xl text-sm outline-none" style={{ background: "#fff", border: "1px solid #C5D0EA", color: "#1E2938" }} />
          </label>
          <label className="text-xs" style={{ color: "#6B7280" }}>Đến ngày
            <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
              className="block mt-1 px-3 py-1.5 rounded-xl text-sm outline-none" style={{ background: "#fff", border: "1px solid #C5D0EA", color: "#1E2938" }} />
          </label>
          {([["month", "Tháng này"], ["30d", "30 ngày"], ["all", "Tất cả"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => preset(k)} className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
              style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA,-3px -3px 6px var(--kin-nen-trang)", color: "var(--kin-nhan-link)" }}>{l}</button>
          ))}
          <span className="text-xs pb-2" style={{ color: "#6B7280" }}>Đang xem: {rangeLabel} (giờ Việt Nam)</span>
        </div>
        {rangeInvalid && (
          <p role="alert" className="text-sm font-medium" style={{ color: "#B91C1C" }}>
            Ngày bắt đầu phải trước hoặc bằng ngày kết thúc. Số liệu bên dưới là của khoảng trước đó.
          </p>
        )}

        {failed ? (
          <div role="alert" className="rounded-2xl p-8 text-center text-sm" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
            Không tải được dữ liệu doanh thu.{" "}
            <button className="underline font-semibold cursor-pointer" onClick={() => load(from, to)}>Thử lại</button>
          </div>
        ) : (<>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(c => (
              <div key={c.label} className="rounded-2xl p-5" style={CARD}>
                <div className="text-xs mb-2" style={{ color: "#6B7280" }}>{c.label}</div>
                {loading ? <div className="h-8 w-24 rounded animate-pulse mb-1" style={{ background: "#E2E8F4" }} />
                  : <div className="text-xl lg:text-2xl font-extrabold mb-1 break-words" style={{ color: c.color }}>{c.value}</div>}
                <div className="text-xs" style={{ color: "#6B7280" }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-2xl p-6" style={CARD} aria-labelledby="h-month">
              <h2 id="h-month" className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: "#1E2938" }}><ChartBar size={18} /> Theo tháng</h2>
              {loading ? <div className="h-24 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
                : (data?.byMonth ?? []).length === 0 ? <p className="text-sm text-center py-6" style={{ color: "#6B7280" }}>Chưa có giao dịch trong khoảng này.</p>
                : <div className="space-y-3">
                    {data!.byMonth.map(m => (
                      <div key={m.month} className="flex items-center gap-3">
                        <div className="w-16 flex-shrink-0 text-xs font-mono" style={{ color: "#4B5563" }}>{m.month.slice(5)}/{m.month.slice(0, 4)}</div>
                        <div className="flex-1 h-2 rounded-full" style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px var(--kin-nen-trang)" }}>
                          <div className="h-2 rounded-full" style={{ width: `${(m.vipRevenue / monthMax * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#00A63D,#16a34a)" }} />
                        </div>
                        <div className="text-right flex-shrink-0 w-32">
                          <div className="text-sm font-bold" style={{ color: "#00A63D" }}>{formatVnd(m.vipRevenue)}</div>
                          <div className="text-xs" style={{ color: "#6B7280" }}>{m.vipCount} lượt · nạp {formatVnd(m.topup)}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
            </section>

            <section className="rounded-2xl p-6" style={CARD} aria-labelledby="h-plan">
              <h2 id="h-plan" className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: "#1E2938" }}><ChartBar size={18} /> Theo gói VIP</h2>
              {loading ? <div className="h-24 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
                : (data?.byPlan ?? []).length === 0 ? <p className="text-sm text-center py-6" style={{ color: "#6B7280" }}>Chưa có gói nào được mua.</p>
                : <div className="space-y-3">
                    {data!.byPlan.map(p => (
                      <div key={p.planCode} className="flex items-center gap-3">
                        <div className="w-28 flex-shrink-0 text-sm truncate" style={{ color: "#1E2938" }}>{p.name}</div>
                        <div className="flex-1 h-2 rounded-full" style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px var(--kin-nen-trang)" }}>
                          <div className="h-2 rounded-full" style={{ width: `${(p.revenue / planMax * 100).toFixed(1)}%`, background: "var(--kin-nhan-nen)" }} />
                        </div>
                        <div className="text-right flex-shrink-0 w-32">
                          <div className="text-sm font-bold" style={{ color: "var(--kin-nhan-link)" }}>{formatVnd(p.revenue)}</div>
                          <div className="text-xs" style={{ color: "#6B7280" }}>{p.count} lượt mua</div>
                        </div>
                      </div>
                    ))}
                  </div>}
            </section>
          </div>

          <section className="rounded-2xl p-6" style={CARD} aria-labelledby="h-tutor">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 id="h-tutor" className="text-base font-bold flex items-center gap-2" style={{ color: "#1E2938" }}><ClipboardList size={18} /> Theo từng gia sư</h2>
              <button onClick={exportTutors} disabled={!data || loading} className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA,-3px -3px 6px var(--kin-nen-trang)", color: "var(--kin-nhan-link)" }}>↓ Xuất CSV</button>
            </div>
            <RevenueByTutorTable rows={data?.byTutor ?? []} loading={loading} />
          </section>

          <section className="rounded-2xl p-6" style={CARD} aria-labelledby="h-tx">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 id="h-tx" className="text-base font-bold flex items-center gap-2" style={{ color: "#1E2938" }}><ClipboardList size={18} /> Lịch sử mua VIP</h2>
              <button onClick={exportTransactions} disabled={!data || loading || data.transactions.length === 0} className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA,-3px -3px 6px var(--kin-nen-trang)", color: "var(--kin-nhan-link)" }}>↓ Xuất CSV</button>
            </div>
            {loading ? <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-11 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />)}</div>
              : (data?.transactions ?? []).length === 0 ? <p className="text-center py-8 text-sm" style={{ color: "#6B7280" }}>Chưa có giao dịch nào.</p>
              : <ul className="space-y-2">
                  {data!.transactions.map(t => (
                    <li key={t.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 5px #C5D0EA,inset -2px -2px 5px var(--kin-nen-trang)" }}>
                      <span className="col-span-5 font-medium truncate" style={{ color: "#1E2938" }}>{t.tutorName}</span>
                      <span className="col-span-3 text-xs" style={{ color: "#4B5563" }}>{data!.byPlan.find(p => p.planCode === t.planCode)?.name ?? t.planCode}</span>
                      <span className="col-span-2 text-right font-bold tabular-nums" style={{ color: "var(--kin-nhan-link)" }}>{formatVnd(t.amount)}</span>
                      <span className="col-span-2 text-right text-xs" style={{ color: "#6B7280" }}>{vnDateKey(new Date(t.createdAt))}</span>
                    </li>
                  ))}
                </ul>}
          </section>
        </>)}
      </div>
    </PermissionGuard>
  );
}
