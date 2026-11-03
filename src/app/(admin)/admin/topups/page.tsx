// Lịch sử nạp Coin — CHỈ ĐỌC (BU-08, Q5). Việc chờ duyệt / từ chối nằm ở Hàng chờ (/admin/kiem-duyet?loai=nap-coin), gọi đúng API duyệt cũ.
// Trang này giữ lại để đối soát sao kê: số tiền khai báo, số Coin, mã tham chiếu. TIỀN CHỈ HIỂN THỊ (định dạng vi-VN), không cộng, không tổng.
// Chỉ MANAGE_REVENUE (quản trị cấp 1), như API. Học sinh/gia sư chỉ hiện tên rút gọn, không email.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinCallout, KinEmptyState, KinStatus } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { QueueErrorStrip, QueueSkeleton } from "@/components/admin/queue/shared";

interface Row {
  id: string; amountVnd: number; coinAmount: number; status: string;
  bankRef: string | null; note: string | null; rejectReason: string | null;
  createdAt: string; reviewedAt: string | null;
  user: { id: string; name: string; adminRole: string | null };
}
type Tab = "xu-ly" | "approved" | "rejected";
const TABS: { key: Tab; label: string }[] = [{ key: "xu-ly", label: "Đã xử lý" }, { key: "approved", label: "Đã duyệt" }, { key: "rejected", label: "Đã từ chối" }];

function shortName(full: string): string {
  const w = full.trim().split(/\s+/).filter(Boolean);
  return w.length < 2 ? (w[0] ?? "Người dùng") : `${w[w.length - 1]} ${w[0][0].toUpperCase()}.`;
}

export default function AdminTopupsPage() {
  return <PermissionGuard required={PERMISSIONS.MANAGE_REVENUE}><TopupsContent /></PermissionGuard>;
}

function TopupsContent() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("xu-ly");

  const load = useCallback(async () => {
    await Promise.resolve();
    setRows(null); setFailed(false);
    try {
      const r = await fetch(`/api/admin/topups${tab === "xu-ly" ? "?status=all" : `?status=${tab}`}`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const items: Row[] = Array.isArray(d.items) ? d.items : [];
      setRows(tab === "xu-ly" ? items.filter(i => i.status !== "pending") : items);
    } catch { setFailed(true); }
  }, [tab]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const list = rows ?? [];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header>
        <h1 className="text-[28px] font-medium leading-9 text-[var(--kin-chu-chinh)]">Lịch sử nạp Coin</h1>
        <p className="mt-1 max-w-[68ch] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Các yêu cầu nạp Coin đã xử lý, để đối chiếu với sao kê. Trang này chỉ để xem.</p>
      </header>
      <KinCallout title="Việc chờ duyệt ở Hàng chờ">
        Duyệt hoặc từ chối yêu cầu mới ở <Link href="/admin/kiem-duyet?loai=nap-coin" className="font-medium underline text-[var(--kin-nhan-link)]">Hàng chờ, loại Nạp Coin</Link>.
      </KinCallout>

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[length:var(--kin-co-goc)] font-medium ${tab === t.key ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nhan-nen-nhat)] text-[var(--kin-nhan-link)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-phu)]"}`}>{t.label}</button>
        ))}
      </nav>
      <p data-dang-loc className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Đang lọc: <b className="font-semibold text-[var(--kin-chu-chinh)]">{TABS.find(t => t.key === tab)!.label}</b></p>

      {failed && <QueueErrorStrip message="Chưa tải được lịch sử nạp Coin." onRetry={() => void load()} />}
      {rows === null && !failed && <QueueSkeleton rows={4} />}
      {rows !== null && list.length === 0 && <KinEmptyState title="Chưa có yêu cầu nào ở mục này">Yêu cầu đã duyệt hoặc đã từ chối sẽ hiện ở đây.</KinEmptyState>}
      {rows !== null && list.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)]">
          <table data-topups-table className="w-full min-w-[640px] border-collapse text-left text-[length:var(--kin-co-goc)]">
            <thead>
              <tr className="text-[length:var(--kin-co-caption)] uppercase tracking-wide text-[var(--kin-chu-mo)]">
                {["Người nạp", "Số tiền khai báo · Coin", "Mã tham chiếu", "Thời điểm", "Kết quả"].map(h => <th key={h} scope="col" className="border-b border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className="border-b border-[var(--kin-vien-nhat)] last:border-b-0">
                  <th scope="row" className="px-3 py-3 font-normal">
                    <p className="font-semibold text-[var(--kin-chu-chinh)]">{r.user.adminRole ? r.user.name : shortName(r.user.name)}</p>
                    {r.user.adminRole === "teacher" && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Gia sư</p>}
                  </th>
                  <td className="px-3 py-3">
                    <p className="font-medium tabular-nums text-[var(--kin-chu-chinh)]">{`${r.amountVnd.toLocaleString("vi-VN")} đ`}</p>
                    <p className="text-[length:var(--kin-co-small)] tabular-nums text-[var(--kin-chu-mo)]">{`${r.coinAmount.toLocaleString("vi-VN")} Coin`}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-mono text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]">{r.bankRef ?? "—"}</p>
                    {r.note && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{r.note}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--kin-chu-phu)]">{new Date(r.reviewedAt ?? r.createdAt).toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-3">
                    <KinStatus tone={r.status === "approved" ? "xong" : r.status === "rejected" ? "loi" : "cho"}>{r.status === "approved" ? "Đã duyệt" : r.status === "rejected" ? "Đã từ chối" : "Đang chờ"}</KinStatus>
                    {r.status === "rejected" && r.rejectReason && <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{r.rejectReason}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
