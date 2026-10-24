"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { KinButton, kinButtonClass, KinMoney, KinMoneyEye } from "@/components/kin";
import AdvancedAttendanceStats from "@/components/tutor/AdvancedAttendanceStats";
import RevenueByClassTable, { type ClassRevenueRow } from "@/components/tutor/RevenueByClassTable";
import { CARD_STYLE, FIELD_STYLE, callApi, vnd } from "@/components/tutor/shared";
import { presetRange, vnDateKey } from "@/lib/revenue";

interface Data {
  totals: { collected: number; txCount: number; receivable: number; openInvoices: number; draftAmount: number; draftCount: number; sentDue: number; sentPaid: number; sentCount: number; collectionRatePct: number | null };
  byMonth: { month: string; collected: number; count: number }[];
  byClass: ClassRevenueRow[];
  transactions: { id: string; date: string; studentName: string; code: string; yearMonth: string; method: string; amount: number }[];
}

export default function DoanhThuClient() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  const invalid = !!from && !!to && from > to;

  const qs = useMemo(() => { const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); return p.toString(); }, [from, to]);

  const load = useCallback(async (query: string) => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Data>(`/api/users/me/revenue${query ? `?${query}` : ""}`);
    if (my !== seq.current) return; // bỏ kết quả cũ
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (invalid) { seq.current++; return; } // không gửi khoảng ngày đảo ngược
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(qs);
  }, [load, qs, invalid]);

  const monthMax = Math.max(...(data?.byMonth ?? []).map(m => m.collected), 1);
  const csvHref = `/api/users/me/revenue?${new URLSearchParams([...new URLSearchParams(qs), ["format", "csv"]]).toString()}`;
  const preset = (k: "month" | "30d" | "all") => { const r = presetRange(k, new Date()); setFrom(r.from); setTo(r.to); };

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3 flex-wrap" role="group" aria-label="Khoảng thời gian">
        <label className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Từ ngày
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
        </label>
        <label className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Đến ngày
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
        </label>
        {([["month", "Tháng này"], ["30d", "30 ngày"], ["all", "Tất cả"]] as const).map(([k, l]) => (
          <KinButton key={k} variant="secondary" onClick={() => preset(k)}>{l}</KinButton>
        ))}
        <a href={csvHref} download className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium min-h-[44px]"
          style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>↓ Xuất CSV</a>
        <KinMoneyEye className="ml-auto" />
      </div>
      {invalid && <p role="alert" className="text-sm font-medium" style={{ color: "var(--kin-tt-chu-loi)" }}>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}

      {failed ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>
          Không tải được doanh thu. <button className="underline font-semibold" onClick={() => load(qs)}>Thử lại</button>
        </div>
      ) : (<>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            ["Đã thu", data ? <KinMoney>{vnd(data.totals.collected)}</KinMoney> : "—", data ? `${data.totals.txCount} khoản` : ""],
            ["Còn phải thu", data ? <KinMoney>{vnd(data.totals.receivable)}</KinMoney> : "—", data ? `${data.totals.openInvoices} phiếu đã gửi chưa đóng đủ` : ""],
            ["Tiềm năng", data ? <KinMoney>{vnd(data.totals.draftAmount)}</KinMoney> : "—", data ? (data.totals.draftCount > 0 ? `${data.totals.draftCount} phiếu nháp chưa gửi · chưa phải khoản phải thu` : "Chưa có phiếu nháp") : ""],
            ["Tỷ lệ thu", data ? (data.totals.collectionRatePct == null ? "Chưa có" : `${data.totals.collectionRatePct}%`) : "—", data ? (data.totals.sentCount > 0 ? <>{<KinMoney>{vnd(data.totals.sentPaid)}</KinMoney>} / {<KinMoney>{vnd(data.totals.sentDue)}</KinMoney>} trên {data.totals.sentCount} phiếu đã gửi</> : "Chưa có phiếu nào đã gửi") : ""],
          ] as const).map(([k, v, sub]) => (
            <div key={k} className="rounded-xl p-4" style={CARD_STYLE}>
              <dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{k}</dt>
              {loading ? <div className="h-7 w-24 rounded animate-pulse mt-1" style={{ background: "var(--kin-nen-nhan)" }} /> : <dd className="text-xl font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{v}</dd>}
              <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{sub}</p>
            </div>
          ))}
        </dl>

        <section aria-labelledby="h-thang">
          <h2 id="h-thang" className="font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Theo tháng thu tiền</h2>
          {loading ? <div className="h-20 rounded-xl animate-pulse" style={CARD_STYLE} /> : (data?.byMonth ?? []).length === 0
            ? <p className="text-sm py-4" style={{ color: "var(--kin-chu-phu)" }}>Chưa thu khoản nào trong khoảng này.</p>
            : <ul className="rounded-xl p-4 space-y-3" style={CARD_STYLE}>
                {data!.byMonth.map(m => (
                  <li key={m.month} className="flex items-center gap-3">
                    <span className="w-16 text-xs font-mono flex-shrink-0" style={{ color: "var(--kin-chu-phu)" }}>{m.month.slice(5)}/{m.month.slice(0, 4)}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: "var(--kin-nen-nhan)" }} aria-hidden>
                      <div className="h-2 rounded-full" style={{ width: `${(m.collected / monthMax * 100).toFixed(1)}%`, background: "var(--kin-tt-cham-xong)" }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums w-28 text-right" style={{ color: "var(--kin-chu-chinh)" }}><KinMoney>{vnd(m.collected)}</KinMoney></span>
                  </li>
                ))}
              </ul>}
        </section>

        <section aria-labelledby="h-lop">
          <h2 id="h-lop" className="font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Theo lớp</h2>
          {loading ? <div className="h-24 rounded-xl animate-pulse" style={CARD_STYLE} /> : <RevenueByClassTable rows={data?.byClass ?? []} />}
        </section>

        <section aria-labelledby="h-gd">
          <h2 id="h-gd" className="font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Các khoản đã thu</h2>
          {loading ? <div className="h-24 rounded-xl animate-pulse" style={CARD_STYLE} /> : (data?.transactions ?? []).length === 0
            ? <p className="text-sm py-4" style={{ color: "var(--kin-chu-phu)" }}>Chưa có khoản nào.</p>
            : <ul className="space-y-2">
                {data!.transactions.map(t => (
                  <li key={t.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={CARD_STYLE}>
                    <div className="min-w-0">
                      <p className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{t.studentName}</p>
                      <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{vnDateKey(new Date(t.date))} · {t.method}{t.code ? ` · ${t.code}` : ""}</p>
                    </div>
                    <span className="font-bold tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}><KinMoney>{vnd(t.amount)}</KinMoney></span>
                  </li>
                ))}
              </ul>}
        </section>
      </>)}

      <Link href="/lop-cua-toi/so-diem" className={kinButtonClass("secondary")}>Mở sổ điểm và tiến bộ</Link>

      <AdvancedAttendanceStats />
    </div>
  );
}
