// BU-06 — hai nút liên hệ ngang hàng: "Nhắn Zalo" (chỉ khi gia sư bật) và "Gửi yêu cầu" (biểu mẫu khách KH-04, không cần đăng nhập).
// Không có nhắn riêng/đặt lịch/thanh toán trên KiN: Zalo là liên kết ngoài do gia sư tự bật.
import KinLinkButton from "@/components/tutor/KinLinkButton";

export function LienHeHoSo({ tutorId, zalo, className = "" }: { tutorId: string; zalo: string | null; className?: string }) {
  return (
    <div className={`gap-3 ${className}`} data-lien-he>
      {zalo && <div className="flex-1 [&>a]:w-full"><KinLinkButton external variant="secondary" href={`https://zalo.me/${zalo}`}>Nhắn Zalo</KinLinkButton></div>}
      <div className="flex-1 [&>a]:w-full"><KinLinkButton href={`/mentor/${tutorId}/yeu-cau`}>Gửi yêu cầu</KinLinkButton></div>
    </div>
  );
}
