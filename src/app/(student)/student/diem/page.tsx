// SCL-C (P1-1, HS4) — "Điểm" của học sinh; SCL-G-HS: theo bản chốt khung 3 (theo lớp, x/10, Trung bình, ngày chấm/nộp). Bố cục ở components/student/KetQua.
// Cùng khung với Cần làm và trang lớp (lề 16px điện thoại, rộng tối đa 800px) để ba màn học sinh trông như một ứng dụng.
import type { Metadata } from "next";
import KetQua from "@/components/student/KetQua";

export const metadata: Metadata = { title: "Điểm — KiN" };

export default function DiemPage() {
  return (
    <div className="px-4 md:px-10 pt-5 md:pt-8 pb-10 max-w-[800px] bg-[var(--kin-nen-trang)]">
      <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-bold tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Điểm</h1>
      <p className="mt-1 mb-6 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Trung bình chỉ tính các bài đã có điểm. Điểm bạn tự khai cần gia sư duyệt mới được tính.</p>
      <KetQua />
    </div>
  );
}
