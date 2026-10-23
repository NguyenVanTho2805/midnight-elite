// Khung riêng cho trang PHỤ HUYNH mở bằng link (phiếu học phí, Sổ của con) — không cần tài khoản.
// Cố ý KHÔNG dùng khung (guest): ở đó có thanh menu bán khoá học, nút "Bắt đầu miễn phí", chân trang quảng bá và thanh điều hướng dưới của học viên
// — phụ huynh đang xem số tiền phải đóng nên không nên thấy những thứ đó. Không có loading.tsx để link sai trả 404 thật.
import { KinLogo } from "@/components/kin/KinLogo";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--kin-nen-trang)" }}>
      <header style={{ borderBottom: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-bang)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <KinLogo size={28} textSize="var(--kin-co-body)" color="var(--kin-chu-chinh)" />
          <span className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>Trang riêng cho phụ huynh</span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
        <p className="max-w-5xl mx-auto px-4 sm:px-6 py-4 text-caption text-center sm:text-left" style={{ color: "var(--kin-chu-mo)" }}>
          Đường dẫn này dành riêng cho bạn và không cần tài khoản. Đừng chuyển tiếp cho người khác.
        </p>
      </footer>
    </div>
  );
}
