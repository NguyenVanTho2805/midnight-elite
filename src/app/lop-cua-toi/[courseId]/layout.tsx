// Trang lớp /lop-cua-toi/[courseId] (Hộp việc kiểu Outlook của một lớp, TK-179) nằm ngoài nhóm (tutor) nên trước 16/10/2026 không có vỏ nào, cả gia sư lẫn học sinh.
import LopCuaToiFrame from "@/components/shell/LopCuaToiFrame";

export default function LopLayout({ children }: { children: React.ReactNode }) {
  return <LopCuaToiFrame>{children}</LopCuaToiFrame>;
}
