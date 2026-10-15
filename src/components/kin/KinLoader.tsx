// Biểu tượng lúc đang tải (15/10/2026, Thọ: "đổi biểu tượng lúc loading thành logo mới của tôi"). Thay cho ô chữ "T" cũ và các hàng 3 chấm nhảy rải rác.
// Dùng chính KinMark (src/components/kin/KinLogo.tsx): sau này đổi logo ở đó thì màn chờ đổi theo, không phải sửa từng chỗ.
// Chuyển động (CSS .kin-loader ở src/app/kin-tokens.css): thân chữ K đứng yên, ba lưỡi sáng lần lượt; người đặt "giảm chuyển động" thì logo đứng yên.
// role="status" + chữ ẩn cho trình đọc màn hình ("Đang tải"), vì bản thân logo là hình trang trí (aria-hidden).
import { KinMark } from "./KinLogo";

export function KinLoader({ size = 40, label = "Đang tải", className = "" }: { size?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" data-kin-loader className={`kin-loader inline-flex items-center justify-center ${className}`}>
      <KinMark size={size} />
      <span className="sr-only">{label}</span>
    </div>
  );
}
