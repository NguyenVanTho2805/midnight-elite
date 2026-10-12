// Trang dành cho phụ huynh — đích của link "Dành cho phụ huynh" ở chân trang.
// Phụ huynh không có tài khoản nên chỉ có một việc cần nói rõ: vào bằng đường dẫn riêng.
// Chữ lấy từ Figma "Đăng nhập" (node 32:21), phần ghi chú "Phụ huynh thì không cần đăng nhập".
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dành cho phụ huynh — KiN",
  description: "Phụ huynh không cần tài khoản. Gia sư gửi một đường dẫn riêng để xem buổi học và học phí của con.",
};

export default function PhuHuynhPage() {
  return (
    <div data-vung="sang" className="kin-chu-than mx-auto max-w-[560px] px-4 py-14 sm:py-20 text-[var(--kin-chu-chinh)]">
      <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight">
        Phụ huynh thì không cần đăng nhập
      </h1>
      <div className="mt-6 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-nhan)] p-5">
        <p className="text-[length:var(--kin-co-body)] leading-[1.6] text-[var(--kin-chu-phu)]">
          Gia sư gửi cho anh chị một đường dẫn riêng. Bấm vào là xem được buổi học và học phí của con — không tài khoản,
          không mật khẩu. Đường dẫn đó chính là chìa khoá, đừng chuyển cho người khác.
        </p>
      </div>
      <p className="mt-6 text-[length:var(--kin-co-small)] leading-[1.6] text-[var(--kin-chu-mo)]">
        Chưa nhận được đường dẫn, hoặc đường dẫn không mở được? Nhờ gia sư của con gửi lại.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center h-11 px-[18px] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-bang)] transition-colors"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
