// FE-164 — bảng doanh thu theo gia sư. Dùng ở /admin/doanh-thu (toàn nền tảng).
// Cùng dạng bảng "theo lớp" ở trang doanh thu của gia sư (RevenueByClassTable
// trong src/components/tutor/) — chỉ khác phạm vi dữ liệu.
"use client";
import { useMemo, useState } from "react";
import { formatVnd } from "@/lib/revenue";

export interface TutorRevenueRow {
  tutorId:      string;
  name:         string;
  email:        string;
  classes:      number;
  students:     number;
  vipRevenue:   number;
  vipPurchases: number;
  vipUntil:     string | null;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("vi-VN") : "—";
}

export default function RevenueByTutorTable({ rows, loading }: { rows: TutorRevenueRow[]; loading?: boolean }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter(r => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s)) : rows;
  }, [rows, q]);
  const total = useMemo(() => shown.reduce((n, r) => n + r.vipRevenue, 0), [shown]);

  if (loading) {
    return <div className="space-y-2" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-11 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />)}</div>;
  }

  return (
    <div>
      <label className="sr-only" htmlFor="rev-tutor-q">Tìm gia sư</label>
      <input id="rev-tutor-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm gia sư theo tên hoặc email…"
        className="mb-3 w-full sm:w-72 px-3 py-2 text-sm rounded-xl outline-none"
        style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px var(--kin-nen-trang)", color: "#1E2938" }} />
      {rows.length === 0 ? (
        <p className="text-center py-8 text-sm" style={{ color: "#6B7280" }}>Chưa có gia sư nào được duyệt.</p>
      ) : shown.length === 0 ? (
        <p className="text-center py-8 text-sm" style={{ color: "#6B7280" }}>Không có gia sư khớp “{q}”.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <caption className="sr-only">Doanh thu VIP theo từng gia sư</caption>
            <thead>
              <tr style={{ color: "#6B7280" }}>
                <th scope="col" className="text-left font-semibold py-2 pr-3">Gia sư</th>
                <th scope="col" className="text-right font-semibold py-2 px-3">Lớp</th>
                <th scope="col" className="text-right font-semibold py-2 px-3">Học viên</th>
                <th scope="col" className="text-right font-semibold py-2 px-3">VIP đã trả</th>
                <th scope="col" className="text-right font-semibold py-2 px-3">Số lần mua</th>
                <th scope="col" className="text-right font-semibold py-2 pl-3">VIP đến</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.tutorId} style={{ borderTop: "1px solid #E2E8F4" }}>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold" style={{ color: "#1E2938" }}>{r.name}</div>
                    <div className="text-xs" style={{ color: "#6B7280" }}>{r.email}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{r.classes}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{r.students}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums" style={{ color: r.vipRevenue > 0 ? "var(--kin-nhan-link)" : "#6B7280" }}>{formatVnd(r.vipRevenue)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{r.vipPurchases}</td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                    {r.vipUntil
                      ? <span>{fmtDate(r.vipUntil)}</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#F3F4F6", color: "#4B5563" }}>Chưa VIP</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #C5D0EA" }}>
                <th scope="row" className="text-left py-2.5 pr-3 font-semibold" style={{ color: "#1E2938" }}>Tổng ({shown.length} gia sư)</th>
                <td className="text-right px-3 tabular-nums">{shown.reduce((n, r) => n + r.classes, 0)}</td>
                <td className="text-right px-3 tabular-nums">—</td>
                <td className="text-right px-3 font-bold tabular-nums" style={{ color: "var(--kin-nhan-link)" }}>{formatVnd(total)}</td>
                <td className="text-right px-3 tabular-nums">{shown.reduce((n, r) => n + r.vipPurchases, 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
