// QT-02 — Nhật ký (Figma 464:9078, tab "Nhật ký"): trang ĐỌC AuditLog, lọc theo loại việc và ngày. Chỉ quản trị cấp 1 (MANAGE_ADMINS).
// KHÔNG có tên/SĐT/ngày sinh của trẻ và không có nội dung chi tiết (metadata): chỉ giờ, việc đã làm, loại đối tượng + mã rút gọn, và vai người làm
// (nhân sự hiện kèm tên; học sinh/phụ huynh chỉ hiện vai).
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinCallout, KinEmptyState, KinSkeleton, KinStateCard, KinStatus } from "@/components/kin";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { callApi } from "@/components/tutor/shared";
import { AUDIT_ACTION_OPTIONS, type AuditRowView } from "@/lib/adminOps";

interface Payload { rows: AuditRowView[]; hasMore: boolean; page: number }
const GRID = "md:grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] md:gap-4";

export default function NhatKyPage() {
  return <PermissionGuard required={PERMISSIONS.MANAGE_ADMINS}><Content /></PermissionGuard>;
}

function Content() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    q.set("page", String(page));
    const r = await callApi<Payload>(`/api/admin/nhat-ky?${q.toString()}`);
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, [action, from, to, page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return (
    <KinPage>
      <KinPageHeader title="Nhật ký" sub="Mỗi việc đổi quyền, đồng ý, tiền và duyệt hồ sơ đều có người làm và giờ làm. Chỉ để đọc, không sửa được." />
      <div className="max-w-5xl space-y-[var(--kin-cach-muc)]">
        <form onSubmit={e => { e.preventDefault(); setPage(1); void load(); }} className="grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-end" aria-label="Lọc nhật ký">
          <label className={KIN_LABEL}>Loại việc
            <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className={`${KIN_FIELD} mt-2`}>
              <option value="">Tất cả</option>
              {AUDIT_ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className={KIN_LABEL}>Từ ngày<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className={`${KIN_FIELD} mt-2`} /></label>
          <label className={KIN_LABEL}>Đến ngày<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className={`${KIN_FIELD} mt-2`} /></label>
        </form>

        {loading && !data ? <KinSkeleton widths={[100, 80, 60]} />
          : failed || !data ? (
            <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được nhật ký" status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
              actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}><p>Thử lại sau ít giây.</p></KinStateCard>
          ) : data.rows.length === 0 ? (
            <KinEmptyState title="Chưa có dòng nhật ký nào khớp">Nhật ký chỉ ghi những việc quan trọng (đổi vai, đồng ý, tiền, duyệt hồ sơ). Thử bỏ bớt bộ lọc.</KinEmptyState>
          ) : (
            <section aria-label="Danh sách nhật ký" aria-busy={loading}>
              <div className={`hidden ${GRID} ${KIN_TABLE_HEAD}`}><span>Thời gian</span><span>Việc đã làm</span><span>Đối tượng</span><span>Người thực hiện</span></div>
              <ul data-testid="nhat-ky">
                {data.rows.map(r => (
                  <li key={r.id} data-action={r.action} className={`${GRID} ${KIN_TABLE_ROW}`}>
                    <span className="text-[var(--kin-chu-mo)] tabular-nums">{r.when}</span>
                    <span className="text-[var(--kin-chu-chinh)]">{r.actionLabel}</span>
                    <span className="text-[var(--kin-chu-phu)]">{r.resource} <span className="font-mono text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">{r.resourceId}</span></span>
                    <span className="text-[var(--kin-nhan-link)]">{r.actor}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 pt-4">
                <KinButton variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>Trang trước</KinButton>
                <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Trang {data.page}</span>
                <KinButton variant="secondary" disabled={!data.hasMore || loading} onClick={() => setPage(p => p + 1)}>Trang sau</KinButton>
              </div>
            </section>
          )}
        <KinCallout title="Nhật ký không chứa tên hay thông tin của trẻ">Học sinh và phụ huynh chỉ hiện theo vai. Chi tiết từng việc không hiện ở đây; muốn xem cần mở đúng trang xử lý và có quyền tương ứng.</KinCallout>
      </div>
    </KinPage>
  );
}
