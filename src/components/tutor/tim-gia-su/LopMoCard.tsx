// BU-06 — một hàng trong tab "Lớp đang mở": tên lớp (liên kết), số học sinh (chỉ số đếm), chỗ còn, nhãn "Miễn phí" và nút theo luật vào lớp.
// Không in giá lớp (Course.price không có trong API), không ★/điểm.
import Link from "next/link";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { VaoLopMienPhi, duocVaoLop, type NguoiXem } from "./VaoLopMienPhi";
import type { ProfileClassRow } from "./kieu";

export function LopMoCard({ c, viewer }: { c: ProfileClassRow; viewer: NguoiXem }) {
  const full = c.seatsLeft === 0;
  const joinable = duocVaoLop(c);
  return (
    <li data-class-row={c.id} className="flex flex-col gap-3 border-b border-[var(--kin-vien-nhat)] py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/khoa-hoc/${c.id}`} className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center text-[length:var(--kin-co-body)] font-medium text-[var(--kin-chu-chinh)] hover:underline">{c.name}</Link>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
          <span>{c.activeCount.toLocaleString("vi-VN")} học sinh</span>
          {c.seatsLeft !== null && <span>· {full ? "Đã đủ chỗ" : `Còn ${c.seatsLeft} chỗ`}</span>}
          {c.isFree && <span className="rounded-full border border-[var(--kin-vien-thuong)] px-2 py-0.5 text-[length:var(--kin-co-caption)] font-medium text-[var(--kin-tt-chu-xong)]">Miễn phí</span>}
        </p>
      </div>
      <div className="shrink-0">
        {joinable && viewer !== "staff"
          ? <VaoLopMienPhi course={c} viewer={viewer} />
          : <Link href={`/khoa-hoc/${c.id}`} className={`${kinButtonClass("secondary")} w-full sm:w-auto`}>Xem lớp</Link>}
      </div>
    </li>
  );
}
