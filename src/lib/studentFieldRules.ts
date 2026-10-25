// HT-02 — luật kiểm tra tại chỗ cho biểu mẫu hồ sơ học sinh của gia sư (thêm học sinh, sửa hồ sơ). Thuần, dùng chung và có test.
// KHÔNG thu thêm trường nào: chỉ báo sớm lỗi định dạng của ô đã có. Máy chủ (studentProfile.ts) vẫn kiểm lại và là nơi quyết định.
// Câu báo lỗi không chứa nội dung đã nhập (tên, SĐT, email, ngày sinh của em).
import type { FieldRule } from "@/lib/fieldRules";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { parseDateInput, validEmail } from "@/lib/studentProfile";

/** Cùng quy tắc máy chủ: 10 chữ số, chấp nhận +84 / 84 và dấu cách. Ô trống bỏ qua. */
export const zaloPhone = (label: string): FieldRule => v => (v.trim() === "" || normalizeZaloPhone(v) ? null : `${label} phải đủ 10 chữ số`);
export const dateVn = (label: string): FieldRule => v => (v.trim() === "" || parseDateInput(v) ? null : `${label} chưa đúng, ví dụ 15/03/2014`);
export const emailLoose = (label: string): FieldRule => v => (v.trim() === "" || validEmail(v.trim()) ? null : `${label} chưa đúng dạng, ví dụ ten@gmail.com`);

export const STUDENT_FIELD_RULES: Record<string, readonly FieldRule[]> = {
  name: [v => (v.trim() === "" ? "Nhập tên em" : null)],
  guardianPhone: [zaloPhone("Số điện thoại phụ huynh")],
  phone: [zaloPhone("Số điện thoại của em")],
  phoneExtra: [zaloPhone("Số điện thoại thứ ba")],
  email: [emailLoose("Email")],
  emailExtra: [emailLoose("Email bổ sung")],
  birthDate: [dateVn("Ngày sinh")],
  startDate: [dateVn("Ngày bắt đầu học")],
};
