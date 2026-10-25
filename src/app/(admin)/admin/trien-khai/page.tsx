// QT-03 — Triển khai và hạn mức (Figma 464:9220). CHỈ ĐỌC: cờ môi trường, lần gọi tác vụ định kỳ gần nhất, hạn mức gói đang cấu hình, số đo hiện có.
// Không có nút đổi cờ (cờ nằm ở biến môi trường trên Vercel, đổi xong phải triển khai lại) và không bịa hạn mức chưa có trong cấu hình
// (mẫu phiếu, dung lượng, Drive chưa có hạn mức: ghi "chưa có"). Hạn mức học sinh / lượt AI sửa ở trang Gói KiN Pro.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinCallout, KinSectionHead, KinSkeleton, KinStat, KinStatRow, KinStateCard, KinStatus } from "@/components/kin";
import { KinPage, KinPageHeader, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { callApi } from "@/components/tutor/shared";
import type { CronView, DeployEnvView, FlagView } from "@/lib/adminOps";
import { PER_IP_PER_HOUR, PER_PHONE_PER_DAY } from "@/lib/tutorRequest";

interface Payload {
  env: DeployEnvView; flags: FlagView[]; crons: CronView[];
  limits: { free: { studentLimit: number; aiExtractPerMonth: number }; pro: { studentLimit: number; aiExtractPerMonth: number } };
  measure: { tutors: number; byState: Record<"ok" | "warn" | "blocked" | "over", number>; maxStudents: number; shadowWouldBlock30d: number; enforcedBlocked30d: number; aiExtractThisMonth: number; proNow: number };
  generatedAt: string;
}

export default function TrienKhaiPage() {
  return <PermissionGuard required={PERMISSIONS.MANAGE_REVENUE}><Content /></PermissionGuard>;
}

const GRID = "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)] md:gap-4";

function Content() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>("/api/admin/trien-khai");
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const trial = data?.flags.find(f => f.key === "KIN_TRIAL_MODE");
  return (
    <KinPage>
      <KinPageHeader title="Triển khai và hạn mức"
        sub="Màn này chỉ để XEM trạng thái. Cờ đổi ở biến môi trường trên Vercel rồi triển khai lại; hạn mức sửa ở trang Gói KiN Pro."
        actions={<>{trial && <KinStatus tone={trial.on ? "xong" : "mo"}>Miễn phí toàn bộ · {trial.state}</KinStatus>}<Link href="/admin/goi-pro" className="inline-flex items-center min-h-11 px-3 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-link)] hover:underline">Mở Gói KiN Pro</Link></>} />
      {loading && !data ? <KinSkeleton widths={[100, 80, 60]} />
        : failed || !data ? (
          <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được trạng thái triển khai" status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
            actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}><p>Thử lại sau ít giây.</p></KinStateCard>
        ) : (
          <div className="space-y-[var(--kin-cach-muc)] max-w-5xl">
            <section aria-labelledby="h-co">
              <KinSectionHead id="h-co" title="Cờ triển khai" aside={`${data.env.label} · ${data.env.text}`} />
              <div className={`hidden md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.6fr)] md:gap-4 ${KIN_TABLE_HEAD}`}><span>Cờ</span><span>Trạng thái</span><span>Ý nghĩa</span></div>
              <ul data-testid="co-trien-khai">
                {data.flags.map(f => (
                  <li key={f.key} data-flag={f.key} data-on={f.on ? "1" : "0"} className={`md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.6fr)] md:gap-4 ${KIN_TABLE_ROW}`}>
                    <div><p className="text-[var(--kin-chu-chinh)]">{f.label}</p><p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)] font-mono break-all">{f.key}</p></div>
                    <div className="mt-1 md:mt-0"><KinStatus tone={f.on ? "xong" : "mo"}>{f.state}</KinStatus></div>
                    <p className="mt-1 md:mt-0 text-[var(--kin-chu-mo)]">{f.note}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Trang này chỉ cho biết đang bật hay tắt, không hiện giá trị của biến nào.</p>
            </section>

            <section aria-labelledby="h-cron">
              <KinSectionHead id="h-cron" title="Tác vụ định kỳ" aside="Lần gọi gần nhất đã qua xác thực" />
              <div className={`hidden md:grid ${GRID} ${KIN_TABLE_HEAD}`}><span>Tác vụ</span><span>Lịch</span><span>Lần gần nhất</span></div>
              <ul data-testid="cron-gan-nhat">
                {data.crons.map(c => (
                  <li key={c.key} data-cron={c.key} className={`${GRID} ${KIN_TABLE_ROW}`}>
                    <p className="text-[var(--kin-chu-chinh)]">{c.label}</p>
                    <p className="text-[var(--kin-chu-mo)]">{c.schedule}</p>
                    <div><KinStatus tone={c.tone}>{c.status}</KinStatus><p className="text-[var(--kin-chu-mo)]">{c.lastText}</p></div>
                  </li>
                ))}
              </ul>
              <KinCallout className="mt-3" title="Đây là lần được gọi, chưa phải bằng chứng chạy xong">KiN ghi lại lúc tác vụ được gọi và qua khoá. Nếu một tác vụ báo “Chậm so với lịch” hoặc “Chưa ghi nhận”, kiểm Cron trong Vercel và khoá CRON_SECRET.</KinCallout>
            </section>

            <section aria-labelledby="h-hm">
              <KinSectionHead id="h-hm" title="Hạn mức gói" aside={data.flags.find(f => f.key === "KIN_PLAN_ENFORCE")?.on ? "Đang áp dụng" : "Chưa áp dụng, chỉ đo"} />
              <div className={`hidden md:grid ${GRID} ${KIN_TABLE_HEAD}`}><span>Hạn mức</span><span>Free</span><span>Pro</span></div>
              <ul data-testid="han-muc">
                <li className={`${GRID} ${KIN_TABLE_ROW}`}><span>Học sinh đang học</span><span>{data.limits.free.studentLimit}</span><span>{data.limits.pro.studentLimit}</span></li>
                <li className={`${GRID} ${KIN_TABLE_ROW}`}><span>Lượt AI trích đề mỗi tháng</span><span>{data.limits.free.aiExtractPerMonth}</span><span>{data.limits.pro.aiExtractPerMonth}</span></li>
                <li className={`${GRID} ${KIN_TABLE_ROW}`}><span>Mẫu phiếu</span><span className="text-[var(--kin-chu-mo)] md:col-span-2">Chưa có hạn mức trong cấu hình</span></li>
                <li className={`${GRID} ${KIN_TABLE_ROW}`}><span>Dung lượng lưu trữ</span><span className="text-[var(--kin-chu-mo)] md:col-span-2">Chưa có hạn mức; KiN chỉ đo dung lượng đã dùng của từng gia sư</span></li>
                <li className={`${GRID} ${KIN_TABLE_ROW}`}><span>Google Drive</span><span className="text-[var(--kin-chu-mo)] md:col-span-2">Chưa có tích hợp nên chưa có hạn mức</span></li>
              </ul>
              <KinStatRow className="mt-4">
                <KinStat label="Gia sư đang hoạt động" value={data.measure.tutors} />
                <KinStat label="Đang dùng gói Pro" value={data.measure.proNow} />
                <KinStat label="Nhiều học sinh nhất ở một gia sư" value={data.measure.maxStudents} hint={`so với trần Free ${data.limits.free.studentLimit}`} />
                <KinStat label="Lượt AI trích đề tháng này" value={data.measure.aiExtractThisMonth} />
              </KinStatRow>
              <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-testid="phan-bo-han-muc">
                Nếu áp trần Free cho mọi gia sư: {data.measure.byState.ok} còn thoải mái, {data.measure.byState.warn} từ 80% trở lên, {data.measure.byState.blocked} chạm trần, {data.measure.byState.over} vượt trần. Trong 30 ngày qua cổng “sẽ chặn” {data.measure.shadowWouldBlock30d} lần, đã chặn thật {data.measure.enforcedBlocked30d} lần.
              </p>
            </section>

            <section aria-labelledby="h-spam">
              <KinSectionHead id="h-spam" title="Chống spam yêu cầu gia sư" />
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <KinStat label="Theo số điện thoại" value={`${PER_PHONE_PER_DAY} yêu cầu / ngày`} />
                <KinStat label="Theo địa chỉ IP" value={`${PER_IP_PER_HOUR} yêu cầu / giờ`} />
              </div>
              <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Giới hạn đang đặt trong mã, không có công tắc sửa ở đây. KiN không dùng mã OTP trả phí cho khách gửi yêu cầu.</p>
            </section>

            <KinCallout title="Chưa triển khai">Trợ giảng, nhiều giáo viên trong một tài khoản và tin tự động qua Zalo OA chưa có (Zalo OA đang khoá). Màn này chỉ hiện những gì thật sự đang chạy.</KinCallout>
          </div>
        )}
    </KinPage>
  );
}
