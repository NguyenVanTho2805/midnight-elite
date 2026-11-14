// Bốn khối dữ liệu THẬT của trang chủ công khai, theo thứ tự: Gia sư → Lớp theo kỳ thi → Thi thử miễn phí → Tin tức (BU-HS-LANDING mục 3).
// Component MÁY CHỦ nhận props (dữ liệu tải ở src/app/page.tsx bằng loadHomeLanding): không hook, không prisma, không đọc cookie, nên trang vẫn tĩnh.
// Khối nào không có dữ liệu thì KHÔNG có trong DOM (không khung trống, không "sắp có"); riêng Gia sư luôn còn phần chữ + nút "Tìm gia sư".
// Khối cảm nhận của học viên, khối vinh danh thành tích, biểu mẫu đăng ký tư vấn: CHƯA LÀM, chờ chủ (chưa có dữ liệu thật / chưa có luật thu) — cố ý không dựng khung nào.
// Các khối là <section> con TRỰC TIẾP của khung data-home-alt (HomeSections): nền đan xen do khung quyết, nên đây là Fragment chứ không bọc thêm thẻ.
import type { HomeContent } from "@/lib/siteContent";
import type { HomeLanding } from "@/lib/homeLanding";
import HomeTutors from "./HomeTutors";
import HomeCourses from "./HomeCourses";
import HomeExams from "./HomeExams";
import HomeNews from "./HomeNews";
import { featureOn } from "@/lib/features";

export default function HomeLandingBlocks({ landing, findTutor }: { landing: HomeLanding; findTutor: HomeContent["findTutor"] }) {
  return (
    <>
      {/* LOI-01: khối Gia sư / Tin tức chỉ dựng khi phần Tìm gia sư / Tin tức đang mở (src/lib/features.ts). */}
      {featureOn("TIM_GIA_SU") && <HomeTutors tutors={landing.tutors} findTutor={findTutor} />}
      <HomeCourses courses={landing.courses} chips={landing.courseChips} />
      {/* DG: khối Thi thử miễn phí chỉ dựng khi phần Thi thử công khai đang mở (cờ THI_THU_CONG_KHAI). */}
      {featureOn("THI_THU_CONG_KHAI") && <HomeExams exams={landing.exams} />}
      {featureOn("TIN_TUC") && <HomeNews articles={landing.articles} />}
    </>
  );
}
