// Điều hướng B1 (08/11/2026) — số liệu của Tổng quan cũ dời lên đầu Hộp việc (/lop-cua-toi), vì Hộp việc là trang chủ duy nhất của gia sư.
// Giữ NGUYÊN VẸN ba thẻ: "Học viên đang học", "Lớp đang dạy", "Đã thu tháng này" (cùng nguồn loadTutorDashboard, cùng định dạng vnd + KinMoney,
// thẻ tiền vẫn dẫn tới Doanh thu). Chỉ đọc, không đổi cách tính. "Việc cần làm" không dời: Hộp việc đã có khối "Cần cô xử lý" làm đúng việc đó.
// Server component: số lấy thẳng từ DB, truyền vào HopViec (client) qua prop `top`.
import Link from "next/link";
import { loadTutorDashboard } from "@/lib/tutorDashboard";
import { KinMoney } from "@/components/kin/MoneyVisibility";
import { featureOn, isLinkHidden } from "@/lib/features";

const CARD = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

export default async function TutorOverviewStats({ tutorId }: { tutorId: string }) {
  const d = await loadTutorDashboard(tutorId);
  const stats = [
    { key: "hoc-vien", label: "Học viên đang học", value: <>{String(d.totalStudents)}</>, sub: null as string | null, accent: "var(--kin-th-xanh-troi)", color: "var(--kin-chu-chinh)", href: null as string | null, wide: false },
    { key: "lop", label: "Lớp đang dạy", value: <>{`${d.openClasses}/${d.classes.length}`}</>, sub: "đang nhận học viên / tổng số lớp", accent: "var(--kin-th-xanh-link)", color: "var(--kin-chu-chinh)", href: null, wide: false },
    { key: "da-thu", label: "Đã thu tháng này", value: <KinMoney>{vnd(d.collectedThisMonth)}</KinMoney>, sub: "học phí vào tài khoản của bạn", accent: "var(--kin-tt-cham-xong)", color: "var(--kin-tt-chu-xong)", href: "/lop-cua-toi/doanh-thu", wide: true },
  ]
    // DG (14/11/2026): thẻ tiền chỉ khi cờ HOC_PHI mở; trang Doanh thu ẩn (KINH_DOANH) thì thẻ không còn là liên kết.
    .filter(s => s.key !== "da-thu" || featureOn("HOC_PHI"))
    .map(s => (s.href && isLinkHidden(s.href) ? { ...s, href: null } : s));
  return (
    <dl data-hv-overview className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
      {stats.map(s => {
        const inner = (<>
          <dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{s.label}</dt>
          <dd className="text-xl font-semibold mt-0.5 tabular-nums break-words" style={{ color: s.color }}>{s.value}</dd>
          {s.sub && <dd className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{s.sub}</dd>}
        </>);
        const style = { ...CARD, borderTop: `2px solid ${s.accent}` };
        const cls = `rounded-lg px-3 py-2.5 min-w-0 ${s.wide ? "col-span-2 sm:col-span-1" : ""}`;
        return s.href
          ? <Link key={s.key} href={s.href} data-hv-stat={s.key} className={`${cls} block min-h-11 hover:opacity-90`} style={style}>{inner}</Link>
          : <div key={s.key} data-hv-stat={s.key} className={cls} style={style}>{inner}</div>;
      })}
    </dl>
  );
}
