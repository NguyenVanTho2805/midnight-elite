// BU-06 — tab "Chỉ số": bốn ô số tự động từ sổ lớp, thay cho sao/điểm (ĐX-05). Chỉ số 0 hiện "—", không in chữ tiêu cực.
import type { TutorDetailResponse } from "./kieu";

const nf = (n: number) => (n > 0 ? n.toLocaleString("vi-VN") : "—");

export function ChiSoHoSo({ stats, verifiedAt }: { stats: TutorDetailResponse["stats"]; verifiedAt: string | null }) {
  const since = verifiedAt ? new Date(verifiedAt) : null;
  const sinceText = since && !Number.isNaN(since.getTime()) ? `${String(since.getUTCMonth() + 1).padStart(2, "0")}/${since.getUTCFullYear()}` : null;
  const cells: { label: string; value: string }[] = [
    { label: "Lớp đang dạy", value: nf(stats.classCount) },
    { label: "Học sinh đang dạy", value: nf(stats.studentCount) },
    { label: "Buổi đã dạy theo sổ lớp", value: nf(stats.sessionsTaught) },
  ];
  return (
    <div className="flex flex-col gap-4" data-tab-chi-so>
      <dl className="m-0 grid grid-cols-2 gap-3">
        {cells.map(c => (
          <div key={c.label} className="flex flex-col gap-1 rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] p-4">
            <dd className="m-0 text-[length:var(--kin-co-so)] font-medium text-[var(--kin-chu-chinh)]">{c.value}</dd>
            <dt className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{c.label}</dt>
          </div>
        ))}
        <div className="flex flex-col gap-1 rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] p-4">
          <dd className="m-0 text-[length:var(--kin-co-body)] font-medium text-[var(--kin-chu-chinh)]">{stats.recentlyActive ? "Có dạy trong 30 ngày qua" : "—"}</dd>
          <dt className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Hoạt động gần đây</dt>
        </div>
      </dl>
      {sinceText && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Tham gia KiN từ {sinceText}</p>}
      <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
        Chỉ số do hệ thống tổng hợp từ sổ lớp gia sư tự ghi, chỉ đọc; KiN chưa xác minh. Không hiển thị thông tin học sinh.
      </p>
    </div>
  );
}
