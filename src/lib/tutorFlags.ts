// LOI-02 (11/11/2026) — cờ giao diện của phòng Gia sư. Thuần, chạy được ở cả máy chủ lẫn trình duyệt.
// Đặc tả: docs/kin/phong-ban/dac-ta/LOI-02.md mục 3. Một chỗ quyết định cờ lịch: Hộp việc (tutorDashboard / tutorInboxServer), thẻ lớp, thanh bên (LOI-01).

/** Giá trị biến môi trường → cờ lịch bật? Chỉ đúng chuỗi "1" là bật; mọi giá trị khác (kể cả không đặt) là tắt. */
export const lichOpenFrom = (v: string | undefined): boolean => v === "1";

/** Đọc tĩnh process.env.NEXT_PUBLIC_KIN_MO_LICH (để Next nhúng được vào mã trình duyệt). Mặc định (không đặt) ⇒ false. */
export const isLichOpen = (): boolean => lichOpenFrom(process.env.NEXT_PUBLIC_KIN_MO_LICH);
