// Trang chủ — khối "Tính điểm xét tuyển": dùng lại công cụ TinhDiemChuan (tính NGAY ở trình duyệt, không gửi gì lên máy chủ, KiN không lưu điểm nhập). Công thức do page.tsx đọc ở máy chủ
// (trang tĩnh làm mới theo giờ, nên công thức mới công khai có thể trễ tới 1 giờ). Chưa có công thức công khai → thẻ dẫn sang /diem-chuan (điểm chuẩn có nguồn từng dòng).
import Link from "next/link";
import TinhDiemChuan from "@/app/(guest)/diem-chuan/TinhDiemChuan";
import type { PublicFormula } from "@/lib/admissionFormula";
import { kinButtonClass } from "@/components/kin/buttonClass";

export default function HomeScore({ formulas }: { formulas: PublicFormula[] }) {
  return (
    <section data-home-block="score" data-home-state={formulas.length > 0 ? "ok" : "empty"} className="bg-[var(--kin-nen-trang)] pt-2 pb-10">
      <div className="mx-auto max-w-[760px] px-4 sm:px-8">
        {formulas.length > 0 ? <TinhDiemChuan formulas={formulas} /> : (
          <div className="rounded-[var(--kin-bo-xl)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-[var(--kin-kc-8)]">
            <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight text-[var(--kin-chu-chinh)]">Tra cứu điểm chuẩn</h2>
            <p className="mt-2 text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-phu)]">KiN chưa có công thức tính điểm nào được công khai. Bạn vẫn xem được điểm chuẩn các trường, có dẫn nguồn từng dòng.</p>
            <Link href="/diem-chuan" className={`${kinButtonClass("primary")} mt-4 w-full sm:w-auto`}>Mở Tra cứu điểm chuẩn</Link>
          </div>
        )}
      </div>
    </section>
  );
}
