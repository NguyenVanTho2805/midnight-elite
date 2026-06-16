"use client";

interface Props {
  courseName: string;
  price: number;
  originalPrice?: number;
  trialLessonsLeft?: number;
  onClose: () => void;
}

export default function PopupBuyRequired({ courseName, price, originalPrice, trialLessonsLeft = 0, onClose }: Props) {
  const hasDiscount  = originalPrice && originalPrice > price;
  const discountPct  = hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "#F0F5FF", boxShadow: "16px 16px 32px #C5D0EA, -16px -16px 32px #ffffff" }}>

        {/* Header */}
        <div className="p-6 text-center"
          style={{ background: "linear-gradient(135deg, #0068FF 0%, #2680FF 100%)" }}>
          <h2 className="text-lg font-extrabold text-white mb-1">Nội dung có giới hạn</h2>
          {trialLessonsLeft > 0 ? (
            <p className="text-sm text-blue-100">Bạn còn <strong>{trialLessonsLeft} bài học thử</strong> miễn phí</p>
          ) : (
            <p className="text-sm text-blue-100">Hết lượt thử - Đăng ký để tiếp tục</p>
          )}
        </div>

        {/* Course info */}
        <div className="p-6">
          <div className="rounded-2xl p-4 mb-5"
            style={{ background: "#F0F5FF", boxShadow: "inset 4px 4px 8px #C5D0EA, inset -4px -4px 8px #ffffff" }}>
            <p className="text-xs mb-1" style={{ color: "#9CA3AF" }}>Khóa học</p>
            <p className="text-base font-extrabold" style={{ color: "#1E2938" }}>{courseName}</p>
            <div className="flex items-center gap-3 mt-3">
              <div className="text-xl font-extrabold" style={{ color: "#0068FF" }}>
                {price.toLocaleString("vi-VN")}đ
              </div>
              {hasDiscount && (
                <span className="px-2 py-1 rounded-full text-xs font-extrabold"
                  style={{ background: "#fee2e2", color: "#991b1b" }}>
                  -{discountPct}% Sale
                </span>
              )}
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2 mb-5">
            {[
              "Truy cập toàn bộ bài giảng & tài liệu",
              "Xem lại Record không giới hạn",
              "Thi thử & nhận điểm GPA",
              "Hỏi đáp AI + Mentor 24/7",
              "Truy cập 12 tháng",
            ].map(b => (
              <div key={b} className="flex items-center gap-2">
                <span className="text-sm font-bold flex-shrink-0" style={{ color: "#00A63D" }}>✓</span>
                <span className="text-sm" style={{ color: "#4B5563" }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Contact CTA */}
          <div className="rounded-2xl p-4 mb-3 text-center"
            style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "#1E2938" }}>Liên hệ để đăng ký</p>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Chuyển khoản và nhắn admin để được kích hoạt khoá học
            </p>
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
            style={{ background: "#F0F5FF", boxShadow: "4px 4px 8px #C5D0EA, -4px -4px 8px #ffffff", color: "#6B7280" }}>
            Xem bài miễn phí khác
          </button>
        </div>
      </div>
    </div>
  );
}
