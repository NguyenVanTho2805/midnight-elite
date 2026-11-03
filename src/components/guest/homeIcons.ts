// Khoá icon của thẻ "Học ở đây thì được gì?" → component. Danh sách khoá (HOME_ICON_KEYS) nằm ở src/lib/siteContent.ts (thuần);
// bảng này ở đây vì siteContent.ts không được import griddy-icons. Dùng chung cho trang chủ thật, bản xem trước và ô chọn icon ở quản trị.
// Quản trị chọn theo KHOÁ; CSDL không bao giờ lưu tên component.
import { BookOpen, Calendar, ChatCircleDots, ClipboardList, GraduationCap, Key, Shield, Star, Trophy, Users } from "griddy-icons";
import type { HomeIconKey } from "@/lib/siteContent";

export const HOME_ICONS: Record<HomeIconKey, typeof Key> = {
  key: Key, calendar: Calendar, clipboard: ClipboardList, chat: ChatCircleDots, book: BookOpen,
  users: Users, graduation: GraduationCap, trophy: Trophy, shield: Shield, star: Star,
};

/** Nhãn tiếng Việt cho ô chọn icon (không để người dùng đọc tên khoá tiếng Anh). */
export const HOME_ICON_LABELS: Record<HomeIconKey, string> = {
  key: "Chìa khoá", calendar: "Lịch", clipboard: "Bài thi", chat: "Hỏi đáp", book: "Tài liệu",
  users: "Nhóm người", graduation: "Mũ tốt nghiệp", trophy: "Cúp", shield: "Khiên", star: "Ngôi sao",
};
