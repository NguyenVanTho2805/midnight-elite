// Dải "Cần tư vấn?" ở hero trang chủ (BU-HS-LANDING 3.1). KHÔNG có ô nhập, không thu dữ liệu nào: chỉ hai liên kết gọi / nhắn Zalo đã có ở chân trang.
// Biểu mẫu đăng ký tư vấn CHƯA LÀM, chờ chủ (đặc tả 2.3). Component máy chủ, không hook, không prisma. Nằm trên nền navy (data-vung="sang"), nên màu chữ là trắng có độ đục.
import { HOME_CONTACT } from "@/lib/homeLanding";

const link = "inline-flex min-h-11 items-center font-semibold text-white underline underline-offset-4 hover:opacity-90 text-[length:var(--kin-co-small)]";

export default function HomeHeroContact() {
  return (
    <div data-home-hero-contact className="rounded-2xl border border-white/[0.12] bg-white/[0.06] px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-5">
        <p className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-body)] text-white">Cần tư vấn?</p>
        <a href={HOME_CONTACT.phoneHref} className={link}>Gọi {HOME_CONTACT.phoneText}</a>
        <a href={HOME_CONTACT.zaloHref} target="_blank" rel="noopener noreferrer" className={link}>Nhắn Zalo</a>
      </div>
      <p className="text-[length:var(--kin-co-caption)] text-white/[0.78]">Hỗ trợ: {HOME_CONTACT.hours}</p>
    </div>
  );
}
