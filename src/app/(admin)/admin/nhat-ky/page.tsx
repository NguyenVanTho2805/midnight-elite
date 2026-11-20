// QT-02 — Nhật ký (Figma 464:9078): trang ĐỌC AuditLog, lọc theo nhóm, loại việc và ngày. BU-08: bảng NN/g (cột đầu "Việc đã làm"), chip lọc hiện khi đang áp. Chỉ quản trị cấp 1 (MANAGE_ADMINS).
// KHÔNG có tên/SĐT/ngày sinh của trẻ và không có nội dung chi tiết (metadata): chỉ giờ, việc đã làm, loại đối tượng + mã rút gọn, và vai người làm
// (nhân sự hiện kèm tên; học sinh/phụ huynh chỉ hiện vai).
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinCallout, KinEmptyState, KinSkeleton, KinStateCard, KinStatus } from "@/components/kin";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { callApi } from "@/components/tutor/shared";
import { AUDIT_ACTION_OPTIONS, type AuditRowView } from "@/lib/adminOps";
import { KinSelect } from "@/components/kin/KinSelect";

interface Payload { rows: AuditRowView[]; hasMore: boolean; page: number }
/** Nhóm lọc (ánh xạ tiền tố hành động nằm phía máy chủ, adminOps.ts — ở đây chỉ gửi khoá). */
const GROUPS = [
  { key: "duyet", label: "Duyệt" }, { key: "tien", label: "Tiền" }, { key: "nguoi", label: "Con người" },
  { key: "noi-dung", label: "Nội dung" }, { key: "he-thong", label: "Hệ thống" },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];

export default function NhatKyPage() {
  return <PermissionGuard required={PERMISSIONS.MANAGE_ADMINS}><Content /></PermissionGuard>;
}

function Content() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [action, setAction] = useState("");
  const [nhom, setNhom] = useState<GroupKey | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (nhom) q.set("nhom", nhom);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    q.set("page", String(page));
    const r = await callApi<Payload>(`/api/admin/nhat-ky?${q.toString()}`);
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, [action, nhom, from, to, page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const chip = (on: boolean) => `inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-[length:var(--kin-co-goc)] font-medium ${on
    ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nhan-nen-nhat)] text-[var(--kin-nhan-link)]"
    : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`;
  const actionLabel = AUDIT_ACTION_OPTIONS.find(o => o.value === action)?.label;
  const applied = [nhom ? `Nhóm: ${GROUPS.find(g => g.key === nhom)!.label}` : null, actionLabel ? `Việc: ${actionLabel}` : null, from ? `Từ ${from}` : null, to ? `Đến ${to}` : null].filter(Boolean) as string[];
  const clearAll = () => { setNhom(""); setAction(""); setFrom(""); setTo(""); setPage(1); };

  return (
    <KinPage>
      <KinPageHeader title="Nhật ký" sub="Mỗi việc đổi quyền, đồng ý, tiền và duyệt hồ sơ đều có người làm và giờ làm. Chỉ để đọc, không sửa được." />
      <div className="max-w-5xl space-y-[var(--kin-cach-muc)]">
        <nav aria-label="Lọc theo nhóm" className="flex flex-wrap gap-2">
          <button type="button" data-chip="tat-ca" aria-pressed={!nhom} className={chip(!nhom)} onClick={() => { setNhom(""); setPage(1); }}>Tất cả</button>
          {GROUPS.map(g => <button key={g.key} type="button" data-chip={g.key} aria-pressed={nhom === g.key} className={chip(nhom === g.key)} onClick={() => { setNhom(g.key); setPage(1); }}>{g.label}</button>)}
        </nav>
        <form onSubmit={e => { e.preventDefault(); setPage(1); void load(); }} className="grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-end" aria-label="Lọc nhật ký">
          <label className={KIN_LABEL}>Loại việc
            <KinSelect value={action} onChange={v => { setAction(v); setPage(1); }} className="mt-2">
              <option value="">Tất cả</option>
              {AUDIT_ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </KinSelect>
          </label>
          <label className={KIN_LABEL}>Từ ngày<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className={`${KIN_FIELD} mt-2`} /></label>
          <label className={KIN_LABEL}>Đến ngày<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className={`${KIN_FIELD} mt-2`} /></label>
        </form>
        {applied.length > 0 && (
          <p data-dang-loc className="flex flex-wrap items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
            <span>Đang lọc: <b className="font-semibold text-[var(--kin-chu-chinh)]">{applied.join(" · ")}</b></span>
            <button type="button" onClick={clearAll} className="inline-flex min-h-11 items-center px-2 font-medium text-[var(--kin-nhan-link)] hover:underline">✕ Xoá lọc</button>
          </p>
        )}

        {loading && !data ? <KinSkeleton widths={[100, 80, 60]} />
          : failed || !data ? (
            <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được nhật ký" status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
              actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}><p>Thử lại sau ít giây.</p></KinStateCard>
          ) : data.rows.length === 0 ? (
            <KinEmptyState title="Chưa có dòng nhật ký nào khớp" action={applied.length > 0 ? <KinButton variant="secondary" onClick={clearAll}>Xoá lọc</KinButton> : undefined}>Nhật ký chỉ ghi những việc quan trọng (đổi vai, đồng ý, tiền, duyệt hồ sơ). Thử bỏ bớt bộ lọc.</KinEmptyState>
          ) : (
            <section aria-label="Danh sách nhật ký" aria-busy={loading}>
              <div className="overflow-x-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)]">
                <table className="w-full min-w-[560px] border-collapse text-left text-[length:var(--kin-co-goc)]">
                  <thead>
                    <tr className="text-[length:var(--kin-co-caption)] uppercase tracking-wide text-[var(--kin-chu-mo)]">
                      {["Việc đã làm", "Ai", "Khi"].map(h => <th key={h} scope="col" className="border-b border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] px-3 py-2 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody data-testid="nhat-ky">
                    {data.rows.map(r => (
                      <tr key={r.id} data-action={r.action} className="border-b border-[var(--kin-vien-nhat)] last:border-b-0">
                        <th scope="row" className="px-3 py-3 font-normal">
                          <p className="font-semibold text-[var(--kin-chu-chinh)]">{r.actionLabel}</p>
                          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{r.resource} <span className="font-mono">{r.resourceId}</span></p>
                        </th>
                        <td className="px-3 py-3 text-[var(--kin-nhan-link)]">{r.actor}</td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[var(--kin-chu-mo)]">{r.when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
