// SCL đợt 5 (D8, tình huống 11–12) — khối "Học thử" ở tab Học sinh của lớp (chủ lớp / quản trị trung tâm). Server Component: mỗi em học thử một hàng, nhãn trạng thái
// (Học thử · còn N ngày / Chưa bắt đầu / Hết hạn / Chờ xác nhận chính thức) + hai form POST + 303: "Xác nhận chính thức" và "Gia hạn 7 ngày". Lớp không có em học thử ⇒ không vẽ gì.
import { prisma } from "@/lib/prisma";
import { KinCallout, KinSectionHead, KinStatus, kinButtonClass } from "@/components/kin";
import { trialLabel, trialState } from "@/lib/trial";

export default async function TrialRoster({ courseId, flash }: { courseId: string; flash?: string | null }) {
  const rows = await prisma.enrollment.findMany({
    where: { courseId, trialDays: { not: null }, status: { in: ["active", "trial_expired"] } }, orderBy: { createdAt: "asc" },
    select: { id: true, status: true, trialDays: true, trialStartedAt: true, trialConvertRequestedAt: true, user: { select: { name: true } } },
  });
  if (rows.length === 0) return null;
  const now = new Date();
  const action = `/api/tutor/lop/${encodeURIComponent(courseId)}/hoc-thu`;
  return (
    <section aria-labelledby="lop-hoc-thu" data-lop-hoc-thu className="mb-8 max-w-3xl">
      <KinSectionHead id="lop-hoc-thu" title="Học thử" aside={`${rows.length} em`} />
      {flash === "ok" && <p role="status" className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-xong)]">Đã cập nhật học thử.</p>}
      {flash === "loi" && <p role="alert" className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">Chưa cập nhật được, thử lại sau.</p>}
      <ul>
        {rows.map(r => {
          const expired = r.status === "trial_expired" || trialState(r, now).kind === "het_han";
          const label = r.trialConvertRequestedAt ? "Chờ xác nhận chính thức" : expired ? "Hết hạn" : trialLabel(r, now);
          return (
            <li key={r.id} data-hoc-thu-row={r.id} className="flex flex-wrap items-center justify-between gap-3 py-[var(--kin-kc-5)] border-b border-[var(--kin-vien-nhat)]">
              <div className="min-w-0">
                <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{r.user.name}</p>
                <KinStatus tone={r.trialConvertRequestedAt ? "cho" : expired ? "qua-han" : "mo"}><span data-hoc-thu-nhan>{label}</span></KinStatus>
              </div>
              <div className="flex flex-wrap gap-2">
                <form method="post" action={action}><input type="hidden" name="enrollmentId" value={r.id} /><input type="hidden" name="action" value="xac-nhan" />
                  <button type="submit" data-hoc-thu-xac-nhan className={kinButtonClass("primary")}>Xác nhận chính thức</button></form>
                <form method="post" action={action}><input type="hidden" name="enrollmentId" value={r.id} /><input type="hidden" name="action" value="gia-han" />
                  <button type="submit" data-hoc-thu-gia-han className={kinButtonClass("secondary")}>Gia hạn 7 ngày</button></form>
              </div>
            </li>
          );
        })}
      </ul>
      <KinCallout className="mt-3">Học thử tính 14 ngày từ lần đầu em mở lớp. Xác nhận chính thức thì bỏ hạn, bài đã nộp và điểm vẫn giữ.</KinCallout>
    </section>
  );
}
