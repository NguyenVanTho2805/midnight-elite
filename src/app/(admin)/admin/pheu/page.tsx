// PH-210 / PH-212 — bảng phễu của quản trị: lượt mở / xem hết hồ sơ công khai theo kênh (?n=) và hàng chờ báo cáo hồ sơ.
// Quản lý trung tâm (admin_super, admin_content). Không đếm được bài đăng trong nhóm Facebook — chỉ đếm lượt bấm link.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Bảng phễu gia sư</h1>
        <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>
          Lượt mở và lượt xem hết hồ sơ công khai, chia theo đuôi <code>?n=</code> của link. Chỉ đếm lượt bấm link — <b>không đếm được bài đăng trong nhóm Facebook</b>.
        </p>
      </div>

      <label className="text-xs inline-block" style={{ color: "var(--kin-chu-phu)" }}>Khoảng thời gian
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-o-nhap)", color: "var(--kin-chu-chinh)" }}>
          {[7, 30, 90].map(d => <option key={d} value={d}>{d} ngày gần nhất</option>)}
        </select>
      </label>

      {loading && !data ? (
        <div aria-busy="true" className="h-32 rounded-xl animate-pulse" style={{ background: "var(--kin-nen-bang)" }} />
      ) : failed || !data ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          Không tải được số liệu. <button className="underline font-semibold" onClick={() => void load(days)}>Thử lại</button>
        </div>
      ) : (
        <>
          <section aria-labelledby="h-kenh">
            <h2 id="h-kenh" className="text-sm font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Theo kênh ({data.days} ngày)</h2>
            {data.rows.length === 0 ? (
              <p role="status" className="rounded-xl p-5 text-sm text-center" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
                Chưa có lượt mở link nào trong khoảng này. Gia sư đưa link hồ sơ kèm <code>?n=</code> vào bài đăng để đo.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
                <table className="w-full text-sm" style={{ background: "var(--kin-nen-trang)" }}>
                  <caption className="sr-only">Lượt mở và xem hết hồ sơ theo kênh</caption>
                  <thead>
                    <tr style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)" }}>
                      <th scope="col" className="text-left px-3 py-2">Kênh</th>
                      <th scope="col" className="text-left px-3 py-2">Loại</th>
                      <th scope="col" className="text-right px-3 py-2">Mở link</th>
                      <th scope="col" className="text-right px-3 py-2">Xem hết hồ sơ</th>
                      <th scope="col" className="text-right px-3 py-2">Tỉ lệ xem hết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(r => (
                      <tr key={r.channel} style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                        <th scope="row" className="text-left px-3 py-2 font-mono font-normal">{r.channel}</th>
                        <td className="px-3 py-2">{r.groupLabel}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.opens}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.fulls}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(r.fullRate)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "2px solid var(--kin-vien-thuong)", fontWeight: 700 }}>
                      <th scope="row" className="text-left px-3 py-2" colSpan={2}>Tổng</th>
                      <td className="px-3 py-2 text-right tabular-nums">{data.totals.opens}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{data.totals.fulls}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(data.totals.opens > 0 ? Math.min(1, data.totals.fulls / data.totals.opens) : null)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>
              Các bước sau (đăng ký học thử, học thử xong, nhận lớp) chưa đo được vì chưa có form đăng ký học thử.
            </p>
          </section>

          <section aria-labelledby="h-bc">
            <h2 id="h-bc" className="text-sm font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
              Báo cáo hồ sơ chờ xử lý ({data.reportsOpen}) · hồ sơ đang bị khoá: {data.lockedProfiles}
            </h2>
            {data.reports.length === 0 ? (
              <p role="status" className="rounded-xl p-5 text-sm text-center" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>Không có báo cáo nào đang chờ.</p>
            ) : (
              <ul className="space-y-2">
                {data.reports.map(rep => (
                  <li key={rep.id} className="rounded-xl p-4" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{rep.tutorName}</p>
                        <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{rep.reasonLabel}</p>
                        {rep.detail && <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>{rep.detail}</p>}
                        <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>
                          {new Date(rep.createdAt).toLocaleString("vi-VN")}{rep.channel ? ` · kênh ${rep.channel}` : ""}
                          {rep.openForTutor > 1 ? ` · gia sư này có ${rep.openForTutor} báo cáo đang chờ` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <a href={`/mentor/${rep.tutorId}`} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg text-sm underline min-h-[44px] inline-flex items-center" style={{ color: "var(--kin-th-xanh-link)" }}>Xem hồ sơ</a>
                        <button type="button" disabled={busy === rep.id} onClick={() => void dismiss(rep)} className="px-3 py-2 rounded-lg text-sm min-h-[44px] disabled:opacity-60" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>Bỏ qua</button>
                        <button type="button" disabled={busy === rep.id} onClick={() => { setLocking(rep); setReason(""); }} className="px-3 py-2 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-60" style={{ background: "var(--kin-tt-chu-loi)", color: "#fff" }}>Khoá hồ sơ</button>
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
            <button type="button" onClick={() => setLocking(null)} className="px-4 py-2 rounded-lg text-sm min-h-[44px]">Đóng</button>
            <button type="button" disabled={!reason.trim() || busy === locking.id} onClick={() => void lock()} className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-60" style={{ background: "var(--kin-tt-chu-loi)", color: "#fff" }}>Khoá hồ sơ</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
