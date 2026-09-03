"use client";

interface Props {
  courseName: string;
  price: number;
  originalPrice?: number;
  trialLessonsLeft?: number;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  closeLabel?: string;
}

export default function PopupBuyRequired({
  courseName, price, originalPrice, trialLessonsLeft = 0, onClose,
  title, subtitle, closeLabel = "Xem bài miễn phí khác",
}: Props) {
  const hasDiscount  = originalPrice && originalPrice > price;
  const discountPct  = hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl overflow-hidden"
        style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-3)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 text-center"
          style={{ background: "linear-gradient(135deg, #5645d4 0%, #7b3ff2 100%)" }}>
          <h2 className="text-lg font-extrabold text-white mb-1">{title ?? "Nội dung có giới hạn"}</h2>
          {subtitle ? (
            <p className="text-sm text-blue-100">{subtitle}</p>
          ) : trialLessonsLeft > 0 ? (
            <p className="text-sm text-blue-100">Bạn còn <strong>{trialLessonsLeft} bài học thử</strong> miễn phí</p>
          ) : (
            <p className="text-sm text-blue-100">Hết lượt thử - Đăng ký để tiếp tục</p>
          )}
        </div>

        {/* Course info */}
        <div className="p-6">
          <div className="rounded-md p-4 mb-5"
            style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--stone)" }}>Khóa học</p>
            <p className="text-base font-extrabold" style={{ color: "var(--ink)" }}>{courseName}</p>
            <div className="flex items-center gap-3 mt-3">
              <div className="text-xl font-extrabold" style={{ color: "var(--color-primary)" }}>
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
                <span className="text-sm" style={{ color: "var(--slate)" }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Contact CTA */}
          <div className="rounded-md p-4 mb-3 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>Liên hệ để đăng ký</p>
            <p className="text-xs mb-3" style={{ color: "var(--steel)" }}>
              Chuyển khoản và nhắn admin để được kích hoạt khoá học
            </p>
            <a href="tel:0384409051" className="notion-btn-primary block w-full text-center text-sm">
              Gọi: 0384 409 051
            </a>
          </div>

          <button onClick={onClose} className="notion-btn-secondary w-full text-sm text-center">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
