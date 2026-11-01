// CAT-01 — đang tải danh sách: khung bộ lọc + ô xám, có chữ cho trình đọc màn hình.
import { KinSkeleton } from "@/components/kin";

export default function KhoaHocLoading() {
  return (
    <div role="status" aria-busy="true" data-catalog-loading className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <p className="sr-only">Đang tải danh sách khoá học</p>
      <div className="mb-6 h-8 w-40 rounded-[var(--kin-bo-md)] bg-[var(--kin-vien-nhat)] animate-pulse" aria-hidden />
      <div className="mb-4 h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-md)] bg-[var(--kin-vien-nhat)] animate-pulse" aria-hidden />
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--kin-kc-7)]">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] p-[var(--kin-kc-6)]">
            <KinSkeleton widths={[100, 70, 45, 60]} />
          </div>
        ))}
      </div>
    </div>
  );
}
