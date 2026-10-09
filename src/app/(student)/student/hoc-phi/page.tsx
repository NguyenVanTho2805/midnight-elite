// TK-173 (nối AS-192) — Phiếu học phí tháng cho học viên.
// Figma 200:74 (phiếu từng em). Hiển thị:
//   - Chọn tháng (dropdown 12 tháng gần nhất).
//   - Breakdown theo môn: số buổi · buổi miễn · thành tiền.
//   - Tổng gốc / Học bổng / Giảm trừ / Phải đóng.
//   - VietQR code để chuyển khoản.
"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui";
import { currentYearMonth } from "@/lib/tuition";
import { buildVietQRUrl, tuitionBankMemo, KIN_BANK } from "@/lib/vietqr";

type Breakdown = {
  subjectCount: number;
  pricePerSession: number;
  overrideUsed: boolean;
  perSubject: Array<{
    courseId: string; courseName: string; sessionCount: number; freeCount: number;
    billable: number; subtotal: number;
  }>;
  gross: number; scholarship: number; discount: number; finalAmount: number;
};

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

// 12 tháng gần nhất, newest first.
function lastTwelveMonths(now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function HocPhiPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [yearMonth, setYearMonth] = useState<string>(currentYearMonth());
  const [data, setData]           = useState<Breakdown | null>(null);
  const [loading, setLoading]     = useState(true);
  const months = useMemo(() => lastTwelveMonths(), []);

  const load = useCallback(async () => {
    if (!user) return;
    await Promise.resolve();
    setLoading(true);
    try {
      const r = await fetch(`/api/users/${user.id}/tuition?yearMonth=${yearMonth}`, { credentials: "same-origin" });
      if (!r.ok) { toast.err("Không tải được học phí"); setLoading(false); return; }
      const d = await r.json();
      setData(d.breakdown);
    } finally { setLoading(false); }
  }, [user, yearMonth, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const memo = user ? tuitionBankMemo(user.id, yearMonth) : "";
  const qrUrl = data && data.finalAmount > 0 && user
    ? buildVietQRUrl({ amount: data.finalAmount, addInfo: memo })
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header + chọn tháng */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h4" style={{ color: "var(--kin-chu-chinh)" }}>Phiếu học phí</h1>
          <p className="text-body-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>
            Tính theo số buổi của môn trong tháng. Vắng không trừ tiền.
          </p>
        </div>
        <select value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          className="px-3 py-1.5 text-body-sm font-semibold rounded-lg"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl p-10 text-center text-body-sm" style={{ background: "var(--kin-nen-bang)" }}>Đang tải...</div>
      ) : !data || data.subjectCount === 0 ? (
        <div className="rounded-xl p-10 text-center text-body-sm"
          style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)" }}>
          Chưa tham gia lớp nào. Nhập <a href="/student/nhap-ma-lop" className="underline" style={{ color: "var(--kin-th-xanh-link)" }}>mã mời lớp</a> để bắt đầu.
        </div>
      ) : (
        <>
          {/* Breakdown theo môn */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "var(--kin-vien-nhat)" }}>
              <p className="text-body-sm" style={{ color: "var(--kin-chu-mo)" }}>
                Đơn giá: {formatVnd(data.pricePerSession)}/buổi
                {data.overrideUsed
                  ? <span className="ml-2 text-caption font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>(giá riêng)</span>
                  : <span className="ml-2 text-caption" style={{ color: "var(--kin-chu-mo)" }}>({data.subjectCount} môn theo bậc thang)</span>
                }
              </p>
            </div>
            {data.perSubject.map(s => (
              <div key={s.courseId} className="flex items-start justify-between gap-3 px-5 py-3"
                style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                <div className="min-w-0">
                  <p className="text-body font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{s.courseName}</p>
                  <p className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>
                    {s.sessionCount} buổi
                    {s.freeCount > 0 && <> · {s.freeCount} buổi miễn phí</>}
                    {" · "}còn {s.billable} buổi tính tiền
                  </p>
                </div>
                <p className="text-body font-bold whitespace-nowrap" style={{ color: "var(--kin-chu-chinh)" }}>
                  {formatVnd(s.subtotal)}
                </p>
              </div>
            ))}
          </div>

          {/* Tổng */}
          <div className="rounded-xl p-5 space-y-2"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <div className="flex items-center justify-between text-body-sm">
              <span style={{ color: "var(--kin-chu-mo)" }}>Học phí gốc</span>
              <span style={{ color: "var(--kin-chu-chinh)" }}>{formatVnd(data.gross)}</span>
            </div>
            {data.scholarship > 0 && (
              <div className="flex items-center justify-between text-body-sm">
                <span style={{ color: "var(--kin-chu-mo)" }}>Học bổng</span>
                <span style={{ color: "var(--kin-tt-chu-xong)" }}>− {formatVnd(data.scholarship)}</span>
              </div>
            )}
            {data.discount > 0 && (
              <div className="flex items-center justify-between text-body-sm">
                <span style={{ color: "var(--kin-chu-mo)" }}>Giảm trừ</span>
                <span style={{ color: "var(--kin-tt-chu-xong)" }}>− {formatVnd(data.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t"
              style={{ borderColor: "var(--kin-vien-nhat)" }}>
              <span className="text-body font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Phải đóng</span>
              <span className="text-h4" style={{ color: "var(--kin-th-navy)" }}>{formatVnd(data.finalAmount)}</span>
            </div>
          </div>

          {/* VietQR */}
          {qrUrl && (
            <div className="rounded-xl p-5"
              style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
              <p className="text-body-sm font-semibold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Chuyển khoản qua VietQR</p>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* TK-182 (09/10/2026): mobile co nhỏ QR xuống còn 44 (w-44 h-44 = 176px)
                    để không chiếm toàn bộ chiều cao điện thoại; desktop giữ 224px. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="VietQR" className="w-44 h-44 sm:w-56 sm:h-56 flex-shrink-0 rounded-lg"
                  style={{ border: "1px solid var(--kin-vien-nhat)" }} />
                <div className="text-body-sm space-y-1" style={{ color: "var(--kin-chu-phu)" }}>
                  <p>Ngân hàng: <b>{KIN_BANK.accountName}</b></p>
                  <p>Số TK: <b className="font-mono">{KIN_BANK.accountNo}</b></p>
                  <p>Số tiền: <b>{formatVnd(data.finalAmount)}</b></p>
                  <p>Nội dung: <b className="font-mono">{memo}</b></p>
                  <p className="text-caption pt-1" style={{ color: "var(--kin-chu-mo)" }}>
                    Sao chép đúng nội dung giúp đối chiếu nhanh.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
