// Trang chủ KiN — dựng theo Figma "Trang chủ KiN" (node 145:8, file KiN Design System).
// Khung: Header (Navbar) → Hero → "Học ở đây thì được gì?" → "Tìm gia sư" → CTA → Footer.
// HOME-02: thân trang nằm ở src/components/guest/HomeSections.tsx (dùng chung với bản xem trước ở quản trị); tệp này chỉ tải dữ liệu và bọc Navbar/Footer.
// HOME-01: chữ lấy từ loadHomeContent() (bảng site_content, sửa được ở màn quản trị; không có hàng/lỗi DB thì dùng mặc định). Khối gia sư dạy thêm đã bỏ.
// Chữ hero + 4 thẻ cố ý khác Figma 145:8 (STU-002): Figma hứa live/trợ giảng/realtime mà KiN không có.
//
// So với bản cũ (đã bỏ, đều có chỗ khác hoặc không còn đúng):
//  - Danh sách khoá học + tìm kiếm + theo dõi lớp: nằm ở /khoa-hoc (đã có đủ).
//  - Dòng "Mua 1 lần, học trọn đời": sai cách bán thật (KiN thu học phí theo tháng).
//  - Đếm ngược kỳ thi (ngày viết cứng) và dòng thời gian "Hành trình phát triển".
//
// Chữ nhỏ trên nền navy dùng độ đục cao hơn bản Figma (0,65–0,78 thay vì 0,45–0,68):
// bản Figma đo được 3,4–4,3:1, trượt ngưỡng 4,5:1 mà docs/kin/thiet-ke/tuong-phan.md đặt ra.
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/userPreferences";
import { isProfileHidden } from "@/lib/tutorVisibility";
import { loadHomeContent } from "@/lib/siteContentServer";
import HomeSections from "@/components/guest/HomeSections";

// Số liệu ở khung "Đang mở luyện thi" là SỐ ĐẾM THẬT từ cơ sở dữ liệu (làm mới mỗi giờ). Bản Figma ghi 1.200+ / 10.000+ / 6 nhưng đó là
// số minh hoạ chưa có nguồn nên không dùng. Số nào bằng 0 thì ẩn; truy vấn lỗi thì ẩn cả khối (không bao giờ hiện số bịa).
export const revalidate = 3600;

async function loadStats(): Promise<{ value: string; label: string }[]> {
  try {
    const [learners, exams, tutors] = await Promise.all([
      prisma.enrollment.groupBy({ by: ["userId"], where: { status: "active" } }).then(r => r.length),
      prisma.exam.count({ where: { active: true } }),
      // NC2-022: gia sư đã chọn ẨN hồ sơ không tính vào số "Gia sư" công khai.
      prisma.user.findMany({ where: { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false }, select: { preferences: true } }).then(r => r.filter(t => !isProfileHidden(readPreferences(t.preferences))).length),
    ]);
    return [
      { value: learners, label: "Học sinh đang học" },
      { value: exams, label: "Đề thi thử" },
      { value: tutors, label: "Gia sư" },
    ].filter(s => s.value > 0).map(s => ({ value: s.value.toLocaleString("vi-VN"), label: s.label }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [stats, c] = await Promise.all([loadStats(), loadHomeContent()]);
  return (
    <div data-vung="sang" className="kin-chu-than min-h-screen flex flex-col bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]">
      <Navbar />

      <main className="flex-1">
        <HomeSections content={c} stats={stats} />
      </main>

      <Footer />
    </div>
  );
}
