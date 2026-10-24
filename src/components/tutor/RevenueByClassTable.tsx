// FE-164 — bảng doanh thu theo LỚP cho gia sư (cùng dạng RevenueByTutorTable ở
// admin, chỉ khác phạm vi dữ liệu). Tiền đã thu được quy về lớp theo tỉ lệ tiền
// từng môn trên phiếu.
"use client";
import { CARD_STYLE, vnd } from "@/components/tutor/shared";
import { KinMoney } from "@/components/kin/MoneyVisibility";

export interface ClassRevenueRow { courseId: string; name: string; collected: number }

export default function RevenueByClassTable({ rows }: { rows: ClassRevenueRow[] }) {
  const total = rows.reduce((s, r) => s + r.collected, 0);
  const max = Math.max(...rows.map(r => r.collected), 1);
  if (rows.length === 0) {
    return <p className="text-sm text-center py-6" style={{ color: "var(--kin-chu-phu)" }}>Chưa thu khoản nào trong khoảng này.</p>;
  }
  return (
    <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
      <table className="w-full text-sm">
        <caption className="sr-only">Học phí đã thu theo từng lớp</caption>
        <thead>
          <tr style={{ color: "var(--kin-chu-phu)" }}>
            <th scope="col" className="text-left font-semibold px-4 py-2">Lớp</th>
            <th scope="col" className="text-right font-semibold px-4 py-2">Đã thu</th>
            <th scope="col" className="text-right font-semibold px-4 py-2 hidden sm:table-cell">Tỉ trọng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.courseId} style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
              <td className="px-4 py-2.5">
                <div className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{r.name}</div>
                <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--kin-nen-nhan)" }} aria-hidden>
                  <div className="h-1.5 rounded-full" style={{ width: `${(r.collected / max * 100).toFixed(1)}%`, background: "var(--kin-nhan-diem)" }} />
                </div>
              </td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}><KinMoney>{vnd(r.collected)}</KinMoney></td>
              <td className="px-4 py-2.5 text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--kin-chu-phu)" }}>{total > 0 ? Math.round(r.collected / total * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--kin-vien-thuong)" }}>
            <th scope="row" className="text-left px-4 py-2.5" style={{ color: "var(--kin-chu-chinh)" }}>Tổng</th>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: "var(--kin-nhan-diem)" }}><KinMoney>{vnd(total)}</KinMoney></td>
            <td className="hidden sm:table-cell" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
