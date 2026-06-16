"use client";

import { useState } from "react";
import { Shield, Lock, FileText, InfoCircle } from "griddy-icons";

const TABS = [
  { id: "privacy", label: "Chính sách bảo mật", Icon: Shield },
  { id: "terms", label: "Điều khoản sử dụng", Icon: FileText },
  { id: "cookie", label: "Cookie", Icon: Lock },
];

export default function ChinhSachPage() {
  const [activeTab, setActiveTab] = useState("privacy");

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto"
          style={{ background: "#0068FF" }}>
          <Shield size={28} style={{ color: "white" }} />
        </div>
        <h1 className="text-3xl font-bold" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>Chính sách & Điều khoản</h1>
        <p className="text-sm" style={{ color: "#787671" }}>Cập nhật lần cuối: 01/05/2026 · Midnight Elite cam kết bảo vệ quyền lợi người dùng</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={activeTab === id
              ? { background: "#0068FF", color: "white", borderRadius: "8px" }
              : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content card */}
      <div className="rounded-xl p-8 space-y-8" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        {activeTab === "privacy" && <PrivacyContent />}
        {activeTab === "terms" && <TermsContent />}
        {activeTab === "cookie" && <CookieContent />}
      </div>

      {/* Contact box */}
      <div className="rounded-xl p-5 flex items-start gap-3"
        style={{ background: "#dbeafe", border: "1px solid #bfdbfe" }}>
        <InfoCircle size={20} style={{ color: "#0068FF", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="font-semibold text-sm mb-1" style={{ color: "#1a1a1a" }}>Có thắc mắc về chính sách?</p>
          <p className="text-sm" style={{ color: "#37352f" }}>
            Liên hệ qua email{" "}
            <a href="mailto:support@tsixeducation.vn" className="font-semibold" style={{ color: "#0068FF" }}>
              support@tsixeducation.vn
            </a>{" "}
            hoặc fanpage Facebook Midnight Elite. Thời gian phản hồi trong vòng 24 giờ làm việc.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold mb-3 pb-2" style={{ color: "#1a1a1a", borderBottom: "1px solid #e5e3df" }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "#37352f" }}>{children}</div>
    </section>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-7">
      <Section title="1. Thông tin chúng tôi thu thập">
        <p>Midnight Elite thu thập các thông tin sau khi bạn đăng ký và sử dụng dịch vụ:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>Thông tin cá nhân:</strong> Họ tên, email, số điện thoại, trường THPT, năm thi, tỉnh/thành.</li>
          <li><strong>Thông tin học tập:</strong> Tiến độ bài học, điểm thi thử, streak học tập, EXP tích lũy.</li>
          <li><strong>Thông tin thiết bị:</strong> Địa chỉ IP, loại trình duyệt, hệ điều hành khi đăng nhập.</li>
          <li><strong>Thông tin thanh toán:</strong> Mã đơn hàng, phương thức thanh toán (chúng tôi không lưu thông tin thẻ ngân hàng).</li>
        </ul>
      </Section>
      <Section title="2. Mục đích sử dụng thông tin">
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Cung cấp và cải thiện dịch vụ học tập trực tuyến.</li>
          <li>Xác thực danh tính và bảo vệ tài khoản người dùng.</li>
          <li>Gửi thông báo lịch học, deadline, kết quả thi và các thông tin học thuật liên quan.</li>
          <li>Phân tích dữ liệu học tập để cá nhân hóa lộ trình học.</li>
          <li>Xử lý thanh toán và hỗ trợ khách hàng.</li>
        </ul>
      </Section>
      <Section title="3. Chia sẻ thông tin">
        <p>Midnight Elite <strong>không bán</strong> thông tin cá nhân của bạn cho bên thứ ba. Chúng tôi chỉ chia sẻ khi:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Có sự đồng ý của bạn.</li>
          <li>Yêu cầu của cơ quan pháp luật có thẩm quyền.</li>
          <li>Với đối tác thanh toán (VNPay, ngân hàng) để xử lý giao dịch.</li>
        </ul>
      </Section>
      <Section title="4. Bảo mật dữ liệu">
        <p>Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn công nghiệp:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Mã hóa mật khẩu bằng bcrypt (không lưu mật khẩu dạng thô).</li>
          <li>HTTPS/TLS cho toàn bộ kết nối.</li>
          <li>Giới hạn thiết bị đăng nhập đồng thời (tối đa 2 thiết bị).</li>
          <li>Tự động khóa tài khoản sau 5 lần đăng nhập sai liên tiếp.</li>
        </ul>
      </Section>
      <Section title="5. Quyền của người dùng">
        <p>Bạn có quyền:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Truy cập, chỉnh sửa thông tin cá nhân trong phần Hồ sơ.</li>
          <li>Yêu cầu xóa tài khoản và toàn bộ dữ liệu liên quan.</li>
          <li>Từ chối nhận email marketing (trong phần cài đặt thông báo).</li>
          <li>Yêu cầu xuất dữ liệu học tập của mình.</li>
        </ul>
      </Section>
      <Section title="6. Thời gian lưu trữ">
        <p>Dữ liệu học tập được lưu trữ trong suốt thời gian tài khoản hoạt động. Sau khi xóa tài khoản, dữ liệu sẽ bị xóa hoàn toàn trong vòng 30 ngày, ngoại trừ dữ liệu bắt buộc lưu theo quy định pháp luật (hóa đơn, giao dịch thanh toán — tối đa 5 năm).</p>
      </Section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-7">
      <Section title="1. Chấp nhận điều khoản">
        <p>Khi tạo tài khoản và sử dụng Midnight Elite, bạn đồng ý tuân thủ các điều khoản này. Nếu không đồng ý, vui lòng không sử dụng dịch vụ.</p>
      </Section>
      <Section title="2. Tài khoản người dùng">
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Mỗi người dùng chỉ được tạo <strong>một tài khoản duy nhất</strong>.</li>
          <li>Bạn chịu trách nhiệm bảo mật thông tin đăng nhập của mình.</li>
          <li>Không được chia sẻ tài khoản cho người khác — vi phạm sẽ bị khóa tài khoản vĩnh viễn.</li>
          <li>Midnight Elite có quyền tạm khóa hoặc xóa tài khoản vi phạm mà không cần báo trước.</li>
        </ul>
      </Section>
      <Section title="3. Quy tắc cộng đồng">
        <p>Học viên cần tuân thủ nội quy để duy trì môi trường học tập lành mạnh:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Không gian lận, sao chép trong các bài kiểm tra và thi thử.</li>
          <li>Không đăng nội dung xúc phạm, spam hoặc không liên quan đến học tập.</li>
          <li>Không quay video, chụp màn hình bài giảng để phát tán trái phép.</li>
          <li>Vi phạm sẽ được xử lý theo hệ thống gậy (Strike): 3 gậy → đình chỉ, tiếp tục vi phạm → đuổi học.</li>
        </ul>
      </Section>
      <Section title="4. Thanh toán và hoàn tiền">
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Giá khóa học được niêm yết bằng VND, đã bao gồm VAT.</li>
          <li>Thanh toán qua chuyển khoản ngân hàng hoặc VNPay. Đơn hàng tự hủy sau <strong>15 phút</strong> nếu chưa thanh toán.</li>
          <li>Hoàn tiền 100% trong vòng <strong>7 ngày</strong> kể từ ngày mua nếu chưa xem quá 20% nội dung.</li>
          <li>Sau 7 ngày hoặc đã xem trên 20% nội dung, không áp dụng hoàn tiền.</li>
        </ul>
      </Section>
      <Section title="5. Quyền sở hữu trí tuệ">
        <p>Toàn bộ nội dung bao gồm video bài giảng, tài liệu PDF, đề thi thử thuộc quyền sở hữu của Midnight Elite. Nghiêm cấm sao chép, phân phối dưới mọi hình thức khi chưa được cho phép bằng văn bản.</p>
      </Section>
      <Section title="6. Giới hạn trách nhiệm">
        <p>Midnight Elite không chịu trách nhiệm với kết quả thi thật của học viên. Chúng tôi cung cấp môi trường học tập và tài liệu tốt nhất có thể, nhưng kết quả phụ thuộc vào nỗ lực của từng cá nhân.</p>
      </Section>
    </div>
  );
}

function CookieContent() {
  return (
    <div className="space-y-7">
      <Section title="1. Cookie là gì?">
        <p>Cookie là các tệp văn bản nhỏ được lưu trên thiết bị của bạn khi truy cập Midnight Elite. Chúng giúp chúng tôi cải thiện trải nghiệm người dùng.</p>
      </Section>
      <Section title="2. Các loại cookie chúng tôi sử dụng">
        <ul className="list-disc list-inside space-y-2 ml-2">
          <li><strong>Cookie xác thực (bắt buộc):</strong> Duy trì trạng thái đăng nhập của bạn. Không thể tắt.</li>
          <li><strong>Cookie tùy chọn:</strong> Ghi nhớ cài đặt giao diện, ngôn ngữ, bộ lọc tìm kiếm.</li>
          <li><strong>Cookie phân tích:</strong> Theo dõi cách bạn sử dụng nền tảng (ẩn danh) để cải thiện sản phẩm.</li>
        </ul>
      </Section>
      <Section title="3. Quản lý cookie">
        <p>Bạn có thể xóa hoặc chặn cookie thông qua cài đặt trình duyệt. Lưu ý: tắt cookie xác thực sẽ khiến bạn phải đăng nhập lại mỗi lần truy cập.</p>
      </Section>
      <Section title="4. Cookie của bên thứ ba">
        <p>Chúng tôi sử dụng Google Analytics và Hotjar để phân tích hành vi người dùng. Các công cụ này có chính sách cookie riêng. Dữ liệu thu thập là ẩn danh và không gắn với tài khoản cá nhân.</p>
      </Section>
    </div>
  );
}
