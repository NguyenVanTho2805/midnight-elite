// NC2-035 — kiểm hợp lệ giá trị lớp do GIA SƯ gửi lên (POST /api/courses, PUT/PATCH /api/courses/[id]).
// Chỉ TỪ CHỐI giá trị vô lý; KHÔNG đổi cách tính phí/phiếu/học phí. Quản trị trung tâm giữ hành vi cũ (không kiểm).
// Đây là mục đụng tới tiền (giá lớp) nên mọi trần đều là hằng số có tên, dễ thấy và dễ chỉnh.

/** Trần giá một lớp do gia sư đặt: 50.000.000 đ. Cao hơn rất nhiều so với học phí gia sư tự do thực tế
 *  (vài trăm nghìn đến vài triệu/khoá); vẫn đủ rộng cho khoá luyện thi trọn gói. Chỉ để chặn gõ nhầm (thừa số 0). */
export const MAX_TUTOR_COURSE_PRICE_VND = 50_000_000;
/** Trần số bài của một lớp: 1.000 bài (khoá dài nhất hợp lý ~ 3 năm x 5 buổi/tuần = ~780). */
export const MAX_TUTOR_COURSE_LESSONS = 1_000;
/** Trần số giờ của một lớp: 5.000 giờ. */
export const MAX_TUTOR_COURSE_HOURS = 5_000;

const fmt = (n: number) => n.toLocaleString("vi-VN");

function checkInt(label: string, v: unknown, max: number, unit: string): string | null {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return `${label} phải là số nguyên.`;
  if (v < 0) return `${label} không được âm.`;
  if (v > max) return `${label} không được vượt quá ${fmt(max)}${unit}.`;
  return null;
}

/** Trả thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ. Chỉ kiểm các khoá có mặt trong `data`. */
export function validateTutorCourseFields(data: Record<string, unknown>): string | null {
  if ("price" in data) {
    const e = checkInt("Giá lớp", data.price, MAX_TUTOR_COURSE_PRICE_VND, " đ");
    if (e) return e;
  }
  if ("originalPrice" in data && data.originalPrice !== null) {
    const e = checkInt("Giá gốc", data.originalPrice, MAX_TUTOR_COURSE_PRICE_VND, " đ");
    if (e) return e;
  }
  if ("lessons" in data) {
    const e = checkInt("Số bài", data.lessons, MAX_TUTOR_COURSE_LESSONS, " bài");
    if (e) return e;
  }
  if ("hours" in data) {
    const e = checkInt("Số giờ", data.hours, MAX_TUTOR_COURSE_HOURS, " giờ");
    if (e) return e;
  }
  if ("status" in data && typeof data.status !== "boolean") {
    return "Trạng thái hiển thị chỉ nhận bật hoặc tắt.";
  }
  return null;
}
