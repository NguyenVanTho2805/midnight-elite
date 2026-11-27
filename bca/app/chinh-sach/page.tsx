// Chính sách quyền riêng tư — trang công khai (không cần đăng nhập). Google yêu cầu có trang này mới cho
// "Publish" màn đăng nhập Google. Chủ lớp duyệt nội dung 27/11/2026 — đổi nội dung thì hỏi chủ lớp trước (cam kết với học sinh, phụ huynh).
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Chính sách quyền riêng tư · Kin Class", robots: { index: true } };

const LIEN_HE = "aod.tsix@gmail.com";

export default function ChinhSach() {
  const h2 = "mt-8 text-lg font-semibold";
  const p = "mt-2 text-text-2";
  return (
    <main className="mx-auto max-w-[640px] px-4 py-10 leading-relaxed">
      <p><Link href="/dang-nhap" className="inline-flex min-h-11 items-center font-semibold text-gold hover:underline">‹ Về trang đăng nhập</Link></p>
      <h1 className="mt-2 text-[26px] font-extrabold leading-tight">Chính sách quyền riêng tư</h1>
      <p className={p}>Kin Class là web quản lý lớp ôn thi BCA · ĐGNL học qua Google Meet. Trang này nói rõ web lưu thông tin gì của học sinh, phụ huynh và giáo viên, dùng vào việc gì và ai được xem. Cập nhật ngày 27/11/2026.</p>

      <h2 className={h2}>Thông tin web lưu</h2>
      <ul className={`${p} list-disc pl-5`}>
        <li>Thông tin trong phiếu đăng ký học: họ tên, trường, khối lớp, số điện thoại của học sinh và phụ huynh, họ tên phụ huynh, địa chỉ Gmail, mục tiêu học, các môn đăng ký.</li>
        <li>Thông tin trong quá trình học: môn đang học hoặc học thử, ngày bắt đầu và ngày hết hạn, điểm danh từng buổi, ghi chú của chủ lớp và giáo viên.</li>
        <li>Khi đăng nhập bằng Google: web chỉ nhận địa chỉ Gmail của bạn để biết bạn là ai trong lớp. Web không xin và không đọc thư, danh bạ, lịch, tệp hay bất kỳ dữ liệu nào khác trong tài khoản Google.</li>
        <li>Một cookie phiên đăng nhập trên trình duyệt của bạn, và lựa chọn giao diện sáng / tối.</li>
      </ul>

      <h2 className={h2}>Dùng vào việc gì</h2>
      <p className={p}>Chỉ để vận hành lớp: xếp lớp, điểm danh, báo lịch học và link vào lớp, liên hệ với học sinh và phụ huynh về việc học. Web không dùng thông tin này để quảng cáo và không bán hay chia sẻ cho bên thứ ba.</p>

      <h2 className={h2}>Ai được xem</h2>
      <ul className={`${p} list-disc pl-5`}>
        <li>Chủ lớp xem được toàn bộ.</li>
        <li>Giáo viên chỉ xem được học sinh và buổi học của môn mình dạy, không xem được số điện thoại phụ huynh.</li>
        <li>Học sinh chỉ xem được thông tin của chính mình.</li>
      </ul>

      <h2 className={h2}>Lưu ở đâu</h2>
      <p className={p}>Dữ liệu nằm trên máy chủ của Vercel và cơ sở dữ liệu Neon (đặt tại Singapore), truyền qua kết nối mã hoá.</p>

      <h2 className={h2}>Quyền của bạn</h2>
      <p className={p}>Học sinh hoặc phụ huynh có thể yêu cầu xem, sửa hoặc xoá thông tin của mình bất cứ lúc nào bằng cách nhắn chủ lớp. Khi học sinh nghỉ hẳn và có yêu cầu, hồ sơ sẽ được xoá.</p>

      <h2 className={h2}>Liên hệ</h2>
      <p className={p}>Chủ lớp: <a href={`mailto:${LIEN_HE}`} className="font-semibold text-gold hover:underline">{LIEN_HE}</a>.</p>
    </main>
  );
}
