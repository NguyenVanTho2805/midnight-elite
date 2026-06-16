import { Lock, Robot, ClipboardList, Flash, ChartBar, Trophy } from "griddy-icons";

const features = [
  {
    Icon: Lock,
    title: "Bảo mật tuyệt đối",
    description: "Video HLS + AES-128. Watermark động in Email/IP người xem. Giới hạn 2 thiết bị đăng nhập đồng thời. Không thể tải lậu.",
    detail: "Công nghệ: HLS Streaming · DRM · Redis Session",
  },
  {
    Icon: Robot,
    title: "AI giải bài 24/7",
    description: "Trợ lý AI (RAG) đọc giáo trình Midnight Elite, trả lời chính xác và dẫn thẳng đến phút trong video cần xem lại.",
    detail: "Powered by: Claude AI · Vector Database · RAG",
  },
  {
    Icon: ClipboardList,
    title: "Thi thử qua Azota",
    description: "Đề thi mô phỏng thực tế từ Azota, tích hợp trực tiếp vào lộ trình học. Không cần tìm link — hệ thống dẫn tự động.",
    detail: "Tích hợp: Azota VIP · Auto-redirect · Log tracking",
  },
  {
    Icon: Flash,
    title: "Mở khóa trong 3 giây",
    description: "Quét QR → chuyển khoản → quyền truy cập kích hoạt tự động. Không cần nhân viên duyệt. Hoạt động 24/7 kể cả 12 giờ đêm.",
    detail: "Công nghệ: VietQR · Webhook · PayOS/Sepay",
  },
  {
    Icon: ChartBar,
    title: "Theo dõi tiến độ thực",
    description: "Hệ thống Heartbeat ghi nhận thời gian xem mỗi 10 giây. Progress bar, badge hoàn thành, lưu điểm xem cuối.",
    detail: "Chỉ số: Completion Rate · GPA · Attendance",
  },
  {
    Icon: Trophy,
    title: "Kỷ luật & Khen thưởng",
    description: "Strike system 3 mức tự động. Gamification EXP, badge Xuất sắc, học bổng tháng cho Top 3. Học sinh tự tạo động lực.",
    detail: "Tính năng: Strikes · EXP · Monthly Scholarship",
  },
];

export default function Features() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: "#F0F5FF" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff", color: "#0068FF" }}
          >
            Tại sao chọn Midnight Elite
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: "#1E2938" }}>
            Hệ sinh thái học tập <span style={{ color: "#0068FF" }}>khép kín</span>
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: "#6B7280" }}>
            Từ video bài giảng, thi thử, hỏi AI đến thanh toán tự động — mọi thứ trong một nền tảng duy nhất.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl p-6 group cursor-default"
              style={{ background: "#F0F5FF", boxShadow: "10px 10px 20px #C5D0EA, -10px -10px 20px #ffffff" }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "#F0F5FF", boxShadow: "5px 5px 10px #C5D0EA, -5px -5px 10px #ffffff", color: "#0068FF" }}
              >
                <feature.Icon size={28} />
              </div>

              {/* Content */}
              <h3 className="text-base font-bold mb-2" style={{ color: "#1E2938" }}>{feature.title}</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#6B7280" }}>{feature.description}</p>

              {/* Tech badge */}
              <div
                className="px-3 py-2 rounded-xl text-xs"
                style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff", color: "#0068FF", fontFamily: "monospace" }}
              >
                {feature.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
