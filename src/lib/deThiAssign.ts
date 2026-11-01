// BU-03 — hằng "cổng" cho phần phòng thi phía học sinh, đặt ở MỘT nơi (đặc tả mục 6.2). THUẦN: không DB, không React.
// P3 (giao đề: validateAssignPatch, mặc định theo chế độ) sẽ thêm vào tệp này; vòng P2 chỉ cần hai cờ.

/**
 * `true` khi phòng thi (BU-04, stu-code) đã định tuyến học sinh vào đúng mã đề (`pickVariantFor`), gộp lượt/điểm theo nhóm mã đề
 * và ẩn hàng `variantOfId != null` khỏi danh sách (yêu cầu D2). Cho tới lúc đó: đề N>1 mã bị chặn phát hành (422 VARIANTS_NOT_READY).
 * BU-04 xong thì đổi đúng dòng này thành `true`.
 */
export const VARIANT_STUDENT_SUPPORT = false;

/**
 * `true` khi đối tượng "giao theo link" (đề không gắn lớp) không còn lọt vào danh sách công khai của học sinh (D2). Đổi `true` một dòng khi BU-04 xong.
 * Hiện publish vẫn bắt buộc có lớp nên cờ này chưa chặn thêm gì; P3 (giao theo link) dùng nó.
 */
export const AUDIENCE_LINK_READY = false;
