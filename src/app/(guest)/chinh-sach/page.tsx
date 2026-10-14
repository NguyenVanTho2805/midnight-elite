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
          style={{ background: "var(--kin-nhan-nen)" }}>
          <Shield size={28} style={{ color: "white" }} />
        </div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>Chính sách & Điều khoản</h1>
        <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Mô tả cách KiN thu thập và dùng dữ liệu, và các quy tắc khi dùng KiN.</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={activeTab === id
              ? { background: "var(--kin-nhan-nen)", color: "white", borderRadius: "8px" }
              : { background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content card */}
      <div className="rounded-xl p-8 space-y-8" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        {activeTab === "privacy" && <PrivacyContent />}
        {activeTab === "terms" && <TermsContent />}
        {activeTab === "cookie" && <CookieContent />}
      </div>

      {/* Contact box */}
      <div className="rounded-xl p-5 flex items-start gap-3"
        style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
        <InfoCircle size={20} style={{ color: "var(--kin-nhan-link)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="font-semibold text-sm mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Có thắc mắc về chính sách?</p>
          <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>
            Gọi hoặc nhắn Zalo{" "}
            <a href="tel:0384409051" className="font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
              0384 409 051
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold mb-3 pb-2" style={{ color: "var(--kin-chu-chinh)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--kin-chu-phu)" }}>{children}</div>
    </section>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-8">
      <Section title="1. Thông tin KiN thu thập">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Tài khoản:</strong> họ tên, email, số điện thoại, trường, tỉnh/thành; với học sinh có thể thêm số điện thoại của phụ huynh.</li>
          <li><strong>Học tập trong lớp:</strong> bài làm, điểm thi thử, điểm danh, buổi học, phiếu học phí và lịch sử đóng học phí trong lớp của gia sư.</li>
          <li><strong>Dữ liệu kỹ thuật:</strong> địa chỉ IP và trình duyệt, chỉ để chống lạm dụng (giới hạn số lần thử đăng nhập, xin mã) — không dùng để quảng cáo.</li>
          <li><strong>Chuyển khoản học phí:</strong> khi gia sư nối tài khoản nhận học phí, nội dung chuyển khoản được lưu để đối soát với phiếu.</li>
        </ul>
      </Section>
      <Section title="2. Mục đích sử dụng">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Chạy lớp học: lịch, điểm danh, học phí, thi thử, cộng đồng lớp.</li>
          <li>Xác thực và bảo vệ tài khoản (mã đăng nhập 6 số, phiên đăng nhập).</li>
          <li>Gửi thư hoặc tin nhắn liên quan trực tiếp đến tài khoản: mã đăng nhập, xác minh email, đặt lại mật khẩu.</li>
          <li>Gia sư soạn sẵn tin nhắc lịch, phiếu học phí gửi phụ huynh qua Zalo; gia sư tự bấm gửi — KiN không gửi thay.</li>
        </ul>
      </Section>
      <Section title="3. Chia sẻ thông tin">
        <p>KiN <strong>không bán</strong> thông tin cá nhân. Thông tin chỉ đến những nơi sau:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Gia sư của lớp</strong> thấy dữ liệu của học sinh trong lớp đó. <strong>Phụ huynh</strong> xem buổi học và học phí của con qua đường dẫn riêng do gia sư gửi.</li>
          <li><strong>Nhà cung cấp hạ tầng</strong> vận hành KiN: Vercel (máy chủ), Neon (cơ sở dữ liệu), Cloudinary (ảnh, tệp tải lên), Gmail (gửi thư), nhà cung cấp SMS khi đăng nhập bằng số điện thoại được bật, SePay khi gia sư kết nối tài khoản nhận học phí.</li>
          <li><strong>Dịch vụ AI của Google</strong> khi gia sư hoặc quản trị dùng tính năng nhập đề bằng AI hoặc tìm câu hỏi trùng: nội dung đề được gửi đi để xử lý.</li>
          <li>Khi cơ quan pháp luật có thẩm quyền yêu cầu.</li>
        </ul>
      </Section>
      <Section title="4. Bảo mật">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Mật khẩu được băm bằng bcrypt, KiN không lưu mật khẩu gốc.</li>
          <li>Mã đăng nhập 6 số chỉ lưu dạng băm, sống 10 phút, dùng một lần; sai 5 lần thì khoá đăng nhập bằng email hoặc số điện thoại đó 15 phút.</li>
          <li>Phiên đăng nhập nằm trong cookie HttpOnly: 30 ngày cho học sinh và gia sư (gia hạn mỗi lần dùng), 12 giờ cho quản trị (không gia hạn).</li>
          <li>Kết nối qua HTTPS.</li>
        </ul>
      </Section>
      <Section title="5. Quyền của bạn">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Xem và sửa thông tin cá nhân trong phần Hồ sơ.</li>
          <li>Yêu cầu xoá tài khoản hoặc xuất dữ liệu của mình bằng cách liên hệ KiN (hotline hoặc Zalo ở trên).</li>
        </ul>
      </Section>
      <Section title="6. Lưu trữ">
        <p>Dữ liệu được lưu khi tài khoản còn hoạt động. Dữ liệu pháp luật yêu cầu lưu giữ (như chứng từ học phí) có thể được giữ lại theo quy định.</p>
      </Section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-8">
      <Section title="1. Chấp nhận điều khoản">
        <p>Khi tạo tài khoản và dùng KiN, bạn đồng ý với các điều khoản này. Nếu không đồng ý, vui lòng không dùng dịch vụ.</p>
      </Section>
      <Section title="2. Tài khoản">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Mỗi tài khoản có <strong>một vai trò</strong>: học sinh hoặc gia sư. Cần cả hai vai thì tạo hai tài khoản với hai email khác nhau.</li>
          <li>Bạn chịu trách nhiệm giữ kín thông tin đăng nhập và không chia sẻ tài khoản cho người khác.</li>
          <li>KiN có thể tạm khoá hoặc xoá tài khoản vi phạm điều khoản.</li>
        </ul>
      </Section>
      <Section title="3. Quy tắc cộng đồng">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Không gian lận, sao chép trong bài kiểm tra và thi thử.</li>
          <li>Không đăng nội dung xúc phạm, spam hoặc không liên quan đến học tập.</li>
          <li>Không quay video, chụp màn hình bài giảng hoặc đề thi để phát tán khi chưa được phép.</li>
          <li>Bài đăng bị báo cáo sẽ được gia sư hoặc quản trị xem xét và có thể bị xoá.</li>
        </ul>
      </Section>
      <Section title="4. Học phí">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Học phí do <strong>gia sư thu trực tiếp</strong>, chuyển khoản vào tài khoản của gia sư.</li>
          <li>KiN giúp gia sư lập phiếu và đối soát chuyển khoản, nhưng không thu hộ và không giữ tiền của học sinh hay phụ huynh.</li>
          <li>Việc hoàn học phí do gia sư và phụ huynh tự thoả thuận.</li>
        </ul>
      </Section>
      <Section title="5. Quyền sở hữu nội dung">
        <p>Bài giảng, tài liệu và đề thi thuộc quyền của người đăng tải (gia sư hoặc KiN). Không sao chép hay phân phối khi chưa được phép.</p>
      </Section>
      <Section title="6. Giới hạn trách nhiệm">
        <p>KiN không chịu trách nhiệm về kết quả thi thật của học sinh. Kết quả phụ thuộc vào nỗ lực của từng người.</p>
      </Section>
    </div>
  );
}

function CookieContent() {
  return (
    <div className="space-y-8">
      <Section title="1. Cookie là gì?">
        <p>Cookie là tệp văn bản nhỏ lưu trên thiết bị của bạn khi truy cập KiN. Chúng giúp trang nhớ bạn đã đăng nhập.</p>
      </Section>
      <Section title="2. KiN dùng những gì">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Cookie đăng nhập (bắt buộc):</strong> giữ trạng thái đăng nhập. Không thể tắt; tắt trong trình duyệt thì bạn phải đăng nhập lại mỗi lần.</li>
          <li><strong>Cài đặt giao diện:</strong> ghi nhớ chủ đề màu bạn chọn.</li>
        </ul>
      </Section>
      <Section title="3. Bên thứ ba">
        <p>KiN hiện không dùng cookie quảng cáo và không gắn công cụ phân tích như Google Analytics hay Hotjar. Video nhúng từ YouTube (ví dụ video giới thiệu khoá học) có thể đặt cookie của YouTube khi bạn bấm xem.</p>
      </Section>
      <Section title="4. Quản lý cookie">
        <p>Bạn có thể xoá hoặc chặn cookie trong cài đặt trình duyệt.</p>
      </Section>
    </div>
  );
}
