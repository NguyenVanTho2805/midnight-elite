// QT-04 — "Hôm nay cần làm gì" ở đầu trang Tổng quan quản trị: danh sách việc đang chờ có số đếm và đường vào, theo QUYỀN người xem.
// Dữ liệu từ GET /api/admin/hom-nay (chỉ đếm, không có tên người). Không có việc nào thì nói thẳng, không hiện số 0.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinEmptyState, KinListRow, KinPanel, KinSectionHead, KinSkeleton, KinStatus } from "@/components/kin";
import { callApi } from "@/components/tutor/shared";
import type { TodayItem } from "@/lib/adminOps";

export default function HomNay() {
  const [data, setData] = useState<{ items: TodayItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<{ items: TodayItem[]; total: number }>("/api/admin/hom-nay");
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return (
    <KinPanel as="section" aria-labelledby="h-hom-nay" data-testid="hom-nay">
      <KinSectionHead id="h-hom-nay" title="Hôm nay cần làm gì" aside={data ? (data.total > 0 ? `${data.total} việc đang chờ` : "Không có việc chờ") : undefined} />
      {loading && !data ? <div className="pt-4"><KinSkeleton widths={[100, 70]} /></div>
        : failed || !data ? (
          <div className="py-4 flex items-center gap-3 flex-wrap">
            <KinStatus tone="loi">Chưa tải được danh sách việc</KinStatus>
            <KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>
          </div>
        ) : data.items.length === 0 ? (
          <KinEmptyState title="Hôm nay chưa có việc nào chờ bạn">Hồ sơ gia sư, báo cáo, nạp Coin, gói Pro và hỗ trợ đều đã xử lý hết trong phạm vi quyền của bạn.</KinEmptyState>
        ) : (
          <ul>
            {data.items.map(i => (
              <li key={i.key} data-todo={i.key}>
                <KinListRow href={i.href} title={i.label} sub={i.hint} trailing={<span className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">{i.count}</span>} />
              </li>
            ))}
          </ul>
        )}
    </KinPanel>
  );
}
