// TT-203 — vỏ của gia sư: thanh module bên trái (điện thoại: thanh dưới), chỉ hiện module đang
// bật. BU-00 (31/10/2026): mặc định ĐỦ module (Hộp việc, Lịch, Lớp, Bài tập, Học phí…; gia sư tự tắt ở Cài đặt) — không còn "chế độ gọn" Lịch + Học phí.
// Học sinh / quản trị xem thử mở các trang này thì vào vỏ học sinh (16/10/2026: trước đó không có vỏ nào).
// Logic chọn vỏ ở src/components/shell/LopCuaToiFrame.tsx (dùng chung với trang lớp /lop-cua-toi/[courseId]).
import LopCuaToiFrame from "@/components/shell/LopCuaToiFrame";

export default function TutorGroupLayout({ children }: { children: React.ReactNode }) {
  return <LopCuaToiFrame>{children}</LopCuaToiFrame>;
}
