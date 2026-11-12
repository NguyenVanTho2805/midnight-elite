// LOI-02 (11/11/2026) — cờ giao diện của phòng Gia sư. Thuần, chạy được ở cả máy chủ lẫn trình duyệt.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-02.md mục 3. Một chỗ quyết định cờ lịch: Hộp việc (tutorDashboard / tutorInboxServer), thẻ lớp, thanh bên (LOI-01).
// LOI-07: không còn đọc biến môi trường riêng — cờ lịch là `featureOn("LICH")` của src/lib/features.ts (MỘT nguồn cho cả 9 cờ).
// Giữ hai tên cũ để nơi gọi không phải đổi.
import { featureOn } from "@/lib/features";

/** Giá trị biến môi trường → cờ lịch bật? Cùng luật với `featureOn`: chỉ đúng chuỗi "1" là bật; mọi giá trị khác (kể cả không đặt) là tắt. */
export const lichOpenFrom = (v: string | undefined): boolean => featureOn("LICH", { LICH: v });

/** Cờ lịch (NEXT_PUBLIC_KIN_MO_LICH) đang mở? Đọc lúc gọi, qua `featureOn("LICH")`. Mặc định (không đặt) ⇒ false. */
export const isLichOpen = (): boolean => featureOn("LICH");
