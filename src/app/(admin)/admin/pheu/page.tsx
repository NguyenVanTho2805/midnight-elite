// PH-210 / PH-212 — bảng phễu của quản trị: lượt mở / xem hết hồ sơ công khai theo kênh (?n=) và số báo cáo hồ sơ đang chờ (xử lý ở Hàng chờ).
// Quản lý trung tâm (admin_super, admin_content). Không đếm được bài đăng trong nhóm Facebook — chỉ đếm lượt bấm link.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KinButton, KinCallout, KinSectionHead, KinSkeleton, KinStateCard, KinStatus } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { callApi } from "@/components/tutor/shared";

interface Row { channel: string; group: string; groupLabel: string; opens: number; fulls: number; fullRate: number | null }
interface Payload { days: number; rows: Row[]; totals: { opens: number; fulls: number }; reportsOpen: number; lockedProfiles: number }

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export default function PheuPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_TUTORS}>
      <PheuContent />
    </PermissionGuard>
  );
}

function PheuContent() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
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
            <KinSectionHead id="h-bc" title="Báo cáo hồ sơ" />
            <p data-bao-cao-cho className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
              {data.reportsOpen} báo cáo chờ → <Link href="/admin/kiem-duyet?loai=ho-so" className="font-medium underline text-[var(--kin-nhan-link)]">Hàng chờ</Link> · hồ sơ đang bị khoá: {data.lockedProfiles}
            </p>
          </section>
        </>
      )}

    </div>
  );
}
