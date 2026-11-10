// Trang chủ KiN — dựng theo Figma "Trang chủ KiN" (node 145:8, file KiN Design System).
// Khung: Header (Navbar) → Hero → [Lớp của tôi: chỉ học sinh] → Gia sư (+ "Tìm gia sư") → Lớp theo kỳ thi → Thi thử miễn phí → Tin tức → Bảng tin (+ Quiz) → Tính điểm → "Học ở đây thì được gì?" → CTA (ẩn khi đã đăng nhập) → Footer.
// BU-HS-LANDING (09/11/2026): bốn khối dữ liệu THẬT (Gia sư, Lớp, Thi thử, Tin) tải ở đây bằng loadHomeLanding() và truyền xuống làm component máy chủ nhận props. Lỗi/rỗng → khối biến mất khỏi DOM; trang vẫn tĩnh (không cookie).
// BU-HS-TRANG-CHU (09/11/2026): trang vẫn TĨNH (không đọc cookie, revalidate 1 giờ, HTML ban đầu = bản của khách). Khối theo người dùng / động là component máy khách (HomeMyClass, HomeCommunity, HomeCtaGuard);
// công thức tính điểm và cờ KIN_HOME_QUIZ đọc ở máy chủ, nằm trong HTML tĩnh.
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
import { loadPublicFormulas } from "@/lib/admissionFormulaServer";
import { homeBlocksFor } from "@/lib/homeLayout";
import { EMPTY_LANDING } from "@/lib/homeLanding";
import { loadHomeLanding } from "@/lib/homeLandingServer";
import HomeSections from "@/components/guest/HomeSections";
import HomeLandingBlocks from "@/components/guest/HomeLandingBlocks";
import HomeMyClass from "@/components/guest/HomeMyClass";
import HomeCommunity from "@/components/guest/HomeCommunity";
import HomeQuiz from "@/components/guest/HomeQuiz";
import HomeScore from "@/components/guest/HomeScore";
import HomeCtaGuard from "@/components/guest/HomeCtaGuard";

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
  // Công thức tính điểm: lỗi đọc (vd. bảng chưa có ở môi trường này) coi như chưa có công thức, không làm hỏng trang chủ.
  // Bốn khối dữ liệu thật: mỗi bộ tải đã tự bọc lỗi; `.catch` ngoài cùng là lớp bảo hiểm cuối (lỗi bất ngờ → trang chủ vẫn dựng, chỉ thiếu bốn khối).
  const [stats, c, formulas, landing] = await Promise.all([loadStats(), loadHomeContent(), loadPublicFormulas().catch(() => []), loadHomeLanding().catch(() => EMPTY_LANDING)]);
  // Khung quiz HIỆN mặc định (rỗng nói thật điều đó); chỉ ẩn khi đặt tường minh KIN_HOME_QUIZ=0. Đọc ở máy chủ (biến môi trường, không theo người dùng) nên trang vẫn tĩnh.
  const blocks = homeBlocksFor({ kind: "guest" }, { quiz: process.env.KIN_HOME_QUIZ !== "0" });
  return (
    <div data-vung="sang" className="kin-chu-than min-h-screen flex flex-col bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]">
      <Navbar />

      <main className="flex-1">
        <HomeSections content={c} stats={stats} slots={{
          landing: <HomeLandingBlocks landing={landing} findTutor={c.findTutor} />,
          afterHero: <HomeMyClass />,
          afterWhyIntro: (<>
            <HomeCommunity aside={blocks.quiz ? <HomeQuiz /> : undefined} />
            <HomeScore formulas={formulas} />
          </>),
          CtaWrap: HomeCtaGuard,
        }} />
      </main>

      <Footer />
    </div>
  );
}
