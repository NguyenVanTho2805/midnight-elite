// "Hôm nay cần làm gì" (BU-08 mục 5.2, Figma 608:1083 — chưa đối chiếu): một cột; việc chờ theo nhóm Việc chờ · Theo dõi · Hệ thống, rồi vài chỉ số gọn.
// Dữ liệu từ GET /api/admin/hom-nay (chỉ ĐẾM, không tên người, không số điện thoại) và, nếu có quyền xem doanh thu, GET /api/admin/analytics (chỉ HIỂN THỊ).
// Mỗi nguồn có trạng thái tải/lỗi/rỗng riêng: nguồn này lỗi không che nguồn kia.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinEmptyState, KinListRow, KinSectionHead, KinSkeleton, KinStat, KinStatRow, KinStatus } from "@/components/kin";
import { callApi } from "@/components/tutor/shared";
import { hasPermission, PERMISSIONS, useAuth } from "@/contexts/AuthContext";
import type { TodayItem } from "@/lib/adminOps";
import { featureOn } from "@/lib/features";

interface Group { key: "duyet" | "theo-doi" | "he-thong"; label: string; items: TodayItem[] }
interface Stats { students: number | null; openClasses: number | null; tutors: number | null }
interface TodayResp { items: TodayItem[]; total: number; groups?: Group[]; stats?: Stats }

const GROUP_LABEL: Record<Group["key"], string> = { duyet: "Việc chờ", "theo-doi": "Theo dõi", "he-thong": "Hệ thống" };
const num = (n: number | null | undefined) => (typeof n === "number" ? n.toLocaleString("vi-VN") : "—");

function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="status" data-loi className="flex flex-wrap items-center gap-3 py-4">
      <KinStatus tone="loi">{`Chưa tải được ${what}`}</KinStatus>
      <KinButton variant="secondary" onClick={onRetry}>Thử lại</KinButton>
    </div>
  );
}

export default function HomNay() {
  const { user } = useAuth();
  const [data, setData] = useState<TodayResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState("");
  const [rev, setRev] = useState<{ state: "load" | "err" | "ok"; value: number | null }>({ state: "load", value: null });
  // DG (14/11/2026): thẻ "Doanh thu 30 ngày" thuộc phần Kinh doanh — ẩn (và không gọi API) khi cờ KINH_DOANH tắt, mặc định.
  const canRevenue = hasPermission(user, PERMISSIONS.VIEW_REVENUE) && featureOn("KINH_DOANH");

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<TodayResp>("/api/admin/hom-nay");
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  const loadRev = useCallback(async () => {
    await Promise.resolve();
    setRev({ state: "load", value: null });
    const to = new Date(), from = new Date(to.getTime() - 29 * 86_400_000);
    const key = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10); // ngày giờ Việt Nam
    const r = await callApi<{ totals?: { netVipRevenue?: number } }>(`/api/admin/analytics?from=${key(from)}&to=${key(to)}`);
    setRev(r.ok && typeof r.data.totals?.netVipRevenue === "number" ? { state: "ok", value: r.data.totals.netVipRevenue } : { state: "err", value: null });
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); setDay(new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" })); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (canRevenue) void loadRev(); }, [canRevenue, loadRev]);

  const groups: Group[] = data ? (data.groups ?? [{ key: "duyet", label: GROUP_LABEL.duyet, items: data.items }]).filter(g => g.items.length > 0) : [];
  const total = data ? (data.total ?? groups.reduce((s, g) => s + g.items.reduce((t, i) => t + i.count, 0), 0)) : 0;

  return (
    <div data-testid="hom-nay" className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header>
        <h1 className="text-[28px] font-medium leading-9 text-[var(--kin-chu-chinh)]">Hôm nay cần làm gì</h1>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
          {[day, data ? (total > 0 ? `${total} việc đang chờ` : "Không có việc chờ") : null].filter(Boolean).join(" · ")}
        </p>
      </header>

      <section aria-label="Việc cần làm" className="flex flex-col gap-6">
        {loading && !data ? <KinSkeleton widths={[100, 70]} />
          : failed || !data ? <Failed what="danh sách việc" onRetry={() => void load()} />
          : groups.length === 0 ? (
            <KinEmptyState title="Hôm nay chưa có việc nào chờ bạn">Hồ sơ gia sư, báo cáo, đánh giá và hỗ trợ đều đã xử lý hết trong phạm vi quyền của bạn.</KinEmptyState>
          ) : groups.map(g => (
            <div key={g.key} data-group={g.key}>
              <KinSectionHead title={GROUP_LABEL[g.key] ?? g.label} aside={`${g.items.length} mục`} />
              <ul>
                {g.items.map(i => (
                  <li key={i.key} data-todo={i.key}>
                    <KinListRow href={i.href} title={i.label} sub={i.hint} trailing={<span className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">{i.count}</span>} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>

      <section aria-label="Chỉ số gọn" data-chi-so>
        <KinSectionHead title="Vài con số" />
        {loading && !data ? <div className="pt-4"><KinSkeleton widths={[60, 60]} /></div>
          : failed || !data ? <Failed what="các con số" onRetry={() => void load()} />
          : (
            <KinStatRow>
              {data.stats?.students != null && <KinStat label="Học sinh" value={num(data.stats.students)} />}
              {data.stats?.openClasses != null && <KinStat label="Lớp đang mở" value={num(data.stats.openClasses)} />}
              {data.stats?.tutors != null && <KinStat label="Gia sư đã duyệt" value={num(data.stats.tutors)} />}
              {canRevenue && (
                rev.state === "err"
                  ? <div className="min-w-0"><Failed what="doanh thu" onRetry={() => void loadRev()} /></div>
                  : <KinStat label="Doanh thu 30 ngày" value={rev.state === "ok" ? `${num(rev.value)} đ` : "…"} />
              )}
            </KinStatRow>
          )}
      </section>
    </div>
  );
}
