// PH-210 / PH-212 — bảng phễu của quản trị: lượt mở / xem hết hồ sơ công khai theo kênh (?n=) và hàng chờ báo cáo hồ sơ.
// Quản lý trung tâm (admin_super, admin_content). Không đếm được bài đăng trong nhóm Facebook — chỉ đếm lượt bấm link.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton, KinCallout, KinEmptyState, KinSectionHead, KinSkeleton, KinStateCard, KinStatus, kinButtonClass } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { Modal, callApi, useNotify } from "@/components/tutor/shared";

interface Row { channel: string; group: string; groupLabel: string; opens: number; fulls: number; fullRate: number | null }
interface Report { id: string; tutorId: string; tutorName: string; tutorLocked: boolean; reason: string; reasonLabel: string; detail: string | null; channel: string | null; createdAt: string; openForTutor: number }
interface Payload { days: number; rows: Row[]; totals: { opens: number; fulls: number }; reportsOpen: number; lockedProfiles: number; reports: Report[] }

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export default function PheuPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_TUTORS}>
      <PheuContent />
    </PermissionGuard>
  );
}

function PheuContent() {
  const notify = useNotify();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [locking, setLocking] = useState<Report | null>(null);
  const [reason, setReason] = useState("");
  const seq = useRef(0);

  const load = useCallback(async (d: number) => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>(`/api/admin/funnel?days=${d}`);
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(days);
  }, [load, days]);

  async function dismiss(rep: Report) {
    setBusy(rep.id);
    const r = await callApi(`/api/admin/profile-reports/${rep.id}`, { method: "PATCH", body: JSON.stringify({ action: "dismiss" }) });
    setBusy(null);
    if (!r.ok) notify.err(r.data.error ?? "Không xử lý được"); else notify.ok("Đã bỏ qua báo cáo.");
    await load(days);
  }
  async function lock() {
    if (!locking) return;
    setBusy(locking.id);
    const r = await callApi(`/api/admin/profile-reports/${locking.id}`, { method: "PATCH", body: JSON.stringify({ action: "lock", reason: reason.trim() }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không khoá được"); return; }
    notify.ok(`Đã khoá hồ sơ công khai của ${locking.tutorName}.`);
    setLocking(null); setReason("");
    await load(days);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-9 font-medium text-[var(--kin-chu-chinh)]">Bảng phễu gia sư</h1>
          <p className="mt-2 max-w-[68ch] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
            Lượt mở và lượt xem hết hồ sơ công khai, chia theo đuôi <code>?n=</code> của link. Chỉ đếm lượt bấm link — <b>không đếm được bài đăng trong nhóm Facebook</b>.
          </p>
        </div>
        <label className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Khoảng thời gian
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="block mt-1 px-3 min-h-[44px] rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-goc)] bg-[var(--kin-nen-trang)] border border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-chinh)]">
            {[7, 30, 90].map(d => <option key={d} value={d}>{d} ngày gần nhất</option>)}
          </select>
        </label>
      </header>

      {loading && !data ? (
        <KinStateCard busy kicker="Đang tải" title="Đang tải bảng phễu" note="Giữ vị trí nội dung, không hiển thị số liệu tạm như dữ liệu thật.">
          <p>Đang lấy lượt mở link và hàng chờ báo cáo, vui lòng chờ một chút.</p>
          <KinSkeleton className="mt-4" />
        </KinStateCard>
      ) : failed || !data ? (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được số liệu"
          status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
          actions={<KinButton variant="secondary" onClick={() => void load(days)}>Thử lại</KinButton>}>
          <p>Không tải được số liệu. Kiểm tra kết nối rồi thử lại; dữ liệu trên hệ thống không bị mất.</p>
        </KinStateCard>
      ) : (
        <>
          <section aria-labelledby="h-kenh" className="space-y-4">
            <KinSectionHead id="h-kenh" title={`Theo kênh (${data.days} ngày)`} />
            {data.rows.length === 0 ? (
              <KinCallout title="Chưa có lượt mở link nào trong khoảng này.">
                Gia sư đưa link hồ sơ kèm <code>?n=</code> vào bài đăng để đo.
              </KinCallout>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                  <caption className="sr-only">Lượt mở và xem hết hồ sơ theo kênh</caption>
                  <thead>
                    <tr className="bg-[var(--kin-nen-bang)] text-[var(--kin-chu-mo)]">
                      <th scope="col" className="text-left font-normal px-3 py-3">Kênh</th>
                      <th scope="col" className="text-left font-normal px-3 py-3">Loại</th>
                      <th scope="col" className="text-right font-normal px-3 py-3">Mở link</th>
                      <th scope="col" className="text-right font-normal px-3 py-3">Xem hết hồ sơ</th>
                      <th scope="col" className="text-right font-normal px-3 py-3">Tỉ lệ xem hết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(r => (
                      <tr key={r.channel} className="border-b border-[var(--kin-vien-nhat)]">
                        <th scope="row" className="text-left px-3 py-3 font-mono font-normal">{r.channel}</th>
                        <td className="px-3 py-3">{r.groupLabel}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.opens}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.fulls}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{pct(r.fullRate)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-[var(--kin-vien-thuong)] font-medium">
                      <th scope="row" className="text-left font-medium px-3 py-3" colSpan={2}>Tổng</th>
                      <td className="px-3 py-3 text-right tabular-nums">{data.totals.opens}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{data.totals.fulls}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{pct(data.totals.opens > 0 ? Math.min(1, data.totals.fulls / data.totals.opens) : null)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              Các bước sau (đăng ký học thử, học thử xong, nhận lớp) chưa đo được vì chưa có form đăng ký học thử.
            </p>
          </section>

          <section aria-labelledby="h-bc" className="space-y-1">
            <KinSectionHead id="h-bc" title={`Báo cáo hồ sơ chờ xử lý (${data.reportsOpen}) · hồ sơ đang bị khoá: ${data.lockedProfiles}`} />
            {data.reports.length === 0 ? (
              <KinEmptyState title="Không có báo cáo nào đang chờ.">
                Khi phụ huynh bấm “Báo cáo hồ sơ này” trên trang công khai của gia sư, báo cáo sẽ hiện ở đây để xem xét.
              </KinEmptyState>
            ) : (
              <ul>
                {data.reports.map(rep => (
                  <li key={rep.id} className="py-5 border-b border-[var(--kin-vien-nhat)]">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1 basis-[260px]">
                        <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{rep.tutorName}</p>
                        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{rep.reasonLabel}</p>
                        {rep.detail && <p className="mt-1 text-[length:var(--kin-co-goc)] whitespace-pre-wrap text-[var(--kin-chu-phu)]">{rep.detail}</p>}
                        <div className="mt-1.5"><KinStatus tone="cho">Chờ xem xét</KinStatus></div>
                        <p className="mt-1.5 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
                          {new Date(rep.createdAt).toLocaleString("vi-VN")}{rep.channel ? ` · kênh ${rep.channel}` : ""}
                          {rep.openForTutor > 1 ? ` · gia sư này có ${rep.openForTutor} báo cáo đang chờ` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <a href={`/mentor/${rep.tutorId}`} target="_blank" rel="noreferrer" className={kinButtonClass("secondary")}>Xem hồ sơ</a>
                        <KinButton variant="secondary" disabled={busy === rep.id} onClick={() => void dismiss(rep)}>Bỏ qua</KinButton>
                        <KinButton variant="danger-solid" disabled={busy === rep.id} onClick={() => { setLocking(rep); setReason(""); }}>Khoá hồ sơ</KinButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {locking && (
        <Modal title={`Khoá hồ sơ công khai — ${locking.tutorName}`} onClose={() => setLocking(null)}>
          <p className="text-sm mb-2" style={{ color: "var(--kin-chu-phu)" }}>Hồ sơ công khai sẽ trả “không tìm thấy”. Gia sư vẫn dùng sổ lớp bình thường. Mọi báo cáo đang chờ về gia sư này được đóng.</p>
          <label className="block text-sm" htmlFor="lock-reason">Lý do khoá (bắt buộc)</label>
          <textarea id="lock-reason" rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-o-nhap)", color: "var(--kin-chu-chinh)" }} />
          <div className="flex gap-2 justify-end mt-4">
            <KinButton variant="secondary" onClick={() => setLocking(null)}>Đóng</KinButton>
            <KinButton variant="danger-solid" disabled={!reason.trim()} loading={busy === locking.id} loadingLabel="Đang khoá…" onClick={() => void lock()}>Khoá hồ sơ</KinButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
